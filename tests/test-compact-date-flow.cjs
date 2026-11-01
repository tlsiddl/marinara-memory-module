'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-date-flow-'));
process.env.DATA_DIR = dir;
const L = require('../memory-module/lib/ledger.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('reply preparation carries compact RP and tracker dates through to story today', async () => {
  X.saveSettings({ connection: null, recall: 'off', chats: { header: { enabled: true }, tracker: { enabled: true } } });
  const rows = {
    header: [{ id: 'h1', role: 'user', content: '§RP|20250214|10:45|장소|날씨§ 본문' }],
    tracker: [{ id: 't1', role: 'user', content: '오늘의 대화' }],
  };
  X.setEngine({
    chats: { listMessages: async (id) => rows[id], getById: async () => ({ metadata: '{}' }) },
    gameStates: { getCommittedForMessages: async (id) => new Map(id === 'tracker' ? [['t1', { date: '20250214', time: '10:45' }]] : []) },
  });
  for (const room of ['header', 'tracker']) {
    const messages = await service.chatMessages(room);
    assert.equal(L.storyTime(messages), '2025-02-14T10:45');
    await X.syncBeforeReply(room, {});
    assert.equal(X.storyToday(room, null), '2025-02-14');
  }
});
