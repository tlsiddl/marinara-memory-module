// node --test tests/test-details.cjs
// Details kept whole, lines from the right scene, a question and its answer together, names, HTML messages.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const R = require('../memory-module/lib/recall.cjs');

const chat = L.prepareMessages([
  { id: 'm1', number: 1, speaker: '서아', role: 'user', content: '"병원은 안 갈 거야."' },
  { id: 'm2', number: 2, speaker: '도윤', role: 'assistant', content: '도윤이 한숨을 쉬었다. "알았어, 대신 오늘은 푹 자."' },
  { id: 'm3', number: 3, speaker: '서아', role: 'user', content: '"원서 접수는 언제까지야?"' },
  { id: 'm4', number: 4, speaker: '도윤', role: 'assistant', content: '"7월 20일 저녁 6시까지." 도윤이 말했다. "입학금은 내가 빌려줄게."' },
  { id: 'm5', number: 5, speaker: '서아', role: 'user', content: '"고마워."' },
  { id: 'm6', number: 6, speaker: '도윤', role: 'assistant', content: '도윤이 웃었다.' },
]);

const longText = '도윤이 서아에게 원서 접수가 7월 20일 저녁 6시에 마감되며, 그 전에 서류를 내면 입학금은 도윤이 빌려주기로 하고, 서아는 다음 달 아르바이트비로 갚기로 했다고 정리해 주었다. '.repeat(2);

test('a scene keeps long details, more lines per exchange, and only lines from its own messages', () => {
  const store = S.emptyStore();
  store.cast = ['도윤'];
  const result = {
    scenes: [
      { end: 2, title: '병원', summary: '서아가 병원을 거절함.', present: ['서아', '도윤'],
        events: [{ text: '서아가 병원에 안 가겠다고 함', quotes: [{ n: '1.1', q: '병원은 안 갈' }, { n: '4.3', q: '입학금은 내가' }] }] },
      { end: 6, title: '원서', summary: '접수 마감과 입학금 이야기.', present: ['서아', '도윤', '매니저'],
        events: [{ text: longText, why: '서아가 마감일을 물어서. '.repeat(10), quotes: [{ n: '3.1', q: '원서 접수는' }, { n: '4.1', q: '7월 20일' }, { n: '4.3', q: '입학금은 내가' }, { n: '5.1', q: '고마워' }] }] },
    ],
  };
  const applied = S.applyScenes(store, result, chat, 6);
  assert.ok(!applied.error, applied.error);
  const [first, second] = applied.scenes;
  assert.deepEqual(first.events[0].quotes.map((q) => q.number), [1], 'a line from the next scene is not glued to this one');
  assert.equal(second.events[0].quotes.length, 4, 'a question and its answers are all kept');
  assert.ok(second.events[0].text.length > 200, 'details are not cut at 200 characters');
  assert.match(second.events[0].text, /7월 20일 저녁 6시/);
  assert.ok(second.events[0].why.length > 120);
  assert.ok(second.present.includes('매니저'), 'someone outside the registered cast is still recorded as there');
});

test('a scene does not end between a question and its answer', () => {
  const store = S.emptyStore();
  const applied = S.applyScenes(store, { scenes: [{ end: 3, title: '질문', summary: '물음.', events: [{ text: '서아가 물음', quotes: [{ n: '3.1', q: '원서 접수는' }] }] }, { end: 6, title: '뒤', summary: '뒤.', events: [{ text: '고마워함', quotes: [{ n: '5.1', q: '고마워' }] }] }] }, chat, 4);
  assert.ok(!applied.error, applied.error);
  assert.equal(applied.scenes[0].end, 4, 'the scene that ended on the question takes the answer too');
  // A slice never ends on a user message whose reply is not in it.
  const slice = S.nextSlice(S.emptyStore(), chat, 0, { maxChars: 170, lead: 0, minVisible: 0 }).slice;
  assert.notEqual(slice.at(-1).role, 'user');
  // Ledger batches keep a user message with the reply to it.
  for (const batch of L.planBatches(chat, 120)) if (batch.length > 1) assert.notEqual(batch.at(-1).role, 'user');
});

test('the same words about two different people are two facts', () => {
  const store = S.emptyStore();
  store.facts.push({ id: 'F1', about: '도윤', text: '커피를 좋아한다.', evidence: [], sceneId: 'S0' });
  store.nextFact = 2;
  const applied = S.applyScenes(store, { scenes: [{ end: 6, title: '커피', summary: '커피.', events: [{ text: '커피 이야기', quotes: [{ n: '2.1', q: '도윤이 한숨' }] }], facts: [{ about: '서아', text: '커피를 좋아한다.', evidence: [{ n: '5.1', q: '고마워' }] }, { about: '도윤', text: '커피를 좋아한다.', evidence: [{ n: '6.1', q: '웃었다' }] }] }] }, chat, 6);
  assert.ok(!applied.error, applied.error);
  assert.deepEqual(applied.facts.map((f) => f.about), ['서아']);
});

test('a name without the family name, or the first word of a spaced name, is the same person', () => {
  assert.equal(L.matchName('재민이', ['서재민', '도윤']), '서재민');
  assert.equal(L.matchName('재민아', ['서재민']), '서재민');
  assert.equal(L.matchName('Dan', ['Dan Smith', '도윤']), 'Dan Smith');
  assert.equal(L.matchName('민수', ['김민수', '이민수']), null, 'two people share it: no guess');
  assert.equal(L.matchName('도윤이', ['도윤']), '도윤');
});

test('HTML messages read as text, and a name in its own element says who speaks', () => {
  const html = '<style>.b{color:red}</style><div class="bubble"><span class="name">도윤</span><p>&ldquo;오늘 늦지 마.&rdquo;</p></div><p>그는 <b>정말</b> 웃었다.</p>';
  const [m] = L.prepareMessages([{ id: 'h', number: 1, speaker: '도윤', role: 'assistant', content: html }]);
  assert.equal(m.content, '도윤 | “오늘 늦지 마.”\n\n그는 정말 웃었다.');
  assert.equal(m.h, L.hashText(html), 'the fingerprint is of the stored message, so nothing looks edited');
  const plain = L.prepareMessages([{ id: 'p', content: '<speaker="하준">하준 | "응."</speaker> 3 < 5' }])[0];
  assert.equal(plain.content, '<speaker="하준">하준 | "응."</speaker> 3 < 5', 'plain messages stay as they are');
});

test('a recalled scene brings the scene where its reason came out, right after it', () => {
  const store = S.emptyStore();
  store.scenes = [
    { id: 'S1', start: 1, end: 2, messages: [], title: '말다툼', summary: '쏘아붙임.', events: [], recollections: [], later: [{ what: '서운해서였다', in: 'S3' }] },
    { id: 'S2', start: 3, end: 4, messages: [], title: '산책', summary: '걸음.', events: [], recollections: [] },
    { id: 'S3', start: 5, end: 6, messages: [], title: '고백', summary: '이유를 말함.', events: [], recollections: [] },
  ];
  const picks = R.withFollowUps(store, [{ id: 'S1', why: '모델' }, { id: 'S2', why: '낱말' }], store.scenes);
  assert.deepEqual(picks.map((p) => p.id), ['S1', 'S3', 'S2']);
  assert.equal(picks[1].follow, true);
  assert.deepEqual(R.shownPicks(picks, 1).map((p) => p.id), ['S1', 'S3'], 'a follow-up does not take a chosen scene\'s place');
  assert.match(R.renderRecalled(store, R.shownPicks(picks, 1)), /\(S1에 이어진 장면\)/);
  // Only scenes outside what the reply model already sees.
  assert.deepEqual(R.withFollowUps(store, [{ id: 'S1' }], store.scenes.slice(0, 2)).map((p) => p.id), ['S1']);
});

test('a question and its answer written as two scenes become one, and the answer is kept', () => {
  const msgs = L.prepareMessages([
    { id: 'q0', number: 1, role: 'assistant', speaker: '도윤', content: '도윤이 서류를 넘겼다.' },
    { id: 'q1', number: 2, role: 'user', speaker: '서아', content: '"접수 마감이 언제야?"' },
    { id: 'q2', number: 3, role: 'assistant', speaker: '도윤', content: '"1월 7일 오후 5시야."' },
  ]);
  const r = S.applyScenes(S.emptyStore(), { scenes: [
    { end: 2, title: '질문', summary: '물음.', events: [{ text: '서아가 마감을 물음', quotes: [{ n: '2.1', q: '접수 마감' }] }] },
    { end: 3, title: '답', summary: '답함.', events: [{ text: '도윤이 1월 7일 오후 5시라고 답함', quotes: [{ n: '3.1', q: '1월 7일' }] }], facts: [] },
  ] }, msgs, 3);
  assert.ok(!r.error, r.error);
  assert.equal(r.scenes.length, 1);
  assert.deepEqual(r.scenes[0].events.map((e) => e.quotes.map((q) => q.number)), [[2], [3]]);
  assert.match(r.scenes[0].events[1].text, /1월 7일 오후 5시/);
});

test('a very long question and answer still go together', () => {
  const big = '가나다라'.repeat(2500);
  const msgs = L.prepareMessages([
    { id: 'b1', number: 1, role: 'assistant', content: '시작.' },
    { id: 'b2', number: 2, role: 'user', content: big },
    { id: 'b3', number: 3, role: 'assistant', content: big },
  ]);
  assert.deepEqual(L.planBatches(msgs, 8000).map((b) => b.map((m) => m.number)), [[1], [2, 3]]);
  const store = S.emptyStore();
  store.covered = [{ id: 'b1', h: msgs[0].h }];
  assert.deepEqual(S.nextSlice(store, msgs, 0, { maxChars: 8000, lead: 0, minVisible: 0 }).slice.map((m) => m.number), [2, 3]);
});

test('facts and recollections are kept under the full name, also ones saved before', () => {
  const msgs = L.prepareMessages([{ id: 'n1', number: 1, role: 'assistant', speaker: '서재민', content: '재민은 커피를 마셨다.' }]);
  const store = S.emptyStore();
  store.cast = ['서재민', '도윤'];
  store.facts.push({ id: 'F1', about: '재민', text: '단 것을 싫어한다.', evidence: [], sceneId: 'S0' });
  store.nextFact = 2;
  const r = S.applyScenes(store, { scenes: [{ end: 1, title: '커피', summary: '커피.', events: [{ text: '재민이 커피를 마심', quotes: [{ n: '1.1', q: '커피를' }] }], recollections: [{ who: '재민', text: '쓴맛이 좋았다.' }], facts: [{ about: '재민', text: '커피를 좋아한다.', evidence: [{ n: '1.1', q: '커피를' }] }] }] }, msgs, 1);
  assert.ok(!r.error, r.error);
  assert.equal(r.facts[0].about, '서재민');
  assert.equal(r.scenes[0].recollections[0].who, '서재민');
  S.tidyKnowledge(store);
  assert.equal(store.facts[0].about, '서재민');
});

test('HTML bubbles without quotation marks: the name element says who speaks', () => {
  const html = '<div class="chat-bubble"><img src="a.png"><div class="char-name">도윤</div><div class="msg">오늘은 일찍 들어와</div></div><p>그는 <b>정말</b> 웃었다.</p>';
  assert.equal(L.htmlToText(html), '도윤 | 오늘은 일찍 들어와\n\n그는 정말 웃었다.');
});

test('a line cited under the wrong scene is moved to its own scene; an event with no line gets the sentence it describes', () => {
  const msgs = L.prepareMessages([
    { id: 'w1', number: 1, role: 'user', speaker: '서아', content: '"병원은 안 갈 거야."' },
    { id: 'w2', number: 2, role: 'assistant', speaker: '도윤', content: '도윤이 한숨을 쉬었다.' },
    { id: 'w3', number: 3, role: 'user', speaker: '서아', content: '"등록금이 모자라."' },
    { id: 'w4', number: 4, role: 'assistant', speaker: '도윤', content: '"입학금은 내가 빌려줄게." 도윤이 통장을 꺼냈다.' },
  ]);
  const r = S.applyScenes(S.emptyStore(), { scenes: [
    { end: 2, title: '병원', summary: '거절.', events: [{ text: '서아가 병원을 거절함', quotes: [{ n: '1.1', q: '병원은' }, { n: '4.1', q: '입학금은 내가' }] }] },
    { end: 4, title: '돈', summary: '입학금.', events: [{ text: '서아가 등록금이 모자라다고 함', quotes: [{ n: '3.1', q: '등록금이' }] }, { text: '도윤이 통장을 꺼냄', quotes: [] }] },
  ] }, msgs, 4);
  assert.ok(!r.error, r.error);
  const lines = (sc) => sc.events.flatMap((e) => e.quotes.map((q) => `${q.number}.${q.sentence}`));
  assert.deepEqual(lines(r.scenes[0]), ['1.1']);
  assert.ok([...lines(r.scenes[1]), ...(r.scenes[1].loose || []).map((q) => `${q.number}.${q.sentence}`)].includes('4.1'), 'the stray line is kept, in the scene it came from');
  // Being named in an event is not enough to attach a line about another topic.
  assert.deepEqual(r.scenes[1].loose.map((q) => `${q.number}.${q.sentence}`), ['4.1']);
  assert.deepEqual(r.scenes[1].events[1].quotes.map((q) => `${q.number}.${q.sentence}`), ['4.2']);
});

test('an event with no line gets the sentence of its scene that it describes', () => {
  const msgs = L.prepareMessages([
    { id: 'v1', number: 1, role: 'user', speaker: '서아', content: '"같이 가자."' },
    { id: 'v2', number: 2, role: 'assistant', speaker: '도윤', content: '도윤이 우산을 펼쳤다. 비가 그쳤다.' },
  ]);
  const r = S.applyScenes(S.emptyStore(), { scenes: [{ end: 2, title: '비', summary: '비.', events: [{ text: '서아가 같이 가자고 함', quotes: [{ n: '1.1', q: '같이' }] }, { text: '도윤이 우산을 펼침', quotes: [] }] }] }, msgs, 2);
  assert.ok(!r.error, r.error);
  assert.deepEqual(r.scenes[0].events[1].quotes.map((q) => `${q.number}.${q.sentence}`), ['2.1']);
});

test('joined question and answer keep the answer events even past the per-scene limit', () => {
  const msgs = L.prepareMessages([
    { id: 'j1', number: 1, role: 'assistant', speaker: '도윤', content: '도윤이 서류를 하나씩 넘겼다. 첫 장은 계약서였다. 둘째 장은 영수증이었다. 셋째 장은 지도였다. 넷째 장은 사진이었다.' },
    { id: 'j2', number: 2, role: 'user', speaker: '서아', content: '"그래서 마감이 언제야?"' },
    { id: 'j3', number: 3, role: 'assistant', speaker: '도윤', content: '도윤이 달력을 봤다. 펜을 들었다. 동그라미를 쳤다. "3월 2일 정오야."' },
  ]);
  const ev = (text, n) => ({ text, quotes: [{ n }] });
  const r = S.applyScenes(S.emptyStore(), { scenes: [
    { end: 2, title: '서류', summary: '서류.', events: [ev('도윤이 서류를 넘김', '1.1'), ev('계약서', '1.2'), ev('영수증', '1.3'), ev('지도', '1.4'), ev('사진', '1.5'), ev('서아가 마감을 물음', '2.1')] },
    { end: 3, title: '마감', summary: '답.', events: [ev('달력을 봄', '3.1'), ev('펜을 듦', '3.2'), ev('동그라미', '3.3'), ev('도윤이 3월 2일 정오라고 답함', '3.4')] },
  ] }, msgs, 3);
  assert.ok(!r.error, r.error);
  assert.equal(r.scenes.length, 1);
  assert.equal(r.scenes[0].events.length, 10);
  assert.match(r.scenes[0].events.at(-1).text, /3월 2일 정오/);
});

test('a stray line that fits no event is kept unlinked, shown as such, and linked once an event fits', () => {
  const msgs = L.prepareMessages([
    { id: 'u1', number: 1, role: 'assistant', speaker: '하준', content: '하준이 창문을 열었다.' },
    { id: 'u2', number: 2, role: 'assistant', speaker: '하준', content: '바람이 불었다. 커튼이 흔들렸다.' },
    { id: 'u3', number: 3, role: 'user', speaker: '서아', content: '"내일 도서관에서 보자."' },
  ]);
  const r = S.applyScenes(S.emptyStore(), { scenes: [
    { end: 1, title: '창문', summary: '창문.', events: [{ text: '하준이 창문을 엶', quotes: [{ n: '1.1' }, { n: '3.1', q: '도서관' }] }] },
    { end: 3, title: '바람', summary: '바람.', events: [{ text: '바람이 붊', quotes: [{ n: '2.1' }] }, { text: '커튼이 흔들림', quotes: [{ n: '2.2' }] }] },
  ] }, msgs, 3);
  assert.ok(!r.error, r.error);
  const scene = r.scenes[1];
  assert.deepEqual(scene.events.map((e) => e.quotes.map((q) => q.number)), [[2], [2]], 'not put on the last event by default');
  assert.deepEqual(scene.loose.map((q) => q.number), [3]);
  assert.match(S.renderExpanded(scene, 1), /연결 미확정 대사[^\n]*\n\s+.*도서관/);
  scene.events.push({ text: '서아가 내일 도서관에서 보자고 함', quotes: [] });
  assert.equal(S.relinkLoose(scene), 1);
  assert.equal(scene.loose, undefined);
  assert.deepEqual(scene.events[2].quotes.map((q) => q.number), [3]);
});

test('chat-app HTML: a styled name speaks every bubble under it, the user side speaks as the user, clocks and avatars go', () => {
  const html = '<div style="display:flex;flex-direction:column;gap:8px;">'
    + '<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:14px;font-weight:700;">하준 (29)</span><span style="font-size:11px;color:#999;">대화 중</span></div>'
    + '<div style="align-self:flex-end;max-width:70%;"><div style="display:flex;gap:4px;flex-direction:row-reverse;"><div style="padding:10px 14px;background:#4d7bff;border-radius:14px;">오늘 저녁 같이 먹을래?</div><span style="font-size:10px;">00:00</span></div></div>'
    + '<div style="align-self:flex-start;display:flex;gap:8px;"><div style="width:36px;height:36px;border-radius:50%;background:#eee;">🌙</div>'
    + '<div style="display:flex;flex-direction:column;gap:4px;"><span style="font-size:12px;font-weight:700;">하준</span>'
    + '<div style="padding:10px 14px;background:#f1f1f1;border-radius:14px;">좋지, 마침 배고팠어.</div>'
    + '<div style="padding:10px 14px;background:#f1f1f1;border-radius:14px;">어디로 갈까?</div>'
    + '<div style="padding:10px 14px;background:#f1f1f1;border-radius:14px;">역 앞에서 일곱 시에 보자.</div></div>'
    + '<span style="font-size:10px;">00:02</span></div>'
    + '<div style="text-align:center;font-size:11px;">— 채팅방 —</div></div>';
  const text = L.htmlToText(html, { user: '서아' });
  assert.deepEqual(text.split('\n').filter(Boolean), [
    '하준 (29)', '대화 중',
    '서아 | 오늘 저녁 같이 먹을래?',
    '하준 | 좋지, 마침 배고팠어.', '하준 | 어디로 갈까?', '하준 | 역 앞에서 일곱 시에 보자.',
    '— 채팅방 —',
  ]);
  // Through prepareMessages the user name comes from the chat's own user messages.
  const [, m] = L.prepareMessages([{ id: 'c0', role: 'user', speaker: '서아', content: '안녕' }, { id: 'c1', role: 'assistant', speaker: '하준', content: html }]);
  assert.match(m.content, /^서아 \| 오늘 저녁/m);
});

test('an exact name is never taken for a shorter one that starts it; a short form needs exactly one owner', () => {
  assert.equal(L.matchName('Daniel', ['Dan', 'Daniel']), 'Daniel');
  assert.equal(L.matchName('Dan', ['Dan', 'Daniel']), 'Dan');
  assert.equal(L.matchName('이경민', ['이경', '이경민']), '이경민');
  assert.equal(L.matchName('이경민이', ['이경', '이경민']), '이경민', 'a particle after the longer name');
  assert.equal(L.matchName('이경이', ['이경', '이경민']), '이경');
  assert.equal(L.matchName('Dana', ['Dan']), null, 'another name that starts the same is not that person');
  assert.equal(L.canonNames('이경민·Daniel', ['이경', '이경민', 'Dan', 'Daniel']), '이경민·Daniel');
});

test('undoing the ledger also takes its story date, time and last message back', () => {
  const rows = [
    { id: 'r1', number: 1, speaker: '서아', role: 'user', content: '2027년 4월 14일 수요일 | 10시 30분\n"안녕."' },
    { id: 'r2', number: 2, speaker: '도윤', role: 'assistant', content: '"응."' },
    { id: 'r3', number: 3, speaker: '서아', role: 'user', content: '2027년 5월 20일 목요일 | 21시\n"오랜만이야."' },
    { id: 'r4', number: 4, speaker: '도윤', role: 'assistant', content: '"그러게."' },
  ];
  const msgs = L.prepareMessages(rows);
  const ledger = L.emptyLedger();
  L.beginBatch(ledger, 0);
  L.commitBatch(ledger, msgs.slice(0, 2));
  L.beginBatch(ledger, 2);
  L.commitBatch(ledger, msgs.slice(2));
  assert.equal(ledger.storyDate, '2027-05-20');
  const after = L.prepareMessages(rows.slice(0, 2));
  const state = L.reconcile(ledger, after);
  assert.equal(state.rolledBack, true);
  assert.equal(ledger.storyDate, '2027-04-14');
  assert.equal(ledger.storyTime, '2027-04-14T10:30');
  assert.equal(ledger.lastNumber, 2);
});

test('two hundred chapters still fit the set length: old ones fold into stretches, ones being talked about stay', () => {
  const store = S.emptyStore();
  store.chapters = Array.from({ length: 200 }, (_, i) => ({ id: `C${i + 1}`, scenes: [], time: `24-01-${String((i % 28) + 1).padStart(2, '0')}`, title: `오래 이어진 이야기의 한 토막 ${i + 1}`, summary: '여러 일이 있었다. '.repeat(6), turns: [], keep: [] }));
  store.chapters[11].title = '장학금 서류를 준비함';
  for (const limit of [4000, 2000, 1000]) {
    const text = S.renderChapters(store, limit, '장학금 서류 언제까지였지?');
    assert.ok(text.length <= limit, `${limit}: ${text.length}`);
    assert.match(text, /^C12 .*장학금 서류를 준비함/m);
    assert.match(text, /^C1~C11 — 챕터 11개 줄임/m);
    assert.match(text, /^C200 /m);
  }
});

function manyChapters(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `C${i + 1}`, scenes: [`S${i + 1}`], time: `24-${String((Math.floor(i / 28) % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, title: `이야기의 한 토막 ${i + 1}`, summary: '여러 일이 있었다. 둘은 가까워졌다.', turns: [], keep: [] }));
}

test('old chapters are folded into arcs by the model, leaving the newest chapters as they are', () => {
  const store = S.emptyStore();
  store.chapters = manyChapters(30);
  const offered = S.nextArc(store);
  assert.deepEqual([offered[0].id, offered.at(-1).id], ['C1', 'C12']);
  assert.match(S.buildArcPrompt(store, offered)[1].content, /C1 \| 24-01-01 \| 이야기의 한 토막 1/);
  const made = S.applyArc(store, { end: 'C9', title: '처음 만난 봄', summary: '서아와 도윤이 이웃으로 만나 조금씩 가까워졌다.', turns: ['C3 도윤이 서아를 도움', 'C11 범위 밖'], keep: ['매달 1일에 월세 50만 원'] }, offered);
  assert.ok(!made.error, made.error);
  assert.deepEqual(made.arc.chapters, ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9']);
  assert.deepEqual(made.arc.turns, ['C3 도윤이 서아를 도움'], 'a turn from a chapter left for the next arc is dropped');
  S.commitArc(store, made.arc);
  assert.equal(S.nextArc(store), null, 'not enough chapters for another arc yet');
  assert.equal(S.applyArc(store, { end: 'C2', title: 't', summary: 's' }, offered).arc.chapters.length, 4, 'never fewer than the minimum');
});

test('with arcs, the oldest part of a long story always has a line, and the limit still holds', () => {
  const store = S.emptyStore();
  store.chapters = manyChapters(200);
  store.chapters[20].title = '장학금 서류를 준비함';
  for (let a = 0; a < 15; a++) {
    const chapters = store.chapters.slice(a * 12, a * 12 + 12).map((c) => c.id);
    S.commitArc(store, { id: `A${a + 1}`, chapters, time: null, title: `큰 흐름 ${a + 1}`, summary: `${a + 1}번째 시기에 관계가 바뀌었다. 자세한 일들이 있었다.`, turns: [], keep: [] });
  }
  for (const limit of [4000, 2000]) {
    const text = S.renderChapters(store, limit, '장학금 서류 언제까지였지?');
    assert.ok(text.length <= limit, `${limit}: ${text.length}`);
    assert.match(text, /^\[지난 이야기 흐름\]\nA\d+/, 'the arcs come first');
    assert.match(text, /^A15 \(C169~C180/m);
    assert.match(text, /^C21 .*장학금 서류를 준비함/m, 'a chapter inside an arc comes in when it is talked about');
    assert.match(text, /^C200 /m);
    assert.doesNotMatch(text, /^C5 /m);
  }
  assert.match(S.renderChapters(store, 4000), /^A1 \(C1~C12\) 큰 흐름 1/m, 'with room, even the first part of the story is there');
});

test('arcs that held a chapter now gone are made again later', () => {
  const store = S.emptyStore();
  store.chapters = manyChapters(3);
  store.arcs = [{ id: 'A1', chapters: ['C1', 'C2'] }];
  store.scenes = store.chapters.map((c, i) => ({ id: c.scenes[0], start: i + 1, end: i + 1, messages: [{ id: `m${i}`, h: 'x' }], events: [], recollections: [] }));
  store.covered = store.scenes.map((s, i) => ({ id: `m${i}`, h: 'x' }));
  S.reconcileScenes(store, [{ id: 'm0', h: 'x' }, { id: 'm1', h: 'changed' }]);
  assert.deepEqual(store.chapters.map((c) => c.id), ['C1']);
  assert.deepEqual(store.arcs, []);
});
