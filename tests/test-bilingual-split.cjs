'use strict';
// Bilingual dialogue (an original line with its Korean translation) is saved in one form: the original in `text`,
// the translation in `translation`, shown together as `"original" (번역)`. Invented lines only.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

const SPEAKER = '오렌 바스';
const LISTENER = '미라';
const prepare = (content, role = 'assistant') => L.prepareMessages([{ id: 'm1', number: 1, role, speaker: role === 'user' ? LISTENER : SPEAKER, content }]);
function saved(content, n, role) {
  const msgs = prepare(content, role);
  const store = Object.assign(S.emptyStore(), { cast: [SPEAKER], personas: [LISTENER] });
  const result = S.applyScenes(store, { scenes: [{ end: 1, title: '밤', summary: '말했다', events: [{ text: '말했다', quotes: [{ n: `1.${n}`, by: SPEAKER, to: LISTENER }] }] }] }, msgs, 1);
  assert.ok(!result.error, result.error);
  S.commitScenes(store, result);
  return { store, msgs, q: store.scenes[0].events[0].quotes[0] };
}

const SHAPES = [
  ['same line', '"Not tonight." (오늘 밤은 안 돼.)', [1], '"Not tonight."', '오늘 밤은 안 돼.'],
  ['next line', '"Not tonight."\n(오늘 밤은 안 돼.)', [1, 2], '"Not tonight."', '오늘 밤은 안 돼.'],
  ['curly quotes and full-width brackets', '“Fine.”\n（좋아.）', [1, 2], '“Fine.”', '좋아.'],
  ['italic translation', '"Stay." *(있어.)*', [1, 2], '"Stay."', '있어.'],
  ['Italian with ellipsis and dash', '"Va bene... — forse." (그래… 아마도.)', [1, 2], '"Va bene... — forse."', '그래… 아마도.'],
  ['nested quotes', '"She said \'never\' — and meant it…"\n(그녀는 \'절대\'라고 했고 — 진심이었어…)', [1, 2], '"She said \'never\' — and meant it…"', '그녀는 \'절대\'라고 했고 — 진심이었어…'],
  ['several sentences in one line', '"Stay. Please stay." (있어. 제발 있어.)', [1, 2], '"Stay. Please stay."', '있어. 제발 있어.'],
  ['narration ending in the spoken words', 'He leaned in, "Not tonight."\n(오늘 밤은 안 돼.)', [1, 2], 'He leaned in, "Not tonight."', '오늘 밤은 안 돼.'],
  ['a Korean name inside the original', '"Not tonight, 미라." (오늘 밤은 안 돼, 미라.)', [1, 2], '"Not tonight, 미라."', '오늘 밤은 안 돼, 미라.'],
  ['speaker label', `${SPEAKER} | "Not tonight."\n(오늘 밤은 안 돼.)`, [1, 2], '"Not tonight."', '오늘 밤은 안 돼.'],
];

test('every bilingual shape is saved as the original plus its translation, whichever part the model cited', () => {
  for (const [name, content, picks, original, translation] of SHAPES) {
    for (const n of picks) {
      const { q } = saved(content, n);
      assert.equal(q.text, original, `${name} (#1.${n})`);
      assert.equal(q.translation, translation, `${name} (#1.${n})`);
      assert.equal(q.sentence, 1, `${name}: the pointer is the original's sentence`);
      assert.equal(S.quoteText(q), `${original} (${translation})`);
    }
  }
});

test('Korean lines are never split, and a Korean aside is not a translation', () => {
  for (const content of ['"괜찮아, 미라."', '"괜찮아." (웃으며)', '그는 웃었다. (속으로는 울었다.)']) {
    const { q } = saved(content, 1, 'user');
    assert.equal(q.translation, undefined, content);
  }
  assert.deepEqual(S.splitBilingual('"괜찮아." (웃으며)'), { text: '"괜찮아." (웃으며)', translation: null });
  assert.deepEqual(S.splitBilingual('(오늘 밤은 안 돼.)'), { text: '(오늘 밤은 안 돼.)', translation: null }, 'a translation alone has no original to split from');
  const prose = prepare('He smiled. (그는 웃었다.)');
  const store = S.emptyStore();
  const r = S.applyScenes(store, { scenes: [{ end: 1, title: '웃음', summary: '.', events: [{ text: '웃었다', quotes: [{ n: '1.2' }] }] }] }, prose, 1);
  assert.equal(r.scenes[0].events[0].quotes[0].text, '(그는 웃었다.)', 'parenthetical prose after narration stays as it is');
});

test('a translation right after the spoken words inside one sentence is taken out of the original', () => {
  assert.deepEqual(S.splitBilingual('"Stay" (있어) she said, "please." (제발.)'), { text: '"Stay" she said, "please."', translation: '있어 제발.' });
});

test('memory injection and the library show one form', () => {
  const { store, q } = saved('"Not tonight."\n(오늘 밤은 안 돼.)', 2);
  assert.equal(S.quoteLine(q), `${SPEAKER} → ${LISTENER}: "Not tonight." (오늘 밤은 안 돼.)`);
  assert.match(S.renderScenes(store, null), /"Not tonight\." \(오늘 밤은 안 돼\.\)/);
});

test('saved lines in the old forms are brought to the new one once, and running it again changes nothing', () => {
  const content = '"Not tonight."\n(오늘 밤은 안 돼.)\n"Later." (나중에.)';
  const { store, msgs } = saved(content, 1);
  const quotes = store.scenes[0].events[0].quotes;
  // Saved by older versions: the original with the translation inside, the translation alone, the original alone.
  quotes.length = 0;
  quotes.push(
    { messageId: 'm1', number: 1, sentence: 1, text: '"Not tonight." (오늘 밤은 안 돼.)', by: SPEAKER, to: LISTENER },
    { messageId: 'm1', number: 1, sentence: 2, text: '(오늘 밤은 안 돼.)', by: null, to: null },
    { messageId: 'm1', number: 1, sentence: 3, text: '"Later."', by: SPEAKER, to: null },
  );
  assert.equal(S.attachTranslations(store, msgs), 3);
  assert.deepEqual(quotes.map((q) => [q.text, q.translation, q.sentence]), [
    ['"Not tonight."', '오늘 밤은 안 돼.', 1],
    ['"Not tonight."', '오늘 밤은 안 돼.', 1],
    ['"Later."', '나중에.', 3],
  ]);
  const once = JSON.stringify(store);
  assert.equal(S.attachTranslations(store, msgs), 0);
  assert.equal(JSON.stringify(store), once, 'idempotent');
});

test('a line corrected by hand is only split, never re-read from the source', () => {
  const { store, msgs } = saved('"Not tonight."\n(오늘 밤은 안 돼.)', 1);
  const quotes = store.scenes[0].events[0].quotes;
  quotes.length = 0;
  quotes.push(
    { messageId: 'm1', number: 1, sentence: 1, text: '"Not tonight." (오늘 밤은 안 돼.)', by: LISTENER, to: SPEAKER, manual: true },
    { messageId: 'm1', number: 1, sentence: 2, text: '(오늘 밤은 안 돼.)', by: LISTENER, to: null, manual: true },
  );
  assert.equal(S.attachTranslations(store, msgs), 1);
  assert.deepEqual([quotes[0].text, quotes[0].translation, quotes[0].by, quotes[0].to, quotes[0].manual], ['"Not tonight."', '오늘 밤은 안 돼.', LISTENER, SPEAKER, true]);
  assert.deepEqual([quotes[1].text, quotes[1].translation, quotes[1].sentence], ['(오늘 밤은 안 돼.)', undefined, 2]);
});

test('splitting a saved line keeps its source pointer and attribution fingerprint, so it is not checked again', () => {
  const content = '미라가 고개를 들었다.\n"Not tonight, Mira." (오늘 밤은 안 돼, 미라.)\n오렌 바스가 말했다.';
  const msgs = prepare(content);
  const store = Object.assign(S.emptyStore(), { cast: [SPEAKER], personas: [LISTENER] });
  store.scenes.push({ id: 'S1', start: 1, end: 1, messages: [{ id: 'm1' }], title: '밤', summary: '.', present: [SPEAKER, LISTENER], recollections: [], events: [{ text: '거절했다', quotes: [{ messageId: 'm1', number: 1, sentence: 2, text: '"Not tonight, Mira." (오늘 밤은 안 돼, 미라.)', by: SPEAKER, to: LISTENER }] }] });
  const [before] = S.attributionCandidates(store, msgs, 10, new Set(), { force: true });
  S.stampAttribution(before);
  assert.equal(S.attachTranslations(store, msgs), 1);
  const q = store.scenes[0].events[0].quotes[0];
  assert.equal(q.text, '"Not tonight, Mira."');
  const stats = {};
  assert.equal(S.attributionCandidates(store, msgs, 10, new Set(), { stats }).length, 0, 'not "source changed", not asked again');
  assert.equal(stats.skipped, 1);
  const [again] = S.attributionCandidates(store, msgs, 10, new Set(), { force: true });
  assert.equal(again.fingerprint, before.fingerprint);
  assert.equal(again.facts.addressed.length, 1, 'the vocative in the original still counts');
});
