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
test('character mode: the scene, notebook and ledger prompts are exactly what main built before simulator mode', () => {
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

// ---- one person, two scripts (the story's English speaker labels, the model's Korean) ----
const VANE = '에드워드 베인', VANE_EN = 'Edward Vane', MINERVA = '미네르바 맥고나걸', MINERVA_EN = 'Minerva McGonagall';
const GLOSSARY = [{ from: 'Hogwarts', to: '호그와트' }, { from: VANE_EN, to: VANE }, { from: MINERVA_EN, to: MINERVA }, { from: 'Irina', to: C.USER }, { from: C.NARRATOR, to: '호그와트 시뮬레이터' }];

test('scriptPairs / nameLinks: the glossary and World Archive pair the forms; the memory\'s language names the person, the user keeps their own name, the narrator is never linked', () => {
  const pairs = Sim.scriptPairs(GLOSSARY, [{ name: '아서 펜들턴', aliases: ['Arthur Pendleton', '집사'] }, { name: 'Edward Vane', aliases: ['에드워드'] }]);
  assert.deepEqual(pairs.find((p) => p.from === 'Arthur Pendleton'), { from: 'Arthur Pendleton', to: '아서 펜들턴' }, 'World Archive: a name and another name in the other script');
  assert.equal(pairs.filter((p) => p.from === VANE_EN).length, 1, 'the glossary comes first; a form is paired once');
  const table = A.emptyTable();
  assert.deepEqual(Sim.nameLinks([VANE_EN, MINERVA, '호그와트', 'Irina', C.NARRATOR, '론 위즐리'], pairs, table, { narrators: [C.NARRATOR], personas: [C.USER] }), [
    { source: VANE_EN, target: VANE },
    { source: MINERVA_EN, target: MINERVA },
    { source: 'Hogwarts', target: '호그와트' },
    { source: 'Irina', target: C.USER },
  ]);
  assert.deepEqual(Sim.nameLinks([VANE], pairs, table, { korean: false }), [{ source: VANE, target: VANE_EN }], 'an English memory keeps the English form');
  assert.deepEqual(Sim.nameLinks(['이리나'], pairs, table, { korean: false, personas: [C.USER] }), [{ source: 'Irina', target: C.USER }], 'the user\'s character keeps their own name');
  A.addAlias(table, VANE_EN, VANE, { rewrite: false });
  A.dismiss(table, MINERVA_EN, MINERVA);
  assert.deepEqual(Sim.nameLinks([VANE_EN, MINERVA], pairs, table), [], 'already one person; told apart by the user');
});

test('simulator room: the glossary makes the two forms one person (listed under 자동으로 적용함, undone one by one, never made again); the reply is saved under one name', async () => {
  const room = 'sim_link';
  X.setRoomMode(room, 'simulator');
  X.saveTranslations(room, { items: {}, glossary: { pairs: GLOSSARY, hash: 'x', source: '번역 프리셋·단어장', at: null } });
  const slice = L.prepareMessages([
    { id: 'm1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `베인 공작이 딸을 내려다보았다.\n${VANE_EN} | "그 이야기는 처음 듣는구나."\n${MINERVA_EN} | "따님은 마녀입니다."` },
    { id: 'm2', number: 2, role: 'user', speaker: C.USER, content: '"아빠, 저 마녀래요."' },
  ]);
  const store = { ...simStore([VANE_EN]) };
  const reply = {
    scenes: [{
      end: 2, time: null, place: '서재', title: '입학 통지', summary: '맥고나걸이 이리나가 마녀라고 알렸다',
      present: [VANE, MINERVA, C.USER],
      events: [{ text: '맥고나걸이 이리나가 마녀라고 알렸다', with: [MINERVA, VANE, C.USER], quotes: [{ q: '따님은 마녀입니다.', by: MINERVA_EN, to: VANE }, { q: '그 이야기는 처음 듣는구나.', by: VANE_EN, to: C.USER }] }],
      recollections: [],
      facts: [{ about: C.USER, text: '마녀이다', evidence: ['1.3'], knownBy: [MINERVA, VANE_EN, C.USER] }],
    }],
  };
  let made;
  await X.enqueue(room, async () => {
    made = X.linkScriptForms(room, store, reply.scenes, slice);
  });
  assert.equal(made, 3, 'Edward Vane (in the cast), Minerva McGonagall (the reply\'s speaker) and Irina (the user\'s character, under her own name) are linked');
  const table = X.loadNames(room);
  assert.equal(A.canonOf(VANE_EN, table), VANE);
  assert.equal(A.canonOf(MINERVA_EN, table), MINERVA);
  assert.deepEqual(store.cast, [VANE], 'the cast holds the person once, under the memory\'s form');
  const applied = X.Addr.appliedView(X.loadAddress(room));
  assert.deepEqual(applied.map((a) => a.text).sort(), [`‘${MINERVA_EN}’ = ${MINERVA}의 다른 이름 (단어장)`, `‘${VANE_EN}’ = ${VANE}의 다른 이름 (단어장)`, `‘Irina’ = ${C.USER}의 다른 이름 (단어장)`].sort());
  // The reply, read and saved: every name field under one name, nobody both knowing and not knowing.
  await X.enqueue(room, async () => {
    const out = S.applyScenes(store, reply, slice, 2, undefined, {});
    assert.ifError(out.error);
    S.commitScenes(store, out);
  });
  assert.deepEqual(store.cast, [VANE, MINERVA]);
  const scene = store.scenes.at(-1);
  assert.deepEqual(scene.events[0].quotes.map((q) => q.by).sort(), [MINERVA, VANE].sort(), 'the speaker labels are written under the one name');
  const fact = store.facts.at(-1);
  assert.ok(fact.knownBy.includes(VANE) && !fact.knownBy.includes(VANE_EN));
  assert.ok(!(fact.unaware || []).some((n) => [VANE, VANE_EN, MINERVA, MINERVA_EN].includes(n)), 'nobody both knows and does not know');
  // Taken back: the two forms are apart again, and the glossary does not link them again.
  const rec = X.loadAddress(room).applied.find((a) => a.source === VANE_EN);
  await X.enqueue(room, async () => {
    const t = X.loadNames(room);
    const book = X.loadAddress(room);
    X.Addr.undoApplied(book, rec.id, { table: t });
    X.saveNames(room, t);
    X.saveAddress(room, book);
  });
  assert.equal(A.canonOf(VANE_EN, X.loadNames(room)), null);
  assert.equal(A.canonOf(MINERVA_EN, X.loadNames(room)), MINERVA, 'the other link stays');
  const again = simStore([VANE, VANE_EN]);
  await X.enqueue(room, async () => {
    assert.equal(X.linkScriptForms(room, again, [], slice), 0, 'a link taken back is never made again');
  });
  // Character mode: nothing is linked by this.
  X.setRoomMode(room, 'character');
  assert.equal(X.linkScriptForms(room, { ...S.emptyStore(), cast: [VANE_EN] }, [], slice), 0);
});

test('simulator scene prompt: the glossary spellings of the English names this batch uses ([이름 표기]); none in character mode', () => {
  const slice = L.prepareMessages([{ id: 'p1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `${VANE_EN} | "Arthur Pendleton, 차를 내오게."\n집사가 고개를 숙였다.` }]);
  const pairs = [...GLOSSARY, { from: 'Arthur Pendleton', to: '아더 펜들턴' }];
  const sim = S.buildScenePrompt(simStore([VANE]), slice, 1, null, { scriptNames: pairs })[1].content;
  const line = sim.split('\n').find((l) => l.startsWith('[이름 표기]'));
  assert.ok(line, 'the line is there');
  assert.match(line, /Edward Vane = 에드워드 베인/);
  assert.match(line, /Arthur Pendleton = 아더 펜들턴/);
  assert.doesNotMatch(line, /Minerva|Hogwarts/, 'only names these messages use');
  const plain = S.buildScenePrompt({ ...S.emptyStore(), cast: [C.NARRATOR], personas: [C.USER] }, slice, 1, null, { scriptNames: pairs })[1].content;
  assert.doesNotMatch(plain, /\[이름 표기\]/, 'character mode: as before');
  assert.equal(Sim.scriptLine(pairs, L.prepareMessages([{ id: 'p2', number: 1, role: 'user', speaker: C.USER, content: '"안녕."' }])), '', 'no English name: no line');
});

test('simulator room: a person the reply names in the glossary\'s Korean, while the text has only the English label, joins once the pair links them', async () => {
  const room = 'sim_link_label';
  X.setRoomMode(room, 'simulator');
  X.saveTranslations(room, { items: {}, glossary: { pairs: [{ from: 'Arthur Pendleton', to: '아더 펜들턴' }], hash: 'y', source: '번역 프리셋·단어장', at: null } });
  const slice = L.prepareMessages([{ id: 'b1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: '집사가 문을 열었다.\nArthur Pendleton | "손님이 오셨습니다."' }]);
  const store = simStore([]);
  const scenes = [{ end: 1, present: ['아더 펜들턴'], events: [{ text: '집사가 손님을 알렸다', quotes: [{ q: '손님이 오셨습니다.', by: '아더 펜들턴', to: null }] }] }];
  assert.deepEqual(Sim.newPeople(store, scenes, slice), [], 'not linked yet: the Korean form is not in the text');
  await X.enqueue(room, async () => {
    assert.equal(X.linkScriptForms(room, store, scenes, slice), 1);
    assert.deepEqual(Sim.newPeople(store, scenes, slice), ['아더 펜들턴'], 'linked: the English label is his');
  });
});

test('simulator scene prompt with the notebook on: a named animal of the story keeps a notebook too; not without the notebook, not in character mode', () => {
  const slice = C.slice();
  const withNotes = S.buildScenePrompt(simStore([HERMIONE]), slice, 4, null, { notebook: true })[0].content;
  assert.ok(withNotes.includes(Sim.ANIMAL_NOTEBOOK_PROMPT));
  assert.ok(!S.buildScenePrompt(simStore([HERMIONE]), slice, 4, null, {})[0].content.includes('동물 수첩'), 'notebook off: no line');
  assert.ok(!S.buildScenePrompt({ ...S.emptyStore(), cast: [C.NARRATOR], personas: [C.USER] }, slice, 4, null, { notebook: true })[0].content.includes('동물 수첩'), 'character mode: as before');
  // The cat keeps a note: she joins the room's people (a notebook makes one), the owl that only brought a letter does not.
  const cat = L.prepareMessages([{ id: 'k1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: '부엉이가 편지를 떨어뜨리고 날아갔다. 베아트릭스가 이리나의 무릎에 뛰어올라 낯선 손님을 노려보았다.' }]);
  assert.deepEqual(Sim.newPeople(simStore([]), [{ present: ['부엉이', '베아트릭스', C.USER], notebook: [{ who: '베아트릭스', kind: 'heart', text: '낯선 손님은 믿지 않기로 함' }] }], cat), ['베아트릭스']);
});

test('simulator scene prompt: someone with no lines (a cat) is on the [수첩 언어] list too; character mode lists only who speaks, as before', () => {
  const slice = L.prepareMessages([{ id: 'v1', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `베아트릭스가 꼬리를 세웠다.\n${HERMIONE} | "고양이가 너를 좋아하네."` }]);
  const sys = S.buildScenePrompt(simStore([HERMIONE, '베아트릭스']), slice, 1, null, { notebook: true })[0].content;
  const row = sys.split('\n').find((l) => l.startsWith('[수첩 언어]'));
  assert.ok(row && row.includes('베아트릭스'), row);
  const plain = S.buildScenePrompt({ ...S.emptyStore(), cast: [HERMIONE, '베아트릭스'], personas: [C.USER] }, slice, 1, null, { notebook: true })[0].content;
  assert.ok(!(plain.split('\n').find((l) => l.startsWith('[수첩 언어]')) || '').includes('베아트릭스'), 'character mode: unchanged');
});

test('simulator notebook prompt: someone of the batch with no lines, there in two saved scenes, is named for the animal notebook', () => {
  const store = simStore([HERMIONE, '베아트릭스']);
  store.scenes = [1, 2].map((i) => ({ id: `S${i}`, title: '저녁', summary: '', recollections: [], present: [HERMIONE, '베아트릭스', C.USER], events: [{ quotes: [{ q: '안녕', by: HERMIONE, kind: 'dialogue' }] }] }));
  assert.deepEqual(Sim.silentPeople(store, [HERMIONE, '베아트릭스']), ['베아트릭스']);
  assert.deepEqual(Sim.silentPeople({ ...store, scenes: store.scenes.slice(0, 1) }, [HERMIONE, '베아트릭스']), [], 'one scene is not enough');
  const slice = L.prepareMessages([{ id: 'v2', number: 1, role: 'assistant', speaker: C.NARRATOR, content: `베아트릭스가 꼬리를 세웠다.\n${HERMIONE} | "고양이가 너를 좋아하네."` }]);
  const sys = S.buildScenePrompt(store, slice, 1, null, { notebook: true })[0].content;
  assert.match(sys, /대사 없이 행동으로만 나오는 인물: 베아트릭스/);
});
