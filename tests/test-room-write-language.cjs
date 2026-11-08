'use strict';
// A room's own memory language: it overrides the all-rooms setting, "follow" stores nothing, bad values are refused,
// other room settings stay, and the library offers the choice. (Invented rooms.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-room-lang-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body }, reply);
  return { result, error };
};

test('a room can write its memory in another language than the all-rooms setting', async () => {
  X.saveSettings({ writeLanguage: 'en', chats: { cn: { enabled: true, speakerTags: true } } });
  assert.equal(X.writeLanguage('cn'), 'en');
  assert.equal(X.writeLanguage('other'), 'en');

  const zh = await call('POST /chats/:id/write-language', 'cn', { lang: 'zh' });
  assert.ifError(zh.error);
  assert.deepEqual(zh.result, { roomWriteLanguage: 'zh', writeLanguage: 'zh' });
  assert.equal(X.writeLanguage('cn'), 'zh');
  assert.equal(X.writeLanguage('other'), 'en', 'other rooms keep the all-rooms setting');
  assert.equal(X.settings().chats.cn.speakerTags, true, 'the room\'s other settings stay');

  // 'chat': the chat's own language even though every other room writes English.
  X.chatLangs.set('kr', 'ko');
  await call('POST /chats/:id/write-language', 'kr', { lang: 'chat' });
  assert.equal(X.writeLanguage('kr'), 'ko');

  // follow: nothing stored, back to the all-rooms setting.
  await call('POST /chats/:id/write-language', 'cn', { lang: 'follow' });
  assert.equal('writeLanguage' in X.settings().chats.cn, false);
  assert.equal(X.roomWriteLanguage('cn'), 'follow');
  assert.equal(X.writeLanguage('cn'), 'en');

  assert.match((await call('POST /chats/:id/write-language', 'cn', { lang: 'ja' })).error, /follow, chat, en, zh/);
  assert.match((await call('POST /chats/:id/write-language', '../x', { lang: 'en' })).error, /invalid chat id/);
});

test('the library offers the room choice in the language settings and saves it on change', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  assert.ok(src.includes('${roomWriteLanguagePicker()}'));
  assert.ok(src.includes("if (e.target.id === 'setRoomWriteLang')"));
  assert.ok(src.includes('/write-language'));
});
