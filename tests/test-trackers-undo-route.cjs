'use strict';
// Undoing a recommended tracker tells the screen what went with it (the start dates it had); the answer only adds a
// field. Also: the OOC follow-up rule, speech marks leaving hand-set quotes alone, and the OOC route clearing the recall
// cache. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-undo-'));
const service = require('../memory-module/lib/service.cjs');
const Tk = require('../memory-module/lib/trackers.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const reply = { status() { return { send(x) { return x; } }; } };

test('undoApplied of a recommended tracker answers with what it removed; other answers keep their shape', async () => {
  const room = 'undo1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true, features: { trackers: 'on' } } } });
  const hint = { type: 'cycle', label: '정기 점검', people: ['세라'], every: 30, length: 3 };
  const made = Tk.recommend(Tk.emptyTrackers(), { scenes: [{ id: 'S1', dateHints: [hint] }] }, () => '2025-03-02', '2026-01-01T00:00:00.000Z');
  X.saveTrackers(room, made);
  const view = Tk.appliedView(made);
  assert.equal(view[0].starts, 1, 'the list tells it too, for the confirm');
  const out = await handlers['POST /chats/:id/trackers']({ params: { id: room }, body: { action: 'undoApplied', aid: view[0].id } }, reply);
  assert.deepEqual(out.undone, { kind: 'newTracker', trackerId: view[0].trackerId, label: '정기 점검', starts: 1 });
  assert.ok(Array.isArray(out.items), 'the usual answer is still there');
  const again = await handlers['POST /chats/:id/trackers']({ params: { id: room }, body: { action: 'add', item: { type: 'count', label: '만난 지', scope: 'room', clock: 'story', count: { start: '2025-03-02', firstDay: 1 } } } }, reply);
  assert.equal(again.undone, undefined);
});

test('OOC follow-up: a run of quote-less action lines is story; talk about the story with an OOC mark continues', () => {
  const run = (lines) => L.markOoc(lines.map(([role, content], i) => ({ id: `m${i}`, role, content }))).map((m) => !!m.ooc);
  const a = run([
    ['user', 'OOC: 다음 장면을 어떻게 할까?'],
    ['assistant', '(OOC) 두 가지 방향이 있어요. 1. 항구 2. 시장'],
    ['user', '*세라가 조용히 의자에 앉는다.*'],
    ['assistant', '(OOC) 어느 쪽으로 갈까요?'],
    ['user', '그녀는 창밖을 바라보았다.'],
  ]);
  assert.deepEqual(a, [true, true, false, true, false], 'action lines are story');
  const b = run([
    ['user', 'OOC: 분위기를 조금 바꿔도 될까?'],
    ['assistant', '(OOC) 물론이에요. 어떤 분위기를 원하세요?'],
    ['user', '좀 더 잔잔하게 부탁해'],
    ['assistant', '(OOC) 알겠습니다. RP를 잠시 멈추고 방향을 정리할게요.'],
    ['user', '((응 좋아))'],
  ]);
  assert.deepEqual(b, [true, true, true, true, true]);
});

test('speech marks leave hand-edited scenes and hand-set quotes as they are', () => {
  const quote = (o) => ({ messageId: 'm1', number: 1, sentence: 1, text: '"Hello."', kind: 'dialogue', by: '세라', ...o });
  const store = { scenes: [
    { id: 'S1', events: [{ quotes: [quote({ manual: true, lang: undefined })] }] },
    { id: 'S2', edited: true, events: [{ quotes: [quote({})] }] },
  ] };
  const messages = [{ id: 'm1', number: 1, role: 'assistant', content: '"Hello."', sentences: [{ text: '"Hello."' }], speechLangs: ['영어'] }];
  assert.equal(S.applySpeechMarks(store, messages), 0);
  assert.equal(store.scenes[0].events[0].quotes[0].lang, undefined);
  assert.equal(store.scenes[1].events[0].quotes[0].lang, undefined);
});

test('POST /ooc clears the recall cache', async () => {
  const room = 'undo-ooc';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true } } });
  X.setEngine({ chats: { async listMessages() { return [{ id: 'a1', rowid: 1, role: 'user', content: 'hello', extra: '{}' }]; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
  X.recalls.set(room, { stale: true });
  await handlers['POST /chats/:id/ooc']({ params: { id: room }, body: { id: 'a1', ooc: true } }, reply);
  assert.equal(X.recalls.has(room), false);
});
