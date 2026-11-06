// node --test tests/test-attribution-own-writes.cjs
// The check's own writes (the rule step, lines it settles) are not edits by someone else: model answers for the
// same scene are still saved. A real outside edit made during the check still stops the save. Invented names only.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-attr-own-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const S = require('../memory-module/lib/scenes.cjs');
const X = require('../memory-module/lib/service.cjs')._test;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const PERSONA = '하담';
const model = (reply) => async () => ({ provider: { chatComplete: async (prompt) => ({ content: JSON.stringify(await reply(JSON.parse(prompt[1].content), prompt[0].content)) }) } });

const SETTLED = '"Tommaso, vieni qui."';
const APOLOGY = '"Signor Rossi, mi perdoni!"';
const sentences = [
  `${PERSONA} | ${SETTLED}`, '그는 걸음을 멈췄다.', APOLOGY, '홀 안이 조용해졌다.', 'Tommaso lowered his head.',
];
const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences }];
const setUp = (chat) => {
  const first = { number: 1, sentence: 1, messageId: 'm1', text: SETTLED, by: PERSONA, to: 'Tommaso' };
  const apology = { number: 1, sentence: 3, messageId: 'm1', text: APOLOGY, by: null, to: null };
  const store = { ...S.emptyStore(), personas: [PERSONA], cast: ['Tommaso', 'Rossi'], scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '사과', quotes: [first, apology] }], present: [PERSONA, 'Tommaso', 'Rossi'] }] };
  X.saveScenes(chat, store);
  return X.loadScenes(chat);
};
const answer = (input) => ({ items: input.items.map((x) => ({ id: x.id, by: 'Tommaso', to: ['Rossi'], byEvidence: 'Tommaso lowered his head.', toEvidence: APOLOGY })) });

test('the rule step and settled lines saved first do not make the model answers look like someone else\'s edit', async () => {
  const live = setUp('room-own');
  const [settled, apology] = live.scenes[0].events[0].quotes;
  await X.reviewAttributions('room-own', live, messages, model(answer), { cancel: false }, 'resume');
  const saved = X.loadScenes('room-own').scenes[0].events[0].quotes;
  assert.equal(saved[1].to, 'Rossi', 'the rule step filled the listener');
  assert.equal(saved[1].by, 'Tommaso', 'and the model speaker was kept, not discarded');
  assert.ok(settled.attributionFp, 'the settled line was recorded as checked');
  const run = X.loadAttributionLog('room-own').runs[0];
  assert.ok(!run.notes.some((n) => /확인 중 장면이 바뀌어/.test(n)));
  assert.ok(!run.entries.some((e) => e.rule === 'changed-during-check'));
  assert.equal(apology.by, 'Tommaso');
});

test('an edit made by someone else during the check still stops the save', async () => {
  const live = setUp('room-outside');
  await X.reviewAttributions('room-outside', live, messages, model(async (input) => {
    const edited = structuredClone(X.loadScenes('room-outside'));
    edited.scenes[0].events[0].quotes[0] = { ...edited.scenes[0].events[0].quotes[0], by: 'Rossi', to: PERSONA, manual: true };
    X.saveScenes('room-outside', edited);
    return answer(input);
  }), { cancel: false }, 'resume');
  const saved = X.loadScenes('room-outside').scenes[0].events[0].quotes;
  assert.equal(saved[0].manual, true);
  assert.equal(saved[0].by, 'Rossi');
  assert.equal(saved[1].by, null, 'the answer was not saved over the edit');
  assert.ok(X.loadAttributionLog('room-outside').runs[0].notes.some((n) => /확인 중 장면이 바뀌어/.test(n)));
});
