'use strict';
// The rename endpoints: preview, apply only with the preview's token, undo, and never while a job writes the room.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-names-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
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

function seed(room) {
  const store = Object.assign(S.emptyStore(), { cast: ['나델 모로'], personas: ['유온'] });
  store.scenes.push({ id: 'S1', start: 1, end: 1, title: '나디의 편지', summary: '나디가 유온에게 편지를 줬다.', present: ['나디', '유온'], events: [{ text: '나디가 웃었다', quotes: [{ number: 1, sentence: 1, text: '"Tieni."', by: '나디', to: '유온' }] }], recollections: [] });
  const ledger = L.emptyLedger();
  ledger.routine = [{ who: '나디', what: 'meal', text: '빵', at: '2024-02-01T08:00', number: 1 }];
  T.saveScenes(room, store);
  T.saveLedger(room, ledger);
}

test('preview, apply with the token, then undo', async () => {
  seed('r1');
  const body = { source: '나디', target: '나델 모로', display: '나델' };
  const p = await call('POST /chats/:id/names/preview', 'r1', body);
  assert.ifError(p.error);
  assert.equal(p.result.counts.quoteBy, 1);
  assert.equal(p.result.counts.routine, 1);
  assert.equal(T.loadScenes('r1').scenes[0].title, '나디의 편지', 'a preview saves nothing');
  assert.match((await call('POST /chats/:id/names/apply', 'r1', body)).error, /미리 보기를 확인/);
  assert.match((await call('POST /chats/:id/names/apply', 'r1', { ...body, confirm: true, token: 'stale' })).error, /미리 본 뒤에/);
  const a = await call('POST /chats/:id/names/apply', 'r1', { ...body, confirm: true, token: p.result.token });
  assert.ifError(a.error);
  assert.equal(T.loadScenes('r1').scenes[0].title, '나델의 편지');
  assert.equal(T.loadScenes('r1').scenes[0].events[0].quotes[0].by, '나델 모로');
  assert.equal(T.loadLedger('r1').routine[0].who, '나델 모로');
  const names = (await call('GET /chats/:id/names', 'r1')).result;
  assert.deepEqual(names.people['나델 모로'].aliases, ['나디']);
  assert.equal(names.history.length, 1);
  // On disk, so a restart keeps it.
  assert.ok(fs.existsSync(path.join(dir, 'memory-module/chats/r1.names.json')));
  const u = await call('POST /chats/:id/names/undo', 'r1');
  assert.ifError(u.error);
  assert.equal(T.loadScenes('r1').scenes[0].title, '나디의 편지');
  assert.equal(T.loadLedger('r1').routine[0].who, '나디');
  assert.equal(T.loadNames('r1').people['나델 모로'], undefined, 'the table is as it was');
});

test('a rename is refused while a job writes the room, and one queued behind a job waits for it', async () => {
  seed('r2');
  const body = { source: '나디', target: '나델 모로' };
  const p = (await call('POST /chats/:id/names/preview', 'r2', body)).result;
  T.sceneJobs.set('r2', { state: 'running' });
  const refused = await call('POST /chats/:id/names/apply', 'r2', { ...body, confirm: true, token: p.token });
  assert.match(refused.error, /정리하는 중/);
  assert.match((await call('POST /chats/:id/names/undo', 'r2')).error, /정리하는 중/);
  assert.equal((await call('GET /chats/:id/names', 'r2')).result.busy, true);
  T.sceneJobs.delete('r2');
  // A job that holds the room's queue and writes the scenes: the rename runs after it, on what it saved, and the
  // preview made before the job changed them is no longer valid.
  let release;
  const job = T.enqueue('scenes:r2', () => new Promise((resolve) => { release = resolve; }).then(() => {
    const store = structuredClone(T.loadScenes('r2'));
    store.scenes[0].summary = '나디가 편지를 다시 썼다.';
    T.saveScenes('r2', store);
  }));
  const pending = call('POST /chats/:id/names/apply', 'r2', { ...body, confirm: true, token: p.token });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(T.loadScenes('r2').scenes[0].events[0].quotes[0].by, '나디', 'nothing written while the job holds the room');
  release();
  await job;
  const out = await pending;
  assert.match(out.error, /미리 본 뒤에/);
  assert.equal(T.loadScenes('r2').scenes[0].summary, '나디가 편지를 다시 썼다.', 'the job\'s work is kept');
  const fresh = (await call('POST /chats/:id/names/preview', 'r2', body)).result;
  assert.ifError((await call('POST /chats/:id/names/apply', 'r2', { ...body, confirm: true, token: fresh.token })).error);
  assert.equal(T.loadScenes('r2').scenes[0].summary, '나델 모로가 편지를 다시 썼다.');
});

test('duplicates by rule merge at once, and a dismissed suggestion is not offered again', async () => {
  const store = Object.assign(S.emptyStore(), { cast: ['나델 모로'], personas: ['유나린'] });
  T.saveScenes('r3', store);
  const ledger = L.emptyLedger();
  ledger.routine = [
    { who: '나델 모로', what: 'meal', text: '빵', at: '2024-02-01T08:00', number: 1 },
    { who: '나델 모로가', what: 'meal', text: '수프', at: '2024-02-01T12:00', number: 2 },
    { who: 'Yunarin', what: 'sleep', text: '잠', at: '2024-02-01T23:00', number: 3 },
  ];
  T.saveLedger('r3', ledger);
  const names = (await call('GET /chats/:id/names', 'r3')).result;
  assert.deepEqual(names.duplicates, [{ target: '나델 모로', variants: [{ name: '나델 모로가', count: 1 }] }]);
  assert.ok(names.suggestions.some((x) => x.source === 'Yunarin' && x.target === '유나린'));
  const m = (await call('POST /chats/:id/names/merge-preview', 'r3')).result;
  assert.equal(m.counts.routine, 1);
  assert.ifError((await call('POST /chats/:id/names/merge', 'r3', { confirm: true, token: m.token })).error);
  assert.equal(T.loadLedger('r3').routine.filter((r) => r.who === '나델 모로').length, 2);
  assert.equal(T.loadLedger('r3').routine.find((r) => r.who === 'Yunarin').who, 'Yunarin', 'a suggestion is never merged on its own');
  assert.ifError((await call('POST /chats/:id/names/dismiss', 'r3', { source: 'Yunarin', target: '유나린' })).error);
  assert.ok(!(await call('GET /chats/:id/names', 'r3')).result.suggestions.some((x) => x.source === 'Yunarin'));
});
