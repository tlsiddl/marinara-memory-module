// node --test tests/test-attribution-log.cjs
// The dialogue check record survives later runs and a restart; model failures and hand edits keep stored values.
// Invented names and lines only.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-attr-log-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const S = require('../memory-module/lib/scenes.cjs');
const servicePath = require.resolve('../memory-module/lib/service.cjs');
let X = require(servicePath)._test;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const CHAT = 'room-attr';
const SECRET = '"Signora Bel Caro, mi perdoni! La sala è chiusa."';
function setUp() {
  const apology = { number: 1, sentence: 2, messageId: 'm1', text: SECRET, by: '도라 벨 카로', to: '파비오', attributionChecked: 7 };
  const steady = { number: 1, sentence: 4, messageId: 'm1', text: '"Va bene."', by: '도라 벨 카로', to: '파비오', attributionChecked: 7 };
  const store = { ...S.emptyStore(), personas: ['도라 벨 카로'], scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '사과', quotes: [apology, steady] }], present: ['도라 벨 카로', '파비오'] }] };
  X.saveScenes(CHAT, store);
  const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: ['직원 파비오가 달려왔다.', SECRET, '파비오가 고개를 숙였다.', '"Va bene."', '도라가 짧게 대답했다.'] }];
  return { store: X.loadScenes(CHAT), apology, steady, messages };
}
const model = (reply) => async () => ({ provider: { chatComplete: async (prompt) => ({ content: JSON.stringify(await reply(prompt)) }) } });

test('a reversed answer is rejected, asked a second time, and the record is kept on disk without line text', async () => {
  const { store, apology, steady, messages } = setUp();
  const asked = [];
  const job = { cancel: false };
  const calls = await X.reviewAttributions(CHAT, store, messages, model((prompt) => {
    const items = JSON.parse(prompt[1].content).items;
    asked.push(items.map((x) => x.notSpeaker || null));
    const id = items.find((x) => x.quote === SECRET)?.id;
    if (/notSpeaker에 있는 사람은/.test(prompt[0].content)) return { items: [{ id, by: '파비오', to: ['도라 벨 카로'], byEvidence: '파비오가 고개를 숙였다.', toEvidence: SECRET }] };
    return { items: [{ id, by: '도라 벨 카로', to: ['파비오'], byEvidence: '파비오가 고개를 숙였다.', toEvidence: '' }] };
  }), job, 'auto');
  // One question for the group, and a second one only for the lines whose first answer needed it.
  assert.equal(calls, 2);
  assert.deepEqual(asked[1], [['도라 벨 카로'], null]);
  assert.equal(apology.by, '파비오'); assert.equal(apology.to, '도라 벨 카로');
  assert.equal(steady.by, '도라 벨 카로', 'an unanswered line keeps its value');
  const file = path.join(dir, 'memory-module', 'chats', `${CHAT}.attribution-log.json`);
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(!raw.includes('perdoni') && !raw.includes('고개를'), 'no line or evidence text on disk');
  const run = X.loadAttributionLog(CHAT).runs[0];
  const entry = run.entries.find((e) => e.sentence === 2 && e.source !== 'rule');
  assert.equal(entry.first.by, '도라 벨 카로'); assert.equal(entry.first.byReason, 'vocative');
  assert.equal(entry.second.by, '파비오'); assert.equal(entry.asked, 2); assert.equal(entry.decision, 'applied'); assert.equal(entry.after.by, '파비오');

  // A later automatic run with nothing to check does not push the record out.
  await X.reviewAttributions(CHAT, store, messages, model(() => assert.fail('no call expected')), { cancel: false }, 'auto');
  assert.equal(X.loadAttributionLog(CHAT).runs.length, 1);

  // After a restart (a fresh module) the record is still there.
  delete require.cache[servicePath];
  X = require(servicePath)._test;
  assert.equal(X.loadAttributionLog(CHAT).runs[0].entries.find((e) => e.sentence === 2 && e.source !== 'rule').after.by, '파비오');
});

test('a failing model keeps stored values that break no rule and is recorded', async () => {
  const { store, steady, messages } = setUp();
  await X.reviewAttributions(CHAT, store, messages, async () => ({ provider: { chatComplete: async () => { throw Error('connection refused'); } } }), { cancel: false }, 'resume');
  assert.equal(steady.by, '도라 벨 카로'); assert.equal(steady.to, '파비오');
  const run = X.loadAttributionLog(CHAT).runs[0];
  assert.ok(run.notes.some((n) => /모델 오류: connection refused/.test(n)));
  // The deterministic rules still ran: the speaker the line calls by name is removed.
  // A bow is not a speech cue, so no speaker is guessed: the line is left blank rather than reversed.
  assert.equal(store.scenes[0].events[0].quotes[0].by, null);
  assert.equal(X.loadScenes(CHAT).scenes[0].events[0].quotes[0].by, null);
});

test('a hand edit saved while the model is asked is not overwritten', async () => {
  const { store, messages } = setUp();
  await X.reviewAttributions(CHAT, store, messages, model((prompt) => {
    // The user's edit lands while the model is thinking (as the edit route would save it).
    const edited = structuredClone(X.loadScenes(CHAT));
    edited.scenes[0].events[0].quotes[1] = { ...edited.scenes[0].events[0].quotes[1], by: '파비오', to: '도라 벨 카로', manual: true };
    edited.scenes[0].edited = true;
    X.saveScenes(CHAT, edited);
    const items = JSON.parse(prompt[1].content);
    return { items: items.map((x) => ({ id: x.id, by: '도라 벨 카로', to: [], byEvidence: '도라가 짧게 대답했다.' })) };
  }), { cancel: false }, 'resume');
  const saved = X.loadScenes(CHAT).scenes[0].events[0].quotes[1];
  assert.equal(saved.by, '파비오'); assert.equal(saved.manual, true);
  assert.ok(X.loadAttributionLog(CHAT).runs[0].notes.some((n) => /확인 중 장면이 바뀌어/.test(n)));
});
