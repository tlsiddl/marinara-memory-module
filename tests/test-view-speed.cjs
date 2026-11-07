'use strict';
// node --test tests/test-view-speed.cjs
// 0.12.3: the status and the room data no longer wait on the connection look-up (connection list + key, about a
// second on a real server) once it is known, even when its minute is up; the look-up is shared by simultaneous
// callers; every module route says where its time went in a Server-Timing header. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-speed-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const calls = { list: 0, key: 0, messages: 0, chat: 0 };
let delay = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
X.setEngine({
  chats: {
    async getById(id) { calls.chat++; return { id, name: '방' }; },
    async listMessages() { calls.messages++; return [{ id: 'm1', role: 'user', content: '안녕하세요', extra: '{}' }]; },
  },
  characters: { async getById() { return null; } },
  connections: {
    async list() { calls.list++; await sleep(delay); return [{ id: 'c1', name: '기억용' }]; },
    async getWithKey(id) { calls.key++; await sleep(delay); return { id, name: '기억용', provider: 'openai', model: 'chat-model', embeddingModel: 'embed-a', embeddingBaseUrl: 'http://x.invalid/v1' }; },
  },
  createLLMProvider: () => ({ embed: async () => [] }),
  resolveBaseUrl: () => 'http://x.invalid/v1',
});
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
service.attach(app);
const call = async (key, id) => {
  const headers = {};
  const reply = { status() { return { send: (x) => x }; }, header(k, v) { headers[k] = v; return reply; } };
  const body = await handlers[key]({ params: { id }, body: {}, query: {} }, reply);
  return { body, headers };
};
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
after(() => { Date.now = realNow; });
X.saveSettings({ connection: 'c1', chats: {} });

test('the first status waits for the look-up once; later ones within the minute do not touch the connection', async () => {
  delay = 60;
  const first = await call('GET /status');
  assert.equal(first.body.embedding.model, 'embed-a');
  assert.deepEqual([calls.list, calls.key], [1, 1]);
  delay = 0;
  for (let i = 0; i < 5; i++) await call('GET /status');
  assert.deepEqual([calls.list, calls.key], [1, 1]);
});

test('after the minute the status answers at once from the last source and refreshes behind it, once for many callers', async () => {
  offset += 61_000;
  delay = 200;
  const t = realNow();
  const results = await Promise.all([call('GET /status'), call('GET /status'), call('GET /chats/:id', 'room-a')]);
  assert.ok(realNow() - t < 150, 'did not wait for the 200ms look-up (' + (realNow() - t) + 'ms)');
  assert.equal(results[0].body.embedding.model, 'embed-a');
  await sleep(500);
  assert.deepEqual([calls.list, calls.key], [2, 2], 'one shared refresh, not one per caller');
  delay = 0;
  const again = realNow();
  await call('GET /status');
  assert.ok(realNow() - again < 100);
  assert.deepEqual([calls.list, calls.key], [2, 2], 'the refreshed source is good for another minute');
});

test('a changed embedding setting is not answered from the old source', async () => {
  X.saveSettings({ ...X.settings(), embedding: { model: 'embed-b' } });
  const s = await call('GET /status');
  assert.equal(s.body.embedding.mode, 'manual');
  assert.equal(s.body.embedding.model, 'embed-b');
});

test('the room data reads the chat once at most, then not again, and says so in Server-Timing', async () => {
  const m0 = calls.messages;
  const a = await call('GET /chats/:id', 'room-b');
  const afterFirst = calls.messages;
  assert.ok(afterFirst - m0 <= 1, 'at most one message list for the first look');
  const b = await call('GET /chats/:id', 'room-b');
  assert.equal(calls.messages, afterFirst, 'the second look reads no messages');
  for (const h of [a.headers, b.headers]) {
    const t = h['Server-Timing'];
    assert.match(t, /embedding-source;dur=\d/);
    assert.match(t, /chat-language;dur=\d/);
    assert.match(t, /render-ledger;dur=\d/);
    assert.match(t, /total;dur=\d/);
    assert.ok(!/[가-힣]|room-b/.test(t), 'no data in the header');
  }
});

test('the status route carries Server-Timing too, and an error reply does as well', async () => {
  const s = await call('GET /status');
  assert.match(s.headers['Server-Timing'], /embedding-source;dur=[\d.]+, total;dur=[\d.]+/);
  const bad = await call('GET /chats/:id', '../x').catch((e) => ({ headers: {}, error: e }));
  assert.ok(bad);
});
