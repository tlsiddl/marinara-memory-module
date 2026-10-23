// node --test tests/test-ledger.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

const rows = [
  { id: 'm1', number: 1, speaker: '이리나', content: '단테를 노려본다. 다음 주에 바다에 같이 가기로 했잖아.' },
  { id: 'm2', number: 2, speaker: '단테', content: '"Fine. Next week, the sea." 단테가 어깨를 으쓱했다.\n\n킬리안은 말없이 반지를 주머니에 숨겼다.' },
];

test('segment keeps paragraphs and sentence ends', () => {
  assert.deepEqual(L.segment('가나다. 라마바!\n\n"Hi." 사아.'), ['가나다.', '라마바!', '"Hi."', '사아.']);
});

test('prompt numbers every sentence and lists open threads', () => {
  const batch = L.prepareMessages(rows);
  const ledger = L.emptyLedger();
  const [system, user] = L.buildPrompt(ledger, batch);
  assert.equal(system.role, 'system');
  assert.match(user.content, /\[2\.3\] 킬리안은 말없이 반지를 주머니에 숨겼다\./);
  assert.match(user.content, /\(비어 있음\)/);
});

test('parseJsonObject survives thinking, fences and chatter', () => {
  const reply = '<think>음 {이건 아님}</think>여기 결과야:\n```json\n{"open":[{"kind":"promise","title":"a {b}"}],"update":[],"close":[]}\n```';
  assert.equal(L.parseJsonObject(reply).open[0].title, 'a {b}');
  assert.equal(L.parseJsonObject('no json here'), null);
});

test('applyResult keeps grounded items, drops bad ones, quotes come from the source', () => {
  const batch = L.prepareMessages(rows);
  const ledger = L.emptyLedger();
  const stats = L.applyResult(ledger, {
    open: [
      { kind: 'promise', title: '다음 주 바다', who: '단테', toward: '이리나', detail: '같이 바다에 가기로', evidence: ['1.2', '2.1'] },
      { kind: 'secret', title: '킬리안의 반지', who: '킬리안', evidence: ['2.3'] },
      { kind: 'promise', title: '근거 없는 약속', evidence: ['9.9'] },
      { kind: 'weird', title: '종류 이상', evidence: ['1.1'] },
    ],
    update: [{ id: 'T99', evidence: ['1.1'] }],
    close: [],
  }, batch);
  assert.deepEqual(stats, { opened: 2, updated: 0, closed: 0, dropped: 3 });
  assert.equal(ledger.threads[0].evidence[1].text, '"Fine. Next week, the sea."');
  assert.equal(ledger.threads[1].id, 'T2');
});

test('a duplicate title becomes an update, secret clues accumulate', () => {
  const ledger = L.emptyLedger();
  const b1 = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [{ kind: 'secret', title: '킬리안의 반지', evidence: ['2.3'] }] }, b1);
  const b2 = L.prepareMessages([{ id: 'm3', number: 3, speaker: '단테', content: '킬리안의 주머니가 불룩했다.' }]);
  const stats = L.applyResult(ledger, { open: [{ kind: 'secret', title: '킬리안의 반지!', evidence: ['3.1'] }] }, b2);
  assert.equal(stats.updated, 1);
  assert.equal(ledger.threads.length, 1);
  assert.equal(ledger.threads[0].clues[0].text, '킬리안의 주머니가 불룩했다.');
});

test('emotion stays open until a resolving close, and closed threads leave the prompt', () => {
  const ledger = L.emptyLedger();
  const b1 = L.prepareMessages([{ id: 'a', number: 1, speaker: '이리나', content: '이리나는 단테에게 화가 나서 문을 쾅 닫았다.' }]);
  L.applyResult(ledger, { open: [{ kind: 'emotion', title: '단테에게 화남', who: '이리나', toward: '단테', cause: '약속을 어김', evidence: ['1.1'] }] }, b1);
  assert.match(L.render(ledger), /풀리지 않은 감정[\s\S]*이리나 → 단테: 단테에게 화남[\s\S]*원인: 약속을 어김/);
  const b2 = L.prepareMessages([{ id: 'b', number: 2, speaker: '단테', content: '단테가 고개를 숙여 사과했고, 이리나는 결국 웃었다.' }]);
  L.applyResult(ledger, { close: [{ id: 'T1', how: '사과하고 화해함', evidence: ['2.1'] }] }, b2);
  assert.equal(ledger.threads[0].status, 'closed');
  assert.equal(L.render(ledger), '');
});

test('reconcile rolls back a regenerated last reply and reprocesses it', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.beginBatch(ledger, 0);
  L.applyResult(ledger, { open: [{ kind: 'promise', title: '다음 주 바다', evidence: ['2.1'] }] }, batch);
  L.commitBatch(ledger, batch);
  // Same chat: nothing to do.
  assert.deepEqual(L.reconcile(ledger, batch), { from: 2, rolledBack: false });
  // The reply was regenerated: its text changed.
  const swiped = L.prepareMessages([rows[0], { ...rows[1], content: '"No." 단테가 거절했다.' }]);
  const r = L.reconcile(ledger, swiped);
  assert.equal(r.rolledBack, true);
  assert.equal(r.from, 0);
  assert.equal(ledger.threads.length, 0);
  assert.equal(ledger.nextId, 1);
});

test('a change older than the kept snapshots asks for a rebuild', () => {
  const ledger = L.emptyLedger();
  ledger.processed = [{ id: 'x', h: 'old' }];
  assert.equal(L.reconcile(ledger, [{ id: 'x', h: 'new' }]).rebuild, true);
});

test('planBatches respects the size limit but keeps a long message whole', () => {
  const messages = L.prepareMessages([
    { id: '1', number: 1, speaker: 'a', content: 'x'.repeat(500) },
    { id: '2', number: 2, speaker: 'a', content: 'y'.repeat(500) },
    { id: '3', number: 3, speaker: 'a', content: 'z'.repeat(3000) },
  ]);
  const batches = L.planBatches(messages, 1200);
  assert.deepEqual(batches.map((b) => b.map((m) => m.id)), [['1', '2'], ['3']]);
});
