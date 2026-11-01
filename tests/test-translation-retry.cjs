'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-retry-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('partial translation failure preserves results and retry fills only missing items', async () => {
  let calls = 0;
  let requested = [];
  let fail = true;
  let release;
  const engine = {
    connections: { list: async () => [{ id: 'model', name: 'model' }], getWithKey: async () => ({ model: 'test' }) },
    resolveBaseUrl: () => 'http://fake.test',
    createLLMProvider: () => ({ chatComplete: async (messages) => {
      const lines = JSON.parse(messages[1].content).lines;
      requested.push(...lines); calls++;
      if (fail && calls === 2) throw Error('test connection failure');
      if (!fail && !release) await new Promise((resolve) => { release = resolve; });
      return { content: JSON.stringify({ lines: lines.map((line) => `번역 ${line}`) }) };
    } }),
  };
  X.setEngine(engine);
  X.saveSettings({ connection: 'model', writeLanguage: 'en', chats: { demo: { enabled: true } } });
  X.chatLangs.set('demo', 'en');
  const store = S.emptyStore();
  store.facts = Array.from({ length: 45 }, (_, i) => ({ id: `F${i}`, text: `This is English memory number ${i}.` }));
  X.saveScenes('demo', store);
  const endpoints = new Map();
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((method) => [method, (url, fn) => endpoints.set(`${method.toUpperCase()} ${url}`, fn)]));
  service.attach({ register: (fn) => fn(app), addHook() {} });
  const call = async (method, url) => endpoints.get(`${method} ${url}`)({ params: { id: 'demo' }, body: {} }, { status() { return this; }, send(v) { return v; } });
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
  const get = () => call('GET', '/chats/:id/translations');
  await get();
  let result;
  for (let n = 0; n < 100; n++) { await tick(); result = await get(); if (!result.working && result.error) break; }
  assert.match(result.error, /test connection failure/);
  assert.equal(Object.keys(result.items).length, 40);
  assert.equal(result.missing, 5);
  const retained = { ...result.items };
  requested = []; fail = false;
  const retry = await call('POST', '/chats/:id/translations/retry');
  assert.equal(retry.working, true);
  for (let n = 0; n < 100 && !release; n++) await tick();
  const duplicate = await call('POST', '/chats/:id/translations/retry');
  assert.equal(duplicate.alreadyWorking, true);
  release();
  for (let n = 0; n < 100; n++) { await tick(); result = await get(); if (!result.working && !result.missing) break; }
  assert.equal(result.missing, 0);
  assert.equal(Object.keys(result.items).length, 45);
  assert.deepEqual(Object.fromEntries(Object.keys(retained).map((key) => [key, result.items[key]])), retained);
  assert.equal(requested.length, 5);
});
