// node --test tests/test-tracker-recommend.cjs
// Trackers the story suggests: added at once and listed for review, never twice, never again once undone or deleted,
// and not when a tracker already counts the same thing. (Invented names and story.)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Tk = require('../memory-module/lib/trackers.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const L = require('../memory-module/lib/ledger.cjs');

const NOW = '2026-01-01T00:00:00.000Z';
const dateOf = (scene) => ({ S1: '2025-03-02', S2: '2025-03-05' })[scene.id] || null;
const storeWith = (...hints) => ({ scenes: [{ id: 'S1', dateHints: hints }] });

test('model hints are cleaned: a countdown needs its day, a cycle needs its length, people only from the story', () => {
  const person = (n) => (['다니엘', '세라'].includes(n) ? n : '');
  assert.deepEqual(Tk.cleanHint({ type: 'count', label: '만난 지', people: ['다니엘', '세라', '행인'] }, { person }), { type: 'count', label: '만난 지', people: ['다니엘', '세라'] });
  assert.equal(Tk.cleanHint({ type: 'until', label: '시험', people: [] }, { person }), null);
  assert.deepEqual(Tk.cleanHint({ type: 'until', label: '시험', date: '25-03-20' }, { person }), { type: 'until', label: '시험', people: [], date: '2025-03-20' });
  assert.equal(Tk.cleanHint({ type: 'cycle', label: '발정기', every: null }, { person }), null);
  assert.equal(Tk.cleanHint({ type: 'weekly', label: 'x' }, { person }), null);
});

test('a recommended tracker is added at once, listed under applied, and made only once', () => {
  const file = Tk.emptyTrackers();
  const next = Tk.recommend(file, storeWith({ type: 'count', label: '만난 지', people: ['다니엘', '세라'], evidence: [] }), dateOf, NOW);
  assert.equal(next.items.length, 1);
  assert.deepEqual(next.items[0].count, { start: '2025-03-02', firstDay: 1 });
  assert.equal(next.items[0].scope, 'pair');
  const view = Tk.appliedView(next);
  assert.equal(view[0].kind, 'newTracker');
  assert.match(view[0].text, /다니엘·세라 만난 지 .*트래커를 추가함/);
  assert.equal(Tk.recommend(next, storeWith({ type: 'count', label: '만난 지', people: ['다니엘', '세라'] }), dateOf, NOW), next);
});

test('undo removes it and it is not recommended again; deleting it by hand does the same', () => {
  const hint = { type: 'until', label: '시험', people: ['세라'], date: '2025-03-20' };
  const made = Tk.recommend(Tk.emptyTrackers(), storeWith(hint), dateOf, NOW);
  const undone = Tk.undoApplied(made, Tk.appliedView(made)[0].id, NOW);
  assert.equal(undone.items.length, 0);
  assert.equal(Tk.recommend(undone, storeWith(hint), dateOf, NOW).items.length, 0);

  const again = Tk.recommend(Tk.emptyTrackers(), storeWith(hint), dateOf, NOW);
  const edited = Tk.editItem(again, again.items[0].id, { label: '기말 시험' }, NOW);
  const deleted = Tk.deleteItem(edited, edited.items[0].id, NOW);
  assert.equal(Tk.recommend(deleted, storeWith(hint), dateOf, NOW).items.length, 0, 'an edited then deleted one stays declined');
});

test('nothing is added for what a tracker already counts, and at most three per run', () => {
  let file = Tk.addItem(Tk.emptyTrackers(), { type: 'count', label: '다니엘 만난 지', scope: 'person', people: ['다니엘'], count: { start: '2025-03-01' } }, NOW);
  file = Tk.recommend(file, storeWith({ type: 'count', label: '처음 만난 날', people: ['다니엘', '세라'] }), dateOf, NOW);
  assert.equal(file.items.length, 1, 'same kind, a person in common, "만난" in both labels');
  const many = ['시험', '출국', '결혼식', '이사'].map((label, i) => ({ type: 'until', label, people: [], date: `25-04-0${i + 1}` }));
  assert.equal(Tk.recommend(Tk.emptyTrackers(), storeWith(...many), dateOf, NOW).items.length, 3);
});

test('a scene keeps date hints only with evidence from its own sentences, and the prompt asks only when on', () => {
  const slice = L.prepareMessages([
    { id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: '다니엘은 항구에서 세라를 처음 만났다. 세라의 시험은 3월 20일이었다.' },
  ]);
  const prompt = (on) => S.buildScenePrompt(S.emptyStore(), slice, 1, null, { dateHints: on })[0].content;
  assert.match(prompt(true), /날짜 트래커 후보/);
  assert.doesNotMatch(prompt(false), /날짜 트래커 후보/);
  const dates = [
    { type: 'count', label: '만난 지', people: ['다니엘', '세라'], evidence: ['1.1'] },
    { type: 'until', label: '시험', people: ['세라'], date: '25-03-20', evidence: ['1.2'] },
    { type: 'count', label: '이사한 지', people: ['다니엘'], evidence: ['9.9'] },
  ];
  const result = { scenes: [{ end: 1, time: '25-03-02', place: '항구', title: '첫 만남', summary: '요약', present: ['다니엘', '세라'], events: [{ text: '만났다', quotes: [] }], recollections: [], facts: [], dates }] };
  const apply = (opts) => S.applyScenes({ ...S.emptyStore(), cast: ['다니엘', '세라'], personas: [] }, result, slice, 1, undefined, opts).scenes[0];
  assert.equal(apply({}).dateHints, undefined, 'off: ignored');
  const hints = apply({ dateHints: true }).dateHints;
  assert.deepEqual(hints.map((h) => h.label), ['만난 지', '시험'], 'no evidence from this scene: left out');
  assert.deepEqual(hints[1].evidence, [{ number: 1, sentence: 2 }]);
});
