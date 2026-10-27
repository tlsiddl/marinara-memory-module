// node --test tests/test-memory-expression.cjs
// Prompt wiring and stored-memory preservation; not a real-model repetition benchmark.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-expression-'));
process.env.DATA_DIR = dir;
const S = require('../memory-module/lib/scenes.cjs');
const service = require('../memory-module/lib/service.cjs');
const T = service._test;
const saveSettings = (value) => T.writeJson(path.join(service.DATA_DIR, 'settings.json'), value);
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('all recall styles retain the same memory while discouraging repeated expression', () => {
  const chatId = 'expression';
  const store = S.emptyStore();
  store.scenes = [{ id: 'S1', start: 1, end: 2, messages: [], title: '복귀 일정', summary: '목요일부터 다시 일하기로 했다.', events: [], recollections: [], present: [] }];
  T.saveScenes(chatId, store);
  const filename = path.join(service.DATA_DIR, 'chats', `${chatId}.scenes.json`);
  const saved = fs.readFileSync(filename, 'utf8');
  let previousBody;
  for (const style of ['quiet', 'natural', 'active', 'unknown']) {
    saveSettings({ chats: { [chatId]: { enabled: true } }, recallStyle: style });
    const rendered = service.renderLedger(chatId);
    assert.match(rendered, /목요일부터 다시 일하기로 했다/);
    assert.match(rendered, /do not retell, paraphrase or re-explain them in narration, inner thoughts or dialogue/);
    assert.match(rendered, /explicit question or requested correction/);
    assert.match(rendered, /specific answer the user asked to hear again/);
    assert.match(rendered, /Correct or restate that answer only; do not replay its already explained background, origin story or supporting anecdote in narration, inner thoughts or dialogue/);
    assert.match(rendered, /Unless the user explicitly asks to revisit that past event itself/);
    assert.match(rendered, /remain implicit in tone, familiarity, choices and reactions/);
    assert.match(rendered.split('[End of memory.')[1], /A requested correction is not permission to retell its background/);
    assert.match(rendered, /new development that changes their meaning/);
    assert.match(rendered, /decision that directly needs that detail now/);
    assert.match(rendered, /Do not repeatedly use the same remembered fact as the same rationale/);
    assert.match(rendered, /preserve its dates, elapsed time, counts and circumstances/);
    assert.match(rendered.split('[End of memory.')[1], /Keep already expressed facts implicit/);
    assert.doesNotMatch(rendered, /Their shared history should be felt in this reply|tease or press about them/);
    if (style === 'active') assert.match(rendered, /active remembering does not require spoken callbacks/);
    const body = rendered.slice(rendered.indexOf('\n\n') + 2, rendered.lastIndexOf('\n\n'));
    if (previousBody !== undefined) assert.equal(body, previousBody, 'style changes expression instructions, not remembered facts');
    previousBody = body;
    assert.equal(service.renderLedger(chatId), rendered, 'repeated reads keep memory available');
    assert.equal(fs.readFileSync(filename, 'utf8'), saved, 'rendering never rewrites stored memory');
  }
  saveSettings({ chats: { [chatId]: { enabled: false } } });
  assert.equal(service.renderLedger(chatId), '', 'disabled room still injects nothing');
  saveSettings({ chats: { empty: { enabled: true } } });
  assert.equal(service.renderLedger('empty'), '', 'no instruction-only injection without memory');
});

