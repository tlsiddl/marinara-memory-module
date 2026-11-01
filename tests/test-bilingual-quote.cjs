'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

const english = '"You spent seven years collecting our junk, Lili. About time your husbands started returning the favor."';
const korean = '(네가 7년 동안 우리 잡동사니를 모아 줬으니, 이제 남편들도 보답을 시작해야지, 리리.)';
const messages = () => L.prepareMessages([{ id: 'one', number: 1, role: 'assistant', content: english + ' ' + korean }]);
function save(indices) {
  const msgs = messages();
  const store = S.emptyStore();
  const result = S.applyScenes(store, { scenes: [{ end: 1, title: '선물', summary: '보답을 약속함', events: [{ text: '남편이 리리에게 보답을 약속했다.', quotes: indices.map(n => ({ n: '1.' + n, by: '카시안' })) }] }] }, msgs, 1);
  assert.ok(!result.error, result.error);
  S.commitScenes(store, result);
  return { store, msgs };
}
test('either side and duplicate selections retain one complete spoken quote', () => {
  const msgs = messages();
  assert.deepEqual(msgs[0].sentences, [english, korean]);
  for (const indices of [[1], [2], [1, 2], [2, 1]]) {
    const { store } = save(indices);
    const quotes = store.scenes[0].events[0].quotes;
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].text, english + ' ' + korean);
    assert.equal(quotes[0].by, '카시안');
    assert.equal(quotes[0].sentence, 1);
    assert.doesNotMatch(S.quoteLine(quotes[0]), /서술/);
  }
});
test('repair only exact old source matches and preserve manually edited quotes', () => {
  const { store, msgs } = save([2]);
  const q = store.scenes[0].events[0].quotes[0];
  q.sentence = 2; q.text = korean; q.by = null;
  assert.equal(S.attachTranslations(store, msgs), 1);
  assert.equal(q.text, english + ' ' + korean);
  assert.equal(q.sentence, 1);
  assert.doesNotMatch(S.quoteLine(q), /서술/);
  assert.equal(S.attachTranslations(store, msgs), 0);
  q.sentence = 2; q.text = '(직접 수정한 글)';
  assert.equal(S.attachTranslations(store, msgs), 0);
  assert.equal(q.text, '(직접 수정한 글)');
});
test('ordinary adjacent parenthetical prose is not attached to narration', () => {
  const msgs = L.prepareMessages([{ id: 'n', number: 1, role: 'assistant', content: 'He smiled. (그는 웃었다.)' }]);
  const store = S.emptyStore();
  const result = S.applyScenes(store, { scenes: [{ end: 1, title: '웃음', summary: '웃었다', events: [{ text: '그가 웃었다', quotes: [{ n: '1.2' }] }] }] }, msgs, 1);
  assert.equal(result.scenes[0].events[0].quotes[0].text, '(그는 웃었다.)');
});
