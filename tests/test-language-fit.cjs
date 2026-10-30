// node --test tests/test-language-fit.cjs
// Memory translated into a longer language still fits the memory limit, whole (nothing cut off at the end).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-fit-'));
process.env.MEMORY_MODULE_MAX_CHARS = '12000';
const T = require('../memory-module/lib/translate.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const M = require('../memory-module/lib/service.cjs');
const X = { ...M._test, renderLedger: M.renderLedger };
test.after(() => fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }));

test('English that comes out much longer still fits the limit and keeps its ending', () => {
  X.saveSettings({ connection: null, chats: { big: { enabled: true } }, memoryLanguage: 'en' });
  const store = S.emptyStore();
  store.scenes = Array.from({ length: 160 }, (_, i) => ({
    id: `S${i + 1}`, start: i * 2 + 1, end: i * 2 + 2, messages: [], time: `25-07-${String((i % 28) + 1).padStart(2, '0')} (토)`, place: '거실',
    title: `장면 ${i + 1}`, summary: `서아와 도윤이 ${i + 1}번째로 바다 이야기를 나누고, 하준이 다음 주말 계획을 세운다.`,
    events: [{ text: `도윤이 ${i + 1}번째 약속을 정함`, importance: 'major', quotes: [] }], recollections: [],
  }));
  store.window = { size: 4, firstInside: 200 };
  X.saveScenes('big', store);
  const source = X.renderMemorySource('big');
  assert.ok(source.length > 5000, 'the room has plenty to say');
  const data = X.loadTranslations('big');
  for (const line of X.injectionLines('big', 'en')) data.items[T.key('en', line)] = `EN ${'x'.repeat(line.length * 6)}`;
  X.saveTranslations('big', data);
  const out = X.renderLedger('big');
  assert.ok(out.length <= 12000 + 300, `fits the limit (${out.length})`);
  assert.match(out, /\[End of memory/, 'the closing instruction is still there');
  const korean = out.split('\n').filter((l) => /[가-힣]{2}/.test(l) && !/^\[(Memory:|End of memory)/.test(l));
  assert.deepEqual(korean, [], 'every line chosen has its translation');
});
