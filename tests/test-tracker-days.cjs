'use strict';
// A tracker whose date is not a calendar date ("Day 3", "토요일", "봄, 매의 날") moves the story's day on instead
// of every later message carrying the first date. (Invented story.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-tracker-days-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const T = service._test;

// messages: [content, trackerDate, trackerTime]
async function run(rows) {
  const messages = rows.map(([content, date, time], i) => ({ id: `m${i}`, role: i % 2 ? 'user' : 'assistant', content, swipe: 0, _t: date || time ? { date: date || null, time: time || null } : null }));
  const e = { gameStates: { async getCommittedForMessages(_c, list) { return new Map(list.map(({ id }) => [id, messages.find((m) => m.id === id)._t]).filter(([, r]) => r)); } } };
  await T.addTrackerClock(e, 'room', messages);
  return messages;
}
const days = (ms) => ms.map((m) => m.clock?.date || m.clock?.label || null);

test('day counters move on from the first known date', async () => {
  const ms = await run([
    ['📅 2024년 3월 1일 (금)\n하루가 시작됐다.'],
    ['안녕', 'Day 1', '09:00'],
    ['응', 'Day 1', '18:00'],
    ['다음 날', 'Day 2', '08:00'],
    ['또 다음 날', 'Day 4', '10:00'],
  ]);
  assert.deepEqual(days(ms), ['2024-03-01', '2024-03-01', '2024-03-01', '2024-03-02', '2024-03-04']);
  assert.match(L.clockNote(ms[4]), /작중 24-03-04 \(월\) 10:00/);
});

test('Korean counters and weekdays', async () => {
  assert.deepEqual(days(await run([['[2024.03.01 (금) 09:00]'], ['', '1일차'], ['', '3일째']])), ['2024-03-01', '2024-03-01', '2024-03-03']);
  assert.deepEqual(days(await run([['[2024.03.01 (금) 09:00]'], ['', 'Friday'], ['', 'Saturday', '07:00'], ['', '월요일']])), ['2024-03-01', '2024-03-01', '2024-03-02', '2024-03-04']);
});

test('words that name no countable day are passed on as they are, not as the first date', async () => {
  const ms = await run([['[2024.03.01 (금) 09:00]'], ['', 'Spring, Hawk Day', '09:00'], ['', 'Spring, Owl Day', '20:00']]);
  assert.deepEqual(days(ms), ['2024-03-01', 'Spring, Hawk Day', 'Spring, Owl Day']);
  assert.match(L.clockNote(ms[2]), /작중 Spring, Owl Day 20:00/);
});

test('no calendar date anywhere: the counter is shown in its own words', async () => {
  const ms = await run([['시작'], ['', 'Day 3', '14:00']]);
  assert.match(L.clockNote(ms[1]), /작중 Day 3 14:00/);
});

test('calendar dates written in more ways are read', () => {
  assert.equal(L.parseClock('the 2nd of March, 2024')?.date, '2024-03-02');
  assert.equal(L.parseClock('March the 2nd, 2024')?.date, '2024-03-02');
  assert.equal(L.parseClock('2024年3月2日')?.date, '2024-03-02');
  assert.equal(L.dayCounter('Day 12 of the voyage'), 12);
  assert.equal(L.dayCounter('D+5'), 5);
  assert.equal(L.dayCounter('봄 3일'), null);
  assert.equal(L.weekdayOf('Saturday evening'), 6);
});

test('a tracker date that parses still wins, and a lagging one is not followed back', async () => {
  assert.deepEqual(days(await run([['[2024.03.01 (금) 09:00]'], ['', '2024-03-03', '10:00'], ['', '2024-03-02', '09:00']])), ['2024-03-01', '2024-03-03', '2024-03-03']);
});

test('a wrong start the tracker puts right (or a story that goes back) is followed, not held for good', async () => {
  // The tracker first took a wrong year, then put it right: every later message used to carry the wrong day.
  assert.deepEqual(days(await run([['시작', '2026-11-21', '09:00'], ['', '2024-03-01', '09:30'], ['', '2024-03-02', '08:00']])), ['2026-11-21', '2024-03-01', '2024-03-02']);
  // Still the night before for one message after the text moved on: not followed.
  assert.deepEqual(days(await run([['[2024.03.02 (토) 00:10]'], ['', '2024-03-01', '23:50'], ['', '2024-03-02', '00:30']])), ['2024-03-02', '2024-03-02', '2024-03-02']);
  // One day back, twice in a row: the story is there.
  assert.deepEqual(days(await run([['[2024.03.02 (토) 09:00]'], ['', '2024-03-01', '09:00'], ['', '2024-03-01', '10:00']])), ['2024-03-02', '2024-03-02', '2024-03-01']);
  // The ledger's story day is the last one shown, not the latest.
  assert.equal(L.storyDate([{ content: '', clock: { date: '2026-11-21' } }, { content: '', clock: { date: '2024-03-01' } }]), '2024-03-01');
});
