// node --test tests/test-room-delete.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-room-delete-'));
process.env.DATA_DIR = dir;
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const service = require('../memory-module/lib/service.cjs');
const T = service._test;
const chatDir = path.join(dir, 'memory-module/chats');
const SUFFIXES = ['.json', '.scenes.json', '.names.json', '.selected.json', '.vectors.json', '.attribution-log.json', '.translations.json', '.address.json', '.state.json', '.places.json', '.conflicts.json', '.keepsakes.json', '.trackers.json', '.recall-prefs.json', '.scene-error.txt'];
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const file = (id, suffix) => path.join(chatDir, `${id}${suffix}`);
const filesOf = (id) => fs.existsSync(chatDir) ? fs.readdirSync(chatDir).filter((n) => n.startsWith(`${id}.`)) : [];

/** A room's whole set of memory files and a settings entry, as a real room would have. */
function seed(id, { scenes = 1 } = {}) {
  fs.mkdirSync(chatDir, { recursive: true });
  const store = S.emptyStore();
  store.scenes = Array.from({ length: scenes }, (_, i) => ({ id: `S${i + 1}`, title: `장면 ${i + 1}`, start: 1, end: 2, messages: [], events: [], summary: '' }));
  T.saveLedger(id, L.emptyLedger());
  T.saveScenes(id, store);
  for (const suffix of SUFFIXES.slice(2)) fs.writeFileSync(file(id, suffix), suffix.endsWith('.txt') ? 'error note' : '{"version":1,"items":[]}');
  const next = T.settings();
  next.chats = { ...next.chats, [id]: { enabled: true, organize: { npcCoverage: 'standard' }, routine: 'on' } };
  T.saveSettings(next);
}

/** A stand-in for the Marinara chat storage: only the ids in `alive` exist; list() also has hidden helper rooms. */
function engine(alive, { groups = {}, failing = false } = {}) {
  const rows = () => alive.map((id) => ({ id, name: `room ${id}`, groupId: Object.keys(groups).find((g) => groups[g].includes(id)) || null }));
  return {
    chats: {
      list: async () => { if (failing) throw Error('db down'); return rows(); },
      getById: async (id) => { if (failing) throw Error('db down'); return rows().find((r) => r.id === id) || null; },
      listByGroup: async (g) => (groups[g] || []).map((id) => ({ id })),
    },
  };
}

/** Start a test from nothing: no memory files, no per-room settings. */
function reset() {
  fs.rmSync(chatDir, { recursive: true, force: true });
  const next = T.settings();
  next.chats = {};
  T.saveSettings(next);
  for (const map of [T.goneChats]) map.clear();
}

const deleteReq = (id, url) => ({ method: 'DELETE', raw: { url: url || `/api/chats/${id}` } });

test('single delete: 2xx and the room is gone removes every file, the settings entry and the caches, only for that room', async () => {
  seed('room-a'); seed('room-b'); seed('room-b-branch');
  assert.equal(filesOf('room-a').length, SUFFIXES.length);
  T.setEngine(engine(['room-b', 'room-b-branch']));
  const before = Object.fromEntries(['room-b', 'room-b-branch'].map((id) => [id, filesOf(id).map((n) => fs.readFileSync(path.join(chatDir, n), 'utf8'))]));
  const req = deleteReq('room-a');
  await T.deletePrepare(req);
  const payload = '';
  assert.equal(await T.deleteOnSend(req, { statusCode: 204 }, payload), payload);
  assert.deepEqual(filesOf('room-a'), []);
  assert.equal(T.settings().chats['room-a'], undefined);
  assert.equal(T.loadLedger('room-a'), null, 'cache was dropped, the file is gone');
  assert.equal(T.loadScenes('room-a'), null);
  for (const id of ['room-b', 'room-b-branch']) {
    assert.equal(filesOf(id).length, SUFFIXES.length, id);
    assert.deepEqual(filesOf(id).map((n) => fs.readFileSync(path.join(chatDir, n), 'utf8')), before[id]);
    assert.equal(T.settings().chats[id].enabled, true);
  }
});

test('a non-2xx reply, an unrelated request, or a room that still exists deletes nothing', async () => {
  seed('keep-1');
  T.setEngine(engine(['keep-1']));
  for (const statusCode of [409, 404, 500, 302]) {
    const req = deleteReq('keep-1');
    await T.deletePrepare(req);
    await T.deleteOnSend(req, { statusCode }, '');
  }
  for (const req of [{ method: 'GET', raw: { url: '/api/chats/keep-1' } }, { method: 'POST', raw: { url: '/api/chats/keep-1' } }, { method: 'DELETE', raw: { url: '/api/chats/keep-1/notes' } }, { method: 'DELETE', raw: { url: '/api/chats/keep-1/messages/m1' } }]) {
    await T.deletePrepare(req);
    await T.deleteOnSend(req, { statusCode: 204 }, '');
  }
  assert.equal(filesOf('keep-1').length, SUFFIXES.length);
  // 2xx, but the room is still there (for example a different handler answered): nothing is removed.
  const req = deleteReq('keep-1');
  await T.deletePrepare(req);
  await T.deleteOnSend(req, { statusCode: 204 }, '');
  assert.equal(filesOf('keep-1').length, SUFFIXES.length);
  assert.equal(T.settings().chats['keep-1'].enabled, true);
  // The storage cannot answer: keep the memory.
  T.setEngine(engine(['keep-1'], { failing: true }));
  assert.deepEqual(await T.purgeIfGone(['keep-1']), []);
  assert.equal(filesOf('keep-1').length, SUFFIXES.length);
});

test('path traversal and odd ids never reach the file system', async () => {
  fs.writeFileSync(path.join(dir, 'memory-module', 'outside.json'), 'keep');
  fs.writeFileSync(path.join(dir, 'memory-module', 'settings.json.bak'), 'keep');
  T.setEngine(engine([]));
  for (const bad of ['..', '../outside', '..%2Foutside', 'a/b', 'a\\b', '', 'x'.repeat(200), 'a.b']) {
    assert.throws(() => T.purgeChatMemory(bad), /invalid chat id/, JSON.stringify(bad));
    assert.deepEqual(await T.purgeIfGone([bad]), []);
  }
  await assert.rejects(T.deleteOrphans(['../outside']), /invalid chat id/);
  for (const url of ['/api/chats/../outside', '/api/chats/%2e%2e', '/api/chats/a%2Fb', '/api/chats/group/../x']) {
    const req = deleteReq(null, url);
    await T.deletePrepare(req);
    assert.equal(req.mmDeleteIds, undefined, url);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'memory-module', 'outside.json'), 'utf8'), 'keep');
  assert.equal(fs.readFileSync(path.join(dir, 'memory-module', 'settings.json.bak'), 'utf8'), 'keep');
});

test('ids that share a prefix are separate rooms; a room id is not a prefix match of another', () => {
  seed('abc'); seed('abc-1'); seed('abcd');
  T.purgeChatMemory('abc');
  assert.deepEqual(filesOf('abc'), []);
  assert.equal(filesOf('abc-1').length, SUFFIXES.length);
  assert.equal(filesOf('abcd').length, SUFFIXES.length);
  assert.ok(T.settings().chats['abc-1'] && T.settings().chats.abcd && !T.settings().chats.abc);
});

test('a run still going for the deleted room is stopped and cannot bring its files back', async () => {
  seed('busy');
  const abort = new AbortController();
  const job = { state: 'running', cancel: false, abort };
  T.jobs.set('busy', job);
  T.sceneJobs.set('busy', { state: 'running', cancel: false, abort: new AbortController() });
  T.setEngine(engine([]));
  const req = deleteReq('busy');
  await T.deletePrepare(req);
  await T.deleteOnSend(req, { statusCode: 204 }, '');
  assert.equal(job.cancel, true);
  assert.equal(abort.signal.aborted, true);
  assert.deepEqual(filesOf('busy'), []);
  // What the finishing job would write.
  assert.throws(() => T.saveLedger('busy', L.emptyLedger()), /삭제된 방/);
  assert.throws(() => T.saveScenes('busy', S.emptyStore()), /삭제된 방/);
  assert.throws(() => T.saveNames('busy', { people: {} }), /삭제된 방/);
  assert.throws(() => T.writeJson(path.join(chatDir, 'busy.vectors.json'), {}), /삭제된 방/);
  const settings = T.settings();
  settings.chats = { ...settings.chats, busy: { enabled: true } };
  T.saveSettings(settings);
  assert.equal(T.settings().chats.busy, undefined, 'settings for the deleted room are dropped, others kept');
  assert.ok(T.settings().chats['abc-1']);
  await service.processChat('busy', { reason: 'reply' });
  assert.deepEqual(filesOf('busy'), []);
  assert.equal(T.jobs.has('busy'), false);
  // Other rooms still save.
  T.saveLedger('abc-1', L.emptyLedger());
});

test('a group delete removes the memory of every room of the group, read before the handler ran', async () => {
  for (const id of ['g-1', 'g-2', 'g-3', 'solo']) seed(id);
  const groups = { grp: ['g-1', 'g-2', 'g-3'] };
  T.setEngine(engine(['solo'], { groups }));
  // Before the handler the engine still lists the group's rooms.
  const before = engine(['g-1', 'g-2', 'g-3', 'solo'], { groups });
  T.setEngine(before);
  const req = deleteReq(null, '/api/chats/group/grp?force=1');
  await T.deletePrepare(req);
  assert.deepEqual(req.mmDeleteIds, ['g-1', 'g-2', 'g-3']);
  T.setEngine(engine(['solo'], { groups }));
  await T.deleteOnSend(req, { statusCode: 204 }, '');
  for (const id of ['g-1', 'g-2', 'g-3']) { assert.deepEqual(filesOf(id), [], id); assert.equal(T.settings().chats[id], undefined); }
  assert.equal(filesOf('solo').length, SUFFIXES.length);
  // A refused group delete removes nothing.
  for (const id of ['h-1', 'h-2']) seed(id);
  const groups2 = { held: ['h-1', 'h-2'] };
  T.setEngine(engine(['h-1', 'h-2'], { groups: groups2 }));
  const refused = deleteReq(null, '/api/chats/group/held');
  await T.deletePrepare(refused);
  await T.deleteOnSend(refused, { statusCode: 409 }, '');
  assert.equal(filesOf('h-1').length, SUFFIXES.length);
  // Only the rooms that are really gone: one survivor of a partial delete keeps its memory.
  T.setEngine(engine(['h-2'], { groups: groups2 }));
  const partial = { method: 'DELETE', raw: { url: '/api/chats/group/held' }, mmDeleteIds: ['h-1', 'h-2'] };
  await T.deleteOnSend(partial, { statusCode: 204 }, '');
  assert.deepEqual(filesOf('h-1'), []);
  assert.equal(filesOf('h-2').length, SUFFIXES.length);
});

test('abandoning a scene chat removes its memory too', async () => {
  seed('scene-1');
  T.setEngine(engine([]));
  const req = { method: 'POST', raw: { url: '/api/scene/abandon' }, body: { sceneChatId: 'scene-1' } };
  await T.deletePrepare(req);
  assert.deepEqual(req.mmDeleteIds, ['scene-1']);
  await T.deleteOnSend(req, { statusCode: 200 }, '{}');
  assert.deepEqual(filesOf('scene-1'), []);
  const other = { method: 'POST', raw: { url: '/api/scene/create' }, body: { sceneChatId: 'x' } };
  await T.deletePrepare(other);
  assert.equal(other.mmDeleteIds, undefined);
});

test('orphan listing finds files-only, settings-only and unlisted rooms; existing and hidden helper rooms are not orphans', async () => {
  reset();
  seed('live'); seed('hidden-helper'); seed('files-only', { scenes: 3 });
  const next = T.settings();
  next.chats['settings-only'] = { enabled: false };
  // files-only has no settings entry
  delete next.chats['files-only'];
  T.saveSettings(next);
  // hidden-helper is not shown by Marinara's chat list but the storage still has it
  T.setEngine(engine(['live', 'hidden-helper']));
  const list = await T.listOrphans();
  const ids = list.map((x) => x.id).sort();
  assert.deepEqual(ids, ['files-only', 'settings-only']);
  const filesOnly = list.find((x) => x.id === 'files-only');
  assert.equal(filesOnly.scenes, 3);
  assert.equal(filesOnly.hint, '장면 1');
  assert.equal(filesOnly.files, SUFFIXES.length);
  assert.ok(filesOnly.bytes > 0);
  assert.equal(filesOnly.settingsOnly, false);
  const settingsOnly = list.find((x) => x.id === 'settings-only');
  assert.equal(settingsOnly.settingsOnly, true);
  assert.equal(settingsOnly.files, 0);
  // Listing deleted nothing.
  assert.equal(filesOf('files-only').length, SUFFIXES.length);
  assert.ok(T.settings().chats['settings-only']);
  T.setEngine(engine([], { failing: true }));
  await assert.rejects(T.listOrphans(), /db down/);
});

test('orphan delete removes only that orphan and refuses a room that still exists', async () => {
  reset();
  seed('live'); seed('hidden-helper'); seed('files-only'); T.saveSettings({ ...T.settings(), chats: { ...T.settings().chats, 'settings-only': {} } });
  T.setEngine(engine(['live', 'hidden-helper']));
  const refused = await T.deleteOrphans(['live', 'hidden-helper']);
  assert.deepEqual(refused, { deleted: [], refused: ['live', 'hidden-helper'] });
  assert.equal(filesOf('live').length, SUFFIXES.length);
  assert.ok(T.settings().chats.live);
  const done = await T.deleteOrphans(['files-only', 'settings-only']);
  assert.deepEqual(done.deleted, ['files-only', 'settings-only']);
  assert.deepEqual(filesOf('files-only'), []);
  assert.equal(T.settings().chats['settings-only'], undefined);
  assert.equal(filesOf('live').length, SUFFIXES.length);
});

test('orphan routes: list, delete one, delete all (bulk), refusing rooms that exist', async () => {
  const handlers = {};
  const fake = {
    register: (fn) => { handlers.plugin = fn; },
    addHook: () => {},
  };
  service.attach(fake);
  const app = {};
  for (const verb of ['get', 'post', 'put', 'patch', 'delete', 'all']) app[verb] = (route, fn) => { handlers[`${verb} ${route}`] = fn; };
  await handlers.plugin(app);
  const reply = () => { const r = { code: 200, status(c) { r.code = c; return r; }, send(b) { r.body = b; return r; } }; return r; };
  const call = async (key, params = {}) => { const r = reply(); const out = await handlers[key]({ params, body: {} }, r); return r.code === 200 ? out : { code: r.code, ...r.body }; };
  reset();
  seed('live');
  for (const id of ['o-1', 'o-2', 'o-3']) seed(id);
  T.setEngine(engine(['live']));
  const listed = await call('get /orphans');
  assert.deepEqual(listed.orphans.map((x) => x.id).sort(), ['o-1', 'o-2', 'o-3']);
  assert.deepEqual(await call('delete /orphans/:id', { id: 'o-1' }), { deleted: ['o-1'] });
  assert.deepEqual(filesOf('o-1'), []);
  const live = await call('delete /orphans/:id', { id: 'live' });
  assert.equal(live.code, 400);
  assert.equal(filesOf('live').length, SUFFIXES.length);
  assert.equal((await call('delete /orphans/:id', { id: '../x' })).code, 400);
  const all = await call('post /orphans/delete-all');
  assert.deepEqual(all.deleted.sort(), ['o-2', 'o-3']);
  assert.deepEqual(all.refused, []);
  assert.equal(filesOf('o-2').length + filesOf('o-3').length, 0);
  assert.equal(filesOf('live').length, SUFFIXES.length, 'bulk delete leaves rooms that exist');
  assert.deepEqual((await call('get /orphans')).orphans, []);
});

test('the branch of a deleted room keeps its own memory', async () => {
  seed('parent-room'); seed('child-room');
  const childBefore = filesOf('child-room').map((n) => fs.readFileSync(path.join(chatDir, n), 'utf8'));
  T.setEngine(engine(['child-room']));
  const req = deleteReq('parent-room');
  await T.deletePrepare(req);
  await T.deleteOnSend(req, { statusCode: 204 }, '');
  assert.deepEqual(filesOf('parent-room'), []);
  assert.deepEqual(filesOf('child-room').map((n) => fs.readFileSync(path.join(chatDir, n), 'utf8')), childBefore);
  assert.ok(T.settings().chats['child-room']);
});
