// node --test tests/test-speech-marks.cjs
// 페르소나 말 표시: marks around the user's character's words that stand for a language ("…" English, […] Italian),
// rules that change from a message on, lines saved with their language, and the language said in the memory.
// (Invented names and lines.)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-speech-marks-'));
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const T = require('../memory-module/lib/translate.cjs');

const RULES = [{ from: 1, marks: { '"': 'en', '[': 'it' } }, { from: 10, marks: { '"': 'it', '[': 'en' } }];

test('rules are cleaned: unknown marks and languages dropped, one rule per start, oldest first', () => {
  assert.deepEqual(L.cleanSpeechMarks([{ from: 10, marks: { '"': 'it', '(': 'en', '[': 'xx' } }, { from: 0, marks: { '"': 'en' } }, { from: 3, marks: {} }]), [{ from: 1, marks: { '"': 'en' } }, { from: 10, marks: { '"': 'it' } }]);
  assert.deepEqual(L.speechMarksAt(RULES, 9), { '"': 'en', '[': 'it' });
  assert.deepEqual(L.speechMarksAt(RULES, 10), { '"': 'it', '[': 'en' });
  assert.equal(L.speechMarksAt([{ from: 5, marks: { '"': 'en' } }], 4), null, 'before the first rule: nothing');
});

test('the user\'s bracketed words are read as speech, each line with the language its mark gave at that message', () => {
  const rows = [
    { id: 'a', number: 2, role: 'user', speaker: 'Mina', content: '미나가 웃었다.\n"오늘은 바다 가자." (가자!)\n[좋아, 가 보자. 근데 비 오면?]\n[ooc: 잠깐 쉬어요]' },
    { id: 'b', number: 3, role: 'assistant', speaker: 'Viktor', content: '[Viktor shrugs.] "Fine."' },
    { id: 'c', number: 12, role: 'user', speaker: 'Mina', content: '"Andiamo." [가자.]' },
  ];
  const [a, b, c] = L.prepareMessages(rows, { speechMarks: RULES });
  assert.deepEqual(a.sentences, ['미나가 웃었다.', '"오늘은 바다 가자."', '(가자!)', '"좋아, 가 보자. 근데 비 오면?"', '[ooc: 잠깐 쉬어요]'], 'one bracketed line stays one line; an OOC note is left alone');
  assert.deepEqual(a.speechLangs, [null, 'en', null, 'it', null]);
  assert.equal(b.speechLangs, undefined, 'a reply keeps its own way of writing');
  assert.deepEqual(b.sentences, L.prepareMessages(rows)[1].sentences, 'read exactly as with no rules');
  assert.deepEqual(c.speechLangs, ['it', 'en'], 'from message 10 the marks mean the other languages');
  assert.equal(a.h, L.prepareMessages(rows)[0].h, 'the fingerprint is of the message as written: no rule looks like an edit');
  assert.equal(L.prepareMessages(rows)[0].speechLangs, undefined, 'no rules: as before');
});

test('brackets in any shape of message: between narration, over a line break, inside quotes, with quotes inside', () => {
  const read = (content, marks = { '"': 'en', '[': 'it', '{': 'el' }) => {
    const [m] = L.prepareMessages([{ id: 'x', number: 1, role: 'user', speaker: 'Mina', content }], { speechMarks: [{ from: 1, marks }] });
    return [m.sentences, m.speechLangs || null];
  };
  assert.deepEqual(read('미나가 웃었다. [가자, 지금.] 그리고 문을 열었다.'), [['미나가 웃었다.', '"가자, 지금."', '그리고 문을 열었다.'], [null, 'it', null]]);
  assert.deepEqual(read('[좋아, 가 보자.\n근데 비 오면?]'), [['"좋아, 가 보자. 근데 비 오면?"'], ['it']], 'over a line break: one line of speech');
  assert.deepEqual(read('[좋아.\n\n근데?]')[1], null, 'a blank line inside: not one line of speech');
  assert.deepEqual(read('"그가 [가자]라고 했어."'), [['"그가 [가자]라고 했어."'], ['en']], 'a bracket inside quoted words is part of them');
  assert.deepEqual(read('[그가 "가자"라고 했어.]'), [['"그가 ‘가자’라고 했어."'], ['it']], 'quotes inside a bracket become ‘…’');
  assert.deepEqual(read('{Γεια.} [Ciao.] "Hi."')[1], ['el', 'it', 'en'], 'several marks: each in the order they come');
  assert.deepEqual(read('[ooc: 잠깐 쉬어요]')[1], null);
});

test('lines already saved get their language; a bracketed line saved as narration becomes the user\'s spoken line', () => {
  const messages = L.prepareMessages([{ id: 'm1', number: 4, role: 'user', speaker: 'Mina', content: '"오늘은 바다 가자."\n[좋아, 가 보자. 비 오면?]' }], { speechMarks: RULES });
  const store = { ...S.emptyStore(), scenes: [{ id: 'S1', start: 4, end: 4, messages: [{ id: 'm1' }], events: [{ text: 'Mina hesitates', quotes: [
    { messageId: 'm1', number: 4, sentence: 1, text: '"오늘은 바다 가자."', kind: 'dialogue', by: 'Mina' },
    // As an older reading split and saved it: a piece of the bracket, narration, no speaker.
    { messageId: 'm1', number: 4, sentence: 2, text: '[좋아, 가 보자.', kind: 'narration', by: null },
  ] }] }] };
  assert.equal(S.applySpeechMarks(store, messages), 2);
  const [spoken, bracket] = store.scenes[0].events[0].quotes;
  assert.equal(spoken.lang, 'en');
  assert.deepEqual({ kind: bracket.kind, by: bracket.by, lang: bracket.lang, text: bracket.text }, { kind: 'dialogue', by: 'Mina', lang: 'it', text: '"좋아, 가 보자. 비 오면?"' });
  assert.equal(S.applySpeechMarks(store, messages), 0, 'read again: nothing more to change');
  // Rules removed: a line still found in the source loses its language; the bracketed one, no longer one line there,
  // stays as it was saved.
  assert.equal(S.applySpeechMarks(store, L.prepareMessages([{ id: 'm1', number: 4, role: 'user', speaker: 'Mina', content: '"오늘은 바다 가자."\n[좋아, 가 보자. 비 오면?]' }])), 1);
  assert.equal(spoken.lang, undefined);
  assert.equal(bracket.lang, 'it');
});

test('the memory says the language: in Korean, and in an English or Chinese memory in that language', () => {
  const names = [{ from: '미나', to: 'Mina' }, { from: '빅터', to: 'Viktor' }];
  const line = `  ${S.quoteLine({ text: '"좋아, 가 보자."', kind: 'dialogue', by: '미나', to: '빅터', lang: 'it' })}`;
  assert.equal(line, '  미나 → 빅터 (이탈리아어로): "좋아, 가 보자."');
  assert.equal(T.translateText(line, 'en', () => null, { names }).text, '  Mina → Viktor (in Italian): "좋아, 가 보자."');
  assert.equal(T.translateText(line, 'zh', () => null, { names }).text, '  Mina → Viktor (意大利语): "좋아, 가 보자."');
  const alone = `  ${S.quoteLine({ text: '"Hi."', kind: 'dialogue', lang: 'en' })}`;
  assert.equal(alone, '  (영어로): "Hi."');
  const out = T.translateText(alone, 'en', () => null);
  assert.deepEqual([out.text, out.missing], ['  (in English): "Hi."', []], 'still a quoted line: never sent for translation');
  assert.equal(S.quoteLine({ text: '"Hi."', kind: 'dialogue', by: '미나' }), '미나: "Hi."', 'no language: as before');
});

test('the library edits the rules in 설정 → 언어 and shows each line\'s language', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').split('\r\n').join('\n');
  assert.match(source, /\$\{roomWriteLanguagePicker\(\)\}\n\s+\$\{speechMarksPaper\(\)\}/);
  for (const act of ['speechRowAdd', 'speechRowRemove', 'speechSave']) assert.match(source, new RegExp(`case '${act}':`));
  assert.match(source, /api\('POST', `\/chats\/\$\{chat\}\/speech-marks`, \{ rules:/);
  assert.match(source, /const lang = SPEECH_LANGS\[q\.lang\] \? ` · \$\{SPEECH_LANGS\[q\.lang\]\}로` : '';/);
});
