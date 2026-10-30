'use strict';
// Engine side of the memory module: reads chats through Marinara's own storage, borrows a saved
// connection for the memory model, keeps one ledger file per chat, and serves a small admin API.

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const L = require('./ledger.cjs');
const S = require('./scenes.cjs');
const R = require('./recall.cjs');
const V = require('./vectors.cjs');
const SP = require('./speakers.cjs');
const T = require('./translate.cjs');

/**
 * Marinara's own data folder, found the way Marinara finds it: DATA_DIR (relative to the server package) if set,
 * otherwise packages/server/data. Docker sets DATA_DIR=/app/data; a plain install or Termux uses the default.
 */
function marinaraDataDir() {
  let serverRoot = null;
  try {
    serverRoot = path.resolve(serverDist(), '..');
  } catch {}
  const raw = String(process.env.DATA_DIR || '').trim();
  if (raw) return serverRoot ? path.resolve(serverRoot, raw) : path.resolve(raw);
  return serverRoot ? path.join(serverRoot, 'data') : '/app/data';
}
const DATA_DIR = path.join(marinaraDataDir(), 'memory-module');
const CHAT_DIR = path.join(DATA_DIR, 'chats');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
// About three or four messages at a time: the same small view the model gets after a live reply.
const REBUILD_BATCH_CHARS = Number(process.env.MEMORY_MODULE_BATCH_CHARS) || 8000;
const TRIAL_MAX_MESSAGES = 40;
const CONTEXT_MESSAGES = 2;
const MODEL_TIMEOUT_MS = 5 * 60_000;
// Chats without a message limit still have one in practice (the token budget); fold past this many.
const DEFAULT_WINDOW = Number(process.env.MEMORY_MODULE_DEFAULT_WINDOW) || 30;
const SCENE_MIN_PENDING = 8;
/** The whole recall before a reply (meaning search + the model's pick) gets this long; then the fast pick is used. */
const RECALL_TIMEOUT_MS = Number(process.env.MEMORY_MODULE_RECALL_TIMEOUT_MS) || 20_000;
/** Less than this left for the model's pick: do not start it, use the fast pick. */
const RECALL_MIN_MODEL_MS = 3_000;
const RECALL_MODES = ['model', 'fast', 'off'];

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
    // Trackers are optional: a Marinara without them (or with another layout) just gives no story clock.
    let gameStates = null;
    try {
      gameStates = (await load('services/storage/game-state.storage.js')).createGameStateStorage(handle);
    } catch {}
    return {
      gameStates,
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

/**
 * Files that exist but could not be read (broken JSON, no permission). The original is copied aside once and
 * the file is never written over automatically while it stays broken: deleting or fixing it lifts the block.
 */
const brokenFiles = new Map();

function readJson(file, fallback, { replaceable = false } = {}) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      brokenFiles.delete(file);
      return fallback;
    }
    return markBroken(file, error, fallback, replaceable);
  }
  try {
    const value = JSON.parse(text);
    brokenFiles.delete(file);
    return value;
  } catch (error) {
    return markBroken(file, error, fallback, replaceable);
  }
}

/**
 * A memory file in a data format this version does not know (made by a newer module, or a future change):
 * not empty memory. It is kept and reported like a broken file, and not written over.
 */
function supported(file, stored, version) {
  if (!stored) return null;
  if (stored.version === version) return stored;
  markBroken(file, Error(`지원하지 않는 데이터 버전(${stored.version ?? '없음'}, 이 모듈은 ${version})`), null, false, 'version');
  return null;
}

function markBroken(file, error, fallback, replaceable, reason = 'broken') {
  const old = brokenFiles.get(file);
  if (old) return fallback;
  let backup = null;
  try {
    backup = `${file}.broken-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(file, backup);
  } catch {
    backup = null;
  }
  brokenFiles.set(file, { file, backup, reason, error: String(error?.message || error).slice(0, 200), at: new Date().toISOString(), replaceable });
  log(`could not read ${file}: ${error?.message || error}${backup ? ` (copy kept at ${backup})` : ''}${replaceable ? '' : '; it will not be written over'}`);
  return fallback;
}

function writeJson(file, value) {
  const broken = brokenFiles.get(file);
  if (broken && !broken.replaceable && fs.existsSync(file)) {
    throw Error(`기억 파일(${path.basename(file)})을 ${broken.reason === 'version' ? '이 버전의 모듈이 모르는 형식이라' : '손상되어'} 읽지 못했습니다. 덮어쓰지 않도록 저장을 멈췄습니다.${broken.backup ? ` 원본 복사본: ${broken.backup}.` : ''} 파일을 고치거나 지운 뒤 다시 시도해 주세요.`);
  }
  brokenFiles.delete(file);
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
  const stored = supported(ledgerFile(chatId), readJson(ledgerFile(chatId), null), L.LEDGER_VERSION);
  const ledger = stored;
  cache.set(chatId, ledger);
  return ledger;
}

function saveLedger(chatId, ledger) {
  ledger.updatedAt = new Date().toISOString();
  writeJson(ledgerFile(chatId), ledger);
  cache.set(chatId, ledger);
}

const windows = new Map();
const scenesFile = (chatId) => path.join(CHAT_DIR, `${safeChatId(chatId)}.scenes.json`);
const sceneCache = new Map();

function loadScenes(chatId) {
  if (sceneCache.has(chatId)) return sceneCache.get(chatId);
  const store = supported(scenesFile(chatId), readJson(scenesFile(chatId), null), S.SCENES_VERSION);
  sceneCache.set(chatId, store);
  return store;
}

function saveScenes(chatId, store) {
  store.updatedAt = new Date().toISOString();
  writeJson(scenesFile(chatId), store);
  sceneCache.set(chatId, store);
}

/* ---------- branch inheritance ---------- */

/**
 * Copy only the common prefix. Identity and evidence use chat-local message IDs / row numbers,
 * so every pointer (including rollback snapshots) must follow the new messages. Never edit the source.
 */
function branchMemory(ledger, scenes, source, target, messageIds) {
  const prefix = [];
  const ids = new Map();
  const numbers = new Map();
  for (let i = 0; i < source.length && i < target.length; i++) {
    const a = source[i], b = target[i];
    if (messageIds.get(a.id) !== b.id || a.h !== b.h || a.role !== b.role || a.speaker !== b.speaker || L.trackerChanged(a, b)) break;
    prefix.push(a);
    ids.set(a.id, b.id);
    numbers.set(a.number, b.number);
  }
  const remap = (value) => {
    if (Array.isArray(value)) return value.map(remap);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === 'number' && typeof val === 'number') {
        if (!numbers.has(val)) throw Error('기억의 원문 참조가 분기 범위를 벗어났습니다.');
        out[key] = numbers.get(val);
      } else if ((key === 'messageId' || key === 'id') && ids.has(val)) out[key] = ids.get(val);
      else out[key] = remap(val);
    }
    return out;
  };
  let nextLedger = ledger ? structuredClone(ledger) : null;
  let ledgerReset = false;
  if (nextLedger) {
    const change = L.reconcile(nextLedger, prefix);
    // An old fork can predate the bounded undo history. Re-read that ledger rather than inherit future events.
    if (change.rebuild) { nextLedger = L.emptyLedger(); ledgerReset = true; }
    delete nextLedger.needsRebuild;
    delete nextLedger.verifiedBefore;
    nextLedger = remap(nextLedger);
    nextLedger.lastNumber = numbers.get(nextLedger.lastNumber) ?? null;
    nextLedger.storyDate = L.storyDate(prefix.slice(0, nextLedger.processed.length)) || null;
    nextLedger.storyTime = L.storyTime(prefix.slice(0, nextLedger.processed.length)) || null;
  }
  let nextScenes = scenes ? structuredClone(scenes) : null;
  if (nextScenes) {
    S.reconcileScenes(nextScenes, prefix);
    const factIds = new Set(nextScenes.facts.map((f) => f.id));
    for (const f of nextScenes.facts) if (f.replacedBy && !factIds.has(f.replacedBy)) delete f.replacedBy;
    // `start` is a message number on scenes/chapters, but an array offset on ledger snapshots.
    for (const x of [...nextScenes.scenes, ...(nextScenes.chapters || [])]) {
      if (!numbers.has(x.start) || !numbers.has(x.end)) throw Error('장면의 원문 범위를 분기에 연결하지 못했습니다.');
      x.start = numbers.get(x.start);
      x.end = numbers.get(x.end);
    }
    nextScenes.window = null;
    nextScenes = remap(nextScenes);
  }
  return { ledger: nextLedger, scenes: nextScenes, matched: prefix.length, ledgerReset };
}

async function inheritBranch(sourceId, targetId) {
  safeChatId(sourceId); safeChatId(targetId);
  if (sourceId === targetId) throw Error('원본 방에 분기 기억을 쓸 수 없습니다.');
  return enqueue(targetId, async () => {
    const files = [ledgerFile(targetId), scenesFile(targetId), vectorsFile(targetId)];
    // This also makes a repeated hook harmless and protects an existing/broken destination file.
    if (files.some((file) => fs.existsSync(file)) || settings().chats?.[targetId]) return { skipped: true };
    checkFiles(sourceId);
    checkFiles(targetId);
    const e = await engine();
    const sourceRows = await e.chats.listMessages(sourceId);
    const targetRows = await e.chats.listMessages(targetId);
    if (targetRows.length > sourceRows.length) throw Error('분기 메시지 수가 원본보다 많습니다.');
    const ids = new Map();
    for (let i = 0; i < targetRows.length; i++) {
      const a = sourceRows[i], b = targetRows[i];
      // Interrupted messages can legitimately differ on a prefix branch. The prepared-prefix check
      // below stops there; do not associate a different speaker/role with an old memory.
      if (a.role !== b.role || a.characterId !== b.characterId) break;
      ids.set(a.id, b.id);
    }
    const source = await chatMessages(sourceId);
    const target = await chatMessages(targetId);
    const result = branchMemory(loadLedger(sourceId), loadScenes(sourceId), source, target, ids);
    const next = settings();
    const sourceSettings = next.chats?.[sourceId];
    const vectors = vectorCache.get(sourceId) || readJson(vectorsFile(sourceId), null, { replaceable: true });
    let copiedVectors = null;
    if (result.scenes && vectors?.v === V.INDEX_VERSION && vectors.items) {
      copiedVectors = structuredClone(vectors);
      V.prune(copiedVectors, result.scenes.scenes);
    }
    const written = [];
    try {
      if (result.ledger) { saveLedger(targetId, result.ledger); written.push(files[0]); }
      if (result.scenes) { saveScenes(targetId, result.scenes); written.push(files[1]); }
      if (copiedVectors) { saveVectors(targetId, copiedVectors); written.push(files[2]); }
      if (sourceSettings) {
        next.chats = { ...next.chats, [targetId]: structuredClone(sourceSettings) };
        saveSettings(next);
      }
    } catch (error) {
      for (const file of written) fs.rmSync(file, { force: true });
      cache.delete(targetId); sceneCache.delete(targetId); vectorCache.delete(targetId);
      throw error;
    }
    log(`branch ${sourceId} -> ${targetId}: inherited ${result.matched} message(s), ${result.scenes?.scenes.length || 0} scene(s)${result.ledgerReset ? '; old fork: ledger will be read again' : ''}`);
    return result;
  });
}

/** onSend is awaited before the new branch reaches the browser (onResponse would race the first reply). */
async function branchOnSend(req, reply, payload) {
  const url = String(req.raw?.url || '').split('?')[0];
  const match = /^\/api\/chats\/([A-Za-z0-9_-]{1,128})\/branch\/?$/.exec(url);
  if (req.method !== 'POST' || !match || reply.statusCode < 200 || reply.statusCode >= 300) return payload;
  let targetId;
  try {
    const chat = typeof payload === 'string' || Buffer.isBuffer(payload) ? JSON.parse(String(payload)) : payload;
    targetId = chat?.id;
    if (typeof targetId !== 'string') return payload;
    await inheritBranch(match[1], targetId);
  } catch (error) {
    log(`branch inheritance failed: ${error?.message || error}`);
    if (typeof targetId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(targetId)) {
      jobs.set(targetId, { state: 'error', error: `분기 기억을 넘기지 못했습니다: ${error?.message || error}. 기억 서재에서 정리해 주세요.` });
    }
  }
  return payload;
}

/* ---------- meaning search (embeddings) ---------- */

const vectorsFile = (chatId) => path.join(CHAT_DIR, `${safeChatId(chatId)}.vectors.json`);
const vectorCache = new Map();
const EMBED_BATCH = 32;
const EMBED_MAX_PER_RUN = 800;
const QUERY_TIMEOUT_MS = 8000;

/**
 * Where vectors come from. settings().embedding:
 *   missing or { source: 'connection' } — the embedding model set on the memory connection in Marinara
 *     (its own model, base URL and "embedding connection"), when it has one;
 *   { model } — a model typed in the library, called through the memory connection;
 *   null — off.
 */
const LOCAL_SIDECAR = '__local_sidecar__';
const EMBED_SOURCE_TTL_MS = 60_000;
let embedSource = { key: '', at: 0, value: null, error: null };

function embeddingMode() {
  const e = settings().embedding;
  if (e === null) return 'off';
  if (e?.model) return 'manual';
  return 'connection';
}

const trimmed = (v) => String(v || '').trim();

/** The memory connection's own embedding setting, the way Marinara reads it for its memory recall. */
async function connectionEmbedding() {
  const e = await engine();
  const wanted = settings().connection;
  if (!wanted) return null;
  const list = await e.connections.list();
  const row = list.find((c) => c.id === wanted) || list.find((c) => c.name === wanted);
  if (!row) return null;
  const conn = await e.connections.getWithKey(row.id);
  const viaId = trimmed(conn.embeddingConnectionId);
  if (viaId === LOCAL_SIDECAR) throw Error(`연결 "${row.name}"의 임베딩이 마리나라 내장 로컬 모델(영어 전용)로 되어 있어 쓰지 않습니다. 한국어 임베딩 모델을 연결에 넣거나 여기서 직접 입력해 주세요.`);
  const src = (viaId && (await e.connections.getWithKey(viaId).catch(() => null))) || conn;
  const model = trimmed(src.embeddingModel) || trimmed(conn.embeddingModel);
  if (!model) return null;
  const baseUrl = trimmed(src.embeddingBaseUrl) || (src === conn ? trimmed(conn.embeddingBaseUrl) : '') || e.resolveBaseUrl(src);
  if (!baseUrl) throw Error(`연결 "${src.name}"에 임베딩 주소(base URL)가 없습니다.`);
  const provider = e.createLLMProvider(src.provider, baseUrl, src.apiKey, src.maxContext, src.openrouterProvider, null,
    src.claudeFastMode === 'true', src.treatAsLocalEndpoint === 'true', src.defaultParameters);
  return { model, provider, label: src === conn ? `연결 "${row.name}"` : `연결 "${row.name}" → 임베딩 연결 "${src.name}"` };
}

/** The current embedding source (cached for a minute); null when meaning search is off or not set up. */
async function embeddingSource(force = false) {
  const mode = embeddingMode();
  const key = JSON.stringify([mode, settings().embedding, settings().connection]);
  if (!force && embedSource.key === key && Date.now() - embedSource.at < EMBED_SOURCE_TTL_MS) return embedSource.value;
  let value = null;
  let error = null;
  try {
    if (mode === 'manual') {
      const m = await memoryModel();
      value = { model: trimmed(settings().embedding.model), provider: m.provider, label: `연결 "${m.name}"` };
    } else if (mode === 'connection') value = await connectionEmbedding();
  } catch (e) {
    error = String(e?.message || e);
  }
  embedSource = { key, at: Date.now(), value, error };
  return value;
}

/** The model name for vectors already resolved (sync; call embeddingSource() first). */
function embeddingModel() {
  if (embeddingMode() === 'manual') return trimmed(settings().embedding.model) || null;
  return embeddingMode() === 'connection' ? embedSource.value?.model || null : null;
}

function loadVectors(chatId) {
  const model = embeddingModel();
  if (!model) return null;
  let index = vectorCache.get(chatId) || readJson(vectorsFile(chatId), null, { replaceable: true });
  if (!V.usable(index, model)) index = V.emptyIndex(model);
  vectorCache.set(chatId, index);
  return index;
}

function saveVectors(chatId, index) {
  writeJson(vectorsFile(chatId), index);
  vectorCache.set(chatId, index);
}

/** Vectors for texts with the memory connection; kind 'query' or 'doc' picks the model's prefix. */
async function embedTexts(texts, kind, signal) {
  const src = await embeddingSource();
  if (!src) throw Error(embedSource.error || '임베딩 모델이 정해지지 않았습니다.');
  if (typeof src.provider.embed !== 'function') throw Error(`${src.label}은(는) 임베딩을 지원하지 않습니다.`);
  const model = src.model;
  const prefix = V.prefixes(model)[kind === 'query' ? 'query' : 'doc'];
  const out = await src.provider.embed(texts.map((t) => `${prefix}${t}`), model, signal);
  if (!Array.isArray(out) || out.length !== texts.length) throw Error('임베딩 응답의 개수가 맞지 않습니다.');
  return out;
}

/** Give new or changed scenes their vectors. A failure is logged and left for the next run. */
async function indexScenes(chatId, store, job) {
  await embeddingSource();
  const index = loadVectors(chatId);
  if (!index || !store?.scenes.length) return 0;
  V.prune(index, store.scenes);
  const stale = V.staleDocs(index, store.scenes).slice(0, EMBED_MAX_PER_RUN);
  let done = 0;
  for (let i = 0; i < stale.length && !job?.cancel; i += EMBED_BATCH) {
    const part = stale.slice(i, i + EMBED_BATCH);
    if (job) job.stage = `뜻 찾기 색인 (${done + part.length}/${stale.length})`;
    try {
      V.putVectors(index, part, await embedTexts(part.map((d) => d.text), 'doc', job?.abort?.signal));
      done += part.length;
      saveVectors(chatId, index);
    } catch (error) {
      log(`chat ${chatId}: embedding failed, will try again later (${error?.message || error})`);
      break;
    }
  }
  if (done) log(`chat ${chatId}: indexed ${done} piece(s) for meaning search`);
  return done;
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
  if (!enabled) {
    // Off means nothing of this chat's memory goes into a reply, including what was picked for the last turn.
    recalls.delete(chatId);
    replyViews.delete(chatId);
  }
}

/** Speaker-tag repair is a separate extra, off unless turned on for the chat. */
function speakerTagsOn(chatId) {
  return settings().chats?.[chatId]?.speakerTags === true;
}

function setSpeakerTags(chatId, on) {
  const next = settings();
  next.chats = { ...next.chats, [chatId]: { ...(next.chats?.[chatId] || {}), speakerTags: on } };
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
  // Marinara's chat summary can hide the messages it summarized. Those are still the story: keep reading them,
  // or they would look deleted and the memory would be thrown away.
  let summarized = new Set();
  try {
    const meta = parseExtra((await e.chats.getById(chatId))?.metadata);
    for (const entry of Array.isArray(meta.summaryEntries) ? meta.summaryEntries : []) for (const id of entry?.hiddenMessageIds || []) summarized.add(id);
  } catch {}
  const out = [];
  for (const [index, row] of rows.entries()) {
    if (!['user', 'assistant', 'narrator'].includes(row.role)) continue;
    const extra = parseExtra(row.extra);
    if ((extra.hiddenFromAI === true && !summarized.has(row.id)) || !String(row.content || '').trim()) continue;
    const speaker =
      row.role === 'user'
        ? extra.personaSnapshot?.name || 'User'
        : row.role === 'narrator'
          ? 'Narrator'
          : (await characterName(e, row.characterId)) || 'Character';
    out.push({ id: row.id, number: row.rowid ?? index + 1, speaker, role: row.role, content: String(row.content), swipe: row.activeSwipeIndex });
  }
  await addTrackerClock(e, chatId, out);
  for (const m of out) delete m.swipe;
  const prepared = L.prepareMessages(out);
  if (prepared.length) chatLangs.set(chatId, T.chatLanguage(prepared));
  return prepared;
}

/** The language each chat is written in, as last read. */
const chatLangs = new Map();
async function chatLanguage(chatId) {
  if (!chatLangs.has(chatId)) await chatMessages(chatId).catch(() => null);
  return chatLangs.get(chatId) || 'ko';
}

const CLOCK_FIELD = /날짜|일자|date|day|시간|시각|time|작중|게임 ?내|in-?game/i;

/** The story date and time a tracker snapshot shows: the world tracker's date/time, or a custom field named so. */
function trackerClock(row, base) {
  if (!row) return null;
  const parse = (v) => {
    try {
      return typeof v === 'string' ? JSON.parse(v) : v;
    } catch {
      return null;
    }
  };
  const texts = [];
  if (row.date || row.time) texts.push([row.date, row.time].filter(Boolean).join(' '));
  const world = parse(row.worldCustomFields);
  const custom = parse(row.playerStats)?.customTrackerFields;
  for (const f of [...(Array.isArray(world) ? world : []), ...(Array.isArray(custom) ? custom : [])]) {
    if (f && CLOCK_FIELD.test(String(f.name || '')) && f.value) texts.push(String(f.value));
  }
  let date = null;
  let time = null;
  for (const t of texts) {
    const c = L.parseClock(t, base);
    date ??= c?.date || null;
    time ??= c?.time || null;
  }
  let weather = String(row.weather || '').trim() || null;
  for (const f of Array.isArray(world) ? world : []) if (!weather && WEATHER_FIELD.test(String(f?.name || '')) && f.value) weather = String(f.value).trim();
  // raw: the tracker's own words, so a change in how they are read never looks like an edit.
  return date || time || weather ? { date, time, weather: weather ? weather.slice(0, 30) : null, raw: [...texts, weather] } : null;
}

const WEATHER_FIELD = /날씨|하늘|weather|sky/i;

/**
 * Marinara marks a tracker record as final ("committed") only for the newest reply, when the user answers it. A
 * record added or edited by hand on an older message, that had none, stays uncommitted, yet it is what the user
 * set: those are read too. Each lookup finds the newest such record among the messages still without one, so
 * this costs one lookup per record of that kind (usually none or one).
 */
async function addLateSnapshots(e, chatId, messages, snaps) {
  if (!e.gameStates?.getLatestForMessages) return;
  const swipe = new Map(messages.map((m) => [m.id, m.swipe ?? 0]));
  let rest = messages.filter((m) => !snaps.has(m.id)).map((m) => m.id);
  for (let guard = 0; guard < 50 && rest.length; guard++) {
    let row;
    try {
      row = await e.gameStates.getLatestForMessages(chatId, rest);
    } catch {
      return;
    }
    if (!row) return;
    rest = rest.filter((x) => x !== row.messageId);
    const want = swipe.get(row.messageId);
    const pick = row.swipeIndex === want ? row : await e.gameStates.getByChatAndMessage?.(chatId, row.messageId, want).catch(() => null);
    if (pick) snaps.set(row.messageId, pick);
  }
}

/**
 * Messages without a date line of their own get the story clock from Marinara's trackers: the snapshot made for
 * that message, or else the last one before it. With no trackers, nothing is added (the order is all there is).
 */
async function addTrackerClock(e, chatId, messages) {
  if (!e.gameStates?.getCommittedForMessages || !messages.length) return;
  let snaps;
  try {
    snaps = await e.gameStates.getCommittedForMessages(chatId, messages.map((m) => ({ id: m.id, activeSwipeIndex: m.swipe ?? 0 })));
  } catch {
    return;
  }
  if (!snaps) return;
  await addLateSnapshots(e, chatId, messages, snaps);
  // Up to the user's latest message the tracker records are final (a reply's record is committed once it is
  // answered); from there on they may still come, so "none yet" is not written down for those.
  let lastUser = -1;
  messages.forEach((m, i) => {
    if (m.role === 'user') lastUser = i;
  });
  let last = null;
  let weather = null;
  const at = (c) => (c?.date ? `${c.date}T${c.time || '00:00'}` : null);
  for (const [i, m] of messages.entries()) {
    // A date line written in the message itself comes first, and is what the next messages carry on from.
    const own = L.dateInText(L.htmlToText(m.content), last?.date || null);
    const snap = snaps.get(m.id);
    const clock = trackerClock(snap, own?.date || last?.date || null);
    if (own) {
      last = { date: own.date, time: own.time || null };
    } else if (clock?.date || clock?.time) {
      const next = { date: clock.date || last?.date || null, time: clock.time };
      // A tracker that lags behind (still showing the night before after the story moved on) is not followed back.
      if (!(at(last) && at(next) && clock.date && at(next) < at(last))) last = next;
    }
    // The weather holds for the day it was noted on: a new story day starts with no weather until one is noted.
    if (clock?.weather) weather = { text: clock.weather, date: last?.date || null };
    else if (weather?.date && last?.date && last.date !== weather.date) weather = null;
    if (last) m.clock = { ...last };
    if (weather) m.weather = weather.text;
    // What the tracker said for this very message: a hand fix of its date, time or weather is a change to read again.
    if (snap && (clock?.date || clock?.time || clock?.weather)) m.trackerMark = clock.raw;
    // No record (or an empty one) is written down too, so a date or weather added later is seen as a change.
    else if (i < lastUser) m.trackerMark = ['none'];
  }
}

/**
 * The messages the ledger may read: everything up to the user's latest message. The character replies after it
 * are left out until the user answers them, so a reroll, swipe or hand edit of the newest reply never needs undoing,
 * and the version the user kept (with their own fixes) is the one that is read.
 */
function settled(messages) {
  // Only the newest message can still be rerolled; anything with a message after it (a user reply, or a reply
  // the user asked for by pressing send with nothing typed) has been kept.
  return messages.length && messages.at(-1).role !== 'user' ? messages.slice(0, -1) : messages;
}

/** How many of the newest messages the reply model sees directly in this chat. */
async function chatWindow(chatId) {
  try {
    const e = await engine();
    const chat = await e.chats.getById(chatId);
    const limit = Number(parseExtra(chat?.metadata).contextMessageLimit);
    return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_WINDOW;
  } catch {
    return DEFAULT_WINDOW;
  }
}

/* ---------- memory model ---------- */

async function memoryModel(wanted = settings().connection) {
  const e = await engine();
  if (!wanted) throw Error('기억용 연결이 정해지지 않았습니다. 기억 서재 설정이나 mm connection "<연결 이름>"으로 정해 주세요.');
  const list = await e.connections.list();
  const row = list.find((c) => c.id === wanted) || list.find((c) => c.name === wanted);
  if (!row) throw Error(`연결 "${wanted}"을(를) 찾지 못했습니다.`);
  const conn = await e.connections.getWithKey(row.id);
  const baseUrl = e.resolveBaseUrl(conn);
  if (!baseUrl) throw Error(`연결 "${row.name}"에 주소(base URL)가 없습니다.`);
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

/** The connection that translates memory: its own when one is set, else the memory connection. */
function translateModel() {
  return memoryModel(settings().translateConnection || settings().connection);
}

/** A chat written in English gets its memory written in English too (quotes and names stay as written). */
const LANGUAGE_NOTE = {
  en: '\n\n[기록 언어] 이 채팅은 영어로 진행돼. 네가 새로 쓰는 모든 글(제목·요약·사건·사실·이유·메모)은 영어로 써. 인용(q)과 이름은 원문 그대로 둬.',
};

function withLanguage(messages, lang) {
  const note = LANGUAGE_NOTE[lang];
  if (!note || !Array.isArray(messages) || !messages.length) return messages;
  const last = messages.at(-1);
  return [...messages.slice(0, -1), { ...last, content: `${last.content}${note}` }];
}

async function askModel(model, messages, { maxTokens = 4096 } = {}) {
  messages = withLanguage(messages, model.lang);
  const signal = model.signal ? AbortSignal.any([AbortSignal.timeout(MODEL_TIMEOUT_MS), model.signal]) : AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const base = { model: model.model, maxTokens, temperature: 0.2, signal };
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
  if (batch.length < 2) throw Error(`메시지 ${batch[0].number}번의 정리 결과를 읽지 못했습니다.`);
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
  // Feelings are never closed by the tidy pass above; here each needs the line that resolved it.
  // One call per feeling, each with the story right after it last came up.
  total.feelingsResolved = 0;
  total.feelingsMoved = 0;
  for (const feeling of ledger.threads.filter((t) => t.status === 'open' && t.kind === 'emotion')) {
    const review = L.buildFeelingPrompt(ledger, messages, feeling);
    const parsed = L.parseJsonObject(await askModel(model, review.messages, { maxTokens: 1024 }));
    total.calls++;
    if (!parsed) continue;
    const stats = L.applyFeelingReview(ledger, parsed, review.window);
    total.closed += stats.closed;
    total.feelingsResolved += stats.closed;
    total.feelingsMoved += stats.moved || 0;
  }
  ledger.repliesSinceTidy = 0;
  ledger.lastTidy = { at: new Date().toISOString(), ...total };
  return total;
}

/**
 * Fold messages that are leaving the window into scenes, one slice per call, until caught up.
 * Each slice is saved as soon as it is done, so a stopped run continues where it left off.
 */
async function foldScenes(chatId, store, messages, window, model, job, { minPending = 1 } = {}) {
  let calls = 0;
  for (;;) {
    const next = S.nextSlice(store, messages, window, { minPending: calls ? 1 : minPending });
    if (!next) break;
    if (job?.cancel) throw Error('중단했습니다. 다시 시작하면 이어서 정리합니다.');
    if (job) job.stage = `장면 정리 (${next.slice[0].number}번부터)`;
    let applied = null;
    let lastError = '';
    let lastParsed = null;
    let lastReply = '';
    for (let attempt = 0; attempt < 2 && !applied; attempt++) {
      const reply = await askModel(model, S.buildScenePrompt(store, next.slice, next.required, lastError || null), { maxTokens: 8192 });
      calls++;
      lastReply = String(reply || '');
      const { result: parsed, truncated } = S.parseScenesReply(reply);
      if (parsed) lastParsed = parsed;
      if (truncated) {
        // Cut off by the length limit: keep the whole scenes it did write; the rest is read in the next round.
        const part = parsed ? S.applyScenes(store, parsed, next.slice, next.required, undefined, { partial: true }) : { error: '응답이 너무 길어서 잘렸습니다' };
        if (!part.error) {
          applied = part;
          log(`chat ${chatId}: reply was cut off, kept ${part.scenes.length} whole scene(s)`);
        } else lastError = part.error;
        continue;
      }
      const result = parsed ? S.applyScenes(store, parsed, next.slice, next.required) : { error: '응답을 읽지 못했습니다' };
      if (result.error) lastError = result.error;
      else applied = result;
    }
    if (!applied) saveLastReply(chatId, lastError, lastReply);
    // Still skipping messages after two tries: keep the good scenes before the gap; the rest is read again next.
    if (!applied && lastParsed) {
      const part = S.applyScenes(store, lastParsed, next.slice, next.required, undefined, { partial: true });
      if (!part.error) {
        applied = part;
        log(`chat ${chatId}: kept ${part.scenes.length} good scene(s), reading the rest again (${lastError})`);
      }
    }
    if (job?.cancel) throw Error('중단했습니다. 다시 시작하면 이어서 정리합니다.');
    if (!applied) throw Error(`${next.slice[0].number}번부터 장면 정리에 실패했습니다: ${lastError}`);
    S.commitScenes(store, applied);
    store.window = { size: window, firstInside: S.firstInsideWindow(messages, window) };
    saveScenes(chatId, store);
    log(`chat ${chatId}: ${applied.scenes.length} scene(s) through message ${applied.scenes.at(-1).end}, ${applied.facts.length} fact(s)`);
  }
  return calls;
}

/**
 * Chapters and fact merges. A failure here is logged and left for next time: it never blocks the scenes.
 * At most a few calls per run, so a long rebuild keeps moving.
 */
async function condense(chatId, store, model, job, { maxCalls = 6, chaptersOnly = false } = {}) {
  let calls = 0;
  // Summaries a hand edit made out of date are made again first (a chapter before the arc that holds it).
  while (calls < maxCalls && !job?.cancel) {
    const redo = S.nextRedo(store);
    if (!redo) break;
    if (redo.kind.startsWith('drop')) {
      S.applyRedo(store, redo);
      saveScenes(chatId, store);
      continue;
    }
    const label = redo.kind === 'chapter' ? '챕터' : '큰 흐름';
    if (job) job.stage = `고친 내용으로 ${label} 다시 요약 (${redo.target.id})`;
    calls++;
    try {
      const prompt = redo.kind === 'chapter' ? S.buildChapterPrompt(store, redo.parts) : S.buildArcPrompt(store, redo.parts);
      const parsed = L.parseJsonObject(await askModel(model, prompt, { maxTokens: 2000 }));
      const made = S.applyRedo(store, redo, parsed);
      if (made.error) throw Error(made.error);
      saveScenes(chatId, store);
      log(`chat ${chatId}: ${redo.kind} ${redo.target.id} summarized again after a hand edit`);
    } catch (error) {
      log(`chat ${chatId}: summarizing ${redo.target.id} again failed, will try again later (${error?.message || error})`);
      break;
    }
  }
  while (calls < maxCalls && !job?.cancel) {
    const scenes = S.nextChapter(store);
    if (!scenes) break;
    if (job) job.stage = `챕터 묶기 (${scenes[0].id}~${scenes.at(-1).id})`;
    calls++;
    try {
      const parsed = L.parseJsonObject(await askModel(model, S.buildChapterPrompt(store, scenes), { maxTokens: 2000 }));
      const made = S.applyChapter(store, parsed, scenes);
      if (made.error) throw Error(made.error);
      S.commitChapter(store, made.chapter);
      saveScenes(chatId, store);
      log(`chat ${chatId}: chapter ${made.chapter.id} (${scenes[0].id}~${scenes.at(-1).id}) ${made.chapter.title}`);
    } catch (error) {
      log(`chat ${chatId}: chapter failed, will try again later (${error?.message || error})`);
      break;
    }
  }
  // Old chapters folded once more into arcs, so the oldest part of a long story always keeps a line.
  while (calls < maxCalls && !job?.cancel) {
    const chapters = S.nextArc(store);
    if (!chapters) break;
    if (job) job.stage = `큰 흐름 묶기 (${chapters[0].id}~${chapters.at(-1).id})`;
    calls++;
    try {
      const parsed = L.parseJsonObject(await askModel(model, S.buildArcPrompt(store, chapters), { maxTokens: 1500 }));
      const made = S.applyArc(store, parsed, chapters);
      if (made.error) throw Error(made.error);
      S.commitArc(store, made.arc);
      saveScenes(chatId, store);
      log(`chat ${chatId}: arc ${made.arc.id} (${made.arc.chapters[0]}~${made.arc.chapters.at(-1)}) ${made.arc.title}`);
    } catch (error) {
      log(`chat ${chatId}: arc failed, will try again later (${error?.message || error})`);
      break;
    }
  }
  while (!chaptersOnly && calls < maxCalls && !job?.cancel) {
    const next = S.nextFactMerge(store);
    if (!next) break;
    if (job) job.stage = `사실 합치기 (${next.about})`;
    calls++;
    try {
      const parsed = L.parseJsonObject(await askModel(model, S.buildFactMergePrompt(store, next.about, next.facts), { maxTokens: 3000 }));
      if (!parsed) throw Error('응답을 읽지 못했습니다');
      const made = S.applyFactMerge(store, next.about, next.facts, parsed);
      saveScenes(chatId, store);
      log(`chat ${chatId}: merged ${next.about}'s facts (${next.facts.length} → ${S.liveFacts(store).filter((f) => (f.about || '기타') === next.about).length})${made ? '' : ', nothing to merge'}`);
    } catch (error) {
      log(`chat ${chatId}: fact merge failed, will try again later (${error?.message || error})`);
      break;
    }
  }
  return calls;
}

/** Keep the model's last failed scene reply, so `mm scene-error` can show what it actually said. */
function saveLastReply(chatId, error, reply) {
  try {
    fs.writeFileSync(path.join(CHAT_DIR, `${safeChatId(chatId)}.scene-error.txt`), `${new Date().toISOString()} ${error}\n길이: ${reply.length}자\n\n앞부분:\n${reply.slice(0, 1500)}\n\n끝부분:\n${reply.slice(-800)}\n`);
  } catch {}
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
/** Stop before any model call when this chat's memory files are broken: the work could not be saved anyway. */
function checkFiles(chatId) {
  loadLedger(chatId);
  loadScenes(chatId);
  for (const file of [ledgerFile(chatId), scenesFile(chatId), SETTINGS_FILE]) {
    const broken = brokenFiles.get(file);
    if (broken && !broken.replaceable) throw Error(`기억 파일(${path.basename(file)})을 ${broken.reason === 'version' ? '이 버전의 모듈이 모르는 형식이라' : '손상되어'} 읽지 못해 정리를 멈췄습니다.${broken.backup ? ` 원본 복사본: ${broken.backup}.` : ''} 파일을 고치거나 지운 뒤 다시 시도해 주세요.`);
  }
}

function processChat(chatId, { rebuild = false, reason = 'auto' } = {}) {
  const run = enqueue(chatId, async () => {
    if (!rebuild && !chatEnabled(chatId)) return;
    const job = { state: 'running', reason, done: 0, total: 0, startedAt: new Date().toISOString(), error: null, cancel: false, abort: new AbortController() };
    jobs.set(chatId, job);
    try {
      checkFiles(chatId);
      const messages = settled(await chatMessages(chatId));
      // Work on a copy: a stopped or failed run must not leave half its changes in the cached ledger.
      let ledger = rebuild ? L.emptyLedger() : structuredClone(loadLedger(chatId) || L.emptyLedger());
      ledger.cast = await chatCast(chatId);
      L.tidyKnowledge(ledger);
      const state = L.reconcile(ledger, messages);
      if (state.rebuild) {
        ledger.needsRebuild = { at: new Date().toISOString(), changedAt: state.changedAt, number: changedNumber(ledger, messages, state.changedAt) };
        saveLedger(chatId, ledger);
        throw Error('예전 메시지가 수정·삭제되어 장부를 처음부터 다시 정리해야 합니다. 기억 서재의 ‘처음부터 다시 정리’나 mm start --fresh로 다시 정리해 주세요.');
      }
      if (ledger.needsRebuild) {
        // The changed message was put back as it was: the ledger is right again.
        delete ledger.needsRebuild;
        saveLedger(chatId, ledger);
      }
      if (state.rolledBack) log(`chat ${chatId}: message ${state.changedAt + 1} changed, rolled back and re-reading`);
      const remaining = messages.slice(state.from);
      const batches = remaining.length ? L.planBatches(remaining, REBUILD_BATCH_CHARS) : [];
      job.total = batches.length;
      if (!batches.length) {
        if (state.rolledBack) saveLedger(chatId, ledger);
        job.state = 'done';
        return;
      }
      const model = { ...(await memoryModel()), signal: job.abort.signal, lang: await chatLanguage(chatId) };
      for (const batch of batches) {
        if (job.cancel) throw Error('중단했습니다. 다시 시작하면 이어서 정리합니다.');
        const at = messages.indexOf(batch[0]);
        const context = messages.slice(Math.max(0, at - CONTEXT_MESSAGES), at);
        const parts = await readBatch(model, ledger, batch, context);
        if (job.cancel) throw Error('중단했습니다. 다시 시작하면 이어서 정리합니다.');
        for (const part of parts) {
          L.beginBatch(ledger, messages.indexOf(part.batch[0]));
          const stats = L.applyResult(ledger, part.parsed, part.batch);
          L.commitBatch(ledger, part.batch);
          if (stats.dropped) log(`chat ${chatId}: dropped ${stats.dropped} ungrounded item(s)`);
        }
        delete ledger.needsRebuild;
        job.done++;
        // A long first pass is tidied along the way so the open list each batch sees stays short.
        if (batches.length > 1 && job.done % 20 === 0 && job.done < batches.length) {
          job.stage = '장부 점검';
          await tidyLedger(model, ledger, messages.slice(0, messages.indexOf(batch.at(-1)) + 1));
          job.stage = null;
        }
        saveLedger(chatId, ledger);
      }
      if (batches.length) {
        ledger.repliesSinceTidy = (ledger.repliesSinceTidy || 0) + (reason === 'reply' ? 1 : 0);
        if (batches.length > 1 || ledger.repliesSinceTidy >= TIDY_EVERY_REPLIES) {
          job.stage = '장부 점검';
          const tidy = await tidyLedger(model, ledger, messages);
          log(`chat ${chatId}: tidy closed ${tidy.closed}, merged ${tidy.merged} (${tidy.calls} call(s))`);
        }
        saveLedger(chatId, ledger);
      }
      job.stage = null;
      job.state = 'done';
      log(`chat ${chatId}: ledger up to date (${reason}, ${job.total} call(s))`);
    } catch (error) {
      job.state = job.cancel ? 'idle' : 'error';
      job.error = job.cancel ? null : error?.message || String(error);
      log(`chat ${chatId}: ${job.cancel ? `stopped (${job.cancelReason || 'stop'})` : job.error}`);
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  });
  // Scenes are folded on their own queue: a slow scene call must never hold up the next reply.
  return run.then(() => {
    if (rebuild || chatEnabled(chatId)) processScenes(chatId, { rebuild, reason });
  });
}

const sceneJobs = new Map();

function processScenes(chatId, { rebuild = false, reason = 'auto' } = {}) {
  const key = `scenes:${chatId}`;
  // One fold at a time; a reply that arrives meanwhile is picked up by the loop below.
  if (sceneJobs.get(chatId)?.state === 'running' && !rebuild) {
    sceneJobs.get(chatId).again = true;
    return queues.get(key);
  }
  return enqueue(key, async () => {
    const job = { state: 'running', reason, calls: 0, startedAt: new Date().toISOString(), error: null, cancel: false, abort: new AbortController(), again: false };
    sceneJobs.set(chatId, job);
    try {
      checkFiles(chatId);
      let fresh = rebuild;
      do {
        job.again = false;
        const messages = await chatMessages(chatId);
        const window = await chatWindow(chatId);
        const store = fresh ? S.emptyStore() : structuredClone(loadScenes(chatId) || S.emptyStore());
        fresh = false;
        const change = S.reconcileScenes(store, messages);
        if (change.dropped) {
          log(`chat ${chatId}: ${change.dropped} scene(s) changed underneath, folding again${change.lostEdits ? ` (${change.lostEdits} hand edit(s) lost)` : ''}`);
          saveScenes(chatId, store);
        }
        if (rebuild && !store.scenes.length) saveScenes(chatId, store);
        const translated = S.attachTranslations(store, messages) + S.tidyKnowledge(store);
        const personas = L.personaNames(messages);
        const cast = await chatCast(chatId);
        const personasChanged = JSON.stringify(personas) !== JSON.stringify(store.personas || []) || JSON.stringify(cast) !== JSON.stringify(store.cast || []);
        if (personasChanged) {
          store.personas = personas;
          store.cast = cast;
        }
        if (translated || personasChanged) {
          saveScenes(chatId, store);
          log(`chat ${chatId}: added the translation to ${translated} saved line(s)`);
        }
        let model = null;
        const getModel = async () => (model ||= { ...(await memoryModel()), signal: job.abort.signal, lang: await chatLanguage(chatId) });
        if (S.nextSlice(store, messages, window, { minPending: rebuild ? 1 : SCENE_MIN_PENDING })) {
          job.calls += await foldScenes(chatId, store, messages, window, await getModel(), job, { minPending: rebuild ? 1 : SCENE_MIN_PENDING });
        }
        // A long story: old scenes become chapters, and facts that piled up about one person are merged.
        if (S.nextRedo(store) || S.nextChapter(store) || S.nextArc(store) || S.nextFactMerge(store)) job.calls += await condense(chatId, store, await getModel(), job);
        await indexScenes(chatId, store, job);
        // Memory in another language: the lines it may need next are translated now, not at reply time.
        await translateAfterRun(chatId, job).catch((error) => log(`chat ${chatId}: translation failed, will try again later (${error?.message || error})`));
      } while (job.again && !job.cancel);
      job.state = 'done';
    } catch (error) {
      job.state = job.cancel ? 'idle' : 'error';
      job.error = job.cancel ? null : error?.message || String(error);
      log(`chat ${chatId}: scenes ${job.cancel ? 'stopped' : job.error}`);
    } finally {
      job.stage = null;
      job.finishedAt = new Date().toISOString();
    }
  });
}

/** Throw away the chapters and make them again from the saved scenes. Scenes, facts and the ledger stay. */
function rebuildChapters(chatId) {
  return enqueue(`scenes:${chatId}`, async () => {
    const job = { state: 'running', reason: 'chapters', calls: 0, startedAt: new Date().toISOString(), error: null, cancel: false, abort: new AbortController(), stage: '챕터 다시 묶기' };
    sceneJobs.set(chatId, job);
    try {
      checkFiles(chatId);
      const store = structuredClone(loadScenes(chatId) || S.emptyStore());
      const before = (store.chapters || []).length;
      store.chapters = [];
      store.nextChapter = 1;
      store.arcs = [];
      store.nextArc = 1;
      saveScenes(chatId, store);
      const model = { ...(await memoryModel()), signal: job.abort.signal, lang: await chatLanguage(chatId) };
      job.calls = await condense(chatId, store, model, job, { maxCalls: Infinity, chaptersOnly: true });
      if (job.cancel) throw Error('중단했습니다.');
      log(`chat ${chatId}: chapters rebuilt (${before} → ${(store.chapters || []).length})`);
      job.state = 'done';
    } catch (error) {
      job.state = job.cancel ? 'idle' : 'error';
      job.error = job.cancel ? null : error?.message || String(error);
    } finally {
      job.stage = null;
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
      checkFiles(chatId);
      const cached = loadLedger(chatId);
      if (!cached) throw Error('아직 장부가 없습니다. 먼저 정리를 시작해 주세요.');
      const ledger = structuredClone(cached);
      const before = ledger.threads.filter((t) => t.status === 'open').length;
      const tidy = await tidyLedger({ ...(await memoryModel()), lang: await chatLanguage(chatId) }, ledger, await chatMessages(chatId));
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

/**
 * Read messages from..to on a throwaway empty ledger, in the background. Nothing is saved to the chat's ledger.
 * For trying the rules on a slice of the chat before paying for a full pass. The last result is kept in memory.
 */
const trials = new Map();

async function startTrial(chatId, from, to) {
  if (trials.get(chatId)?.state === 'running') throw Error('이 방은 이미 구간 시험 중입니다. 끝날 때까지 기다려 주세요.');
  const messages = await chatMessages(chatId);
  const slice = messages.filter((m) => m.number >= from && m.number <= to);
  if (!slice.length) throw Error(`${from}~${to}번 사이에 읽을 메시지가 없습니다.`);
  if (slice.length > TRIAL_MAX_MESSAGES) throw Error(`구간 시험은 메시지 ${TRIAL_MAX_MESSAGES}개까지만 할 수 있습니다. 범위를 줄여 주세요.`);
  const model = { ...(await memoryModel()), lang: chatLangs.get(chatId) || 'ko' };
  const batches = L.planBatches(slice, REBUILD_BATCH_CHARS);
  const trial = { state: 'running', from, to, messages: slice.length, done: 0, total: batches.length, startedAt: new Date().toISOString(), result: null, error: null };
  trials.set(chatId, trial);
  (async () => {
    const ledger = L.emptyLedger();
    let dropped = 0;
    try {
      for (const batch of batches) {
        const at = messages.indexOf(batch[0]);
        for (const part of await readBatch(model, ledger, batch, messages.slice(Math.max(0, at - CONTEXT_MESSAGES), at))) {
          dropped += L.applyResult(ledger, part.parsed, part.batch).dropped;
        }
        trial.done++;
      }
      const before = ledger.threads.filter((t) => t.status === 'open').length;
      trial.stage = '장부 점검';
      const tidy = await tidyLedger(model, ledger, slice);
      // Scenes for the whole slice, as if all of it had left the window.
      trial.stage = '장면 정리';
      const scenes = S.emptyStore();
      for (;;) {
        const next = S.nextSlice(scenes, slice, 0, { lead: 0, minVisible: 0 });
        if (!next) break;
        let applied = null;
        for (let attempt = 0; attempt < 2 && !applied; attempt++) {
          const parsed = L.parseJsonObject(await askModel(model, S.buildScenePrompt(scenes, next.slice, next.required), { maxTokens: 8192 }));
          const result = parsed ? S.applyScenes(scenes, parsed, next.slice, next.required) : { error: '응답을 읽지 못했습니다' };
          if (!result.error) applied = result;
          else trial.sceneError = result.error;
        }
        if (!applied) break;
        S.commitScenes(scenes, applied);
      }
      trial.stage = null;
      const memory = [S.renderScenes(scenes, null, { expand: 99, maxChars: 100000 }), `[아직 끝나지 않은 일]\n${L.renderCompact(ledger)}`].filter(Boolean).join('\n\n');
      trial.result = { dropped, tidy: { before, after: ledger.threads.filter((t) => t.status === 'open').length, ...tidy }, threads: ledger.threads, rendered: L.render(ledger), scenes: scenes.scenes, facts: scenes.facts, memory };
      trial.state = 'done';
      log(`chat ${chatId}: trial ${from}~${to} done (${batches.length} call(s), ${ledger.threads.length} thread(s))`);
    } catch (error) {
      trial.state = 'error';
      trial.error = error?.message || String(error);
      trial.result = { dropped, threads: ledger.threads, rendered: L.render(ledger) };
      log(`chat ${chatId}: trial ${from}~${to} failed: ${trial.error}`);
    } finally {
      trial.finishedAt = new Date().toISOString();
    }
  })();
  return { started: true, messages: slice.length, total: batches.length };
}

/* ---------- prompt ---------- */

/**
 * How readily characters bring the past up themselves (settings().recallStyle):
 *   quiet — memories mostly stay unspoken; natural — brought up on their own when the moment calls for it;
 *   active — shared history is part of how they talk to each other. Never a recap in any style.
 */
const RECALL_STYLES = {
  quiet: {
    voice:
      'When a memory matters to this moment, let it show briefly and in character — a short line, a look, a choice — one passing touch, not a recap. ' +
      'Most memories should stay unspoken. ',
    end: 'A memory surfaces only as a brief, natural touch when the scene truly calls for it.',
  },
  natural: {
    voice:
      'When something from the past bears on this moment, characters bring it up on their own, without waiting to be asked, the way people who share a past do: ' +
      'a brief remark, a question, or a choice made differently because of what happened. Let shared knowledge remain implicit when it has already been expressed; no callback is required. ',
    end: 'Let what they remember show the way people show it: in what they say, notice and choose, on their own initiative when it fits.',
  },
  active: {
    voice:
      'Characters readily act on their shared past and may initiate a relevant question, follow through on a promise, or respond to changed circumstances without waiting to be asked. ' +
      'This can stay implicit in their choices and reactions; active remembering does not require spoken callbacks or another telling of an old incident. ',
    end: 'Let relevant shared history inform a fresh response or action; leave already expressed memories implicit unless there is a new reason to mention them.',
  },
};

function memoryHeader(style) {
  return (
    '[Memory: what the characters remember from earlier in this story, beyond the recent messages. ' +
    'This is background the characters already carry, not material to retell: the reader has already read all of it. ' +
    'Let it shape what they know, feel, assume and react to. Do not summarize, explain or narrate past events or backstory from it, ' +
    'and do not copy its numbers, dates or details into the prose just because they are listed here. ' +
    (RECALL_STYLES[style] || RECALL_STYLES.natural).voice +
    'Remembering is not a requirement to mention a memory in every reply. Treat facts and anecdotes already expressed in the recent conversation as shared context: do not retell, paraphrase or re-explain them in narration, inner thoughts or dialogue merely because they remain relevant. ' +
    'Mention them again only to answer an explicit question or requested correction, address a new development that changes their meaning, or support a decision that directly needs that detail now; use only the necessary part. ' +
    'Scope a request to repeat or correct something to the specific answer the user asked to hear again. Correct or restate that answer only; do not replay its already explained background, origin story or supporting anecdote in narration, inner thoughts or dialogue. ' +
    'Unless the user explicitly asks to revisit that past event itself, respond to the present request without reconstructing the event to justify the answer. A connection to the past can remain implicit in tone, familiarity, choices and reactions. ' +
    'Do not repeatedly use the same remembered fact as the same rationale for similar advice or care. Keep continuity implicit in a new reaction or action instead. ' +
    'When recalling an established event, preserve its dates, elapsed time, counts and circumstances; do not reconstruct or embellish them. ' +
    'Quoted lines are verbatim from the story. ' +
    'A character marked as not remembering a scene does not know what happened in it; one marked as remembering it only dimly holds just what "남은 기억" says, ' +
    'even though "그때" records what they really said and did. Others may remind them. ' +
    'Each character knows only what they saw, heard or were told: "모름: X" or "자리에 없어 모름" means X does not know it — X must not mention it, hint at it or act on it until X learns it in the story, even while others who know it are in the same scene. "짐작만: X" means X suspects it without the details. ' +
    'Lines are quoted here in a short form for memory only; keep writing the story in its own usual format. ' +
    '"최근 생활" says when each person last ate, washed and slept: keep daily life believable, and do not repeat a meal or bath that just happened unless the story calls for it. ' +
    '"[지난 이야기 흐름]" starts with the oldest parts of the story (A1, A2 …, each covering many chapters) and goes on with chapters (C…); a line "… 줄임" stands for a stretch left out for length. ' +
    '"※" lines under a chapter are details that must stay exact (dates, deadlines, conditions). ' +
    'The weather by a scene is how that day was: a character may recall it naturally ("the night it rained") when that scene comes to mind, but do not bring weather up for its own sake.]'
  );
}

/** How long "[지난 이야기 흐름]" (chapters and their exact details) may be, in characters. */
const CHAPTER_LENGTHS = { short: 2000, normal: 4000, long: 8000, full: 16000 };

/** How much recalled memory goes in: whole scenes, close events, original passages. */
const RECALL_AMOUNTS = {
  less: { scenes: 2, sceneChars: 6000, near: 0, raw: 1 },
  normal: { scenes: 4, sceneChars: 10000, near: 3, raw: 2 },
  more: { scenes: 6, sceneChars: 16000, near: 6, raw: 2 },
};

/** Said again at the end: the last thing read before the story weighs the most. */
function memoryFooter(style) {
  return (
    '[End of memory. Write the next reply from inside the moment, not from these notes: no recaps or explanations of the past, no listing what a character remembers. ' +
    (RECALL_STYLES[style] || RECALL_STYLES.natural).end +
    ' Keep already expressed facts implicit unless the current turn needs them again; respond to what is new instead of restating the same memory in different words. A requested correction is not permission to retell its background.' +
    ']'
  );
}

/** Upper limit for everything {{기억}} puts in (characters). The parts that matter for the next reply are kept first. */
const MEMORY_MAX_CHARS = Number(process.env.MEMORY_MODULE_MAX_CHARS) || 40_000;

/** Lines of a block, dropped from the top (the oldest) until it fits; the heading line stays. */
function fitBlock(text, max) {
  if (!text || text.length <= max) return text;
  if (max < 200) return '';
  const lines = text.split('\n');
  const head = /^\[[^\]]+\]$/.test(lines[0]) ? lines.shift() : null;
  while (lines.length > 1 && (head ? head.length + 1 : 0) + lines.join('\n').length > max) lines.shift();
  const body = lines.join('\n');
  if ((head ? head.length + 1 : 0) + body.length > max) return '';
  return head ? `${head}\n${body}` : body;
}

/**
 * What {{기억}} becomes for a chat. Synchronous: called from the macro while the prompt is assembled.
 * Nothing for a chat whose memory is off. Within the size limit, in this order of need:
 * the guidance before and after, what is still open, daily life, the story so far, the recalled scenes,
 * the close events, the original passages. What does not fit is shortened whole scenes and lines at a time,
 * never in the middle of a line.
 */
/**
 * The message number where the ledger stopped matching the chat: the changed message itself, or (when it was
 * deleted) the one now in its place. null when unknown.
 */
function changedNumber(ledger, messages, index) {
  const n = messages[index]?.number;
  return typeof n === 'number' ? n : null;
}

/**
 * While the ledger is being read, the check before a reply cannot save its result (the read would overwrite it),
 * so what the reply should see is kept here instead: the ledger with an edited or deleted message undone, or
 * only its part before the change. Used only while that read is still running.
 */
const replyLedgers = new Map();

function ledgerForReply(chatId) {
  const held = replyLedgers.get(chatId);
  if (held) {
    if (jobs.get(chatId)?.state === 'running') return held.ledger;
    replyLedgers.delete(chatId);
  }
  const stored = loadLedger(chatId);
  return stored?.needsRebuild ? L.verifiedBefore(stored, stored.needsRebuild.number) : stored;
}

/**
 * The check before a reply while the ledger is being read: the same comparison with the chat, on a copy that is
 * not saved. The read under way keeps going; once it ends, the next reply's check saves the result as usual.
 */
function holdReplyLedger(chatId, view) {
  replyLedgers.delete(chatId);
  const stored = loadLedger(chatId);
  if (!stored) return;
  const messages = settled(view);
  const ledger = structuredClone(stored);
  const state = L.reconcile(ledger, messages);
  if (state.rebuild) {
    const number = changedNumber(ledger, messages, state.changedAt);
    replyLedgers.set(chatId, { ledger: L.verifiedBefore(ledger, number) });
    log(`chat ${chatId}: message ${number ?? '?'} changed while the ledger is being read; this reply gets only the part before it`);
  } else if (state.rolledBack) {
    replyLedgers.set(chatId, { ledger });
    log(`chat ${chatId}: message ${state.changedAt + 1} changed while the ledger is being read; this reply gets the ledger without it`);
  } else if (stored.needsRebuild) {
    // Marked earlier, and the message was put back as it was.
    delete ledger.needsRebuild;
    replyLedgers.set(chatId, { ledger });
  }
}

/* ---------- translations (memory in another language) ---------- */

const translationsFile = (chatId) => path.join(CHAT_DIR, `${safeChatId(chatId)}.translations.json`);
const translationCache = new Map();
const TRANSLATIONS_KEPT = 30_000;
const TRANSLATE_REPLY_MS = Number(process.env.MEMORY_MODULE_TRANSLATE_MS) || 8_000;
const TRANSLATE_MAX_PER_RUN = 400;

function loadTranslations(chatId) {
  if (!translationCache.has(chatId)) {
    const stored = readJson(translationsFile(chatId), null, { replaceable: true });
    translationCache.set(chatId, stored?.v === 1 && stored.items ? stored : { v: 1, items: {} });
  }
  return translationCache.get(chatId);
}

function saveTranslations(chatId, data) {
  const keys = Object.keys(data.items);
  // Oldest first out when the cache grows past its limit (memory edited many times over leaves old lines behind).
  if (keys.length > TRANSLATIONS_KEPT) for (const k of keys.slice(0, keys.length - TRANSLATIONS_KEPT)) delete data.items[k];
  writeJson(translationsFile(chatId), data);
  translationCache.set(chatId, data);
}

function translationLookup(chatId, target) {
  const items = loadTranslations(chatId).items;
  return (text) => items[T.key(target, text)] ?? null;
}

const translating = new Map();

/**
 * Translate the texts not translated yet (at most `max`), in batches, into the cache. One run per chat and
 * language at a time; a second request waits for it. Returns how many were translated.
 */
function translateMissing(chatId, target, texts, { max = TRANSLATE_MAX_PER_RUN } = {}) {
  const runKey = `${chatId}:${target}`;
  if (translating.has(runKey)) return translating.get(runKey);
  const run = (async () => {
    const lookup = translationLookup(chatId, target);
    const todo = [...new Set(texts)].filter((t) => t && lookup(t) == null).slice(0, max);
    if (!todo.length) return 0;
    const model = await translateModel();
    let done = 0;
    for (const part of T.batches(todo)) {
      const parsed = L.parseJsonObject(await askModel(model, T.buildTranslatePrompt(part, target), { maxTokens: 6000 }));
      const out = T.readTranslation(parsed, part);
      if (!out) {
        log(`chat ${chatId}: translation reply did not line up, will try again later`);
        continue;
      }
      const data = loadTranslations(chatId);
      part.forEach((src, i) => {
        if (out[i]) {
          data.items[T.key(target, src)] = out[i];
          done++;
        }
      });
      saveTranslations(chatId, data);
    }
    if (done) log(`chat ${chatId}: translated ${done} memory line(s) into ${target}`);
    return done;
  })().finally(() => translating.delete(runKey));
  translating.set(runKey, run);
  return run;
}

/** The memory lines that may go into a reply: what goes in now, and every scene as it is shown when recalled. */
function injectionLines(chatId, target) {
  const lines = [];
  const add = (text) => lines.push(...T.translateText(text, target, () => null).missing);
  add(renderMemorySource(chatId));
  const store = scenesForReply(chatId);
  if (store) {
    const cast = S.castOf(store);
    store.scenes.forEach((scene, i) => add(S.renderExpanded(scene, i, store.personas || [], cast)));
  }
  return [...new Set(lines)];
}

/** Before a reply: translate what goes in now, for a few seconds at most (the rest goes on in the background). */
async function translateBeforeReply(chatId) {
  const target = memoryLanguage(chatId);
  const missing = T.translateText(renderMemorySource(chatId), target, translationLookup(chatId, target)).missing;
  if (!missing.length) return;
  const run = translateMissing(chatId, target, missing).catch((error) => log(`chat ${chatId}: translation failed (${error?.message || error})`));
  await Promise.race([run, new Promise((r) => setTimeout(r, TRANSLATE_REPLY_MS))]);
}

/** After a memory run: translate what the memory may need next, in the background. */
async function translateAfterRun(chatId, job) {
  const target = memoryLanguage(chatId);
  const todo = injectionLines(chatId, target).filter((l) => translationLookup(chatId, target)(l) == null);
  if (!todo.length) return 0;
  if (job) job.stage = `기억 번역 (${Math.min(todo.length, TRANSLATE_MAX_PER_RUN)}줄)`;
  return translateMissing(chatId, target, todo);
}

/** What the memory library shows in Korean: memory written in another language, and (when on) quoted lines. */
function displayTranslationTexts(chatId) {
  const quotes = settings().translateQuotes === true;
  if (chatLangs.get(chatId) !== 'en' && !quotes) return [];
  return T.displayTexts(loadScenes(chatId), loadLedger(chatId), { quotes }).filter((t) => T.textLanguage(t) === 'en');
}

/** Which language the memory goes in for this chat: the setting, or (auto) the language the chat is written in. */
function memoryLanguage(chatId) {
  const set = settings().memoryLanguage;
  return T.LANGS.includes(set) ? set : chatLangs.get(chatId) || 'ko';
}

/**
 * The memory text for the next reply, in the language set for it. Lines not translated yet stay as they are; the
 * translation fills in before the reply when it can and in the background otherwise.
 */
function renderLedger(chatId) {
  const source = renderMemorySource(chatId);
  if (!source) return '';
  const target = memoryLanguage(chatId);
  const { text } = T.translateText(source, target, translationLookup(chatId, target));
  if (target !== 'en') return text;
  // The labels the notes use in English, so the reply model reads them the same way.
  return text.replace(
    /\]\n\n/,
    ' Labels in English: "unaware" = does not know, "suspects only" = suspects without the details, "remembers" = what is still remembered, "then" = what they did and felt at the time, "※" lines = details that must stay exact.]\n\n',
  );
}

function renderMemorySource(chatId) {
  if (!chatEnabled(chatId)) return '';
  // A ledger that must be read again from the start (an old message changed past what can be undone) only gives
  // what it learned before that message; with no such point known, none of it goes in until it is read again.
  const ledger = ledgerForReply(chatId);
  const scenes = scenesForReply(chatId);
  const query = turnQuery.get(chatId) || '';
  const today = storyToday(chatId, ledger);
  const open = ledger ? L.renderCompact(ledger, { query, today }) : '';
  const routine = ledger ? L.renderRoutine(ledger, storyNow.get(chatId) || ledger.storyTime || null) : '';
  const fixed = [open ? `[아직 끝나지 않은 일]\n${open}` : '', routine].filter(Boolean);
  const style = settings().recallStyle;
  const header = memoryHeader(style);
  const footer = memoryFooter(style);
  let room = MEMORY_MAX_CHARS - header.length - footer.length - 40;
  // What is still open and daily life come first; if even they are too long, their oldest lines go.
  for (let i = 0; i < fixed.length; i++) {
    fixed[i] = fitBlock(fixed[i], Math.max(0, Math.floor(room / (fixed.length - i))));
    room -= fixed[i].length + 2;
  }
  const story = [];
  if (scenes && room > 500) {
    const firstInside = windows.get(chatId) ?? scenes.window?.firstInside ?? null;
    const amount = RECALL_AMOUNTS[settings().recallAmount] || RECALL_AMOUNTS.normal;
    const recall = recalls.get(chatId);
    const picks = R.shownPicks(recall?.picks || [], amount.scenes);
    // The story so far keeps up to its usual size, but never more than half of what is left (a little more when
    // the user asked for a longer story flow).
    const chapterChars = CHAPTER_LENGTHS[settings().chapterLength] || CHAPTER_LENGTHS.normal;
    const total = 9000 + 4500 + chapterChars;
    const overviewMax = Math.min(total, Math.floor(room * (chapterChars > CHAPTER_LENGTHS.normal ? 0.65 : 0.5)));
    const scale = Math.min(1, overviewMax / total);
    const overview = S.renderScenes(scenes, firstInside, { maxChars: Math.floor(9000 * scale), factChars: Math.floor(4500 * scale), chapterChars: Math.floor(chapterChars * scale), query, today });
    if (overview) {
      story.push(overview);
      room -= overview.length + 2;
    }
    const recalled = room > 500 ? R.renderRecalled(scenes, picks, { maxChars: Math.min(amount.sceneChars, room) }) : '';
    if (recalled) {
      story.push(recalled);
      room -= recalled.length + 2;
    }
    const near = amount.near && room > 500 ? R.renderNearEvents(scenes, recall?.semantic || [], picks, { max: amount.near, maxChars: Math.min(5000, room) }) : '';
    if (near) {
      story.push(near);
      room -= near.length + 2;
    }
    const raw = room > 300 ? fitBlock(R.renderRaw((recall?.raw || []).slice(0, amount.raw)), room) : '';
    if (raw) story.push(raw);
  }
  const parts = [...story, ...fixed].filter(Boolean);
  return parts.length ? `${header}\n\n${parts.join('\n\n')}\n\n${footer}` : '';
}

/**
 * Scenes as they stand for the next reply. When an old message was edited, deleted or swiped since the scenes
 * were folded, the scenes from that message on (with their facts, chapters and who learned what there) are left
 * out right away; folding them again happens after the reply, in the background.
 */
const replyViews = new Map();
function scenesForReply(chatId) {
  const stored = loadScenes(chatId);
  const view = replyViews.get(chatId);
  return view && view.base === stored ? view.store : stored;
}

function checkScenesBeforeReply(chatId, view) {
  const stored = loadScenes(chatId);
  if (!stored || S.changedAt(stored, view) === -1) return replyViews.delete(chatId);
  const store = structuredClone(stored);
  const change = S.reconcileScenes(store, view);
  replyViews.set(chatId, { base: stored, store });
  log(`chat ${chatId}: ${change.dropped} scene(s) no longer match the chat; left out of this reply until folded again`);
}

/* ---------- admin API ---------- */

let marinaraVersion;
/** Which Marinara this is, and whether every patch went in (shown on the extension's first screen). */
function health() {
  if (marinaraVersion === undefined) {
    marinaraVersion = null;
    try {
      marinaraVersion = JSON.parse(fs.readFileSync(path.resolve(serverDist(), '..', '..', '..', 'package.json'), 'utf8')).version || null;
    } catch {}
  }
  const m = globalThis.__marinaraMemory || {};
  const patches = m.patches || {};
  const failed = Object.entries(patches).filter(([, v]) => v === 'failed').map(([k]) => k);
  const broken = [...brokenFiles.values()].filter((b) => !b.replaceable).map((b) => ({ file: path.basename(b.file), backup: b.backup, reason: b.reason, error: b.error, at: b.at }));
  return { marinara: marinaraVersion, tested: m.testedMarinara || null, patches, failed, broken };
}

/** "하준, 도윤" or ["하준"] → ["하준", "도윤"]. */
function nameList(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[,·、/]/);
  return [...new Set(list.map((n) => String(n ?? '').trim().slice(0, 40)).filter(Boolean))];
}

function summary(ledger) {
  const threads = ledger?.threads || [];
  const count = (kind) => threads.filter((t) => t.kind === kind && t.status === 'open').length;
  return {
    processed: ledger?.processed?.length || 0,
    open: { promise: count('promise'), emotion: count('emotion'), state: count('state'), secret: count('secret'), pending: count('pending') },
    closed: threads.filter((t) => t.status === 'closed').length,
    needsRebuild: Boolean(ledger?.needsRebuild),
    rebuildFrom: ledger?.needsRebuild?.number ?? null,
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
  // Hand fixes to the ledger (the CLI and, later, the extension screen): reopen or close one item.
  app.post('/chats/:id/threads/:tid/:action', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    const action = req.params.action;
    if (!['reopen', 'close', 'edit'].includes(action)) throw Error('다시 열기(reopen), 닫기(close), 고치기(edit)만 할 수 있습니다.');
    await enqueue(chatId, async () => {
      const ledger = structuredClone(loadLedger(chatId) || L.emptyLedger());
      const thread = ledger.threads.find((t) => t.id === req.params.tid);
      if (!thread) throw Error('해당 항목을 찾지 못했습니다.');
      const now = new Date().toISOString();
      if (action === 'edit') {
        for (const field of ['title', 'detail', 'need']) {
          if (typeof req.body?.[field] === 'string' && req.body[field].trim()) thread[field] = req.body[field].trim().slice(0, 300);
        }
        if (req.body?.unaware !== undefined) thread.unaware = nameList(req.body.unaware);
        if (req.body?.guess !== undefined) thread.guess = nameList(req.body.guess);
        // The date to meet, set by hand: "24-10-20", "10월 20일", with an optional time. Both empty clears it.
        if (typeof req.body?.dueDate === 'string' || typeof req.body?.dueTime === 'string') {
          const dateText = String(req.body.dueDate || '').trim();
          const timeText = String(req.body.dueTime || '').trim();
          const date = dateText ? L.parseClock(dateText, ledger.storyDate)?.date : null;
          const time = timeText ? L.parseClock(timeText.includes(':') || /시/.test(timeText) ? timeText : `${timeText}시`)?.time : null;
          if (dateText && !date) throw Error('기한 날짜를 읽지 못했습니다. 24-10-20이나 10월 20일처럼 적어 주세요.');
          if (timeText && !time) throw Error('기한 시각을 읽지 못했습니다. 17:00처럼 적어 주세요.');
          thread.due = date || time ? { date: date || null, time: time || null } : null;
        }
      } else if (action === 'reopen') {
        thread.reopened = { from: thread.closed, by: 'hand' };
        thread.status = 'open';
        thread.closed = null;
        delete thread.mergedInto;
      } else {
        thread.status = 'closed';
        thread.closed = { how: String(req.body?.how || '손으로 닫음').slice(0, 200), evidence: [], at: null, by: 'hand' };
      }
      thread.updatedAt = now;
      thread.edited = true;
      // The snapshots kept for rerolls hold the item too; fix it there so a rollback keeps the hand fix.
      for (const batch of ledger.batches) {
        const old = batch.threads.find((t) => t.id === thread.id);
        if (old) Object.assign(old, structuredClone(thread));
      }
      saveLedger(chatId, ledger);
    });
    return { ok: true };
  }));
  // Hand edits to daily life (meals, washing, sleep, medicine).
  app.post('/chats/:id/routine', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    return enqueue(chatId, async () => {
      const ledger = structuredClone(loadLedger(chatId) || L.emptyLedger());
      const entry = L.editRoutine(ledger, { action: String(req.body?.action || ''), key: req.body?.key, item: req.body?.item });
      saveLedger(chatId, ledger);
      return { entry };
    });
  }));
  app.get('/chats/:id/scene-error', guard(async (req) => {
    const file = path.join(CHAT_DIR, `${safeChatId(req.params.id)}.scene-error.txt`);
    return { text: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null };
  }));
  app.get('/status', guard(async () => {
    const src = await embeddingSource();
    return {
      version: globalThis.__marinaraMemory?.version || null, settings: settings(), dataDir: DATA_DIR, health: health(),
      embedding: { mode: embeddingMode(), model: src?.model || null, label: src?.label || null, error: src ? null : embedSource.error },
    };
  }));
  // SIDE B semantic search: read existing vectors across ALL scenes, without recall/window or memory writes.
  app.post('/chats/:id/search', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    if (!chatEnabled(chatId)) return { state: 'disabled', results: [] };
    const queries = req.body?.queries;
    if (!Array.isArray(queries) || !queries.length || queries.length > 5 || queries.some(q => !q || typeof q.query !== 'string' || !q.query.trim() || q.query.length > 300 || (q.subject != null && (typeof q.subject !== 'string' || q.subject.length > 120)))) throw Error('검색 질문은 1~5개, 검색어는 300자 이하여야 합니다.');
    const store = loadScenes(chatId);
    if (!store?.scenes?.length) return { state: 'empty', results: queries.map(query => ({ query, hits: [] })) };
    await embeddingSource();
    const index = loadVectors(chatId);
    if (!index || !Object.keys(index.items).length) return { state: 'unavailable', results: [] };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    const disconnected = () => controller.abort();
    req.raw?.once?.('aborted', disconnected);
    try {
      const vectors = await embedTexts(queries.map(q => [q.subject || '', q.query.trim()].filter(Boolean).join(' · ')), 'query', controller.signal);
      if (controller.signal.aborted) throw Error('기억 검색이 중단되거나 시간 한도를 넘었습니다.');
      if (vectors.some(v => !Array.isArray(v) && !(v instanceof Float32Array) || !v.length || Array.from(v).some(n => !Number.isFinite(n)))) throw Error('검색 임베딩 형식이 올바르지 않습니다.');
      const normalize = v => String(v || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
      const results = queries.map((query, i) => {
        const subject = normalize(query.subject);
        const firstInside = windows.get(chatId) ?? store.window?.firstInside ?? null;
        const searchable = req.body?.scope === 'side-b' ? store.scenes : R.candidates(store, firstInside);
        const candidates = subject ? searchable.filter(scene => normalize(JSON.stringify(scene)).includes(subject)) : searchable;
        const hits = V.nearest(index, [vectors[i]], candidates, 8).filter(hit => hit.score > 0).map(hit => ({ id: hit.id, piece: hit.piece, score: hit.score, strong: hit.strong }));
        return { query, hits };
      });
      return { state: 'ok', model: embeddingModel(), results };
    } finally { clearTimeout(timer); req.raw?.removeListener?.('aborted', disconnected); }
  }));
  // "What would come up if I sent this?" — the recall without a reply, nothing saved.
  app.post('/chats/:id/recall-test', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    const text = String(req.body?.text || '').trim();
    if (!text) throw Error('시험할 메시지를 적어 주세요.');
    const store = loadScenes(chatId);
    if (!store?.scenes.length) throw Error('아직 장면이 없습니다.');
    const mode = RECALL_MODES.includes(settings().recall) && settings().recall !== 'off' ? settings().recall : 'model';
    const firstInside = windows.get(chatId) ?? store.window?.firstInside ?? null;
    const list = R.candidates(store, firstInside);
    const view = settled(await chatMessages(chatId));
    const entry = await computeRecall(chatId, store, view, text, { mode, firstInside, list });
    const title = (id) => store.scenes.find((x) => x.id === id)?.title || null;
    const ids = new Set(list.map((x) => x.id));
    // Scenes the model still reads as they are, or shown in full anyway: they are not recalled, and need not be.
    const shown = store.scenes.filter((x) => !ids.has(x.id)).map((x) => x.id);
    return {
      ...entry,
      picks: entry.picks.map((p) => ({ ...p, title: title(p.id) })),
      semantic: (entry.semantic || []).map((x) => ({ id: x.id, score: Math.round(x.score * 1000) / 1000, strong: x.strong, title: title(x.id), event: x.piece != null ? store.scenes.find((s) => s.id === x.id)?.events?.[x.piece]?.text || null : null })),
      direct: entry.direct ? { ...entry.direct, title: title(entry.direct.id) } : null,
      raw: (entry.raw || []).map((r) => ({ number: r.number, text: r.text })),
      candidates: list.length,
      alreadyShown: shown.length ? `${shown[0]}~${shown.at(-1)}` : null,
      vectors: !!(await embeddingSource(), loadVectors(chatId)),
    };
  }));
  app.post('/settings/embedding', guard(async (req) => {
    const mode = String(req.body?.mode || (req.body?.model ? 'manual' : 'off')).trim();
    const model = String(req.body?.model || '').trim();
    if (!['connection', 'manual', 'off'].includes(mode)) throw Error('임베딩 방식은 connection, manual, off 중 하나여야 합니다.');
    if (mode === 'manual' && !model) throw Error('직접 입력하실 임베딩 모델 이름을 적어 주세요.');
    const before = settings().embedding;
    saveSettings({ ...settings(), embedding: mode === 'off' ? null : mode === 'manual' ? { model } : { source: 'connection' } });
    vectorCache.clear();
    if (mode === 'off') return { mode, model: null };
    try {
      const src = await embeddingSource(true);
      if (!src) throw Error(embedSource.error || '기억용 연결에 임베딩 모델이 설정되어 있지 않습니다. 마리나라 연결 설정의 ‘시맨틱 검색(임베딩)’에 모델을 넣어 주세요.');
      const [vector] = await embedTexts(['임베딩 연결 확인'], 'doc', AbortSignal.timeout(20000));
      return { mode, model: src.model, label: src.label, dimensions: vector.length };
    } catch (error) {
      saveSettings({ ...settings(), embedding: before === undefined ? undefined : before });
      await embeddingSource(true);
      throw Error(`임베딩을 쓰지 못했습니다: ${error?.message || error}`);
    }
  }));
  app.post('/settings/recall-style', guard(async (req) => {
    const style = String(req.body?.style || '').trim();
    if (!RECALL_STYLES[style]) throw Error('기억을 드러내는 정도는 quiet, natural, active 중 하나여야 합니다.');
    saveSettings({ ...settings(), recallStyle: style });
    return { style };
  }));
  // Memory language: which language goes into replies (auto = the chat's own), which connection translates,
  // and whether quoted English lines are shown in Korean in the library too.
  app.post('/settings/language', guard(async (req) => {
    const next = settings();
    if (req.body?.memoryLanguage !== undefined) {
      const lang = String(req.body.memoryLanguage || 'auto');
      if (lang !== 'auto' && !T.LANGS.includes(lang)) throw Error('기억을 넣을 언어는 auto, ko, en 중 하나여야 합니다.');
      next.memoryLanguage = lang;
    }
    if (req.body?.translateConnection !== undefined) next.translateConnection = String(req.body.translateConnection || '').trim() || null;
    if (req.body?.translateQuotes !== undefined) next.translateQuotes = req.body.translateQuotes === true;
    saveSettings(next);
    return { memoryLanguage: next.memoryLanguage || 'auto', translateConnection: next.translateConnection || null, translateQuotes: next.translateQuotes === true };
  }));
  // Korean for what the library shows, when the memory is in another language. Missing ones are made in the
  // background (the library asks again on its next check).
  app.get('/chats/:id/translations', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    await chatLanguage(chatId);
    const texts = displayTranslationTexts(chatId);
    const lookup = translationLookup(chatId, 'ko');
    const items = {};
    const missing = [];
    for (const t of texts) {
      const done = lookup(t);
      if (done != null) items[t] = done;
      else missing.push(t);
    }
    if (missing.length && settings().connection) translateMissing(chatId, 'ko', missing).catch((error) => log(`chat ${chatId}: translation failed (${error?.message || error})`));
    return { chatLang: chatLangs.get(chatId) || 'ko', items, missing: missing.length, working: translating.has(`${chatId}:ko`) };
  }));
  app.post('/settings/chapter-length', guard(async (req) => {
    const length = String(req.body?.length || '').trim();
    if (!CHAPTER_LENGTHS[length]) throw Error('지난 이야기 흐름 길이는 short, normal, long, full 중 하나여야 합니다.');
    saveSettings({ ...settings(), chapterLength: length });
    return { length };
  }));
  app.post('/settings/recall-amount', guard(async (req) => {
    const amount = String(req.body?.amount || '').trim();
    if (!RECALL_AMOUNTS[amount]) throw Error('회상 양은 less, normal, more 중 하나여야 합니다.');
    saveSettings({ ...settings(), recallAmount: amount });
    return { amount };
  }));
  app.post('/settings/recall', guard(async (req) => {
    const mode = String(req.body?.mode || '').trim();
    if (!RECALL_MODES.includes(mode)) throw Error(`회상 방식은 ${RECALL_MODES.join(', ')} 중 하나여야 합니다.`);
    saveSettings({ ...settings(), recall: mode });
    recalls.clear();
    return { recall: mode };
  }));
  app.post('/settings', guard(async (req) => {
    const connection = String(req.body?.connection || '').trim();
    if (!connection) throw Error('연결 이름이 비어 있습니다.');
    const e = await engine();
    const list = await e.connections.list();
    const row = list.find((c) => c.id === connection) || list.find((c) => c.name === connection);
    if (!row) throw Error(`연결 "${connection}"을(를) 찾지 못했습니다. 있는 연결: ${list.map((c) => c.name).join(', ')}`);
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
    await embeddingSource();
    const chatId = safeChatId(req.params.id);
    const ledger = loadLedger(chatId);
    const { cancel: _cancel, abort: _abort, cancelReason: _reason, ...job } = jobStatus(chatId);
    const { cancel: _c, abort: _a, ...sceneJob } = sceneJobs.get(chatId) || { state: 'idle' };
    const scenes = loadScenes(chatId);
    return {
      version: globalThis.__marinaraMemory?.version || null,
      health: health(),
      enabled: chatEnabled(chatId),
      chatLang: chatLangs.get(chatId) || null,
      memoryLanguage: memoryLanguage(chatId),
      job,
      sceneJob,
      speakerTags: speakerTagsOn(chatId),
      routine: ledger ? L.renderRoutine(ledger, storyNow.get(chatId) || ledger.storyTime || null) : '',
      routineItems: (ledger?.routine || []).map((r) => ({ ...r, key: L.routineKey(r) })),
      storyNow: storyNow.get(chatId) || ledger?.storyTime || null,
      personas: scenes?.personas || [],
      cast: (scenes?.cast || ledger?.cast || []).filter((n) => !(scenes?.personas || []).includes(n)),
      vectors: (() => {
        const index = loadVectors(chatId);
        return index ? { model: index.model, indexed: V.indexedScenes(index, scenes?.scenes || []), total: scenes?.scenes.length || 0 } : null;
      })(),
      recall: (() => {
        const r = recalls.get(chatId);
        const store = scenes;
        if (!r) return { mode: settings().recall || 'model', picks: [] };
        return { mode: r.mode, used: r.used, ms: r.ms, at: r.at, error: r.error, semantic: (r.semantic || []).map((x) => ({ id: x.id, score: Math.round(x.score * 1000) / 1000, strong: x.strong, title: store?.scenes.find((s) => s.id === x.id)?.title || null })), semanticError: r.semanticError || null, raw: (r.raw || []).map((x) => ({ number: x.number, hits: x.hits })), picks: r.picks.map((p) => ({ ...p, title: store?.scenes.find((s) => s.id === p.id)?.title || null })) };
      })(),
      summary: summary(ledger),
      scenes: { count: scenes?.scenes.length || 0, chapters: scenes?.chapters?.length || 0, facts: scenes ? S.liveFacts(scenes).length : 0, coveredThrough: scenes?.scenes.at(-1)?.end ?? null, firstInside: windows.get(chatId) ?? scenes?.window?.firstInside ?? null },
      threads: ledger?.threads || [],
      storyDate: storyToday(chatId, ledger),
      deadlines: ledger ? L.deadlineList(ledger, storyToday(chatId, ledger)) : [],
      lastNumber: ledger?.lastNumber ?? null,
      rendered: renderLedger(chatId),
    };
  }));
  app.post('/chats/:id/estimate', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    const messages = await chatMessages(chatId);
    const batches = L.planBatches(messages, REBUILD_BATCH_CHARS);
    const window = await chatWindow(chatId);
    const folded = messages.slice(0, Math.max(0, messages.length - Math.max(window - 8, 8)));
    const sceneCalls = Math.ceil(folded.reduce((n, m) => n + m.content.length + 40, 0) / 16000);
    return { messages: messages.length, chars: messages.reduce((n, m) => n + m.content.length, 0), calls: batches.length, sceneCalls, window };
  }));
  app.post('/chats/:id/start', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    if (jobStatus(chatId).state === 'running') throw Error('이미 정리 중입니다.');
    await memoryModel();
    const fresh = req.body?.fresh === true || !loadLedger(chatId);
    setChatEnabled(chatId, true);
    processChat(chatId, { rebuild: fresh, reason: fresh ? 'rebuild' : 'resume' });
    return { started: true, fresh };
  }));
  app.post('/chats/:id/tidy', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    if (jobStatus(chatId).state === 'running') throw Error('지금 정리 중입니다. 끝난 뒤에 다시 시도해 주세요.');
    await memoryModel();
    tidyChat(chatId);
    return { started: true };
  }));
  app.post('/chats/:id/trial', guard(async (req) => {
    const from = Number(req.body?.from);
    const to = Number(req.body?.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) throw Error('사용법: trial <ID> <시작 번호> <끝 번호>');
    return startTrial(safeChatId(req.params.id), from, to);
  }));
  app.get('/chats/:id/trial', guard(async (req) => trials.get(safeChatId(req.params.id)) || { state: 'none' }));
  app.post('/chats/:id/stop', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    let stopping = false;
    for (const job of [jobs.get(chatId), sceneJobs.get(chatId)]) {
      if (job?.state !== 'running') continue;
      job.cancel = true;
      job.abort?.abort();
      stopping = true;
    }
    return { stopping };
  }));
  // Scenes and facts, for reading and for hand edits (the extension screen uses these).
  app.get('/chats/:id/scenes', guard(async (req) => loadScenes(safeChatId(req.params.id)) || S.emptyStore()));
  const editScenes = (chatId, edit) =>
    enqueue(`scenes:${chatId}`, async () => {
      const store = structuredClone(loadScenes(chatId) || S.emptyStore());
      const out = edit(store);
      saveScenes(chatId, store);
      // What was picked for this turn may rest on the old wording: pick again on the next reply or reroll.
      recalls.delete(chatId);
      // Meaning search: the edited pieces are already left out; their new vectors are made in the background.
      enqueue(`scenes:${chatId}`, () => indexScenes(chatId, loadScenes(chatId))).catch((error) => log(`chat ${chatId}: re-index after edit failed (${error?.message || error})`));
      // Summaries the edit made out of date are made again in the background.
      if (S.nextRedo(store) && chatEnabled(chatId)) processScenes(chatId, { reason: 'edit' }).catch(() => {});
      return out;
    });
  app.patch('/chats/:id/scenes/:sceneId', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    return editScenes(chatId, (store) => {
      const scene = store.scenes.find((x) => x.id === req.params.sceneId);
      if (!scene) throw Error('해당 장면을 찾지 못했습니다.');
      for (const field of ['title', 'summary', 'time', 'place', 'weather']) if (typeof req.body?.[field] === 'string') scene[field] = req.body[field].trim();
      // The chapter (and arc) that summarized this scene no longer says what it says now.
      S.markStale(store, { scene: scene.id });
      if (req.body?.present !== undefined) scene.present = nameList(req.body.present);
      const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      if (Array.isArray(req.body?.events))
        scene.events = req.body.events
          .filter((e) => e && typeof e.text === 'string' && e.text.trim())
          .map((e) => ({
            text: e.text.trim(),
            time: str(e.time),
            why: str(e.why),
            importance: ['critical', 'major', 'minor'].includes(e.importance) ? e.importance : 'major',
            quotes: Array.isArray(e.quotes) ? e.quotes : [],
          }));
      // Lines not yet linked to an event are matched again against the changed events.
      if (Array.isArray(req.body?.events)) S.relinkLoose(scene);
      if (Array.isArray(req.body?.recollections))
        scene.recollections = req.body.recollections
          .filter((r) => r && typeof r.who === 'string' && r.who.trim())
          .map((r) => {
            const remembers = ['full', 'partial', 'none'].includes(r.remembers) ? r.remembers : 'full';
            return { who: r.who.trim(), text: str(r.text), remembers, why: str(r.why), kept: remembers === 'partial' ? str(r.kept) : null };
          });
      scene.edited = true;
      scene.editedAt = new Date().toISOString();
      return scene;
    });
  }));
  app.post('/chats/:id/chapters/rebuild', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    if (sceneJobs.get(chatId)?.state === 'running') throw Error('지금 장면을 정리하는 중입니다. 끝난 뒤에 다시 시도해 주세요.');
    if (!loadScenes(chatId)?.scenes.length) throw Error('아직 장면이 없습니다.');
    await memoryModel();
    rebuildChapters(chatId);
    return { started: true };
  }));
  app.patch('/chats/:id/chapters/:chapterId', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    return editScenes(chatId, (store) => {
      const chapter = (store.chapters || []).find((x) => x.id === req.params.chapterId);
      if (!chapter) throw Error('해당 챕터를 찾지 못했습니다.');
      for (const field of ['title', 'summary']) if (typeof req.body?.[field] === 'string' && req.body[field].trim()) chapter[field] = req.body[field].trim();
      if (Array.isArray(req.body?.turns)) chapter.turns = req.body.turns.map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
      if (Array.isArray(req.body?.keep)) chapter.keep = req.body.keep.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
      chapter.edited = true;
      delete chapter.stale;
      // The arc that summarized this chapter is made again; until then the chapter itself goes in.
      S.markStale(store, { chapter: chapter.id });
      return chapter;
    });
  }));
  app.patch('/chats/:id/arcs/:arcId', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    return editScenes(chatId, (store) => {
      const arc = (store.arcs || []).find((x) => x.id === req.params.arcId);
      if (!arc) throw Error('해당 큰 흐름을 찾지 못했습니다.');
      for (const field of ['title', 'summary']) if (typeof req.body?.[field] === 'string' && req.body[field].trim()) arc[field] = req.body[field].trim();
      if (Array.isArray(req.body?.turns)) arc.turns = req.body.turns.map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
      if (Array.isArray(req.body?.keep)) arc.keep = req.body.keep.map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
      arc.edited = true;
      return arc;
    });
  }));
  app.patch('/chats/:id/facts/:factId', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    return editScenes(chatId, (store) => {
      const fact = store.facts.find((x) => x.id === req.params.factId);
      if (!fact) throw Error('해당 사실을 찾지 못했습니다.');
      S.editFact(fact, {
        text: typeof req.body?.text === 'string' ? req.body.text.trim() : undefined,
        about: typeof req.body?.about === 'string' ? req.body.about.trim() : undefined,
        unaware: req.body?.unaware !== undefined ? nameList(req.body.unaware) : undefined,
        guess: req.body?.guess !== undefined ? nameList(req.body.guess) : undefined,
      });
      return fact;
    });
  }));
  app.delete('/chats/:id/facts/:factId', guard(async (req) => {
    const chatId = safeChatId(req.params.id);
    return editScenes(chatId, (store) => {
      const before = store.facts.length;
      store.facts = store.facts.filter((x) => x.id !== req.params.factId);
      if (store.facts.length === before) throw Error('해당 사실을 찾지 못했습니다.');
      return { deleted: true };
    });
  }));
  app.post('/chats/:id/speaker-tags', guard(async (req) => {
    const on = req.body?.on === true;
    setSpeakerTags(safeChatId(req.params.id), on);
    return { speakerTags: on };
  }));
  app.post('/chats/:id/enable', guard(async (req) => (setChatEnabled(safeChatId(req.params.id), true), { enabled: true })));
  app.post('/chats/:id/disable', guard(async (req) => (setChatEnabled(safeChatId(req.params.id), false), { enabled: false })));
}

/** Called once from Marinara's app setup (see the runtime hook). */
/**
 * Right before a reply is generated: if an already-read message was deleted or edited, undo what it put in the
 * ledger (snapshots only, no model call), then pick the scenes to recall. The newest reply was never read,
 * so rerolling it needs nothing undone.
 */
async function syncBeforeReply(chatId, body) {
  let view = await chatMessages(chatId);
  const replaced = typeof body?.regenerateMessageId === 'string' ? view.findIndex((m) => m.id === body.regenerateMessageId) : -1;
  if (replaced >= 0) view = view.slice(0, replaced);
  const running = jobs.get(chatId);
  if (running?.state === 'running') {
    // Never wait for the read under way, but still check for edited or deleted messages: the reply gets a copy
    // of the ledger without them (not saved; the read would overwrite it).
    holdReplyLedger(chatId, view);
  } else {
    replyLedgers.delete(chatId);
    await enqueue(chatId, async () => {
      const stored = loadLedger(chatId);
      // A broken ledger file is left alone (and shown in the memory library); the reply goes on without it.
      if (!stored && brokenFiles.has(ledgerFile(chatId))) return;
      const ledger = structuredClone(stored || L.emptyLedger());
      const state = L.reconcile(ledger, settled(view));
      if (state.rebuild) {
        const number = changedNumber(ledger, settled(view), state.changedAt);
        if (!ledger.needsRebuild || ledger.needsRebuild.number !== number) {
          ledger.needsRebuild = { at: new Date().toISOString(), changedAt: state.changedAt, number };
          saveLedger(chatId, ledger);
        }
      } else if (ledger.needsRebuild) {
        // The old message was put back as it was: the ledger is right again.
        delete ledger.needsRebuild;
        saveLedger(chatId, ledger);
      } else if (state.rolledBack) {
        saveLedger(chatId, ledger);
        log(`chat ${chatId}: undid message ${state.changedAt + 1} before the reply`);
      }
    });
  }
  // Which scenes the reply model can no longer see: the ones that start before its window.
  // The reply is generated after `view`, plus the new user turn when there is one.
  const now = L.storyTime(view.slice(-4));
  if (now) storyNow.set(chatId, now);
  const day = L.storyDate(view);
  if (day) storyDays.set(chatId, day);
  const window = await chatWindow(chatId);
  windows.set(chatId, S.firstInsideWindow(view, Math.max(1, window - (body?.userMessage ? 1 : 0))));
  checkScenesBeforeReply(chatId, view);
  await recallBeforeReply(chatId, view, body?.userMessage);
  await translateBeforeReply(chatId).catch(() => {});
}

/* ---------- speaker tags ---------- */

const speakerColors = new Map();

/**
 * Right before a reply: note whether this chat colors speakers, and make sure the newest character reply
 * (the one Marinara keeps as the tag example) has its tags, so one miss does not repeat.
 */
async function prepareSpeakers(chatId, body) {
  if (!speakerTagsOn(chatId)) return speakerColors.set(chatId, false);
  const e = await engine();
  const chat = await e.chats.getById(chatId);
  const meta = parseExtra(chat?.metadata);
  const on = meta.groupSpeakerColors === true && chat?.mode === 'roleplay';
  speakerColors.set(chatId, on);
  if (!on) return;
  const names = await chatCharacterNames(e, chat);
  if (names.length < 2) return;
  const rows = await e.chats.listMessages(chatId);
  const last = [...rows].reverse().find((r) => r.role === 'assistant' && r.id !== body?.regenerateMessageId);
  if (!last || !String(last.content || '').trim()) return;
  const fixed = SP.restoreSpeakerTags(String(last.content), names);
  if (fixed !== last.content) {
    await e.chats.updateMessageContent(last.id, fixed);
    log(`chat ${chatId}: put speaker tags back on the last reply before the next one`);
  }
}

/** The chat's character names, for who-knows-what in group stories. Empty when it cannot be read. */
async function chatCast(chatId) {
  try {
    const e = await engine();
    return await chatCharacterNames(e, await e.chats.getById(chatId));
  } catch {
    return [];
  }
}

async function chatCharacterNames(e, chat) {
  let ids = [];
  try {
    ids = Array.isArray(chat?.characterIds) ? chat.characterIds : JSON.parse(chat?.characterIds || '[]');
  } catch {}
  const names = [];
  for (const id of ids) {
    const name = await characterName(e, id);
    if (name) names.push(name);
  }
  return names;
}

/** The host calls this only inside its native merged-roleplay speaker-color condition. */
function speakerInstructions(chatId, names) {
  return speakerTagsOn(chatId) ? SP.speakerInstructions(names) : '';
}

/** From Marinara's reply cleanup (synchronous): merged roleplay group replies in chats that color speakers. */
function fixSpeakers(text, o) {
  if (!o || o.chatMode !== 'roleplay' || !o.isGroupChat || o.usesIndividualGroupGeneration || o.impersonate) return text;
  if (!speakerColors.get(o.chatId) || !speakerTagsOn(o.chatId)) return text;
  const fixed = SP.restoreSpeakerTags(text, (o.charInfo || []).map((c) => c.name));
  if (fixed !== text) log(`chat ${o.chatId}: put speaker tags back on the new reply`);
  return fixed;
}

/* ---------- recall ---------- */

const recalls = new Map();
const turnQuery = new Map();
const storyDays = new Map();

/**
 * The story's "today", one value for everything that counts days (the memory text, the deadline list): the
 * latest date the chat itself shows (date lines, trackers) as of the last reply, else what the ledger has read.
 */
function storyToday(chatId, ledger) {
  const day = storyDays.get(chatId) || null;
  const read = ledger?.storyDate || null;
  return day && (!read || day >= read) ? day : read;
}
const storyNow = new Map();

/**
 * Pick the old scenes to show in full for this reply. Never blocks the reply for long:
 * the model pick has a time limit, and any failure falls back to the fast pick.
 * A reroll of the same turn reuses the last pick.
 */
function recallFingerprint(s) {
  return L.hashText(JSON.stringify([s.id, s.editedAt || null, s.title, s.time, s.place, s.weather || null, s.summary, s.events, s.loose || null, s.recollections, s.later || null, s.learned || null, s.heardLater || null]));
}

async function recallBeforeReply(chatId, view, userMessage) {
  // What is being talked about now: old chapters' details that touch it are shown first.
  turnQuery.set(chatId, [...view.slice(-3).map((m) => m.content), userMessage || ''].join('\n').slice(-4000));
  const mode = RECALL_MODES.includes(settings().recall) ? settings().recall : 'model';
  const store = scenesForReply(chatId);
  if (mode === 'off' || !store) return recalls.delete(chatId);
  const firstInside = windows.get(chatId) ?? null;
  const list = R.candidates(store, firstInside);
  const recent = view.slice(-6);
  // The same turn gives the same key whether it is sent or rerolled (then the user message is already saved).
  const tail = [...view.map((m) => m.h), ...(userMessage ? [L.hashText(userMessage)] : [])].slice(-5);
  // The scenes' own content is in the key, so a scene edited again (or changed by a re-fold) is never served stale.
  const key = L.hashText(JSON.stringify([mode, list.map(recallFingerprint), tail]));
  if (recalls.get(chatId)?.key === key) return;
  const entry = await computeRecall(chatId, store, view, userMessage, { mode, firstInside, list });
  entry.key = key;
  recalls.set(chatId, entry);
  if (entry.picks.length || entry.error) log(`chat ${chatId}: recall ${entry.used} → ${entry.picks.map((p) => p.id).join(', ') || 'none'} (${entry.ms} ms)${entry.error ? `; ${entry.error}` : ''}`);
}

/** The recall itself: which old scenes come up for this turn, and why. Used before a reply and by the test. */
async function computeRecall(chatId, store, view, userMessage, { mode, firstInside, list }) {
  const recent = view.slice(-6);
  const entry = { mode, picks: [], ms: 0, at: new Date().toISOString(), error: null, used: mode };
  const started = Date.now();
  const left = () => RECALL_TIMEOUT_MS - (Date.now() - started);
  if (list.length) {
    const ledger = ledgerForReply(chatId);
    // Meaning search first (quick): scenes close in meaning even when the words differ.
    await Promise.race([embeddingSource(), new Promise((r) => setTimeout(r, Math.min(QUERY_TIMEOUT_MS, left())))]);
    const index = loadVectors(chatId);
    if (index && Object.keys(index.items).length && left() > 1000) {
      try {
        const texts = V.queryTexts(recent, userMessage);
        const queries = await embedTexts(texts, 'query', AbortSignal.timeout(Math.min(QUERY_TIMEOUT_MS, left())));
        entry.semantic = V.nearest(index, queries, list, 6);
        // A sentence that points back ("하준이 얘기했듯…", "그때 말했잖아") gets the scene closest to it on its own.
        entry.pointed = [];
        texts.forEach((t, i) => {
          if (i === 0 && texts.length > 1) return;
          if (!V.POINTS_BACK.test(t)) return;
          const top = V.nearest(index, [queries[i]], list, 1)[0];
          if (top && !entry.pointed.some((x) => x.id === top.id)) entry.pointed.push({ id: top.id, piece: top.piece, text: t });
        });
      } catch (error) {
        entry.semanticError = String(error?.message || error);
      }
    }
    if (mode === 'model' && left() < RECALL_MIN_MODEL_MS) {
      entry.error = `뜻 찾기가 오래 걸려 이번에는 빠른 방식으로 골랐습니다`;
      entry.used = 'fast';
    } else if (mode === 'model') {
      try {
        const model = await memoryModel();
        model.signal = AbortSignal.timeout(Math.max(1000, left()));
        const reply = await askModel(model, R.buildRecallPrompt(list, ledger, recent, userMessage, store.chapters || [], entry.semantic || []), { maxTokens: 600 });
        const parsed = L.parseJsonObject(reply);
        if (!parsed) throw Error('기억 모델의 답을 읽지 못했습니다');
        entry.picks = R.applyRecall(parsed, list, store.chapters || [], [...recent.map((m) => m.content), userMessage || ''].join(' '));
      } catch (error) {
        entry.error = error?.name === 'TimeoutError' ? `${RECALL_TIMEOUT_MS / 1000}초 안에 회상이 끝나지 않아 빠른 방식으로 골랐습니다` : String(error?.message || error);
        entry.used = 'fast';
      }
    }
    if (entry.used === 'fast') entry.picks = R.fastRecall(list, ledger, recent, userMessage);
    // The closest scene in meaning, when it clearly stands out, fills a free place (it never pushes out a pick).
    const strong = (entry.semantic || []).find((x) => x.strong && !entry.picks.some((p) => p.id === x.id));
    if (strong && entry.picks.length < R.MAX_PICKS) entry.picks.push({ id: strong.id, why: '뜻이 가까움(임베딩)' });
    const latest = R.latestUser(recent, userMessage).text;
    // Scenes a back-pointing sentence found come first; a rare-word hit only fills a free place
    // (a word like "냉장고" said about what is happening now is no reason to push out the model's choice).
    for (const x of [...(entry.pointed || [])].reverse()) {
      entry.picks = [{ id: x.id, why: `예전 일을 가리키는 말: "${x.text.slice(0, 40)}${x.text.length > 40 ? '…' : ''}"` }, ...entry.picks.filter((p) => p.id !== x.id)].slice(0, R.MAX_PICKS);
    }
    const wordHit = R.directHit(list, latest);
    if (wordHit && entry.picks.length < R.MAX_PICKS && !entry.picks.some((p) => p.id === wordHit.id)) entry.picks.push({ id: wordHit.id, why: `방금 메시지의 낱말(${wordHit.hits.slice(0, 3).join(', ')})이 이 장면에 있음` });
    // Lines from old messages (outside the window) that the newest message names, for details a summary dropped.
    entry.raw = R.rawHits(view.filter((m) => firstInside != null && m.number < firstInside), latest);
    if (wordHit) entry.direct = { id: wordHit.id, hits: wordHit.hits.slice(0, 5) };
    // What came of a recalled scene later (its real reason, who heard of it) comes along with it.
    entry.picks = R.withFollowUps(store, entry.picks, list);
  }
  entry.ms = Date.now() - started;
  return entry;
}

function attach(app) {
  app.register(routes, { prefix: '/api/memory-module' });
  app.addHook('onSend', branchOnSend);
  app.addHook('preHandler', async (req) => {
    try {
      const url = String(req.raw?.url || '').split('?')[0];
      if (req.method !== 'POST' || url !== '/api/generate') return;
      const chatId = req.body?.chatId;
      if (typeof chatId === 'string') await prepareSpeakers(chatId, req.body).catch((error) => log(`speaker tags: ${error?.message || error}`));
      if (typeof chatId === 'string' && chatEnabled(chatId)) await syncBeforeReply(chatId, req.body);
    } catch (error) {
      log(`before-reply sync: ${error?.message || error}`);
    }
  });
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

module.exports = { fixSpeakers, speakerInstructions, attach, renderLedger, processChat, chatMessages, DATA_DIR, _test: { branchMemory, branchOnSend, inheritBranch, setEngine: (e) => { enginePromise = Promise.resolve(e); }, saveLedger, loadLedger, saveSettings, settings, readJson, writeJson, loadScenes, saveScenes, checkFiles, recallFingerprint, health, trackerClock, addTrackerClock, storyToday, storyDays, translationLookup, loadTranslations, saveTranslations, chatLangs, memoryLanguage, injectionLines, displayTranslationTexts, withLanguage, renderMemorySource, syncBeforeReply, jobs } };



