'use strict';
// 이름 정리: 여러 이름 한꺼번에 묶기, 같은 사람 찾기 (the model's guesses), 인물별 이름 (take a name off, add one).
// (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-names-group-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const N = require('../memory-module/lib/names.cjs');
const T = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
const prompts = [];
const provider = { async chatComplete(messages) { prompts.push(messages); return { content: JSON.stringify({ same: [{ name: '꼬맹이', person: '하루', sure: 'medium', why: 'S1에서 미오가 놀리는 아이', scenes: ['S1'] }] }) }; } };
T.setEngine({
  chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } },
  connections: { async list() { return [{ id: 'conn', name: 'conn' }]; }, async getWithKey() { return { id: 'conn', provider: 'openai', model: 'm' }; } },
  resolveBaseUrl() { return 'http://localhost:1'; },
  createLLMProvider() { return provider; },
});
T.saveSettings({ ...T.settings(), connection: 'conn' });
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const out = await handlers[key]({ params: { id }, body }, { status() { return { send(x) { error = x.error; return x; } }; } });
  return error ? { error } : out;
};

function room(id) {
  const table = T.loadNames(id);
  A.addPerson(table, '하루', [], { seeded: true });
  A.addPerson(table, '미오', [], { seeded: true });
  T.saveNames(id, table);
  const ledger = L.emptyLedger();
  ['하루', '꼬맹이', 'Haru', '하루짱', '미오', '꼬맹이'].forEach((who, i) => ledger.threads.push({ id: `T${i + 1}`, kind: 'emotion', status: 'open', title: `일 ${i + 1}`, who, toward: null, unaware: [], guess: [], evidence: [], clues: [] }));
  T.saveLedger(id, ledger);
  const store = S.emptyStore();
  store.scenes = [
    { id: 'S1', title: '놀이터', summary: '미오가 꼬맹이를 놀린다.', present: ['미오', '꼬맹이'], events: [{ text: '미오가 놀림', quotes: [{ by: '미오', to: '꼬맹이', q: '꼬맹이, 키 좀 커라.' }] }] },
    { id: 'S2', title: '집', summary: '하루가 숙제를 한다.', present: ['하루'], events: [] },
  ];
  T.saveScenes(id, store);
}
const whos = (id) => T.loadLedger(id).threads.map((t) => t.who);

test('several names go under one person at once, and come back with one undo', async () => {
  room('g1');
  const body = { target: '하루', sources: ['꼬맹이', 'Haru', '하루짱'], text: false };
  const prev = await call('POST /chats/:id/names/group-preview', 'g1', body);
  assert.ifError(prev.error);
  assert.equal(prev.items.length, 3);
  assert.ifError((await call('POST /chats/:id/names/group-apply', 'g1', { ...body, token: prev.token, confirm: true })).error);
  assert.deepEqual(whos('g1'), ['하루', '하루', '하루', '하루', '미오', '하루']);
  assert.deepEqual(T.loadNames('g1').people['하루'].aliases.sort(), ['Haru', '꼬맹이', '하루짱'].sort());
  assert.equal(T.loadScenes('g1').scenes[0].summary, '미오가 꼬맹이를 놀린다.', 'running text kept unless asked');
  assert.ifError((await call('POST /chats/:id/names/undo', 'g1')).error);
  assert.deepEqual(whos('g1'), ['하루', '꼬맹이', 'Haru', '하루짱', '미오', '꼬맹이']);
  assert.match((await call('POST /chats/:id/names/group-preview', 'g1', { target: '하루', sources: [] })).error, /묶을 이름/);
});

test('the model is asked about the names no one owns, with where they are used; only sound pairs are kept', () => {
  room('g2');
  const table = T.loadNames('g2');
  const ask = A.using(table, () => N.sameNameAsk(T.loadScenes('g2'), T.loadLedger('g2'), table));
  assert.deepEqual(ask.names.map((n) => n.name).sort(), ['Haru', '꼬맹이', '하루짱'].sort());
  const kid = ask.names.find((n) => n.name === '꼬맹이');
  assert.equal(kid.contexts[0].id, 'S1');
  assert.match(kid.contexts[0].line, /미오 → 꼬맹이: 꼬맹이, 키 좀 커라/);
  const prompt = N.buildSameNamePrompt(ask);
  assert.match(prompt[1].content, /## 인물\n- 하루/);
  assert.match(prompt[1].content, /S1 「놀이터」/);
  A.dismiss(table, '하루짱', '미오');
  const reply = JSON.stringify({ same: [
    { name: '꼬맹이', person: '하루', sure: 'high', why: 'S1에서 미오가 놀리는 아이', scenes: ['S1'] },
    { name: '꼬맹이', person: '하루', sure: 'high', why: '중복' },
    { name: '없는이름', person: '하루' },
    { name: 'Haru', person: '아무개' },
    { name: '하루짱', person: '미오', why: '다른 사람이라고 했던 짝' },
  ] });
  const found = N.parseSameNameReply(`생각… ${reply} 끝`, ask, table);
  assert.deepEqual(found.map((x) => `${x.name}>${x.person}:${x.sure}`), ['꼬맹이>하루:high']);
  assert.deepEqual(found[0].scenes, ['S1']);
  assert.deepEqual(N.parseSameNameReply('not json', ask, table), []);
  // Merged since: no longer open.
  A.addAlias(table, '꼬맹이', '하루', { rewrite: false });
  assert.equal(N.openSameNames(T.loadScenes('g2'), T.loadLedger('g2'), table, found).length, 0);
});

test('a name can be taken off a person (and is not tied again), and one not in the memory yet added', async () => {
  room('g3');
  const prev = await call('POST /chats/:id/names/group-preview', 'g3', { target: '하루', sources: ['꼬맹이'] });
  await call('POST /chats/:id/names/group-apply', 'g3', { target: '하루', sources: ['꼬맹이'], token: prev.token, confirm: true });
  const out = await call('POST /chats/:id/names/alias', 'g3', { action: 'remove', person: '하루', alias: '꼬맹이' });
  assert.ifError(out.error);
  assert.deepEqual(out.people['하루'].aliases, []);
  assert.ok(A.dismissed(T.loadNames('g3'), '꼬맹이', '하루'));
  assert.match((await call('POST /chats/:id/names/alias', 'g3', { action: 'remove', person: '하루', alias: '하루' })).error, /기준 이름/);
  assert.ifError((await call('POST /chats/:id/names/alias', 'g3', { action: 'add', person: '미오', alias: '여우' })).error);
  assert.equal(A.canonOf('여우', T.loadNames('g3')), '미오');
  assert.match((await call('POST /chats/:id/names/alias', 'g3', { action: 'add', person: '미오', alias: 'Haru' })).error, /이미 기억에 1곳/);
  const view = await call('GET /chats/:id/names', 'g3');
  assert.deepEqual(view.modelSame, { at: null, items: [] });
});

test('같은 사람 찾기 end to end: one model call, the pairs listed with the names, dismissed ones gone', async () => {
  room('g4');
  const out = await call('POST /chats/:id/names/model-same', 'g4');
  assert.ifError(out.error);
  assert.equal(prompts.length, 1);
  assert.equal(out.asked, 3);
  assert.deepEqual(out.items.map((x) => `${x.name}>${x.person}`), ['꼬맹이>하루']);
  assert.equal((await call('GET /chats/:id/names', 'g4')).modelSame.items.length, 1);
  await call('POST /chats/:id/names/dismiss', 'g4', { source: '꼬맹이', target: '하루' });
  assert.equal((await call('GET /chats/:id/names', 'g4')).modelSame.items.length, 0, 'said to be someone else: gone');
});
