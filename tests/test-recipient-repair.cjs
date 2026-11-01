'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

test('recipient repair uses source context, known names, and preserves existing targets', () => {
  const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'assistant', content: '카시안이 이리나를 바라봤다.\n"Wait, sweetheart." (잠깐만, 여보.)' }]);
  const q = { messageId: 'm1', number: 1, sentence: 2, text: '"Wait, sweetheart." (잠깐만, 여보.)', by: '카시안', to: null };
  const scene = { present: ['카시안', '이리나', '킬리안'], recollections: [], events: [{ quotes: [q] }] };
  const candidates = S.recipientCandidates({ scenes: [scene], personas: ['이리나'] }, messages);
  assert.equal(candidates.length, 1);
  assert.equal(S.applyRecipientResults(candidates, [{ id: '0', to: '잘못된 이름', evidence: '이리나를 바라봤다' }]), 0);
  assert.equal(q.to, null);
  delete q.recipientChecked;
  assert.equal(S.applyRecipientResults(candidates, [{ id: '0', to: '이리나', evidence: '이리나를 바라봤다' }]), 1);
  assert.equal(q.to, '이리나');
  assert.match(S.quoteLine(q), /^카시안 → 이리나:/);
  assert.equal(S.recipientCandidates({ scenes: [scene] }, messages).length, 0);
});

test('same-date wake cycles appear on one date and preserve uncertain sleep', () => {
  const r = (what, at) => ({ who: '이리나', what, at, text: what, number: 1 });
  const routine = [r('wake','2025-11-15T08:00'), r('meal','2025-11-15T09:00'), r('wake','2025-11-15T12:00'),
    r('meal','2025-11-15T13:00'), r('sleep','2025-11-15T22:00'), r('wake','2025-11-16T08:00'),
    r('sleep','2025-11-16T20:30'), r('wake','2025-11-17T08:00')];
  const out = L.renderRoutine({ routine }, '2025-11-17T10:05');
  assert.equal((out.match(/25-11-15 \(토\):/g) || []).length, 1, out);
  assert.match(out, /25-11-15 \(토\): 2끼/);
  assert.match(out, /시간 모름/);
});
