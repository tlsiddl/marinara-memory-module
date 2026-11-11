'use strict';
// A line that cannot be translated even alone is given up on after two tries (not asked every few minutes) until the
// user asks again; the cache is written once per run, not after every part. (Invented text.)
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-giveup-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('permanently failing lines are skipped after two failures; a manual retry gives them back', async () => {
  const calls = [];
  const BAD = 'This is the blocked English line.';
  const engine = {
    connections: { list: async () => [{ id: 'model', name: 'model' }], getWithKey: async () => ({ model: 'test' }) },
    resolveBaseUrl: () => 'http://fake.test',
    createLLMProvider: () => ({ chatComplete: async (messages) => {
      const lines = JSON.parse(messages[1].content).lines;
      calls.push(lines);
      if (lines.includes(BAD)) throw Error('blocked by safety filter');
      return { content: JSON.stringify({ lines: lines.map((l) => `번역 ${l}`) }) };
    } }),
  };
  X.setEngine(engine);
  X.saveSettings({ connection: 'model', writeLanguage: 'en', chats: { gu: { enabled: true } } });
  X.chatLangs.set('gu', 'en');
  const store = S.emptyStore();
  store.facts = [{ id: 'F1', text: 'This is a fine English line.' }, { id: 'F2', text: BAD }];
  X.saveScenes('gu', store);
  const texts = [store.facts[0].text, BAD];
  const badCalls = () => calls.filter((c) => c.length === 1 && c[0] === BAD).length;
  for (let i = 0; i < 4; i++) await service._test.translationRun('gu', texts).catch(() => {});
  assert.equal(badCalls(), 2, 'asked alone only twice');
  assert.ok(X.translationGaveUp(X.loadTranslations('gu'), require('../memory-module/lib/translate.cjs').key('ko', BAD)));
  assert.equal(X.clearTranslationFailures('gu', [BAD], 'ko'), 1);
  await service._test.translationRun('gu', texts).catch(() => {});
  assert.equal(badCalls(), 3, 'tried again after the manual retry');
});

test('the cache file is written once per run, not after every part', async () => {
  const engine = {
    connections: { list: async () => [{ id: 'model', name: 'model' }], getWithKey: async () => ({ model: 'test' }) },
    resolveBaseUrl: () => 'http://fake.test',
    createLLMProvider: () => ({ chatComplete: async (messages) => ({ content: JSON.stringify({ lines: JSON.parse(messages[1].content).lines.map((l) => `번역 ${l}`) }) }) }),
  };
  X.setEngine(engine);
  X.saveSettings({ connection: 'model', writeLanguage: 'en', chats: { gu2: { enabled: true } } });
  X.chatLangs.set('gu2', 'en');
  const texts = Array.from({ length: 90 }, (_, i) => `English memory line number ${i}.`);
  const file = path.join(service.DATA_DIR, 'chats', 'gu2.translations.json');
  let writes = 0;
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = function (f, ...rest) { if (String(f).includes('gu2.translations.json')) writes++; return realWrite.call(this, f, ...rest); };
  try { await X.translationRun('gu2', texts); } finally { fs.writeFileSync = realWrite; }
  assert.ok(writes >= 1 && writes <= 2, `writes: ${writes}`);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'gu2.translations.json'), 'utf8')).items).length, 90, 'everything is on disk at the end');
});
