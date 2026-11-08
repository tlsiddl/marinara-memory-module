'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

test('recipient repair uses source context, known names, and preserves existing targets', () => {
  const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'assistant', content: '아르민이 세레나를 바라봤다.\n"Wait, sweetheart." (잠깐만, 여보.)' }]);
  const q = { messageId: 'm1', number: 1, sentence: 2, text: '"Wait, sweetheart." (잠깐만, 여보.)', by: '아르민', to: null };
  const scene = { present: ['아르민', '세레나', '오웬'], recollections: [], events: [{ quotes: [q] }] };
  const candidates = S.recipientCandidates({ scenes: [scene], personas: ['세레나'] }, messages);
  assert.equal(candidates.length, 1);
  assert.equal(S.applyRecipientResults(candidates, [{ id: '0', to: '잘못된 이름', evidence: '세레나를 바라봤다' }]), 0);
  assert.equal(q.to, null);
  delete q.recipientChecked;
  assert.equal(S.applyRecipientResults(candidates, [{ id: '0', to: '세레나', evidence: '세레나를 바라봤다' }]), 1);
  assert.equal(q.to, '세레나');
  assert.match(S.quoteLine(q), /^아르민 → 세레나:/);
  assert.equal(S.recipientCandidates({ scenes: [scene] }, messages).length, 0);
});

test('same-date wake cycles show one date without an extra unknown next to known sleep', () => {
  const r = (what, at) => ({ who: '세레나', what, at, text: what, number: 1 });
  const routine = [r('wake','2025-11-15T08:00'), r('meal','2025-11-15T09:00'), r('wake','2025-11-15T12:00'),
    r('meal','2025-11-15T13:00'), r('sleep','2025-11-15T22:10'), r('wake','2025-11-16T08:00'),
    r('sleep','2025-11-16T20:30'), r('wake','2025-11-17T08:00')];
  const out = L.renderRoutine({ routine }, '2025-11-17T10:05');
  assert.equal((out.match(/25-11-15 \(토\):/g) || []).length, 1, out);
  assert.match(out, /25-11-15 \(토\): 2끼/);
  assert.match(out, /25-11-15 \(토\): 2끼, 낮잠 시간 확인 가능한 기록 없음, 그 뒤 밤잠 9시간 50분/);
  assert.doesNotMatch(out, /다른 수면 기록 시간 모름/);
});
