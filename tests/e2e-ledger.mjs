// Full flow on a throwaway Marinara test server with the fake model (tests/fake-llm.mjs).
// Usage: node tests/e2e-ledger.mjs <marinara url> <fake llm url> <chat .jsonl> <reply file>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [base, llm, jsonlPath, replyFile] = process.argv.slice(2);
const port = new URL(base).port;
const cli = fileURLToPath(new URL('../memory-module/memory-cli.cjs', import.meta.url));
const headers = { 'x-marinara-csrf': '1' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, url, body) {
  const response = await fetch(base + url, {
    method,
    headers: body instanceof FormData ? headers : { ...headers, 'content-type': 'application/json' },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw Error(`${method} ${url} -> ${response.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { env: { ...process.env, PORT: port }, encoding: 'utf8' });
async function waitIdle(chatId) {
  for (let i = 0; i < 600; i++) {
    const r = await api('GET', `/api/memory-module/chats/${chatId}`);
    if (r.job.state !== 'running') return r;
    await sleep(500);
  }
  throw Error('timed out');
}

// Setup: model connection, imported real chat, preset with {{기억}}.
const connection = await api('POST', '/api/connections', { name: '나노딥식41플1017', provider: 'openai', baseUrl: `${llm}/v1`, apiKey: 'test', model: 'fake-model' });
const form = new FormData();
form.append('file', new Blob([fs.readFileSync(jsonlPath)]), '테스트방.jsonl');
const imported = await api('POST', '/api/import/st-chat', form);
const chatId = imported.chatId || imported.id || imported.chat?.id;
assert.ok(chatId, `import returned ${JSON.stringify(imported).slice(0, 200)}`);
const stock = (await api('GET', '/api/prompts')).find((p) => p.name === "Marinara's Universal Preset");
const copy = await api('POST', `/api/prompts/${stock.id}/duplicate`, {});
const preset = copy.preset ?? copy;
const sections = await api('GET', `/api/prompts/${preset.id}/sections`);
const history = sections.find((s) => s.isMarker && JSON.stringify(s.markerConfig || '').includes('chat_history'));
const added = await api('POST', `/api/prompts/${preset.id}/sections`, { identifier: 'memory', name: '기억', content: '<memory>\n{{기억}}\n</memory>', role: 'system', isMarker: false, enabled: true });
const order = sections.map((s) => s.id);
order.splice(order.indexOf(history.id), 0, added.id ?? added.section?.id);
await api('PUT', `/api/prompts/${preset.id}/sections/reorder`, { sectionIds: order });
await api('PATCH', `/api/chats/${chatId}`, { connectionId: connection.id, promptPresetId: preset.id });

// 1) Commands: connection, list, estimate.
assert.match(run('connection', '나노딥식41플1017'), /기억용 연결: 나노딥식41플1017/);
assert.match(run('list'), new RegExp(chatId));
const estimate = run('estimate', chatId);
assert.match(estimate, /메시지 330개[\s\S]*호출 약 \d+번/);
console.log('ok 1:', estimate.trim());

// 2) First full pass over the real 330 messages.
assert.match(run('start', chatId), /처음부터 정리/);
let state = await waitIdle(chatId);
assert.equal(state.job.state, 'done', JSON.stringify(state.job));
assert.equal(state.summary.processed, 330);
const promise = state.threads.find((t) => t.kind === 'promise');
assert.ok(promise, 'the real chat mentions 약속 somewhere');
const rows = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).slice(1);
assert.ok(rows.some((r) => r.mes.includes(promise.evidence[0].text)), 'evidence text is copied from the real message');
console.log(`ok 2: ${state.job.total} call(s), ${state.threads.length} thread(s), quotes match the source`);

// 3) The ledger reaches the prompt at {{기억}}, inside <memory>, before the chat history.
let preview = JSON.stringify((await api('POST', '/api/generate/dryRun', { chatId, returnPrompt: true, userMessage: '안녕' })).prompt);
assert.match(preview, /<memory>\\n\s*\[Open threads/);
assert.ok(preview.includes(promise.title));
console.log('ok 3: open threads appear at {{기억}} in the prompt preview');

// 4) A real reply: the fake RP model answers with a new promise; the ledger updates by itself.
const before = state.threads.length;
const callsBefore = await (await fetch(`${llm}/__calls`)).json();
await api('POST', '/api/generate', { chatId, userMessage: '오늘은 좀 피곤해.', streaming: true });
await sleep(2500);
state = await waitIdle(chatId);
const calls = await (await fetch(`${llm}/__calls`)).json();
assert.equal(state.summary.processed, 332, 'user message + reply processed');
assert.equal(calls.memory - callsBefore.memory, 1, 'one memory call for one reply');
const walk = state.threads.find((t) => t.detail && t.detail.includes('산책'));
assert.ok(walk, 'new promise from the reply is in the ledger');
console.log(`ok 4: after one reply the ledger has ${state.threads.length - before} new thread(s) from 1 memory call`);

// 5) Regenerate that reply with different text: the old promise is rolled back, the new reply is read.
fs.writeFileSync(replyFile, '단테가 하품을 했다. "그럼 푹 자."');
const msgs = await api('GET', `/api/chats/${chatId}/messages?limit=5`);
const list = Array.isArray(msgs) ? msgs : msgs.messages || msgs.items;
const last = list.filter((m) => m.role === 'assistant').at(-1) ?? list.at(-1);
await api('POST', '/api/generate', { chatId, regenerateMessageId: last.id, streaming: true });
await sleep(2500);
state = await waitIdle(chatId);
assert.ok(!state.threads.some((t) => t.detail && t.detail.includes('산책')), 'promise from the replaced reply is gone');
assert.equal(state.summary.processed, 332);
console.log('ok 5: regenerated reply rolled back its promise and was read again');

// 6) Turning the chat off stops reply updates; the existing ledger stays in the prompt.
run('off', chatId);
const callsOff = (await (await fetch(`${llm}/__calls`)).json()).memory;
await api('POST', '/api/generate', { chatId, userMessage: '잘 자.', streaming: true });
await sleep(2500);
assert.equal((await (await fetch(`${llm}/__calls`)).json()).memory, callsOff);
preview = JSON.stringify((await api('POST', '/api/generate/dryRun', { chatId, returnPrompt: true })).prompt);
assert.match(preview, /\[Open threads/);
console.log('ok 6: off stops updates, ledger still in the prompt');
console.log(run('status', chatId).trim());
console.log('all ledger e2e checks passed');
