'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-split-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('content refusal isolates a single item, continues later batches and retry retains results', async () => {
  const calls = [];
  let refuse = true;
  const engine = {
    connections: { list: async () => [{ id: 'model', name: 'model' }], getWithKey: async () => ({ model: 'test' }) },
    resolveBaseUrl: () => 'http://fake.test',
    createLLMProvider: () => ({ chatComplete: async (messages) => {
      const lines = JSON.parse(messages[1].content).lines;
      calls.push(lines);
      if (refuse && lines.some((s) => s.endsWith('number 12.'))) throw Error('content_filter: blocked');
      return { content: JSON.stringify({ lines: lines.map((s) => `번역 ${s}`) }) };
    } }),
  };
  X.setEngine(engine);
  X.saveSettings({ connection: 'model', writeLanguage: 'en', chats: { split: { enabled: true } } });
  X.chatLangs.set('split', 'en');
  const store = S.emptyStore();
  store.facts = Array.from({ length: 45 }, (_, i) => ({ id: `F${i}`, text: `This is English memory number ${i}.` }));
  X.saveScenes('split', store);
  const endpoints = new Map();
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((m) => [m, (url, fn) => endpoints.set(`${m.toUpperCase()} ${url}`, fn)]));
  service.attach({ register: (fn) => fn(app), addHook() {} });
  const call = (method, url, id = 'split') => endpoints.get(`${method} ${url}`)({ params: { id }, body: {} }, { status() { return this; }, send(v) { return v; } });
  const get = (id) => call('GET', '/chats/:id/translations', id);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
  await get();
  let state;
  for (let n = 0; n < 200; n++) { await tick(); state = await get(); if (!state.working && state.error) break; }
  assert.equal(state.missing, 1);
  assert.equal(Object.keys(state.items).length, 44);
  assert.match(state.error, /1개 항목.*개별로/);
  assert.ok(calls.some((part) => part.length === 1 && part[0].endsWith('number 12.')));
  assert.ok(state.items['This is English memory number 44.'], 'a later batch is still processed');
  refuse = false; calls.length = 0;
  await call('POST', '/chats/:id/translations/retry');
  for (let n = 0; n < 200; n++) { await tick(); state = await get(); if (!state.working && !state.missing) break; }
  assert.equal(state.missing, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['This is English memory number 12.']);

  let attempts = 0;
  engine.createLLMProvider = () => ({ chatComplete: async () => { attempts++; const e = Error('429 rate limit'); e.status = 429; throw e; } });
  X.saveSettings({ connection: 'model', writeLanguage: 'en', chats: { rate: { enabled: true } } });
  X.chatLangs.set('rate', 'en');
  X.saveScenes('rate', store);
  await get('rate');
  for (let n = 0; n < 200; n++) { await tick(); state = await get('rate'); if (!state.working && state.error) break; }
  assert.equal(attempts, 1, 'rate limits must not trigger splitting');
  assert.match(state.error, /429/);
});

test('invalid and partial responses split without looping and keep successful items', async () => {
  let calls = 0;
  X.setEngine({
    connections: { list: async () => [{ id: 'model', name: 'model' }], getWithKey: async () => ({ model: 'test' }) },
    resolveBaseUrl: () => 'http://fake.test',
    createLLMProvider: () => ({ chatComplete: async (messages) => {
      const lines = JSON.parse(messages[1].content).lines; calls++;
      if (lines.length > 1) return { content: JSON.stringify({ lines: lines.map(() => '') }) };
      return { content: JSON.stringify({ lines: [`번역 ${lines[0]}`] }) };
    } }),
  });
  X.saveSettings({ connection: 'model', writeLanguage: 'en', chats: { partial: { enabled: true } } });
  X.chatLangs.set('partial', 'en');
  const store = S.emptyStore();
  store.facts = Array.from({ length: 4 }, (_, i) => ({ id: `F${i}`, text: `Another English memory number ${i}.` }));
  X.saveScenes('partial', store);
  const endpoints = new Map();
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((m) => [m, (url, fn) => endpoints.set(`${m.toUpperCase()} ${url}`, fn)]));
  service.attach({ register: (fn) => fn(app), addHook() {} });
  const get = () => endpoints.get('GET /chats/:id/translations')({ params: { id: 'partial' } }, { status() { return this; }, send(v) { return v; } });
  await get();
  let state;
  for (let n = 0; n < 100; n++) { await new Promise((resolve) => setTimeout(resolve, 5)); state = await get(); if (!state.working) break; }
  assert.equal(state.missing, 0);
  assert.equal(calls, 7);
});
