// An old message edited while the ledger is still reading: the next reply must not carry what it said before.
// Usage: node tests/e2e-edit-during-read.mjs <marinara url> <fake llm url> tests/fixtures/edit-during-read.jsonl <reply file>
import assert from 'node:assert/strict';
import fs from 'node:fs';
const [base, llm, jsonl, replyFile] = process.argv.slice(2);
const headers = { 'x-marinara-csrf': '1' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, url, body) {
  const r = await fetch(base + url, { method, headers: body instanceof FormData ? headers : { ...headers, 'content-type': 'application/json' }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw Error(`${method} ${url} -> ${r.status} ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { return t; }
}
const conn = await api('POST', '/api/connections', { name: '시험 연결', provider: 'openai', baseUrl: `${llm}/v1`, apiKey: 'test', model: 'fake-model' });
const form = new FormData(); form.append('file', new Blob([fs.readFileSync(jsonl)]), '시험방.jsonl');
const im = await api('POST', '/api/import/st-chat', form);
const chatId = im.chatId || im.id || im.chat?.id;
const stock = (await api('GET', '/api/prompts')).find((p) => p.name === "Marinara's Universal Preset");
const copy = await api('POST', `/api/prompts/${stock.id}/duplicate`, {}); const preset = copy.preset ?? copy;
const sections = await api('GET', `/api/prompts/${preset.id}/sections`);
const history = sections.find((s) => s.isMarker && JSON.stringify(s.markerConfig || '').includes('chat_history'));
const added = await api('POST', `/api/prompts/${preset.id}/sections`, { identifier: 'memory', name: '기억', content: '<memory>\n{{기억}}\n</memory>', role: 'system', isMarker: false, enabled: true });
const order = sections.map((s) => s.id); order.splice(order.indexOf(history.id), 0, added.id ?? added.section?.id);
await api('PUT', `/api/prompts/${preset.id}/sections/reorder`, { sectionIds: order });
await api('PATCH', `/api/chats/${chatId}`, { connectionId: conn.id, promptPresetId: preset.id });
await api('POST', '/api/memory-module/settings', { connection: conn.name });
await api('POST', `/api/memory-module/chats/${chatId}/enable`, {});
const status = async () => api('GET', `/api/memory-module/chats/${chatId}`);
const idle = async () => { for (let i = 0; i < 600; i++) { const s = await status(); if (s.job.state !== 'running') return s; await sleep(300); } };
const prompt = async () => JSON.stringify((await api('POST', '/api/generate/dryRun', { chatId, returnPrompt: true, userMessage: '금요일에 뭐 하기로 했지?' })).prompt);
const replyPrompt = async (msg) => { await api('POST', '/api/generate', { chatId, userMessage: msg, streaming: true }); await sleep(1500); return await (await fetch(`${llm}/__lastrp`)).text(); };
const OLD = '금요일 오후 세 시에 병원 같이 가 줄게';

await api('POST', `/api/memory-module/chats/${chatId}/start`, { fresh: true });
let s = await idle();
assert.equal(s.job.state, 'done', JSON.stringify(s.job));
assert.ok(s.threads.some((t) => (t.detail || '').includes(OLD)), 'the promise is in the ledger');
assert.ok((await prompt()).includes(OLD), 'and in the reply prompt');
assert.ok((await replyPrompt('응.')).includes(OLD), 'a real reply gets it too'); s = await idle();
console.log('ok 1: ledger has the Friday promise, and it reaches the prompt');

// Hold the next read on a slow model.
await fetch(`${llm}/__delay/9000`);
fs.writeFileSync(replyFile, '도윤이 하품을 했다. "그럼 일찍 자자."');
await api('POST', '/api/generate', { chatId, userMessage: '오늘은 일찍 잘래.', streaming: true });
await api('POST', '/api/generate', { chatId, userMessage: '잘 자.', streaming: true });
await sleep(1500);
s = await status();
assert.equal(s.job.state, 'running', 'a read is under way');
const list = await api('GET', `/api/chats/${chatId}/messages`);
const rows = Array.isArray(list) ? list : list.messages || list.items;
const target = rows.find((m) => String(m.content).includes(OLD));
await api('PATCH', `/api/chats/${chatId}/messages/${target.id}`, { content: '도윤은 병원 약속을 하지 않았다.' });
const during = await replyPrompt('금요일에 뭐 하기로 했지?');
assert.equal((await status()).job.state, 'running', 'still reading when the reply was prepared');
assert.ok(!during.includes(OLD), 'the reply prepared during the read does not carry the old promise');
console.log('ok 2: edited during the read -> the next reply has no old promise');

await fetch(`${llm}/__delay/0`);
s = await idle();
const after = await replyPrompt('그럼 주말엔?');
assert.ok(!after.includes(OLD), 'after the read, still gone');
s = await status();
assert.ok(!s.threads.some((t) => (t.detail || '').includes(OLD)), 'and the stored ledger no longer has it');
console.log('ok 3: after the read ends the stored ledger is corrected too');
