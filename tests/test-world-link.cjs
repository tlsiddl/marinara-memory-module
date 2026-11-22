'use strict';
// 세계관 설정집 연동 v2 (tlsiddl/marinara-world-archive docs/연동-v2-설계안.md): with World Archive linked (contract 2),
// the scene prompt names who knows whom from the start (the batch's people only, 20 lines at most, past ties marked),
// the pet notebook takes its animals from 종 (species), and World Archive's name pairs join 0.35.4's merges after the
// glossary's. Not linked (or an older World Archive): everything exactly as before. Read only: nothing is sent to it.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-world-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const W = require('../memory-module/lib/worldlink.cjs');
const Pets = require('../memory-module/lib/petnotes.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
const C = require('./fixtures/simulator-cases.cjs');
after(() => { fs.rmSync(dir, { recursive: true, force: true }); delete globalThis.__marinaraWorldArchive; });

const EDWARD = '에드워드 베인', CATHERINE = '캐서린 베인', JULIAN = '줄리언 에이버리', MOR = '모웨나 셀윈', CAT = '베아트릭스', USER = C.USER;
const RELS = [
  { relationId: 'r1', from: 'e-ed', to: 'e-ca', fromName: EDWARD, toName: CATHERINE, type: '가족', note: '부부', previous: [] },
  { relationId: 'r2', from: 'e-ir', to: 'e-ju', fromName: USER, toName: JULIAN, type: '적대', note: '등 돌림 · 과거에는 연인', previous: ['연인'] },
  { relationId: 'r3', from: 'e-ir', to: 'e-mo', fromName: USER, toName: MOR, type: '친구', note: '', previous: [] },
];
const slice = () => L.prepareMessages([
  { id: 'w1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `베인 공작이 아내 캐서린 베인의 손을 잡았다. 베아트릭스가 하품했다. 베아트릭스는 이리나 무릎에서 꼬리를 감았다.\n${EDWARD} | "출발하자."` },
  { id: 'w2', number: 2, role: 'user', speaker: USER, content: '"줄리언, 저리 가." 이리나가 고개를 돌렸다. Julian Avery가 웃었다.' },
]);
const linkedApi = (extra = {}) => ({
  version: 1, contract: 2, features: ['relations', 'species', 'entity'],
  roomEntities: () => ({ worldId: 'w', entities: [
    { entityId: 'e-cat', type: 'person', name: CAT, aliases: ['비아', 'Beatrix'], fields: { species: '하프니즐' } },
    { entityId: 'e-ed', type: 'person', name: EDWARD, aliases: ['Edward Vane'], fields: {} },
    { entityId: 'e-ju', type: 'person', name: JULIAN, aliases: ['Julian Avery'], fields: { species: '' } },
  ] }),
  roomRelations: () => ({ worldId: 'w', relations: RELS }),
  lookup: () => ({ worldId: 'w', entity: null }),
  names: () => ({ names: [{ original: 'Julian Avery', translation: JULIAN, kind: '인물' }] }),
  suggest: () => { throw Error('the memory module never writes to World Archive'); },
  entity: () => ({ worldId: 'w', entity: null }),
  ...extra,
});

test('relationLines: pairs whose two people are both in the batch (any form of the name), past ties marked, 20 at most', () => {
  const lines = W.relationLines(RELS, slice(), [USER]);
  assert.deepEqual(lines, [`- ${EDWARD} — ${CATHERINE}: 가족(부부)`, `- ${USER} — ${JULIAN}: 적대 · (과거) 연인`], '모웨나 is not in this batch');
  const many = Array.from({ length: 30 }, (_, i) => ({ fromName: USER, toName: `학생${i}`, type: '친구', previous: [] }));
  const crowd = L.prepareMessages([{ id: 'c', number: 1, role: 'assistant', speaker: C.NARRATOR, content: many.map((r) => r.toName).join(', ') + '가 모였다.' }]);
  assert.equal(W.relationLines(many, crowd, [USER]).length, W.RELATION_LINES_MAX);
});

test('the scene prompt: [설정집 관계] and its rule only with World Archive relations; without them, exactly as before (both modes)', () => {
  const sim = { ...S.emptyStore(), mode: 'simulator', narrators: [C.NARRATOR], castAliases: {}, cast: [EDWARD, CATHERINE, JULIAN], personas: [USER] };
  const plain = S.buildScenePrompt(sim, slice(), 2, null, {});
  const linked = S.buildScenePrompt(sim, slice(), 2, null, { worldRelations: RELS });
  assert.doesNotMatch(plain[1].content + plain[0].content, /설정집 관계/);
  assert.match(linked[1].content, /\[설정집 관계 — 처음부터 아는 사이\]\n- 에드워드 베인 — 캐서린 베인: 가족\(부부\)/);
  assert.match(linked[0].content, /무엇을 아는지\(비밀, 사건, 약속\)는 지금처럼 대화에서만 정리해/);
  const character = { ...S.emptyStore(), cast: [C.NARRATOR], personas: [USER] };
  assert.equal(JSON.stringify(S.buildScenePrompt(character, slice(), 2, null, { worldRelations: [] })), JSON.stringify(S.buildScenePrompt(character, slice(), 2, null, {})), 'no relations: not one character changes');
  assert.match(S.buildScenePrompt(character, slice(), 2, null, { worldRelations: RELS })[1].content, /이리나 — 줄리언 에이버리: 적대 · \(과거\) 연인/, 'character mode too, when linked');
});

test('service: linked (contract 2) → relations into the scene options; not linked, an older World Archive (contract 1) or none → the options as before', () => {
  const room = 'wl_room';
  delete globalThis.__marinaraWorldArchive;
  assert.equal(X.worldLink(room), null);
  assert.deepEqual(X.sceneOptions(room), X.organizeFor(room));
  globalThis.__marinaraWorldArchive = { api: linkedApi({ contract: undefined }) };
  X.worldRelCache.clear();
  assert.equal(X.worldLink(room), null, 'contract 1: no v2');
  assert.deepEqual(X.sceneOptions(room), X.organizeFor(room));
  globalThis.__marinaraWorldArchive = { api: linkedApi({ roomEntities: () => ({ worldId: null, entities: [] }) }) };
  X.worldRelCache.clear();
  assert.equal(X.worldLink(room), null, 'the room is not linked to a world');
  globalThis.__marinaraWorldArchive = { api: linkedApi() };
  X.worldRelCache.clear();
  assert.deepEqual(X.sceneOptions(room).worldRelations.map(({ fromAliases, toAliases, ...r }) => r), RELS, 'its relations, each end with its other names');
  assert.deepEqual(X.sceneOptions(room).worldRelations.find((r) => r.relationId === 'r2').toAliases, ['Julian Avery'], 'each end with its other names');
  assert.deepEqual(X.sceneOptions(room).worldRelations.find((r) => r.relationId === 'r3').toAliases, [], 'an end World Archive does not list has none');
  assert.equal(X.worldSpecies(room).get(CAT), '하프니즐');
  assert.equal(X.worldSpecies(room).has(JULIAN), false, 'an empty 종 is unknown, not an animal');
  delete globalThis.__marinaraWorldArchive;
  X.worldRelCache.clear();
});

test('pet notebook with World Archive: the animals are its people with a 종, no "is it an animal?" answer needed; a person is never one', () => {
  const st = { ...S.emptyStore(), mode: 'simulator', narrators: [C.NARRATOR], personas: [USER], cast: [EDWARD, CAT, '카트 마녀'], scenes: [{ id: 'S1', start: 1, end: 2, title: '출발', present: [EDWARD, CAT, USER], recollections: [], events: [] }] };
  const species = W.speciesMap(linkedApi().roomEntities().entities);
  const found = Pets.targets(st, st.scenes, slice(), { species });
  assert.deepEqual(found.map((f) => f.names), [[CAT]]);
  const stats = {};
  const added = Pets.applyReply(st, found, { notebook: [{ scene: 'S1', who: CAT, kind: 'about', about: USER, when: '이리나 무릎에 있을 때', text: '이리나 무릎이 가장 마음 놓이는 자리라고 여김.', evidence: ['1.3'] }] }, slice(), { species, stats });
  assert.equal(added, 1, 'no animals answer in the reply, but World Archive says she is one');
  assert.deepEqual(st.notAnimals, undefined, 'nothing is remembered as "not an animal" from World Archive\'s list');
});

test('0.35.4 automatic merges take World Archive\'s name pairs after the glossary\'s (the glossary wins a shared romanized name)', async () => {
  assert.deepEqual(W.namePairs([{ from: 'Julian Avery', to: '줄리안 에이버리' }], [{ original: 'Julian Avery', translation: JULIAN }, { original: 'Edward Vane', translation: EDWARD }]).map((p) => `${p.from}=${p.to}`), ['Julian Avery=줄리안 에이버리', `Edward Vane=${EDWARD}`]);
  const room = 'wl_merge';
  X.setRoomMode(room, 'simulator');
  X.saveTranslations(room, { items: {}, glossary: { pairs: [{ from: 'Snow leopard', to: '설표' }], hash: 'g', source: '번역 프리셋·단어장', at: null } });
  X.saveScenes(room, { ...S.emptyStore(), mode: 'simulator', narrators: [C.NARRATOR], cast: [JULIAN, 'Julian Avery'], scenes: [{ id: 'S1', start: 1, end: 1, title: '테라스', summary: '', present: ['Julian Avery', JULIAN, USER], recollections: [], events: [{ text: '말을 걸었다', with: [], quotes: [{ q: '안녕.', by: 'Julian Avery', to: USER, kind: 'dialogue' }, { q: '또 봐.', by: JULIAN, to: USER, kind: 'dialogue' }] }] }] });
  globalThis.__marinaraWorldArchive = { api: linkedApi() };
  try {
    assert.equal(await X.autoMergeByGlossary(room), 1, 'merged by World Archive\'s pair (the glossary has no Julian)');
    assert.equal(A.canonOf('Julian Avery', X.loadNames(room)), JULIAN);
  } finally {
    delete globalThis.__marinaraWorldArchive;
    X.setRoomMode(room, 'character');
  }
});

test('a name World Archive spells its own way finds the memory\'s person through its other names, and the line uses the memory\'s name', () => {
  const t = A.emptyTable();
  A.addAlias(t, 'Gareth Urquhart', '가레스 어콰트', { rewrite: false });
  A.addAlias(t, 'Barnaby Pye', '바나비 파이', { rewrite: false });
  const batch = L.prepareMessages([{ id: 'g1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: 'Gareth Urquhart | "바나비, 자리 좀."\n바나비 파이가 웃었다.' }]);
  const rels = [{ fromName: '바너비 파이', fromAliases: ['Barnaby Pye'], toName: '개러스 어쿼하트', toAliases: ['Gareth Urquhart'], type: '친구', note: '', previous: [] }];
  const lines = A.using(t, () => W.relationLines(rels, batch, ['가레스 어콰트', '바나비 파이']));
  assert.deepEqual(lines, ['- 바나비 파이 — 가레스 어콰트: 친구']);
  assert.deepEqual(A.using(A.emptyTable(), () => W.relationLines(rels, batch, [])), ['- 바너비 파이 — 개러스 어쿼하트: 친구'], 'not one of the batch\'s people: World Archive\'s name, found in the text by its other name');
});

test('a world with no 종 at all (read before v2): the pet notebook asks about animals, as without World Archive', () => {
  const room = 'wl_nospecies';
  globalThis.__marinaraWorldArchive = { api: linkedApi({ roomEntities: () => ({ worldId: 'w', entities: [{ type: 'person', name: CAT, aliases: [], fields: {} }] }) }) };
  try {
    assert.ok(X.worldLink(room), 'linked');
    assert.equal(X.worldSpecies(room), null, 'no 종 anywhere: null, so the animals answer decides');
  } finally {
    delete globalThis.__marinaraWorldArchive;
  }
});

test('the 「아는 사이」 lines always use the name table\'s name — also when the person is only in the text — and one pair is one line', () => {
  const t = A.emptyTable();
  A.addAlias(t, 'Gareth Urquhart', '가레스 어콰트', { rewrite: false });
  A.addAlias(t, 'Barnaby Pye', '바나비 파이', { rewrite: false });
  const rel = { fromName: '바너비 파이', fromAliases: ['Barnaby Pye'], toName: '개러스 어쿼하트', toAliases: ['Gareth Urquhart'], type: '친구', note: '', previous: [] };
  // One batch has both among its people, another has them only in its text: the same line both times.
  const withPeople = L.prepareMessages([{ id: 'p1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: '둘이 자리를 바꿨다.' }]);
  const textOnly = L.prepareMessages([{ id: 'p2', number: 2, role: 'assistant', speaker: C.NARRATOR, content: 'Barnaby Pye | "가레스, 비켜."\nGareth Urquhart가 웃었다.' }]);
  const a = A.using(t, () => W.relationLines([rel], withPeople, ['바나비 파이', '가레스 어콰트']));
  const b = A.using(t, () => W.relationLines([rel], textOnly, []));
  assert.deepEqual(a, ['- 바나비 파이 — 가레스 어콰트: 친구']);
  assert.deepEqual(b, a, 'only in the text: still the name table\'s names');
  // World Archive holds the same person twice (two spellings) with a relation each: one line.
  const twice = [rel, { ...rel, fromName: '바나비 파이', fromAliases: [], toName: '가레스 어콰트', toAliases: [] }];
  assert.deepEqual(A.using(t, () => W.relationLines(twice, textOnly, [])), a);
  // A person the name table does not know at all: World Archive's name, once.
  assert.deepEqual(A.using(A.emptyTable(), () => W.relationLines([rel, rel], textOnly, [])), ['- 바너비 파이 — 개러스 어쿼하트: 친구']);
});

test('a 종 is not "an animal": a ghost, a house-elf or a goblin who talks keeps a notebook as a person, and is never a pet-notebook candidate', () => {
  const Sim = require('../memory-module/lib/simulator.cjs');
  const species = W.speciesMap([
    { type: 'person', name: CAT, aliases: [], fields: { species: '하프 크니즐' } },
    { type: 'person', name: '피브스', aliases: [], fields: { species: '유령' } },
    { type: 'person', name: '팁피', aliases: [], fields: { species: '집요정' } },
  ]);
  const batch = L.prepareMessages([
    { id: 'h1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `피브스가 천장에서 내려왔다. 피브스는 분필을 던졌다. 팁피가 몸을 숙였다. 팁피는 접시를 떨어뜨렸다. 베아트릭스가 하악질했다. 베아트릭스는 꼬리를 부풀렸다.\n피브스 | "1학년이다!"\n팁피 | "팁피는 죄송합니다."` },
  ]);
  const store = { ...S.emptyStore(), mode: 'simulator', narrators: [C.NARRATOR], personas: [USER], cast: [CAT],
    scenes: [{ id: 'S1', start: 1, end: 1, title: '복도', present: [CAT, '피브스', '팁피', USER], recollections: [], events: [{ text: '소동', quotes: [{ q: '1학년이다!', by: '피브스', kind: 'dialogue' }, { q: '팁피는 죄송합니다.', by: '팁피', kind: 'dialogue' }] }] }] };
  // They speak: the simulator takes them in as people, as anyone else who speaks.
  const reply = [{ events: [{ quotes: [{ by: '피브스', to: USER }, { by: '팁피', to: USER }] }], notebook: [{ who: '팁피', kind: 'heart', text: '이리나 앞에서 실수해 부끄러움' }] }];
  assert.deepEqual(Sim.newPeople(store, reply, batch), ['피브스', '팁피']);
  store.cast = [CAT, '피브스', '팁피'];
  // With World Archive: a 종 and never a line — only the cat.
  const found = Pets.targets(store, store.scenes, batch, { species });
  assert.deepEqual(found.map((f) => f.names), [[CAT]]);
});

test('「설정집 연동」 switch: on by default in a linked room; off → no 「아는 사이」 lines, no World Archive name pairs, no 종 — the prompt is exactly as without World Archive', async () => {
  const room = 'wl_switch';
  globalThis.__marinaraWorldArchive = { api: linkedApi() };
  X.worldRelCache.clear();
  try {
    assert.equal(X.worldLinkOn(room), true, 'on unless turned off');
    assert.ok(X.worldLink(room));
    const character = { ...S.emptyStore(), cast: [C.NARRATOR], personas: [USER] };
    assert.match(S.buildScenePrompt(character, slice(), 2, null, X.sceneOptions(room))[1].content, /\[설정집 관계/);
    X.setWorldLink(room, false);
    assert.equal(X.settings().chats[room].worldLink, 'off');
    assert.ok(X.worldLinked(room), 'still linked to a world (the switch shows)');
    assert.equal(X.worldLink(room), null, 'but not used');
    assert.equal(X.worldSpecies(room), null);
    assert.equal(JSON.stringify(S.buildScenePrompt(character, slice(), 2, null, X.sceneOptions(room))), JSON.stringify(S.buildScenePrompt(character, slice(), 2, null, X.organizeFor(room))), 'off: not one character differs from no World Archive');
    // Names: with the switch off, World Archive's pair is not used (no glossary here: nothing to merge).
    X.saveScenes(room, { ...S.emptyStore(), cast: [C.NARRATOR], scenes: [{ id: 'S1', start: 1, end: 1, title: 't', summary: '', present: ['Julian Avery', JULIAN], recollections: [], events: [{ text: 'x', with: [], quotes: [{ q: 'a', by: 'Julian Avery', kind: 'dialogue' }, { q: 'b', by: JULIAN, kind: 'dialogue' }] }] }] });
    assert.equal(await X.autoMergeByGlossary(room), 0);
    X.setWorldLink(room, true);
    assert.equal(X.settings().chats[room].worldLink, undefined, 'on stores nothing');
    assert.equal(await X.autoMergeByGlossary(room), 1, 'on again: World Archive\'s pair merges them');
  } finally {
    delete globalThis.__marinaraWorldArchive;
    X.worldRelCache.clear();
  }
});

test('the screen: the switch only for a linked room; World Archive\'s status asked once when the page loads (a 404 is final), again on opening only while it was there; an unlinked room\'s tab only links it', () => {
  const rt = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/runtime.js'), 'utf8');
  assert.match(rt, /\$\{info\.worldLink\?\.linked \? `<label class="setting-switch"><span>설정집 연동/);
  assert.match(rt, /if \(!ok\) worldTab\.gone = true;/);
  assert.match(rt, /if \(worldTab\.gone\) return;/);
  assert.match(rt, /if \(worldTab\.available\) \{ worldTab\.linkRoom = ''; void checkWorldTab\(\); \}/);
  assert.doesNotMatch(rt, /setInterval\([^)]*checkWorldTab/, 'no checking every minute');
  assert.match(rt, /이 방을 세계관에 연결하기/);
  assert.match(rt, /case 'worldLinkRoom':/);
});
