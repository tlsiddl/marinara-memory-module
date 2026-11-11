'use strict';
// The memory's own instruction lines carry the section names in quotes and the labels they explain ("… 줄임");
// in an English memory both follow the memory's language. (Invented text.)
const test = require('node:test');
const assert = require('node:assert/strict');
const Tr = require('../memory-module/lib/translate.cjs');

test('frame line: the "… 줄임" explanation is in English for an English memory', () => {
  const text = '[Memory: x]\n- "[지난 이야기 흐름]" runs from the oldest part; "… 줄임" stands for a stretch left out. "※" lines are exact.\n[End of memory]';
  const out = Tr.translateText(text, 'en', () => null).text;
  assert.ok(!out.includes('줄임'), out);
  assert.ok(out.includes('"… left out"'), out);
});
test('frame line stays untouched for Korean', () => {
  const text = '[Memory: x]\n- "… 줄임" stands for a stretch left out.\n[End of memory]';
  assert.ok(Tr.translateText(text, 'ko', () => null).text.includes('"… 줄임"'));
});
