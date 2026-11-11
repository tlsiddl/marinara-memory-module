'use strict';
// A fact added by hand goes into its scene, gets the next number and the scene's time, and is marked as the user's.
// (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-factadd-'));
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const reply = { status() { return { send(x) { return x; } }; } };

test('a fact is added to its scene by hand', async () => {
  const room = 'factadd1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: false } } });
  const store = S.emptyStore();
  store.scenes.push({ id: 'S1', start: 1, end: 2, time: '25-03-02 (일) 오후', place: '항구', title: '만남', summary: '세라와 도윤이 만난다.', events: [], present: ['세라', '도윤'] });
  store.nextScene = 2;
  store.nextFact = 7;
  X.saveScenes(room, store);
  const post = (body) => handlers['POST /chats/:id/facts']({ params: { id: room }, body }, reply);
  const fact = await post({ sceneId: 'S1', about: '세라', text: ' Is afraid of deep water. ', unaware: ['도윤'] });
  assert.equal(fact.id, 'F7');
  assert.equal(fact.text, 'Is afraid of deep water.');
  assert.equal(fact.when, '25-03-02 (일) 오후');
  assert.deepEqual(fact.unaware, ['도윤']);
  assert.equal(fact.edited, true);
  const saved = X.loadScenes(room);
  assert.equal(saved.nextFact, 8);
  assert.equal(saved.facts.at(-1).id, 'F7');
  assert.match(JSON.stringify(await post({ sceneId: 'S9', text: 'x' })), /장면을 찾지 못했습니다/);
  assert.match(JSON.stringify(await post({ sceneId: 'S1', text: '  ' })), /내용을 적어/);
});
