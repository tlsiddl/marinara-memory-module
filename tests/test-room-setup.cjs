'use strict';
// 배경 설정 · 진행 규칙: saved per room, 배경 설정 opens the memory as written, 진행 규칙 goes with the reply's
// instructions, and the memory's own calls read 배경 설정. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-setup-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const X = service._test;

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const reply = { status() { return { send(x) { return x; } }; } };
const post = (room, body) => handlers['POST /chats/:id/setup']({ params: { id: room }, body }, reply);

test('the route saves, keeps a left-out box, and clears an emptied one', async () => {
  const room = 'setup1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true } } });
  let out = await post(room, { lore: '  세라와 도윤은 오래전부터 아는 사이다.\r\n\r\n\r\n마을 사람들에게는 정체를 숨긴다.  ', rules: '대사와 대사 사이에는 빈 줄.' });
  assert.deepEqual(out.setup, { lore: '세라와 도윤은 오래전부터 아는 사이다.\n\n마을 사람들에게는 정체를 숨긴다.', rules: '대사와 대사 사이에는 빈 줄.' });
  out = await post(room, { rules: '' });
  assert.equal(out.setup.rules, '');
  assert.match(out.setup.lore, /오래전부터/, 'a box left out of the request stays');
  out = await post(room, { lore: '' });
  assert.equal(X.settings().chats[room].setup, undefined, 'nothing left: the entry goes');
  assert.equal(X.settings().chats[room].enabled, true, 'the rest of the room settings stay');
  assert.match(JSON.stringify(await post(room, { lore: 'x'.repeat(12001) })), /12,000자/);
  assert.match(JSON.stringify(await post(room, { rules: 3 })), /글이어야/);
});

test('배경 설정 opens the memory as written, even with no memory yet; 진행 규칙 goes with the instructions', async () => {
  const room = 'setup2';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true, speakerNames: true } } });
  assert.equal(service.renderLedger(room), '');
  assert.equal(service.nameInstructions(room, ['세라']).includes('진행 규칙'), false);
  await post(room, { lore: '세라는 [쉿]이라는 신호를 정해 두었다.', rules: '내 메시지의 <…>는 고대 그리스어로 한 말.' });
  assert.equal(service.renderLedger(room), '[배경 설정 — 이 방에서 처음부터 정해진 사실]\n세라는 [쉿]이라는 신호를 정해 두었다.');
  const said = service.nameInstructions(room, ['세라']);
  assert.match(said, /^\[진행 규칙 — 이 방에서 지킬 것\]\n내 메시지의 <…>는 고대 그리스어로 한 말\./);
  assert.ok(said.length > said.indexOf('고대 그리스어') + 20, 'the name instructions still follow');
  // With name labels off only the rules go in.
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, [room]: { ...X.settings().chats[room], speakerNames: false } } });
  assert.equal(service.nameInstructions(room, ['세라']), '[진행 규칙 — 이 방에서 지킬 것]\n내 메시지의 <…>는 고대 그리스어로 한 말.');
});

test('the memory calls read 배경 설정 at the start of the first user message', () => {
  const room = 'setup3';
  X.saveSettings({ connection: null, chats: { [room]: { setup: { lore: '도윤은 세라의 오랜 연인이었다.' } } } });
  const note = X.setupNote(room);
  assert.match(note, /^## 이 방의 배경 설정/);
  const messages = X.withSetup(note, [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }]);
  assert.equal(messages[0].content, 'S');
  assert.equal(messages[1].content, `${note}\n\nU`);
  assert.deepEqual(X.withSetup('', [{ role: 'user', content: 'U' }]), [{ role: 'user', content: 'U' }]);
  // A long one is cut at a line.
  X.saveSettings({ connection: null, chats: { [room]: { setup: { lore: Array.from({ length: 800 }, (_, i) => `줄 ${i} 내용`).join('\n') } } } });
  const long = X.setupNote(room);
  assert.ok(long.length < 6200);
  assert.match(long, /내용$/);
});

test('고대 그리스어 is a speech-mark language of its own', () => {
  assert.deepEqual(L.cleanSpeechMarks([{ from: 1, marks: { '<': 'grc', '[': 'it' } }]), [{ from: 1, marks: { '<': 'grc', '[': 'it' } }]);
  assert.equal(L.SPEECH_LANGS.grc[0], '고대 그리스어');
});
