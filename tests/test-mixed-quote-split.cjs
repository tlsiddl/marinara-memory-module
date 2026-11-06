'use strict';
// A dialogue line whose quote marks do not match (opened with " and closed with ”, or the reverse, or an inch
// mark before it) is one sentence with its translation, not one piece per period. Paragraphs that read fine
// before keep exactly the numbering they had. Invented names and lines only.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

// The splitter as it was before this change (reference for "numbering of other paragraphs is identical").
const OPENERS = { '“': '”', '「': '」', '『': '』', '(': ')' };
const ENDERS = new Set(['.', '!', '?', '…', '。', '？', '！']);
const CLOSERS = new Set(['”', '"', '’', "'", ')', ']', '」', '』']);
function legacySplit(paragraph) {
  const parts = [];
  const stack = [];
  let open = false;
  let start = 0;
  for (let i = 0; i < paragraph.length; i++) {
    const ch = paragraph[i];
    if (ch === '"') open = !open;
    else if (OPENERS[ch]) stack.push(OPENERS[ch]);
    else if (stack.length && ch === stack[stack.length - 1]) stack.pop();
    if (stack.length || open) continue;
    if (ENDERS.has(ch) || (CLOSERS.has(ch) && ENDERS.has(paragraph[i - 1]))) {
      let j = i + 1;
      while (j < paragraph.length && CLOSERS.has(paragraph[j]) && paragraph[j] !== '"') j++;
      if (j < paragraph.length && /\s/.test(paragraph[j])) {
        parts.push(paragraph.slice(start, j));
        start = j;
        i = j;
      }
    }
  }
  const rest = paragraph.slice(start);
  if (open || stack.length) parts.push(...rest.split(/(?<=[.!?…。？！])\s+(?=\S)/u));
  else parts.push(rest);
  return parts;
}
const legacySegment = (text) => String(text).split(/\n+/).map((p) => p.trim()).filter(Boolean).flatMap((p) => legacySplit(p).map((s) => s.trim()).filter(Boolean));

const T = 'Guarda fuori, Dani. Ha appena smesso di piovere. Andiamo.';
const K = '(밖 좀 봐, 다니. 방금 비가 그쳤어. 가자.)';
const NAR = '비가 그친 창밖으로 희미한 빛이 스며들었다. 그는 한참을 말없이 서 있었다.';

const NORMAL = [
  NAR,
  `Vero Alda | <speaker="Vero Alda">"${T}" ${K}</speaker>`,
  `<speaker="Vero Alda">Vero Alda | "${T}" ${K}</speaker>`,
  `“${T}” ${K}`,
  `"${T}"\n${K}`,
  `He said, "Stay. Please." (있어. 제발.) Then he left. She waited.`,
  `「行こう。」 (가자.) 彼は笑った。 彼女も笑った。`,
  `Vero looked at him (surprised. Very.) and nodded. Then silence.`,
  `*Vero smiled.* "Va bene." (좋아.) *Dani nodded.*`,
  `He measured 5 cm. It was fine! Was it? Yes…`,
  `"Ciao!" "Ciao a te." (안녕! 너도 안녕.)`,
  // unclosed in both readings: unchanged plain fallback
  `Dani said "Stay. Please. Now. 그는 말했다. 계속.`,
  `Dani said (Stay. Please. Now. 그는 말했다.`,
];

test('paragraphs that closed their quotes before are numbered exactly as before', () => {
  for (const text of NORMAL) assert.deepEqual(L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: 'Vero Alda', content: text }])[0].sentences, legacySegment(text), text);
  const whole = NORMAL.join('\n\n');
  assert.deepEqual(L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: 'Vero Alda', content: whole }])[0].sentences, legacySegment(whole));
});

const MIXED = [
  ['straight open, curly close', `Vero Alda | <speaker="Vero Alda">"${T}” ${K}</speaker>`],
  ['curly open, straight close', `Vero Alda | <speaker="Vero Alda">“${T}" ${K}</speaker>`],
  ['label inside the tag', `<speaker="Vero Alda">Vero Alda | "${T}” ${K}</speaker>`],
  ['inch mark before the line', `그는 5" 정도의 창을 보며 Vero Alda | <speaker="Vero Alda">"${T}" ${K}</speaker>`],
];

test('a line with mismatched quote marks is the original and its translation, not a piece per period', () => {
  for (const [name, text] of MIXED) {
    const sentences = L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: 'Vero Alda', content: text }])[0].sentences;
    assert.equal(sentences.length, 2, name);
    assert.match(sentences[0], /Andiamo\.[”"]$/, name);
    assert.match(sentences[1], /^\(밖 좀 봐, 다니\. 방금 비가 그쳤어\. 가자\.\)/, name);
  }
});

test('such a line is stored whole with its translation', () => {
  for (const [name, text] of MIXED) {
    const content = `${NAR}\n\n${text}`;
    const msgs = L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: 'Vero Alda', content }]);
    const at = msgs[0].sentences.findIndex((s) => s.includes('Guarda fuori')) + 1;
    const store = Object.assign(S.emptyStore(), { cast: ['Vero Alda'], personas: [] });
    const r = S.applyScenes(store, { scenes: [{ end: 1, title: 't', summary: 's', events: [{ text: 'e', quotes: [{ n: `1.${at}`, q: 'Guarda fuori', by: 'Vero Alda' }] }] }] }, msgs, 1);
    assert.ok(!r.error, r.error);
    const q = r.scenes[0].events[0].quotes[0];
    assert.match(q.text, /["“]Guarda fuori, Dani\. Ha appena smesso di piovere\. Andiamo\.[”"]$/, name);
    assert.equal(q.translation, '밖 좀 봐, 다니. 방금 비가 그쳤어. 가자.', name);
  }
});

test('lines saved from the old split keep their place: not re-pointed, not marked stale, not rewritten', () => {
  const [, text] = MIXED[0];
  const content = `${NAR}\n\n${text}`;
  const old = legacySegment(content);
  const msgs = L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: 'Vero Alda', content }]);
  assert.notDeepEqual(old, msgs[0].sentences, 'numbering of this paragraph did change');
  const store = Object.assign(S.emptyStore(), { cast: ['Vero Alda'], personas: [] });
  const piece = old.findIndex((s) => s.includes('Ha appena')) + 1; // a fragment the old split stored
  const fragment = { messageId: 'a', number: 1, sentence: piece, text: old[piece - 1].replace(/^.*?>/, ''), by: 'Vero Alda', to: null };
  const whole = { messageId: 'a', number: 1, sentence: 3, text: '"Guarda fuori, Dani.', by: 'Vero Alda', to: null };
  store.scenes.push({ id: 'S1', start: 1, end: 1, messages: [{ id: 'a' }], title: 't', summary: '.', present: ['Vero Alda'], recollections: [], events: [{ text: 'e', quotes: [fragment, whole] }] });
  const before = JSON.stringify(store);
  S.attachTranslations(store, msgs);
  assert.equal(JSON.stringify(store), before, 'stored lines that no longer match their pointer are left as they are');
  const lines = S.attributionCandidates(store, msgs, 10, new Set(), { force: true });
  assert.ok(Array.isArray(lines), 'the check still runs over the scene');
  // The message itself is not "changed": its fingerprint is of the stored text, which did not move.
  assert.equal(msgs[0].h, L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: 'Vero Alda', content }])[0].h);
});
