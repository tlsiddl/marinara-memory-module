'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const r = (what, at, text = '') => ({ who: '이리나', what, at, text, number: 1 });

test('sleep entry coincident with nap waking is not reused as the next bedtime', () => {
  const routine = [
    r('meal','2025-11-16T18:15','파스타'), r('sleep','2025-11-16T18:15','식곤증에 잠듦'),
    r('sleep','2025-11-16T20:30','두어 시간 낮잠'), r('wake','2025-11-16T20:30','깨어남'),
    r('sleep','2025-11-16T23:20','셋이 함께 잠이 듦'), r('wake','2025-11-17T08:00','깨어남'),
    r('wash','2025-11-17T08:20','샤워하고 외출 준비'), r('wash','2025-11-17T08:40','화장과 마스카라·립 마무리'),
  ];
  const before = JSON.stringify(routine);
  const out = L.renderRoutine({ routine }, '2025-11-17T10:05');
  assert.match(out, /23:20에 잠들어 08:00에 깸\(8시간 40분 잠\)/);
  assert.doesNotMatch(out, /20:30에 잠들어 08:00/);
  assert.match(out, /씻기 마지막 08:20 샤워하고 외출 준비/);
  assert.match(out, /꾸밈 마지막 08:40 화장과 마스카라·립 마무리/);
  assert.equal(L.routineDisplayKind(routine.at(-1)), 'groom');
  assert.equal(L.routineDisplayKind(routine.at(-2)), 'wash');
  assert.equal(JSON.stringify(routine), before);
});

test('new grooming records and completed outing prep remain distinct and editable', () => {
  const ledger = { routine: [] };
  L.editRoutine(ledger, { action: 'add', item: { who: '이리나', what: 'wash', at: '2025-11-17T08:20', text: '외출 준비' } });
  L.editRoutine(ledger, { action: 'add', item: { who: '이리나', what: 'groom', at: '2025-11-17T08:40', text: '립스틱' } });
  const out = L.renderRoutine(ledger, '2025-11-17T10:05');
  assert.match(out, /씻기 마지막 08:20 외출 준비/);
  assert.match(out, /꾸밈 마지막 08:40 립스틱/);
});

test('a shower and makeup in one old wash record can indicate both', () => {
  const out = L.renderRoutine({ routine: [r('wash','2025-11-17T08:20','샤워하고 화장')] }, '2025-11-17T10:05');
  assert.match(out, /씻기 마지막 08:20 샤워하고 화장/);
  assert.match(out, /꾸밈 마지막 08:20 샤워하고 화장/);
});
