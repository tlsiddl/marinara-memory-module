'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const r = (what, at, text = '') => ({ who: '이리나', what, at, text, number: 1 });

test('evening nap and final night are displayed separately', () => {
  const routine = [r('sleep','2025-11-16T18:15','식곤증에 잠듦'), r('wake','2025-11-16T20:30','깨어남'),
    r('sleep','2025-11-16T20:30','두어 시간 낮잠을 잤다'), r('sleep','2025-11-16T23:20','함께 잠듦'), r('wake','2025-11-17T08:00','깨어남')];
  const out = L.renderRoutine({ routine }, '2025-11-17T10:05');
  assert.match(out, /23:20에 잠들어 08:00에 깸\(8시간 40분 잠\)/);
  assert.match(out, /최근 24시간 낮잠 1회, 총 2시간 15분/);
});

test('multiple naps are added, with events more than 24 hours old excluded', () => {
  const routine = [r('sleep','2025-11-15T15:00','낮잠'),r('wake','2025-11-15T16:00'),
    r('sleep','2025-11-16T15:00','낮잠'),r('wake','2025-11-16T15:30'),
    r('sleep','2025-11-16T18:15','낮잠'),r('wake','2025-11-16T20:30')];
  const out = L.renderRoutine({routine}, '2025-11-17T10:05');
  assert.match(out, /최근 24시간 낮잠 2회, 총 2시간 45분/);
});

test('a sleep with activity during it or no waking is not counted as a complete nap', () => {
  const routine = [r('sleep','2025-11-16T15:00','낮잠'),r('meal','2025-11-16T16:00','밥'),r('wake','2025-11-16T17:00'),
    r('sleep','2025-11-16T18:00','낮잠')];
  const out = L.renderRoutine({routine}, '2025-11-16T19:00');
  assert.match(out, /낮잠: 시간 확인 가능한 기록 없음/);
  assert.doesNotMatch(out, /낮잠 2회/);
});

test('explicit morning nap is not presented as night sleep', () => {
  const routine = [r('sleep','2025-11-17T09:00','낮잠'), r('wake','2025-11-17T09:30')];
  const out = L.renderRoutine({routine}, '2025-11-17T10:05');
  assert.match(out, /최근 24시간 낮잠 1회, 총 30분/);
  assert.doesNotMatch(out, /밤잠/);
});

test('completed previous days include the naps in each waking-to-waking period', () => {
  const routine = [
    r('sleep','2025-11-14T23:00'), r('wake','2025-11-15T08:00'),
    r('meal','2025-11-15T12:00','밥'),
    r('sleep','2025-11-15T15:00','낮잠'), r('wake','2025-11-15T15:30'),
    r('sleep','2025-11-15T18:00','낮잠'), r('wake','2025-11-15T19:00'),
    r('sleep','2025-11-15T22:10'), r('wake','2025-11-16T08:00'),
    r('sleep','2025-11-16T18:15','낮잠'), r('wake','2025-11-16T20:30'),
    r('sleep','2025-11-16T23:20'), r('wake','2025-11-17T08:00'),
  ];
  const out = L.renderRoutine({routine}, '2025-11-17T10:05');
  assert.match(out, /25-11-16 \(일\): 0끼, 낮잠 1회, 총 2시간 15분, 그 뒤 밤잠 8시간 40분/);
  assert.match(out, /25-11-15 \(토\): 1끼, 낮잠 2회, 총 1시간 30분, 그 뒤 밤잠 9시간 50분/);
});
