'use strict';
// The prompt preview and the dry-run show what nameInstructions gives a reply (진행 규칙, name labels), roleplay only,
// ahead of the group speaker-tag instructions. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const RT = require('../memory-module/marinara-memory-runtime.cjs');

const ANCHOR = '          if (isGroupChat && groupChatMode === "merged" && groupSpeakerColors && chatMode !== "conversation") {\n            injectIntoOutputFormatOrLastUser(assembled.messages, "group", { indent: true });\n          }';

async function preview(chatMode, helper) {
  const patch = RT.PATCHES.find((p) => p.name === 'namesPreview');
  const src = `(async () => {\n${ANCHOR}\n})()`;
  const out = RT.patchSource(src, patch);
  assert.ok(out && out !== src);
  assert.equal(RT.patchSource(out, patch), out, 'applies once');
  const messages = [];
  const rows = { a: { data: JSON.stringify({ name: '세라' }) }, b: { data: JSON.stringify({ name: '도윤' }) } };
  await vm.runInNewContext(out, {
    req: { params: { id: 'room' } }, chatMode, isGroupChat: true, groupChatMode: 'merged', groupSpeakerColors: true,
    assistantCharacterIds: ['a', 'b', 'gone'], charStore: { async getById(id) { return rows[id] || null; } },
    assembled: { messages }, injectIntoOutputFormatOrLastUser: (list, text) => list.push(text),
    globalThis: { __marinaraMemory: { nameInstructions: helper } },
  });
  return messages;
}

test('the preview puts the room rules in before the group instructions, with the chat id and exact names', async () => {
  const seen = [];
  const got = await preview('roleplay', (id, names) => { seen.push([id, [...names]]); return '[진행 규칙 — 이 방에서 지킬 것]\n빈 줄'; });
  assert.deepEqual(seen, [['room', ['세라', '도윤']]]);
  assert.deepEqual(got, ['[진행 규칙 — 이 방에서 지킬 것]\n빈 줄', 'group']);
});

test('the preview adds nothing outside roleplay, or when there is nothing to add', async () => {
  assert.deepEqual(await preview('conversation', () => 'x'), [], 'a conversation gets neither');
  assert.deepEqual(await preview('roleplay', () => ''), ['group']);
  assert.deepEqual(await preview('roleplay', () => { throw Error('broken'); }), ['group'], 'a broken helper never breaks the preview');
});

test('the dry-run does the same, and not for an impersonated line', async () => {
  const patch = RT.PATCHES.find((p) => p.name === 'namesDryRun');
  const src = '(async () => { if (wrapLastMessage && !usePromptParts) { finalMessages.push("wrapped"); } })()';
  const out = RT.patchSource(src, patch);
  assert.ok(out && out !== src);
  const run = async (impersonate, mode = 'roleplay') => {
    const finalMessages = [];
    // The dynamic import of the route's own helpers is stood in for by a function the patched code calls.
    const code = out.replace('await import("./generate-route-utils.js")', '({ injectIntoOutputFormatOrLastUser: (list, text) => list.push(text) })');
    await vm.runInNewContext(code, {
      chatMode: mode, impersonate, chatId: 'room', promptCharacterIds: ['a'], chars: { getById: () => null },
      resolveCharacterNameMap: async (ids) => new Map(ids.map((id) => [id, '세라'])), finalMessages, wrapLastMessage: true, usePromptParts: false,
      globalThis: { __marinaraMemory: { nameInstructions: (id, names) => `${id}:${names.join(',')}` } },
    });
    return finalMessages;
  };
  assert.deepEqual(await run(false), ['room:세라', 'wrapped']);
  assert.deepEqual(await run(true), ['wrapped']);
  assert.deepEqual(await run(false, 'game'), ['wrapped']);
});
