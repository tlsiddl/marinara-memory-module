'use strict';
// 0.39.2 목록 정리: a new name that is not a person stays out of a simulator room's cast; names written nowhere and
// names that do not read as a person's are listed in the name tab and taken out only when the user asks (with undo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-cast-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const Sim = require('../memory-module/lib/simulator.cjs');
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

test('notAPerson: jamo, groups, descriptions and lone role words; real names pass', () => {
  const no = ['ㄴ', 'ㅇㅇ', 'the first-years', 'the guards', 'Abernethy boy', 'dark-haired girl in the window', '창가의 소녀', 'A stranger', 'Guard', '경비병'];
  const yes = ['율', '톰', '하람', 'Cassian Selwyn', '미네르바 맥고나걸', 'Guard Malone', 'Ollivander', 'Professor Flitwick', 'Mr Mistry', 'Isolde Thackeray', '하람 윤'];
  for (const n of no) assert.ok(Sim.notAPerson(n), `${n} is not a person`);
  for (const n of yes) assert.equal(Sim.notAPerson(n), null, `${n} is a name`);
});

test('a new name from a scene reply is not added when it is not a person (a one-syllable name passes notAPerson; newPeople keeps its own older rule for those)', () => {
  const store = Object.assign(S.emptyStore(), { mode: 'simulator', cast: ['[시험] 카시안'], narrators: ['[시험] 내레이터'], personas: ['[시험] 이리나'] });
  const slice = [{ number: 1, role: 'assistant', speaker: '[시험] 내레이터', content: '[시험] Guard said nothing. 하람 waved. The dark-haired girl in the window smiled. ㄴ.', sentences: ['x'] }];
  const scenes = [{ events: [{ quotes: [{ by: 'Guard', to: '하람' }, { by: '하람', to: 'dark-haired girl in the window' }, { by: 'ㄴ', to: '하람' }] }] }];
  assert.deepEqual(Sim.newPeople(store, scenes, slice), ['하람']);
});

function seedRoom(room) {
  const store = Object.assign(S.emptyStore(), { mode: 'simulator', cast: ['[시험] 카시안', 'ㄴ', 'Guard', '[시험] 이졸데'], narrators: ['[시험] 내레이터'], personas: ['[시험] 이리나'], castAliases: { ㄴ: ['ㄴㄴ'] } });
  store.scenes.push({ id: 'S1', start: 1, end: 1, title: '[시험] 첫 장면', summary: '[시험]', present: ['[시험] 카시안', 'Guard'], events: [{ text: '[시험]', quotes: [{ number: 1, sentence: 1, text: '"[시험]"', by: 'Guard', to: '[시험] 카시안' }] }], recollections: [] });
  const ledger = Object.assign(L.emptyLedger(), { cast: ['[시험] 카시안', 'ㄴ'] });
  T.saveScenes(room, store);
  T.saveLedger(room, ledger);
  const table = T.loadNames(room);
  table.people = { ...(table.people || {}), ㄴ: { aliases: ['ㄴㄴ'] } };
  T.saveNames(room, table);
}

test('the name tab lists unused and not-a-person names; taking out needs confirm, keeps memories, and can be undone', async () => {
  seedRoom('c1');
  const names = (await call('GET /chats/:id/names', 'c1')).result;
  assert.ok(names.unused.some((x) => x.name === 'ㄴ'), 'ㄴ is written nowhere');
  assert.ok(!names.unused.some((x) => x.name === 'Guard'), 'Guard speaks a line');
  const g = names.suspects.find((x) => x.name === 'Guard');
  assert.ok(g && g.why === 'role' && g.uses >= 1);
  assert.ok(!names.suspects.some((x) => x.name === '[시험] 이리나'), "the user's character is never listed");
  assert.match((await call('POST /chats/:id/names/forget', 'c1', { names: ['ㄴ'] })).error, /미리 보기를 확인/);
  assert.match((await call('POST /chats/:id/names/forget', 'c1', { names: ['[시험] 이리나'], confirm: true })).error, /뺄 수 없습니다/);
  const f = await call('POST /chats/:id/names/forget', 'c1', { names: ['ㄴ', 'Guard'], confirm: true });
  assert.ifError(f.error);
  const s = T.loadScenes('c1');
  assert.deepEqual(s.cast, ['[시험] 카시안', '[시험] 이졸데']);
  assert.equal(s.castAliases.ㄴ, undefined);
  assert.deepEqual(T.loadLedger('c1').cast, ['[시험] 카시안']);
  assert.equal(T.loadNames('c1').people.ㄴ, undefined);
  assert.equal(s.scenes[0].events[0].quotes[0].by, 'Guard', 'memories that name them stay');
  assert.deepEqual(f.result.forgotten.map((r) => r.name), ['Guard', 'ㄴ']);
  // A taken-out name is not seeded back.
  T.seedNames('c1', ['ㄴ']);
  assert.equal(T.loadNames('c1').people.ㄴ, undefined, 'not seeded back');
  const u = await call('POST /chats/:id/names/forget-undo', 'c1', { name: 'ㄴ' });
  assert.ifError(u.error);
  assert.ok(T.loadScenes('c1').cast.includes('ㄴ'));
  assert.deepEqual(T.loadScenes('c1').castAliases.ㄴ, ['ㄴㄴ']);
  assert.ok(T.loadLedger('c1').cast.includes('ㄴ'));
  assert.deepEqual(T.loadNames('c1').people.ㄴ.aliases, ['ㄴㄴ']);
  assert.deepEqual(u.result.forgotten.map((r) => r.name), ['Guard']);
});
