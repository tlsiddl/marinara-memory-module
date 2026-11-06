'use strict';
// Daily life ("최근 생활") on/off: global default, per-room override, enforced on the server.
// Anonymized data only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-routine-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body }, reply);
  return { result, error };
};

// A chat per room; each user message says someone ate.
const chats = new Map();
const say = (room, text, role = 'user') => {
  const list = chats.get(room) || [];
  list.push({ id: `${room}-m${list.length + 1}`, role, content: text, extra: '{}', characterId: role === 'assistant' ? 'c1' : null, activeSwipeIndex: 0, rowid: list.length + 1 });
  chats.set(room, list);
};
const calls = [];
X.setEngine({
  chats: { async listMessages(id) { return chats.get(id) || []; }, async getById(id) { return { id, metadata: {}, characterIds: '["c1"]' }; } },
  characters: { async getById() { return { id: 'c1', data: JSON.stringify({ name: '도윤' }) }; } },
  connections: { async list() { return [{ id: 'conn', name: 'memory' }]; }, async getWithKey(id) { return { id, provider: 'openai', model: 'fake', apiKey: 'k' }; } },
  resolveBaseUrl: () => 'http://fake.test',
  createLLMProvider: (...args) => ({ args, async chatComplete(messages) {
    const system = messages[0].content;
    calls.push({ system, user: messages[1]?.content || '', args });
    if (system.includes('장부에 기록해')) {
      const n = (messages[1].content.match(/\[(\d+)\.1\]/g) || []).map((x) => x.slice(1, -3)).at(-1) || '1';
      return { content: JSON.stringify({ open: [], update: [], close: [], reopen: [], routine: [{ who: '도윤', what: 'meal', text: `빵 ${n}`, how: 'ate', evidence: [{ n: `${n}.1`, q: '빵을 먹었다' }] }] }) };
    }
    return { content: '{"items":[]}' };
  } }),
});
service.attach(app);

const run = (room, opts) => service.processChat(room, opts);
const ledgerCalls = () => calls.filter((c) => c.system.includes('장부에 기록해'));
function newRoom(room, settingsPatch) {
  const s = X.settings();
  X.saveSettings({ ...s, connection: 'conn', chats: { ...s.chats, [room]: { enabled: true, ...settingsPatch } } });
}

test('resolution: global default on, per-room default/on/off, global off', async () => {
  X.saveSettings({ connection: 'conn', chats: { a: {}, b: { routine: 'on' }, c: { routine: 'off' }, d: { routine: 'weird' } } });
  assert.deepEqual(X.routineSetting('a'), { global: true, room: 'default', enabled: true });
  assert.equal(X.routineEnabled('b'), true);
  assert.equal(X.routineEnabled('c'), false);
  assert.deepEqual(X.routineSetting('d'), { global: true, room: 'default', enabled: true }, 'an unknown value follows the default');
  assert.equal(X.routineEnabled('nobody'), true, 'a room with no settings follows the default');
  X.saveSettings({ ...X.settings(), routine: false });
  assert.equal(X.routineEnabled('a'), false);
  assert.equal(X.routineEnabled('b'), true, 'a room turned on stays on when the default is off');
  assert.equal(X.routineEnabled('c'), false);
});

test('routes persist the global default and the room override, and reject bad values', async () => {
  X.saveSettings({ connection: 'conn', chats: {} });
  assert.match((await call('POST /settings/routine', null, { on: 'yes' })).error, /on: true 또는 false/);
  assert.ifError((await call('POST /settings/routine', null, { on: false })).error);
  assert.equal(X.settings().routine, false);
  assert.match((await call('POST /chats/:id/routine-mode', 'r', { mode: 'maybe' })).error, /default, on, off/);
  const on = await call('POST /chats/:id/routine-mode', 'r', { mode: 'on' });
  assert.deepEqual(on.result.routineSetting, { global: false, room: 'on', enabled: true });
  assert.equal(X.settings().chats.r.routine, 'on');
  const back = await call('POST /chats/:id/routine-mode', 'r', { mode: 'default' });
  assert.deepEqual(back.result.routineSetting, { global: false, room: 'default', enabled: false });
  assert.equal('routine' in X.settings().chats.r, false, 'following the default stores nothing');
  // On disk, so a restart keeps it.
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'memory-module/settings.json'), 'utf8')).routine, false);
  await call('POST /settings/routine', null, { on: true });
});

test('the prompt without daily life asks nothing about it; results about it are ignored', () => {
  assert.match(L.SYSTEM_PROMPT, /생활 기록\(routine\)/);
  assert.doesNotMatch(L.SYSTEM_PROMPT_NO_ROUTINE, /routine|생활 기록|끼니/);
  assert.match(L.SYSTEM_PROMPT_NO_ROUTINE, /"reopen":\[\]\}\./);
  const batch = L.prepareMessages([{ id: 'x1', number: 1, speaker: '도윤', role: 'assistant', content: '도윤은 빵을 먹었다.' }]);
  assert.equal(L.buildPrompt(L.emptyLedger(), batch, [], { routine: false })[0].content, L.SYSTEM_PROMPT_NO_ROUTINE);
  assert.equal(L.buildPrompt(L.emptyLedger(), batch)[0].content, L.SYSTEM_PROMPT);
  const result = { routine: [{ who: '도윤', what: 'meal', text: '빵', evidence: [{ n: '1.1', q: '빵을 먹었다' }] }] };
  const off = L.emptyLedger();
  L.applyResult(off, result, batch, undefined, { routine: false });
  assert.deepEqual(off.routine || [], []);
  const on = L.emptyLedger();
  L.applyResult(on, result, batch);
  assert.equal(on.routine.length, 1);
});

test('off: no daily-life prompt, nothing recorded, nothing injected; old records kept and shown again when on', async () => {
  newRoom('room1');
  say('room1', '도윤은 빵을 먹었다.');
  say('room1', '도윤이 웃었다.', 'assistant');
  say('room1', '좋아.');
  await run('room1', { reason: 'test' });
  assert.equal(X.loadLedger('room1').routine.length, 1, 'on by default: recorded');
  assert.match(X.renderMemorySource('room1'), /\[최근 생활\]/);
  assert.match(X.renderMemorySource('room1'), /"최근 생활" says/);
  const kept = structuredClone(X.loadLedger('room1').routine);

  await call('POST /chats/:id/routine-mode', 'room1', { mode: 'off' });
  calls.length = 0;
  say('room1', '도윤은 빵을 또 먹었다.', 'assistant');
  say('room1', '응.');
  await run('room1', { reason: 'test' });
  assert.ok(ledgerCalls().length >= 1, 'the ledger is still read for open threads');
  for (const c of ledgerCalls()) assert.doesNotMatch(c.system, /routine|생활 기록/, 'no daily-life instructions sent');
  assert.deepEqual(X.loadLedger('room1').routine, kept, 'nothing new recorded, nothing deleted');
  assert.deepEqual(X.loadLedger('room1').routineGaps, [{ from: 4, to: 5 }]);
  const memory = X.renderMemorySource('room1');
  assert.doesNotMatch(memory, /최근 생활/, 'neither the block nor the header line about it');
  const info = (await call('GET /chats/:id', 'room1')).result;
  assert.equal(info.routineSetting.enabled, false);
  assert.equal(info.routineItems.length, 1, 'the library still lists the kept records');

  // An edit of an old message rolls back and re-reads: still no daily-life call, records stay.
  chats.get('room1')[0].content = '도윤은 빵을 먹었다. 그리고 잤다.';
  calls.length = 0;
  await run('room1', { reason: 'test' });
  for (const c of ledgerCalls()) assert.doesNotMatch(c.system, /routine/);
  assert.deepEqual(X.loadLedger('room1').routine, kept);

  // Reading everything again while off keeps them too.
  await run('room1', { rebuild: true, reason: 'test' });
  assert.deepEqual(X.loadLedger('room1').routine, kept);

  // Back on: shown and injected again, and new messages are read for it (no backfill of the off stretch).
  await call('POST /chats/:id/routine-mode', 'room1', { mode: 'default' });
  assert.match(X.renderMemorySource('room1'), /\[최근 생활\]/);
  calls.length = 0;
  say('room1', '도윤은 밥을 먹었다.', 'assistant');
  say('room1', '그래.');
  await run('room1', { reason: 'test' });
  assert.ok(ledgerCalls().every((c) => c.system === L.SYSTEM_PROMPT));
  const after = X.loadLedger('room1');
  assert.ok(after.routine.length > kept.length, 'continues from new messages');
  assert.ok(after.routine.every((r) => r.number < 4 || r.number > 5), 'the messages read while off are not filled in');
  assert.ok(after.routineGaps.length >= 1, 'the off stretch stays marked');
});

test('global default off: rooms following it skip daily life; a room turned on keeps it', async () => {
  await call('POST /settings/routine', null, { on: false });
  newRoom('room2');
  newRoom('room3', { routine: 'on' });
  for (const room of ['room2', 'room3']) {
    say(room, '도윤은 빵을 먹었다.', 'assistant');
    say(room, '좋아.');
  }
  calls.length = 0;
  await run('room2', { reason: 'test' });
  assert.ok(ledgerCalls().length && ledgerCalls().every((c) => c.system === L.SYSTEM_PROMPT_NO_ROUTINE));
  assert.deepEqual(X.loadLedger('room2').routine || [], []);
  calls.length = 0;
  await run('room3', { reason: 'test' });
  assert.ok(ledgerCalls().length && ledgerCalls().every((c) => c.system === L.SYSTEM_PROMPT));
  assert.equal(X.loadLedger('room3').routine.length, 1);
  await call('POST /settings/routine', null, { on: true });
});

test('off: no meal display model call and no display translation of daily life', async () => {
  newRoom('room4', { routine: 'off' });
  const ledger = L.emptyLedger();
  ledger.routine = [
    { who: '도윤', what: 'meal', text: 'steak and salad', at: '2024-02-01T08:00', number: 1 },
    { who: '도윤', what: 'meal', text: 'steak, salad', at: '2024-02-01T08:05', number: 2 },
  ];
  X.saveLedger('room4', ledger);
  assert.equal(L.pendingMealDisplays(ledger).length, 1, 'with daily life on, these meals would be sent for a display check');
  X.saveSettings({ ...X.settings(), writeLanguage: 'en' });
  assert.deepEqual(X.displayTranslationTexts('room4').filter((t) => /steak/.test(t)), []);
  await call('POST /chats/:id/routine-mode', 'room4', { mode: 'on' });
  assert.ok(X.displayTranslationTexts('room4').some((t) => /steak/.test(t)));
  await call('POST /chats/:id/routine-mode', 'room4', { mode: 'off' });
  const { writeLanguage: _w, ...rest } = X.settings();
  X.saveSettings(rest);
  say('room4', '안녕.');
  calls.length = 0;
  await run('room4', { reason: 'resume' });
  assert.equal(calls.filter((c) => c.system.includes('음식 기록')).length, 0);
  // The same room turned on does make that call, so the check above is not vacuous.
  await call('POST /chats/:id/routine-mode', 'room4', { mode: 'on' });
  say('room4', '응.');
  await run('room4', { reason: 'resume' });
  assert.equal(calls.filter((c) => c.system.includes('음식 기록')).length, 1);
});
