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
