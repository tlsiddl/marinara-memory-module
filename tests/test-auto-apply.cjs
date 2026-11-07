'use strict';
// 제안 자동 적용 (autoApply, on by default): tracker cycle starts and the suggestions learned from the user's edits are applied
// at once, can be taken back exactly, are never applied again after an undo, and never touch the "같은 사람일 수 있음" merges
// or the record conflicts. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-autoapply-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const N = require('../memory-module/lib/names.cjs');
const Tk = require('../memory-module/lib/trackers.cjs');
const Addr = require('../memory-module/lib/address.cjs');
const Cf = require('../memory-module/lib/conflicts.cjs');
const F = require('../memory-module/lib/features.cjs');
const B = require('../memory-module/lib/backup.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async getById(id) { return { id, name: '방' }; }, async listMessages() { return []; } } });
service.attach(app);
const call = async (key, id, body, params = {}) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id, ...params }, body, query: {} }, reply);
  return { result, error };
};
const CHATS = path.join(dir, 'memory-module/chats');
const ADEL = '아델', VITO = '비토', SILVI = '실비', ELLI = '엘리';
const EUNSEO = '은서', RAON = '라온', DAIN = '다인';
const settingsFor = (room, features = {}, global = undefined) => X.saveSettings({ connection: null, ...(global ? { features: global } : {}), chats: { [room]: { enabled: true, features } } });
const clone = (v) => JSON.parse(JSON.stringify(v));

/* ---------- the setting ---------- */

test('setting: 제안 자동 적용 is in 추가 기능, on by default; a global default and a per-room choice work like the others', () => {
  assert.equal(F.FEATURES.autoApply.default, true);
  assert.equal(F.FEATURES.autoApply.ready, true);
  assert.match(F.FEATURES.autoApply.label, /제안 자동 적용/);
  assert.deepEqual(F.resolve({}, 'a', 'autoApply'), { global: true, room: 'default', enabled: true, ready: true });
  assert.equal(F.resolve({ features: { autoApply: false } }, 'a', 'autoApply').enabled, false, 'global off');
  assert.equal(F.resolve({ features: { autoApply: false }, chats: { a: { features: { autoApply: 'on' } } } }, 'a', 'autoApply').enabled, true, 'room on beats global off');
  assert.equal(F.resolve({ chats: { a: { features: { autoApply: 'off' } } } }, 'a', 'autoApply').enabled, false, 'room off');
  assert.equal(F.resolve({ features: { autoApply: false }, chats: { a: { features: { autoApply: 'default' } } } }, 'a', 'autoApply').enabled, false, 'default follows the global one');
  assert.ok(F.view({}, 'a').some((f) => f.key === 'autoApply'), 'shown with the other extras');
  X.saveSettings({ connection: null, chats: {} });
  assert.equal(X.featureOn('x', 'autoApply'), true);
  settingsFor('x', {}, { autoApply: false });
  assert.equal(X.featureOn('x', 'autoApply'), false);
  settingsFor('x', { autoApply: 'on' }, { autoApply: false });
  assert.equal(X.featureOn('x', 'autoApply'), true);
});

test('setting: the routes store the global default and the room choice', async () => {
  X.saveSettings({ connection: null, chats: {} });
  assert.ifError((await call('POST /settings/features', null, { key: 'autoApply', on: false })).error);
  assert.equal(X.featureOn('y', 'autoApply'), false);
  assert.ifError((await call('POST /chats/:id/feature-mode', 'y', { key: 'autoApply', mode: 'on' })).error);
  assert.equal(X.featureOn('y', 'autoApply'), true);
  assert.ifError((await call('POST /chats/:id/feature-mode', 'y', { key: 'autoApply', mode: 'default' })).error);
  assert.equal(X.featureOn('y', 'autoApply'), false);
});

/* ---------- trackers ---------- */

const sc = (id, end, extra = {}) => ({ id, start: end, end, time: null, events: [], present: [], recollections: [], summary: '', ...extra });
const dateOf = (scene) => L.parseClock(scene.time)?.date || null;
const cycleFile = (starts = ['2024-06-10']) => Tk.addItem(Tk.emptyTrackers(), { type: 'cycle', label: '은서 발정기', scope: 'person', people: [EUNSEO], cycle: { every: 30, length: 5, starts } });
const storyStore = () => ({ ...S.emptyStore(), cast: [EUNSEO, RAON, DAIN], scenes: [sc('S1', 3, { time: '24-07-16 (화)', summary: '은서의 발정기가 시작되었다.' })] });

test('trackers: a start the story states is recorded at once and listed; the suggestion counts as done', () => {
  const file = cycleFile();
  const next = Tk.suggest(file, storyStore(), dateOf, '2026-01-01T00:00:00.000Z', { auto: true });
  assert.deepEqual(next.items[0].cycle.starts, ['2024-06-10', '2024-07-16']);
  assert.equal(next.suggestions.length, 1);
  assert.equal(next.suggestions[0].status, 'done');
  assert.equal(next.suggestions[0].auto, true);
  assert.equal(next.applied.length, 1);
  assert.deepEqual({ ...next.applied[0], id: undefined }, { id: undefined, kind: 'tracker', sid: next.suggestions[0].id, trackerId: 'tk1', label: '은서 발정기', date: '2024-07-16', sceneId: 'S1', text: next.suggestions[0].text, appliedAt: '2026-01-01T00:00:00.000Z', dropped: [], undone: false });
  const view = Tk.appliedView(next);
  assert.equal(view.length, 1);
  assert.match(view[0].text, /은서 발정기 시작일 24-07-16/);
  // A second scan finds nothing to do.
  assert.equal(Tk.suggest(next, storyStore(), dateOf, undefined, { auto: true }), next);
});

test('trackers: without auto the suggestion stays open and nothing is recorded (as before)', () => {
  const next = Tk.suggest(cycleFile(), storyStore(), dateOf);
  assert.equal(next.suggestions[0].status, 'open');
  assert.deepEqual(next.items[0].cycle.starts, ['2024-06-10']);
  assert.deepEqual(next.applied, []);
});

test('trackers: undo restores the tracker exactly, ignores the suggestion and it is never applied again', () => {
  const file = cycleFile();
  const applied = Tk.suggest(file, storyStore(), dateOf, '2026-01-01T00:00:00.000Z', { auto: true });
  const undone = Tk.undoApplied(applied, applied.applied[0].id, '2026-01-02T00:00:00.000Z');
  assert.deepEqual(undone.items[0].cycle, file.items[0].cycle, 'the very same starts as before');
  assert.equal(undone.suggestions[0].status, 'ignored');
  assert.equal(undone.applied[0].undone, true);
  assert.deepEqual(Tk.appliedView(undone), []);
  assert.throws(() => Tk.undoApplied(undone, undone.applied[0].id), /이미 되돌렸습니다/);
  assert.throws(() => Tk.undoApplied(undone, 'ap_nope'), /찾지 못했습니다/);
  const again = Tk.suggest(undone, storyStore(), dateOf, undefined, { auto: true });
  assert.equal(again, undone, 'a scan after the undo does nothing');
  assert.deepEqual(Tk.autoApply(undone, undone.suggestions[0].id), undone, 'not even when asked directly');
  // Even if the answered suggestion itself was lost (the list is capped), the record of the undo still blocks it.
  const lost = clone(undone);
  lost.suggestions = [];
  const asked = Tk.suggest(lost, storyStore(), dateOf, undefined, { auto: true });
  assert.deepEqual(asked.items[0].cycle.starts, ['2024-06-10'], 'asked again, but not applied');
  assert.equal(asked.suggestions[0].status, 'open');
});

test('trackers: a start pushed out of the 12 kept comes back with the undo', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => `2023-${String(i + 1).padStart(2, '0')}-10`);
  const file = cycleFile(twelve);
  const applied = Tk.suggest(file, storyStore(), dateOf, undefined, { auto: true });
  assert.equal(applied.items[0].cycle.starts.length, 12);
  assert.deepEqual(applied.applied[0].dropped, ['2023-01-10']);
  assert.ok(!applied.items[0].cycle.starts.includes('2023-01-10'));
  const undone = Tk.undoApplied(applied, applied.applied[0].id);
  assert.deepEqual(undone.items[0].cycle.starts, twelve);
});

test('trackers: undo after the user already removed the date, or deleted the tracker, changes nothing else', () => {
  const applied = Tk.suggest(cycleFile(['2024-05-01']), storyStore(), dateOf, undefined, { auto: true });
  const removed = Tk.removeStart(applied, 'tk1', '2024-07-16');
  const a = Tk.undoApplied(removed, removed.applied[0].id);
  assert.deepEqual(a.items[0].cycle.starts, ['2024-05-01']);
  const gone = Tk.deleteItem(applied, 'tk1');
  assert.deepEqual(gone.applied, [], 'the record goes with its tracker');
});

test('trackers: the history keeps the last 50; only fresh suggestions are applied, older open ones wait', () => {
  let file = cycleFile();
  file.suggestions = Array.from({ length: 55 }, (_, i) => ({ id: `sg${i}`, trackerId: 'tk1', date: Tk.addDays('2024-08-01', i), sceneId: 'S1', status: 'open', text: `t${i}`, createdAt: 'x' }));
  for (let i = 0; i < 55; i++) file = Tk.autoApply(file, `sg${i}`);
  assert.equal(Tk.MAX_APPLIED, 50);
  assert.equal(file.applied.length, 50);
  assert.equal(file.applied[0].sid, 'sg5');
  assert.equal(file.applied.at(-1).sid, 'sg54');
  // Old open suggestions are not applied by a later scan.
  const open = cycleFile();
  open.suggestions = [{ id: 'old', trackerId: 'tk1', date: '2024-07-01', sceneId: 'S0', status: 'open', text: 't', createdAt: 'x' }];
  const scanned = Tk.suggest(open, storyStore(), dateOf, undefined, { auto: true });
  assert.equal(scanned.suggestions.find((s) => s.id === 'old').status, 'open');
  assert.deepEqual(scanned.items[0].cycle.starts, ['2024-06-10', '2024-07-16'], 'only the one found now');
  assert.equal(scanned.applied.length, 1);
});

test('trackers: a branch keeps the list of what was applied', () => {
  const applied = Tk.suggest(cycleFile(), storyStore(), dateOf, undefined, { auto: true });
  assert.equal(Tk.forBranch(applied, storyStore()).applied.length, 1);
});

const room = (id, features = {}, global) => {
  settingsFor(id, { trackers: 'on', ...features }, global);
  X.saveScenes(id, { ...S.emptyStore(), cast: [EUNSEO, RAON, DAIN], scenes: [sc('S1', 3, { time: '24-07-16 (화)', summary: '은서의 발정기가 시작되었다.', present: [EUNSEO] })] });
};
const addCycle = (id) => call('POST /chats/:id/trackers', id, { action: 'add', item: { type: 'cycle', label: '은서 발정기', scope: 'person', people: [EUNSEO], cycle: { every: 30, length: 5, starts: ['2024-06-10'] } } });

test('trackers service: on by default it records at once; the undo route takes it back and a scan does not redo it', async () => {
  room('a1');
  await addCycle('a1');
  assert.equal(X.refreshWorld('a1', X.loadScenes('a1')), true);
  let view = (await call('GET /chats/:id/trackers', 'a1')).result;
  assert.deepEqual(view.items[0].cycle.starts, ['2024-06-10', '2024-07-16']);
  assert.deepEqual(view.suggestions, [], 'nothing left to click');
  assert.equal(view.applied.length, 1);
  assert.equal((await call('GET /chats/:id/world', 'a1')).result.trackers.applied.length, 1);
  assert.equal(X.refreshWorld('a1', X.loadScenes('a1')), false);
  const aid = view.applied[0].id;
  assert.match((await call('POST /chats/:id/trackers', 'a1', { action: 'undoApplied', aid: 'nope' })).error, /찾지 못했습니다/);
  view = (await call('POST /chats/:id/trackers', 'a1', { action: 'undoApplied', aid })).result;
  assert.deepEqual(view.items[0].cycle.starts, ['2024-06-10']);
  assert.deepEqual(view.applied, []);
  assert.deepEqual(view.suggestions, [], 'ignored, so not asked again either');
  assert.equal(X.refreshWorld('a1', X.loadScenes('a1')), false);
  assert.deepEqual((await call('GET /chats/:id/trackers', 'a1')).result.items[0].cycle.starts, ['2024-06-10']);
  assert.match((await call('POST /chats/:id/trackers', 'a1', { action: 'undoApplied', aid })).error, /이미 되돌렸습니다/);
  // It is on disk.
  assert.equal(JSON.parse(fs.readFileSync(path.join(CHATS, 'a1.trackers.json'), 'utf8')).applied[0].undone, true);
});

test('trackers service: off for the room (or globally) keeps [기록] and [무시]', async () => {
  for (const [id, features, global] of [['a2', { autoApply: 'off' }], ['a3', {}, { autoApply: false }]]) {
    room(id, features, global);
    await addCycle(id);
    assert.equal(X.refreshWorld(id, X.loadScenes(id)), true);
    const view = (await call('GET /chats/:id/trackers', id)).result;
    assert.equal(view.suggestions.length, 1, id);
    assert.deepEqual(view.items[0].cycle.starts, ['2024-06-10'], id);
    assert.deepEqual(view.applied, [], id);
    const done = await call('POST /chats/:id/trackers', id, { action: 'accept', sid: view.suggestions[0].id });
    assert.deepEqual(done.result.items[0].cycle.starts, ['2024-06-10', '2024-07-16'], id);
    assert.deepEqual(done.result.applied, [], 'a click is not an automatic application');
  }
  // Room on beats a global off.
  room('a4', { autoApply: 'on' }, { autoApply: false });
  await addCycle('a4');
  X.refreshWorld('a4', X.loadScenes('a4'));
  assert.equal((await call('GET /chats/:id/trackers', 'a4')).result.applied.length, 1);
});

test('trackers service: the list is in the backup', async () => {
  room('a5');
  await addCycle('a5');
  X.refreshWorld('a5', X.loadScenes('a5'));
  const { result } = await call('GET /chats/:id/backup', 'a5', null);
  assert.equal(result.backup.files.trackers.applied.length, 1);
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(result.backup))));
});

/* ---------- address suggestions and aliases ---------- */

const dq = (number, sentence, text, by, to, extra = {}) => ({ number, sentence, text, by, to, ...extra });
function seed(id, quotes, present = [ADEL, VITO, SILVI]) {
  const store = S.emptyStore();
  store.cast = [ADEL, VITO, SILVI];
  store.scenes = [{ id: 'S1', start: 1, end: 9, title: '골목', summary: '골목', present, events: [{ text: '이야기', importance: 'major', quotes }], recollections: [] }];
  X.saveScenes(id, store);
}
const edit = (id, change) => {
  const events = structuredClone(X.loadScenes(id).scenes[0].events);
  change(events[0].quotes);
  return call('PATCH /chats/:id/scenes/:sceneId', id, { events }, { sceneId: 'S1' });
};
const bookFile = (id) => path.join(CHATS, `${id}.address.json`);
const book = (id) => (fs.existsSync(bookFile(id)) ? JSON.parse(fs.readFileSync(bookFile(id), 'utf8')) : null);
const open = (id) => (book(id)?.suggestions || []).filter((s) => s.status === 'open');
const learnQuotes = () => [dq(1, 1, '"Zuzu, vieni qui."', ADEL, null), dq(2, 1, '"Ecco."', ELLI, ADEL), dq(3, 1, '"Dai."', ELLI, ADEL)];

test('address: a call term the user set becomes an entry at once (auto-learned), listed under 자동으로 적용함', async () => {
  settingsFor('b1');
  seed('b1', learnQuotes());
  assert.ifError((await edit('b1', (q) => { q[0].to = VITO; })).error);
  const b = book('b1');
  assert.deepEqual(b.entries.map((e) => [e.from, e.to, e.term, e.source]), [[ADEL, VITO, 'Zuzu', 'auto-learned']]);
  assert.equal(open('b1').length, 0);
  assert.equal(b.suggestions[0].status, 'done');
  assert.equal(b.suggestions[0].auto, true);
  assert.equal(b.applied.length, 1);
  assert.equal(b.applied[0].kind, 'address');
  const view = (await call('GET /chats/:id/address', 'b1')).result;
  assert.equal(view.applied.length, 1);
  assert.match(view.applied[0].text, /Zuzu/);
  assert.deepEqual(view.suggestions, []);
  // The next scan keeps the entry although the dialogue shows the term only once.
  X.refreshAddress('b1', X.loadScenes('b1'));
  assert.deepEqual(book('b1').entries.map((e) => [e.term, e.source]), [['Zuzu', 'auto-learned']]);
  // And the rules may use it like any other entry.
  assert.equal(Addr.termMap(X.loadAddress('b1')).get('zuzu'), VITO);
});

test('address: undo removes exactly that entry, the suggestion stays ignored, and the same edit later does not bring it back', async () => {
  settingsFor('b2');
  seed('b2', learnQuotes());
  await edit('b2', (q) => { q[0].to = VITO; });
  const before = clone(book('b2').entries);
  assert.equal(before.length, 1);
  // A hand-made entry next to it must stay.
  assert.ifError((await call('POST /chats/:id/address', 'b2', { action: 'add', entry: { from: SILVI, to: VITO, term: 'Capo' } })).error);
  const aid = book('b2').applied[0].id;
  const r = await call('POST /chats/:id/address/applied/:aid/undo', 'b2', {}, { aid });
  assert.ifError(r.error);
  assert.deepEqual(book('b2').entries.map((e) => [e.term, e.source]), [['Capo', 'user']]);
  assert.equal(book('b2').suggestions[0].status, 'ignored');
  assert.equal(book('b2').applied[0].undone, true);
  assert.deepEqual(r.result.applied, []);
  assert.match((await call('POST /chats/:id/address/applied/:aid/undo', 'b2', {}, { aid })).error, /이미 되돌렸습니다/);
  assert.match((await call('POST /chats/:id/address/applied/:aid/undo', 'b2', {}, { aid: 'x' })).error, /찾지 못했습니다/);
  // The same correction again (undone and made again) is not applied or asked.
  await edit('b2', (q) => { q[0].to = null; });
  await edit('b2', (q) => { q[0].to = VITO; });
  assert.equal(book('b2').entries.length, 1);
  assert.equal(open('b2').length, 0);
  assert.equal(book('b2').applied.length, 1, 'no second record');
});

test('address: an entry the user has since edited is left in place by the undo (it is theirs now)', async () => {
  settingsFor('b3');
  seed('b3', learnQuotes());
  await edit('b3', (q) => { q[0].to = VITO; });
  const entry = book('b3').entries[0];
  assert.ifError((await call('POST /chats/:id/address', 'b3', { action: 'edit', id: entry.id, entry: { note: '애칭' } })).error);
  const r = await call('POST /chats/:id/address/applied/:aid/undo', 'b3', {}, { aid: book('b3').applied[0].id });
  assert.ifError(r.error);
  assert.equal(r.result.kept, true);
  assert.equal(book('b3').entries.length, 1);
  assert.equal(book('b3').suggestions[0].status, 'ignored');
});

test('alias: a name the user replaced (used at least twice) is registered at once, without rewriting; undo restores the table', async () => {
  settingsFor('b4');
  seed('b4', learnQuotes());
  const table0 = clone(X.loadNames('b4'));
  assert.ifError((await edit('b4', (q) => { q[1].by = SILVI; })).error);
  assert.deepEqual(X.loadNames('b4').people[SILVI].aliases, [ELLI]);
  assert.notEqual(X.loadNames('b4').people[SILVI].rewrite, true, 'rewrite: false, as an accepted one');
  assert.equal(A.canonOf(ELLI, X.loadNames('b4')), SILVI);
  const b = book('b4');
  assert.deepEqual(b.applied.map((a) => a.kind), ['alias']);
  assert.equal(open('b4').filter((s) => s.kind === 'alias').length, 0);
  assert.ok(fs.existsSync(path.join(CHATS, 'b4.names.json')), 'saved');
  const r = await call('POST /chats/:id/address/applied/:aid/undo', 'b4', {}, { aid: b.applied[0].id });
  assert.ifError(r.error);
  const strip = (t) => ({ people: t.people, dismissed: t.dismissed, history: t.history });
  assert.deepEqual(strip(X.loadNames('b4')), strip(table0), 'the table has what it had');
  assert.equal(A.canonOf(ELLI, X.loadNames('b4')), null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(CHATS, 'b4.names.json'), 'utf8')).people[SILVI], undefined, 'also on disk');
  assert.equal(book('b4').suggestions.find((s) => s.kind === 'alias').status, 'ignored');
  // Again the same replacement: no loop, no second application.
  await edit('b4', (q) => { q[1].by = ELLI; });
  await edit('b4', (q) => { q[1].by = SILVI; });
  assert.equal(A.canonOf(ELLI, X.loadNames('b4')), null);
  assert.equal(book('b4').applied.length, 1);
  assert.equal(open('b4').length, 0);
});

test('alias: an alias undo keeps what the user added to that person since', async () => {
  settingsFor('b5');
  seed('b5', learnQuotes());
  await edit('b5', (q) => { q[1].by = SILVI; });
  const table = structuredClone(X.loadNames('b5'));
  A.addAlias(table, 'Sil', SILVI, { rewrite: false });
  X.saveNames('b5', table);
  await call('POST /chats/:id/address/applied/:aid/undo', 'b5', {}, { aid: book('b5').applied[0].id });
  assert.deepEqual(X.loadNames('b5').people[SILVI].aliases, ['Sil']);
  assert.equal(A.canonOf(ELLI, X.loadNames('b5')), null);
});

test('address: off keeps [추가] and [무시]: the suggestions open, nothing added', async () => {
  settingsFor('b6', { autoApply: 'off' });
  seed('b6', learnQuotes());
  await edit('b6', (q) => { q[0].to = VITO; q[1].by = SILVI; });
  assert.equal(open('b6').length, 2);
  assert.deepEqual(book('b6').entries, []);
  assert.deepEqual(book('b6').applied || [], []);
  assert.equal(A.canonOf(ELLI, X.loadNames('b6')), null);
  assert.equal((await call('GET /chats/:id/address', 'b6')).result.applied.length, 0);
  // Clicking is as before: a user entry.
  const sid = open('b6').find((s) => s.kind === 'address').id;
  assert.ifError((await call('POST /chats/:id/address/suggestion/:sid', 'b6', { action: 'accept' }, { sid })).error);
  assert.deepEqual(book('b6').entries.map((e) => e.source), ['user']);
});

test('address: the history keeps the last 50, an undone one is never applied again, and a second call does nothing', () => {
  const b = Addr.emptyBook();
  b.suggestions = Array.from({ length: 55 }, (_, i) => ({ id: `s${i}`, kind: 'address', status: 'open', from: ADEL, to: VITO, term: `Nome${i}` }));
  for (let i = 0; i < 55; i++) assert.ok(Addr.autoApply(b, `s${i}`));
  assert.equal(Addr.autoApply(b, 's54'), null, 'answered: nothing');
  assert.equal(b.applied.length, 50);
  assert.equal(b.applied[0].sid, 's5');
  assert.equal(b.entries.length, 55);
  const undone = Addr.undoApplied(b, b.applied.at(-1).id);
  assert.equal(undone.kept, false);
  assert.ok(!b.entries.some((e) => e.term === 'Nome54'));
  // Even a suggestion that was set open again by hand (or lost and made again) is not applied after an undo.
  b.suggestions.find((s) => s.id === 's54').status = 'open';
  assert.equal(Addr.autoApply(b, 's54'), null);
  assert.ok(!b.entries.some((e) => e.term === 'Nome54'));
  // An alias without a table cannot be applied (the suggestion stays open).
  const c = Addr.emptyBook();
  c.suggestions = [{ id: 'a1', kind: 'alias', status: 'open', source: ELLI, target: SILVI, count: 3 }];
  assert.equal(Addr.autoApply(c, 'a1', {}), null);
  assert.equal(c.suggestions[0].status, 'open');
});

test('address: the list is in the backup', async () => {
  settingsFor('b7');
  seed('b7', learnQuotes());
  await edit('b7', (q) => { q[0].to = VITO; });
  const { result } = await call('GET /chats/:id/backup', 'b7', null);
  assert.equal(result.backup.files.address.applied.length, 1);
  assert.equal(result.backup.files.address.entries[0].source, 'auto-learned');
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(result.backup))));
});

/* ---------- what stays manual ---------- */

test('manual: near-miss name merges are never applied, whatever the setting', async () => {
  settingsFor('c1', { autoApply: 'on' });
  const store = Object.assign(S.emptyStore(), { cast: ['나델'], personas: ['유온'] });
  store.scenes.push({ id: 'S1', start: 1, end: 2, title: '편지', summary: '나델이 유온에게 편지를 줬다.', present: ['나델', '유온'], events: [{ text: '나델이 웃었다', importance: 'major', quotes: [] }], recollections: [] });
  X.saveScenes('c1', store);
  const ledger = L.emptyLedger();
  ledger.routine = [{ who: '나덴', what: 'meal', text: '빵', at: '2024-02-01T08:00', number: 1 }, { who: '나덴', what: 'meal', text: '밥', at: '2024-02-01T12:00', number: 2 }];
  X.saveLedger('c1', ledger);
  const table = X.loadNames('c1');
  const before = clone(table);
  assert.ok(N.suggestions(store, ledger, table).length > 0, 'the pair is offered as a possible same person');
  X.refreshWorld('c1', store);
  X.refreshAddress('c1', store);
  assert.deepEqual(clone(X.loadNames('c1')), before, 'the table is untouched');
  const names = (await call('GET /chats/:id/names', 'c1')).result;
  assert.ok(names.suggestions.some((s) => s.source === '나덴'), 'still waiting for the user');
  assert.equal(Object.keys(names.people).some((p) => (names.people[p].aliases || []).includes('나덴')), false);
});

test('manual: record conflicts are found and kept open, never resolved by themselves', () => {
  settingsFor('c2', { autoApply: 'on' });
  const fact = (id, about, text) => ({ id, about, text, sceneId: 'S1', evidence: [], unaware: [], guess: [], edited: false });
  const store = { ...S.emptyStore(), cast: [EUNSEO], personas: [], facts: [fact('F1', EUNSEO, '커피를 즐겨 마신다'), fact('F2', EUNSEO, '커피를 즐겨 마시지 않는다')], scenes: [sc('S1', 2, { present: [EUNSEO] })] };
  X.saveScenes('c2', store);
  assert.equal(X.refreshConflicts('c2', store), true);
  const file = X.loadConflicts('c2');
  assert.deepEqual(file.conflicts.map((c) => c.status), ['open']);
  assert.equal(Cf.detect(store).size, 1);
  assert.equal(X.refreshConflicts('c2', store), false);
  assert.deepEqual(X.loadConflicts('c2').conflicts.map((c) => c.status), ['open']);
  assert.equal('applied' in file, false, 'no automatic history for conflicts');
});

/* ---------- the screen ---------- */

const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fn = (name, globals = {}) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, ...require('./ui-shared.cjs')(source, esc), ...globals });
};
const constant = (name) => {
  const start = source.indexOf(`  const ${name} = `);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n', start));
};

test('screen: the trackers section lists what was applied with [되돌리기]; nothing when there is none', () => {
  const globals = { trackerDraft: null, ...vm.runInNewContext(`(() => { ${constant('TK_TYPES')}; ${constant('TK_INJECT')}; ${constant('TK_CLOCK')}; return { TK_TYPES, TK_INJECT, TK_CLOCK }; })()`), trackerForm: () => '' };
  const paper = fn('trackersPaper', globals);
  const t = { items: [], suggestions: [], people: [], storyDate: null, realDate: 'x', applied: [{ id: 'ap_1', text: '<b>발정기</b> 시작일 24-07-16 기록', sceneId: 'S1' }] };
  const html = paper({ trackers: t }, '');
  assert.match(html, /자동으로 적용함: &lt;b&gt;발정기&lt;\/b&gt; 시작일 24-07-16 기록/);
  assert.match(html, /data-act="trackerUndoApplied" data-aid="ap_1">되돌리기/);
  assert.match(html, /data-goto-scene="S1"/);
  assert.doesNotMatch(paper({ trackers: { ...t, applied: [] } }, ''), /자동으로 적용함: /);
  // With the suggestions of the off state the buttons are the old ones.
  assert.match(paper({ trackers: { ...t, applied: [], suggestions: [{ id: 'sg_1', text: 'x', sceneId: 'S1' }] } }, ''), /data-act="trackerAnswer" data-sid="sg_1" data-answer="accept">기록/);
  assert.match(source, /case 'trackerUndoApplied'/);
});

test('screen: the learned-suggestions section lists what was applied with [되돌리기]', () => {
  const paper = fn('addressPaper');
  const a = { addressBook: true, learnFromEdits: true, entries: [{ id: 'e1', from: ADEL, to: VITO, term: 'Zuzu', count: 0, source: 'auto-learned' }], suggestions: [], applied: [{ id: 'ap_2', kind: 'address', text: '‘Zuzu’ = 아델이 비토을(를) 부르는 말' }, { id: 'ap_3', kind: 'alias', text: '‘엘리’ = 실비의 다른 이름' }] };
  const html = paper(a, {}, '', []);
  assert.match(html, /자동으로 적용함: ‘Zuzu’ = 아델이 비토을\(를\) 부르는 말/);
  assert.match(html, /data-act="suggestUndo" data-id="ap_2">되돌리기/);
  assert.match(html, /data-act="suggestUndo" data-id="ap_3">되돌리기/);
  assert.match(html, /<small>자동 적용<\/small>/, 'the entry says where it came from');
  assert.doesNotMatch(paper({ ...a, applied: [] }, {}, '', []), /자동으로 적용함: /);
  assert.match(paper({ ...a, applied: [], suggestions: [{ id: 's1', kind: 'address', from: ADEL, to: VITO, term: 'Zuzu' }] }, {}, '', []), /data-act="suggestAccept" data-id="s1">추가/);
  assert.match(source, /case 'suggestUndo'/);
});
