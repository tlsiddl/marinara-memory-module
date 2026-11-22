'use strict';
// One person stored apart in two scripts, paired in the user's glossary: merged on their own, under the name in the
// language the memory is written in; each merge is listed and can be taken back alone (and is not made again).
// (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-glossary-merge-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const T = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
T.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const result = await handlers[key]({ params: { id }, body }, { status() { return { send(x) { error = x.error; return x; } }; } });
  return error ? { error } : result;
};

function room(id, { people, threads }) {
  const table = T.loadNames(id);
  for (const [name, opts] of people) A.addPerson(table, name, opts.aliases || [], { seeded: !!opts.seeded });
  T.saveNames(id, table);
  const ledger = L.emptyLedger();
  threads.forEach((who, i) => ledger.threads.push({ id: `T${i + 1}`, kind: 'emotion', status: 'open', title: `thread ${i + 1}`, who, toward: null, unaware: [], guess: [], evidence: [], clues: [] }));
  T.saveLedger(id, ledger);
}
const whos = (id) => T.loadLedger(id).threads.map((t) => t.who);

test('English memory: the Korean card name and the English name become one person, named in English', async () => {
  T.saveSettings({ ...T.settings(), writeLanguage: 'en' });
  room('m1', { people: [['Rowan', {}], ['로완', { seeded: true }]], threads: ['Rowan', '로완', 'Mira'] });
  await call('POST /chats/:id/glossary', 'm1', { glossary: 'Rowan = 로완\nHarbor = 항구' });
  await T.autoMergeByGlossary('m1');
  assert.deepEqual(whos('m1'), ['Rowan', 'Rowan', 'Mira']);
  assert.equal(A.canonOf('로완', T.loadNames('m1')), 'Rowan');
  const view = await call('GET /chats/:id/names', 'm1');
  assert.equal(view.autoMerged.length, 1);
  assert.equal(view.autoMerged[0].target, 'Rowan');
  assert.equal(view.autoMerged[0].why, 'Rowan = 로완');
  // Taken back: the old names return, and it is not merged on its own again.
  const undone = await call('POST /chats/:id/names/auto-undo', 'm1', { id: view.autoMerged[0].id });
  assert.ifError(undone.error);
  assert.deepEqual(whos('m1'), ['Rowan', '로완', 'Mira']);
  assert.notEqual(A.canonOf('로완', T.loadNames('m1')), 'Rowan');
  assert.equal(await T.autoMergeByGlossary('m1'), 0);
  assert.equal((await call('GET /chats/:id/names', 'm1')).autoMerged.length, 0);
});

test('Korean memory: the name kept is the Korean one', async () => {
  T.saveSettings({ ...T.settings(), writeLanguage: 'ko' });
  room('m2', { people: [['Ilse', {}], ['일제', {}]], threads: ['Ilse', '일제'] });
  await call('POST /chats/:id/glossary', 'm2', { glossary: 'Ilse = 일제' });
  await T.autoMergeByGlossary('m2');
  assert.deepEqual(whos('m2'), ['일제', '일제']);
  T.saveSettings({ ...T.settings(), writeLanguage: 'en' });
});

test('two card names are never merged on their own; a later hand undo keeps the automatic merge', async () => {
  room('m3', { people: [['Kai', { seeded: true }], ['카이', { seeded: true }]], threads: ['Kai', '카이'] });
  await call('POST /chats/:id/glossary', 'm3', { glossary: 'Kai = 카이' });
  assert.equal(await T.autoMergeByGlossary('m3'), 0);
  assert.deepEqual(whos('m3'), ['Kai', '카이']);

  room('m4', { people: [['Juno', {}], ['주노', {}], ['Pell', {}]], threads: ['Pell', 'Juno', '주노'] });
  // A hand rename first, then the glossary merge, then the hand rename taken back.
  const prev = await call('POST /chats/:id/names/preview', 'm4', { source: 'Pell', target: 'Pellam', text: false });
  assert.ifError(prev.error);
  assert.ifError((await call('POST /chats/:id/names/apply', 'm4', { source: 'Pell', target: 'Pellam', text: false, confirm: true, token: prev.token })).error);
  await new Promise((r) => setTimeout(r, 5));
  await call('POST /chats/:id/glossary', 'm4', { glossary: 'Juno = 주노' });
  await T.autoMergeByGlossary('m4');
  assert.deepEqual(whos('m4'), ['Pellam', 'Juno', 'Juno']);
  assert.ifError((await call('POST /chats/:id/names/undo', 'm4')).error);
  assert.deepEqual(whos('m4'), ['Pell', 'Juno', 'Juno']);
  assert.equal(A.canonOf('주노', T.loadNames('m4')), 'Juno', 'the automatic merge is still in the name table');
});
