// node --test tests/test-ledger.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

const rows = [
  { id: 'm1', number: 1, speaker: '서아', content: '하루를 노려본다. 다음 주에 바다에 같이 가기로 했잖아.' },
  { id: 'm2', number: 2, speaker: '하루', content: '"Fine. Next week, the sea." 하루가 어깨를 으쓱했다.\n\n하준은 말없이 반지를 주머니에 숨겼다.' },
];

test('segment keeps paragraphs and sentence ends', () => {
  assert.deepEqual(L.segment('가나다. 라마바!\n\n"Hi." 사아.'), ['가나다.', '라마바!', '"Hi."', '사아.']);
});

test('prompt numbers every sentence and lists open threads', () => {
  const batch = L.prepareMessages(rows);
  const ledger = L.emptyLedger();
  const [system, user] = L.buildPrompt(ledger, batch);
  assert.equal(system.role, 'system');
  assert.match(user.content, /\[2\.3\] 하준은 말없이 반지를 주머니에 숨겼다\./);
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
      { kind: 'promise', title: '다음 주 바다', who: '하루', toward: '서아', detail: '같이 바다에 가기로', evidence: ['1.2', '2.1'] },
      { kind: 'secret', title: '하준의 반지', who: '하준', evidence: ['2.3'] },
      { kind: 'promise', title: '근거 없는 약속', evidence: ['9.9'] },
      { kind: 'weird', title: '종류 이상', evidence: ['1.1'] },
    ],
    update: [{ id: 'T99', evidence: ['1.1'] }],
    close: [],
  }, batch);
  assert.deepEqual(stats, { opened: 2, updated: 0, closed: 0, dropped: 3, merged: 0 });
  assert.equal(ledger.threads[0].evidence[1].text, '"Fine. Next week, the sea."');
  assert.equal(ledger.threads[1].id, 'T2');
});

test('a duplicate title becomes an update, secret clues accumulate', () => {
  const ledger = L.emptyLedger();
  const b1 = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [{ kind: 'secret', title: '하준의 반지', evidence: ['2.3'] }] }, b1);
  const b2 = L.prepareMessages([{ id: 'm3', number: 3, speaker: '하루', content: '하준의 주머니가 불룩했다.' }]);
  const stats = L.applyResult(ledger, { open: [{ kind: 'secret', title: '하준의 반지!', evidence: ['3.1'] }] }, b2);
  assert.equal(stats.updated, 1);
  assert.equal(ledger.threads.length, 1);
  assert.equal(ledger.threads[0].clues[0].text, '하준의 주머니가 불룩했다.');
});

test('emotion stays open until a resolving close, and closed threads leave the prompt', () => {
  const ledger = L.emptyLedger();
  const b1 = L.prepareMessages([{ id: 'a', number: 1, speaker: '서아', content: '서아는 하루에게 화가 나서 문을 쾅 닫았다.' }]);
  L.applyResult(ledger, { open: [{ kind: 'emotion', need: '사과', title: '하루에게 화남', who: '서아', toward: '하루', cause: '약속을 어김', evidence: ['1.1'] }] }, b1);
  assert.match(L.render(ledger), /풀리지 않은 감정[\s\S]*서아 → 하루: 하루에게 화남[\s\S]*원인: 약속을 어김/);
  const b2 = L.prepareMessages([{ id: 'b', number: 2, speaker: '하루', content: '하루가 고개를 숙여 사과했고, 서아는 결국 웃었다.' }]);
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
  const swiped = L.prepareMessages([rows[0], { ...rows[1], content: '"No." 하루가 거절했다.' }]);
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
    { kind: 'emotion', need: '사과', title: '서운함', evidence: ['2.2'] },
  ] }, batch);
  const [system, user] = L.buildTidyPrompt(ledger, batch);
  assert.match(system.content, /점검/);
  assert.match(user.content, /T3 \[promise\] 스테이크 준비 \| 처음 원문: ""Fine\. Next week, the sea\.""/);
  const stats = L.applyTidy(ledger, { close: [{ id: 'T3', how: '이미 먹어서 완료됨', why: 'done' }, { id: 'T99' }], merge: [{ keep: 'T1', drop: ['T2', 'T4'] }] });
  assert.deepEqual(stats, { closed: 1, merged: 1, dropped: 2 });
  const open = ledger.threads.filter((t) => t.status === 'open').map((t) => t.id);
  assert.deepEqual(open, ['T1', 'T4']);
  assert.equal(ledger.threads[0].evidence.length, 2, 'the merged line moved into the kept thread');
});

test('render puts feelings first, quotes the line where it began, caps each kind, never cuts mid-item', () => {
  const ledger = L.emptyLedger();
  const many = L.prepareMessages(Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, number: i + 1, speaker: '하루', content: `약속 ${i}번이야. 나중 이야기 ${i}.` })));
  L.applyResult(ledger, { open: many.map((m) => ({ kind: 'promise', title: `약속 ${m.number}`, evidence: [`${m.number}.1`] })) }, many);
  L.applyResult(ledger, { open: [{ kind: 'emotion', need: '사과', title: '서운함', evidence: ['1.1'] }] }, many);
  L.applyResult(ledger, { update: [{ id: 'T1', detail: '나중에 바뀜', evidence: ['14.2'] }] }, many, '2099-01-01T00:00:00.000Z');
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
  L.applyResult(ledger, { open: [{ kind: 'emotion', need: '사과', title: '자괴감', who: '서아', detail: '몸살기 때 매달린 자신이 부끄러움', since: '24-10-20 (일) 13:55', evidence: ['1.1'] }] }, batch);
  L.applyResult(ledger, { update: [{ id: 'T1', now: '하준에게 털어놓음', at: '24-10-21 (월) 18:05', evidence: ['2.1'] }] }, batch);
  const t = ledger.threads[0];
  assert.equal(t.detail, '몸살기 때 매달린 자신이 부끄러움');
  assert.deepEqual(t.latest, { text: '하준에게 털어놓음', at: '24-10-21 (월) 18:05', number: 2 });
  assert.match(L.render(ledger), /시작: 24-10-20 \(일\) 13:55\)\n  최근: 하준에게 털어놓음 \(24-10-21 \(월\) 18:05\)/);
  assert.match(L.buildPrompt(ledger, batch)[1].content, /T1 \[emotion\] 자괴감 \(서아\) — 몸살기 때 매달린 자신이 부끄러움 \| 풀리려면: 사과 \| 최근: 하준에게 털어놓음/);
});

test('an update that says it is over closes promises and secrets, but never feelings', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'promise', title: '금욕', evidence: ['1.1'] },
    { kind: 'secret', title: '목탄화 취미', evidence: ['1.2'] },
    { kind: 'emotion', need: '사과', title: '서운함', evidence: ['2.1'] },
    { kind: 'promise', title: '서재 동행', evidence: ['2.2'] },
  ] }, batch);
  const stats = L.applyResult(ledger, { update: [
    { id: 'T1', now: '금욕 계획이 사실상 전면 폐기됨' },
    { id: 'T2', now: '하루가 모든 걸 자백함', at: '24-10-20 11:50' },
    { id: 'T3', now: '서운함이 거의 해소됨, 완료' },
    { id: 'T4', now: '실제 이행 시작' },
  ] }, batch);
  assert.deepEqual([stats.closed, stats.updated], [2, 2]);
  assert.deepEqual(ledger.threads.map((t) => t.status), ['closed', 'closed', 'open', 'open']);
  assert.equal(ledger.threads[1].closed.at.time, '24-10-20 11:50');
});

test('a phrase fixes a wrong sentence number, and a wrong phrase never drops a valid number', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'promise', title: '바다', evidence: [{ n: '1.1', q: '바다에 같이 가기로' }] },
    { kind: 'secret', title: '반지', evidence: [{ n: '9.9', q: '반지를 주머니에' }] },
    { kind: 'emotion', need: '사과', title: '노려봄', evidence: [{ n: '1.1', q: '전혀 없는 말' }] },
    { kind: 'pending', title: '근거 없음', evidence: [{ n: '9.9', q: '전혀 없는 말' }] },
  ] }, batch);
  assert.deepEqual(ledger.threads.map((t) => `${t.title}:${t.evidence[0].number}.${t.evidence[0].sentence}`), ['바다:1.2', '반지:2.3', '노려봄:1.1']);
});

test('a feeling never closes on hedged words, without evidence, or from tidy unless it was a passing reaction', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'emotion', need: '하루의 사과', who: '서아', title: '서운함', evidence: ['1.1'] },
    { kind: 'emotion', need: '믿음을 되찾을 계기', who: '서아', toward: '하루', title: '신뢰 흔들림', evidence: ['1.2'] },
    { kind: 'emotion', need: '진정', who: '하준', title: '순간 흥분', evidence: ['2.1'] },
    { kind: 'emotion', need: '해명', who: '하루', title: '화남', evidence: ['2.2'] },
  ] }, batch);
  L.applyResult(ledger, { close: [
    { id: 'T1', how: '서운함이 누그러질 기로에 섬', evidence: ['2.1'] },
    { id: 'T4', how: '사과해서 화해함' },
  ] }, batch);
  assert.deepEqual(ledger.threads.map((t) => t.status), ['open', 'open', 'open', 'open']);
  const stats = L.applyTidy(ledger, {
    close: [{ id: 'T2', how: '떨림이 잦아들 기미', why: 'momentary' }, { id: 'T1', how: '풀림' }, { id: 'T3', how: '장면 속 흥분', why: 'momentary' }],
    merge: [{ keep: 'T1', drop: ['T2'] }],
  });
  assert.deepEqual(stats, { closed: 1, merged: 1, dropped: 2 });
  assert.deepEqual(ledger.threads.map((t) => t.status), ['open', 'closed', 'closed', 'open']);
  assert.equal(ledger.threads[1].mergedInto, 'T1');
  L.applyResult(ledger, { close: [{ id: 'T4', how: '사과하고 화해함', evidence: ['2.2'] }] }, batch);
  assert.equal(ledger.threads[3].status, 'closed');
});

test('a feeling without a need is not an open thread; a hand-off is not an ending', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  const stats = L.applyResult(ledger, { open: [
    { kind: 'emotion', title: '뭉클함', evidence: ['1.1'] },
    { kind: 'emotion', title: '서운함', need: '하루가 알아봐 주는 것', evidence: ['1.2'] },
    { kind: 'promise', title: '내일 데이트', evidence: ['2.1'] },
  ] }, batch);
  assert.equal(stats.dropped, 1);
  assert.match(L.render(ledger), /풀리려면: 하루가 알아봐 주는 것/);
  L.applyResult(ledger, { close: [{ id: 'T2', how: '장소 문제는 T80으로 이어짐', evidence: ['2.2'] }] }, batch);
  assert.equal(ledger.threads[1].status, 'open');
  L.applyTidy(ledger, { close: [{ id: 'T2', how: '별도 항목으로 넘어감' }] });
  assert.equal(ledger.threads[1].status, 'open');
  L.applyResult(ledger, { close: [{ id: 'T2', how: '둘이 바다에 다녀옴', evidence: ['2.2'] }] }, batch);
  assert.equal(ledger.threads[1].status, 'closed');
});

test('closed lines are shown for reopening, and a reopen needs evidence', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [{ kind: 'promise', title: '내일 데이트', evidence: ['2.1'] }] }, batch);
  L.applyResult(ledger, { close: [{ id: 'T1', how: '둘 다 취소하자고 함', evidence: ['2.2'] }] }, batch);
  assert.match(L.buildPrompt(ledger, batch)[1].content, /최근에 닫힌 항목[\s\S]*T1 \[promise\] 내일 데이트 \| 닫힌 이유: 둘 다 취소하자고 함/);
  L.applyResult(ledger, { reopen: [{ id: 'T1', why: '데이트를 걸고 내기함' }] }, batch);
  assert.equal(ledger.threads[0].status, 'closed', 'no evidence, no reopen');
  const stats = L.applyResult(ledger, { reopen: [{ id: 'T1', why: '데이트를 걸고 내기함', evidence: [{ n: '1.2', q: '바다에 같이' }] }] }, batch);
  assert.equal(stats.reopened, 1);
  assert.equal(ledger.threads[0].status, 'open');
  assert.equal(ledger.threads[0].reopened.from.how, '둘 다 취소하자고 함');
});

test('an update saying a feeling lifted closes it; hedged news does not', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'emotion', title: '질투', who: '하루', need: '서아의 확답', evidence: ['1.1'] },
    { kind: 'emotion', title: '서운함', who: '서아', need: '알아봐 주기', evidence: ['1.2'] },
  ] }, batch);
  L.applyResult(ledger, { update: [
    { id: 'T1', now: '하루의 질투가 눈 녹듯 사라짐', evidence: ['2.1'] },
    { id: 'T2', now: '서운함이 풀릴 듯한 기미', evidence: ['2.2'] },
  ] }, batch);
  assert.deepEqual(ledger.threads.map((t) => t.status), ['closed', 'open']);
});

test('the same feeling opened three times becomes one thread', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  const stats = L.applyResult(ledger, { open: [
    { kind: 'emotion', title: '배신감', who: '서아', toward: '하루', cause: '하루가 서아를 다 안다면서도 새로 산 귀걸이을 눈치채지 못한 것', need: '하루가 새 귀걸이을 스스로 알아차리고 서아의 마음을 헤아려 달래는 것', evidence: ['1.1'] },
    { kind: 'emotion', title: '서운함·화', who: '서아', toward: '하루', cause: '하루가 귀걸이를 알아차리지 못한 데서 온 서운함', need: '하루가 진짜 이유를 알아차리고 서아의 기분을 풀어주는 것', evidence: ['1.2'] },
    { kind: 'emotion', title: '신뢰 흔들림', who: '서아', toward: '하루', cause: '하루가 서아가 새로 한 귀걸이를 알아차리지 못한 것', need: '하루가 새 귀걸이을 스스로 알아차리고 상처를 헤아려 달래는 것', evidence: ['2.1'] },
    { kind: 'emotion', title: '서운함', who: '서아', toward: '하준', cause: '하준이 내기에서 이기려고 하루를 쫓아냄', need: '하준이 먼저 달래는 것', evidence: ['2.2'] },
  ] }, batch);
  assert.equal(stats.merged, 2);
  assert.deepEqual(ledger.threads.filter((t) => t.status === 'open').map((t) => t.title), ['배신감', '서운함']);
});

test('tidy never closes a secret, and closes a promise only when its record says it was done', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'secret', title: '새 귀걸이', evidence: ['2.3'] },
    { kind: 'promise', title: '내일 데이트', evidence: ['2.1'] },
    { kind: 'promise', title: '스테이크', evidence: ['1.1'] },
  ] }, batch);
  L.applyResult(ledger, { update: [{ id: 'T3', now: '스테이크를 구워 먹임' }] }, batch);
  L.applyTidy(ledger, { close: [
    { id: 'T1', how: '하루가 존재를 알아냄', why: 'done' },
    { id: 'T2', how: '흐지부지됨', why: 'done' },
    { id: 'T3', how: '구워 먹여서 완료됨', why: 'done' },
  ] });
  assert.deepEqual(ledger.threads.map((t) => t.status), ['open', 'open', 'closed']);
});

test('a feeling untouched for 120 messages fades from the prompt but stays in the ledger; promises never fade', () => {
  const ledger = L.emptyLedger();
  const early = L.prepareMessages([{ id: 'e', number: 5, speaker: '서아', content: '서아는 하루에게 서운했다. 다음 주에 바다 가자.' }]);
  L.applyResult(ledger, { open: [
    { kind: 'emotion', title: '서운함', who: '서아', need: '사과', evidence: ['5.1'] },
    { kind: 'promise', title: '바다', evidence: ['5.2'] },
  ] }, early);
  L.commitBatch(ledger, early);
  const late = L.prepareMessages([{ id: 'l', number: 200, speaker: '하루', content: '하루가 웃었다.' }]);
  L.commitBatch(ledger, late);
  const text = L.render(ledger);
  assert.doesNotMatch(text, /서운함/);
  assert.match(text, /바다/);
  assert.equal(ledger.threads[0].status, 'open');
  assert.equal(L.faded(ledger.threads[0], ledger.lastNumber), true);
});

test('soothed feelings and broken promises close', () => {
  const ledger = L.emptyLedger();
  const batch = L.prepareMessages(rows);
  L.applyResult(ledger, { open: [
    { kind: 'emotion', title: '질투', who: '하루', need: '확답', evidence: ['1.1'] },
    { kind: 'promise', title: '사흘 간호', evidence: ['1.2'] },
  ] }, batch);
  L.applyResult(ledger, { update: [
    { id: 'T1', now: '서아가 하루의 질투를 달랬다', evidence: ['2.1'] },
    { id: 'T2', now: '병가 선언으로 계획이 사실상 깨졌다' },
  ] }, batch);
  assert.deepEqual(ledger.threads.map((t) => t.status), ['closed', 'closed']);
});

test('periods: "사흘" from the story date becomes a dated span with weekdays and a day count', () => {
  const batch = L.prepareMessages([
    { id: 'p1', number: 1, speaker: '하루', role: 'assistant', content: '§RP | 24-10-18 (금) | 02:32 | 서재§ 하루 | "I\'m calling in sick for the next three days."\n(앞으로 사흘 내내 병가 낼 거니까.)' },
    { id: 'p2', number: 2, speaker: '서아', role: 'user', content: '"응."' },
  ]);
  assert.equal(L.storyDate(batch), '2024-10-18');
  const ledger = L.emptyLedger();
  L.beginBatch(ledger, 0);
  L.applyResult(ledger, { open: [
    { kind: 'state', title: '셋의 사흘 휴가', who: '하루·하준', toward: '서아', detail: '셋 다 출근 안 함', period: { from: '24-10-18', days: 3 }, evidence: [{ n: '1.2', q: '사흘 내내' }] },
    { kind: 'state', title: '날짜 없는 상태', evidence: [{ n: '1.2', q: '사흘 내내' }], period: { days: 3 } },
  ] }, batch);
  L.commitBatch(ledger, batch);
  assert.deepEqual(ledger.threads[0].period, { from: '2024-10-18', to: '2024-10-20' });
  assert.equal(ledger.threads[1].period, null);
  assert.match(L.renderCompact(ledger), /- 상태 하루·하준→서아: 셋의 사흘 휴가 — 셋 다 출근 안 함 \[24-10-18 \(금\)~24-10-20 \(일\), 지금 1\/3일째\]/);
  assert.equal(L.formatPeriod({ from: '2024-10-18', to: '2024-10-20' }, '2024-10-21'), '24-10-18 (금)~24-10-20 (일), 기간 지남');
  assert.deepEqual(L.parsePeriod({ from: '10-19', to: '10-21' }, '2024-10-18'), { from: '2024-10-19', to: '2024-10-21' });
});

test('a promise for "Monday at 7" gets the real date from the story date', () => {
  assert.deepEqual(L.parseDue({ weekday: '월', time: '7:00' }, '2024-10-18'), { date: '2024-10-21', time: '07:00' });
  assert.deepEqual(L.parseDue({ weekday: '금' }, '2024-10-18'), { date: '2024-10-18', time: null });
  assert.equal(L.formatDue({ date: '2024-10-21', time: '07:00' }, '2024-10-18'), '24-10-21 (월) 07:00, 3일 뒤');
  assert.equal(L.formatDue({ date: '2024-10-21', time: null }, '2024-10-22'), '24-10-21 (월), 1일 지남');
  assert.equal(L.parseDue({ weekday: '아무' }, '2024-10-18'), null);
});

test('daily life: meals counted per day, sleep length worked out, drinks and smokes are not meals, rollback undoes it', () => {
  const batch = L.prepareMessages([
    { id: 'r1', number: 1, speaker: '하루', role: 'assistant', content: '하루가 스테이크를 먹였다. 서아가 다 먹었다. 하준은 버번을 마셨다.\n§RP | 24-10-18 (금) | 00:12 | 서재§' },
    { id: 'r2', number: 2, speaker: '서아', role: 'user', content: '서아가 잠들었다.\n§RP | 24-10-18 (금) | 03:02 | 서재§' },
    { id: 'r3', number: 3, speaker: '하루', role: 'assistant', content: '서아가 깼다. 하루가 토스트를 먹였다.\n§RP | 24-10-18 (금) | 11:15 | 서재§' },
    { id: 'r4', number: 4, speaker: '서아', role: 'user', content: '"응."' },
  ]);
  const ledger = L.emptyLedger();
  L.beginBatch(ledger, 0);
  L.applyResult(ledger, { routine: [
    { who: '서아', what: 'meal', text: '스테이크', evidence: [{ n: '1.2', q: '다 먹었다' }] },
    { who: '하준', what: 'meal', text: '버번', evidence: [{ n: '1.3', q: '버번을' }] },
    { who: '서아', what: 'sleep', text: '데이베드', evidence: [{ n: '2.1', q: '잠들었다' }] },
    { who: '서아', what: 'wake', evidence: [{ n: '3.1', q: '깼다' }] },
    { who: '서아', what: 'meal', text: '토스트', evidence: [{ n: '3.2', q: '토스트' }] },
    { who: '서아', what: 'dance', evidence: [{ n: '3.2', q: '토스트' }] },
  ] }, batch);
  L.commitBatch(ledger, batch);
  assert.ok(!ledger.routine.some((r) => r.who === '하준'), 'bourbon is not a meal');
  assert.equal(ledger.storyTime, '2024-10-18T11:15');
  assert.equal(L.renderRoutine(ledger, '2024-10-18T11:25'), '[최근 생활] 지금: 24-10-18 (금) 11:25\n- 서아: 식사 기상(11:15) 후 1끼(11:15 토스트), 마지막 10분 전 · 밤잠 03:02에 잠들어 11:15에 깸(8시간 13분 잠)');
  assert.match(L.renderRoutine(ledger, '2024-10-19T09:00'), /식사 기상\(24-10-18 \(금\) 11:15\) 후 1끼/);
  const r = L.reconcile(ledger, L.prepareMessages([{ id: 'r1', number: 1, speaker: '하루', content: '바뀐 메시지.' }]));
  assert.ok(r.rolledBack);
  assert.equal(ledger.routine.length, 0);
});

test('made do with a coffee, and "I ate" said without a scene: shown as such, not counted as meals', () => {
  const batch = L.prepareMessages([
    { id: 'c1', number: 1, speaker: '하루', role: 'assistant', content: '"점심은 커피로 때웠어." 하준이 말했다. 하준이 버번을 마셨다.\n§RP | 24-10-18 (금) | 13:00 | 거실§' },
    { id: 'c2', number: 2, speaker: '서아', role: 'user', content: '"나 밥 먹었어."\n§RP | 24-10-18 (금) | 13:05 | 거실§' },
  ]);
  const ledger = L.emptyLedger();
  L.beginBatch(ledger, 0);
  L.applyResult(ledger, { routine: [
    { who: '하준', what: 'meal', text: '커피', how: 'substitute', claimed: true, evidence: [{ n: '1.1', q: '커피로 때웠어' }] },
    { who: '하준', what: 'meal', text: '버번', how: 'ate', evidence: [{ n: '1.3', q: '버번을' }] },
    { who: '서아', what: 'meal', text: '밥', how: 'ate', claimed: true, evidence: [{ n: '2.1', q: '밥 먹었어' }] },
  ] }, batch);
  L.commitBatch(ledger, batch);
  const text = L.renderRoutine(ledger, '2024-10-18T13:30');
  assert.match(text, /- 서아: 식사 오늘 1끼\(13:05 밥 \(본인 주장\)\), 마지막 25분 전/);
  assert.match(text, /- 하준: 식사 오늘 아직 없음, 끼니 대신 때움 1번\(13:00 커피 \(본인 주장\)\)/);
  assert.doesNotMatch(text, /버번/);
});

test('bites of the same steak over an hour and a half are one meal', () => {
  const ledger = { routine: [
    { who: '서아', what: 'meal', text: '스테이크 여러 점', at: '2024-10-18T00:18', number: 5 },
    { who: '서아', what: 'meal', text: '스테이크 몇 조각', at: '2024-10-18T00:35', number: 7 },
    { who: '서아', what: 'meal', text: '스테이크', at: '2024-10-18T01:47', number: 20 },
    { who: '서아', what: 'meal', text: '토스트', at: '2024-10-18T11:40', number: 60 },
  ] };
  assert.match(L.renderRoutine(ledger, '2024-10-18T12:00'), /식사 오늘 2끼\(00:18 스테이크, 11:40 토스트\), 마지막 20분 전/);
});

test('everyone at the table ate unless told otherwise: one meal, an entry each', () => {
  const batch = L.prepareMessages([
    { id: 't1', number: 1, speaker: '하루', role: 'assistant', content: '셋이 토스트를 먹었다.\n§RP | 24-10-18 (금) | 11:40 | 주방§' },
    { id: 't2', number: 2, speaker: '서아', role: 'user', content: '"맛있다."' },
  ]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { routine: [{ who: '서아·하루·하준', what: 'meal', text: '토스트', how: 'ate', evidence: [{ n: '1.1', q: '토스트를' }] }] }, batch);
  assert.deepEqual(ledger.routine.map((r) => r.who), ['서아', '하루', '하준']);
  // A nap does not start a new day; a night's sleep does.
  ledger.routine.push({ who: '하루', what: 'sleep', at: '2024-10-18T14:00', number: 3 }, { who: '하루', what: 'wake', at: '2024-10-18T15:00', number: 4 });
  assert.match(L.renderRoutine(ledger, '2024-10-18T16:00'), /- 하루: 식사 오늘 1끼\(11:40 토스트\)/);
  ledger.routine.push({ who: '하루', what: 'sleep', at: '2024-10-18T23:00', number: 5 }, { who: '하루', what: 'wake', at: '2024-10-19T07:00', number: 6 });
  assert.match(L.renderRoutine(ledger, '2024-10-19T08:00'), /- 하루: 식사 기상\(07:00\) 후 아직 없음\(마지막: 24-10-18 \(금\) 11:40 토스트, 20시간 전\)/);
  assert.match(L.renderRoutine(ledger, '2024-10-18T12:00'), /- 하루: 식사 오늘 1끼\(11:40 토스트\)/);
});

test('the last few days: meals per day and the night sleep after it; a morning wake with no known bedtime still starts the day', () => {
  const r = (what, at, text) => ({ who: '서아', what, at, text, number: Date.parse(at) });
  const ledger = { routine: [
    r('wake', '2024-10-16T08:00'), r('meal', '2024-10-16T09:00', '죽'), r('meal', '2024-10-16T19:00', '국수'),
    r('sleep', '2024-10-17T01:00'), r('wake', '2024-10-17T04:00'),
    r('sleep', '2024-10-17T04:30'), r('wake', '2024-10-17T05:00'),
    r('meal', '2024-10-17T12:00', '빵'),
    r('sleep', '2024-10-18T03:00'), r('wake', '2024-10-18T06:00'),
    r('wake', '2024-10-18T09:00'),
  ] };
  const text = L.renderRoutine(ledger, '2024-10-18T10:00');
  assert.match(text, /식사 기상\(09:00\) 후 아직 없음\(마지막: 24-10-17 \(목\) 12:00 빵, 22시간 전\)/);
  assert.match(text, /밤잠 03:00에 잠들어 09:00에 깸\(3시간 이상 잠\)/);
  assert.match(text, /지난 며칠: 24-10-17 \(목\): 1끼, 그 뒤 밤잠 3시간 이상 \/ 24-10-16 \(수\): 2끼, 그 뒤 밤잠 3시간 30분/);
});

test('whoever only fed the meal did not eat it', () => {
  const batch = L.prepareMessages([{ id: 'f1', number: 1, speaker: '하루', role: 'assistant', content: '하루가 스테이크를 먹여 줬다.\n§RP | 24-10-18 (금) | 00:35 | 서재§' }, { id: 'f2', number: 2, speaker: '서아', role: 'user', content: '"응."' }]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { routine: [{ who: '하루·서아', what: 'meal', text: '하루가 먹여준 스테이크', how: 'ate', evidence: [{ n: '1.1', q: '먹여 줬다' }] }] }, batch);
  assert.deepEqual(ledger.routine.map((x) => x.who), ['서아']);
});

test('"tomorrow" said at 2 a.m. is the same day; feelings get no period', () => {
  const batch = L.prepareMessages([
    { id: 'd1', number: 1, speaker: '하준', role: 'assistant', content: '하준 | "I\'m throwing out the painkiller tomorrow."\n(내일 진통약 다 버릴게.)\n§RP | 24-10-18 (금) | 01:47 | 서재§' },
    { id: 'd2', number: 2, speaker: '서아', role: 'user', content: '"응."' },
  ]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: [
    { kind: 'promise', title: '진통약 버리기', detail: '내일 진통약을 전부 버리겠다고 함', due: { date: '24-10-19' }, evidence: [{ n: '1.2', q: '내일 진통약' }] },
    { kind: 'emotion', title: '하루의 초조함', need: '문을 열어 주는 것', period: { from: '24-10-18', days: 3 }, evidence: [{ n: '1.2', q: '내일 진통약' }] },
  ] }, batch);
  assert.deepEqual(ledger.threads[0].due, { date: '2024-10-18', time: null });
  assert.equal(ledger.threads[1].period, null);
});

test('feeling review: closes a feeling only with a line said after it last came up, never on a hedge', () => {
  const msgs = L.prepareMessages([
    { id: 'e1', number: 1, speaker: '서아', role: 'user', content: '"미워."' },
    { id: 'e2', number: 2, speaker: '하루', role: 'assistant', content: '하루가 사과했다. 서아가 그를 끌어안았다.' },
  ]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: [
    { kind: 'emotion', title: '서아의 서운함', who: '서아', toward: '하루', need: '하루의 사과', evidence: [{ n: '1.1', q: '미워' }] },
    { kind: 'emotion', title: '하루의 자책', who: '하루', need: '서아의 용서', evidence: [{ n: '1.1', q: '미워' }] },
  ] }, msgs);
  const review = L.buildFeelingPrompt(ledger, msgs, ledger.threads[0]);
  assert.equal(review.feelings.length, 1);
  assert.match(review.messages[1].content, /^\[사용자 캐릭터\] 서아/);
  assert.match(review.messages[1].content, /\[2\.2\] 서아가 그를 끌어안았다\./);
  // A long story: the part right after the feeling and the newest part, with a gap mark between.
  const long = L.prepareMessages(Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, number: i + 1, speaker: 'x', role: i % 2 ? 'user' : 'assistant', content: `문장 ${i + 1}. ${'가'.repeat(900)}` })));
  const t = { ...ledger.threads[0], evidence: [{ number: 3, sentence: 1, text: 'x' }], clues: [], latest: null };
  const big = L.buildFeelingPrompt(ledger, long, t, { afterChars: 3000, tailChars: 2000 });
  assert.equal(big.window[0].number, 3);
  assert.equal(big.window.at(-1).number, 30);
  assert.match(big.messages[1].content, /중간 생략/);
  const stats = L.applyFeelingReview(ledger, { resolved: [
    { id: 'T1', how: '하루가 사과하고 서아가 끌어안음', evidence: [{ n: '2.2', q: '끌어안았다' }] },
    { id: 'T2', how: '풀릴 기미가 보임', evidence: [{ n: '2.1', q: '사과했다' }] },
    { id: 'T9', how: '없는 항목', evidence: [{ n: '2.1', q: '사과했다' }] },
  ] }, review.window);
  assert.deepEqual(stats, { closed: 1, dropped: 2 });
  assert.equal(ledger.threads[0].status, 'closed');
  assert.equal(ledger.threads[1].status, 'open');
});

test('sleep: the first bedtime since waking counts, a retold "slept" at waking time does not make them asleep', () => {
  const r = (what, at, number) => ({ who: '서아', what, at, number });
  const ledger = { routine: [r('sleep', '2024-10-18T03:15', 40), r('wake', '2024-10-18T11:15', 60), r('sleep', '2024-10-18T11:10', 61), r('meal', '2024-10-18T00:18', 5)] };
  const text = L.renderRoutine(ledger, '2024-10-18T11:20');
  assert.match(text, /밤잠 03:15에 잠들어 11:15에 깸\(8시간 잠\)/);
  assert.match(text, /식사 기상\(11:15\) 후 아직 없음/);
  assert.doesNotMatch(text, /자는 중/);
});

test('feeling review moves a resolution filed as a feeling to promises', () => {
  const msgs = L.prepareMessages([{ id: 'm1', number: 1, speaker: '하준', role: 'assistant', content: '"진통약 끊을게."' }, { id: 'm2', number: 2, speaker: '서아', role: 'user', content: '"응."' }]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: [{ kind: 'emotion', title: '하준의 단약 결심', who: '하준', need: '서아의 지지', evidence: [{ n: '1.1', q: '끊을게' }] }] }, msgs);
  const stats = L.applyFeelingReview(ledger, { resolved: [], misfiled: [{ id: 'T1', kind: 'promise' }] }, msgs);
  assert.equal(stats.moved, 1);
  assert.equal(ledger.threads[0].kind, 'promise');
});

test('tidy never closes a promise because nobody mentioned it again', () => {
  const msgs = L.prepareMessages([{ id: 'p1', number: 1, speaker: '하준', role: 'assistant', content: '"대신 내일 아침엔 내 거 해 줘."' }, { id: 'p2', number: 2, speaker: '서아', role: 'user', content: '"응."' }]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: [{ kind: 'promise', title: '작업 대행의 대가', who: '하준', toward: '서아', evidence: [{ n: '1.1', q: '내 거 해 줘' }] }] }, msgs);
  const stats = L.applyTidy(ledger, { close: [{ id: 'T1', how: '작업은 완료됐고 대가 요구는 더 이상 언급되지 않음', why: 'done' }] });
  assert.equal(stats.closed, 0);
  assert.equal(ledger.threads[0].status, 'open');
});

test('the same state opened twice (coming → begun) becomes one; an update can rewrite what no longer holds', () => {
  const msgs = L.prepareMessages([
    { id: 's1', number: 1, speaker: '서아', role: 'user', content: '몸살기가 오려나 보다. 서아가 열쇠로 문을 잠갔다.' },
    { id: 's2', number: 2, speaker: '하루', role: 'assistant', content: '체온이 40도를 넘었다. 서아가 문을 열었다.' },
  ]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: [
    { kind: 'state', title: '서아의 몸살기 전조', who: '서아', detail: '곧 몸살기', period: { from: '24-10-18', days: 3 }, evidence: [{ n: '1.1', q: '몸살기가 오려나' }] },
    { kind: 'state', title: '서아의 몸살기 시작', who: '서아', detail: '몸살기 시작, 서재에 스스로 갇힘', period: { from: '24-10-18', days: 3 }, evidence: [{ n: '2.1', q: '40도를 넘었다' }] },
    { kind: 'state', title: '하루의 사흘 병가', who: '하루', period: { from: '24-10-18', days: 3 }, evidence: [{ n: '2.1', q: '40도를 넘었다' }] },
  ] }, msgs);
  const open = ledger.threads.filter((t) => t.status === 'open');
  assert.deepEqual(open.map((t) => t.title), ['서아의 몸살기 시작', '하루의 사흘 병가']);
  L.applyResult(ledger, { update: [{ id: open[0].id, now: '문을 열었다', detail: '몸살기, 기억이 흐려지는 중', evidence: [{ n: '2.2', q: '문을 열었다' }] }] }, msgs);
  assert.equal(ledger.threads.find((t) => t.id === open[0].id).detail, '몸살기, 기억이 흐려지는 중');
});

test('a feeling shows its cause; a promised leave that has begun merges into the state', () => {
  const msgs = L.prepareMessages([{ id: 'c1', number: 1, speaker: '하루', role: 'assistant', content: '"사흘 병가 낼게." 둘은 6년간 몰래 연락해 왔다.' }, { id: 'c2', number: 2, speaker: '서아', role: 'user', content: '"응."' }]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: [
    { kind: 'emotion', title: '서아의 소외감', who: '서아', toward: '하루·하준', cause: '둘이 6년간 몰래 연락해 온 걸 몰랐음', need: '숨긴 게 아니라는 확신', evidence: [{ n: '1.2', q: '몰래 연락' }] },
    { kind: 'promise', title: '하루의 사흘 병가', who: '하루', toward: '서아', evidence: [{ n: '1.1', q: '병가 낼게' }] },
    { kind: 'state', title: '하루의 사흘 휴가', who: '하루', evidence: [{ n: '1.1', q: '병가 낼게' }] },
  ] }, msgs);
  assert.match(L.renderCompact(ledger), /서아의 소외감 \(원인: 둘이 6년간 몰래 연락해 온 걸 몰랐음 \/ 풀리려면: 숨긴 게 아니라는 확신\)/);
  const stats = L.applyTidy(ledger, { merge: [{ keep: 'T3', drop: ['T2'] }] });
  assert.equal(stats.merged, 1);
  assert.equal(ledger.threads[1].mergedInto, 'T3');
});

test('group story: a ledger item remembers who does not know it, until they learn it', () => {
  const ledger = L.emptyLedger();
  ledger.cast = ['하루', '하준'];
  const batch = L.prepareMessages([
    { id: 'k1', number: 1, speaker: '서아', role: 'user', content: '"하준 몰래 주말에 바다 가자." 서아가 하루에게 속삭였다.' },
    { id: 'k2', number: 2, speaker: '하준', role: 'assistant', content: '"바다? 나도 갈래." 하준이 끼어들었다.' },
  ]);
  assert.match(L.buildPrompt(ledger, batch)[1].content, /\[등장인물\] 하루, 하준/);
  L.applyResult(ledger, { open: [{ kind: 'promise', title: '주말 바다', who: '서아', toward: '하루', detail: '주말에 바다 가기로 함', unaware: [{ who: '하준', why: '출근해서 자리에 없었음' }, { who: '없는사람', why: '자리에 없음' }, { who: '하루', why: '직접 말하지 않음' }, '서아'], evidence: [{ n: '1.1', q: '주말에 바다 가자' }] }] }, batch.slice(0, 1));
  const t = ledger.threads[0];
  assert.deepEqual(t.unaware, ['하준']);
  assert.match(L.renderCompact(ledger), /주말 바다.*\[모름: 하준\]/);
  L.applyResult(ledger, { update: [{ id: t.id, now: '하준이 듣고 끼어듦', learned: ['하준'], evidence: [{ n: '2.1', q: '나도 갈래' }] }] }, batch.slice(1));
  assert.deepEqual(t.unaware, []);
  assert.doesNotMatch(L.renderCompact(ledger), /모름/);
});

test('group story: a secret the story says someone guesses is marked as a guess, not as unknown', () => {
  const ledger = L.emptyLedger();
  ledger.cast = ['하루', '하준'];
  const batch = L.prepareMessages([
    { id: 's1', number: 1, speaker: '하루', role: 'assistant', content: '하루는 책상 서랍에 일기장을 숨겼다. 등 뒤의 하준은 눈썹을 치켜올렸다. 저 녀석이 책상 서랍에 뭘 숨겨두는지 대충 짐작은 갔지만 입을 다물었다.' },
  ]);
  L.applyResult(ledger, { open: [{ kind: 'secret', title: '하루의 일기장', who: '하루', toward: '서아', detail: '책상 서랍에 숨긴 일기장', unaware: [{ who: '하준', why: '하루가 몰래 숨김' }], evidence: [{ n: '1.1', q: '책상 서랍에' }] }] }, batch);
  const t = ledger.threads[0];
  assert.deepEqual(t.unaware, []);
  assert.deepEqual(t.guess, ['하준']);
  assert.match(L.renderCompact(ledger), /일기장.*\[짐작만: 하준\]/);
});

test('daily life can be fixed by hand: add a missed wash, edit, delete; a reroll snapshot keeps the fix', () => {
  const ledger = L.emptyLedger();
  ledger.routine = [{ who: '서아', what: 'wash', text: '반신욕', at: '2024-10-20T09:10', number: 5 }];
  ledger.batches = [{ start: 0, threads: [], routine: structuredClone(ledger.routine) }];
  const added = L.editRoutine(ledger, { action: 'add', item: { who: '서아', what: 'wash', text: '외출 준비', at: '2024-10-23T08:30' } });
  assert.equal(added.edited, true);
  assert.match(L.renderRoutine(ledger, '2024-10-23T15:25'), /씻기 마지막 08:30 외출 준비\(7시간 전\)/);
  assert.equal(ledger.batches[0].routine.length, 2, 'the snapshot kept for rerolls has it too');
  const key = L.routineKey(ledger.routine[0]);
  L.editRoutine(ledger, { action: 'edit', key, item: { who: '서아', what: 'wash', text: '욕조 목욕', at: '2024-10-22T09:10' } });
  assert.equal(ledger.routine[0].text, '욕조 목욕');
  assert.equal(ledger.batches[0].routine[0].text, '욕조 목욕');
  L.editRoutine(ledger, { action: 'delete', key: L.routineKey(ledger.routine[0]) });
  assert.equal(ledger.routine.length, 1);
  assert.throws(() => L.editRoutine(ledger, { action: 'add', item: { who: '서아', what: 'wash' } }), /작중 날짜와 시각/);
  assert.throws(() => L.editRoutine(ledger, { action: 'edit', key: 'nope', item: {} }), /찾지 못했습니다/);
});

test('a hand-added entry shows even when its time is after the story clock', () => {
  const ledger = L.emptyLedger();
  ledger.routine = [{ who: '서아', what: 'medicine', text: '소염제', at: '2024-10-20T18:30', number: 3 }];
  L.editRoutine(ledger, { action: 'add', item: { who: '서아', what: 'medicine', text: '피임약', at: '2024-10-23T16:00' } });
  assert.match(L.renderRoutine(ledger, '2024-10-23T15:25'), /약 마지막: 피임약 .*, 소염제 /);
  // Taken earlier than the last painkiller: still shown, each medicine on its own.
  L.editRoutine(ledger, { action: 'add', item: { who: '서아', what: 'medicine', text: '비타민 한 알', at: '2024-10-19T08:00' } });
  L.editRoutine(ledger, { action: 'add', item: { who: '서아', what: 'medicine', text: '소염제 두 알', at: '2024-10-21T09:00' } });
  const text = L.renderRoutine(ledger, '2024-10-23T15:25');
  assert.match(text, /비타민 한 알/);
  assert.equal((text.match(/소염제/g) || []).length, 1, 'the same medicine shows once, its latest');
});

test('a meal eaten over several turns is named by its dish, not by the first bite', () => {
  const meal = (text, at) => ({ who: '도윤', what: 'meal', text, at, number: 1 });
  const wake = { who: '도윤', what: 'wake', at: '2025-07-17T07:00', number: 1 };
  const one = L.renderRoutine({ routine: [meal('스테이크 한 입', '2025-07-17T19:00'), meal('스테이크 몇 점', '2025-07-17T19:10'), meal('스테이크', '2025-07-17T19:25'), wake] }, '2025-07-17T20:00');
  assert.match(one, /1끼\(19:00 스테이크\)/);
  assert.doesNotMatch(one, /한 입|몇 점/);
  const mixed = L.renderRoutine({ routine: [meal('스테이크 반 접시', '2025-07-17T19:00'), meal('샐러드', '2025-07-17T19:20'), meal('스테이크 마저', '2025-07-17T19:30'), wake] }, '2025-07-17T20:00');
  assert.match(mixed, /1끼\(19:00 스테이크, 샐러드\)/, 'different dishes are listed; "반찬"-like words are not cut');
  const firstBite = L.renderRoutine({ routine: [meal('스테이크 한 입', '2025-07-17T19:00'), wake] }, '2025-07-17T20:00');
  assert.match(firstBite, /19:00 스테이크 한 입/, 'one entry so far: as written');
  const words = L.renderRoutine({ routine: [meal('반찬 몇 점', '2025-07-17T19:00'), meal('더덕구이', '2025-07-17T19:20'), wake] }, '2025-07-17T20:00');
  assert.match(words, /반찬 몇 점, 더덕구이/, "\"반찬\" and \"더덕\" are not cut as portion words");
});

test('sleep: an evening nap is not the night, and being up in between (ate, washed) splits a sleep', () => {
  const r = (what, at, text = '') => ({ who: '서아', what, text, at, number: 1 });
  // Bedtime 03:25, waking not written down, washed 15:40, ate 17:10, napped after dinner, woke 20:30.
  const out = L.renderRoutine({ routine: [r('wake', '2025-11-15T11:00'), r('meal', '2025-11-15T19:00', '저녁'), r('sleep', '2025-11-16T03:25'), r('wash', '2025-11-16T15:40', '욕조'), r('meal', '2025-11-16T17:10', '스테이크'), r('sleep', '2025-11-16T18:30'), r('wake', '2025-11-16T20:30')] }, '2025-11-16T22:25');
  assert.doesNotMatch(out, /17시간/, 'never a seventeen-hour sleep through a bath and a meal');
  assert.match(out, /밤잠 03:25에 잠듦\(깬 시각 기록 없음, 15:40엔 깨어 있음\), 낮잠 20:30에 깸/);
  assert.match(out, /식사 기상\(시각 모름\) 후 1끼\(17:10 스테이크\)/, 'the meal after getting up still counts');
  // A morning waking, then a nap from 19:10 to 20:30: the night stays 03:25-13:15, the nap is a nap.
  const nap = L.renderRoutine({ routine: [r('sleep', '2025-11-16T03:25'), r('wake', '2025-11-16T13:15'), r('meal', '2025-11-16T17:10', '스테이크'), r('sleep', '2025-11-16T19:10'), r('wake', '2025-11-16T20:30')] }, '2025-11-16T22:25');
  assert.match(nap, /밤잠 03:25에 잠들어 13:15에 깸\(9시간 50분 잠\), 낮잠 20:30에 깸/);
  assert.match(nap, /식사 기상\(13:15\) 후 1끼/);
  // Up at 2 am, back to bed: still one night.
  assert.match(L.renderRoutine({ routine: [r('sleep', '2025-11-15T23:00'), r('wake', '2025-11-16T02:00'), r('sleep', '2025-11-16T02:30'), r('wake', '2025-11-16T08:00')] }, '2025-11-16T09:00'), /23:00에 잠들어 08:00에 깸\(8시간 30분 잠\)/);
  // Went to bed, then ate breakfast with no waking written: not "asleep now".
  assert.doesNotMatch(L.renderRoutine({ routine: [r('sleep', '2025-11-16T01:00'), r('meal', '2025-11-16T09:00', '아침')] }, '2025-11-16T10:00'), /자는 중/);
});
