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

test('update and close may come without evidence when they carry words', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [{ kind: 'promise', title: '다음 주 바다', evidence: ['2.1'] }] }, batch);
  const stats = L.applyResult(ledger, { update: [{ id: 'T1', detail: '토요일로 확정' }, { id: 'T1' }], close: [] }, batch);
  assert.deepEqual([stats.updated, stats.dropped], [1, 1]);
  assert.equal(ledger.threads[0].detail, '토요일로 확정');
  assert.equal(ledger.threads[0].evidence.length, 1, 'no evidence was invented');
  L.applyResult(ledger, { close: [{ id: 'T1', how: '바다에 다녀옴' }] }, batch);
  assert.equal(ledger.threads[0].status, 'closed');
});

test('tidy closes finished threads and merges duplicates of the same kind only', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'promise', title: '오빠 호칭 수금', evidence: ['1.1'] },
    { kind: 'promise', title: '오빠 호칭 외상', evidence: ['1.2'] },
    { kind: 'promise', title: '스테이크 준비', evidence: ['2.1'] },
    { kind: 'emotion', title: '서운함', evidence: ['2.2'] },
  ] }, batch);
  const [system, user] = L.buildTidyPrompt(ledger, batch);
  assert.match(system.content, /점검/);
  assert.match(user.content, /T3 \[promise\] 스테이크 준비 \| 처음 원문: ""Fine\. Next week, the sea\.""/);
  const stats = L.applyTidy(ledger, { close: [{ id: 'T3', how: '이미 먹음' }, { id: 'T99' }], merge: [{ keep: 'T1', drop: ['T2', 'T4'] }] });
  assert.deepEqual(stats, { closed: 1, merged: 1, dropped: 2 });
  const open = ledger.threads.filter((t) => t.status === 'open').map((t) => t.id);
  assert.deepEqual(open, ['T1', 'T4']);
  assert.equal(ledger.threads[0].evidence.length, 2, 'the merged line moved into the kept thread');
});

test('render puts feelings first, quotes the line where it began, caps each kind, never cuts mid-item', () => {
  const ledger = L.emptyLedger();
  const many = L.prepareMessages(Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, number: i + 1, speaker: '단테', content: `약속 ${i}번이야. 나중 이야기 ${i}.` })));
  L.applyResult(ledger, { open: many.map((m) => ({ kind: 'promise', title: `약속 ${m.number}`, evidence: [`${m.number}.1`] })) }, many);
  L.applyResult(ledger, { open: [{ kind: 'emotion', title: '서운함', evidence: ['1.1'] }] }, many);
  L.applyResult(ledger, { update: [{ id: 'T1', detail: '나중에 바뀜', evidence: ['1.2'] }] }, many, '2099-01-01T00:00:00.000Z');
  const text = L.render(ledger);
  assert.ok(text.indexOf('풀리지 않은 감정') < text.indexOf('■ 약속'));
  assert.equal((text.match(/^- /gm) || []).length, 11, '1 feeling + 10 promises');
  assert.match(text, /약속 1 — 나중에 바뀜\n  원문: "약속 0번이야\."/);
  const small = L.render(ledger, { maxChars: 400 });
  assert.ok(small.length <= 400 && !small.endsWith('…'));
});

test('an update keeps the original description and adds a dated latest line', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [{ kind: 'emotion', title: '자괴감', who: '이리나', detail: '발정기 때 매달린 자신이 부끄러움', since: '24-10-20 (일) 13:55', evidence: ['1.1'] }] }, batch);
  L.applyResult(ledger, { update: [{ id: 'T1', now: '킬리안에게 털어놓음', at: '24-10-21 (월) 18:05', evidence: ['2.1'] }] }, batch);
  const t = ledger.threads[0];
  assert.equal(t.detail, '발정기 때 매달린 자신이 부끄러움');
  assert.deepEqual(t.latest, { text: '킬리안에게 털어놓음', at: '24-10-21 (월) 18:05', number: 2 });
  assert.match(L.render(ledger), /시작: 24-10-20 \(일\) 13:55\)\n  최근: 킬리안에게 털어놓음 \(24-10-21 \(월\) 18:05\)/);
  assert.match(L.buildPrompt(ledger, batch)[1].content, /T1 \[emotion\] 자괴감 \(이리나\) — 발정기 때 매달린 자신이 부끄러움 \| 최근: 킬리안에게 털어놓음/);
});

test('an update that says it is over closes promises and secrets, but never feelings', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'promise', title: '금욕', evidence: ['1.1'] },
    { kind: 'secret', title: '목탄화 취미', evidence: ['1.2'] },
    { kind: 'emotion', title: '서운함', evidence: ['2.1'] },
    { kind: 'promise', title: '서재 동행', evidence: ['2.2'] },
  ] }, batch);
  const stats = L.applyResult(ledger, { update: [
    { id: 'T1', now: '금욕 계획이 사실상 전면 폐기됨' },
    { id: 'T2', now: '단테가 모든 걸 자백함', at: '24-10-20 11:50' },
    { id: 'T3', now: '서운함이 거의 해소됨, 완료' },
    { id: 'T4', now: '실제 이행 시작' },
  ] }, batch);
  assert.deepEqual([stats.closed, stats.updated], [2, 2]);
  assert.deepEqual(ledger.threads.map((t) => t.status), ['closed', 'closed', 'open', 'open']);
  assert.equal(ledger.threads[1].closed.at.time, '24-10-20 11:50');
});
