// node --test tests/test-reply-wait.cjs
// 0.37.2: the check before a reply never waits long for the room's queue. On the live server (0.37.1, 01:18) a scene
// run held the scene queue for 5 minutes; the glossary merge took the room's queue and waited for the scenes, and three
// replies waited behind it. Now the merge looks first and stays out, and the check waits at most 3 seconds.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-reply-wait-'));
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const M = require('../memory-module/lib/service.cjs');
const X = M._test;
test.after(() => fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }));

const CHAT = 'room-wait';
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

/** A scene run that holds the scene queue until released (as the 5-minute one did). */
function holdScenes() {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  X.sceneJobs.set(CHAT, { state: 'running' });
  const done = X.enqueue(`scenes:${CHAT}`, () => held);
  return { release: async () => { X.sceneJobs.set(CHAT, { state: 'done' }); release(); await done; } };
}

test('a scene run holds the scenes: the glossary merge stays out of the room\'s queue; the reply check does not wait', async () => {
  setUp();
  const scenes = holdScenes();
  const merge = await Promise.race([X.autoMergeByGlossary(CHAT), new Promise((r) => setTimeout(() => r('waited'), 500))]);
  assert.equal(merge, 0, 'nothing now — the next run\'s end tries again');
  const t0 = Date.now();
  await X.syncBeforeReply(CHAT, {});
  assert.ok(Date.now() - t0 < 1000, `the check did not wait (${Date.now() - t0} ms)`);
  await scenes.release();
});

test('something holds the room\'s queue anyway: the reply check waits at most 3 seconds and checks a copy; the queued check saves later', async () => {
  setUp();
  const scenes = holdScenes();
  // as before 0.37.2 (or a rename pressed just before the run): the room's queue taken, waiting for the scenes
  const blocker = X.enqueue(CHAT, () => X.enqueue(`scenes:${CHAT}`, async () => 0));
  const original = rows[1].content;
  rows[1] = { ...rows[1], content: '도윤은 병원 약속을 하지 않았다.' };
  const t0 = Date.now();
  await X.syncBeforeReply(CHAT, {});
  const took = Date.now() - t0;
  assert.ok(took >= 2900 && took < 3800, `waited about 3 seconds (${took} ms)`);
  assert.doesNotMatch(X.renderMemorySource(CHAT), /금요일 병원 약속/, 'the reply gets the ledger without the edited message');
  assert.match(JSON.stringify(X.loadLedger(CHAT).threads), /금요일 병원 약속/, 'nothing saved while the queue is held');
  await scenes.release();
  await blocker;
  await X.enqueue(CHAT, async () => {}); // the queued check has had its turn
  assert.doesNotMatch(X.renderMemorySource(CHAT), /금요일 병원 약속/, 'the queued check saved it (the copy is gone)');
  assert.doesNotMatch(JSON.stringify(X.loadLedger(CHAT).threads), /금요일 병원 약속/, 'saved');
  rows[1] = { ...rows[1], content: original };
});
