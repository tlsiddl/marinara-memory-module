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

test('admitPeople: named people of the batch join; a description, the narrator, the user and unknown names do not', () => {
  const store = simStore([]);
  const added = Sim.admitPeople(store, [{ present: [C.NARRATOR, HERMIONE, RON, C.USER, '론의 누나'], events: [{ with: [NEVILLE, '드레이코 말포이'] }] }], C.slice());
  assert.deepEqual(added, [HERMIONE, RON, NEVILLE]);
  assert.deepEqual(store.cast, [HERMIONE, RON, NEVILLE]);
  assert.deepEqual(Sim.admitPeople(store, [{ present: [HERMIONE, '헤르미온느'] }], C.slice()), [], 'someone the cast has (or a shorter name of them) is not added again');
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
  const out = S.applyScenes(store, reply, C.slice(), 4, undefined, { notebook: true });
  assert.ifError(out.error);
  assert.deepEqual(store.cast, [HERMIONE, RON, NEVILLE], 'the narrator, the user and a description are not people');
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
