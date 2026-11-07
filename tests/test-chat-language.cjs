'use strict';
// node --test tests/test-chat-language.cjs
// 0.12.4: a room's language is kept in <room>.lang.json, so the first room view after a restart does not read
// the whole chat. Invented names only.
const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-lang-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const CHATS = path.join(dir, 'memory-module/chats');
const langPath = (id) => path.join(CHATS, `${id}.lang.json`);
const readLang = (id) => JSON.parse(fs.readFileSync(langPath(id), 'utf8'));

let reads = 0;
let rooms = {};
const rows = (texts) => texts.map((t, i) => ({ id: `m${i + 1}`, rowid: i + 1, role: i % 2 ? 'assistant' : 'user', content: t, extra: '{}', characterId: null }));
X.setEngine({
  chats: {
    async listMessages(id) { reads++; return rows(rooms[id] || []); },
    async getById(id) { return { id, name: '방', metadata: '{}' }; },
  },
  characters: { async getById() { return null; } },
});
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
service.attach(app);
const call = async (key, id, body, query = {}) => {
  const reply = { status() { return { send: (x) => x }; }, header() { return reply; } };
  return handlers[key]({ params: { id }, body, query }, reply);
};
const restart = (id) => { X.clearRoomCaches(id); reads = 0; };
const ko = (n) => Array.from({ length: n }, (_, i) => `${i + 1}번째 날, 하늘이 맑았다.`);
const en = (n) => Array.from({ length: n }, (_, i) => `Day ${i + 1}, the sky was clear and bright.`);
const tick = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
  fs.rmSync(CHATS, { recursive: true, force: true });
  X.saveSettings({ connection: null, chats: {} });
  rooms = {};
  for (const id of ['roomA', 'roomB', 'kid']) X.clearRoomCaches(id);
  reads = 0;
});

test('no stored value: detected once from the chat, stored with its basis, and not read again', async () => {
  rooms.roomA = en(6);
  assert.equal((await call('GET /chats/:id', 'roomA')).chatLang, 'en');
  assert.equal(reads, 1);
  const rec = readLang('roomA');
  assert.equal(rec.lang, 'en');
  assert.equal(rec.count, 6);
  assert.equal(rec.lastId, 'm6');
  assert.ok(Date.parse(rec.detectedAt));
  await call('GET /chats/:id', 'roomA');
  assert.equal(reads, 1);
});

test('after a restart the stored value answers without reading the chat', async () => {
  rooms.roomA = en(6);
  await call('GET /chats/:id', 'roomA');
  restart('roomA');
  assert.equal((await call('GET /chats/:id', 'roomA')).chatLang, 'en');
  assert.equal(reads, 0, 'chatMessages was not called on the view path');
  assert.equal(X.writeLanguage('roomA'), 'en');
});

test('an old stored value is looked at again behind the answer, once', async () => {
  rooms.roomA = en(6);
  await call('GET /chats/:id', 'roomA');
  const rec = readLang('roomA');
  rec.detectedAt = new Date(Date.now() - 7 * 3600_000).toISOString();
  fs.writeFileSync(langPath('roomA'), JSON.stringify(rec));
  restart('roomA');
  rooms.roomA = ko(8);
  assert.equal((await call('GET /chats/:id', 'roomA')).chatLang, 'en', 'answered from the stored value');
  await tick();
  assert.equal(reads, 1, 'the refresh ran behind it');
  assert.equal(readLang('roomA').lang, 'ko');
  await call('GET /chats/:id', 'roomA');
  await tick();
  assert.equal(reads, 1);
});

test('messages already in hand update the stored value: language change, enough new messages, a vanished last message', () => {
  const prep = (texts) => L.prepareMessages(rows(texts).map((r) => ({ id: r.id, number: r.rowid, speaker: 'User', role: 'user', content: r.content })));
  X.noteLanguage('roomA', prep(en(5)));
  assert.equal(readLang('roomA').count, 5);
  const stamp = readLang('roomA').detectedAt;
  X.noteLanguage('roomA', prep(en(8)));
  assert.equal(readLang('roomA').count, 5, 'a few new messages leave the stored basis alone');
  assert.equal(readLang('roomA').detectedAt, stamp);
  X.noteLanguage('roomA', prep(en(5 + X.LANG_REFRESH_EVERY)));
  assert.equal(readLang('roomA').count, 5 + X.LANG_REFRESH_EVERY);
  X.noteLanguage('roomA', prep(ko(5 + X.LANG_REFRESH_EVERY)));
  assert.equal(readLang('roomA').lang, 'ko');
  X.noteLanguage('roomA', prep(ko(6)));
  const moved = prep(ko(6)).map((m, i) => (i === 5 ? { ...m, id: 'other' } : m));
  X.noteLanguage('roomA', moved);
  assert.equal(readLang('roomA').lastId, 'other');
});

test('the reply path reuses its messages: the stored value follows the chat with no extra read', async () => {
  rooms.roomA = en(4);
  X.saveSettings({ connection: null, chats: { roomA: { enabled: true } } });
  await call('GET /chats/:id', 'roomA');
  rooms.roomA = ko(30);
  reads = 0;
  await X.syncBeforeReply('roomA', {}).catch(() => null);
  assert.equal(reads, 1, 'one read, shared');
  assert.equal(readLang('roomA').lang, 'ko');
  assert.equal(readLang('roomA').count, 30);
});

test('backup carries the language, restore brings it back, purge removes it', async () => {
  rooms.roomA = en(6);
  await call('GET /chats/:id', 'roomA');
  fs.writeFileSync(path.join(CHATS, 'roomA.json'), JSON.stringify(L.emptyLedger()));
  const { fileName: _n, backup } = await call('GET /chats/:id/backup', 'roomA', null, {});
  assert.equal(backup.files.lang.lang, 'en');
  fs.rmSync(langPath('roomA'));
  X.clearRoomCaches('roomA');
  await call('POST /chats/:id/restore/apply', 'roomA', { backup });
  assert.equal(readLang('roomA').lang, 'en');
  X.purgeChatMemory('roomA');
  assert.equal(fs.existsSync(langPath('roomA')), false);
});

test('a branch inherits the language of its source', async () => {
  rooms.roomB = en(6);
  rooms.kid = en(4);
  X.saveSettings({ connection: null, chats: { roomB: { enabled: true } } });
  await call('GET /chats/:id', 'roomB');
  X.saveLedger('roomB', L.emptyLedger());
  fs.rmSync(langPath('kid'), { force: true });
  await X.inheritBranch('roomB', 'kid').catch(() => null);
  assert.equal(readLang('kid').lang, 'en');
  assert.equal(readLang('kid').count, 4);
});
