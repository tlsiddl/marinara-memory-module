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
