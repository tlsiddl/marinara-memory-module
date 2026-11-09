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

  assert.match((await call('POST /chats/:id/write-language', 'cn', { lang: 'ja' })).error, /follow, chat, ko, en, zh/);
  assert.match((await call('POST /chats/:id/write-language', '../x', { lang: 'en' })).error, /invalid chat id/);
});

test('Korean on purpose: a Chinese room writes Korean only, with a note to the memory model; a Korean room needs no note', async () => {
  const L = require('../memory-module/lib/ledger.cjs');
  X.saveSettings({ writeLanguage: 'auto', chats: {} });
  X.chatLangs.set('cn2', 'zh');
  X.chatLangs.set('kr2', 'ko');
  assert.equal(X.writeLanguage('cn2'), 'zh', 'by the chat: Chinese');
  await call('POST /chats/:id/write-language', 'cn2', { lang: 'ko' });
  assert.equal(X.writeLanguage('cn2'), 'ko');
  assert.equal(X.promptLanguage('cn2'), 'ko-fixed', 'the model is told to write Korean only');
  const [, user] = X.withLanguage([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], X.promptLanguage('cn2'));
  assert.match(user.content, /한국어로만 써/);
  assert.equal(X.promptLanguage('kr2'), 'ko', 'a Korean chat gets no extra note');
  // All rooms in Korean: the same, room by room.
  const all = await call('POST /settings/language', null, { writeLanguage: 'ko' });
  assert.ifError(all.error);
  X.chatLangs.set('en3', 'en');
  assert.equal(X.writeLanguage('en3'), 'ko');
  assert.equal(X.promptLanguage('en3'), 'ko-fixed');
  // A stray Chinese line in Korean memory is still shown in Korean.
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'emotion', status: 'open', title: '被遗忘的屈辱', detail: '린모가 쑤완을 기다림.', who: 'a', toward: 'b', unaware: [], guess: [], evidence: [], clues: [] });
  X.saveLedger('cn2', ledger);
  const texts = X.displayTranslationTexts('cn2');
  assert.ok(texts.includes('被遗忘的屈辱'));
  assert.ok(!texts.includes('린모가 쑤완을 기다림.'), 'Korean lines are never sent');
  await call('POST /settings/language', null, { writeLanguage: 'auto' });
});

test('the library offers the room choice in the language settings and saves it on change', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  assert.ok(src.includes('${roomWriteLanguagePicker()}'));
  assert.ok(src.includes("if (e.target.id === 'setRoomWriteLang')"));
  assert.ok(src.includes('/write-language'));
});
