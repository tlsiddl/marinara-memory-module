// node --test tests/test-edit-during-read.cjs
// An old message edited or deleted while the ledger is still being read: the next reply must not get what the
// message said before. The stored ledger is left for the read under way; the check after it saves as usual.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-edit-read-'));
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const M = require('../memory-module/lib/service.cjs');
const X = M._test;
test.after(() => fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }));

const CHAT = 'room-edit';
const rows = [
  { id: 'm1', rowid: 1, role: 'user', content: '서아: 도윤아, 금요일 오후 세 시에 병원 같이 가 줄래?' },
  { id: 'm2', rowid: 2, role: 'narrator', content: '도윤은 금요일에 서아와 병원에 가기로 약속했다.' },
  { id: 'm3', rowid: 3, role: 'user', content: '서아: 고마워.' },
  { id: 'm4', rowid: 4, role: 'narrator', content: '두 사람은 저녁을 먹었다.' },
];
X.setEngine({
  chats: {
    listMessages: async () => rows.map((r) => ({ ...r, extra: '{}' })),
    getById: async () => ({ id: CHAT, metadata: '{}', mode: 'roleplay' }),
  },
  characters: { getById: async () => null },
});

function setUp() {
  X.saveSettings({ connection: null, recall: 'off', chats: { [CHAT]: { enabled: true } } });
  const messages = L.prepareMessages(rows.slice(0, 2).map((r) => ({ id: r.id, number: r.rowid, speaker: r.role === 'user' ? 'User' : 'Narrator', role: r.role, content: r.content })));
  const ledger = L.emptyLedger();
  L.beginBatch(ledger, 0);
  const evidence = { messageId: 'm2', number: 2, sentence: 1, text: '도윤은 금요일에 서아와 병원에 가기로 약속했다.' };
  ledger.nextId = 2;
  ledger.threads.push({ id: 'T1', kind: 'promise', title: '금요일 병원 약속', who: '도윤', toward: '서아', detail: '금요일 오후 세 시에 함께 병원에 가기로 함', status: 'open', openedAt: { ...evidence }, evidence: [{ ...evidence }], clues: [] });
  L.commitBatch(ledger, messages);
  X.saveLedger(CHAT, ledger);
}

test('a message changed while the ledger is being read is left out of the next reply', async () => {
  setUp();
  assert.match(X.renderMemorySource(CHAT), /금요일 병원 약속/);
  const original = rows[1].content;
  X.jobs.set(CHAT, { state: 'running' });
  rows[1] = { ...rows[1], content: '도윤은 병원 약속을 하지 않았다.' };
  await X.syncBeforeReply(CHAT, {});
  assert.doesNotMatch(X.renderMemorySource(CHAT), /금요일 병원 약속/, 'the reply gets the ledger without the edited message');
  assert.match(JSON.stringify(X.loadLedger(CHAT).threads), /금요일 병원 약속/, 'the stored ledger is left to the read under way');

  // The read ends: the next reply's check saves the change as usual.
  X.jobs.set(CHAT, { state: 'done' });
  await X.syncBeforeReply(CHAT, {});
  assert.doesNotMatch(X.renderMemorySource(CHAT), /금요일 병원 약속/);
  rows[1] = { ...rows[1], content: original };
});

test('a message deleted while the ledger is being read is left out too; nothing changed means the ledger as stored', async () => {
  setUp();
  X.jobs.set(CHAT, { state: 'running' });
  await X.syncBeforeReply(CHAT, {});
  assert.match(X.renderMemorySource(CHAT), /금요일 병원 약속/, 'no change: the stored ledger');
  const removed = rows.splice(1, 1)[0];
  await X.syncBeforeReply(CHAT, {});
  assert.doesNotMatch(X.renderMemorySource(CHAT), /금요일 병원 약속/);
  rows.splice(1, 0, removed);
  await X.syncBeforeReply(CHAT, {});
  assert.match(X.renderMemorySource(CHAT), /금요일 병원 약속/, 'put back as it was: the promise is back');
  X.jobs.delete(CHAT);
});
