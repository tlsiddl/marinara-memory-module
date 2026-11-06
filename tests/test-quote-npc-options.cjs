'use strict';
// Room options: quote caps per mode, stored quote kind, and the minor-characters ("extras") coverage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const R = require('../memory-module/lib/recall.cjs');

const dialogues = (n) => Array.from({ length: n }, (_, i) => `"단어 ${i}번째 말입니다."`).join('\n');
const apply = (store, content, quoteMode, extra = {}) => {
  const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'user', speaker: '다온', content }]);
  const quotes = messages[0].sentences.map((s, i) => ({ n: `1.${i + 1}`, q: s.slice(1, 8) }));
  const result = S.applyScenes(store, { scenes: [{ end: 1, title: '시험', summary: '요약', events: [{ text: '다온이 이야기했다', quotes }], ...extra }] }, messages, 1, undefined, { quoteMode });
  assert.ok(!result.error, result.error);
  return result.scenes[0];
};

test('quote limits come from one function per mode', () => {
  assert.equal(S.quoteLimit('dialogue'), 6);
  assert.equal(S.quoteLimit('narration'), 6);
  assert.equal(S.quoteLimit('both'), 8);
  assert.equal(S.quoteLimit(undefined), 6);
  for (const [mode, cap] of [['dialogue', 6], ['narration', 6], ['both', 8]]) {
    assert.equal(apply(S.emptyStore(), dialogues(12), mode).events[0].quotes.length, cap, mode);
  }
});

test('stray quotes placed on an event never pass the mode limit', () => {
  const full = (n) => ({ start: 1, end: 1, events: [{ text: '다온이 이야기했다', importance: 'major', quotes: Array.from({ length: n }, (_, i) => ({ number: 1, sentence: i + 1, text: `"말 ${i}"`, by: '다온', to: null })) }] });
  for (const [mode, cap] of [['dialogue', 6], ['both', 8]]) {
    const scene = full(cap);
    const quote = { number: 1, sentence: 40, text: '"끼어든 말"', by: '다온', to: null };
    S.placeStray([scene], [{ quote }], () => '다온', mode);
    assert.ok(scene.events[0].quotes.length <= cap, mode);
  }
});

test('the prompt wording follows the quote mode', () => {
  const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'user', speaker: '다온', content: '"안녕."' }]);
  const get = (prefs) => S.buildScenePrompt(S.emptyStore(), messages, 1, null, prefs)[0].content;
  for (const mode of ['dialogue', 'narration']) {
    const p = get({ quoteMode: mode });
    assert.match(p, /1~4개, 최대 6개/);
    assert.doesNotMatch(p, /인용 최대 8개|합쳐|12개/);
  }
  const both = get({ quoteMode: 'both' });
  assert.match(both, /대사와 서술 합쳐 2~6개, 최대 8개/);
  assert.match(both, /사건마다 최대 8개/);
  assert.doesNotMatch(both, /12개/);
  assert.doesNotMatch(both, /1~4개/);
});

test('quotes store their kind; older quotes fall back to reading the text', () => {
  const scene = apply(S.emptyStore(), '"소리가 났다."\n창밖에 바람이 불었다.', 'both');
  const [a, b] = scene.events[0].quotes;
  assert.equal(a.kind, 'dialogue');
  assert.equal(b.kind, 'narration');
  assert.match(S.quoteLine(b), /^\(서술\) /);
  // The stored kind wins; an old quote without one is read from its text.
  assert.equal(S.isDialogue({ kind: 'narration', text: '"따옴표로 시작"' }), false);
  assert.equal(S.isDialogue({ kind: 'dialogue', text: '그냥 글' }), true);
  assert.equal(S.isDialogue({ text: '"옛 대사"' }), true);
  assert.equal(S.isDialogue({ text: '옛 서술이다' }), false);
  assert.match(S.quoteLine({ text: '옛 서술이다' }), /^\(서술\) /);
  assert.equal(S.quoteLine({ text: '"옛 대사"' }), '"옛 대사"');
});

test('narration quotes never reach the attribution review', () => {
  const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'assistant', content: '세아가 다온을 바라봤다.\n"기다려."\n세아가 문을 닫았다.' }]);
  const spoken = { messageId: 'm1', number: 1, sentence: 2, text: '"기다려."', kind: 'dialogue', by: '세아', to: null };
  const narrated = { messageId: 'm1', number: 1, sentence: 3, text: '세아가 문을 닫았다.', kind: 'narration', by: '세아', to: null };
  const old = { messageId: 'm1', number: 1, sentence: 1, text: '세아가 다온을 바라봤다.', by: '세아', to: null };
  const scene = { present: ['세아', '다온'], recollections: [], events: [{ quotes: [spoken, narrated, old] }] };
  const found = S.recipientCandidates({ scenes: [scene] }, messages);
  assert.deepEqual(found.map((x) => x.q), [spoken]);
});

test('the expanded prompt asks for minor characters by role; the standard one does not', () => {
  const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'user', speaker: '다온', content: '"안녕."' }]);
  const get = (prefs) => S.buildScenePrompt(S.emptyStore(), messages, 1, null, prefs)[0].content;
  const expanded = get({ npcCoverage: 'expanded' });
  assert.match(expanded, /경비원/);
  assert.match(expanded, /present에 역할 이름/);
  assert.match(expanded, /with에도/);
  assert.match(expanded, /같은 역할은 장면이 달라도 같은 호칭/);
  assert.match(expanded, /지어내지 마/);
  const standard = get({ npcCoverage: 'standard' });
  assert.doesNotMatch(standard, /사용자가 선택한 정리 우선순위/);
  assert.doesNotMatch(standard, /present에 역할 이름/);
  assert.equal(standard, get({}));
});

test('extras are the present people who are neither cast nor the user characters', () => {
  const store = S.emptyStore();
  store.cast = ['세아', '다온'];
  store.personas = ['다온'];
  const scene = apply(store, '"안녕하세요."', 'dialogue', { present: ['세아', '다온', '경비원', '운전기사'] });
  assert.deepEqual(scene.present, ['세아', '다온', '경비원', '운전기사']);
  assert.deepEqual(scene.extras, ['경비원', '운전기사']);
  const none = apply(store, '"안녕하세요."', 'dialogue', { present: ['세아', '다온'] });
  assert.equal('extras' in none, false);
  assert.deepEqual(S.extrasOf(['세아', '웨이터'], store), ['웨이터']);
});

test('the memory text mentions extras only when the room is expanded', () => {
  const store = S.emptyStore();
  store.cast = ['세아', '다온'];
  store.personas = ['다온'];
  const scene = apply(store, '"안녕하세요."', 'dialogue', { present: ['세아', '다온', '경비원', '운전기사'] });
  const render = (npc) => S.renderExpanded(scene, 0, store.personas, S.castOf(store), { npc });
  assert.match(render(true), /주변 인물: 경비원·운전기사/);
  assert.doesNotMatch(render(false), /주변 인물/);
  assert.doesNotMatch(S.renderExpanded(scene, 0, store.personas, S.castOf(store)), /주변 인물/);
  // Long lists are cut short.
  const long = { ...scene, extras: Array.from({ length: 30 }, (_, i) => `단역${i}`) };
  const line = S.renderExpanded(long, 0, store.personas, S.castOf(store), { npc: true }).split('\n').find((l) => l.startsWith('주변 인물'));
  assert.ok(line.length <= '주변 인물: '.length + 60);
  // Recalled scenes and the story overview follow the same switch.
  store.scenes = [scene];
  const picks = [{ id: scene.id }];
  assert.match(R.renderRecalled(store, picks, { npc: true }), /주변 인물/);
  assert.doesNotMatch(R.renderRecalled(store, picks, {}), /주변 인물/);
  assert.match(S.renderScenes(store, null, { npc: true, expand: 2 }), /주변 인물/);
  assert.doesNotMatch(S.renderScenes(store, null, { expand: 2 }), /주변 인물/);
});

test('the library shows extras as 주변 인물', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  const built = fs.readFileSync(path.join(__dirname, '../deliverable/extension.js'), 'utf8');
  const piece = source.match(/\$\{\(s\.extras \|\| \[\]\)\.length \? `([^`]*)` : ''\}/);
  assert.ok(piece, 'scene detail renders extras');
  assert.ok(built.includes(piece[0]) || process.env.SKIP_BUILT === '1', 'the built extension carries it');
  const esc = (x) => String(x).replace(/</g, '&lt;');
  const render = (s) => vm.runInNewContext('`' + piece[1] + '`', { s, esc });
  assert.match(render({ extras: ['경비원', '운전기사'] }), /주변 인물: 경비원, 운전기사/);
  const none = vm.runInNewContext(piece[0].replace(/^\$\{/, '(').replace(/\}$/, ')'), { s: {}, esc });
  assert.equal(none, '');
});
