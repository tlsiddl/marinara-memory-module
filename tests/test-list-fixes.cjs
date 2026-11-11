'use strict';
// From a check of a room against its source: a ledger item can name several people on either side and be fixed by
// hand, and a birth told in a flashback is not a day count starting today. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-listfix-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const Tk = require('../memory-module/lib/trackers.cjs');
const X = service._test;

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const reply = { status() { return { send(x) { return x; } }; } };

test('a ledger item names several people toward whom, set by hand; a plan stays without names', async () => {
  const room = 'lf1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: false } } });
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'promise', status: 'open', title: '조언', who: '세라', toward: '도윤', detail: '', unaware: [], guess: [], evidence: [] });
  ledger.threads.push({ id: 'T2', kind: 'pending', status: 'open', plan: true, title: '계획', who: null, toward: null, detail: '', unaware: [], guess: [], evidence: [] });
  ledger.nextId = 3;
  X.saveLedger(room, ledger);
  const edit = (tid, body) => handlers['POST /chats/:id/threads/:tid/:action']({ params: { id: room, tid, action: 'edit' }, body }, reply);
  await edit('T1', { toward: '도윤, 하준' });
  assert.equal(X.loadLedger(room).threads[0].toward, '도윤·하준');
  await edit('T1', { toward: '' });
  assert.equal(X.loadLedger(room).threads[0].toward, null);
  await edit('T2', { who: '세라' });
  assert.equal(X.loadLedger(room).threads[1].who, null, 'a plan keeps no names');
  assert.match(L.SYSTEM_PROMPT || fs.readFileSync(path.join(__dirname, '../memory-module/lib/ledger.cjs'), 'utf8'), /여럿이면 ·로 이어서/);
});

test('a birth is not a day count; a meeting still is', () => {
  assert.equal(Tk.cleanHint({ type: 'count', label: 'born in Liverpool', people: [] }), null);
  assert.equal(Tk.cleanHint({ type: 'count', label: '태어난 지', people: [] }), null);
  assert.ok(Tk.cleanHint({ type: 'count', label: '만난 지', people: [] }));
  assert.match(Tk.PROMPT, /회상이나 지난 이야기 속의 일/);
});

test('an open item that moved on reads now first, then how it began', () => {
  const ledger = L.emptyLedger();
  const t = { id: 'T1', kind: 'promise', status: 'open', title: 'Walk her home', who: '빅터', toward: '세라', detail: 'He said he would walk her home after the market.', since: '25-03-01', latest: { text: 'They reached the gate together.', number: 9 }, unaware: [], guess: [], evidence: [], clues: [] };
  ledger.threads.push(t);
  const line = L.renderCompact(ledger);
  assert.match(line, /Walk her home — 지금: They reached the gate together\. \[25-03-01\] \(처음: He said he would walk her home after the market\.\)/);
  const plain = L.renderCompact({ ...ledger, threads: [{ ...t, latest: null }] });
  assert.match(plain, /Walk her home — He said he would walk her home after the market\. \[25-03-01\]/);
  assert.doesNotMatch(plain, /처음:/);
});

test('a quoted line is shown with the Korean the chat already has (paragraph translations on the message)', () => {
  const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const p1 = 'The rain stopped. Sera opened the door.';
  const p2 = 'He laughed. Then he left without a word. Nobody followed.';
  const rows = [{ id: 'm1', rowid: 1, role: 'assistant', content: `<speaker="x">${p1}</speaker>\n\n*${p2}*`, extra: JSON.stringify({ paraTranslate: { v: 1, map: { [hash(p1)]: '비가 그쳤다. 세라가 문을 열었다.', [hash(p2)]: '그가 웃더니 말없이 떠났다. 아무도 따라가지 않았다.' } } }) }];
  const map = X.noteSourceKo('src1', rows);
  assert.equal(map.get('Sera opened the door.'), '세라가 문을 열었다.', 'same number of sentences: sentence by sentence');
  assert.equal(map.get('Nobody followed.'), '그가 웃더니 말없이 떠났다. 아무도 따라가지 않았다.', 'otherwise the short paragraph stands for each');
  const room = 'src1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: false } } });
  X.saveScenes(room, { ...require('../memory-module/lib/scenes.cjs').emptyStore(), scenes: [{ id: 'S1', start: 1, end: 1, title: 't', summary: 's', present: [], events: [{ text: 'e', quotes: [{ number: 1, sentence: 2, text: 'Sera opened the door.' }, { number: 1, sentence: 1, text: '"Hi." (안녕.)', translation: '안녕.' }] }] }] });
  assert.deepEqual(X.sourceQuoteItems(room), { 'Sera opened the door.': '세라가 문을 열었다.' });
  assert.equal(X.translationLookup(room, 'ko')('Sera opened the door.'), '세라가 문을 열었다.');
});

test('story lines for older scenes come from their summaries, only where a scene has none, asked once', () => {
  const S = require('../memory-module/lib/scenes.cjs');
  const store = { ...S.emptyStore(), scenes: [
    { id: 'S1', start: 1, end: 2, title: 'Key', summary: 'Sera hides the shed key.', present: [], events: [] },
    { id: 'S2', start: 3, end: 4, title: 'Search', summary: 'Doyun looks for the key.', present: [], events: [] },
    { id: 'S3', start: 5, end: 6, title: 'Found', summary: 'The key turns up.', present: [], events: [], lines: [{ name: 'Shed key', now: 'Found.' }] },
  ] };
  assert.deepEqual(S.lineFillTargets(store).map((s) => s.id), ['S1', 'S2']);
  const prompt = S.buildLineFillPrompt(store, S.lineFillTargets(store))[1].content;
  assert.doesNotMatch(prompt, /Shed key/, 'a line that began after the asked scenes is not offered');
  assert.match(prompt, /S1 Key: Sera hides the shed key\./);
  const filled = S.applyLineFill(store, { scenes: [{ id: 's1', lines: [{ name: 'Shed key', now: 'Hidden.' }] }, { id: 'S3', lines: [{ name: 'Other' }] }] }, S.lineFillTargets(store));
  assert.equal(filled, 1);
  assert.deepEqual(store.scenes[0].lines, [{ name: 'Shed key', now: 'Hidden.' }]);
  assert.equal(store.scenes[0].linesFilled, true);
  assert.deepEqual(store.scenes[2].lines, [{ name: 'Shed key', now: 'Found.' }], 'a scene that had lines keeps them');
  assert.deepEqual(S.lineFillTargets(store), [], 'S2 was asked and got none: not asked again');
});

test('a feeling filed for a habit moves to a state; the review prompt knows a feeling can fade', () => {
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'emotion', status: 'open', title: 'Calls him by a nickname', who: '세라', toward: '도윤', detail: '', need: 'x', unaware: [], guess: [], evidence: [], clues: [] });
  const stats = L.applyFeelingReview(ledger, { resolved: [], misfiled: [{ id: 'T1', kind: 'state' }] }, []);
  assert.equal(stats.moved, 1);
  assert.equal(ledger.threads[0].kind, 'state');
  assert.match(fs.readFileSync(path.join(__dirname, '../memory-module/lib/ledger.cjs'), 'utf8'), /가라앉음도 풀림이야/);
});

test('a line fill that puts a long stretch on one line is refused; filled lines can be taken back; later lines are not offered', () => {
  const S = require('../memory-module/lib/scenes.cjs');
  const scenes = Array.from({ length: 10 }, (_, i) => ({ id: `S${i + 1}`, start: i * 2 + 1, end: i * 2 + 2, title: `t${i}`, summary: `s${i}`, present: [], events: [] }));
  scenes[9].lines = [{ name: 'Late trip', now: 'Arrived.' }];
  const store = { ...S.emptyStore(), scenes };
  const list = S.lineFillTargets(store);
  assert.doesNotMatch(S.buildLineFillPrompt(store, list)[1].content, /Late trip/, 'a line that starts after the asked scenes is not offered');
  const all = { scenes: list.map((s) => ({ id: s.id, lines: [{ name: 'Late trip' }] })) };
  assert.equal(S.applyLineFill(store, all, list), -1);
  assert.equal(store.scenes.filter((s) => s.lines).length, 1);
  delete store.lineFillTried;
  assert.equal(S.applyLineFill(store, { scenes: [{ id: 'S1', lines: [{ name: 'Key' }] }, { id: 'S2', lines: [{ name: 'Key' }] }] }, S.lineFillTargets(store)), 2);
  assert.equal(S.undoLineFill(store), 2);
  assert.equal(store.scenes.filter((s) => s.lines).length, 1, 'the scene call\'s own lines stay');
  assert.equal(S.lineFillTargets(store).length, 9);
});
