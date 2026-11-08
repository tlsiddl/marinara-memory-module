'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const now = '2025-11-17T10:05';
const make = (texts) => ({ routine: [
  { who: '세레나', what: 'wake', at: '2025-11-17T08:00' },
  ...texts.map((text, i) => ({ who: '세레나', what: 'meal', text, at: `2025-11-17T08:${20 + i * 5}`, number: i + 1 })),
] });

test('model groups synonyms within one meal and keeps distinct foods and original records', () => {
  const ledger = make(['계란 프라이와 토스트', '달걀 프라이와 사과 주스']);
  const before = JSON.stringify(ledger.routine);
  const [candidate] = L.pendingMealDisplays(ledger);
  assert.deepEqual(candidate.parts, ['계란 프라이', '토스트', '달걀 프라이', '사과 주스']);
  assert.equal(L.applyMealDisplays(ledger, [candidate], [{ key: candidate.key, groups: [
    { parts: [0, 2], label: 2 }, { parts: [1], label: 1 }, { parts: [3], label: 3 },
  ] }]), 1);
  assert.match(L.renderRoutine(ledger, now), /1끼\(08:20 달걀 프라이, 토스트, 사과 주스\)/);
  assert.equal(JSON.stringify(ledger.routine), before);
  assert.equal(L.pendingMealDisplays(ledger).length, 0);
});

test('invalid, missing, repeated or invented references cannot hide a food', () => {
  const ledger = make(['계란 프라이와 토스트', '달걀 프라이']);
  const [c] = L.pendingMealDisplays(ledger);
  for (const groups of [
    [{ parts: [0, 2], label: 0 }],
    [{ parts: [0, 1], label: 2 }, { parts: [2], label: 2 }],
    [{ parts: [0, 1], label: 0 }, { parts: [1, 2], label: 2 }],
    [{ parts: [0, 1, 5], label: 0 }, { parts: [2], label: 2 }],
  ]) assert.equal(L.applyMealDisplays(ledger, [c], [{ key: c.key, groups }]), 0);
  assert.match(L.renderRoutine(ledger, now), /토스트/);
});

test('editing or rolling back invalidates the derived grouping without changing the original records', () => {
  const ledger = make(['계란 프라이와 토스트', '달걀 프라이']);
  const [c] = L.pendingMealDisplays(ledger);
  L.applyMealDisplays(ledger, [c], [{ key: c.key, groups: [{ parts: [0, 2], label: 0 }, { parts: [1], label: 1 }] }]);
  ledger.routine[2].text = '달걀 프라이와 샐러드';
  const [next] = L.pendingMealDisplays(ledger);
  assert.notEqual(next.key, c.key);
  assert.match(L.renderRoutine(ledger, now), /샐러드/);
});

test('uncertain different dishes remain independent when model puts them in separate groups', () => {
  const ledger = make(['치즈 피자와 토마토 피자']);
  const [c] = L.pendingMealDisplays(ledger);
  L.applyMealDisplays(ledger, [c], [{ key: c.key, groups: [{ parts: [0], label: 0 }, { parts: [1], label: 1 }] }]);
  assert.match(L.renderRoutine(ledger, now), /치즈 피자, 토마토 피자/);
});
