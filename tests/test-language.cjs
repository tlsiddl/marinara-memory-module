// node --test tests/test-language.cjs
// Memory in another language: the chat's language, line-by-line translation of what goes in, quoted lines kept,
// Korean for the library, English dates.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-lang-'));
const T = require('../memory-module/lib/translate.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const M = require('../memory-module/lib/service.cjs');
const X = { ...M._test, renderLedger: M.renderLedger };

test('the language of a chat comes from its latest messages; English lines with Korean beside them count as Korean', () => {
  assert.equal(T.chatLanguage([{ content: '서아가 창문을 열었다. "비 온다."' }]), 'ko');
  assert.equal(T.chatLanguage([{ content: 'Seoa opened the window. "It\'s raining."' }, { content: 'Doyun smiled and handed her an umbrella.' }]), 'en');
  assert.equal(T.chatLanguage([{ content: '하준 | "I love you, Ari." (사랑해, 아리.)\n하준이 웃었다.' }]), 'ko');
  assert.equal(T.chatLanguage([]), 'ko', 'nothing to go on: Korean');
});

test('memory text is translated line by line; headings are fixed, quoted story lines and passages stay as written', () => {
  const text = [
    '[Memory: what the characters remember …]',
    '',
    '[지금 떠오르는 지난 장면]',
    '① 25-07-12 (토) · 거실 · 비 그침 — 바다 약속',
    '셋이 장마가 끝나면 바다에 가기로 약속한다.',
    '사건:',
    '- ★ 하준이 토요일 10시에 버스로 가자고 함',
    '  하준 → 서아: "토요일 열 시, 버스 타고 가자."',
    '  (서술) 서아는 대답 대신 고개를 끄덕였다.',
    '',
    '[원문에서 떠오른 대목]',
    '- (68번) 서아: 일곱 살 때 파도에 휩쓸릴 뻔했어.',
    '',
    '[End of memory. Write the next reply …]',
  ].join('\n');
  const dict = {
    '① 25-07-12 (토) · 거실 · 비 그침 — 바다 약속': '① 25-07-12 (Sat) · living room · rain stopped — The beach promise',
    '셋이 장마가 끝나면 바다에 가기로 약속한다.': 'The three promise to go to the beach once the rainy season ends.',
  };
  const { text: out, missing } = T.translateText(text, 'en', (l) => dict[l] ?? null);
  const lines = out.split('\n');
  assert.equal(lines[2], '[Scenes coming to mind now]');
  assert.equal(lines[3], dict['① 25-07-12 (토) · 거실 · 비 그침 — 바다 약속']);
  assert.equal(lines[5], 'Events:');
  assert.equal(lines[6], '- ★ 하준이 토요일 10시에 버스로 가자고 함', 'not translated yet: stays as it is');
  assert.equal(lines[7], '  하준 → 서아: "토요일 열 시, 버스 타고 가자."', 'a quoted line is the story\'s own words');
  assert.equal(lines[8], '  (narration) 서아는 대답 대신 고개를 끄덕였다.');
  assert.equal(lines[10], '[Passages from the story]');
  assert.equal(lines[11], '- (68번) 서아: 일곱 살 때 파도에 휩쓸릴 뻔했어.', 'a passage from the story stays');
  assert.equal(lines[0], '[Memory: what the characters remember …]');
  assert.deepEqual(missing, ['- ★ 하준이 토요일 10시에 버스로 가자고 함']);
  // Lines already in the target language are left alone.
  assert.deepEqual(T.translateText('Seoa smiled.', 'en', () => null).missing, []);
});

test('a translation answer is only used when it lines up with what was sent', () => {
  assert.deepEqual(T.readTranslation({ lines: ['A', 'B'] }, ['가', '나']), ['A', 'B']);
  assert.equal(T.readTranslation({ lines: ['A'] }, ['가', '나']), null);
  assert.deepEqual(T.readTranslation({ lines: ['', 'B'] }, ['가', '나']), [null, 'B'], 'an empty line keeps the original');
  assert.deepEqual(T.batches(['a'.repeat(30), 'b'.repeat(30), 'c'], 50).map((b) => b.length), [1, 2]);
});

test('a chat written in English gets its memory written in English; other chats are asked nothing new', () => {
  const msgs = [{ role: 'system', content: 'rules' }, { role: 'user', content: 'messages' }];
  assert.match(X.withLanguage(msgs, 'en')[1].content, /\[기록 언어\] 이 채팅은 영어로 진행돼/);
  assert.equal(X.withLanguage(msgs, 'ko'), msgs);
  assert.equal(msgs[1].content, 'messages', 'the prompt itself is not changed');
});

function setUpRoom(chatId, lang) {
  X.saveSettings({ connection: null, chats: { [chatId]: { enabled: true } }, memoryLanguage: lang });
  const store = S.emptyStore();
  store.scenes = [{ id: 'S1', start: 1, end: 2, messages: [], time: '25-07-12 (토)', place: '거실', title: '바다 약속', summary: '셋이 바다에 가기로 약속한다.', events: [{ text: '하준이 토요일에 가자고 함', importance: 'major', quotes: [{ number: 2, sentence: 1, text: '"토요일에 가자."', by: '하준', to: '서아' }] }], recollections: [] }];
  X.saveScenes(chatId, store);
  return store;
}

test('with memory set to English, what goes into the reply is the cached English, quotes as written', () => {
  setUpRoom('room-en', 'en');
  const source = X.renderMemorySource('room-en');
  assert.match(source, /바다 약속/);
  const data = X.loadTranslations('room-en');
  const plan = T.translateText(source, 'en', () => null).missing;
  for (const line of plan) data.items[T.key('en', line)] = `EN(${line.length})`;
  X.saveTranslations('room-en', data);
  const out = X.renderLedger('room-en');
  assert.doesNotMatch(out, /셋이 바다에 가기로/);
  assert.match(out, /EN\(\d+\)/);
  assert.match(out, /하준 → 서아: "토요일에 가자\."/, 'the quoted line is not translated');
  assert.match(out, /Labels in English: "unaware"/);
  // Korean (or auto in a Korean chat): nothing changes.
  X.saveSettings({ ...X.settings(), memoryLanguage: 'auto' });
  X.chatLangs.set('room-en', 'ko');
  assert.equal(X.renderLedger('room-en'), source);
});

test('the lines a reply may need include every scene as it reads when recalled', () => {
  setUpRoom('room-warm', 'en');
  const lines = X.injectionLines('room-warm', 'en');
  assert.ok(lines.some((l) => /셋이 바다에 가기로/.test(l)));
  assert.ok(!lines.some((l) => /토요일에 가자\./.test(l)), 'quoted lines are never sent for translation');
});

test('the library is shown in Korean for a chat whose memory is in English', () => {
  const store = S.emptyStore();
  store.scenes = [{ id: 'S1', start: 1, end: 1, messages: [], title: 'The beach promise', summary: 'They promise to go to the beach.', events: [{ text: 'Hajun suggests Saturday', quotes: [{ number: 1, sentence: 1, text: '"Let\'s go Saturday."' }] }], recollections: [] }];
  store.facts = [{ id: 'F1', about: 'Seoa', text: 'Seoa is afraid of deep water.', evidence: [] }];
  X.saveScenes('room-display', store);
  X.saveSettings({ ...X.settings(), translateQuotes: false });
  X.chatLangs.set('room-display', 'en');
  const texts = X.displayTranslationTexts('room-display');
  assert.ok(texts.includes('The beach promise') && texts.includes('Seoa is afraid of deep water.'));
  assert.ok(!texts.includes('"Let\'s go Saturday."'), 'quoted lines only when asked for');
  X.saveSettings({ ...X.settings(), translateQuotes: true });
  assert.ok(X.displayTranslationTexts('room-display').includes('"Let\'s go Saturday."'));
  X.chatLangs.set('room-display', 'ko');
  X.saveSettings({ ...X.settings(), translateQuotes: false });
  assert.deepEqual(X.displayTranslationTexts('room-display'), [], 'a Korean chat needs nothing');
});

test('English dates are read as the story date; a sentence that mentions a date is not a date line', () => {
  assert.deepEqual(L.parseClock('October 18, 2024'), { date: '2024-10-18', time: null });
  assert.deepEqual(L.dateInText('Fri, Oct 18 2024 | 2:30 PM | Seoul'), { date: '2024-10-18', time: '14:30' });
  assert.deepEqual(L.dateInText('18 October 2024 21:05'), { date: '2024-10-18', time: '21:05' });
  assert.equal(L.dateInText('We met on October 18, 2024.'), null);
  assert.equal(L.dateInText('We met on October 18 2024 at the park near my old house'), null);
  assert.equal(L.parseClock('may I come in'), null);
});
