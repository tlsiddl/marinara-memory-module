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
