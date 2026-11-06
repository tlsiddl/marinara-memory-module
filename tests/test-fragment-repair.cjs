'use strict';
// Quotes stored as pieces of a line by the split before v0.11.48 are made whole again from the message itself, with
// no model call. Invented names and lines only.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

const T = 'Guarda fuori, Dani. Ha appena smesso di piovere. Andiamo.';
const K = '(밖 좀 봐, 다니. 방금 비가 그쳤어. 가자.)';
const NAR = '비가 그친 창밖으로 희미한 빛이 스며들었다. 그는 한참을 말없이 서 있었다.';
const MIXED_LINE = `Vero Alda | <speaker="Vero Alda">"${T}” ${K}</speaker>`;
const FINE_LINE = `Vero Alda | <speaker="Vero Alda">"Va bene, Dani. Resto qui." (좋아, 다니. 여기 있을게.)</speaker>`;
const CONTENT = `${NAR}\n\n${MIXED_LINE}\n\n${FINE_LINE}`;
const WHOLE = `"${T}”`;

const prepare = (content = CONTENT, id = 'a') => L.prepareMessages([{ id, number: 1, role: 'assistant', speaker: 'Vero Alda', content }]);
const paragraph = (content = CONTENT) => content.split(/\n+/).find((p) => p.includes('Guarda fuori'));
/** What the split before v0.11.48 stored from the mixed paragraph, numbered as the old split numbered the message. */
function oldPieces(content = CONTENT) {
  const older = content.split(/\n+/).flatMap((p) => L.splitSentences(p.trim(), true).map((s) => s.trim()).filter(Boolean));
  return older;
}
const pieceQuote = (old, text, extra = {}) => {
  const sentence = old.findIndex((s) => s.includes(text)) + 1;
  assert.ok(sentence > 0, text);
  return { messageId: 'a', number: 1, sentence, text: S.parseLine(old[sentence - 1]).text, by: 'Vero Alda', to: null, ...extra };
};
const sceneOf = (quotes, extra = {}) => ({ id: 'S1', start: 1, end: 1, messages: [{ id: 'a' }], title: 't', summary: '.', present: ['Vero Alda', 'Dani'], recollections: [], events: [{ text: 'e', quotes }], ...extra });
const storeOf = (...scenes) => Object.assign(S.emptyStore(), { cast: ['Vero Alda', 'Dani'], personas: [], scenes });

test('the mixed paragraph really was cut into pieces by the old split', () => {
  const old = oldPieces();
  assert.ok(old.length > prepare()[0].sentences.length);
  assert.ok(old.some((s) => s.startsWith('Ha appena')));
});

test('a piece of a line becomes the whole line with its translation, pointer and speaker kept', () => {
  const msgs = prepare();
  const old = oldPieces();
  const q = pieceQuote(old, 'Guarda fuori', { to: 'Dani' });
  const store = storeOf(sceneOf([q]));
  const result = S.repairFragmentQuotes(store, msgs);
  assert.deepEqual(result, { repaired: 1, merged: 0 });
  const fixed = store.scenes[0].events[0].quotes[0];
  assert.equal(fixed.text, WHOLE);
  assert.equal(fixed.translation, '밖 좀 봐, 다니. 방금 비가 그쳤어. 가자.');
  assert.equal(fixed.sentence, msgs[0].sentences.findIndex((s) => s.includes('Guarda fuori')) + 1);
  assert.equal(fixed.number, 1);
  assert.equal(fixed.messageId, 'a');
  assert.equal(fixed.by, 'Vero Alda');
  assert.equal(fixed.to, 'Dani');
});

test('a piece that is only the translation is repaired too', () => {
  const msgs = prepare();
  const old = oldPieces();
  const q = pieceQuote(old, '방금 비가 그쳤어', { by: null });
  const store = storeOf(sceneOf([q]));
  assert.equal(S.repairFragmentQuotes(store, msgs).repaired, 1);
  const fixed = store.scenes[0].events[0].quotes[0];
  assert.equal(fixed.text, WHOLE);
  assert.equal(fixed.translation, '밖 좀 봐, 다니. 방금 비가 그쳤어. 가자.');
  assert.equal(fixed.by, 'Vero Alda', 'the speaker tag fills a missing speaker');
});

test('several pieces of one line in an event become one quote; the first one keeps its attribution; a manual quote stays', () => {
  const msgs = prepare();
  const old = oldPieces();
  const first = pieceQuote(old, 'Guarda fuori', { by: 'Vero Alda', to: 'Dani' });
  const second = pieceQuote(old, 'Ha appena', { by: 'Dani', to: null });
  const third = pieceQuote(old, '방금 비가 그쳤어', { by: null });
  const manual = pieceQuote(old, 'Andiamo', { by: 'Vero Alda', to: 'Dani', manual: true });
  const other = { messageId: 'a', number: 1, sentence: msgs[0].sentences.findIndex((s) => s.includes('Va bene')) + 1, text: '"Va bene, Dani. Resto qui."', translation: '좋아, 다니. 여기 있을게.', by: 'Vero Alda', to: null };
  const store = storeOf(sceneOf([first, second, manual, third, other]));
  const manualBefore = JSON.stringify(manual);
  const otherBefore = JSON.stringify(other);
  const result = S.repairFragmentQuotes(store, msgs);
  assert.deepEqual(result, { repaired: 3, merged: 2 });
  const quotes = store.scenes[0].events[0].quotes;
  assert.equal(quotes.length, 3);
  assert.equal(quotes[0], first);
  assert.equal(first.text, WHOLE);
  assert.equal(first.by, 'Vero Alda');
  assert.equal(first.to, 'Dani');
  assert.equal(JSON.stringify(quotes[1]), manualBefore, 'the manual quote is never touched or dropped');
  assert.equal(JSON.stringify(quotes[2]), otherBefore);
});

test('a quote that already holds the whole line makes the pieces redundant; loose quotes are repaired as well', () => {
  const msgs = prepare();
  const old = oldPieces();
  const at = msgs[0].sentences.findIndex((s) => s.includes('Guarda fuori')) + 1;
  const full = { messageId: 'a', number: 1, sentence: at, text: WHOLE, translation: '밖 좀 봐, 다니. 방금 비가 그쳤어. 가자.', by: 'Vero Alda', to: 'Dani' };
  const piece = pieceQuote(old, 'Ha appena', { by: 'Dani' });
  const loose = pieceQuote(old, 'Guarda fuori');
  const store = storeOf(sceneOf([full, piece], { loose: [loose] }));
  const result = S.repairFragmentQuotes(store, msgs);
  assert.deepEqual(result, { repaired: 2, merged: 1 });
  assert.deepEqual(store.scenes[0].events[0].quotes, [full]);
  assert.equal(store.scenes[0].loose[0].text, WHOLE);
});

test('manual quotes and scenes edited by hand are left exactly as they are', () => {
  const msgs = prepare();
  const old = oldPieces();
  const manual = pieceQuote(old, 'Guarda fuori', { manual: true });
  const store = storeOf(sceneOf([manual]), sceneOf([pieceQuote(old, 'Ha appena')], { id: 'S2', edited: true, editedAt: '2026-01-01T00:00:00.000Z' }));
  const before = JSON.stringify(store);
  assert.deepEqual(S.repairFragmentQuotes(store, msgs), { repaired: 0, merged: 0 });
  assert.equal(JSON.stringify(store), before);
});

test('quotes of paragraphs whose splitting did not change are untouched (deep-equal)', () => {
  const content = `${NAR}\n\n${FINE_LINE}\n\n"Ciao!" "Ciao a te." (안녕! 너도 안녕.)\n\nHe said, "Stay. Please." (있어. 제발.) Then he left. She waited.`;
  const msgs = prepare(content);
  assert.deepEqual(msgs[0].sentences, content.split(/\n+/).flatMap((p) => L.splitSentences(p.trim(), true).map((s) => s.trim()).filter(Boolean)));
  const quotes = msgs[0].sentences.map((s, i) => ({ messageId: 'a', number: 1, sentence: i + 1, text: S.parseLine(s).text, by: 'Vero Alda', to: null, attributionFp: `fp${i}` }));
  quotes.push({ messageId: 'a', number: 1, sentence: 3, text: 'Resto qui.', by: null, to: null });
  const store = storeOf(sceneOf(quotes), sceneOf([], { id: 'S2', loose: [quotes[1]] }));
  const before = structuredClone(store);
  assert.deepEqual(S.repairFragmentQuotes(store, msgs), { repaired: 0, merged: 0 });
  assert.deepEqual(store, before);
});

test('running it again changes nothing', () => {
  const msgs = prepare();
  const old = oldPieces();
  const store = storeOf(sceneOf([pieceQuote(old, 'Guarda fuori'), pieceQuote(old, 'Ha appena'), pieceQuote(old, '방금 비가 그쳤어')]));
  assert.equal(S.repairFragmentQuotes(store, msgs).repaired, 3);
  const once = structuredClone(store);
  assert.deepEqual(S.repairFragmentQuotes(store, msgs), { repaired: 0, merged: 0 });
  assert.deepEqual(store, once);
  assert.equal(S.attachTranslations(store, msgs), 0);
  assert.deepEqual(store, once);
});

test('a message that was changed or replaced is not repaired', () => {
  const old = oldPieces();
  const piece = () => pieceQuote(old, 'Guarda fuori');
  // another message id
  let store = storeOf(sceneOf([piece()]));
  let before = JSON.stringify(store);
  assert.deepEqual(S.repairFragmentQuotes(store, prepare(CONTENT, 'b')), { repaired: 0, merged: 0 });
  assert.equal(JSON.stringify(store), before);
  // same id, but the paragraph no longer holds that line
  store = storeOf(sceneOf([piece()]));
  before = JSON.stringify(store);
  const edited = CONTENT.replace('Guarda fuori', 'Guarda dentro');
  assert.deepEqual(S.repairFragmentQuotes(store, prepare(edited)), { repaired: 0, merged: 0 });
  assert.equal(JSON.stringify(store), before);
  // a quote without a message id cannot be matched to its message
  const loose = { ...piece() };
  delete loose.messageId;
  store = storeOf(sceneOf([loose]));
  before = JSON.stringify(store);
  assert.deepEqual(S.repairFragmentQuotes(store, prepare()), { repaired: 0, merged: 0 });
  assert.equal(JSON.stringify(store), before);
  // the message is gone
  store = storeOf(sceneOf([piece()]));
  assert.deepEqual(S.repairFragmentQuotes(store, []), { repaired: 0, merged: 0 });
});

test('no model is asked and no network is used', () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('network used'); };
  try {
    const old = oldPieces();
    const store = storeOf(sceneOf([pieceQuote(old, 'Guarda fuori')]));
    assert.equal(S.repairFragmentQuotes(store, prepare()).repaired, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a repaired quote that was already checked is not sent to the model again; one that was not checked stays unchecked', () => {
  const msgs = prepare();
  const old = oldPieces();
  const checked = pieceQuote(old, 'Guarda fuori', { to: 'Dani' });
  const store = storeOf(sceneOf([checked]));
  // Checked before the repair, as the attribution check does after its answer.
  const [candidate] = S.attributionCandidates(store, msgs, 10, new Set(), { force: true });
  assert.ok(candidate, 'the piece is a line the check would look at');
  S.stampAttribution(candidate);
  assert.equal(S.attributionCandidates(store, msgs, 10, new Set()).length, 0, 'checked, so not asked');
  const stamp = checked.attributionFp;
  assert.ok(stamp);
  assert.equal(S.repairFragmentQuotes(store, msgs).repaired, 1);
  assert.equal(checked.text, WHOLE);
  assert.notEqual(checked.attributionFp, undefined);
  const stats = {};
  assert.equal(S.attributionCandidates(store, msgs, 10, new Set(), { stats }).length, 0, 'still not asked after the repair');
  assert.equal(stats.skipped, 1);

  const fresh = storeOf(sceneOf([pieceQuote(old, 'Guarda fuori', { to: 'Dani' })]));
  S.repairFragmentQuotes(fresh, msgs);
  assert.equal(fresh.scenes[0].events[0].quotes[0].attributionFp, undefined, 'never checked: nothing is stamped');
  assert.equal(S.attributionCandidates(fresh, msgs, 10, new Set()).length, 1, 'and it is checked as any unchecked line');
});

test('a fingerprint that did not match before the repair is not made to match', () => {
  const msgs = prepare();
  const old = oldPieces();
  const q = pieceQuote(old, 'Guarda fuori', { to: 'Dani', attributionFp: 'from-some-older-rules' });
  const store = storeOf(sceneOf([q]));
  S.repairFragmentQuotes(store, msgs);
  assert.equal(q.attributionFp, 'from-some-older-rules');
  assert.equal(S.attributionCandidates(store, msgs, 10, new Set()).length, 1);
});
