'use strict';
// Local backup download / restore of one room's memory. Anonymized data only.
const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-backup-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const B = require('../memory-module/lib/backup.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const V = require('../memory-module/lib/vectors.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const CHATS = path.join(dir, 'memory-module/chats');
const UNDO = path.join(dir, 'memory-module/restore-undo');
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async getById(id) { return { id, name: id === 'roomA' ? '푸른/달: "방"?' : '다른 방' }; } } });
service.attach(app);
const call = async (key, id, body, query = {}) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body, query }, reply);
  return { result, error };
};
const file = (id, suffix) => path.join(CHATS, `${id}${suffix}`);

/** A small but complete room. `tag` makes two rooms differ. */
function seed(id, tag = 'a', { vectors = true } = {}) {
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 't1', title: `${tag} 약속`, status: 'open', kind: 'promise' });
  ledger.routine = [{ who: '민서', what: 'meal', text: `${tag} 빵`, at: 1 }];
  const scenes = S.emptyStore();
  scenes.scenes.push({ id: 'S1', start: 1, end: 4, title: `${tag} 장면`, summary: '민서와 하윤이 만났다.', events: [] }, { id: 'S2', start: 5, end: 8, title: `${tag} 장면 둘`, summary: '이어진 일.', events: [] });
  scenes.facts.push({ id: 'F1', text: `${tag} 사실`, status: 'live' });
  const names = A.emptyTable();
  names.people['민서'] = { aliases: ['서서'] };
  const files = {
    '.json': ledger,
    '.scenes.json': scenes,
    '.names.json': names,
    '.selected.json': { version: 1, items: [{ id: 'sel1', title: `${tag} 선택`, parts: [] }] },
    '.translations.json': { v: 1, items: { k1: 'v1', k2: 'v2' } },
    '.attribution-log.json': { version: 1, runs: [{ at: 'x', entries: [] }] },
  };
  if (vectors) files['.vectors.json'] = { v: V.INDEX_VERSION, model: 'embed-x', items: { a: { h: '1' }, b: { h: '2' } } };
  fs.mkdirSync(CHATS, { recursive: true });
  for (const [suffix, value] of Object.entries(files)) fs.writeFileSync(file(id, suffix), JSON.stringify(value));
  const s = X.settings();
  X.saveSettings({ ...s, chats: { ...s.chats, [id]: { enabled: true, routine: 'off', organize: { npcCoverage: 'expanded', quoteMode: 'both', detailLevel: 'detailed' } } } });
  return files;
}
const snapshot = (id) => Object.fromEntries(fs.readdirSync(CHATS).filter((n) => n.startsWith(`${id}.`)).sort().map((n) => [n, fs.readFileSync(path.join(CHATS, n), 'utf8')]));
const wipe = () => { fs.rmSync(CHATS, { recursive: true, force: true }); fs.rmSync(UNDO, { recursive: true, force: true }); X.saveSettings({ connection: null, chats: {} }); X.jobs.clear(); for (const id of ['roomA', 'roomB', 'roomC']) X.clearRoomCaches(id); };
beforeEach(wipe);

const exportRoom = async (id, vectors = true) => (await call('GET /chats/:id/backup', id, null, vectors ? { vectors: '1' } : {})).result;

test('export: every per-room file, header with hashes, the settings entry; vectors only when asked', async () => {
  const files = seed('roomA');
  const full = await exportRoom('roomA');
  const { header } = full.backup;
  assert.equal(header.format, 'marinara-memory-backup');
  assert.equal(header.version, 1);
  assert.equal(header.chatId, 'roomA');
  assert.equal(header.chatName, '푸른/달: "방"?');
  assert.ok(!Number.isNaN(Date.parse(header.createdAt)));
  assert.ok('moduleVersion' in header);
  assert.deepEqual(Object.keys(full.backup.files).sort(), ['attribution-log', 'ledger', 'names', 'scenes', 'selected', 'translations', 'vectors']);
  assert.deepEqual(Object.keys(header.fileHashes).sort(), Object.keys(full.backup.files).sort());
  assert.deepEqual(full.backup.files.scenes, files['.scenes.json']);
  assert.deepEqual(full.backup.files.ledger, files['.json']);
  assert.deepEqual(full.backup.settings, X.settings().chats.roomA);
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(full.backup))));
  assert.match(full.fileName, /^기억백업-푸른 달 방-\d{8}-\d{4}\.json$/, 'file name is sanitized');
  const light = await exportRoom('roomA', false);
  assert.equal('vectors' in light.backup.files, false);
  assert.equal('vectors' in light.backup.header.fileHashes, false);
});

test('export is read-only, refuses bad ids and empty rooms', async () => {
  seed('roomA');
  const before = snapshot('roomA');
  const settingsBefore = fs.readFileSync(path.join(dir, 'memory-module/settings.json'), 'utf8');
  await exportRoom('roomA');
  assert.deepEqual(snapshot('roomA'), before);
  assert.equal(fs.readFileSync(path.join(dir, 'memory-module/settings.json'), 'utf8'), settingsBefore);
  assert.match((await call('GET /chats/:id/backup', '../etc', null)).error, /invalid chat id/);
  assert.match((await call('GET /chats/:id/backup', 'roomC', null)).error, /백업할 기억이 없습니다/);
  fs.writeFileSync(file('roomA', '.scenes.json'), '{broken');
  assert.match((await call('GET /chats/:id/backup', 'roomA', null)).error, /손상되어/, 'a damaged file is reported, not silently left out');
});

test('file names are safe', () => {
  const d = new Date(2026, 0, 2, 3, 4);
  assert.equal(B.fileName('방 이름', d), '기억백업-방 이름-20260102-0304.json');
  assert.equal(B.fileName('', d), '기억백업-이름없음-20260102-0304.json');
  assert.doesNotMatch(B.fileName('../../x\\y:z*?"<>|', d), /[\\/:*?"<>|]/);
  assert.ok(B.fileName('가'.repeat(300), d).length < 80);
  assert.doesNotMatch(B.fileName('..', d), /-\.\.-/);
});

test('round trip: export, change the room, restore: files and settings equal the original; caches are cleared', async () => {
  const original = seed('roomA');
  const before = snapshot('roomA');
  const settingsBefore = structuredClone(X.settings().chats.roomA);
  const backup = (await exportRoom('roomA')).backup;
  // Load into the caches, then change everything.
  assert.equal(X.loadLedger('roomA').threads.length, 1);
  assert.equal(X.loadScenes('roomA').scenes.length, 2);
  const changed = structuredClone(original['.json']);
  changed.threads.push({ id: 't2', title: '새 일', status: 'open' });
  X.saveLedger('roomA', changed);
  fs.writeFileSync(file('roomA', '.scenes.json'), JSON.stringify(S.emptyStore()));
  fs.rmSync(file('roomA', '.names.json'));
  X.clearRoomCaches('roomA');
  X.loadLedger('roomA');
  X.saveSettings({ ...X.settings(), chats: { roomA: { enabled: true, routine: 'on' } } });

  const preview = (await call('POST /chats/:id/restore/preview', 'roomA', { backup })).result;
  assert.equal(preview.sameRoom, true);
  assert.equal(preview.crossRoomRequired, false);
  assert.equal(preview.source.chatId, 'roomA');
  assert.equal(preview.source.chatName, '푸른/달: "방"?');
  assert.equal(preview.backup.scenes, 2);
  assert.equal(preview.current.scenes, 0);
  assert.equal(preview.backup.threads, 1);
  assert.equal(preview.current.threads, 2);
  assert.equal(preview.backup.facts, 1);
  assert.equal(preview.backup.vectors, 2);
  assert.equal(preview.vectors.inBackup, true);
  assert.equal(preview.undoAvailable, false);
  // Preview writes nothing.
  assert.equal(X.loadScenes('roomA').scenes.length, 0);
  assert.equal(fs.existsSync(UNDO), false);

  const applied = await call('POST /chats/:id/restore/apply', 'roomA', { backup });
  assert.ifError(applied.error);
  assert.equal(applied.result.undoAvailable, true);
  assert.deepEqual(snapshot('roomA'), before, 'every file is back as it was');
  assert.equal(X.loadLedger('roomA').threads.length, 1, 'cache reloaded from the restored file');
  assert.equal(X.loadScenes('roomA').scenes.length, 2);
  assert.equal(X.loadNames('roomA').people['민서'].aliases[0], '서서');
  const after = X.settings().chats.roomA;
  assert.equal(after.routine, settingsBefore.routine);
  assert.deepEqual(after.organize, settingsBefore.organize);
  assert.equal(after.enabled, true, 'whether memory is on is left as it is now');
});

test('restore keeps memory on/off as it is now; a room without settings is not switched on', async () => {
  seed('roomA');
  const backup = (await exportRoom('roomA')).backup;
  X.saveSettings({ chats: { roomA: { enabled: false } } });
  await call('POST /chats/:id/restore/apply', 'roomA', { backup });
  assert.equal(X.settings().chats.roomA.enabled, false);
  assert.equal(X.settings().chats.roomA.routine, 'off');
  X.saveSettings({ chats: {} });
  await call('POST /chats/:id/restore/apply', 'roomA', { backup });
  assert.equal('enabled' in X.settings().chats.roomA, false);
});

test('vectors absent from the backup: the current index is cleared and the preview says so', async () => {
  seed('roomA');
  const backup = (await exportRoom('roomA', false)).backup;
  const preview = (await call('POST /chats/:id/restore/preview', 'roomA', { backup })).result;
  assert.deepEqual(preview.vectors, { inBackup: false, willClear: true });
  await call('POST /chats/:id/restore/apply', 'roomA', { backup });
  assert.equal(fs.existsSync(file('roomA', '.vectors.json')), false);
  const kept = (await exportRoom('roomA', true)).backup;
  assert.equal('vectors' in kept.files, false);
});

test('a running job blocks restore and undo', async () => {
  seed('roomA');
  const backup = (await exportRoom('roomA')).backup;
  X.jobs.set('roomA', { state: 'running' });
  const before = snapshot('roomA');
  assert.match((await call('POST /chats/:id/restore/apply', 'roomA', { backup })).error, /정리하는 중이라 불러올 수 없습니다/);
  assert.equal((await call('POST /chats/:id/restore/preview', 'roomA', { backup })).result.busy, true);
  assert.deepEqual(snapshot('roomA'), before);
  assert.equal(fs.existsSync(UNDO), false, 'no safety copy for a refused restore');
  X.jobs.delete('roomA');
  X.sceneJobs.set('roomA', { state: 'running' });
  assert.match((await call('POST /chats/:id/restore/apply', 'roomA', { backup })).error, /불러올 수 없습니다/);
  X.sceneJobs.delete('roomA');
  assert.ifError((await call('POST /chats/:id/restore/apply', 'roomA', { backup })).error);
  X.jobs.set('roomA', { state: 'running' });
  assert.match((await call('POST /chats/:id/restore/undo', 'roomA', {})).error, /되돌릴 수 없습니다/);
  X.jobs.delete('roomA');
});

test('a backup of another room needs the explicit flag; then only the file names change', async () => {
  const original = seed('roomA', 'a');
  seed('roomB', 'b');
  const backup = (await exportRoom('roomA')).backup;
  const preview = (await call('POST /chats/:id/restore/preview', 'roomB', { backup })).result;
  assert.equal(preview.sameRoom, false);
  assert.equal(preview.crossRoomRequired, true);
  assert.equal(preview.source.chatId, 'roomA');
  const roomBBefore = snapshot('roomB');
  for (const flag of [undefined, false, 'true', 1]) {
    assert.match((await call('POST /chats/:id/restore/apply', 'roomB', { backup, crossRoom: flag })).error, /다른 방의 백업/);
  }
  assert.deepEqual(snapshot('roomB'), roomBBefore, 'nothing changed without the flag');
  assert.ifError((await call('POST /chats/:id/restore/apply', 'roomB', { backup, crossRoom: true })).error);
  const restored = snapshot('roomB');
  assert.deepEqual(Object.keys(restored).sort(), Object.keys(snapshot('roomA')).sort().map((n) => n.replace('roomA', 'roomB')));
  assert.deepEqual(JSON.parse(restored['roomB.scenes.json']), original['.scenes.json'], 'contents, message ids and numbers included, are exactly the backup');
  assert.equal(JSON.parse(restored['roomB.json']).threads[0].title, 'a 약속');
  assert.equal(X.loadScenes('roomB').scenes[0].title, 'a 장면');
});

test('the pre-restore safety copy keeps what was there, and the restore can be undone once', async () => {
  seed('roomA', 'a');
  const backup = (await exportRoom('roomA')).backup;
  seed('roomB', 'b');
  const roomBBefore = snapshot('roomB');
  const settingsB = structuredClone(X.settings().chats.roomB);
  assert.match((await call('POST /chats/:id/restore/undo', 'roomB', {})).error, /되돌릴 불러오기가 없습니다/);
  await call('POST /chats/:id/restore/apply', 'roomB', { backup, crossRoom: true });
  assert.notDeepEqual(snapshot('roomB'), roomBBefore);
  const copy = path.join(UNDO, 'roomB');
  assert.ok(fs.existsSync(path.join(copy, 'meta.json')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(copy, 'scenes.json'), 'utf8')).scenes[0].title, 'b 장면');
  assert.equal((await call('POST /chats/:id/restore/preview', 'roomB', { backup })).result.undoAvailable, true);
  // Only the latest copy is kept: a second restore replaces it.
  await call('POST /chats/:id/restore/apply', 'roomB', { backup, crossRoom: true });
  assert.equal(JSON.parse(fs.readFileSync(path.join(copy, 'scenes.json'), 'utf8')).scenes[0].title, 'a 장면');
  // Put the original back and undo from there.
  seed('roomB', 'b');
  X.clearRoomCaches('roomB');
  await call('POST /chats/:id/restore/apply', 'roomB', { backup, crossRoom: true });
  const undone = await call('POST /chats/:id/restore/undo', 'roomB', {});
  assert.ifError(undone.error);
  assert.deepEqual(snapshot('roomB'), roomBBefore);
  assert.deepEqual(X.settings().chats.roomB, settingsB);
  assert.equal(X.loadScenes('roomB').scenes[0].title, 'b 장면', 'caches cleared by the undo too');
  assert.equal(fs.existsSync(copy), false, 'the copy is used up');
  assert.match((await call('POST /chats/:id/restore/undo', 'roomB', {})).error, /되돌릴 불러오기가 없습니다/);
});

test('undoing a restore into an empty room removes what the restore created', async () => {
  seed('roomA');
  const backup = (await exportRoom('roomA')).backup;
  await call('POST /chats/:id/restore/apply', 'roomC', { backup, crossRoom: true });
  assert.ok(fs.existsSync(file('roomC', '.scenes.json')));
  assert.ok(X.settings().chats.roomC);
  await call('POST /chats/:id/restore/undo', 'roomC', {});
  assert.deepEqual(snapshot('roomC'), {});
  assert.equal(X.settings().chats.roomC, undefined);
});

test('malformed, tampered, unknown or oversized backups are rejected and change nothing', async () => {
  seed('roomA');
  const good = (await exportRoom('roomA')).backup;
  const before = snapshot('roomA');
  const clone = () => structuredClone(good);
  const rejects = async (doc, pattern, label) => {
    for (const route of ['preview', 'apply']) {
      const r = await call(`POST /chats/:id/restore/${route}`, 'roomA', { backup: doc, crossRoom: true });
      assert.match(r.error || '', pattern, `${label} (${route})`);
    }
  };
  await rejects(undefined, /내용이 없습니다/, 'nothing');
  await rejects('text', /내용이 없습니다/, 'a string');
  await rejects([], /백업 파일이 아닙니다/, 'an array');
  await rejects({}, /백업 파일이 아닙니다|기억 서재 백업/, 'an empty object');
  let d = clone(); d.header.format = 'other'; await rejects(d, /기억 서재 백업 파일이 아닙니다/, 'wrong format');
  d = clone(); d.header.version = 2; await rejects(d, /새 형식/, 'newer version');
  d = clone(); d.header.version = 'x'; await rejects(d, /버전/, 'version not a number');
  d = clone(); d.header.chatId = '../evil'; await rejects(d, /방 ID/, 'path traversal in the chat id');
  d = clone(); d.header.chatId = 'a/b'; await rejects(d, /방 ID/, 'slash in the chat id');
  d = clone(); d.header.createdAt = 'yesterday'; await rejects(d, /날짜/, 'bad date');
  d = clone(); d.files['../evil'] = { a: 1 }; await rejects(d, /알 수 없는 파일 항목/, 'unknown file key');
  d = clone(); d.files['evil.json'] = {}; await rejects(d, /알 수 없는 파일 항목/, 'unknown file key 2');
  d = clone(); d.extra = 1; await rejects(d, /알 수 없는 항목/, 'unknown top-level key');
  d = clone(); d.files = {}; await rejects(d, /불러올 기억이 없습니다/, 'no files');
  d = clone(); d.files.scenes.scenes = 'no'; await rejects(d, /scenes 파일 형식/, 'bad scenes shape');
  d = clone(); d.files.ledger.version = 99; await rejects(d, /ledger 파일 형식/, 'unknown ledger version');
  d = clone(); d.files.names = []; await rejects(d, /names 파일 형식/, 'names as array');
  d = clone(); d.files.selected.items = {}; await rejects(d, /selected 파일 형식/, 'selected shape');
  d = clone(); d.files.vectors.v = 1; await rejects(d, /vectors 파일 형식/, 'old vector layout');
  d = clone(); d.files.scenes.scenes[0].title = 'edited by hand'; await rejects(d, /scenes 파일이 손상되었거나/, 'content no longer matches its hash');
  d = clone(); delete d.header.fileHashes.scenes; await rejects(d, /scenes 파일 형식|손상/, 'missing hash');
  d = clone(); d.header.fileHashes.names = 'x'; await rejects(d, /names 파일이 손상/, 'wrong hash');
  d = clone(); d.settings = 'x'; await rejects(d, /방 설정/, 'settings entry not an object');
  d = JSON.parse(JSON.stringify(good).replace('"enabled"', '"__proto__"')); await rejects(d, /허용되지 않는 항목/, 'prototype key in the settings entry');
  d = clone(); d.files.ledger.threads[0].title = 'x'.repeat(51 * 1024 * 1024); await rejects(d, /너무 큽니다/, 'oversized');
  assert.deepEqual(snapshot('roomA'), before);
  assert.equal(fs.existsSync(UNDO), false);
  assert.match((await call('POST /chats/:id/restore/apply', '../x', { backup: good })).error, /invalid chat id/);
  assert.match((await call('POST /chats/:id/restore/preview', 'a.b', { backup: good })).error, /invalid chat id/);
});

test('nothing is ever written outside the chats folder (apart from the safety copy folder)', async () => {
  seed('roomA');
  const backup = (await exportRoom('roomA')).backup;
  const listing = () => {
    const out = [];
    const walk = (p) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); if (e.isDirectory()) walk(f); else out.push(path.relative(dir, f)); } };
    walk(dir);
    return out.sort();
  };
  await call('POST /chats/:id/restore/apply', 'roomB', { backup, crossRoom: true });
  const added = listing().filter((f) => !f.startsWith(path.join('memory-module', 'chats')));
  assert.ok(added.every((f) => f.startsWith(path.join('memory-module', 'restore-undo')) || f === path.join('memory-module', 'settings.json')), added.join(', '));
  assert.equal(fs.readdirSync(CHATS).some((n) => n.endsWith('.tmp')), false, 'no temporary files left');
});

test('deleting a room also deletes its safety copy', async () => {
  seed('roomA');
  const backup = (await exportRoom('roomA')).backup;
  await call('POST /chats/:id/restore/apply', 'roomA', { backup });
  assert.ok(fs.existsSync(path.join(UNDO, 'roomA')));
  X.purgeChatMemory('roomA');
  assert.equal(fs.existsSync(path.join(UNDO, 'roomA')), false);
  X.goneChats.delete('roomA');
});

test('a write that fails halfway puts the room back as it was', async () => {
  seed('roomA', 'a');
  const backup = (await exportRoom('roomA')).backup;
  seed('roomB', 'b');
  fs.rmSync(file('roomB', '.names.json'));
  const before = snapshot('roomB');
  // A directory sits where the temporary file of the names table goes: that write fails after the ledger and the
  // scenes were already replaced.
  fs.mkdirSync(`${file('roomB', '.names.json')}.${process.pid}.tmp`);
  const r = await call('POST /chats/:id/restore/apply', 'roomB', { backup, crossRoom: true });
  assert.match(r.error || '', /불러오지 못했습니다.*이전 상태로 되돌렸습니다/);
  fs.rmSync(`${file('roomB', '.names.json')}.${process.pid}.tmp`, { recursive: true, force: true });
  assert.deepEqual(snapshot('roomB'), before);
  assert.equal(X.loadScenes('roomB').scenes[0].title, 'b 장면');
  assert.equal(X.settings().chats.roomB.routine, 'off');
});

// ---- screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fn = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  }\n', start);
  return vm.runInNewContext(`(${source.slice(start, end + 4).trim()})`, { esc, Date });
};

test('screen: backup button, vectors checkbox, preview with counts, two-click apply, cross-room checkbox, undo', async () => {
  seed('roomA');
  const backup = (await exportRoom('roomA')).backup;
  const backupPaper = fn('backupPaper');
  const idle = backupPaper({ armed: '', preview: null, withVectors: false, running: false, undo: null });
  assert.match(idle, /data-act="backupDownload">백업 내려받기/);
  assert.match(idle, /id="setBackupVectors" >/);
  assert.match(idle, /검색 색인 포함 \(크기 큼\)/);
  assert.match(idle, /id="restoreFile"/);
  assert.doesNotMatch(idle, /restoreUndo|restoreApply/);
  assert.match(backupPaper({ armed: '', preview: null, withVectors: true, running: false, undo: null }), /id="setBackupVectors" checked/);
  assert.match(backupPaper({ armed: '', preview: null, withVectors: false, running: true, undo: null }), /id="restoreFile" accept="[^"]*" disabled/);

  const same = (await call('POST /chats/:id/restore/preview', 'roomA', { backup })).result;
  const html = backupPaper({ armed: '', preview: { room: 'roomA', data: same, cross: false }, withVectors: false, running: false, undo: null });
  assert.match(html, /장면: 백업 2 · 지금 2/);
  assert.match(html, /알게 된 사실: 백업 1/);
  assert.match(html, /푸른\/달: &quot;방&quot;\?/, 'room name escaped');
  assert.match(html, /data-act="restoreApply" >이 백업 불러오기/);
  assert.doesNotMatch(html, /restoreCross/);
  assert.match(backupPaper({ armed: 'restoreApply', preview: { room: 'roomA', data: same, cross: false }, running: false }), /한 번 더 누르면 백업을 불러옵니다/);

  const other = (await call('POST /chats/:id/restore/preview', 'roomB', { backup })).result;
  const blocked = backupPaper({ armed: '', preview: { room: 'roomB', data: other, cross: false }, running: false });
  assert.match(blocked, /id="restoreCross" >/);
  assert.match(blocked, /다른 방의 백업을 이 방에 적용/);
  assert.match(blocked, /data-act="restoreApply" disabled>/, 'cannot apply before the box is ticked');
  const ticked = backupPaper({ armed: '', preview: { room: 'roomB', data: other, cross: true }, running: false });
  assert.match(ticked, /id="restoreCross" checked/);
  assert.match(ticked, /data-act="restoreApply" >/);

  const undo = backupPaper({ armed: '', preview: null, running: false, undo: { at: '2026-01-02T03:04:00.000Z' } });
  assert.match(undo, /data-act="restoreUndo" >불러오기 되돌리기/);
  assert.match(backupPaper({ armed: 'restoreUndo', preview: null, running: false, undo: { at: '2026-01-02T03:04:00.000Z' } }), /한 번 더 누르면 불러오기를 되돌립니다/);
});

test('screen: the settings tab shows the backup section, and "처음부터 다시 정리" offers a backup first', () => {
  assert.match(source, /\$\{backupPaper\(\{/);
  assert.match(source, /armed === 'fresh' \? '<div class="note"[^']*먼저 백업 내려받기/);
  // The backup click keeps the "press once more" state of the dangerous button.
  assert.match(source, /'backupDownload', 'restoreApply', 'restoreUndo', 'addressDelete'\]\.includes\(actName\)\) armed = ''/);
  assert.match(source, /case 'backupDownload':/);
  assert.match(source, /\/restore\/preview/);
  assert.match(source, /\/restore\/apply/);
  assert.match(source, /\/restore\/undo/);
  assert.match(source, /createObjectURL/);
});
