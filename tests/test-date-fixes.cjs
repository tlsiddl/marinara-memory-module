'use strict';
// 작중 날짜 바로잡기: a date set by hand from a message on, reading dates from the text or not, and the scenes the
// change puts right at once. (Invented story.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-date-fixes-'));
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const T = service._test;
T.chatMessages = service.chatMessages;

const rows = [
  { id: 'a1', rowid: 1, role: 'assistant', content: '[RP|2024.03.01 (금)|09:00|여관] 아침이다.' },
  { id: 'u2', rowid: 2, role: 'user', content: '나간다.' },
  { id: 'a3', rowid: 3, role: 'assistant', content: '[여름|3/10|기분 좋음] 길을 걷는다.' },
  { id: 'u4', rowid: 4, role: 'user', content: '쉰다.' },
];
const tracker = new Map([['a3', { date: null, time: '15:00' }]]);
T.setEngine({
  chats: { async listMessages() { return rows; }, async getById(id) { return { id, metadata: {} }; } },
  characters: { async getById() { return null; } },
  gameStates: { async getCommittedForMessages(_c, list) { return new Map(list.map(({ id }) => [id, tracker.get(id)]).filter(([, r]) => r)); } },
  connections: { async list() { return []; } },
});
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
service.attach(app);
const post = async (id, body) => {
  let error = null;
  const out = await handlers['POST /chats/:id/dates']({ params: { id }, body }, { status() { return { send(x) { error = x.error; return x; } }; } });
  return error ? { error } : out;
};

test('a status line\'s "3/10" alone is not read as a day', async () => {
  const ms = await T.chatMessages('d1');
  assert.deepEqual(ms.map((m) => m.clock?.date || null), ['2024-03-01', '2024-03-01', '2024-03-01', '2024-03-01']);
});

test('a date set by hand holds from that message on, and puts right the scenes it changed', async () => {
  const store = S.emptyStore();
  store.scenes = [
    { id: 'S1', messages: [{ id: 'a1' }, { id: 'u2' }], time: '24-03-01 (금) 09:00', title: '아침', events: [] },
    { id: 'S2', messages: [{ id: 'a3' }, { id: 'u4' }], time: '24-03-01 (금) 15:00', title: '길', events: [] },
  ];
  T.saveScenes('d1', store);
  const out = await post('d1', { action: 'add', number: 3, date: '2024-03-04', time: '' });
  assert.ifError(out.error);
  assert.equal(out.redated, 1);
  assert.equal(T.loadScenes('d1').scenes[0].time, '24-03-01 (금) 09:00');
  assert.equal(T.loadScenes('d1').scenes[1].time, '24-03-04 (월) 15:00');
  const ms = await T.chatMessages('d1');
  assert.deepEqual(ms.map((m) => m.clock?.date), ['2024-03-01', '2024-03-01', '2024-03-04', '2024-03-04']);
  assert.match(L.clockNote(ms.find((m) => m.id === 'a3')), /작중 24-03-04 \(월\) 15:00/);
  assert.equal(out.dates.fixes.length, 1);
  // Taken back: the day goes back, and so do the scenes.
  const back = await post('d1', { action: 'remove', id: out.dates.fixes[0].id });
  assert.equal(back.redated, 1);
  assert.equal(T.loadScenes('d1').scenes[1].time, '24-03-01 (금) 15:00');
  assert.equal((await post('d1', { action: 'add', date: '3/4' })).error, '날짜를 2024-03-01처럼 적어 주세요(연도·월·일).');
});

test('a room can read dates from the tracker and hand fixes only', async () => {
  assert.ifError((await post('d2', { fromText: false })).error);
  const ms = await T.chatMessages('d2');
  assert.deepEqual(ms.map((m) => m.clock?.date || null), [null, null, null, null], 'the status line\'s date is not read');
  assert.equal(L.storyDate(ms), null);
  await post('d2', { fromText: true });
  assert.equal((await T.chatMessages('d2'))[0].clock?.date, '2024-03-01');
});

test('numbers in a status line are not days: four digits, scores, or eight digits under an amount\'s label', () => {
  for (const x of ['3000', '💰 3000', '[골드|3000]', '[골드|3000|체력|1200]', 'HP 3000/5000', '[RP|3000|카페]', '[3000|19:35|카페]', '[서아|3/10|기분 좋음]', '[금화|20241018]', '💰 12345678']) {
    assert.equal(L.dateInText(x, '2024-01-01'), null, x);
  }
  for (const [x, day] of [['[20241018|19:25]', '2024-10-18'], ['[RP|20241018|카페]', '2024-10-18'], ['[날짜|20241018]', '2024-10-18'], ['[금화|20241018|19:00]', '2024-10-18'], ['[3000.12.25|19:00]', '3000-12-25'], ['[RP|3월 10일|카페]', '2024-03-10']]) {
    assert.equal(L.dateInText(x, '2024-01-01')?.date, day, x);
  }
});
