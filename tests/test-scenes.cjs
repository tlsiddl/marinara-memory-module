// node --test tests/test-scenes.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

const chat = L.prepareMessages([
  { id: 'a1', number: 1, speaker: '하루', content: '§RP | 24-10-18 (금) | 00:05 | 서재 | 안개§ 하루가 스테이크를 먹였다.' },
  { id: 'u1', number: 2, speaker: '서아', content: '"대체 그 망할 수면약은 언제 끊을 건데?"' },
  { id: 'a2', number: 3, speaker: '하루', content: '하준이 사과했다. "미안해, 아리."' },
  { id: 'u2', number: 4, speaker: '서아', content: '서아가 열쇠로 문을 잠갔다. "……들어올 거잖아."' },
  { id: 'a3', number: 5, speaker: '하루', content: '<speaker="하루">하루 | "I\'m not coming in." (안 들어갈게.)</speaker> 하루가 직접 서명했다.' },
  { id: 'u3', number: 6, speaker: '서아', content: '서아는 몸살기 때 기억을 잃는다. 문을 열었다.' },
  { id: 'a4', number: 7, speaker: '하루', content: '아침이 밝았다.' },
  { id: 'u4', number: 8, speaker: '서아', content: '"나 빼고 사이좋지 마."' },
]);

const goodResult = {
  scenes: [
    {
      end: 3, time: '10-18 00:05~00:20', place: '서재', title: '약 냄새', summary: '서아가 약 냄새를 지적함.',
      events: [{ text: '서아가 약을 끊으라고 함', quotes: [{ n: '2.1', q: '수면약은 언제' }] }],
      recollections: [{ who: '하루', text: '서아가 또 그 얘기를 꺼냈다.', remembers: 'full' }],
      facts: [],
    },
    {
      end: 6, time: '01:05~01:42', place: '서재 문 앞', title: '금주 약속', summary: '문을 잠갔다가 서약을 받고 엶.',
      events: [
        { text: '서아가 열쇠로 문을 잠금', quotes: [{ n: '4.2', q: '들어올 거잖아' }] },
        { text: '하루가 직접 서명한 서약을 밀어 넣음', quotes: [{ n: '9.9', q: 'coming in' }] },
      ],
      recollections: [
        { who: '하루', text: '손끝 하나 안 댈 생각이었다.', remembers: 'full' },
        { who: '서아', text: '열에 들떠 있었다.', remembers: 'partial', why: '몸살기 열', kept: '문 앞에서 뭔가 받은 것만 어렴풋하다.' },
      ],
      facts: [{ about: '서아', text: '몸살기 때 기억을 잃는다', evidence: [{ n: '6.1', q: '기억을 잃는다' }] }],
    },
  ],
};

test('the next slice waits until messages leave the window, and must reach the last one outside it', () => {
  const store = S.emptyStore();
  assert.equal(S.nextSlice(store, chat, 8, { lead: 0, minVisible: 0 }), null);
  const { slice, required } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  assert.equal(slice[0].number, 1);
  assert.equal(required, 6, 'messages 1-6 are outside a 2-message window');
  assert.ok(slice.length <= 8);
});

test('a big backlog is read in parts that may stop at a natural break', () => {
  const store = S.emptyStore();
  const { slice, required } = S.nextSlice(store, chat, 0, { maxChars: 150, lead: 0, minVisible: 0 });
  assert.ok(slice.length < chat.length);
  assert.ok(required <= slice.at(-1).number && required >= slice[0].number);
});

test('scenes follow each other, quotes come from the source, facts need evidence', () => {
  const store = S.emptyStore();
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  const applied = S.applyScenes(store, goodResult, slice, 6);
  assert.ok(!applied.error, applied.error);
  assert.deepEqual(applied.scenes.map((s) => [s.start, s.end]), [[1, 3], [4, 6]]);
  assert.equal(applied.scenes[1].events[0].quotes[0].text, '"……들어올 거잖아."');
  assert.equal(applied.scenes[1].events[1].quotes[0].text.includes('coming in'), true, 'a wrong number is fixed by the phrase');
  assert.equal(applied.facts.length, 1);
  assert.equal(applied.covered.length, 6);
  S.commitScenes(store, applied);
  assert.equal(store.nextScene, 3);
});

test('a result that stops short of the required message is refused', () => {
  const store = S.emptyStore();
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  const applied = S.applyScenes(store, { scenes: [goodResult.scenes[0]] }, slice, 6);
  assert.match(applied.error, /필수 끝 번호/);
});

test('a known fact is not added twice', () => {
  const store = S.emptyStore();
  store.facts.push({ id: 'F1', about: '서아', text: '서아는 몸살기 때 기억을 잃는다.', evidence: [], sceneId: 'S0' });
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  const applied = S.applyScenes(store, goodResult, slice, 6);
  assert.equal(applied.facts.length, 0);
});

test('render: summaries for older scenes, the newest expanded with quotes and who remembers', () => {
  const store = S.emptyStore();
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  S.commitScenes(store, S.applyScenes(store, goodResult, slice, 6));
  const text = S.renderScenes(store, 7, { expand: 1 });
  assert.match(text, /^\[지난 장면들\]\n① 10-18 00:05~00:20 · 서재 — 약 냄새: 서아가 약 냄새를 지적함\./);
  assert.match(text, /② 01:05~01:42 · 서재 문 앞 — 금주 약속\n문을 잠갔다가 서약을 받고 엶\.\n사건:\n- 서아가 열쇠로 문을 잠금\n  "……들어올 거잖아\."\n/);
  assert.match(text, /I'm not coming in\./);
  assert.doesNotMatch(text, /<speaker/);
  assert.match(text, /- 서아 \[흐릿하게만 기억함: 몸살기 열\] 그때: 열에 들떠 있었다\./);
  assert.match(text, / \/ 남은 기억: 문 앞에서 뭔가 받은 것만 어렴풋하다\./);
  assert.match(text, /\[알게 된 사실\]\n- 서아: 몸살기 때 기억을 잃는다/);
  // A scene still inside the window is not shown.
  assert.doesNotMatch(S.renderScenes(store, 4), /금주 약속/);
});

test('a changed message drops its scene and every later one, with their facts', () => {
  const store = S.emptyStore();
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  S.commitScenes(store, S.applyScenes(store, goodResult, slice, 6));
  store.scenes[1].edited = true;
  const changed = L.prepareMessages(chat.map((m) => (m.id === 'a3' ? { ...m, content: '하루가 그냥 돌아섰다.' } : m)));
  const r = S.reconcileScenes(store, changed);
  assert.deepEqual(r, { dropped: 1, lostEdits: 1 });
  assert.equal(store.scenes.length, 1);
  assert.equal(store.facts.length, 0);
  assert.equal(store.covered.length, 3);
  assert.deepEqual(S.reconcileScenes(store, changed), { dropped: 0, lostEdits: 0 });
});

test('folding starts before messages leave the window, waits for a batch, and never touches the newest', () => {
  const many = L.prepareMessages(Array.from({ length: 40 }, (_, i) => ({ id: `m${i + 1}`, number: i + 1, speaker: 'x', content: `문장 ${i + 1}.` })));
  const store = S.emptyStore();
  // window 20, lead 8: fold through message 28 (40 - 12); lookahead stops 8 short of the end.
  const { slice, required } = S.nextSlice(store, many, 20);
  assert.equal(required, 28);
  assert.equal(slice.at(-1).number, 32);
  assert.equal(S.firstInsideWindow(many, 20), 21);
  store.covered = many.slice(0, 26).map((m) => ({ id: m.id, h: m.h }));
  assert.equal(S.nextSlice(store, many, 20, { minPending: 8 }), null, 'only 2 waiting');
});

test('who-forgets notes use the right particle and summaries sit on adjacent lines', () => {
  const store = S.emptyStore();
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  const result = structuredClone(goodResult);
  result.scenes[0].recollections.push({ who: '하준', text: '잠들어 있었다.', remembers: 'none', why: '수면' });
  S.commitScenes(store, S.applyScenes(store, result, slice, 6));
  store.scenes.push({ ...store.scenes[0], id: 'S9', start: 7, end: 7, title: '아침', summary: '아침이 됨.', recollections: [] });
  const text = S.renderScenes(store, 8, { expand: 1 });
  assert.match(text, /※ 하준은 기억 못 함\(수면\)/);
  assert.match(text, /약 냄새: 서아가 약 냄새를 지적함\. ※ 하준은 기억 못 함\(수면\)\n② [^\n]*금주 약속: /);
});

test('facts: the name is not repeated, a changed fact replaces the old one, and both come back if the new one is dropped', () => {
  const store = S.emptyStore();
  store.facts.push({ id: 'F1', about: '서아', text: '문신에 묶여 있다.', evidence: [], sceneId: 'S0' });
  store.nextFact = 2;
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  const result = structuredClone(goodResult);
  result.scenes[1].facts = [
    { about: '서아', text: '서아는 몸살기 때 기억을 잃는다', evidence: [{ n: '6.1', q: '기억을 잃는다' }] },
    { about: '서아', text: '문을 이미 열었다.', evidence: [{ n: '6.2', q: '문을 열었다' }], replaces: 'F1' },
  ];
  const applied = S.applyScenes(store, result, slice, 6);
  assert.equal(applied.facts[0].text, '몸살기 때 기억을 잃는다');
  S.commitScenes(store, applied);
  const text = S.renderScenes(store, 7);
  assert.match(text, /\[알게 된 사실\]\n- 서아: 몸살기 때 기억을 잃는다 \/ 문을 이미 열었다\./);
  assert.doesNotMatch(text, /문신에 묶여/);
  S.reconcileScenes(store, L.prepareMessages(chat.map((m) => (m.id === 'u3' ? { ...m, content: '바뀜.' } : m))));
  assert.match(S.renderScenes(store, 7), /문신에 묶여 있다/);
});

test('a translation on the next line comes with the quote, also for lines saved before', () => {
  const msgs = L.prepareMessages([
    { id: 'k', number: 1, speaker: '하준', role: 'assistant', content: '<speaker="하준">하준 | "I love you, Ari."\n(사랑해, 아리.)</speaker>\n하준이 웃었다.' },
    { id: 'i', number: 2, speaker: '서아', role: 'user', content: '"응."' },
  ]);
  const store = S.emptyStore();
  const applied = S.applyScenes(store, { scenes: [{ end: 2, title: '고백', summary: '고백함.', events: [{ text: '하준이 서아에게 고백함', time: '02:52', why: '서아가 졸라서', quotes: [{ n: '1.1', q: 'I love you', to: '서아' }] }], recollections: [] }] }, msgs, 2);
  assert.ok(!applied.error, applied.error);
  S.commitScenes(store, applied);
  const text = S.renderScenes(store, null);
  assert.match(text, /- \[02:52\] 하준이 서아에게 고백함 \(계기: 서아가 졸라서\)\n  하준 → 서아: "I love you, Ari\." \(사랑해, 아리\.\)/);
  // A line saved by an older version, without its translation.
  store.scenes[0].events[0].quotes[0].text = '<speaker="하준">하준 | "I love you, Ari."';
  assert.equal(S.attachTranslations(store, msgs), 1);
  assert.equal(S.attachTranslations(store, msgs), 0);
  assert.match(S.renderScenes(store, null), /\(사랑해, 아리\.\)/);
});

test('a scene that skips a run of messages is sent back; after that the good scenes before it are kept', () => {
  const many = L.prepareMessages(Array.from({ length: 20 }, (_, i) => ({ id: `m${i + 1}`, number: i + 1, speaker: 'x', content: `문장 ${i + 1}.` })));
  const q = (n) => ({ n: `${n}.1`, q: `문장 ${n}` });
  const result = {
    scenes: [
      { end: 4, title: '좋음', summary: '.', events: [{ text: 'a', quotes: [q(1), q(3)] }], recollections: [] },
      { end: 16, title: '건너뜀', summary: '.', events: [{ text: 'b', quotes: [q(5), q(6)] }], recollections: [] },
      { end: 20, title: '끝', summary: '.', events: [{ text: 'c', quotes: [q(18)] }], recollections: [] },
    ],
  };
  const strict = S.applyScenes(S.emptyStore(), result, many, 20);
  assert.match(strict.error, /건너뜀"\(5~16번\)은 인용 없이 넘어간 메시지가 10개/);
  const part = S.applyScenes(S.emptyStore(), result, many, 20, undefined, { partial: true });
  assert.deepEqual(part.scenes.map((s) => s.title), ['좋음']);
  assert.equal(part.covered.length, 4);
  assert.match(S.buildScenePrompt(S.emptyStore(), many, 20, strict.error)[1].content, /## 지난번 답의 문제/);
});

test("the user's character gets no written-up inner life, only how much they remember", () => {
  const msgs = L.prepareMessages([
    { id: 'a', number: 1, speaker: '하루', role: 'assistant', content: '하루가 웃었다. "사랑해."' },
    { id: 'b', number: 2, speaker: '서아', role: 'user', content: '"응."' },
  ]);
  const store = S.emptyStore();
  const applied = S.applyScenes(store, { scenes: [{ end: 2, title: '고백', summary: '.', events: [{ text: '하루가 고백함', quotes: [{ n: '1.2', q: '사랑해' }] }], recollections: [
    { who: '서아', text: '뿌듯했다.', remembers: 'partial', why: '열', kept: '뭔가 들은 것 같다.' },
    { who: '하루', text: '떨렸다.', remembers: 'full' },
  ] }] }, msgs, 2);
  S.commitScenes(store, applied);
  const text = S.renderScenes(store, null);
  assert.doesNotMatch(text, /뿌듯/);
  assert.match(text, /- 서아 \[흐릿하게만 기억함: 열\] 남은 기억: 뭔가 들은 것 같다\./);
  assert.match(text, /- 하루: 떨렸다\./);
});

test('a reply cut off by the length limit keeps its whole scenes', () => {
  const full = JSON.stringify(goodResult);
  const cut = full.slice(0, full.indexOf('"title":"금주 약속"') + 30);
  const { result, truncated } = S.parseScenesReply(cut);
  assert.equal(truncated, true);
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].title, '약 냄새');
  const store = S.emptyStore();
  const { slice } = S.nextSlice(store, chat, 2, { lead: 0, minVisible: 0 });
  const part = S.applyScenes(store, result, slice, 6, undefined, { partial: true });
  assert.ok(!part.error, part.error);
  assert.equal(part.covered.length, 3, 'the rest is read again next round');
  assert.deepEqual(S.parseScenesReply(full), { result: goodResult, truncated: false });
  assert.deepEqual(S.parseScenesReply('{"events":[{"text":"x"}]'), { result: null, truncated: false });
});

test('facts: something true only for now is dropped; a change reads with when it happened', () => {
  const msgs = L.prepareMessages([
    { id: 'q1', number: 1, speaker: '서아', role: 'user', content: '곧 몸살기가 올 것 같다. "너희 언제부터 연락했어?"' },
    { id: 'q2', number: 2, speaker: '하루', role: 'assistant', content: '"몰랐어?"' },
  ]);
  const store = S.emptyStore();
  const applied = S.applyScenes(store, { scenes: [{ end: 2, time: '24-10-18 (금) 01:57~02:02', title: '연락', summary: '.', events: [{ text: '서아가 묻는다', quotes: [{ n: '1.2', q: '언제부터 연락' }] }], recollections: [], facts: [
    { about: '서아', text: '곧 몸살기가 다가오는 것 같다.', evidence: [{ n: '1.1', q: '몸살기가 올' }] },
    { about: '서아', text: '하루와 하준이 서로 연락하는 사이라는 것을 지금까지 몰랐다.', evidence: [{ n: '1.2', q: '언제부터 연락' }] },
  ] }] }, msgs, 2);
  assert.deepEqual(applied.facts.map((f) => f.text), ['하루와 하준이 서로 연락하는 사이라는 것을 지금까지 몰랐다.']);
  S.commitScenes(store, applied);
  assert.match(S.renderScenes(store, null), /- 서아: 하루와 하준이 서로 연락하는 사이라는 것을 지금까지 몰랐다\. \(24-10-18 \(금\) 01:57\)/);
});

test('facts: "이 장면에서" becomes the scene, an unsaid inner state of the user character is marked as a guess, rewordings are one fact', () => {
  const msgs = L.prepareMessages([
    { id: 'w1', number: 1, speaker: '서아', role: 'user', content: '서아는 이사 온 뒤로 속마음을 숨겨 왔다. "너희 언제부터 연락했어?"' },
    { id: 'w2', number: 2, speaker: '하루', role: 'assistant', content: '"몰랐어?"' },
  ]);
  const store = S.emptyStore();
  const applied = S.applyScenes(store, { scenes: [{ end: 2, time: '24-10-18 (금) 01:57~02:02', title: '너희끼리 연락했어?', summary: '.', events: [{ text: '서아가 묻는다', quotes: [{ n: '1.2', q: '언제부터 연락' }] }], recollections: [], facts: [
    { about: '서아', text: '하루와 하준이 서로 연락하는 사이라는 걸 이 장면에서 처음 알게 됐다.', evidence: [{ n: '1.2', q: '언제부터 연락' }] },
    { about: '서아', text: '하루와 하준이 6년간 서로 연락하는 사이라는 걸 이 장면에서 처음 알게 됐다.', evidence: [{ n: '1.2', q: '언제부터 연락' }] },
    { about: '서아', text: '이사 온 뒤로 속마음을 숨기게 되었다.', evidence: [{ n: '1.1', q: '애정표현을 숨겨' }] },
  ] }] }, msgs, 2);
  assert.deepEqual(applied.facts.map((f) => f.text), [
    "하루와 하준이 서로 연락하는 사이라는 걸 24-10-18 (금) 01:57 '너희끼리 연락했어?'에서 처음 알게 됐다.",
    '이사 온 뒤로 속마음을 숨기게 되었다 (추정)',
  ]);
});

test('group story: who was there, who does not know yet, and who heard about it later', () => {
  const msgs = L.prepareMessages([
    { id: 'g1', number: 1, speaker: '서아', role: 'user', content: '"하준한테는 비밀이야." 서아가 하루에게 속삭였다.' },
    { id: 'g2', number: 2, speaker: '하루', role: 'assistant', content: '하루는 사실 진통약을 다시 먹고 있었다. "약속할게."' },
    { id: 'g3', number: 3, speaker: '서아', role: 'user', content: '저녁에 하준이 돌아왔다. "하루가 약을 다시 먹는대."' },
    { id: 'g4', number: 4, speaker: '하준', role: 'assistant', content: '"뭐?" 하준이 굳었다.' },
  ]);
  const store = S.emptyStore();
  store.cast = ['하루', '하준'];
  store.personas = ['서아'];
  const prompt = S.buildScenePrompt(store, msgs, 4)[1].content;
  assert.match(prompt, /\[등장인물\] 하루, 하준/);
  const first = S.applyScenes(store, { scenes: [{ end: 2, title: '속삭임', summary: '.', present: ['서아', '하루'], events: [{ text: '서아가 비밀을 말함', quotes: [{ n: '1.1', q: '하준한테는 비밀' }, { n: '2.2', q: '약속할게' }] }], recollections: [{ who: '하루', text: '숨겨야 했다.', remembers: 'full' }], facts: [
    { about: '하루', text: '진통약을 다시 먹고 있다', evidence: [{ n: '2.1', q: '진통약을 다시' }], unaware: [] },
  ] }] }, msgs.slice(0, 2), 2);
  assert.deepEqual(first.scenes[0].present, ['하루', '서아']);
  assert.deepEqual(first.facts[0].unaware, ['하준'], 'not in the scene, so he does not know');
  // Never said aloud is no reason; no reason at all is no reason.
  const weak = S.applyScenes(store, { scenes: [{ end: 2, title: '속삭임', summary: '.', present: ['서아', '하루', '하준'], events: [{ text: '서아가 비밀을 말함', quotes: [{ n: '1.1', q: '하준한테는 비밀' }, { n: '2.2', q: '약속할게' }] }], recollections: [], facts: [
    { about: '서아', text: '애정표현을 숨기게 됐다', evidence: [{ n: '1.1', q: '하준한테는 비밀' }], unaware: [{ who: '하루', why: '서아가 직접 말하지 않음' }, '하준'] },
  ] }] }, msgs.slice(0, 2), 2);
  assert.deepEqual(weak.facts[0].unaware, []);
  S.commitScenes(store, first);
  let text = S.renderScenes(store, null, { expand: 0 });
  assert.match(text, /하준: 자리에 없어 모름/);
  assert.match(text, /진통약을 다시 먹고 있다 \[모름: 하준\]/);
  assert.match(S.buildScenePrompt(store, msgs.slice(2), 4)[1].content, /S1 +속삭임 \(모름: 하준\)/);
  const second = S.applyScenes(store, { scenes: [{ end: 4, title: '귀가', summary: '.', present: ['서아', '하준'], events: [{ text: '서아가 하준에게 말함', quotes: [{ n: '3.2', q: '약을 다시 먹는대' }, { n: '4.1', q: '뭐?' }] }], recollections: [], facts: [],
    learned: [{ who: '하준이', scene: 'S1', fact: 'F1', what: '하루가 약을 다시 먹는다는 걸 알게 됨', from: '서아' }] }] }, msgs.slice(2), 4);
  S.commitScenes(store, second);
  assert.deepEqual(store.facts[0].unaware, []);
  text = S.renderScenes(store, null, { expand: 2 });
  assert.match(text, /하준: 나중에 서아에게 들음/);
  assert.match(text, /알게 된 일:\n- 하준\(서아에게 들음\): 하루가 약을 다시 먹는다는 걸 알게 됨/);
  assert.doesNotMatch(text, /모름: 하준\]/);
  // A 1:1 story shows none of this.
  const solo = structuredClone(store);
  solo.cast = ['하루'];
  assert.doesNotMatch(S.renderScenes(solo, null, { expand: 2 }), /모름|자리에 없어|있던 사람/);
});

test('a reveal about an earlier scene is kept on that scene', () => {
  const msgs = L.prepareMessages([
    { id: 'n1', number: 1, speaker: '서아', role: 'user', content: '"나로 모자라?"' },
    { id: 'n2', number: 2, speaker: '하준', role: 'assistant', content: '"그래서 어젯밤에 물었던 거군." 하준이 깨달았다.' },
  ]);
  const store = S.emptyStore();
  S.commitScenes(store, S.applyScenes(store, { scenes: [{ end: 1, title: '나로 모자라', summary: '.', events: [{ text: '서아가 묻는다', quotes: [{ n: '1.1', q: '나로 모자라' }] }], recollections: [], facts: [] }] }, msgs.slice(0, 1), 1));
  assert.match(S.buildScenePrompt(store, msgs.slice(1), 2)[1].content, /S1 +나로 모자라/);
  S.commitScenes(store, S.applyScenes(store, { scenes: [{ end: 2, title: '아침', summary: '.', events: [{ text: '하준이 깨닫는다', quotes: [{ n: '2.1', q: '어젯밤에 물었던' }] }], recollections: [], facts: [],
    later: [{ scene: 'S1', what: "'나로 모자라?'는 약을 끊으면 자기 향수으로 채우려는 계산이었던 것으로 보인다(추정)", by: '하준' }, { scene: 'S9', what: '없는 장면' }] }] }, msgs.slice(1), 2));
  assert.equal(store.scenes[0].later.length, 1);
  const text = S.renderScenes(store, null, { expand: 2 });
  assert.match(text, /나중에 밝혀진 것:\n- '나로 모자라\?'는 약을 끊으면/);
});

test('"짐작은 갔다" in the story: the character is not marked as not knowing, only as guessing', () => {
  const msgs = L.prepareMessages([
    { id: 'p1', number: 1, speaker: '하루', role: 'assistant', content: '하루는 책상 아래 잠긴 서랍에 서아의 일기장을 숨겨 두었다. 등 뒤의 하준은 하루의 눈동자를 놓치지 않았다. 저 녀석이 책상 서랍에 뭘 숨겨두고 전전긍긍하는지 대충 짐작은 갔지만, 입을 놀릴 생각은 없었다.' },
  ]);
  const store = S.emptyStore();
  store.cast = ['하루', '하준'];
  store.personas = ['서아'];
  const applied = S.applyScenes(store, { scenes: [{ end: 1, title: '서랍', summary: '.', present: ['하루', '하준', '서아'], events: [{ text: '하루가 숨김', quotes: [{ n: '1.1', q: '잠긴 서랍' }, { n: '1.3', q: '대충 짐작은' }] }], recollections: [], facts: [
    { about: '하루', text: '책상 아래 잠긴 서랍에 서아의 일기장을 숨겨 두고 있다', evidence: [{ n: '1.1', q: '잠긴 서랍' }], unaware: [{ who: '하준', why: '하루가 몰래 숨김' }] },
  ] }] }, msgs, 1);
  assert.deepEqual(applied.facts[0].unaware, []);
  assert.deepEqual(applied.facts[0].guess, ['하준']);
  S.commitScenes(store, applied);
  assert.match(S.renderScenes(store, null), /일기장을 숨겨 두고 있다 \[짐작만: 하준\]/);
});

test('knowledge marks that cannot be right are dropped: owners know their own story, a guessed fact is visible to others', () => {
  const msgs = L.prepareMessages([
    { id: 'o1', number: 1, speaker: '서아', role: 'user', content: '"너희 언제부터 연락했어?" 서아는 이사 온 뒤로 속마음을 숨겨 왔다.' },
  ]);
  const store = S.emptyStore();
  store.cast = ['하루', '하준'];
  store.personas = ['서아'];
  const applied = S.applyScenes(store, { scenes: [{ end: 1, title: '연락', summary: '.', present: ['하루', '하준', '서아'], events: [{ text: '서아가 묻는다', quotes: [{ n: '1.1', q: '언제부터 연락' }] }], recollections: [], facts: [
    { about: '하루·하준', text: '서아 몰래 서로 연락해 왔으며, 서아는 그 사실을 최근에야 알게 됐다', evidence: [{ n: '1.1', q: '언제부터 연락' }], unaware: [{ who: '하루', why: '서아가 몰랐음' }, { who: '하준', why: '서아가 몰랐음' }] },
    { about: '서아', text: '이사 온 뒤로 속마음을 숨기게 되었다', evidence: [{ n: '1.2', q: '애정표현을 숨겨' }], unaware: [{ who: '하루', why: '서아가 숨김' }] },
  ] }] }, msgs, 1);
  assert.deepEqual(applied.facts.map((f) => f.unaware), [[], []]);
  assert.match(applied.facts[1].text, /\(추정\)$/);
  // Saved before the rule: fixed when the chat is next read.
  store.facts = [{ id: 'F1', about: '하루·하준', text: '연락해 왔다', unaware: ['하루', '하준'], guess: [] }, { id: 'F2', about: '서아', text: '숨긴다 (추정)', unaware: ['하루'] }];
  assert.equal(S.tidyKnowledge(store), 2);
  assert.deepEqual(store.facts.map((f) => f.unaware), [[], []]);
});

function longStore(n) {
  const store = S.emptyStore();
  store.personas = ['서아'];
  for (let i = 1; i <= n; i++) {
    store.scenes.push({ id: `S${i}`, start: i * 3 - 2, end: i * 3, messages: [], time: `24-10-${10 + Math.ceil(i / 10)} 0${i % 10}:00~0${i % 10}:30`, place: null, title: `장면 ${i}`, summary: `장면 ${i} 요약.`, events: [{ text: `사건 ${i}`, importance: i % 5 ? 'major' : 'critical', quotes: [] }], recollections: [], present: [], heardLater: [] });
  }
  store.nextScene = n + 1;
  return store;
}

test('long story: old scenes become a chapter, cut where the model says one stretch of the story ends', () => {
  const store = longStore(49);
  assert.equal(S.nextChapter(store), null, '49 scenes: 30 kept as they are + up to 20 offered');
  store.scenes.push({ ...store.scenes[0], id: 'S50', start: 148, end: 150, title: '장면 50' });
  const offered = S.nextChapter(store);
  assert.equal(offered.length, 20);
  assert.match(S.buildChapterPrompt(store, offered)[1].content, /S5 \|.*\n  - ★ 사건 5/);
  const made = S.applyChapter(store, { end: 'S9', title: '첫 열흘', summary: '셋이 함께 지내기 시작했다. 약을 끊기로 했다.', turns: ['S5 하루가 약을 끊기로 함', 'S14 다음 챕터의 일', ''] }, offered);
  assert.deepEqual(made.chapter.scenes, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']);
  assert.deepEqual(made.chapter.turns, ['S5 하루가 약을 끊기로 함']);
  assert.equal(made.chapter.time, '24-10-11 01:00 ~ 24-10-11 09:30');
  S.commitChapter(store, made.chapter);
  assert.equal(S.nextChapter(store), null, 'S10 onward: 41 left, not yet enough');
  const text = S.renderScenes(store, null, { maxSummaries: 100 });
  assert.match(text, /\[지난 이야기 흐름\]\nC1 24-10-11 01:00 ~ 24-10-11 09:30 — 첫 열흘: 셋이 함께 지내기 시작했다\. 약을 끊기로 했다\.\n  · S5 하루가 약을 끊기로 함/);
  assert.doesNotMatch(text, /장면 3 요약/, 'scenes in a chapter are told by the chapter');
  assert.match(text, /장면 10 요약/);
  // No end, or one too early: a sensible cut instead.
  assert.equal(S.applyChapter(store, { title: 't', summary: 's' }, offered).chapter.scenes.length, 12);
  assert.equal(S.applyChapter(store, { end: 'S2', title: 't', summary: 's' }, offered).chapter.scenes.length, 5);
  // A scene inside the chapter changes underneath: the chapter is made again later.
  store.covered = store.scenes.flatMap((x) => [{ id: `m${x.start}`, h: 'a' }, { id: `m${x.start + 1}`, h: 'a' }, { id: `m${x.end}`, h: 'a' }]);
  store.scenes.forEach((x, i) => (x.messages = store.covered.slice(i * 3, i * 3 + 3)));
  const msgs = store.covered.map((c) => ({ ...c }));
  msgs[10].h = 'changed';
  S.reconcileScenes(store, msgs);
  assert.deepEqual(store.chapters, []);
});

test('the chapter list shrinks old chapters first and keeps every chapter by title', () => {
  const store = longStore(1);
  store.chapters = Array.from({ length: 40 }, (_, i) => ({ id: `C${i + 1}`, scenes: [], time: null, title: `챕터 ${i + 1}`, summary: `${'긴 요약. '.repeat(20)}`, turns: ['S1 일'] }));
  const text = S.renderChapters(store, 700);
  assert.ok(text.length <= 700 + 20, String(text.length));
  for (let i = 1; i <= 40; i++) assert.match(text, new RegExp(`^C${i} 챕터 ${i}`, "m"));
  assert.match(text, /C40 챕터 40: 긴 요약\./);
});

test('facts that piled up about one person are merged; mixed marks or unknown ids are skipped', () => {
  const store = longStore(3);
  for (let i = 1; i <= 16; i++) store.facts.push({ id: `F${i}`, about: '하준', text: `사실 ${i}`, evidence: [], sceneId: `S${(i % 3) + 1}`, when: null, unaware: i === 3 ? ['하루'] : [], guess: [] });
  store.nextFact = 17;
  const next = S.nextFactMerge(store);
  assert.equal(next.about, '하준');
  assert.match(S.buildFactMergePrompt(store, next.about, next.facts)[1].content, /F3 사실 3 \[모름: 하루\]/);
  const made = S.applyFactMerge(store, next.about, next.facts, { merged: [
    { text: '사실 1과 2를 합친 것', from: ['F1', 'F2'] },
    { text: '모름이 섞임', from: ['F3', 'F4'] },
    { text: '없는 번호', from: ['F5', 'F99'] },
    { text: '하나뿐', from: ['F6'] },
    { text: '이미 쓴 것', from: ['F1', 'F7'] },
  ] }, '2026-01-01');
  assert.equal(made, 1);
  const live = S.liveFacts(store);
  assert.equal(live.length, 15);
  const merged = live.find((f) => f.sources);
  assert.deepEqual(merged.sources, ['F1', 'F2']);
  assert.equal(merged.about, '하준');
  // Nothing merged from the same list: it is not asked again until the list grows.
  const again = S.nextFactMerge(store);
  S.applyFactMerge(store, again.about, again.facts, { merged: [] });
  assert.equal(S.nextFactMerge(store), null);
});

test('many facts: everyone keeps their newest ones in the memory text', () => {
  const store = longStore(1);
  for (let i = 1; i <= 120; i++) store.facts.push({ id: `F${i}`, about: i <= 100 ? '하준' : '하루', text: `사실 번호 ${i} 입니다`, evidence: [], sceneId: 'S1' });
  const text = S.renderScenes(store, null, { maxFacts: 30 });
  assert.match(text, /사실 번호 120 입니다/);
  assert.match(text, /사실 번호 100 입니다/);
  assert.doesNotMatch(text, /사실 번호 1 입니다/);
});

test('a hidden thing found out in the same scene ("도대체 언제 한 거야?") is not marked as unknown', () => {
  const msgs = L.prepareMessages([
    { id: 'd1', number: 1, speaker: '서아', role: 'user', content: '서아는 하준의 반응을 보려고 옷 두 벌을 하루 몰래 따로 주문했다.' },
    { id: 'd2', number: 2, speaker: '하루', role: 'assistant', content: '현관에 옷 상자 두 개가 도착했다. 하루가 상자를 내려다보았다. "아리, 도대체 언제 이런 걸 주문한 거야?"' },
  ]);
  const store = S.emptyStore();
  store.cast = ['하루', '하준'];
  store.personas = ['서아'];
  const applied = S.applyScenes(store, { scenes: [{ end: 2, title: '옷 상자', summary: '.', present: ['서아', '하루'], events: [{ text: '주문', quotes: [{ n: '1.1', q: '하루 몰래' }, { n: '2.3', q: '도대체 언제' }] }], recollections: [], facts: [
    { about: '서아', text: '하준의 반응을 보려고 옷 두 벌을 하루 몰래 따로 주문했다', evidence: [{ n: '1.1', q: '하루 몰래' }], unaware: [{ who: '하루', why: '몰래 주문함' }] },
  ] }] }, msgs, 2);
  assert.deepEqual(applied.facts[0].unaware.filter((n) => n === '하루'), []);
});

test('someone who learned a secret in a scene that is undone does not know it any more', () => {
  const msgs = L.prepareMessages([
    { id: 'a1', number: 1, speaker: '서아', role: 'user', content: '서아가 혼자 일기장을 숨겼다.' },
    { id: 'a2', number: 2, speaker: '도윤', role: 'assistant', content: '도윤은 아무것도 몰랐다.' },
    { id: 'a3', number: 3, speaker: '서아', role: 'user', content: '서아가 도윤에게 일기장 얘기를 했다.' },
    { id: 'a4', number: 4, speaker: '도윤', role: 'assistant', content: '도윤이 놀랐다.' },
  ]);
  const store = S.emptyStore();
  store.scenes.push({ id: 'S1', start: 1, end: 2, messages: ['a1', 'a2'], title: '일기장', summary: '서아가 일기장을 숨김.', events: [], recollections: [] },
    { id: 'S2', start: 3, end: 4, messages: ['a3', 'a4'], title: '고백', summary: '서아가 털어놓음.', events: [], recollections: [] });
  store.facts.push({ id: 'F1', about: '서아', text: '서아는 일기장을 숨겼다.', evidence: [], sceneId: 'S1', unaware: ['도윤'] },
    { id: 'F2', about: '서아', text: '서아는 일기를 매일 쓴다.', evidence: [], sceneId: 'S1', unaware: ['도윤'], edited: true });
  store.covered = msgs.map((m) => ({ id: m.id, h: m.h }));
  S.applyLearned(store, [{ who: '도윤', fact: 'F1', in: 'S2', what: '일기장' }, { who: '도윤', fact: 'F2', in: 'S2', what: '일기', guess: true }]);
  assert.deepEqual(store.facts[0].unaware, []);
  assert.deepEqual(store.facts[1].guess, ['도윤']);
  assert.equal(S.changedAt(store, msgs), -1);
  // The scene where he heard it is edited away: he goes back to not knowing; a hand-edited fact keeps what the user set.
  const edited = L.prepareMessages(msgs.map((m) => (m.id === 'a3' ? { ...m, content: '서아는 아무 말도 하지 않았다.' } : m)));
  assert.equal(S.changedAt(store, edited), 2);
  S.reconcileScenes(store, edited);
  assert.equal(store.scenes.length, 1);
  assert.deepEqual(store.facts.find((f) => f.id === 'F1').unaware, ['도윤']);
  assert.equal(store.facts.find((f) => f.id === 'F1').knowHistory, undefined);
  assert.deepEqual(store.facts.find((f) => f.id === 'F2').guess, ['도윤']);
});
