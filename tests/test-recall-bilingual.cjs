// node --test tests/test-recall-bilingual.cjs
// Memory written in English, messages written in Korean or translated into English: the rare-word search finds the
// scene either way. (Invented names and story.)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../memory-module/lib/recall.cjs');
const L = require('../memory-module/lib/ledger.cjs');

const scene = (id, title, summary, event) => ({ id, start: 1, end: 1, title, summary, events: [{ text: event, quotes: [] }], recollections: [], later: [] });
const list = [
  scene('S1', 'The forged ledger', 'Sera sold Daniel a forged ledger at the harbor market.', 'Daniel found the forgery.'),
  scene('S2', 'Dinner at the inn', 'They ate stew and talked about the weather.', 'Victor paid for dinner.'),
  scene('S3', 'The silver compass', 'Victor hid the silver compass under the floorboards.', 'Victor buried the compass.'),
  scene('S4', 'Rain on the road', 'The carriage was slow in the rain.', 'Everyone got wet.'),
  scene('S5', 'Morning drills', 'Daniel trained the recruits at dawn.', 'Sera watched the drills.'),
];
const korean = {
  'The silver compass': '은 나침반',
  'Victor hid the silver compass under the floorboards.': '빅터가 은 나침반을 마룻바닥 아래에 숨김.',
  'Victor buried the compass.': '빅터가 나침반을 묻음.',
};
const tr = (t) => korean[t] || null;

test('a Korean message finds an English scene through its Korean translation', () => {
  assert.equal(R.directHit(list, '그 나침반 어디다 숨겼어?'), null, 'without the translation nothing matches');
  assert.equal(R.directHit(list, '그 나침반 어디다 숨겼어?', { tr })?.id, 'S3');
});

test('an English (translated) message finds the scene by whole words, not letter pairs', () => {
  assert.equal(R.directHit(list, 'Where did you hide the compass?')?.id, 'S3');
  // Shares only everyday letters and little words with the scenes: no hit.
  assert.equal(R.directHit(list, 'Are you there? I think so.'), null);
});

test('old lines are found through a reply\'s saved Korean translation', () => {
  const messages = L.prepareMessages([
    { id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: 'Victor knelt and pried up the boards. The compass went under the floor.', tr: '빅터가 무릎을 꿇고 판자를 뜯었다. 나침반은 마룻바닥 아래로 들어갔다.' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, number: i + 2, role: 'assistant', speaker: 'Narrator', content: `Day ${i} passed quietly at the inn.` })),
  ]);
  const hits = R.rawHits(messages, '마룻바닥 아래 나침반');
  assert.equal(hits[0]?.number, 1);
  assert.match(hits[0].text, /번역\) .*나침반/);
});
