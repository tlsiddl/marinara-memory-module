// node --test tests/test-internal-rooms.cjs
'use strict';
// Marinara's own helper chats (Professor Mari's assistant) are not rooms: the module's room list leaves them out
// unless memory was explicitly turned on for one, and orphan detection still knows they exist. Invented ids.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-internal-rooms-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const T = service._test;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const rows = [
  { id: 'room-1', name: 'Story one', mode: 'roleplay', updatedAt: '2026-01-01', metadata: '{}' },
  { id: 'room-2', name: 'Story two', mode: 'roleplay', updatedAt: '2026-01-02', metadata: { tag: 'x' } },
  { id: 'helper-1', name: 'Assistant', mode: 'conversation', updatedAt: '2026-01-03', metadata: '{"internalAssistant":true}' },
  { id: 'helper-2', name: 'Assistant two', mode: 'conversation', updatedAt: '2026-01-04', metadata: { internalAssistant: 'mari' } },
  { id: 'helper-off', name: 'Not a helper', mode: 'conversation', updatedAt: '2026-01-05', metadata: '{"internalAssistant":false}' },
  { id: 'odd-1', name: 'Broken metadata', mode: 'roleplay', updatedAt: '2026-01-06', metadata: '{not json' },
  { id: 'odd-2', name: 'No metadata', mode: 'roleplay', updatedAt: '2026-01-07' },
];
const engine = { chats: { list: async () => rows.map((r) => ({ ...r })), getById: async (id) => rows.find((r) => r.id === id) || null } };

function endpoints() {
  const map = new Map();
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((m) => [m, (url, fn) => map.set(`${m.toUpperCase()} ${url}`, fn)]));
  service.attach({ register: (fn) => fn(app), addHook() {} });
  return (method, url, id) => map.get(`${method} ${url}`)({ params: { id }, body: {} }, { status() { return this; }, send(v) { return v; } });
}

test('the room list leaves helper chats out and keeps everything else', async () => {
  T.setEngine(engine);
  T.saveSettings({ chats: {} });
  const call = endpoints();
  const list = await call('GET', '/chats');
  assert.deepEqual(list.map((c) => c.id), ['room-1', 'room-2', 'helper-off', 'odd-1', 'odd-2']);
  assert.deepEqual(Object.keys(list[0]).sort(), ['enabled', 'id', 'lastMessageAt', 'ledger', 'mode', 'name', 'updatedAt']);
  assert.deepEqual((await T.listRooms()).map((c) => c.id), list.map((c) => c.id));
});

test('a helper chat memory was explicitly turned on for is still shown', async () => {
  T.setEngine(engine);
  T.saveSettings({ chats: { 'helper-2': { enabled: true }, 'helper-1': { enabled: false } } });
  const call = endpoints();
  const list = await call('GET', '/chats');
  assert.deepEqual(list.map((c) => c.id), ['room-1', 'room-2', 'helper-2', 'helper-off', 'odd-1', 'odd-2']);
  assert.equal(list.find((c) => c.id === 'helper-2').enabled, true);
});

test('helper chats are never taken for deleted rooms', async () => {
  T.setEngine(engine);
  const file = path.join(dir, 'memory-module', 'chats');
  fs.mkdirSync(file, { recursive: true });
  T.saveSettings({ chats: { 'helper-1': { enabled: false }, 'helper-2': { enabled: true }, 'gone-1': { enabled: true } } });
  const orphans = (await T.listOrphans()).map((o) => o.id);
  assert.deepEqual(orphans, ['gone-1']);
  const result = await T.deleteOrphans(['helper-1', 'helper-2', 'room-1']);
  assert.deepEqual(result, { deleted: [], refused: ['helper-1', 'helper-2', 'room-1'] });
});

test('a branch is marked in the room list, with its own name and, when names are shared, the last-used time', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('  function roomLabel(');
  const rooms = [
    { id: 'a', name: '세라', lastMessageAt: '2026-11-08T09:05:00' },
    { id: 'b', name: '세라', lastMessageAt: '2026-11-09T21:30:00', branch: { name: 'New Branch', parentId: 'a' } },
    { id: 'c', name: '세라', updatedAt: '2026-11-09T10:00:00', branch: { name: '바다 엔딩', parentId: 'a' } },
    { id: 'd', name: '빅터' },
  ];
  const label = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { rooms, Date, String, Number });
  assert.equal(label(rooms[0]), '세라 · 11.8 09:05');
  assert.equal(label(rooms[1]), '세라 ↳ 분기 · 11.9 21:30', 'Marinara\'s default branch name is not shown');
  assert.equal(label(rooms[2]), '세라 ↳ 분기: 바다 엔딩 · 11.9 10:00');
  assert.equal(label(rooms[3]), '빅터', 'a name of its own needs nothing more');
  assert.ok(source.includes('${esc(roomLabel(r))}</option>'));
});

test('the room list says which rooms are branches (and of which room)', async () => {
  const withBranch = [...rows, { id: 'branch-1', name: 'Story one', mode: 'roleplay', updatedAt: '2026-01-08', lastMessageAt: '2026-01-08T10:00:00', metadata: { branchParentChatId: 'room-1', branchName: 'Beach ending' } }];
  T.setEngine({ chats: { list: async () => withBranch.map((r) => ({ ...r })), getById: async (id) => withBranch.find((r) => r.id === id) || null } });
  const list = await endpoints()('GET', '/chats');
  assert.deepEqual(list.find((c) => c.id === 'branch-1').branch, { name: 'Beach ending', parentId: 'room-1' });
  assert.equal(list.find((c) => c.id === 'branch-1').lastMessageAt, '2026-01-08T10:00:00');
  assert.equal('branch' in list.find((c) => c.id === 'room-1'), false);
  T.setEngine(engine);
});
