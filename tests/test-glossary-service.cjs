'use strict';
// The glossary endpoint: pairs saved with the room's translations, names in it become other names of the people
// they name, and the Korean notes show names (and name fields) in Korean. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-glossary-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const Tr = require('../memory-module/lib/translate.cjs');
const T = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
T.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body }, reply);
  return { result, error };
};

test('glossary: saved once, names become other names, notes and name fields read in Korean', async () => {
  const room = 'g1';
  // Memory written in English, shown in Korean in the library.
  T.saveSettings({ ...T.settings(), writeLanguage: 'en' });
  const table = T.loadNames(room);
  const A = require('../memory-module/lib/aliases.cjs');
  A.addPerson(table, '다니엘 크로우', [], { seeded: true });
  A.addPerson(table, '세라', [], { seeded: true });
  T.saveNames(room, table);
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'emotion', status: 'open', title: "Daniel's anger over the forged ledger", who: 'Daniel', toward: 'Sera', unaware: ['Victor'], guess: [], evidence: [], clues: [] });
  T.saveLedger(room, ledger);

  const first = await call('POST /chats/:id/glossary', room, { glossary: 'Daniel = 다니엘\nSera = 세라\nVictor = 빅터\nHarbor = 항구', source: '번역 프리셋·단어장' });
  assert.ifError(first.error);
  assert.equal(first.result.count, 4);
  assert.deepEqual(first.result.aliases, [{ from: 'Daniel', to: '다니엘 크로우' }, { from: 'Sera', to: '세라' }]);
  assert.deepEqual(T.loadNames(room).people['다니엘 크로우'].aliases, ['Daniel']);
  assert.equal((await call('POST /chats/:id/glossary', room, { glossary: 'Daniel = 다니엘\nSera = 세라\nVictor = 빅터\nHarbor = 항구' })).result.changed, false);

  // A line the model translated with the name left in Latin reads in Korean, particle fitted.
  const data = structuredClone(T.loadTranslations(room));
  data.items[Tr.key('ko', "Daniel's anger over the forged ledger")] = '위조 장부에 대한 Daniel의 분노';
  T.saveTranslations(room, data);
  const tr = (await call('GET /chats/:id/translations', room)).result;
  assert.equal(tr.items["Daniel's anger over the forged ledger"], '위조 장부에 대한 다니엘의 분노');
  assert.equal(tr.items.Daniel, '다니엘 크로우', 'a name field shows the person');
  assert.equal(tr.items.Sera, '세라');
  assert.equal(tr.items.Victor, '빅터', 'nobody in the table: the glossary form');
  assert.equal(tr.glossary.count, 4);
});

test('glossary: a Korean side that names two people is not placed on either', async () => {
  const room = 'g2';
  const table = T.loadNames(room);
  const A = require('../memory-module/lib/aliases.cjs');
  A.addPerson(table, '마크 리', [], { seeded: true });
  A.addPerson(table, '마크 윤', [], { seeded: true });
  T.saveNames(room, table);
  const r = await call('POST /chats/:id/glossary', room, { glossary: 'Mark = 마크' });
  assert.deepEqual(r.result.aliases, []);
});

test('auto translation can be turned off; the library is told so', async () => {
  const on = (await call('GET /chats/:id/translations', 'g1')).result;
  assert.equal(on.auto, true, 'on by default');
  const saved = await call('POST /settings/language', null, { autoTranslate: false });
  assert.ifError(saved.error);
  assert.equal(saved.result.autoTranslate, false);
  assert.equal((await call('GET /chats/:id/translations', 'g1')).result.auto, false);
  await call('POST /settings/language', null, { autoTranslate: true });
});
