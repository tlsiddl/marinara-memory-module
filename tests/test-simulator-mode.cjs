'use strict';
// 세계 시뮬레이터 모드: the card is the narrator (no person, no speaker, no notebook), the NPCs it voices are the people
// (they join the cast when a scene names them; World Archive's people are read, never written), the batch prompt names
// only the people the batch names (≤40), character mode is byte for byte what it was (snapshot from main a26b545).
// Invented scenes; the Hogwarts names only stand for "many named students".
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-simulator-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const Sim = require('../memory-module/lib/simulator.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
const C = require('./fixtures/simulator-cases.cjs');
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const HERMIONE = '헤르미온느 그레인저', RON = '론 위즐리', NEVILLE = '네빌 롱바텀';

/** A store/ledger the service would have stamped for a simulator room. */
const simStore = (cast = []) => ({ ...S.emptyStore(), mode: 'simulator', narrators: [C.NARRATOR], castAliases: {}, cast, personas: [C.USER] });

// ---- character mode does not change ----
test('character mode: the scene, notebook and ledger prompts are exactly what main (425c738) builds', () => {
  const snap = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'simulator-character-snapshot.json'), 'utf8'));
  assert.deepEqual(C.characterPrompts(), snap.prompts);
});

// ---- the batch's people ----
test('batchCast: only people this batch names (a name or another name), the latest first, at most 40', () => {
  const slice = C.slice();
  assert.deepEqual(Sim.batchCast([NEVILLE, '드레이코 말포이', HERMIONE, RON], slice), [NEVILLE, HERMIONE, RON], 'Draco is not in these messages');
  assert.deepEqual(Sim.batchCast(['헤르미온느 진 그레인저'], slice, { '헤르미온느 진 그레인저': ['헤르미온느'] }), ['헤르미온느 진 그레인저'], 'another name counts');
  const many = Array.from({ length: 60 }, (_, i) => `학생${String(i).padStart(2, '0')}`);
  const crowd = L.prepareMessages(many.map((n, i) => ({ id: `c${i}`, number: i + 1, role: 'assistant', speaker: C.NARRATOR, content: `${n}가 손을 들었다.` })));
  const got = Sim.batchCast(many, crowd);
  assert.equal(got.length, Sim.BATCH_CAST_MAX);
  assert.equal(got[0], '학생59', 'the most recently mentioned first');
  assert.ok(!got.includes('학생00'), 'the oldest mentions are the ones left out');
});

test('newPeople: someone who speaks, keeps a note, knows or does not know; not a description, a group, a fact\'s subject alone, the narrator, the user, an unknown name or someone only present', () => {
  const store = simStore([]);
  const scenes = [{
    present: [C.NARRATOR, HERMIONE, RON, C.USER, '론의 누나', '부엉이'],
    events: [{ with: [NEVILLE], quotes: [{ by: HERMIONE, to: C.USER }, { by: C.NARRATOR }, { by: '론의 누나' }, { by: HERMIONE, to: '1학년들' }] }],
    notebook: [{ who: C.NARRATOR }],
    facts: [{ about: NEVILLE, knownBy: [HERMIONE, '드레이코 말포이'], unaware: [{ who: C.USER }] }],
  }];
  assert.deepEqual(Sim.newPeople(store, scenes, C.slice()), [HERMIONE], 'Ron and the owl are only present: they stay extras; Neville is only what a fact is about; Draco is not in the text');
  const heard = [{ events: [{ quotes: [{ by: HERMIONE, to: NEVILLE }] }] }];
  assert.deepEqual(Sim.newPeople(store, heard, C.slice()), [HERMIONE, NEVILLE], 'spoken to: a person');
  assert.equal(Sim.isGroup('1학년들'), true);
  assert.equal(Sim.isGroup('신입생들'), true);
  assert.equal(Sim.isGroup('모두'), true);
  assert.equal(Sim.isGroup('firstyears'), true);
  assert.equal(Sim.isGroup(NEVILLE), false);
  // 톰: one syllable, a person once the name table has a longer form of him.
  const tomText = L.prepareMessages([{ id: 't1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: 'Tom | "어서 오세요, 교수님!"' }]);
  assert.deepEqual(Sim.newPeople(simStore([]), [{ events: [{ quotes: [{ by: '톰' }] }] }], tomText), [], 'one syllable, nothing else known');
  const t = A.emptyTable();
  A.addAlias(t, 'Tom', '톰', { rewrite: false });
  assert.deepEqual(A.using(t, () => Sim.newPeople(simStore([]), [{ events: [{ quotes: [{ by: '톰' }] }] }], tomText)), ['톰'], 'linked to Tom: a person');
  assert.deepEqual(store.cast, [], 'the store is not changed');
  assert.deepEqual(Sim.newPeople(simStore([HERMIONE]), [{ events: [{ quotes: [{ by: '헤르미온느' }] }] }], C.slice()), [], 'someone the cast has (or a shorter name of them) is not added again');
  // A spaced name whose own word is in the text counts ("베인 공작" for 「에드워드 베인」); a title word alone does not.
  const duke = L.prepareMessages([{ id: 'd1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: '베인 공작이 웃었다. Professor가 들어왔다.' }]);
  assert.deepEqual(Sim.newPeople(simStore([]), [{ events: [{ quotes: [{ by: '에드워드 베인' }, { by: 'Professor Snape' }, { by: '아서 펜들턴' }] }] }], duke), ['에드워드 베인'], 'Snape: only the title is in the text; Pendleton: nothing of him');
  assert.equal(Sim.isDescribedName("Ron's sister said"), true);
  assert.equal(Sim.isDescribedName('론의누나'), false, 'only "…의 " with a space is a description (a name may contain 의)');
});

// ---- prompts in a simulator room ----
test('simulator scene prompt: the narrator line and rules, the batch\'s people only, never the narrator as a person', () => {
  const [system, user] = S.buildScenePrompt(simStore([HERMIONE, RON, NEVILLE, '드레이코 말포이']), C.slice(), 4, null, {});
  assert.match(user.content, /^\[내레이터\] Hogwarts Simulator \(인물이 아님\)\n\[등장인물\] 네빌 롱바텀, 헤르미온느 그레인저, 론 위즐리\n\[사용자 캐릭터\] 이리나\n/);
  assert.doesNotMatch(user.content, /\[등장인물\][^\n]*Hogwarts/);
  assert.doesNotMatch(user.content, /드레이코/, 'someone not in this batch is not listed');
  assert.ok(system.content.includes(Sim.NARRATOR_PROMPT));
  // Who does not know a fact: only this batch's people are shown (the room may have dozens).
  const known = simStore([HERMIONE, RON, NEVILLE, '드레이코 말포이', '빈센트 크레이브']);
  known.facts = [{ id: 'F1', about: NEVILLE, text: '시험지를 잃어버렸다', unaware: [RON, '드레이코 말포이', '빈센트 크레이브'], guess: ['빈센트 크레이브'] }];
  const withFacts = S.buildScenePrompt(known, C.slice(), 4, null, {})[1].content;
  assert.ok(withFacts.includes('- F1 네빌 롱바텀: 시험지를 잃어버렸다 (모름: 론 위즐리)\n'), 'Draco and Crabbe are not in this batch');
  // The user message is the same as character mode's apart from the head: the messages themselves are not changed.
  const plain = S.buildScenePrompt(C.characterStore(), C.slice(), 4, null, {})[1].content;
  assert.equal(user.content.split('\n## 이미 아는 사실')[1], plain.split('\n## 이미 아는 사실')[1]);
});

test('simulator ledger prompt: the narrator line, and the people these messages name', () => {
  const ledger = { ...L.emptyLedger(), mode: 'simulator', narrators: [C.NARRATOR], castAliases: {}, cast: [HERMIONE, RON, NEVILLE, '드레이코 말포이'], personas: [C.USER] };
  const user = L.buildPrompt(ledger, C.slice(), [])[1].content;
  assert.match(user, /^\[내레이터\] Hogwarts Simulator \(인물이 아님\)\n\[등장인물\] 네빌 롱바텀, 헤르미온느 그레인저, 론 위즐리\n\[사용자 캐릭터\] 이리나\n\n/);
});

// ---- reading the reply ----
test('simulator reply: NPCs the scene names become people; their secrets, notes and lines count; the narrator never does', () => {
  const store = simStore([]);
  const reply = {
    scenes: [{
      end: 4, time: null, place: '대연회장', title: '저녁', summary: '네빌의 비밀',
      present: [C.NARRATOR, HERMIONE, RON, NEVILLE, C.USER, '론의 누나'],
      events: [{ text: '헤르미온느가 네빌의 비밀을 말했다', with: [HERMIONE, C.USER], quotes: [{ q: '네빌이 시험지를 잃어버렸대', by: HERMIONE, to: C.USER }] }],
      recollections: [],
      facts: [{ about: NEVILLE, text: '시험지를 잃어버렸다', evidence: ['3.2'], knownBy: [HERMIONE, C.USER, NEVILLE, C.NARRATOR] }],
      notebook: [{ who: HERMIONE, kind: 'heart', when: '네빌의 비밀을 이리나에게 말한 뒤', text: '네빌 몰래 시험지를 같이 찾아 주기로 함', evidence: ['3.2'] }, { who: C.NARRATOR, kind: 'heart', when: '저녁 식사 시간에', text: '이야기를 더 극적으로 만들기로 함', evidence: ['1.1'] }],
    }],
  };
  // A reply that is turned down brings nobody in.
  const bad = S.applyScenes(store, { scenes: [{ ...reply.scenes[0], end: 1 }] }, C.slice(), 4, undefined, { notebook: true });
  assert.ok(bad.error);
  assert.deepEqual(store.cast, []);
  const out = S.applyScenes(store, reply, C.slice(), 4, undefined, { notebook: true });
  assert.ifError(out.error);
  assert.deepEqual(out.people, [HERMIONE, NEVILLE]);
  assert.deepEqual(store.cast, [], 'nobody joins until the result is committed');
  S.commitScenes(store, out);
  assert.deepEqual(store.cast, [HERMIONE, NEVILLE], 'the narrator, the user, a description and Ron (only present) are not people');
  const [fact] = out.facts;
  assert.ok(fact, 'the fact is kept');
  assert.ok(!(fact.knownBy || []).includes(C.NARRATOR), 'the narrator never knows anything as a person');
  assert.ok((fact.knownBy || []).includes(HERMIONE));
  const quote = out.scenes?.[0]?.events?.[0]?.quotes?.[0] || store.scenes.at(-1)?.events?.[0]?.quotes?.[0];
  assert.equal(quote?.by, HERMIONE, 'the narrator card\'s message holds Hermione\'s line');
  const notes = (out.scenes?.[0] || store.scenes.at(-1))?.charNotes || [];
  assert.deepEqual(notes.map((n) => n.who), [HERMIONE], 'an NPC keeps a notebook; the narrator never does');
});

test('character mode reply (unchanged): a narrator card is still the only cast, so NPC knowledge is dropped as before', () => {
  const store = C.characterStore();
  const out = S.applyScenes(store, { scenes: [{ end: 4, place: '대연회장', title: '저녁', summary: 's', present: [HERMIONE], events: [{ text: 't', quotes: [] }], recollections: [], facts: [{ about: NEVILLE, text: '시험지를 잃어버렸다', evidence: ['3.2'], knownBy: [HERMIONE] }] }] }, C.slice(), 4);
  assert.ifError(out.error);
  assert.deepEqual(store.cast, [C.NARRATOR], 'nothing joins the cast in character mode');
});

// ---- the service: mode, people, World Archive (read only), reply side ----
test('room mode: default character; switching keeps what the simulator found; World Archive people are read, not written', async () => {
  const room = 'sim_room';
  X.setEngine({
    chats: { async getById(id) { return { id, name: '방', characterIds: ['card1'] }; } },
    characters: { async getById() { return { data: JSON.stringify({ name: C.NARRATOR }) }; } },
  });
  assert.equal(X.roomMode(room), 'character');
  let people = await X.roomPeople(room, null);
  assert.deepEqual(people, { cast: [C.NARRATOR], narrators: null, aliases: null }, 'character mode: the card, as always');

  X.setRoomMode(room, 'simulator');
  assert.equal(X.roomMode(room), 'simulator');
  let suggested = 0;
  globalThis.__marinaraWorldArchive = { api: { roomEntities: () => ({ worldId: 'w', entities: [
    { type: 'person', name: '맥고나걸 교수', aliases: ['맥고나걸'] },
    { type: 'person', name: '론의 누나', aliases: [] },
    { type: 'place', name: '대연회장', aliases: [] },
    { type: 'person', name: C.NARRATOR, aliases: [] },
  ] }), suggest: () => { suggested++; } } };
  try {
    X.waPeopleCache.clear();
    const store = { ...S.emptyStore(), mode: 'simulator', cast: [HERMIONE, RON] };
    people = await X.roomPeople(room, store);
    assert.deepEqual(people.cast, [HERMIONE, RON, '맥고나걸 교수'], 'the scenes\' people, then World Archive\'s people (no place, no description, no narrator)');
    assert.deepEqual(people.narrators, [C.NARRATOR]);
    assert.deepEqual(people.aliases, { '맥고나걸 교수': ['맥고나걸'] });
    assert.equal(suggested, 0, 'contract v1: the memory module never sends suggest');

    // Back to character mode: the simulator's people are kept aside, and come back when it is turned on again.
    X.stampMode(store, { cast: [C.NARRATOR], narrators: null, aliases: null });
    assert.deepEqual(store.simCast, [HERMIONE, RON]);
    assert.equal(store.mode, undefined);
    store.cast = [C.NARRATOR];
    X.waPeopleCache.clear();
    people = await X.roomPeople(room, store);
    assert.deepEqual(people.cast.slice(0, 2), [HERMIONE, RON]);
  } finally {
    delete globalThis.__marinaraWorldArchive;
  }
  // Without World Archive the simulator still works from its own scenes.
  X.waPeopleCache.clear();
  people = await X.roomPeople(room, { mode: 'simulator', cast: [RON] });
  assert.deepEqual(people.cast, [RON]);
  X.setRoomMode(room, 'character');
  assert.equal(X.settings().chats[room].mode, undefined, 'character mode leaves no key behind');
});

test('reply side: in a simulator room standalone quotes are not labelled with the narrator card\'s name', () => {
  const room = 'sim_reply';
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, [room]: { speakerNames: true } } });
  const o = { chatMode: 'roleplay', chatId: room, isGroupChat: false, charInfo: [{ id: 'card1', name: C.NARRATOR }] };
  const text = '네빌이 고개를 든다.\n"고마워."';
  assert.match(service.fixSpeakers(text, o), /Hogwarts Simulator \| "고마워\."/, 'character mode: labelled as before');
  X.setRoomMode(room, 'simulator');
  assert.equal(service.fixSpeakers(text, o), text, 'simulator: left alone');
  assert.doesNotMatch(service.nameInstructions(room, [C.NARRATOR]), /Hogwarts Simulator/, 'the label example is a person, not the narrator');
});

// ---- one person, two scripts: the story's English speaker labels, the model's Korean (0.35.3 / 0.35.4 do the names) ----
const VANE = '에드워드 베인', VANE_EN = 'Edward Vane', MINERVA = '미네르바 맥고나걸', MINERVA_EN = 'Minerva McGonagall';
const GLOSSARY = [{ from: VANE_EN, to: VANE }, { from: MINERVA_EN, to: MINERVA }, { from: 'Arthur Pendleton', to: '아더 펜들턴' }];

test('simulator room, two forms the name table holds as one person (0.35.4 merged them): one entry in the cast, the reply saved under one name, nobody both knows and does not know', async () => {
  const room = 'sim_merged';
  X.setRoomMode(room, 'simulator');
  const slice = L.prepareMessages([
    { id: 'm1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `베인 공작이 딸을 내려다보았다.\n${VANE_EN} | "그 이야기는 처음 듣는구나."\n${MINERVA_EN} | "따님은 마녀입니다."` },
    { id: 'm2', number: 2, role: 'user', speaker: C.USER, content: '"아빠, 저 마녀래요."' },
  ]);
  const store = simStore([VANE_EN]);
  const reply = {
    scenes: [{
      end: 2, time: null, place: '서재', title: '입학 통지', summary: '맥고나걸이 이리나가 마녀라고 알렸다',
      present: [VANE, MINERVA, C.USER],
      events: [{ text: '맥고나걸이 이리나가 마녀라고 알렸다', with: [MINERVA, VANE, C.USER], quotes: [{ q: '따님은 마녀입니다.', by: MINERVA_EN, to: VANE }, { q: '그 이야기는 처음 듣는구나.', by: VANE_EN, to: C.USER }] }],
      recollections: [],
      facts: [{ about: C.USER, text: '마녀이다', evidence: ['1.3'], knownBy: [MINERVA, VANE_EN, C.USER] }],
    }],
  };
  await X.enqueue(room, async () => {
    const table = X.loadNames(room);
    A.addAlias(table, VANE_EN, VANE, { rewrite: false });
    A.addAlias(table, MINERVA_EN, MINERVA, { rewrite: false });
    X.saveNames(room, table);
    const out = S.applyScenes(store, reply, slice, 2, undefined, {});
    assert.ifError(out.error);
    assert.deepEqual(out.people, [MINERVA], 'the newcomer under the table\'s name; Edward Vane is the cast\'s already');
    S.commitScenes(store, out);
  });
  assert.deepEqual(store.cast, [VANE_EN, MINERVA], 'a person the cast has is not added again under the other form');
  const scene = store.scenes.at(-1);
  assert.deepEqual(scene.events[0].quotes.map((q) => q.by).sort(), [MINERVA, VANE].sort(), 'the speaker labels are written under the one name');
  const fact = store.facts.at(-1);
  assert.ok(fact.knownBy.includes(VANE) && !fact.knownBy.includes(VANE_EN));
  assert.ok(!(fact.unaware || []).some((n) => [VANE, VANE_EN, MINERVA, MINERVA_EN].includes(n)), 'nobody both knows and does not know');
  // Someone the reply names in Korean while the text has only the English label joins once the table links the two.
  const butler = L.prepareMessages([{ id: 'b1', number: 3, role: 'assistant', speaker: C.NARRATOR, content: '집사가 문을 열었다.\nArthur Pendleton | "손님이 오셨습니다."' }]);
  const said = [{ end: 3, present: ['아더 펜들턴'], events: [{ text: '집사가 손님을 알렸다', quotes: [{ q: '손님이 오셨습니다.', by: '아더 펜들턴', to: null }] }] }];
  await X.enqueue(room, async () => {
    assert.deepEqual(Sim.newPeople(store, said, butler), [], 'not linked: the Korean form is not in the text');
    const table = X.loadNames(room);
    A.addAlias(table, 'Arthur Pendleton', '아더 펜들턴', { rewrite: false });
    X.saveNames(room, table);
    assert.deepEqual(Sim.newPeople(store, said, butler), ['아더 펜들턴'], 'linked: the English label is his');
  });
});

test('roomPeople: people the name table knows (the cast is seeded into it every run) stay in the cast; only a card of the list is a card; two forms of one person are one entry', async () => {
  const room = 'sim_seeded';
  X.setEngine({
    chats: { async getById(id) { return { id, name: '방', characterIds: ['card1'] }; } },
    characters: { async getById() { return { data: JSON.stringify({ name: C.NARRATOR }) }; } },
  });
  X.setRoomMode(room, 'simulator');
  X.waPeopleCache.clear();
  let people;
  await X.enqueue(room, async () => {
    const table = X.loadNames(room);
    A.seed(table, [C.NARRATOR, HERMIONE, RON, VANE, C.USER]);
    A.addAlias(table, VANE_EN, VANE, { rewrite: false });
    X.saveNames(room, table);
    people = await X.roomPeople(room, { ...S.emptyStore(), mode: 'simulator', cast: [HERMIONE, RON, VANE_EN, VANE] });
  });
  assert.deepEqual(people.cast, [HERMIONE, RON, VANE], 'before the fix every name the table knew counted as the card: the cast came back empty');
  assert.deepEqual(people.narrators, [C.NARRATOR]);
  X.setRoomMode(room, 'character');
});

test('simulator room: 0.35.4 merges by the glossary and 0.35.3 tells the model the glossary spellings, as in character mode', async () => {
  const room = 'sim_glossary';
  X.setRoomMode(room, 'simulator');
  X.saveTranslations(room, { items: {}, glossary: { pairs: GLOSSARY, hash: 'g', source: '번역 프리셋·단어장', at: null } });
  // 0.35.3: the "## 이름 표기" block goes with a simulator room's scene call too.
  const slice = L.prepareMessages([{ id: 'g1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `${VANE_EN} | "Arthur Pendleton, 차를 내오게."` }]);
  const prompt = X.withSetup('', S.buildScenePrompt(simStore([VANE]), slice, 1, null, {}), room);
  const user = prompt.find((m) => m.role === 'user').content;
  assert.match(user, /## 이름 표기/);
  assert.match(user, /Arthur Pendleton = 아더 펜들턴|Arthur Pendleton → 아더 펜들턴|아더 펜들턴/);
  // 0.35.4: names stored apart in two scripts are merged on their own after a run; the simulator's cast follows.
  const store = { ...simStore([VANE_EN, VANE]), scenes: [{ id: 'S1', start: 1, end: 1, title: '서재', summary: '', present: [VANE_EN, VANE, C.USER], recollections: [], events: [{ text: '공작이 말했다', with: [VANE_EN], quotes: [{ q: '그래.', by: VANE_EN, to: C.USER, kind: 'dialogue' }, { q: '좋다.', by: VANE, to: C.USER, kind: 'dialogue' }] }] }] };
  X.saveScenes(room, store);
  const merged = await X.autoMergeByGlossary(room);
  assert.equal(merged, 1, 'Edward Vane and 에드워드 베인 are one person now');
  assert.equal(A.canonOf(VANE_EN, X.loadNames(room)), VANE, 'a Korean memory keeps the Korean form');
  const saved = X.loadScenes(room);
  assert.deepEqual([...new Set(saved.scenes[0].events[0].quotes.map((q) => q.by))], [VANE]);
  await X.enqueue(room, async () => {
    const people = await X.roomPeople(room, saved);
    assert.ok(people.cast.filter((n) => A.canonical(n) === VANE).length === 1, `one entry: ${people.cast.join(', ')}`);
  });
  X.setRoomMode(room, 'character');
});
