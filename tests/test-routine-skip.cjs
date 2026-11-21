'use strict';
// A story that skips days or months: daily life does not say the person has not eaten (or has slept) all that time.
// (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

const ledger = { routine: [
  { who: '나리', what: 'meal', text: '국밥', at: '2024-03-01T12:00' },
  { who: '나리', what: 'sleep', text: '', at: '2024-03-01T23:00' },
  { who: '도겸', what: 'meal', text: '빵', at: '2024-05-10T08:00' },
] };

test('after a skip, old records are not counted from', () => {
  const text = L.renderRoutine(ledger, '2024-05-10T12:00');
  assert.match(text, /나리: 24-03-01 \(금\) 23:00 이후 기록 없음/);
  assert.doesNotMatch(text, /자는 중|일 전|일째/);
  assert.match(text, /도겸: 식사/, 'a person with fresh records is counted as before');
});

test('within a day, the usual counting', () => {
  const text = L.renderRoutine(ledger, '2024-03-02T08:00');
  assert.match(text, /나리: .*자는 중/);
});
