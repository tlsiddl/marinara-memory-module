'use strict';
// 아는 사람·모르는 사람 (knowledge, built in): the scene prompt's small addition and its parsing, who knows a fact derived
// from the scene's own unaware/heard-later data, later learning and undoing, hand edits that lock, the "(…는 모름)" marker for
// the people of the scene shown now, the route and the screen. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-knowledge-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const K = require('../memory-module/lib/knowledge.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async getById(id) { return { id, name: '방' }; } } });
service.attach(app);
const call = async (key, id, body, params = {}) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id, ...params }, body, query: {} }, reply);
  return { result, error };
};

const DOHA = '도하', IAN = '이안', SOYUL = '소율', JIHU = '지후', NARI = '나리';
const cast = [DOHA, IAN, SOYUL, JIHU];

// ---- the prompt ----
test('prompt: the scene prompt itself asks for knownBy (a small addition), and the optional parts are not involved', () => {
  assert.match(S.SCENE_PROMPT, /knownBy: 숨긴 일·비밀·귓속말처럼 아는 사람이 갈리는 사실일 때만/);
  assert.match(S.SCENE_PROMPT, /"unaware":\[\{"who":"인물","why":"이유","guess":false\}\],"knownBy":\["인물"\]/);
  const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'user', speaker: NARI, content: '"안녕."' }]);
  assert.equal(S.buildScenePrompt(S.emptyStore(), messages, 1, null, {})[0].content, `${S.SCENE_PROMPT}\n\n${S.LINES_PROMPT}`, 'nothing else is added (the story-line part is always there)');
  // It is a few lines, not a new section.
  assert.ok(S.SCENE_PROMPT.match(/knownBy[^\n]*\n/g).length <= 3);
});

// ---- reading the answer ----
const slice = L.prepareMessages([
  { id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: '도하가 금고 열쇠를 서랍 밑에 숨겼다. 이안은 그것을 지켜보았다. 소율은 자리에 없었다. 도하는 창가에 섰다.' },
  { id: 'a2', number: 2, role: 'assistant', speaker: 'Narrator', content: '창밖에는 비가 내렸다. 이안은 우산을 폈다.' },
]);
const fact = (extra) => ({ about: DOHA, text: '금고 열쇠를 서랍 밑에 숨겨 두었다', evidence: ['1.1'], ...extra });
const apply = (facts, present = [DOHA, IAN], personas = []) => {
  const out = S.applyScenes({ ...S.emptyStore(), cast, personas }, { scenes: [{ end: 2, time: null, place: '방', title: '금고', summary: '요약', present, events: [{ text: '숨겼다', quotes: [] }], recollections: [], facts }] }, slice, 2);
  assert.ifError(out.error);
  return out.facts;
};

test('parsing: the model\'s list is matched to the story\'s people; the people who do not know it are never in it', () => {
  const [f] = apply([fact({ knownBy: [IAN, '낯선 사람', DOHA, SOYUL], unaware: [{ who: SOYUL, why: '자리에 없었음' }] })]);
  assert.deepEqual(f.knownBy, [IAN, DOHA], 'a stranger and someone who does not know it are dropped');
  assert.deepEqual(f.unaware, [SOYUL, JIHU], 'the unaware list is what it always was (it is the fact\'s "unknownTo")');
  assert.deepEqual(K.knowledgeOf(f), { knownBy: [IAN, DOHA], unknownTo: [SOYUL, JIHU] });
  // The user's own character (the speaker of the user's messages) may be named.
  const withUser = L.prepareMessages([{ id: 'u1', number: 1, role: 'user', speaker: NARI, content: slice[0].content }, slice[1]]);
  const user = S.applyScenes({ ...S.emptyStore(), cast, personas: [NARI] }, { scenes: [{ end: 2, place: '방', title: '금고', summary: '요약', present: [DOHA, NARI], events: [{ text: '숨겼다', quotes: [] }], recollections: [], facts: [fact({ knownBy: [NARI, DOHA] })] }] }, withUser, 2);
  assert.deepEqual(user.facts[0].knownBy, [NARI, DOHA]);
  // Wrong shapes are ignored: the list is then worked out from the scene, as with no list.
  assert.deepEqual(apply([fact({ knownBy: 'x' })])[0].knownBy, [DOHA, IAN]);
  assert.deepEqual(apply([fact({ knownBy: [null, 3, {}] })])[0].knownBy, [DOHA, IAN]);
  assert.equal(apply([fact({ knownBy: 'x' })], cast)[0].knownBy, undefined, 'nobody to tell apart: still unspecified');
});

test('derivation: with no list, a fact some people do not know is known by the others of its scene; a plain fact stays unspecified', () => {
  const [secret] = apply([fact({})]);
  assert.deepEqual(secret.unaware, [SOYUL, JIHU], 'absent from the scene');
  assert.deepEqual(secret.knownBy, [DOHA, IAN], 'derived from the scene\'s present people');
  // Everyone was there: nothing to tell apart.
  const [plain] = apply([fact({})], cast);
  assert.deepEqual(plain.unaware, []);
  assert.equal('knownBy' in plain, false);
  // A guessed fact is one anybody can see.
  const [guessed] = apply([fact({ text: '금고 열쇠를 서랍 밑에 둔 것으로 보인다(추정)', knownBy: [IAN] })]);
  assert.equal('knownBy' in guessed, false);
  // Those who only suspect it do not know it either.
  const [suspect] = apply([fact({ unaware: [{ who: IAN, why: '숨겼지만 짐작은 함', guess: true }] })]);
  assert.deepEqual(suspect.guess, [IAN]);
  assert.deepEqual(suspect.knownBy, [DOHA]);
});

// ---- learning, undoing, hand edits ----
const world = () => {
  const store = { ...S.emptyStore(), cast, personas: [NARI] };
  store.scenes = [
    { id: 'S1', start: 1, end: 2, title: '금고', summary: '요약', present: [DOHA, IAN], events: [], recollections: [], heardLater: [] },
    { id: 'S2', start: 3, end: 4, title: '소문', summary: '요약', present: [IAN, SOYUL, JIHU], events: [], recollections: [], heardLater: [] },
  ];
  store.facts = [
    { id: 'F1', about: DOHA, text: '금고 열쇠를 서랍 밑에 숨겨 두었다', sceneId: 'S1', unaware: [SOYUL, JIHU], guess: [], knownBy: [DOHA, IAN], edited: false },
    { id: 'F2', about: IAN, text: '비밀 계단을 안다', sceneId: 'S1', unaware: [SOYUL], guess: [], edited: false },
  ];
  return store;
};
const learn = (who, fact, extra = {}) => ({ who, fact, scene: 'S1', in: 'S2', what: '알게 됨', from: IAN, guess: false, ...extra });

test('learning: a person who is told is added to the list that exists; a suspicion is not knowing; a fact with no list gets none', () => {
  const store = world();
  S.applyLearned(store, [learn(SOYUL, 'F1'), learn(JIHU, 'F1', { guess: true }), learn(SOYUL, 'F2')]);
  const [f1, f2] = store.facts;
  assert.deepEqual(f1.knownBy, [DOHA, IAN, SOYUL]);
  assert.deepEqual(f1.unaware, [], 'both stopped being unaware');
  assert.deepEqual(f1.guess, [JIHU], 'the one who only suspects it is not in the list of those who know');
  assert.equal('knownBy' in f2, false, 'an old fact without the field is not given one');
  assert.deepEqual(f2.unaware, []);
});

test('undo: dropping the scene where it was learned puts the old knowledge back, list included', () => {
  const store = world();
  S.applyLearned(store, [learn(SOYUL, 'F1')]);
  S.undoKnowing(store.facts, new Set(['S2']));
  assert.deepEqual([...store.facts[0].unaware].sort(), [JIHU, SOYUL].sort());
  assert.deepEqual(store.facts[0].knownBy, [DOHA, IAN]);
});

test('hand edit: knownBy is the user\'s (locked against later scenes) until emptied; the lists never contradict each other', () => {
  const store = world();
  const f = store.facts[0];
  S.editFact(f, { knownBy: [IAN, SOYUL] });
  assert.equal(f.knownLock, true);
  // Soyul is on both lists (she was unaware): not knowing wins, she is taken off the list that says she knows.
  assert.deepEqual(f.knownBy, [IAN]);
  S.editFact(f, { unaware: [JIHU] });
  assert.deepEqual(f.unaware, [JIHU]);
  S.editFact(f, { knownBy: [IAN, SOYUL] });
  assert.deepEqual(f.knownBy, [IAN, SOYUL], 'no conflict left');
  S.editFact(f, { unaware: [SOYUL, JIHU] });
  assert.deepEqual(f.knownBy, [IAN], 'someone made unaware by hand leaves the list');
  // Later scenes do not touch a list the user wrote.
  S.applyLearned(store, [learn(JIHU, 'F1')]);
  assert.deepEqual(f.knownBy, [IAN]);
  assert.equal(f.unaware.includes(JIHU), false, 'the unaware list still follows the scenes');
  // Emptying it gives it back: unspecified, no lock.
  S.editFact(f, { knownBy: [] });
  assert.equal('knownBy' in f, false);
  assert.equal('knownLock' in f, false);
  // Leaving it out of an edit changes nothing.
  S.editFact(f, { knownBy: [DOHA] });
  S.editFact(f, { text: '다른 말' });
  assert.deepEqual(f.knownBy, [DOHA]);
});

test('merge: a merged fact is known by those who know every part; unspecified when any part does not say', () => {
  assert.deepEqual(K.mergeKnownBy([{ knownBy: [DOHA, IAN] }, { knownBy: [IAN, SOYUL] }]), [IAN]);
  assert.deepEqual(K.mergeKnownBy([{ knownBy: [DOHA] }, {}]), []);
  assert.deepEqual(K.mergeKnownBy([]), []);
  const store = world();
  store.facts = [
    { id: 'F1', about: DOHA, text: '열쇠를 서랍 밑에 숨겼다', sceneId: 'S1', unaware: [SOYUL], guess: [], knownBy: [DOHA, IAN], when: null, evidence: [] },
    { id: 'F2', about: DOHA, text: '열쇠가 낡은 서랍에 있다', sceneId: 'S1', unaware: [SOYUL], guess: [], knownBy: [DOHA, JIHU], when: null, evidence: [] },
  ];
  assert.equal(S.applyFactMerge(store, DOHA, store.facts.slice(), { merged: [{ text: '열쇠는 낡은 서랍 밑에 있다', from: ['F1', 'F2'] }] }), 1);
  const merged = store.facts.at(-1);
  assert.deepEqual(merged.knownBy, [DOHA]);
  assert.deepEqual(merged.unaware, [SOYUL]);
});

test('names: a renamed person is renamed in the list too', () => {
  const table = A.emptyTable();
  A.addPerson(table, DOHA, ['도하찡']);
  const facts = [{ about: '도하찡', knownBy: ['도하찡', IAN], unaware: [SOYUL] }];
  A.using(table, () => A.rewriteDeep(facts));
  assert.deepEqual(facts[0].knownBy, [DOHA, IAN]);
  assert.match(fs.readFileSync(path.join(__dirname, '../memory-module/lib/names.cjs'), 'utf8'), /\['unaware', 'guess', 'knownBy'\]/, 'the rename tool lists the field');
});

// ---- the marker ----
const factOf = (extra) => ({ id: 'F1', about: DOHA, text: '금고 열쇠를 숨겼다', sceneId: 'S1', unaware: [], guess: [], ...extra });
const storeOf = (facts, over = {}) => ({ ...S.emptyStore(), cast, personas: [NARI], facts, scenes: [], ...over });
const render = (store, present) => S.renderScenes(store, null, { present });

test('marker: only people of the scene shown now who do not know it; no marker without the scene\'s people', () => {
  const secret = storeOf([factOf({ unaware: [SOYUL], knownBy: [DOHA, IAN] })]);
  const base = render(secret, undefined);
  assert.equal(base, render(secret, []), 'no people given: the text is what it was before this feature');
  assert.equal(render(secret, [IAN]), base, 'a person who knows it: nothing added');
  assert.match(base, /\[모름: 소율\]/, 'the older mark is still there in a group story');
  assert.equal(render(secret, [IAN, SOYUL]), base, 'already named by the older mark: not repeated');
  const text = render(secret, [IAN, JIHU]);
  assert.equal(text, `${base} (지후는 모름)`, 'present but not on a list that exists');
  // Not on the list of a fact that has none: nothing is said.
  assert.equal(render(storeOf([factOf({})]), [IAN, JIHU]), render(storeOf([factOf({})]), undefined));
  // The fact's own person, the user's character, people who only suspect it and bystanders named by role are never marked.
  const odd = storeOf([factOf({ knownBy: [IAN], guess: [SOYUL] })]);
  assert.equal(render(odd, [DOHA, NARI, SOYUL, '경비원']), render(odd, undefined));
  // A person named in the unaware list of a fact with no list at all is marked when the older mark is not shown (one-person story).
  const solo = storeOf([factOf({ unaware: [IAN] })], { cast: [DOHA] });
  assert.equal(render(solo, [DOHA]), render(solo, undefined), 'IAN is not a person of that story: nobody to tell');
});

test('marker: a few names, then "외 N명"; a fact is marked in its own line only', () => {
  const six = ['가람', '나온', '다솜', '라온', '마루', '바다'];
  const store = storeOf([factOf({ about: six[0], knownBy: [six[0]] }), factOf({ id: 'F2', about: six[0], text: '다른 사실', knownBy: [six[0], six[1], six[2], six[3], six[4], six[5]] })], { cast: six });
  const text = render(store, six);
  assert.match(text, /금고 열쇠를 숨겼다 \(나온·다솜·라온 외 2명은 모름\)/);
  assert.match(text, /다른 사실$/m, 'a fact everybody present knows has no marker');
  assert.equal(K.unknownMarker(factOf({ knownBy: [IAN] }), [SOYUL], { max: 1 }), ' (소율는 모름)');
  assert.equal(K.unknownMarker(null, [IAN]), '');
  assert.equal(K.unknownMarker(factOf({ knownBy: [IAN] }), []), '');
});

// ---- the service ----
const settings = (room) => X.saveSettings({ connection: null, chats: { [room]: { enabled: true } } });
function seedRoom(room, last = [IAN, JIHU]) {
  const store = world();
  store.scenes[1].present = last;
  store.facts[0].knownBy = [DOHA, IAN];
  store.facts[0].unaware = [SOYUL];
  X.saveScenes(room, store);
  settings(room);
  return store;
}

test('service: the memory text tells the people of the last scene what they do not know; nothing changes when no fact has the field', () => {
  seedRoom('ka');
  const text = X.renderMemorySource('ka');
  assert.match(text, /금고 열쇠를 서랍 밑에 숨겨 두었다 \[모름: 소율\] \(지후는 모름\)/);
  assert.doesNotMatch(text, /비밀 계단을 안다 .*\(.*는 모름\)/, 'a fact that does not say who knows it');
  // The same room with the field removed from every fact: the plain text.
  const store = X.loadScenes('ka');
  for (const f of store.facts) delete f.knownBy;
  X.saveScenes('ka', store);
  assert.doesNotMatch(X.renderMemorySource('ka'), /지후는 모름/);
  // Nobody of the last scene is unaware: the text is the same with or without the field.
  seedRoom('kb', [DOHA, IAN]);
  assert.doesNotMatch(X.renderMemorySource('kb'), /는 모름\)/);
});

test('route: knownBy and unknownTo (the unaware list) are saved from the edit box; the fact is marked as edited', async () => {
  seedRoom('kc');
  const edit = (body) => call('PATCH /chats/:id/facts/:factId', 'kc', body, { factId: 'F1' });
  let r = await edit({ knownBy: '이안, 도하, 낯선사람' });
  assert.ifError(r.error);
  assert.deepEqual(r.result.knownBy, [IAN, DOHA, '낯선사람'], 'names are kept as typed (the screen suggests the story\'s people)');
  assert.equal(r.result.knownLock, true);
  r = await edit({ unknownTo: '소율, 지후' });
  assert.deepEqual(r.result.unaware, [SOYUL, JIHU]);
  assert.deepEqual(X.loadScenes('kc').facts[0].unaware, [SOYUL, JIHU]);
  r = await edit({ knownBy: '' });
  assert.equal('knownBy' in r.result, false);
  assert.match((await call('PATCH /chats/:id/facts/:factId', 'kc', { knownBy: 'x' }, { factId: 'F99' })).error, /찾지 못했습니다/);
});

test('translation: the marker travels with its fact line and the English prompt knows the wording', () => {
  const T = require('../memory-module/lib/translate.cjs');
  assert.match(T.TRANSLATE_PROMPT?.en || fs.readFileSync(path.join(__dirname, '../memory-module/lib/translate.cjs'), 'utf8'), /\(A는 모름\)" → "\(A does not know\)"/);
});

// ---- the screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fn = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc });
};

test('screen: 아는 사람 / 모르는 사람 chips (escaped), nothing for a fact that says neither, and the edit box is sent', () => {
  const chips = fn('knowChips');
  assert.equal(chips({ knownBy: [], unaware: [] }), '');
  assert.equal(chips({}), '');
  const html = chips({ knownBy: [DOHA, '<b>'], unaware: [SOYUL] });
  assert.match(html, /아는 사람<\/span><span class="kchip is-known">도하<\/span><span class="kchip is-known">&lt;b&gt;<\/span>/);
  assert.match(html, /모르는 사람<\/span><span class="kchip is-unknown">소율<\/span>/);
  assert.doesNotMatch(chips({ unaware: [SOYUL] }), /아는 사람/);
  assert.match(source, /\$\{knowChips\(f\)\}/);
  assert.match(source, /data-f="knownBy"/);
  assert.match(source, /querySelector\('\[data-f="knownBy"\]'\)/);
  assert.match(source, /\.\.\.\(knownBy \? \{ knownBy: knownBy\.value \} : \{\}\)/);
});
