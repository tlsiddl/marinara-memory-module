// node --test tests/test-translate-names.cjs
// Korean notes for memory written in English: names written in Korean from the room's glossary and name table, the
// particle after each fitted, and the prompt asking for one sentence ending. (Invented names.)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../memory-module/lib/translate.cjs');
const A = require('../memory-module/lib/aliases.cjs');

test('glossary lines: Latin side first, Korean pairs only, notes and duplicates left out', () => {
  const pairs = T.parseGlossary('Daniel = 다니엘\n세라 = Sera\nHarbor market = 항구 시장\nfoo\n다니엘 = 대니\nDANIEL = 대니얼\n= 빈칸');
  assert.deepEqual(pairs, [
    { from: 'Daniel', to: '다니엘' },
    { from: 'Sera', to: '세라' },
    { from: 'Harbor market', to: '항구 시장' },
  ]);
  assert.deepEqual(T.parseGlossary([{ original: 'Victor', translation: '빅터' }]), [{ from: 'Victor', to: '빅터' }]);
});

test('korean names: the glossary form wins over the table, the table fills in the rest, longest first', () => {
  const table = A.emptyTable();
  A.addPerson(table, '다니엘 크로우', ['Daniel']);
  A.addPerson(table, '빅터', ['Victor Hale', 'Victor']);
  const names = T.koreanNames([{ from: 'Daniel', to: '다니엘' }], table);
  assert.deepEqual(names.map((n) => `${n.from}>${n.to}`), ['Victor Hale>빅터', 'Daniel>다니엘', 'Victor>빅터']);
});

test('names left in Latin are written in Korean with the particle fitted', () => {
  const names = [{ from: 'Daniel', to: '다니엘' }, { from: 'Sera', to: '세라' }, { from: 'Mark', to: '마크' }];
  assert.equal(T.koreanizeNames('Daniel은 Sera를 쫓고 있음. Mark이 지켜봄.', names, A.replaceName), '다니엘은 세라를 쫓고 있음. 마크가 지켜봄.');
  // A word that only starts with a name is not a name.
  assert.equal(T.koreanizeNames('Seraphine이 웃음', names, A.replaceName), 'Seraphine이 웃음');
  assert.equal(T.koreanizeNames('이미 한글임', names, A.replaceName), '이미 한글임');
});

test('the Korean prompt sends only the names that appear, and asks for noun endings', () => {
  const names = [{ from: 'Daniel', to: '다니엘' }, { from: 'Sera', to: '세라' }];
  const [system, user] = T.buildTranslatePrompt(["Daniel's anger over the forged ledger"], 'ko', { names });
  assert.deepEqual(JSON.parse(user.content), { names: { Daniel: '다니엘' }, lines: ["Daniel's anger over the forged ledger"] });
  assert.match(system.content, /~함/);
  assert.doesNotMatch(system.content, /이름은 쓰인 그대로 둬/);
  // English memory text (Korean → English) is unchanged: no names block.
  assert.deepEqual(JSON.parse(T.buildTranslatePrompt(['다니엘의 분노'], 'en', { names })[1].content), { lines: ['다니엘의 분노'] });
});

test('lines translated with the old Korean prompt are translated again; English keys stay', () => {
  const crypto = require('node:crypto');
  const old = (target, text) => crypto.createHash('sha1').update(`${target}\u0000${text}`).digest('hex').slice(0, 20);
  assert.notEqual(T.key('ko', 'line'), old('ko', 'line'));
  assert.equal(T.key('en', 'line'), old('en', 'line'));
});
