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
  { relationId: 'r1', fromName: EDWARD, toName: CATHERINE, type: '가족', note: '부부', previous: [] },
  { relationId: 'r2', fromName: USER, toName: JULIAN, type: '적대', note: '등 돌림 · 과거에는 연인', previous: ['연인'] },
  { relationId: 'r3', fromName: USER, toName: MOR, type: '친구', note: '', previous: [] },
];
const slice = () => L.prepareMessages([
  { id: 'w1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `베인 공작이 아내 캐서린 베인의 손을 잡았다. 베아트릭스가 하품했다. 베아트릭스는 이리나 무릎에서 꼬리를 감았다.\n${EDWARD} | "출발하자."` },
  { id: 'w2', number: 2, role: 'user', speaker: USER, content: '"줄리언, 저리 가." 이리나가 고개를 돌렸다. Julian Avery가 웃었다.' },
]);
const linkedApi = (extra = {}) => ({
  version: 1, contract: 2, features: ['relations', 'species', 'entity'],
  roomEntities: () => ({ worldId: 'w', entities: [
    { type: 'person', name: CAT, aliases: ['비아', 'Beatrix'], fields: { species: '하프니즐' } },
    { type: 'person', name: EDWARD, aliases: ['Edward Vane'], fields: {} },
    { type: 'person', name: JULIAN, aliases: ['Julian Avery'], fields: { species: '' } },
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
  assert.deepEqual(X.sceneOptions(room).worldRelations, RELS);
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
