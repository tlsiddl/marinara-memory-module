// node --test tests/test-english-feelings.cjs
// Memory written in English: two different feelings between the same two people stay apart, and the same feeling
// written twice is still folded into one. (Invented names and story.)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

const rows = [
  { id: 'm1', number: 1, speaker: 'Daniel', content: 'She sold the forged ledger and disappeared. He touched the scar on his wrist.' },
  { id: 'm2', number: 2, speaker: 'Sera', content: 'She looked right at him and asked who he was. He had not slept in three days.' },
];

function open(items) {
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: items }, L.prepareMessages(rows));
  return ledger;
}

test('english: a feeling with a different cause is not merged into another one between the same people', () => {
  const ledger = open([
    { kind: 'emotion', who: 'Daniel', toward: 'Sera', title: "Daniel's anger over the forged ledger",
      cause: 'Sera sold him a forged ledger at the harbor market and then disappeared.',
      need: 'To have her found and made to pay for the forgery.', evidence: ['1.1'] },
    { kind: 'emotion', who: 'Daniel', toward: 'Sera', title: "Daniel's humiliation at being forgotten",
      cause: 'Sera failed to recognize him and asked her friend whether he was an acquaintance.',
      need: 'For Sera to acknowledge him and admit she remembers that night at the harbor.', evidence: ['2.1'] },
  ]);
  L.applyTidy(ledger, { close: [], merge: [] });
  assert.deepEqual(ledger.threads.map((t) => t.status), ['open', 'open']);
});

test('english: the same feeling written twice is still merged', () => {
  const ledger = open([
    { kind: 'emotion', who: 'Daniel', toward: 'Sera', title: 'Hurt at being left',
      cause: 'Sera left without saying goodbye after the festival.', need: 'For Sera to explain why she left.', evidence: ['1.1'] },
    { kind: 'emotion', who: 'Daniel', toward: 'Sera', title: 'Abandonment',
      cause: 'Sera vanished after the festival without a goodbye.', need: 'For Sera to explain why she disappeared and left him.', evidence: ['2.1'] },
  ]);
  // Folded as soon as the second one is opened.
  assert.deepEqual(ledger.threads.map((t) => t.status), ['open', 'closed']);
  assert.equal(ledger.threads[1].mergedInto, 'T1');
});

test('korean feelings keep the letter-pair comparison', () => {
  const ledger = open([
    { kind: 'emotion', who: '다니엘', toward: '세라', title: '서운함', cause: '세라가 축제가 끝나고 인사도 없이 떠남', need: '세라가 왜 떠났는지 설명하는 것', evidence: ['1.1'] },
    { kind: 'emotion', who: '다니엘', toward: '세라', title: '버려진 느낌', cause: '축제가 끝나고 세라가 인사도 없이 떠나 버림', need: '세라가 떠난 이유를 설명하는 것', evidence: ['2.1'] },
  ]);
  assert.equal(ledger.threads[1].mergedInto, 'T1');
});
