// Speaker-tag repair in a merged group roleplay with speaker colors on.
// Usage: node tests/e2e-speakers.mjs <marinara url> <fake llm url> <reply file>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [base, llm, replyFile] = process.argv.slice(2);
const cli = fileURLToPath(new URL('../memory-module/memory-cli.cjs', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { env: { ...process.env, MEMORY_MODULE_PORT: new URL(base).port }, encoding: 'utf8' });
const headers = { 'x-marinara-csrf': '1', 'content-type': 'application/json' };
async function api(method, url, body) {
  const r = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw Error(`${method} ${url} -> ${r.status} ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const untagged = '하준이 웃었다.\n\n하준 | "I love you, Ari."\n(사랑해, 아리.)\n\n하루 | "Shut up." (닥쳐.)';

fs.writeFileSync(replyFile, untagged);
const connection = await api('POST', '/api/connections', { name: '나노딥식41플1017', provider: 'openai', baseUrl: `${llm}/v1`, apiKey: 'test', model: 'fake-model' });
const dante = await api('POST', '/api/characters', { data: { name: '하루', description: '.' } });
const kilian = await api('POST', '/api/characters', { data: { name: '하준', description: '.' } });
const chat = await api('POST', '/api/chats', { name: '그룹', mode: 'roleplay', characterIds: [dante.id, kilian.id] });
await api('PATCH', `/api/chats/${chat.id}`, { connectionId: connection.id });
await api('PATCH', `/api/chats/${chat.id}/metadata`, { groupSpeakerColors: true, groupChatMode: 'merged' });
const lastReply = async () => {
  const m = await api('GET', `/api/chats/${chat.id}/messages?limit=5`);
  return (Array.isArray(m) ? m : m.messages || m.items).filter((x) => x.role === 'assistant').at(-1);
};
const send = async (text) => {
  const r = await fetch(`${base}/api/generate`, { method: 'POST', headers, body: JSON.stringify({ chatId: chat.id, userMessage: text, streaming: true }) });
  return r.text();
};

// 1) Off by default: the reply stays as the model wrote it.
await send('안녕');
await sleep(1500);
assert.equal((await lastReply()).content, untagged);
assert.match(run('status', chat.id), /말풍선 태그 되살리기: 꺼짐/);
console.log('ok 1: off by default');

// 2) On: the old reply is fixed before the next one, and the new reply is fixed as it is saved and shown.
run('tags', chat.id, 'on');
const before = (await lastReply()).id;
const stream = await send('응');
await sleep(1500);
const fixedOld = (await api('GET', `/api/chats/${chat.id}/messages?limit=10`));
const list = Array.isArray(fixedOld) ? fixedOld : fixedOld.messages || fixedOld.items;
assert.match(list.find((m) => m.id === before).content, /<speaker="하준">하준 \| "I love you, Ari\."\n\(사랑해, 아리\.\)<\/speaker>/);
const now = await lastReply();
assert.match(now.content, /<speaker="하루">하루 \| "Shut up\." \(닥쳐\.\)<\/speaker>/);
assert.match(stream, /content_replace[^\n]*speaker=/, 'the fixed text is pushed to the open screen');
console.log('ok 2: tags put back on the old reply and on the new one, sent to the screen right away');
console.log('all speaker e2e checks passed');
