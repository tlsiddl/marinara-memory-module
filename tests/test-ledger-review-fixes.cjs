'use strict';
// Ledger fixes: the recalled "그 뒤" lines say who does not know; the scene id at the end of a closing reason is
// stripped exactly; OOC tidying leaves hand-fixed items alone and keeps what a secret was; "done" words count only in the
// latest news. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

const base = (o) => ({ id: 'T1', kind: 'promise', status: 'open', title: 'Show the map', detail: '', evidence: [{ messageId: 'm1', number: 3 }], clues: [], openedAt: { number: 3 }, ...o });
const scene = { id: 'S1', start: 1, end: 5 };

test('afterLines: an open item shows who does not know; a closed reason loses a trailing (S10) exactly', () => {
  const ledger = { threads: [
    base({ id: 'T1', kind: 'secret', title: 'The hidden key', latest: { text: 'Daniel still keeps it', number: 9 }, unaware: ['Sera'], guess: ['Mina'] }),
    base({ id: 'T2', title: 'Watch the film', status: 'closed', closed: { how: 'They watched it (S10)', at: { number: 20 } } }),
    base({ id: 'T3', title: 'Pay back', status: 'closed', closed: { how: 'Paid in full (s) (S2) ', at: { number: 2 } } }),
  ] };
  const sceneAt = (n) => (n === 20 ? 'S10' : n === 2 ? 'S1' : null);
  const lines = L.afterLines(ledger, scene, sceneAt);
  assert.match(lines[0], /→ 지금: The hidden key — Daniel still keeps it.*\| 모름: Sera \| 짐작만: Mina/);
  assert.equal(lines[1], '→ 그 뒤: Watch the film — They watched it (S10)', 'one scene id, from where()');
  assert.equal(lines[2], '→ 그 뒤: Pay back — Paid in full (s)', 'only the trailing scene id goes, other text stays');
});

test('tidyOocThreads: leaves edited and hand-reopened items; keeps what a secret was', () => {
  const ooc = [{ id: 'o1', ooc: true }];
  const mk = (o) => base({ kind: 'secret', who: 'Daniel', toward: 'Sera', unaware: ['Sera'], guess: ['Mina'], evidence: [{ messageId: 'o1', number: 1 }], ...o });
  const ledger = { threads: [mk({ id: 'A' }), mk({ id: 'B', edited: true }), mk({ id: 'C', reopened: { by: 'hand' } })] };
  const r = L.tidyOocThreads(ledger, ooc);
  assert.equal(r.planned, 1);
  const [a, b, c] = ledger.threads;
  assert.equal(a.plan, true);
  assert.deepEqual(a.wasSecret, { who: 'Daniel', toward: 'Sera', unaware: ['Sera'], guess: ['Mina'] });
  assert.equal(b.plan, undefined);
  assert.equal(b.who, 'Daniel');
  assert.equal(c.plan, undefined);
});

test('closeDoneThreads: "done" words in the description alone do not close an item; the latest news does', () => {
  const ledger = { threads: [
    base({ id: 'D1', detail: 'Daniel promised to finish the report; it is not finished yet. (If it is done, tell Sera.)', latest: { text: 'Still working on it', number: 7 } }),
    base({ id: 'D2', detail: 'Return the book', latest: { text: '책을 돌려줬다', number: 8 }, kind: 'pending' }),
  ] };
  assert.equal(L.closeDoneThreads(ledger), 1);
  assert.equal(ledger.threads[0].status, 'open');
  assert.equal(ledger.threads[1].status, 'closed');
});
