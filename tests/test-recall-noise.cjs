// node --test tests/test-recall-noise.cjs
// The word searches of recall (a scene the message names, old passages): what is no reason for a match.
// Greek and other alphabets by whole words, numbers whole, a chat's everyday words left out. (Invented story.)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const R = require('../memory-module/lib/recall.cjs');
const Rp = require('../memory-module/lib/reasons.cjs');
const T = require('../memory-module/lib/translate.cjs');

const scene = (id, title, summary, quotes = []) => ({ id, start: 1, end: 1, messages: [], title, summary, events: [{ text: summary, quotes }], recollections: [], later: [] });
const quote = (text) => ({ number: 1, sentence: 1, text, by: 'Mina', to: 'Viktor' });

test('Greek is taken by whole words, accents left off; its little words and two-letter pieces are not words', () => {
  const got = [...R.stems('"Τί λέγεις; Ἐγὼ δὲ οὐκ οἶδα, ἐστὶν ἐκείνη." ἀγορᾶς θάλασσα')];
  assert.ok(got.includes("λεγεισ") && got.includes("αγορασ") && got.includes("θαλασσ"), got.join(' '));
  for (const piece of ['τί', 'δε', 'ἐγ', 'εγ', 'εστιν', 'εκεινη']) assert.ok(!got.includes(piece), piece);
  assert.ok(![...R.words('Τί λέγεις;')].some((w) => w.length === 2), 'no letter pairs of a Greek word');
});

test('a Greek line does not pull up a scene for sharing its little words', () => {
  const list = [
    scene('S1', 'The lighthouse', 'Mina lit the lamp.', [quote('"Τί λέγεις; Οὐκ οἶδα ἐγώ."')]),
    scene('S2', 'The harbor', 'Viktor counted the boats.'),
    scene('S3', 'The market', 'They bought bread.'),
    scene('S4', 'The storm', 'The roof leaked.'),
  ];
  assert.equal(R.directHit(list, '"Τί δὴ ἐγὼ ποιῶ; Οὐκ ἔστιν."'), null);
  assert.equal(R.directHit(list, '"Ἐγὼ μὲν οὐκ οἶδα, σὺ δὲ τί;" (난 모르는데, 넌?)')?.id ?? null, null, 'still nothing shared but little words');
  assert.equal(R.directHit(list, '"Τί λέγεις αὖθις;"')?.id, 'S1', 'a word the line really has ("λέγεις") does');
  assert.equal(R.directHit([...list, scene('S5', 'The lamp', 'Mina kept the λύχνον lit.')], '"Τὸν λύχνον ὁρᾷς;"')?.id, 'S5', 'a real Greek word finds its scene');
});

test('numbers are words of their own: a year whole, a day of a date not at all', () => {
  const got = [...R.stems('25-07-19, room 305, 2024')];
  assert.ok(got.includes('305') && got.includes('2024'), got.join(' '));
  assert.ok(!got.includes('25') && !got.includes('20'), got.join(' '));
});

test('everyday English words are not content words', () => {
  assert.deepEqual([...L.englishWords('More time passed while the other one waited, earlier than ever.')], ['pass', 'wait']);
});

test('a short Korean word alone is no reason for a scene; a solid word is, and two words are', () => {
  const list = [
    scene('S1', 'The night bus', 'Viktor and Mina took the night bus.', [quote('"버스 타고 가자."')]),
    scene('S2', 'The aurora report', 'Mina finished the aurora report.', [quote('"오로라 보고서 끝났어."')]),
    scene('S3', 'Rain', 'It rained all day.'),
    scene('S4', 'Breakfast', 'They ate eggs.'),
  ];
  assert.equal(R.directHit(list, '"타고 싶어."'), null, 'one short word that was in one quote');
  assert.equal(R.directHit(list, '"오로라 일은?"')?.id, 'S2', 'one long word, found along its length');
  assert.equal(R.directHit(list, '"버스 타고 왔어."')?.id, 'S1', 'two words');
});

test('the chat\'s everyday words are counted among the messages in their own letters, and left out', () => {
  const messages = [
    ...Array.from({ length: 30 }, (_, i) => ({ content: `"오늘도 그냥 걸었어 ${i}번."` })),
    ...Array.from({ length: 60 }, (_, i) => ({ content: `Viktor walked to the pier, day ${i}.` })),
    { content: '"오로라 보고서 어딨어?"' },
    { content: '"오로라 보고서 끝났어."' },
  ];
  const common = R.commonWords(messages);
  assert.ok(common.has('걸었'), 'in every Korean message: everyday, though only a third of all messages');
  assert.ok(common.has('pier'));
  assert.ok(!common.has('오로'), 'in two messages: never everyday');
  const list = [scene('S1', 'A walk', 'Viktor walked.', [quote('"그냥 걸었어."')]), scene('S2', 'X', 'Y'), scene('S3', 'Z', 'W'), scene('S4', 'Q', 'R')];
  assert.equal(R.directHit(list, '"그냥 걸었어."')?.id, 'S1', 'without the list: the words match');
  assert.equal(R.directHit(list, '"그냥 걸었어."', { common }), null, 'with it: nothing left to match on');
});

test('an old passage needs two words, or one word found in only a few old messages', () => {
  const msgs = L.prepareMessages([
    { id: 'a', number: 1, speaker: 'Mina', role: 'user', content: '"편하게 앉아. 오로라 얘기 해 줄게."' },
    ...Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, number: i + 2, speaker: 'Mina', role: 'user', content: i < 4 ? `"편하게 해 ${i}."` : `"졸려 ${i}."` })),
  ]);
  assert.deepEqual(R.rawHits(msgs, '"편하게 있어."'), [], 'a word in five old messages, alone');
  assert.equal(R.rawHits(msgs, '"오로라는?"')[0]?.number, 1, 'a word in one old message');
});

test('a reason\'s English word is found where a word starts', () => {
  assert.deepEqual(Rp.termsIn('He picked the block.', 'the lock', R.stems), []);
  assert.deepEqual(Rp.termsIn('The locked door.', 'the lock', R.stems), ['lock']);
});

test('a stretch left out of the overview reads in English in an English memory', () => {
  assert.equal(T.translateText('S1~S3 — 챕터 3개 줄임 (25-07-12~25-07-14)', 'en', () => null).text, 'S1~S3 — 3 chapters left out (25-07-12~25-07-14)');
  assert.match(T.translateText('- "[지난 이야기 흐름]" runs from the oldest part; "… 줄임" stands for a stretch left out. "※" lines', 'en', () => null).text, /"… left out" marks a stretch of it not shown\./);
});
