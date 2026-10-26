// node --test tests/test-vectors.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../memory-module/lib/vectors.cjs');

const scene = (id, title, summary, quote) => ({ id, title, summary, time: null, place: null, events: [{ text: summary, quotes: quote ? [{ text: quote }] : [] }], recollections: [] });

test('a scene is searched piece by piece: its overview, and each event with its lines (the Korean translation first)', () => {
  const docs = V.sceneDocs({ ...scene('S1', '바다', '셋이 바다에 갔다', '"Look at the waves, Ari." (파도 좀 봐, 아리.)'), later: [{ what: '사실 그날이 기념일이었다' }] });
  assert.deepEqual(docs.map((d) => d.key), ['S1', 'S1#0']);
  assert.match(docs[0].text, /기념일/);
  assert.match(docs[1].text, /파도 좀 봐, 아리\./);
  assert.doesNotMatch(docs[1].text, /Look at the waves/);
});

test('a side story inside a long scene is found by its own event, and each sentence of a message searches on its own', () => {
  const index = V.emptyIndex('m');
  const list = Array.from({ length: 10 }, (_, i) => ({ ...scene(`S${i + 1}`, `장면 ${i + 1}`, '.'), events: [{ text: 'a', quotes: [] }, { text: 'b', quotes: [] }] }));
  const docs = list.flatMap(V.sceneDocs);
  // Every piece points one way, except one event of S7 that points another.
  V.putVectors(index, docs, docs.map((d) => (d.key === 'S7#1' ? [0, 0, 1] : [1, 0.1 * (d.key.length % 3), 0])));
  const hits = V.nearest(index, [[1, 0, 0], [0, 0, 1]], list, 3);
  assert.equal(hits[0].id, 'S7');
  assert.equal(hits[0].piece, 1);
  assert.equal(V.indexedScenes(index, list), 10);
  const qs = V.queryTexts([], '왜 냉장고에서 식혔어? 준이 식혀 주는 게 좋아. 하준이 얘기했듯 서아를 위해서 냉기 세부 조절을 배운 거니까.');
  assert.ok(qs.length >= 3, JSON.stringify(qs));
  assert.ok(qs.some((q) => q.startsWith('하준이 얘기했듯')), JSON.stringify(qs));
});

test('vectors are made again only for changed pieces, and an old layout starts over', () => {
  const index = V.emptyIndex('m');
  const a = scene('S1', '바다', '셋이 바다에 갔다');
  const b = scene('S2', '시장', '시장에서 케이크를 샀다');
  const docs = V.staleDocs(index, [a, b]);
  assert.equal(docs.length, 4);
  V.putVectors(index, docs, docs.map(() => [1, 0, 0]));
  assert.equal(V.staleDocs(index, [a, b]).length, 0);
  b.summary = '시장에서 반지를 샀다';
  assert.deepEqual(V.staleDocs(index, [a, b]).map((d) => d.key), ['S2']);
  V.prune(index, [a]);
  assert.deepEqual(Object.keys(index.items).sort(), ['S1', 'S1#0']);
  assert.deepEqual([...V.unpack(index.items.S1.v)], [1, 0, 0]);
  assert.equal(V.usable({ model: 'm', items: {} }, 'm'), false, 'made before pieces: start over');
  assert.equal(V.usable(index, 'm'), true);
});

test('the nearest scene in meaning stands out only when it is clearly closer than the rest', () => {
  const index = V.emptyIndex('m');
  const list = Array.from({ length: 10 }, (_, i) => scene(`S${i + 1}`, `장면 ${i + 1}`, '.'));
  V.putVectors(index, list.map((x) => ({ key: x.id, text: '' })), list.map((_, i) => (i === 6 ? [1, 0.05, 0] : [0.1 * (i % 3), 1, 0.2 * (i % 2)])));
  const hits = V.nearest(index, [1, 0, 0], list, 3);
  assert.equal(hits[0].id, 'S7');
  assert.equal(hits[0].strong, true);
  assert.equal(hits[1].strong, false);
});

test('retrieval models get the prefixes they were trained with', () => {
  assert.match(V.prefixes('Qwen/Qwen3-Embedding-8B').query, /^Instruct: .*\nQuery: $/);
  assert.equal(V.prefixes('BAAI/bge-m3').query, '');
  assert.equal(V.prefixes('intfloat/multilingual-e5-large').doc, 'passage: ');
  const long = [{ role: 'assistant', content: '<speaker="하루">하루 | 브런치 먹고 소파에 누워서 쉬자.</speaker>' }];
  assert.equal(V.queryText(long, '왜 냉장고에서 식혔어? 준이 식혀 주는 게 좋아.'), '왜 냉장고에서 식혔어? 준이 식혀 주는 게 좋아.', 'the message alone, not the scene now');
  assert.match(V.queryText(long, '그거?'), /^그거\? 하루 \| 브런치/, 'a very short message borrows the reply before it');
});

test('sentences that point back at something said before are recognised', () => {
  for (const t of ['하준이 얘기했듯 서아를 위해서 냉기 세부 조절을 배운 거니까', '그때 네가 말했잖아', '예전에 바다 갔던 거 기억나?']) assert.ok(V.POINTS_BACK.test(t), t);
  for (const t of ['왜 냉장고에서 식혔어?', '로스트비프 맛있다']) assert.ok(!V.POINTS_BACK.test(t), t);
});
