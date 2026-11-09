'use strict';
// Optional features ("추가 기능"): registry, global default + per-room override, old recentLife settings keys,
// persistence through the routes, server-side enforcement and the settings section. Anonymized data only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-features-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const F = require('../memory-module/lib/features.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body, query: {} }, reply);
  return { result, error };
};
const settingsFile = path.join(dir, 'memory-module/settings.json');
const onDisk = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));

const READY = ['recentLife', 'characterState', 'places', 'keepsakes', 'notebook', 'trackers', 'autoApply'];
const BUILTIN = ['addressBook', 'learnFromEdits', 'knowledge', 'conflicts', 'recallReasons'];
test('registry: Korean labels, recentLife on by default, every other feature off; only the implemented ones are ready; built-in ones are not in it', () => {
  const keys = ['recentLife', 'characterState', 'places', 'keepsakes', 'notebook', 'trackers', 'autoApply'];
  assert.deepEqual(Object.keys(F.FEATURES), keys);
  for (const [key, f] of Object.entries(F.FEATURES)) {
    assert.match(f.label, /[가-힣]/, key);
    assert.match(f.description, /[가-힣]/, key);
    assert.equal(typeof f.default, 'boolean');
    assert.equal(typeof f.ready, 'boolean');
    if (key === 'recentLife' || key === 'autoApply') assert.equal(f.default, true); else assert.equal(f.default, false, key);
    assert.equal(f.ready, READY.includes(key), key);
  }
  assert.deepEqual(F.BUILTIN, BUILTIN);
  for (const key of BUILTIN) {
    assert.equal(F.known(key), false, key);
    assert.deepEqual(F.resolve({ features: { [key]: false }, chats: { a: { features: { [key]: 'off' } } } }, 'a', key), { global: true, room: 'default', enabled: true, ready: true, builtin: true }, 'stored values are ignored');
  }
});

// A stand-in for a feature that is not implemented yet (every real one is ready or built in by now).
test('a stand-in for a not-yet-implemented feature is added for the tests below', () => { F.FEATURES.demoFeature = { label: '시험용', description: '아직 만들지 않은 기능을 대신하는 시험용 항목입니다.', default: false, ready: false }; });

test('resolution: default, global override, room override, unknown values and unknown features', () => {
  const reg = { thing: { label: '가', description: '나', default: false, ready: true }, on: { label: '다', description: '라', default: true, ready: true } };
  const r = (all, id, key) => F.resolve(all, id, key, reg);
  assert.deepEqual(r({}, 'a', 'thing'), { global: false, room: 'default', enabled: false, ready: true });
  assert.equal(r({}, 'a', 'on').enabled, true);
  assert.equal(r({ features: { thing: true } }, 'a', 'thing').enabled, true, 'global on');
  assert.equal(r({ features: { on: false } }, 'a', 'on').enabled, false, 'global off beats the default');
  assert.equal(r({ features: { thing: true }, chats: { a: { features: { thing: 'off' } } } }, 'a', 'thing').enabled, false, 'room off beats global on');
  assert.equal(r({ chats: { a: { features: { thing: 'on' } } } }, 'a', 'thing').enabled, true, 'room on beats default off');
  assert.equal(r({ chats: { a: { features: { thing: 'on' } } } }, 'b', 'thing').enabled, false, 'other rooms follow the default');
  assert.equal(r({ chats: { a: { features: { thing: 'weird' } } } }, 'a', 'thing').room, 'default', 'an unknown value follows the default');
  assert.equal(r({ features: { thing: 'yes' } }, 'a', 'thing').global, false, 'a non-boolean global is ignored');
  assert.equal(r({}, 'a', 'missing').enabled, false);
  assert.equal(F.resolve({ features: { x: true } }, 'a', 'x', { x: { default: false, ready: false } }).enabled, false, 'not ready: never on');
});

test('featureOn on the server: new features default off and never run while not ready', () => {
  X.saveSettings({ connection: null, chats: {} });
  assert.equal(X.featureOn('room', 'recentLife'), true);
  for (const key of Object.keys(F.FEATURES).filter((k) => k !== 'recentLife' && k !== 'autoApply')) assert.equal(X.featureOn('room', key), false, key);
  assert.equal(X.featureOn('room', 'autoApply'), true, '제안 자동 적용 is on by default');
  // Built in: always on, whatever is stored.
  for (const key of BUILTIN) assert.equal(X.featureOn('room', key), true, key);
  X.saveSettings({ connection: null, chats: { room: { features: { addressBook: 'off', knowledge: 'off' } } }, features: { conflicts: false } });
  for (const key of BUILTIN) assert.equal(X.featureOn('room', key), true, key + ': an old stored "off" is ignored');
  assert.equal(X.featureOn('room', 'nonsense'), false);
  // Stored "on" is still off while the feature is not implemented.
  X.saveSettings({ chats: { room: { features: { demoFeature: 'on' } } }, features: { demoFeature: true } });
  assert.equal(X.featureOn('room', 'demoFeature'), false);
  const was = F.FEATURES.demoFeature.ready;
  try {
    F.FEATURES.demoFeature.ready = true;
    assert.equal(X.featureOn('room', 'demoFeature'), true, 'implemented: the stored choice applies');
    X.saveSettings({ chats: { room: { features: { demoFeature: 'off' } } }, features: { demoFeature: true } });
    assert.equal(X.featureOn('room', 'demoFeature'), false);
    assert.equal(X.featureOn('other', 'demoFeature'), true);
  } finally { F.FEATURES.demoFeature.ready = was; }
});

test('recentLife keeps working with settings files written before the registry', () => {
  // Exactly what older versions wrote.
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify({ connection: 'c', routine: false, chats: { a: { enabled: true }, b: { enabled: true, routine: 'on' }, c: { routine: 'off' }, d: { routine: 'weird' } } }));
  assert.equal(X.featureOn('a', 'recentLife'), false, 'global off');
  assert.equal(X.featureOn('b', 'recentLife'), true, 'room on');
  assert.equal(X.featureOn('c', 'recentLife'), false);
  assert.deepEqual(X.routineSetting('d'), { global: false, room: 'default', enabled: false });
  assert.deepEqual(X.featureSetting('b', 'recentLife'), { global: false, room: 'on', enabled: true, ready: true });
  assert.equal(X.routineEnabled('b'), X.featureOn('b', 'recentLife'));
  fs.writeFileSync(settingsFile, JSON.stringify({ connection: 'c', chats: { a: {} } }));
  assert.equal(X.featureOn('a', 'recentLife'), true, 'a file without the key: on, as before');
  fs.writeFileSync(settingsFile, JSON.stringify({ routine: true, chats: {} }));
  assert.equal(X.featureOn('a', 'recentLife'), true);
});

test('routes persist switches; recentLife writes its old keys, the others the new ones; bad input is refused', async () => {
  X.saveSettings({ connection: 'c', chats: {} });
  // recentLife
  assert.ifError((await call('POST /settings/features', null, { key: 'recentLife', on: false })).error);
  assert.equal(onDisk().routine, false, 'stored under the old key');
  assert.equal('features' in onDisk(), false);
  const room = await call('POST /chats/:id/feature-mode', 'r1', { key: 'recentLife', mode: 'on' });
  assert.deepEqual(room.result.feature, { key: 'recentLife', global: false, room: 'on', enabled: true, ready: true });
  assert.equal(onDisk().chats.r1.routine, 'on');
  assert.equal(X.routineSetting('r1').enabled, true, 'the older routes and helpers see the same state');
  await call('POST /chats/:id/feature-mode', 'r1', { key: 'recentLife', mode: 'default' });
  assert.equal('routine' in onDisk().chats.r1, false, 'following the default stores nothing');
  await call('POST /settings/routine', null, { on: true });
  assert.equal(X.featureOn('r1', 'recentLife'), true, 'the older route moves the same switch');

  // a feature that is ready
  const was = F.FEATURES.demoFeature.ready;
  F.FEATURES.demoFeature.ready = true;
  try {
    assert.ifError((await call('POST /settings/features', null, { key: 'demoFeature', on: true })).error);
    assert.deepEqual(onDisk().features, { demoFeature: true });
    assert.deepEqual((await call('POST /chats/:id/feature-mode', 'r2', { key: 'demoFeature', mode: 'off' })).result.feature, { key: 'demoFeature', global: true, room: 'off', enabled: false, ready: true });
    assert.deepEqual(onDisk().chats.r2.features, { demoFeature: 'off' });
    assert.equal(X.featureOn('r2', 'demoFeature'), false);
    assert.equal(X.featureOn('r3', 'demoFeature'), true);
    await call('POST /chats/:id/feature-mode', 'r2', { key: 'demoFeature', mode: 'default' });
    assert.equal('features' in onDisk().chats.r2, false, 'an empty override is not kept');
    assert.match((await call('POST /settings/features', null, { key: 'demoFeature', on: 'yes' })).error, /on: true 또는 false/);
    assert.match((await call('POST /chats/:id/feature-mode', 'r2', { key: 'demoFeature', mode: 'maybe' })).error, /default, on, off/);
    assert.match((await call('POST /chats/:id/feature-mode', '../x', { key: 'demoFeature', mode: 'on' })).error, /invalid chat id/);
  } finally { F.FEATURES.demoFeature.ready = was; }
  // not implemented / built in / unknown: refused, nothing stored
  assert.match((await call('POST /settings/features', null, { key: 'demoFeature', on: false })).error, /준비 중/);
  assert.match((await call('POST /chats/:id/feature-mode', 'r1', { key: 'demoFeature', mode: 'on' })).error, /준비 중/);
  for (const key of BUILTIN) {
    assert.match((await call('POST /settings/features', null, { key, on: false })).error, /항상 켜져 있어/, key);
    assert.match((await call('POST /chats/:id/feature-mode', 'r1', { key, mode: 'off' })).error, /항상 켜져 있어/, key);
  }
  assert.match((await call('POST /settings/features', null, { key: 'bogus', on: true })).error, /알 수 없는 기능/);
  assert.equal(onDisk().features?.addressBook, undefined);
});

test('the room view lists only implemented features with their state', () => {
  X.saveSettings({ connection: 'c', routine: false, chats: { r1: { routine: 'on' } } });
  const list = F.view(X.settings(), 'r1');
  assert.deepEqual(list.map((f) => f.key), READY);
  assert.deepEqual(list[0], { key: 'recentLife', label: '최근 생활 기록', description: F.FEATURES.recentLife.description, default: true, global: false, room: 'on', enabled: true, ready: true });
});

// ---- settings screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const openLists = new Set();
const fn = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  }\n', start);
  return vm.runInNewContext(`(${source.slice(start, end + 4).trim()})`, { esc, openLists });
};

test('the 추가 기능 section: a row per implemented feature with the global checkbox and the 3-state room select', () => {
  const featuresPaper = fn('featuresPaper');
  assert.equal(featuresPaper([]), '');
  assert.equal(featuresPaper(undefined), '');
  const html = featuresPaper(F.view({ routine: false, chats: { r: { routine: 'off' } } }, 'r'));
  // Folded: the whole section and each feature open on a click, and the summary says what is on in this room.
  assert.match(html, /<details class="paper" data-list="features" >\s*<summary>추가 기능 · 이 방에서 \d+\/\d+개 켜짐<\/summary>/);
  assert.match(html, /<details class="feature-row" data-feature="recentLife" data-list="feature:recentLife" >\s*<summary><span class="feature-name">최근 생활 기록<\/span> <span class="pill neutral">꺼짐<\/span><\/summary>/);
  openLists.add('features');
  assert.match(featuresPaper(F.view({}, 'r')), /data-list="features" open>/, 'an opened section stays open');
  openLists.clear();
  assert.match(html, /최근 생활 기록 \(모든 방 기본값\)/);
  assert.match(html, /<input type="checkbox" data-feature-global="recentLife" >/, 'global off: unchecked');
  assert.match(html, /<select data-feature-room="recentLife">/);
  assert.match(html, /value="default" >기본값 따름 \(지금 모든 방 기본값: 끄기\)/);
  assert.match(html, /value="on" >켜기/);
  assert.match(html, /value="off" selected>끄기/);
  const checked = featuresPaper(F.view({}, 'r'));
  assert.match(checked, /data-feature-global="recentLife" checked/);
  assert.match(checked, /value="default" selected>/);
  assert.doesNotMatch(checked, /준비 중/);
  assert.doesNotMatch(featuresPaper(F.view({}, 'r').filter((f) => f.key === 'recentLife')), /호칭/);
  const all = featuresPaper(F.view({}, 'r'));
  for (const gone of ['addressBook', 'learnFromEdits', 'knowledge', 'conflicts']) assert.doesNotMatch(all, new RegExp('data-feature="' + gone + '"'), gone + ' is built in: no switch');
  assert.match(all, /data-feature="keepsakes"/);
  assert.doesNotMatch(featuresPaper([{ key: 'x', label: '<b>', description: '"', default: true, global: true, room: 'default' }]), /<b>/, 'text is escaped');
});

test('the settings tab uses the section and the old recentLife controls are gone', () => {
  assert.match(source, /\$\{featuresPaper\(info\.features\)\}/);
  assert.doesNotMatch(source, /setRoutineRoom|setRoutineDefault/);
  assert.match(source, /\/settings\/features/);
  assert.match(source, /\/feature-mode/);
});
