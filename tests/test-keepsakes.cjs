'use strict';
// 소중한 물건 (keepsakes, switch, off by default): the scene prompt and its parsing, the items worked out from saved scenes,
// user locks, the injected line, the routes, backup, room delete and the screen. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-keepsakes-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const St = require('../memory-module/lib/state.cjs');
const Pl = require('../memory-module/lib/places.cjs');
const Ks = require('../memory-module/lib/keepsakes.cjs');
const B = require('../memory-module/lib/backup.cjs');
const F = require('../memory-module/lib/features.cjs');
const T = require('../memory-module/lib/translate.cjs');
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
const CHATS = path.join(dir, 'memory-module/chats');

const EUNSEO = '은서', RAON = '라온', DAIN = '다인';
const cast = [EUNSEO, RAON, DAIN];
const ev = (...n) => n.map((x) => ({ number: Math.floor(x), sentence: Math.round((x % 1) * 10) }));

// ---- registry and prompt ----
test('registry: a switch, off by default, ready', () => {
  assert.equal(F.FEATURES.keepsakes.default, false);
  assert.equal(F.FEATURES.keepsakes.ready, true);
  assert.match(F.FEATURES.keepsakes.label, /소중한 물건/);
  X.saveSettings({ connection: null, chats: { k1: {} } });
  assert.equal(X.featureOn('k1', 'keepsakes'), false);
  X.saveSettings({ connection: null, chats: { k1: { features: { keepsakes: 'on' } } } });
  assert.equal(X.featureOn('k1', 'keepsakes'), true);
});

const messages = L.prepareMessages([{ id: 'm1', number: 1, role: 'user', speaker: DAIN, content: '"안녕."' }]);
const system = (prefs) => S.buildScenePrompt(S.emptyStore(), messages, 1, null, prefs)[0].content;

test('prompt: off is the scene prompt unchanged; on adds only its own part, after the other optional parts', () => {
  assert.equal(system({ keepsakes: false }), S.SCENE_PROMPT);
  assert.equal(system({}), S.SCENE_PROMPT);
  const on = system({ keepsakes: true });
  assert.equal(on, `${S.SCENE_PROMPT}\n\n${Ks.PROMPT}`);
  assert.match(on, /"keepsakes":\[\{"name":"은반지"/);
  assert.match(on, /평범한 소품은 적지 마/);
  assert.match(on, /지어내지 마/);
  assert.equal(system({ characterState: true, places: true, keepsakes: true }), `${S.SCENE_PROMPT}\n\n${St.PROMPT}\n\n${Pl.PROMPT}\n\n${Ks.PROMPT}`);
  assert.deepEqual(S.buildScenePrompt(S.emptyStore(), messages, 1, null, {})[1], S.buildScenePrompt(S.emptyStore(), messages, 1, null, { keepsakes: true })[1], 'the user message of the call is the same');
});

test('service: the room\'s preferences gain the flag and a little answer room only while on', () => {
  X.saveSettings({ connection: null, chats: { k2: { enabled: true, organize: { detailLevel: 'detailed' } } } });
  assert.deepEqual(X.organizeFor('k2'), { detailLevel: 'detailed' });
  assert.equal(X.sceneTokens('k2'), 8192);
  X.saveSettings({ connection: null, chats: { k2: { enabled: true, organize: { detailLevel: 'detailed' }, features: { keepsakes: 'on', places: 'on' } } } });
  assert.deepEqual(X.organizeFor('k2'), { detailLevel: 'detailed', places: true, keepsakes: true });
  assert.equal(X.sceneTokens('k2'), 8192 + 1024);
});

// ---- reading the answer ----
const slice = L.prepareMessages([
  { id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: '은서는 라온에게 은반지를 건넸다. 약속의 징표라고 했다. 라온은 반지를 목걸이에 달았다. 탁자에는 컵이 있었다.' },
  { id: 'a2', number: 2, role: 'assistant', speaker: 'Narrator', content: '라온은 할머니의 나침반을 꺼냈다. 그것은 유품이었다.' },
]);
const result = (extra) => ({ scenes: [{ end: 2, time: '24-05-01', place: '방', title: '선물', summary: '요약', present: [EUNSEO, RAON], events: [{ text: '건넸다', quotes: [] }], recollections: [], facts: [], ...extra }] });
const apply = (extra, opts) => S.applyScenes({ ...S.emptyStore(), cast, personas: [] }, result(extra), slice, 2, undefined, opts);

test('parsing: read only when asked for, cleaned, owners from the story\'s people, evidence from the scene itself', () => {
  const answer = {
    keepsakes: [
      { name: '은반지', owner: RAON, from: EUNSEO, meaning: '약속의 징표', status: 'kept', event: '목걸이에 달았다', evidence: ['1.1', '1.3'] },
      { name: '나침반', owner: '낯선 사람', from: '할머니', meaning: '유품', status: 'sparkly', evidence: ['2.1'] },
      { name: '컵', owner: RAON, evidence: [] },
      { name: '조개껍데기', owner: DAIN, evidence: ['9.9'] },
      { name: '', owner: RAON, evidence: ['1.1'] },
      { name: '은반지', event: '밤에도 차고 있었다', evidence: ['1.4'] },
    ],
  };
  assert.equal(apply(answer, {}).scenes[0].keepsakes, undefined, 'off: ignored');
  assert.equal(apply(answer, { characterState: true, places: true }).scenes[0].keepsakes, undefined);
  const scene = apply(answer, { keepsakes: true }).scenes[0];
  assert.deepEqual(scene.keepsakes.map((k) => k.name), ['은반지', '나침반'], 'no evidence, unknown evidence and no name leave nothing');
  assert.deepEqual(scene.keepsakes[0], { name: '은반지', owner: RAON, from: EUNSEO, meaning: '약속의 징표', status: 'kept', event: '밤에도 차고 있었다', evidence: [{ number: 1, sentence: 1 }, { number: 1, sentence: 3 }, { number: 1, sentence: 4 }] }, 'the same item twice in a scene is one entry');
  assert.deepEqual(scene.keepsakes[1], { name: '나침반', from: '할머니', meaning: '유품', evidence: [{ number: 2, sentence: 1 }] }, 'a stranger is no owner, an unknown status is dropped, an origin outside the cast is kept');
  assert.doesNotThrow(() => apply({ keepsakes: 'x' }, { keepsakes: true }));
  assert.doesNotThrow(() => apply({ keepsakes: [null, 3, { name: 'x' }] }, { keepsakes: true }));
  assert.equal(apply({ keepsakes: [null, 3, { name: 'x' }] }, { keepsakes: true }).scenes[0].keepsakes, undefined);
  assert.equal(apply({ keepsakes: Array.from({ length: 9 }, (_, i) => ({ name: `물건${i}`, owner: RAON, evidence: ['1.1'] })) }, { keepsakes: true }).scenes[0].keepsakes.length, Ks.PER_SCENE);
});

// ---- the items ----
const sc = (id, end, extra = {}) => ({ id, start: end, end, time: null, events: [], present: [], recollections: [], ...extra });
const storeOf = (...scenes) => ({ ...S.emptyStore(), cast, scenes });
const k = (name, fields = {}, evidence = ev(1.1)) => ({ name, ...fields, evidence });

test('fold: scene order; a later owner, meaning and status win; the origin stays; history, first scene and evidence', () => {
  const store = storeOf(
    sc('S1', 3, { time: '24-05-01', keepsakes: [k('은반지', { owner: RAON, from: EUNSEO, meaning: '약속의 징표', event: '건네받았다' }, ev(2.1, 3.2))] }),
    sc('S2', 6, { keepsakes: [k('은반지', { owner: DAIN, from: RAON, status: 'given', event: '다인에게 주었다' }, ev(5.1))] }),
    sc('S3', 9, { keepsakes: [k('은반지', { meaning: '이제는 우정의 징표' }, ev(8.2)), k('나침반', { owner: RAON, status: 'lost' }, ev(9.1))] }),
  );
  const file = Ks.fold(store, null);
  const ring = file.items.find((i) => i.name === '은반지');
  assert.equal(ring.owner, DAIN);
  assert.equal(ring.from, EUNSEO, 'where it came from is the first thing written');
  assert.equal(ring.meaning, '이제는 우정의 징표');
  assert.equal(ring.status, 'given');
  assert.deepEqual(ring.gotAt, { scene: 'S1', number: 2, date: '24-05-01' });
  assert.deepEqual(ring.history.map((h) => [h.scene, h.event]), [['S1', '건네받았다'], ['S2', '다인에게 주었다']]);
  assert.deepEqual(ring.evidence.map((e) => `${e.scene}:${e.number}.${e.sentence}`), ['S1:2.1', 'S1:3.2', 'S2:5.1', 'S3:8.2']);
  assert.equal(ring.source, 'auto');
  assert.deepEqual(ring.sources, {});
  assert.equal(file.items.find((i) => i.name === '나침반').status, 'lost');
  assert.equal(file.items.find((i) => i.name === '나침반').history[0].event, '잃어버림', 'a status change with no words is still a history line');
  assert.deepEqual(file.items.map((i) => i.name), ['나침반', '은반지'], 'the latest first');
  assert.equal(Ks.fold(store, file).updatedAt, file.updatedAt, 'nothing changed: the same time stamp');
  assert.deepEqual(Ks.fold(store, file), file);
  assert.equal(Ks.fold(null, null).items.length, 0);
  assert.equal(Ks.fold(storeOf(sc('S1', 3)), null).items.length, 0);
});

test('fold: spellings differ only by case, spaces and punctuation; history and evidence are capped; names are never merged by guessing', () => {
  const many = Array.from({ length: 16 }, (_, i) => sc(`S${i + 1}`, i + 2, { keepsakes: [k('은 반지', { event: `일${i}` }, ev(i + 2.1))] }));
  const file = Ks.fold(storeOf(...many, sc('S17', 40, { keepsakes: [k('금반지', { owner: RAON }, ev(40.1)), k('은반지.', { owner: DAIN }, ev(40.2))] })), null);
  assert.equal(file.items.length, 2, '"은 반지" and "은반지." are one; "금반지" is another');
  const ring = file.items.find((i) => i.name === '은 반지');
  assert.equal(ring.history.length, 12);
  assert.equal(ring.history.at(-1).event, '일15');
  assert.equal(ring.evidence.length, 6);
  assert.equal(ring.owner, DAIN);
});

test('edits: a field is locked to the user\'s value until given back; owner names follow the name table; wrong status refused', () => {
  const store = storeOf(sc('S1', 3, { keepsakes: [k('은반지', { owner: RAON, from: EUNSEO, meaning: '약속의 징표' }, ev(2.1))] }));
  let file = Ks.fold(store, null);
  const id = file.items[0].id;
  file = Ks.setField(file, id, 'meaning', '  우정의   징표 ');
  file = Ks.setField(file, id, 'status', 'broken');
  let folded = Ks.fold(store, file);
  assert.equal(folded.items[0].meaning, '우정의 징표');
  assert.equal(folded.items[0].status, 'broken');
  assert.deepEqual(folded.items[0].sources, { meaning: 'user', status: 'user' });
  assert.equal(folded.items[0].source, 'user');
  assert.equal(folded.items[0].owner, RAON, 'the rest follows the scenes');
  // A later scene does not undo the user's value.
  store.scenes.push(sc('S2', 6, { keepsakes: [k('은반지', { owner: DAIN, meaning: '다른 뜻', status: 'kept' }, ev(5.1))] }));
  folded = Ks.fold(store, folded);
  assert.equal(folded.items[0].meaning, '우정의 징표');
  assert.equal(folded.items[0].status, 'broken');
  assert.equal(folded.items[0].owner, DAIN);
  // Given back.
  folded = Ks.fold(store, Ks.unlockField(folded, id, 'meaning'));
  assert.equal(folded.items[0].meaning, '다른 뜻');
  assert.equal(folded.items[0].sources.meaning, undefined);
  assert.throws(() => Ks.setField(file, id, 'status', 'shiny'), /상태는/);
  assert.throws(() => Ks.setField(file, id, 'name', 'x'), /고칠 수 없는/);
  assert.throws(() => Ks.setField(file, 'nope', 'owner', 'x'), /찾지 못했습니다/);
  // A renamed person: the name table decides what is written.
  const table = A.emptyTable();
  A.addPerson(table, RAON, ['라온이']);
  file = A.using(table, () => Ks.setField(folded, id, 'owner', '라온이'));
  assert.equal(file.items[0].user.owner, RAON);
});

test('edits: other names, hand-made items, merge and delete; a deleted item stays away until added again', () => {
  const store = storeOf(sc('S1', 3, { keepsakes: [k('은반지', { owner: RAON }, ev(2.1)), k('은가락지', { owner: RAON, meaning: '같은 것' }, ev(2.2)), k('나침반', { owner: EUNSEO }, ev(2.3))] }));
  let file = Ks.fold(store, null);
  const by = (n) => file.items.find((i) => i.name === n);
  assert.equal(file.items.length, 3);
  // aliases: the other spelling in later scenes then goes to the same item
  assert.throws(() => Ks.setAliases(file, by('은반지').id, '나침반'), /이미 ‘나침반’ 물건의 이름/);
  file = Ks.setAliases(file, by('은반지').id, '반지 · 은반지 · 은가락지'.replace('은가락지', '').trim());
  assert.deepEqual(by('은반지').aliases, ['반지']);
  store.scenes.push(sc('S2', 6, { keepsakes: [k('반지', { status: 'lost', event: '잃어버렸다' }, ev(5.1))] }));
  file = Ks.fold(store, file);
  assert.equal(file.items.find((i) => i.name === '은반지').status, 'lost', 'the alias is the same item');
  assert.equal(file.items.length, 3, 'no new item for the alias');
  // merge: the other item becomes another name; what the user wrote is carried over
  file = Ks.setField(file, by('은가락지').id, 'meaning', '내가 쓴 뜻');
  file = Ks.mergeItems(file, by('은가락지').id, by('은반지').id);
  assert.deepEqual(file.items.map((i) => i.name).sort(), ['나침반', '은반지']);
  assert.ok(by('은반지').aliases.includes('은가락지'));
  assert.equal(by('은반지').user.meaning, '내가 쓴 뜻');
  file = Ks.fold(store, file);
  assert.equal(file.items.length, 2, 'the merged name does not come back');
  assert.throws(() => Ks.mergeItems(file, by('은반지').id, by('은반지').id), /같은 물건/);
  // hand-made items survive a fold with no scenes at all; names are refused twice
  file = Ks.addItem(file, '조개껍데기', '라온');
  assert.throws(() => Ks.addItem(file, '조개껍데기'), /이미 있습니다/);
  assert.throws(() => Ks.addItem(file, '  '), /이름을 적어/);
  assert.throws(() => Ks.addItem(file, '반지'), /이미 있습니다/, 'an alias counts');
  file = Ks.fold(storeOf(), file);
  assert.deepEqual(file.items.map((i) => i.name).sort(), ['은반지', '조개껍데기'], 'the item with another name and the hand-made one stay; the plain one needs its scenes');
  assert.equal(file.items.find((i) => i.name === '조개껍데기').owner, RAON);
  // delete: the notes under that name are ignored from now on, until it is added again
  const shell = by('조개껍데기');
  file = Ks.deleteItem(file, shell.id);
  store.scenes.push(sc('S3', 9, { keepsakes: [k('조개껍데기', { owner: DAIN }, ev(8.1))] }));
  assert.equal(Ks.fold(store, file).items.some((i) => i.name === '조개껍데기'), false);
  file = Ks.addItem(file, '조개껍데기');
  assert.equal(Ks.fold(store, file).items.find((i) => i.name === '조개껍데기').owner, DAIN);
  assert.throws(() => Ks.deleteItem(file, 'nope'), /찾지 못했습니다/);
  // caps
  let big = Ks.emptyKeepsakes();
  for (let i = 0; i < 60; i++) big = Ks.addItem(big, `물건${i}`);
  assert.throws(() => Ks.addItem(big, '하나 더'), /60개까지/);
});

// ---- the injected line ----
const fileOf = (items) => ({ version: 1, items: items.map((i) => ({ aliases: [], history: [], evidence: [], sources: {}, ...i })), hidden: [] });

test('line: the items of the people in the scene (owner, or the one it is from), grouped; within the cap; lost things say so', () => {
  const file = fileOf([
    { id: 'a', name: '은반지', owner: RAON, from: EUNSEO, meaning: '약속의 징표', status: 'kept' },
    { id: 'b', name: '나침반', owner: EUNSEO, from: '', meaning: '유품', status: 'unknown' },
    { id: 'c', name: '조개껍데기', owner: DAIN, from: RAON, meaning: '', status: 'lost' },
    { id: 'd', name: '편지', owner: '', from: EUNSEO, meaning: '', status: 'kept' },
  ]);
  assert.equal(Ks.injectionBlock(file, [RAON]), '[소중한 물건] 라온: 은반지(은서가 준 것, 약속의 징표) · 조개껍데기(다인의 것, 잃어버림)', 'tied to Raon as the one it is from: the owner is named');
  assert.equal(Ks.injectionBlock(file, [RAON, EUNSEO]), '[소중한 물건] 라온: 은반지(은서가 준 것, 약속의 징표) · 조개껍데기(다인의 것, 잃어버림) / 은서: 나침반(유품) · 편지(은서가 준 것)');
  assert.equal(Ks.injectionBlock(file, [DAIN]), '[소중한 물건] 다인: 조개껍데기(라온이 준 것, 잃어버림)', 'the giver\'s name takes 이/가 by its last syllable');
  assert.equal(Ks.injectionBlock(file, [EUNSEO, RAON, DAIN]).indexOf('은서:') < Ks.injectionBlock(file, [EUNSEO, RAON, DAIN]).indexOf('라온:'), true, 'in the order of the scene\'s people');
  assert.equal(Ks.injectionBlock(file, ['낯선 사람']), '');
  assert.equal(Ks.injectionBlock(file, []), '');
  assert.equal(Ks.injectionBlock(null, [RAON]), '');
  assert.equal(Ks.injectionBlock(fileOf([]), [RAON]), '');
  const many = fileOf(Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, name: `기념품${i}`, owner: RAON, from: EUNSEO, meaning: '오래된 약속의 징표', status: 'kept' })));
  const line = Ks.injectionBlock(many, [RAON]);
  assert.ok(line.length <= Ks.INJECT_CHARS && line.startsWith('[소중한 물건] 라온: 기념품0('), line.length);
  assert.equal(T.planLines(line, 'en')[0].kind, 'keep', 'never sent for translation');
  assert.equal(Ks.injectionBlock(file, [RAON], 20), '', 'nothing fits');
});

// ---- the service ----
const settingsFor = (room, features = {}) => X.saveSettings({ connection: null, chats: { [room]: { enabled: true, features } } });
function seedRoom(room) {
  const store = storeOf(
    sc('S1', 3, { title: '선물', summary: '선물을 주고받았다', place: '방', present: [EUNSEO, RAON], events: [{ text: '이야기', quotes: [] }], keepsakes: [k('은반지', { owner: RAON, from: EUNSEO, meaning: '약속의 징표' }, ev(2.1)), k('나침반', { owner: DAIN, meaning: '유품' }, ev(2.2))] }),
    sc('S2', 6, { title: '산책', summary: '산책했다', place: '숲', present: [RAON, EUNSEO], events: [{ text: '이야기', quotes: [] }], keepsakes: [k('은반지', { event: '목에 걸었다' }, ev(5.1))] }),
  );
  X.saveScenes(room, store);
  return store;
}

test('service: off writes and injects nothing; on keeps the items of the last scene\'s people; the file survives switching off', () => {
  seedRoom('ka');
  settingsFor('ka', {});
  assert.equal(X.refreshWorld('ka', X.loadScenes('ka')), false);
  assert.equal(fs.existsSync(path.join(CHATS, 'ka.keepsakes.json')), false);
  const plain = X.renderMemorySource('ka');
  assert.doesNotMatch(plain, /\[소중한 물건\]/);
  settingsFor('ka', { keepsakes: 'on' });
  assert.equal(X.refreshWorld('ka', X.loadScenes('ka')), true);
  const text = X.renderMemorySource('ka');
  assert.match(text, /\[소중한 물건\] 은서: 은반지\(은서가 준 것, 약속의 징표\)|\[소중한 물건\] 라온: 은반지\(은서가 준 것, 약속의 징표\)/);
  assert.doesNotMatch(text.split('\n').find((l) => l.startsWith('[소중한 물건]')), /나침반/, 'Dain is not in the last scene');
  assert.equal(X.refreshWorld('ka', X.loadScenes('ka')), false, 'a second run changes nothing');
  settingsFor('ka', {});
  assert.equal(X.renderMemorySource('ka'), plain, 'off again: the very same text as before the feature');
  assert.ok(fs.existsSync(path.join(CHATS, 'ka.keepsakes.json')));
  settingsFor('ka', { keepsakes: 'on' });
  assert.deepEqual(T.translateText(X.renderMemorySource('ka'), 'en', () => null).missing.filter((l) => l.startsWith('[소중한 물건]')), []);
});

test('service: a hand edit survives the next scan and shows in the line', () => {
  seedRoom('kb');
  settingsFor('kb', { keepsakes: 'on' });
  X.refreshWorld('kb', X.loadScenes('kb'));
  const ring = X.loadKeepsakes('kb').items.find((i) => i.name === '은반지');
  X.saveKeepsakes('kb', A.using('kb', () => Ks.fold(X.loadScenes('kb'), Ks.setField(structuredClone(X.loadKeepsakes('kb')), ring.id, 'meaning', '화해의 징표'))));
  X.refreshWorld('kb', X.loadScenes('kb'));
  assert.equal(X.loadKeepsakes('kb').items.find((i) => i.name === '은반지').meaning, '화해의 징표');
  assert.match(X.renderMemorySource('kb'), /화해의 징표/);
});

test('routes: refused while off; set, unlock, aliases, add, merge and delete; bad input refused', async () => {
  seedRoom('kc');
  settingsFor('kc', {});
  assert.match((await call('POST /chats/:id/keepsakes', 'kc', { action: 'add', name: '편지' })).error, /꺼져 있습니다/);
  assert.deepEqual((await call('GET /chats/:id/world', 'kc')).result.keepList, []);
  assert.equal((await call('GET /chats/:id/world', 'kc')).result.keepsakes, false);
  settingsFor('kc', { keepsakes: 'on' });
  X.refreshWorld('kc', X.loadScenes('kc'));
  let world = (await call('GET /chats/:id/world', 'kc')).result;
  assert.equal(world.keepsakes, true);
  assert.deepEqual(world.keepList.map((i) => i.name).sort(), ['나침반', '은반지']);
  assert.equal(world.sceneTitles.S1, '선물');
  const ring = world.keepList.find((i) => i.name === '은반지');
  const compass = world.keepList.find((i) => i.name === '나침반');
  const post = (body) => call('POST /chats/:id/keepsakes', 'kc', body);
  let r = await post({ action: 'set', id: ring.id, field: 'status', value: 'broken' });
  assert.ifError(r.error);
  assert.equal(r.result.keepList.find((i) => i.id === ring.id).status, 'broken');
  assert.equal(JSON.parse(fs.readFileSync(path.join(CHATS, 'kc.keepsakes.json'), 'utf8')).items.find((i) => i.id === ring.id).user.status, 'broken', 'saved to the file');
  r = await post({ action: 'unlock', id: ring.id, field: 'status' });
  assert.equal(r.result.keepList.find((i) => i.id === ring.id).status, 'unknown');
  r = await post({ action: 'aliases', id: ring.id, value: '반지' });
  assert.deepEqual(r.result.keepList.find((i) => i.id === ring.id).aliases, ['반지']);
  r = await post({ action: 'add', name: '편지', owner: DAIN });
  assert.equal(r.result.keepList.find((i) => i.name === '편지').owner, DAIN);
  const letter = r.result.keepList.find((i) => i.name === '편지');
  r = await post({ action: 'merge', id: letter.id, into: compass.id });
  assert.deepEqual(r.result.keepList.map((i) => i.name).sort(), ['나침반', '은반지']);
  r = await post({ action: 'delete', id: compass.id });
  assert.equal(r.result.keepList.some((i) => i.name === '나침반'), false);
  assert.match((await post({ action: 'x' })).error, /set, unlock, aliases, add, merge, delete/);
  assert.match((await post({ action: 'set', id: ring.id, field: 'name', value: 'y' })).error, /고칠 수 없는/);
  assert.match((await post({ action: 'set', id: ring.id, field: 'status', value: 'shiny' })).error, /상태는/);
  assert.match((await post({ action: 'merge', id: ring.id, into: 'nope' })).error, /찾지 못했습니다/);
  assert.match((await call('POST /chats/:id/keepsakes', '../x', { action: 'add', name: 'a' })).error, /invalid chat id/);
});

test('backup carries the file and the restore preview counts it; a bad file is refused', async () => {
  seedRoom('kd');
  settingsFor('kd', { keepsakes: 'on' });
  X.refreshWorld('kd', X.loadScenes('kd'));
  assert.ok(B.KEYS.includes('keepsakes'));
  const { result } = await call('GET /chats/:id/backup', 'kd', null);
  assert.ok(result.backup.files.keepsakes);
  assert.equal(B.counts(result.backup.files).keepsakes, 2);
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(result.backup))));
  const broken = JSON.parse(JSON.stringify(result.backup));
  broken.files.keepsakes = { version: 1, items: {} };
  broken.header.fileHashes.keepsakes = B.hashOf(broken.files.keepsakes);
  assert.throws(() => B.validate(broken), /keepsakes/);
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, ke: { enabled: true } } });
  const applied = await call('POST /chats/:id/restore/apply', 'ke', { backup: result.backup, crossRoom: true });
  assert.ifError(applied.error);
  assert.equal(X.loadKeepsakes('ke').items.length, 2);
});

test('deleting the room removes the file and its cache', () => {
  seedRoom('kf');
  settingsFor('kf', { keepsakes: 'on' });
  X.refreshWorld('kf', X.loadScenes('kf'));
  const file = path.join(CHATS, 'kf.keepsakes.json');
  assert.ok(fs.existsSync(file));
  X.purgeChatMemory('kf');
  assert.ok(!fs.existsSync(file));
  assert.equal(X.loadKeepsakes('kf').items.length, 0);
});

// ---- the screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fn = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, ...require('./ui-shared.cjs')(source, esc) });
};

test('screen: a card per item with editable fields, the status choice, locks, history, merge and delete', () => {
  const paper = fn('keepsakesPaper');
  assert.equal(paper(null, {}, ''), '');
  assert.equal(paper({ keepsakes: false }, {}, ''), '');
  const w = { keepsakes: true, sceneTitles: { S1: '선물 <장면>' }, keepList: [
    { id: 'ks_1', name: '은반지', aliases: ['반지'], owner: RAON, from: EUNSEO, meaning: '<b>약속</b>', status: 'given', gotAt: { scene: 'S1', date: '24-05-01' }, history: [{ scene: 'S1', event: '건네받았다' }], sources: { meaning: 'user', aliases: 'user' } },
    { id: 'ks_2', name: '나침반', aliases: [], owner: '', from: '', meaning: '', status: 'unknown', gotAt: null, history: [], sources: {} },
  ] };
  const html = paper(w, { keep: '새 물건', keepOwner: '라온' }, '');
  assert.match(html, /소중한 물건 · 2개/);
  assert.match(html, /data-keep-id="ks_1" data-keep-field="owner" value="라온"/);
  assert.match(html, /data-keep-field="meaning" value="&lt;b&gt;약속&lt;\/b&gt;"/, 'escaped');
  assert.match(html, /data-keep-field="aliases" value="반지"/);
  assert.match(html, /<option value="given" selected>남에게 줌<\/option>/);
  assert.match(html, /data-keep-field="status"[^>]*>(<option[^>]*>[^<]*<\/option>){5}<\/select>/);
  assert.equal((html.match(/data-act="keepUnlock"/g) || []).length, 1, 'only the locked field has the button');
  assert.match(html, /data-act="keepUnlock" data-id="ks_1" data-field="meaning">자동으로 되돌리기/);
  assert.match(html, /data-goto-scene="S1"><span class="chip-id">S1<\/span><span class="chip-title">선물 &lt;장면&gt;<\/span>[^]*<small>처음<\/small>[^]*처음 얻은 날 24-05-01/);
  assert.match(html, /<li>건네받았다<div class="record-links">[^]*data-goto-scene="S1"/);
  assert.match(html, /장면에 연결되지 않은 물건/);
  assert.match(html, /data-keep-merge="ks_1"[^>]*>[^]*<option value="ks_2">나침반/);
  assert.match(html, /id="keepNewName" value="새 물건"/);
  assert.match(html, /id="keepNewOwner" value="라온"/);
  assert.match(paper(w, {}, 'keepDelete:ks_2'), /한 번 더 누르면 지웁니다/);
  assert.match(paper({ keepsakes: true, keepList: [] }, {}, ''), /아직 없습니다/);
});

test('screen: the tab shows it, every action is wired, and the off notice names the three features', () => {
  assert.match(source, /\$\{keepsakesPaper\(world, worldForm, armed\)\}/);
  for (const act of ['keepUnlock', 'keepAdd', 'keepDelete']) assert.match(source, new RegExp(`case '${act}'`), act);
  assert.match(source, /dataset\?\.keepField/);
  assert.match(source, /dataset\?\.keepMerge/);
  assert.match(source, /<b>소중한 물건<\/b>·<b>날짜·주기 트래커<\/b>가 모두 꺼져 있습니다/);
  assert.match(source, /'addressDelete', 'stateReset', 'placeDelete', 'keepDelete', 'noteDelete', 'trackerDelete', 'trackerDropStart']\.includes\(actName\)\) armed = ''/);
  assert.match(source, /id === 'keepNewName'/);
});

// ---- through the real scene call ----
test('the scene call: asked only while on, answered keepsakes (and a knownBy list) are kept on the saved scene', async () => {
  // Eight newer messages stay visible, so the first four are folded.
  const messages = L.prepareMessages([
    { id: 'f1', number: 1, role: 'assistant', speaker: '은서', content: '은서는 라온에게 은반지를 건넸다. 약속의 징표라고 했다.' },
    { id: 'f2', number: 2, role: 'user', speaker: '라온', content: '라온은 반지를 목걸이에 달았다. 다인은 자리에 없었다.' },
    { id: 'f3', number: 3, role: 'assistant', speaker: '은서', content: '은서가 웃었다.' },
    { id: 'f4', number: 4, role: 'assistant', speaker: '은서', content: '둘은 방을 나섰다.' },
    ...Array.from({ length: 8 }, (_, i) => ({ id: 'g' + i, number: 5 + i, role: 'assistant', speaker: '은서', content: '다음 이야기.' })),
  ]);
  const run = async (room) => {
    const seen = [];
    const model = { provider: { async chatComplete(prompt) {
      seen.push(prompt[0].content);
      return { content: JSON.stringify({ scenes: [{ end: 4, time: '24-05-01', place: '방', title: '선물', summary: '은서가 반지를 건넸다', present: [EUNSEO, RAON],
        events: [{ text: '건넸다', quotes: [{ n: '1.1' }] }, { text: '달았다', quotes: [{ n: '2.1' }] }, { text: '나섰다', quotes: [{ n: '3.1' }, { n: '4.1' }] }], recollections: [],
        facts: [{ about: EUNSEO, text: '반지를 라온에게 주었다', evidence: [{ n: '1.1', q: '은반지를 건넸다' }], unaware: [{ who: DAIN, why: '자리에 없었음' }], knownBy: [EUNSEO, RAON] }],
        keepsakes: [{ name: '은반지', owner: RAON, from: EUNSEO, meaning: '약속의 징표', status: 'kept', event: '목걸이에 달았다', evidence: ['2.1'] }] }] }) };
    } } };
    const store = S.emptyStore();
    store.cast = cast;
    await X.foldScenes(room, store, messages, 8, model, { cancel: false }, { minPending: 1 });
    return { seen, store };
  };
  settingsFor('kg', {});
  const off = await run('kg');
  assert.equal(off.seen[0].includes(Ks.PROMPT), false, 'not asked while off');
  assert.equal(off.store.scenes[0].keepsakes, undefined, 'and not read');
  assert.match(off.seen[0], /knownBy: 숨긴 일/, 'the knowledge line is part of the usual prompt');
  assert.deepEqual(off.store.facts[0].knownBy, [EUNSEO, RAON]);
  assert.deepEqual(off.store.facts[0].unaware, [DAIN]);
  settingsFor('kh', { keepsakes: 'on' });
  const on = await run('kh');
  assert.ok(on.seen[0].includes(Ks.PROMPT), 'asked while on');
  assert.deepEqual(on.store.scenes[0].keepsakes, [{ name: '은반지', owner: RAON, from: EUNSEO, meaning: '약속의 징표', status: 'kept', event: '목걸이에 달았다', evidence: [{ number: 2, sentence: 1 }] }]);
  X.refreshWorld('kh', on.store);
  assert.equal(X.loadKeepsakes('kh').items[0].name, '은반지');
});
