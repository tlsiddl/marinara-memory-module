'use strict';
// 반려동물 수첩 (추가 기능 petNotebook): off by default, and then no call and no prompt change; on, in a simulator room
// with the notebook on, one small call after a batch for the named animals that acted in it (not one that only passed
// by), notes checked like the scene call's and kept as charNotes marked pet. Invented scenes.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-pets-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const Pets = require('../memory-module/lib/petnotes.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const NARRATOR = 'Hogwarts Simulator', USER = '이리나', CAT = '베아트릭스', MCG = '미네르바 맥고나걸', OWL = '부엉이';

const slice = () => L.prepareMessages([
  { id: 'a1', number: 1, role: 'assistant', speaker: NARRATOR, content: `베아트릭스가 상자에서 나와 이리나의 무릎으로 뛰어올랐다. 맥고나걸이 다가오자 베아트릭스는 귀를 눕히고 낮게 울었다. 창밖으로 부엉이가 지나갔다.\n${MCG} | "고양이가 낯을 가리는군요."` },
  { id: 'a2', number: 2, role: 'user', speaker: USER, content: '"괜찮아, 비아." 이리나가 베아트릭스의 턱을 긁어 주었다.' },
]);
const store = () => ({ ...S.emptyStore(), mode: 'simulator', narrators: [NARRATOR], castAliases: {}, personas: [USER], cast: [MCG, CAT, OWL], scenes: [
  { id: 'S1', start: 1, end: 2, title: '상자에서 나온 고양이', summary: '', present: [USER, MCG, CAT], recollections: [], events: [{ text: '맥고나걸이 말했다', quotes: [{ q: '고양이가 낯을 가리는군요.', by: MCG, to: USER, kind: 'dialogue' }] }] },
] });

test('targets: a silent member of the cast named in two or more narration sentences of the scene acted; one who spoke, or only passed by once, did not', () => {
  const st = store();
  const found = Pets.targets(st, st.scenes, slice());
  assert.deepEqual(found.map((f) => [f.scene.id, f.names]), [['S1', [CAT]]], 'McGonagall speaks; the owl passes by once');
  assert.deepEqual(Pets.targets({ ...st, cast: [MCG] }, st.scenes, slice()), [], 'no animal: no call');
});

test('buildPrompt: the candidates, the scene\'s own sentences by number, the language; nothing from other scenes', () => {
  const st = store();
  const [sys, user] = Pets.buildPrompt(st, Pets.targets(st, st.scenes, slice()), slice(), { lang: 'ko' });
  assert.match(sys.content, /동물은 사람 말을 알아듣지 못해/);
  assert.match(user.content, /\[동물 후보\] 베아트릭스/);
  assert.match(user.content, /\[1\.1\] 베아트릭스가 상자에서 나와/);
  assert.match(user.content, /## S1 상자에서 나온 고양이/);
});

test('applyReply: a checked note is kept as the cat\'s, marked pet; a person, another scene\'s evidence, a copied sentence and a second note are not', () => {
  const st = store();
  const found = Pets.targets(st, st.scenes, slice());
  const stats = {};
  const added = Pets.applyReply(st, found, { animals: { [CAT]: true }, notebook: [
    { scene: 'S1', who: CAT, kind: 'about', about: MCG, when: '맥고나걸이 다가왔을 때', text: '맥고나걸은 낯선 냄새가 나서 아직 가까이 두기 싫음.', evidence: ['1.2'] },
    { scene: 'S1', who: MCG, kind: 'heart', when: '고양이를 봤을 때', text: '고양이가 낯을 가린다고 생각함.', evidence: ['1.4'] },
    { scene: 'S1', who: CAT, kind: 'heart', when: '이리나가 턱을 긁어 줬을 때', text: '이리나의 손길이 좋아서 곁에 있기로 함.', evidence: ['2.1'] },
    { scene: 'S1', who: CAT, kind: 'heart', when: '상자에서 나왔을 때', text: '베아트릭스가 상자에서 나와 이리나의 무릎으로 뛰어올랐다.', evidence: ['1.1'] },
  ] }, slice(), { lang: 'ko', stats });
  assert.equal(added, 1);
  const notes = st.scenes[0].charNotes;
  assert.equal(notes.length, 1);
  assert.equal(notes[0].who, CAT);
  assert.equal(notes[0].pet, true);
  assert.equal(notes[0].about, MCG);
  assert.equal(stats.noVerdict, 1, 'McGonagall is not a candidate: no animal answer for her, so no note');
  assert.equal(stats.tooMany, 2, 'one note per animal per scene');
  // A sentence of the story with little changed is not the cat's own note; evidence from outside the scene is none.
  const fresh = store();
  const more = {};
  assert.equal(Pets.applyReply(fresh, Pets.targets(fresh, fresh.scenes, slice()), { animals: { [CAT]: true }, notebook: [
    { scene: 'S1', who: CAT, kind: 'heart', when: '상자에서 나왔을 때', text: '베아트릭스가 상자에서 나와 이리나의 무릎으로 뛰어올랐다.', evidence: ['1.1'] },
    { scene: 'S1', who: CAT, kind: 'heart', when: '창밖을 봤을 때', text: '창밖의 새가 신경 쓰여 계속 지켜보기로 함.', evidence: ['9.1'] },
  ] }, slice(), { lang: 'ko', stats: more }), 0);
  assert.equal(more.copied, 1);
  assert.equal(more.noEvidence, 1);
});

test('service: off by default (no call); on in a simulator room with the notebook on, one call for the batch and the note saved; character mode never', async () => {
  const room = 'pets_room';
  let calls = 0;
  const model = { provider: { async chatComplete(messages) {
    calls++;
    assert.match(messages[messages.length - 1].content, /\[동물 후보\] 베아트릭스/);
    return { content: JSON.stringify({ animals: { [CAT]: true }, notebook: [{ scene: 'S1', who: CAT, kind: 'about', about: USER, when: '이리나가 턱을 긁어 줬을 때', text: '이리나 곁이 제일 편해서 무릎에서 내려가지 않기로 함.', evidence: ['2.1'] }] }) };
  } } };
  let st = store();
  assert.equal(await X.petNotes(room, st, st.scenes, slice(), model, null), 0, 'off by default');
  assert.equal(calls, 0);
  X.saveSettings(X.F.withRoomMode(X.F.withRoomMode(X.settings(), room, 'petNotebook', 'on'), room, 'notebook', 'off'));
  assert.equal(await X.petNotes(room, st, st.scenes, slice(), model, null), 0, 'the notebook off: no call');
  X.saveSettings(X.F.withRoomMode(X.settings(), room, 'notebook', 'on'));
  assert.equal(await X.petNotes(room, st, st.scenes, slice(), model, null), 1);
  assert.equal(calls, 1);
  assert.equal(st.scenes[0].charNotes?.[0]?.who, CAT);
  const plain = { ...store(), mode: undefined, narrators: undefined };
  assert.equal(await X.petNotes(room, plain, plain.scenes, slice(), model, null), 0, 'character mode: never');
  assert.equal(calls, 1);
});

test('the scene call itself does not change with the switch (the pet notes are a call of their own)', () => {
  const room = 'pets_prompt';
  const st = store();
  const before = JSON.stringify(S.buildScenePrompt(st, slice(), 2, null, X.organizeFor(room)));
  X.saveSettings(X.F.withRoomMode(X.settings(), room, 'petNotebook', 'on'));
  assert.equal(JSON.stringify(S.buildScenePrompt(st, slice(), 2, null, X.organizeFor(room))), before);
});

test('who is an animal: the reply says so for each candidate; a "no" is kept for the room and never asked again; a name with a person\'s title is never a candidate', () => {
  const WITCH = '카트 마녀', BUTLER = 'Arthur';
  const witchSlice = L.prepareMessages([{ id: 'w1', number: 1, role: 'assistant', speaker: NARRATOR, content: '카트 마녀가 문을 열었다. 카트 마녀는 웃으며 카트를 밀었다. 아서가 고개를 숙였다. 아서는 조용히 차를 따랐다.' }]);
  const st = { ...S.emptyStore(), mode: 'simulator', narrators: [NARRATOR], personas: [USER], cast: [WITCH, '아서'], scenes: [{ id: 'S1', start: 1, end: 1, title: '객실', present: [WITCH, '아서'], recollections: [], events: [] }] };
  let found = Pets.targets(st, st.scenes, witchSlice);
  assert.deepEqual(found[0].names, ['아서'], '「카트 마녀」 has a person\'s title: not a candidate');
  const stats = {};
  assert.equal(Pets.applyReply(st, found, { animals: { 아서: false }, notebook: [{ scene: 'S1', who: '아서', kind: 'heart', when: '차를 따를 때', text: '조용히 있는 편이 낫다고 느낌.', evidence: ['1.4'] }] }, witchSlice, { stats }), 0);
  assert.equal(stats.notAnimal, 1);
  assert.deepEqual(st.notAnimals, ['아서']);
  found = Pets.targets(st, st.scenes, witchSlice);
  assert.deepEqual(found, [], 'remembered: no call for him again');
  // No answer for a candidate: its notes are not kept either.
  const st2 = store();
  const none = {};
  assert.equal(Pets.applyReply(st2, Pets.targets(st2, st2.scenes, slice()), { notebook: [{ scene: 'S1', who: CAT, kind: 'heart', when: '맥고나걸이 다가왔을 때', text: '낯선 냄새가 싫어서 경계하기로 함.', evidence: ['1.2'] }] }, slice(), { stats: none }), 0);
  assert.equal(none.noVerdict, 1);
  assert.equal(BUTLER, 'Arthur');
});
