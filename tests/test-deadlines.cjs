// node --test tests/test-deadlines.cjs
// Deadlines kept apart (nearest first, shelved when long overdue and silent), story clock from trackers, weather.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-deadline-'));
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const { _test: T } = require('../memory-module/lib/service.cjs');

test('tracker dates and times in the forms people write them', () => {
  assert.deepEqual(L.parseClock('2024년 10월 18일 (금)'), { date: '2024-10-18', time: null });
  assert.deepEqual(L.parseClock('10월 20일 오후 3시 반', '2024-10-18'), { date: '2024-10-20', time: '15:30' });
  assert.deepEqual(L.parseClock('24.10.18 · 21:05'), { date: '2024-10-18', time: '21:05' });
  assert.deepEqual(L.parseClock('10/21 2:30 PM', '2024-10-18'), { date: '2024-10-21', time: '14:30' });
  assert.deepEqual(L.parseClock('새벽 2시'), { date: null, time: '02:00' });
  assert.equal(L.parseClock('3일차 저녁'), null, 'a day count is not a calendar date');
  assert.equal(L.parseClock('맑음'), null);
});

test('a message with no date line takes the story clock from its tracker, and the prompt shows it', () => {
  const [m] = L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: '도윤', content: '도윤이 창밖을 봤다.', clock: { date: '2024-10-18', time: '22:10' }, weather: '비' }]);
  assert.equal(L.storyDate([m]), '2024-10-18');
  assert.equal(L.storyTime([m]), '2024-10-18T22:10');
  assert.equal(L.clockNote(m), ' (작중 24-10-18 (금) 22:10 · 날씨: 비)');
  const [own] = L.prepareMessages([{ id: 'b', number: 2, content: '24-10-19 (토) | 09:00\n아침.', clock: { date: '2024-10-18', time: '22:10' } }]);
  assert.equal(L.storyDate([own]), '2024-10-19', 'a date line in the message wins');
});

test('the tracker snapshot of each message gives its clock and weather; messages between carry the last one', async () => {
  const snaps = new Map([
    ['m1', { date: '10월 18일', time: '오후 9시', weather: '비', worldCustomFields: '[]', playerStats: null }],
    ['m3', { date: null, time: null, weather: null, worldCustomFields: JSON.stringify([{ name: '날씨', value: '첫눈' }]), playerStats: JSON.stringify({ customTrackerFields: [{ name: '작중 날짜', value: '2024-10-20 07:30' }] }) }],
  ]);
  const e = { gameStates: { getCommittedForMessages: async () => snaps } };
  const msgs = [{ id: 'm1', content: 'a' }, { id: 'm2', content: 'b' }, { id: 'm3', content: 'c' }];
  await T.addTrackerClock(e, 'chat', msgs);
  assert.deepEqual(msgs.map((m) => [m.clock?.date, m.clock?.time, m.weather]), [
    [null, '21:00', '비'],
    [null, '21:00', '비'],
    ['2024-10-20', '07:30', '첫눈'],
  ]);
  const none = [{ id: 'x', content: 'a' }];
  await T.addTrackerClock({}, 'chat', none);
  assert.equal(none[0].clock, undefined, 'no trackers: order only');
});

function ledgerWith(threads, { storyDate = '2024-10-18', lastNumber = 100 } = {}) {
  const ledger = L.emptyLedger();
  ledger.storyDate = storyDate;
  ledger.lastNumber = lastNumber;
  ledger.threads = threads.map((t, i) => ({ id: `T${i + 1}`, status: 'open', who: '서아', toward: null, detail: null, evidence: [{ number: t.seen ?? 90 }], clues: [], ...t }));
  return ledger;
}

test('things with a date to meet come first, nearest first, even when not mentioned for long', () => {
  const recent = Array.from({ length: 9 }, (_, i) => ({ kind: 'promise', title: `잡담 약속 ${i + 1}`, seen: 95 }));
  const ledger = ledgerWith([...recent, { kind: 'pending', title: '장학금 서류 제출', due: { date: '2024-10-20', time: '12:00' }, seen: 5 }, { kind: 'promise', title: '도윤 생일 선물', due: { date: '2024-10-19', time: null }, seen: 6 }]);
  const lines = L.renderCompact(ledger).split('\n');
  assert.match(lines[0], /도윤 생일 선물.*약속한 때: .*내일/);
  assert.match(lines[1], /장학금 서류 제출.*기한: .*12:00, 2일 뒤/);
});

test('an overdue item nobody mentions for 50 messages is shelved, and comes back when the talk touches it', () => {
  const ledger = ledgerWith([
    { kind: 'pending', title: '장학금 서류 제출', due: { date: '2024-10-02', time: null }, seen: 20 },
    { kind: 'pending', title: '빌린 우산 돌려주기', due: { date: '2024-10-15', time: null }, seen: 90 },
  ]);
  const plain = L.renderCompact(ledger);
  assert.doesNotMatch(plain, /장학금/);
  assert.match(plain, /우산.*3일 지남/, 'overdue but still talked about: stays');
  assert.match(L.renderCompact(ledger, { query: '그 장학금 서류는 어떻게 됐어?' }), /장학금 서류 제출.*기한이 지나고 한동안 말이 없던 일/);
  assert.deepEqual(L.deadlineList(ledger).map((d) => [d.id, d.state, d.days]), [['T1', 'shelved', -16], ['T2', 'overdue', -3]]);
  // No story date at all: the order is kept, nothing is shelved.
  const undated = ledgerWith(ledger.threads, { storyDate: null });
  assert.match(L.renderCompact(undated), /장학금/);
  assert.equal(L.deadlineList(undated)[0].state, 'unknown');
});

test('chapter details with a date still ahead come before ones already past', () => {
  const store = S.emptyStore();
  store.chapters = Array.from({ length: 60 }, (_, i) => ({ id: `C${i + 1}`, title: `챕터 ${i + 1}`, summary: '여러 일이 있었다. '.repeat(10), turns: [], keep: [`${i + 1}번 일은 24-09-0${(i % 9) + 1}에 끝났다`], scenes: [] }));
  store.chapters[1].keep = ['전세 계약 잔금은 24-11-05까지 300만 원'];
  const text = S.renderChapters(store, 1200, '', '2024-10-18');
  assert.match(text, /C2 챕터 2\n {2}※ 전세 계약 잔금은 24-11-05까지 300만 원/);
});

test('a scene keeps the weather the text or the tracker gives, and shows it in its head line', () => {
  const msgs = L.prepareMessages([
    { id: 'w1', number: 1, role: 'user', speaker: '서아', content: '"우산 있어?"', weather: '비' },
    { id: 'w2', number: 2, role: 'assistant', speaker: '도윤', content: '도윤이 우산을 펼쳤다.', weather: '비' },
  ]);
  const r = S.applyScenes(S.emptyStore(), { scenes: [{ end: 2, title: '우산', summary: '같이 씀.', events: [{ text: '도윤이 우산을 펼침', quotes: [{ n: '2.1' }] }] }] }, msgs, 2);
  assert.ok(!r.error, r.error);
  assert.equal(r.scenes[0].weather, '비');
  assert.match(S.renderExpanded(r.scenes[0], 0), /^① 비 — 우산/);
  const told = S.applyScenes(S.emptyStore(), { scenes: [{ end: 2, weather: '첫눈', title: '우산', summary: '같이 씀.', events: [{ text: '도윤이 우산을 펼침', quotes: [{ n: '2.1' }] }] }] }, msgs, 2);
  assert.equal(told.scenes[0].weather, '첫눈', 'what the text says comes first');
  assert.match(S.buildScenePrompt ? JSON.stringify(S.buildScenePrompt(S.emptyStore(), msgs, 2)) : '날씨: 비', /날씨: 비/);
});

test('a date written in a message moves the story on; the next messages carry it, a lagging tracker does not pull it back', async () => {
  const snaps = new Map([
    ['d1', { date: '2024-10-18', time: '23:30', weather: '비', worldCustomFields: '[]', playerStats: null }],
    ['d4', { date: '2024-10-18', time: '23:50', weather: null, worldCustomFields: '[]', playerStats: null }],
  ]);
  const msgs = [
    { id: 'd1', content: '밤이 깊었다.' },
    { id: 'd2', content: '24-10-19 (토) | 09:00\n아침이 밝았다.' },
    { id: 'd3', content: '둘은 밥을 먹었다.' },
    { id: 'd4', content: '설거지를 했다.' },
  ];
  await T.addTrackerClock({ gameStates: { getCommittedForMessages: async () => snaps } }, 'chat', msgs);
  assert.deepEqual(msgs.map((m) => `${m.clock.date} ${m.clock.time}`), ['2024-10-18 23:30', '2024-10-19 09:00', '2024-10-19 09:00', '2024-10-19 09:00']);
});

test('the memory text and the deadline list count days from the same story date', () => {
  const ledger = ledgerWith([{ kind: 'pending', title: '서류 제출', due: { date: '2024-10-19', time: null } }], { storyDate: '2024-10-18' });
  T.storyDays.set('room', '2024-10-19');
  const today = T.storyToday('room', ledger);
  assert.equal(today, '2024-10-19', 'the chat already shows the next day while the ledger has not read it yet');
  assert.match(L.renderCompact(ledger, { today }), /기한: .*오늘/);
  assert.equal(L.deadlineList(ledger, today)[0].state, 'today');
  T.storyDays.set('room', '2024-10-01');
  assert.equal(T.storyToday('room', ledger), '2024-10-18', 'never earlier than what the ledger has read');
});

test('a hand fix of a tracker date or weather is a change to read again; older saves without it are left alone', () => {
  const [a, b] = L.prepareMessages([
    { id: 't1', number: 1, content: '같은 글.', trackerMark: ['2024-10-18', '21:00', '비'] },
    { id: 't2', number: 2, content: '같은 글.', trackerMark: ['2024-10-18', '21:00', '맑음'] },
  ]);
  assert.equal(a.h, b.h, 'the text fingerprint is unchanged');
  assert.notEqual(a.c, b.c);
  const store = S.emptyStore();
  store.covered = [{ id: 't1', h: a.h, c: a.c }];
  assert.equal(S.changedAt(store, [{ ...b, id: 't1' }]), 0);
  assert.equal(S.changedAt(store, [a]), -1);
  store.covered = [{ id: 't1', h: a.h }];
  assert.equal(S.changedAt(store, [{ ...b, id: 't1' }]), -1, 'saved before this version: no mass re-read');
  const ledger = L.emptyLedger();
  ledger.processed = [{ id: 't1', h: a.h, c: a.c }];
  assert.ok(L.trackerChanged(ledger.processed[0], b));
});

test('a date line in the user\'s own Korean format is the story date, and the next messages carry it', async () => {
  const snaps = new Map([['k1', { date: '2027-04-13', time: '23:00', weather: null, worldCustomFields: '[]', playerStats: null }]]);
  const msgs = [
    { id: 'k1', role: 'assistant', content: '밤이 깊었다.' },
    { id: 'k2', role: 'assistant', content: '2027년 4월 14일 수요일 | 10시 30분\n아침이 밝았다.' },
    { id: 'k3', role: 'user', content: '"2027년 4월 13일 화요일에 만났잖아." 서아가 웃었다.' },
  ];
  await T.addTrackerClock({ gameStates: { getCommittedForMessages: async () => snaps } }, 'chat', msgs);
  assert.deepEqual(msgs.map((m) => `${m.clock.date} ${m.clock.time}`), ['2027-04-13 23:00', '2027-04-14 10:30', '2027-04-14 10:30'], 'a past date said in dialogue is not a date line');
  assert.equal(L.storyDate([{ content: msgs[1].content }]), '2027-04-14');
  assert.equal(L.storyTime([{ content: msgs[1].content }]), '2027-04-14T10:30');
  assert.equal(L.dateInText('4월 14일 수요일에 보자.'), null);
});

test('a tracker record added later to a message that had none is a change to read again', async () => {
  const msgs = () => [{ id: 'n1', role: 'assistant', content: '글.' }, { id: 'n2', role: 'user', content: '답.' }, { id: 'n3', role: 'assistant', content: '새 답.' }];
  const before = msgs();
  await T.addTrackerClock({ gameStates: { getCommittedForMessages: async () => new Map() } }, 'chat', before);
  assert.deepEqual(before.map((m) => m.trackerMark), [['none'], undefined, undefined], 'only settled messages are marked "none"');
  const after = msgs();
  await T.addTrackerClock({ gameStates: { getCommittedForMessages: async () => new Map([['n1', { date: '2024-10-18', time: null, weather: '비', worldCustomFields: '[]', playerStats: null }]]) } }, 'chat', after);
  const [a] = L.prepareMessages([before[0]]);
  const [b] = L.prepareMessages([after[0]]);
  const store = S.emptyStore();
  store.covered = [{ id: 'n1', h: a.h, c: a.c }];
  assert.equal(S.changedAt(store, [b]), 0);
});
