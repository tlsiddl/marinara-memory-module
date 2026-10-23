'use strict';
// Engine side of the memory module: reads chats through Marinara's own storage, borrows a saved
// connection for the memory model, keeps one ledger file per chat, and serves a small admin API.

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const L = require('./ledger.cjs');

const DATA_DIR = path.join(process.env.DATA_DIR || '/app/data', 'memory-module');
const CHAT_DIR = path.join(DATA_DIR, 'chats');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const REBUILD_BATCH_CHARS = Number(process.env.MEMORY_MODULE_BATCH_CHARS) || 24000;
const CONTEXT_MESSAGES = 2;
const MODEL_TIMEOUT_MS = 5 * 60_000;

function log(message) {
  process.stderr.write(`[memory-module] ${message}\n`);
}

function serverDist() {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
  if (!/[\\/]packages[\\/]server[\\/]dist[\\/]index\.js$/i.test(entry)) throw Error(`unexpected server entry ${entry}`);
  return path.dirname(entry);
}

let enginePromise = null;
function engine() {
  enginePromise ??= (async () => {
    const dist = serverDist();
    const load = (rel) => import(pathToFileURL(path.join(dist, rel)).href);
    const [db, chats, characters, connections, registry, baseUrl] = await Promise.all([
      load('db/connection.js'),
      load('services/storage/chats.storage.js'),
      load('services/storage/characters.storage.js'),
      load('services/storage/connections.storage.js'),
      load('services/llm/provider-registry.js'),
      load('services/generation/connection-base-url.js'),
    ]);
    const handle = await db.getDB();
    return {
      chats: chats.createChatsStorage(handle),
      characters: characters.createCharactersStorage(handle),
      connections: connections.createConnectionsStorage(handle),
      createLLMProvider: registry.createLLMProvider,
      resolveBaseUrl: baseUrl.resolveBaseUrl,
    };
  })();
  enginePromise.catch(() => (enginePromise = null));
  return enginePromise;
}

/* ---------- files ---------- */

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

function safeChatId(chatId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(chatId || ''))) throw Error('invalid chat id');
  return chatId;
}

const ledgerFile = (chatId) => path.join(CHAT_DIR, `${safeChatId(chatId)}.json`);
const cache = new Map();

function loadLedger(chatId) {
  if (cache.has(chatId)) return cache.get(chatId);
  const stored = readJson(ledgerFile(chatId), null);
  const ledger = stored && stored.version === L.LEDGER_VERSION ? stored : null;
  cache.set(chatId, ledger);
  return ledger;
}

function saveLedger(chatId, ledger) {
  ledger.updatedAt = new Date().toISOString();
  writeJson(ledgerFile(chatId), ledger);
  cache.set(chatId, ledger);
}

function settings() {
  return { connection: null, chats: {}, ...readJson(SETTINGS_FILE, {}) };
}

function saveSettings(next) {
  writeJson(SETTINGS_FILE, next);
}

function chatEnabled(chatId) {
  return settings().chats?.[chatId]?.enabled === true;
}

function setChatEnabled(chatId, enabled) {
  const next = settings();
  next.chats = { ...next.chats, [chatId]: { ...(next.chats?.[chatId] || {}), enabled } };
  saveSettings(next);
}

/* ---------- messages ---------- */

function parseExtra(value) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

const nameCache = new Map();
async function characterName(e, id) {
  if (!id) return null;
  if (nameCache.has(id)) return nameCache.get(id);
  let name = null;
  try {
    const row = await e.characters.getById(id);
    name = row ? JSON.parse(row.data || '{}').name || null : null;
  } catch {}
  nameCache.set(id, name);
  return name;
}

/** The chat as the memory model sees it: visible user/assistant/narrator messages, numbered by position. */
async function chatMessages(chatId) {
  const e = await engine();
  const rows = await e.chats.listMessages(chatId);
  const out = [];
  for (const [index, row] of rows.entries()) {
    if (!['user', 'assistant', 'narrator'].includes(row.role)) continue;
    const extra = parseExtra(row.extra);
    if (extra.hiddenFromAI === true || !String(row.content || '').trim()) continue;
    const speaker =
      row.role === 'user'
        ? extra.personaSnapshot?.name || 'User'
        : row.role === 'narrator'
          ? 'Narrator'
          : (await characterName(e, row.characterId)) || 'Character';
    out.push({ id: row.id, number: row.rowid ?? index + 1, speaker, content: String(row.content) });
  }
  return L.prepareMessages(out);
}

/* ---------- memory model ---------- */

async function memoryModel() {
  const e = await engine();
  const wanted = settings().connection;
  if (!wanted) throw Error('기억용 연결이 정해지지 않았어. memory-cli connection "<연결 이름>"으로 정해 줘.');
  const list = await e.connections.list();
  const row = list.find((c) => c.id === wanted) || list.find((c) => c.name === wanted);
  if (!row) throw Error(`연결 "${wanted}"을 찾지 못했어.`);
  const conn = await e.connections.getWithKey(row.id);
  const baseUrl = e.resolveBaseUrl(conn);
  if (!baseUrl) throw Error(`연결 "${row.name}"에 주소(base URL)가 없어.`);
  const provider = e.createLLMProvider(
    conn.provider,
    baseUrl,
    conn.apiKey,
    conn.maxContext,
    conn.openrouterProvider,
    null,
    conn.claudeFastMode === 'true',
    conn.treatAsLocalEndpoint === 'true',
    conn.defaultParameters,
  );
  return { provider, model: conn.model, name: row.name };
}

async function askModel(model, messages) {
  const signal = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const base = { model: model.model, maxTokens: 4096, temperature: 0.2, signal };
  try {
    return (await model.provider.chatComplete(messages, { ...base, responseFormat: { type: 'json_object' } })).content;
  } catch (error) {
    if (!/response_format|json_object|responseFormat/i.test(String(error?.message))) throw error;
    return (await model.provider.chatComplete(messages, base)).content;
  }
}

/** Read one batch; an unreadable reply is retried once, then the batch is halved. */
async function readBatch(model, ledger, batch, context) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await askModel(model, L.buildPrompt(ledger, batch, context));
    const parsed = L.parseJsonObject(reply);
    if (parsed) return [{ batch, parsed }];
  }
  if (batch.length < 2) throw Error(`메시지 ${batch[0].number}번의 정리 결과를 읽지 못했어.`);
  const half = Math.ceil(batch.length / 2);
  const first = await readBatch(model, ledger, batch.slice(0, half), context);
  return [...first, ...(await readBatch(model, ledger, batch.slice(half), batch.slice(half - CONTEXT_MESSAGES, half)))];
}

const TIDY_EVERY_REPLIES = 15;
const TIDY_CHUNK = 60;

/** Close finished threads and fold duplicates. Open threads are checked in chunks of TIDY_CHUNK. */
async function tidyLedger(model, ledger, messages) {
  const recent = messages.slice(-4);
  const total = { closed: 0, merged: 0, calls: 0 };
  const open = ledger.threads.filter((t) => t.status === 'open');
  for (const kind of L.KINDS) {
    const ofKind = open.filter((t) => t.kind === kind);
    for (let i = 0; i < ofKind.length; i += TIDY_CHUNK) {
      const view = { threads: ofKind.slice(i, i + TIDY_CHUNK) };
      const parsed = L.parseJsonObject(await askModel(model, L.buildTidyPrompt(view, recent)));
      total.calls++;
      if (!parsed) continue;
      const stats = L.applyTidy(ledger, parsed);
      total.closed += stats.closed;
      total.merged += stats.merged;
    }
  }
  ledger.repliesSinceTidy = 0;
  ledger.lastTidy = { at: new Date().toISOString(), ...total };
  return total;
}

/* ---------- jobs ---------- */

const queues = new Map();
const jobs = new Map();

function enqueue(chatId, task) {
  const previous = queues.get(chatId) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  queues.set(chatId, next);
  next.finally(() => queues.get(chatId) === next && queues.delete(chatId)).catch(() => {});
  return next;
}

function jobStatus(chatId) {
  return jobs.get(chatId) || { state: 'idle' };
}

/**
 * Bring the ledger up to date with the chat. mode "rebuild" starts from an empty ledger.
 * Progress is saved after every batch, so a stopped or failed run continues where it left off.
 */
function processChat(chatId, { rebuild = false, reason = 'auto' } = {}) {
  return enqueue(chatId, async () => {
    if (!rebuild && !chatEnabled(chatId)) return;
    const job = { state: 'running', reason, done: 0, total: 0, startedAt: new Date().toISOString(), error: null, cancel: false };
    jobs.set(chatId, job);
    try {
      const messages = await chatMessages(chatId);
      let ledger = rebuild ? L.emptyLedger() : loadLedger(chatId) || L.emptyLedger();
      const state = L.reconcile(ledger, messages);
      if (state.rebuild) {
        ledger.needsRebuild = { at: new Date().toISOString(), changedAt: state.changedAt };
        saveLedger(chatId, ledger);
        throw Error('예전 메시지가 수정·삭제돼서 장부를 처음부터 다시 정리해야 해. memory-cli start로 다시 정리해 줘.');
      }
      if (state.rolledBack) log(`chat ${chatId}: message ${state.changedAt + 1} changed, rolled back and re-reading`);
      const remaining = messages.slice(state.from);
      if (!remaining.length) {
        if (state.rolledBack) saveLedger(chatId, ledger);
        job.state = 'done';
        return;
      }
      const batches = L.planBatches(remaining, REBUILD_BATCH_CHARS);
      job.total = batches.length;
      const model = await memoryModel();
      for (const batch of batches) {
        if (job.cancel) throw Error('중단했어. 다시 시작하면 이어서 정리해.');
        const at = messages.indexOf(batch[0]);
        const context = messages.slice(Math.max(0, at - CONTEXT_MESSAGES), at);
        for (const part of await readBatch(model, ledger, batch, context)) {
          L.beginBatch(ledger, messages.indexOf(part.batch[0]));
          const stats = L.applyResult(ledger, part.parsed, part.batch);
          L.commitBatch(ledger, part.batch);
          if (stats.dropped) log(`chat ${chatId}: dropped ${stats.dropped} ungrounded item(s)`);
        }
        delete ledger.needsRebuild;
        job.done++;
        // A long first pass is tidied along the way so the open list each batch sees stays short.
        if (batches.length > 1 && job.done % 8 === 0 && job.done < batches.length) {
          job.stage = '장부 점검';
          await tidyLedger(model, ledger, messages.slice(0, messages.indexOf(batch.at(-1)) + 1));
          job.stage = null;
        }
        saveLedger(chatId, ledger);
      }
      ledger.repliesSinceTidy = (ledger.repliesSinceTidy || 0) + (reason === 'reply' ? 1 : 0);
      if (batches.length > 1 || ledger.repliesSinceTidy >= TIDY_EVERY_REPLIES) {
        job.stage = '장부 점검';
        const tidy = await tidyLedger(model, ledger, messages);
        log(`chat ${chatId}: tidy closed ${tidy.closed}, merged ${tidy.merged} (${tidy.calls} call(s))`);
      }
      saveLedger(chatId, ledger);
      job.stage = null;
      job.state = 'done';
      log(`chat ${chatId}: ledger up to date (${reason}, ${job.total} call(s))`);
    } catch (error) {
      job.state = 'error';
      job.error = error?.message || String(error);
      log(`chat ${chatId}: ${job.error}`);
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  });
}

/** Run only the tidy pass on the saved ledger (the "tidy" command). */
function tidyChat(chatId) {
  return enqueue(chatId, async () => {
    const job = { state: 'running', reason: 'tidy', stage: '장부 점검', done: 0, total: 1, startedAt: new Date().toISOString(), error: null };
    jobs.set(chatId, job);
    try {
      const ledger = loadLedger(chatId);
      if (!ledger) throw Error('아직 장부가 없어. 먼저 start로 정리해 줘.');
      const before = ledger.threads.filter((t) => t.status === 'open').length;
      const tidy = await tidyLedger(await memoryModel(), ledger, await chatMessages(chatId));
      saveLedger(chatId, ledger);
      job.result = { before, after: ledger.threads.filter((t) => t.status === 'open').length, ...tidy };
      job.done = 1;
      job.state = 'done';
      log(`chat ${chatId}: tidy ${before} → ${job.result.after} open (${tidy.calls} call(s))`);
    } catch (error) {
      job.state = 'error';
      job.error = error?.message || String(error);
    } finally {
      job.stage = null;
      job.finishedAt = new Date().toISOString();
    }
  });
}

/* ---------- prompt ---------- */

/** Synchronous: called from the {{기억}} macro while the prompt is assembled. */
function renderLedger(chatId) {
  const ledger = loadLedger(chatId);
  return ledger ? L.render(ledger) : '';
}

/* ---------- admin API ---------- */

function summary(ledger) {
  const threads = ledger?.threads || [];
  const count = (kind) => threads.filter((t) => t.kind === kind && t.status === 'open').length;
  return {
    processed: ledger?.processed?.length || 0,
    open: { promise: count('promise'), emotion: count('emotion'), secret: count('secret'), pending: count('pending') },
    closed: threads.filter((t) => t.status === 'closed').length,
    needsRebuild: Boolean(ledger?.needsRebuild),
    lastTidy: ledger?.lastTidy || null,
    updatedAt: ledger?.updatedAt || null,
  };
}

async function routes(app) {
  const guard = (fn) => async (req, reply) => {
    try {
      return await fn(req, reply);
    } catch (error) {
      return reply.status(400).send({ error: error?.message || String(error) });
    }
  };
  app.get('/status', guard(async () => ({ settings: settings(), dataDir: DATA_DIR })));
  app.post('/settings', guard(async (req) => {
    const connection = String(req.body?.connection || '').trim();
    if (!connection) throw Error('연결 이름이 비어 있어.');
    const e = await engine();
    const list = await e.connections.list();
    const row = list.find((c) => c.id === connection) || list.find((c) => c.name === connection);
    if (!row) throw Error(`연결 "${connection}"을 찾지 못했어. 있는 연결: ${list.map((c) => c.name).join(', ')}`);
    saveSettings({ ...settings(), connection: row.id });
    return { connection: { id: row.id, name: row.name, model: row.model } };
  }));
  app.get('/chats', guard(async () => {
    const e = await engine();
    const list = await e.chats.list();
    return list.map((chat) => ({
      id: chat.id,
      name: chat.name,
      mode: chat.mode,
      updatedAt: chat.updatedAt,
      enabled: chatEnabled(chat.id),
      ledger: summary(loadLedger(chat.id)),
    }));
  }));
  app.get('/chats/:id', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    const ledger = loadLedger(chatId);
    const { cancel: _cancel, ...job } = jobStatus(chatId);
    return { enabled: chatEnabled(chatId), job, summary: summary(ledger), threads: ledger?.threads || [], rendered: renderLedger(chatId) };
  }));
  app.post('/chats/:id/estimate', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    const messages = await chatMessages(chatId);
    const batches = L.planBatches(messages, REBUILD_BATCH_CHARS);
    return { messages: messages.length, chars: messages.reduce((n, m) => n + m.content.length, 0), calls: batches.length };
  }));
  app.post('/chats/:id/start', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    if (jobStatus(chatId).state === 'running') throw Error('이미 정리 중이야.');
    await memoryModel();
    const fresh = req.body?.fresh === true || !loadLedger(chatId);
    setChatEnabled(chatId, true);
    processChat(chatId, { rebuild: fresh, reason: fresh ? 'rebuild' : 'resume' });
    return { started: true, fresh };
  }));
  app.post('/chats/:id/tidy', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    if (jobStatus(chatId).state === 'running') throw Error('지금 정리 중이야. 끝난 뒤에 다시 해 줘.');
    await memoryModel();
    tidyChat(chatId);
    return { started: true };
  }));
  app.post('/chats/:id/stop', guard(async (req) => {
    const job = jobs.get(safeChatId(req.params.id));
    if (job?.state === 'running') job.cancel = true;
    return { stopping: job?.state === 'running' };
  }));
  app.post('/chats/:id/enable', guard(async (req) => (setChatEnabled(safeChatId(req.params.id), true), { enabled: true })));
  app.post('/chats/:id/disable', guard(async (req) => (setChatEnabled(safeChatId(req.params.id), false), { enabled: false })));
}

/** Called once from Marinara's app setup (see the runtime hook). */
function attach(app) {
  app.register(routes, { prefix: '/api/memory-module' });
  app.addHook('onResponse', async (req, reply) => {
    try {
      const url = String(req.raw?.url || '').split('?')[0];
      if (req.method !== 'POST' || url !== '/api/generate' || reply.statusCode >= 400) return;
      const chatId = req.body?.chatId;
      if (typeof chatId === 'string' && chatEnabled(chatId)) setTimeout(() => processChat(chatId, { reason: 'reply' }), 1500);
    } catch (error) {
      log(`reply hook: ${error?.message || error}`);
    }
  });
  log('admin API ready at /api/memory-module');
}

module.exports = { attach, renderLedger, processChat, chatMessages, DATA_DIR };
