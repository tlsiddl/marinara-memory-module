const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { replyStamp, watchDisconnectedReply } = require('../memory-module/lib/service.cjs')._test;

const tick = () => new Promise((resolve) => setImmediate(resolve));
function setup(overrides = {}) {
  const raw = new EventEmitter();
  const reply = { raw, statusCode: 200 };
  let calls = 0;
  const options = { baseline: Promise.resolve('before'), status: async () => ({ active: false, translating: false }),
    stamp: async () => 'after', enabled: () => true, run: async () => { calls++; }, wait: tick, attempts: 5, ...overrides };
  const state = watchDisconnectedReply(reply, '[시험]', options);
  return { reply, state, calls: () => calls };
}

test('disconnect waits for generation and translation, then processes a saved reply once', async () => {
  let polls = 0;
  const x = setup({ status: async () => (++polls === 1 ? { active: true } : polls === 2 ? { translating: true } : {}) });
  x.reply.raw.emit('close');
  x.reply.raw.emit('close');
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(x.calls(), 1);
  assert.equal(polls, 3);
});

test('aborted generation with no saved reply does not run memory', async () => {
  const x = setup({ stamp: async () => 'before' });
  x.reply.raw.emit('close');
  await tick(); await tick();
  assert.equal(x.calls(), 0);
});

test('normal response, failed HTTP response and already claimed response do not recover', async () => {
  for (const mode of ['finished', 'error', 'claimed']) {
    const x = setup();
    if (mode === 'finished') x.reply.raw.writableFinished = true;
    if (mode === 'error') x.reply.statusCode = 500;
    if (mode === 'claimed') x.state.claimed = true;
    x.reply.raw.emit('close');
    await tick(); await tick();
    assert.equal(x.calls(), 0, mode);
  }
});

test('failed status is retried and disabled memory is not processed', async () => {
  let polls = 0;
  const x = setup({ status: async () => { if (++polls === 1) throw Error('temporary'); return { active: false, translating: false }; } });
  x.reply.raw.emit('close');
  for (let i = 0; i < 4; i++) await tick();
  assert.equal(x.calls(), 1);
  const disabled = setup({ enabled: () => false });
  disabled.reply.raw.emit('close');
  await tick(); await tick();
  assert.equal(disabled.calls(), 0);
});

test('fingerprint detects new replies and regenerated swipes without exposing text', () => {
  const first = [{ id: 'a', role: 'assistant', content: 'fake', activeSwipeIndex: 0 }];
  assert.notEqual(replyStamp(first), replyStamp([...first, { id: 'b', role: 'assistant', content: 'fake' }]));
  assert.notEqual(replyStamp(first), replyStamp([{ ...first[0], activeSwipeIndex: 1 }]));
  assert.equal(replyStamp(first), replyStamp([...first, { id: 'u', role: 'user', content: 'fake' }]));
});
