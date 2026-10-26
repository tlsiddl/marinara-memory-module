// Scene memory on a throwaway Marinara test server with the fake model (tests/fake-llm.mjs).
// Usage: node tests/e2e-scenes.mjs <marinara url> <fake llm url> <chat .jsonl> <reply file>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [base, llm, jsonlPath, replyFile] = process.argv.slice(2);
const port = new URL(base).port;
const cli = fileURLToPath(new URL('../memory-module/memory-cli.cjs', import.meta.url));
const headers = { 'x-marinara-csrf': '1' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, url, body) {
  const response = await fetch(base + url, {
    method,
    headers: body instanceof FormData ? headers : { ...headers, 'content-type': 'application/json' },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw Error(`${method} ${url} -> ${response.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { env: { ...process.env, MEMORY_MODULE_PORT: port }, encoding: 'utf8' });
const calls = async () => (await fetch(`${llm}/__calls`)).json();
async function settle(chatId) {
  for (let i = 0; i < 600; i++) {
    const r = await api('GET', `/api/memory-module/chats/${chatId}`);
    if (r.job.state !== 'running' && r.sceneJob.state !== 'running') return r;
    await sleep(500);
  }
  throw Error('timed out');
}
const preview = async (chatId) => JSON.stringify((await api('POST', '/api/generate/dryRun', { chatId, returnPrompt: true, userMessage: '음' })).prompt);
async function reply(chatId, text) {
  await api('POST', '/api/generate', { chatId, userMessage: text, streaming: true });
  await sleep(2000);
  return settle(chatId);
}

fs.writeFileSync(replyFile, '하루가 고개를 끄덕였다.');
const connection = await api('POST', '/api/connections', { name: '나노딥식41플1017', provider: 'openai', baseUrl: `${llm}/v1`, apiKey: 'test', model: 'fake-model' });
const form = new FormData();
form.append('file', new Blob([fs.readFileSync(jsonlPath)]), 'Test.jsonl');
const imported = await api('POST', '/api/import/st-chat', form);
const chatId = imported.chatId || imported.id || imported.chat?.id;
const stock = (await api('GET', '/api/prompts')).find((p) => p.name === "Marinara's Universal Preset");
const copy = await api('POST', `/api/prompts/${stock.id}/duplicate`, {});
const preset = copy.preset ?? copy;
const sections = await api('GET', `/api/prompts/${preset.id}/sections`);
const history = sections.find((s) => s.isMarker && JSON.stringify(s.markerConfig || '').includes('chat_history'));
const added = await api('POST', `/api/prompts/${preset.id}/sections`, { identifier: 'memory', name: '기억', content: '<memory>\n{{기억}}\n</memory>', role: 'system', isMarker: false, enabled: true });
const order = sections.map((s) => s.id);
order.splice(order.indexOf(history.id), 0, added.id ?? added.section?.id);
await api('PUT', `/api/prompts/${preset.id}/sections/reorder`, { sectionIds: order });
await api('PATCH', `/api/chats/${chatId}`, { connectionId: connection.id, promptPresetId: preset.id });
await api('PATCH', `/api/chats/${chatId}/metadata`, { contextMessageLimit: 20 });
run('connection', '나노딥식41플1017');

// 1) Estimate knows the window.
const est = run('estimate', chatId);
assert.match(est, /최근 메시지 20개/);
assert.match(est, /장면 \d+번/);
console.log('ok 1:', est.split('\n')[0]);

// 2) Full pass: messages older than (20 - 8) from the end become scenes; the newest stay out.
run('start', chatId, '--fresh');
await sleep(1000);
let state = await settle(chatId);
assert.equal(state.sceneJob.state, 'done', JSON.stringify(state.sceneJob));
assert.equal(state.scenes.coveredThrough, 54, 'folded through message 54 (66 - 12)');
assert.ok(state.scenes.count >= 9, `${state.scenes.count} scenes`);
assert.ok(state.scenes.facts >= 1);
console.log(`ok 2: ${state.scenes.count} scenes through message ${state.scenes.coveredThrough}, ${(await calls()).scenes} scene call(s)`);

// 3) The prompt carries scenes that left the window, the newest expanded, then the slim ledger.
let prompt = await preview(chatId);
let store = await api('GET', `/api/memory-module/chats/${chatId}/scenes`);
const firstInside = (await api('GET', `/api/memory-module/chats/${chatId}`)).scenes.firstInside;
assert.ok(firstInside >= 45 && firstInside <= 48, `firstInside ${firstInside}`);
const shown = store.scenes.filter((x) => x.start < firstInside);
const hidden = store.scenes.filter((x) => x.start >= firstInside);
assert.match(prompt, /\[지난 장면들\]/);
const titled = (t) => new RegExp(`${t}(:|\\\\n)`);
assert.match(prompt, titled(shown.at(-1).title));
assert.ok(hidden.length && !titled(hidden[0].title).test(prompt), 'a scene still inside the window is left out');
assert.match(prompt, /회상:/);
assert.match(prompt, /서아 \[흐릿하게만 기억함[^\]]*\]/);
assert.match(prompt, /\[알게 된 사실\]/);
assert.match(prompt, /\[아직 끝나지 않은 일\]/);
assert.doesNotMatch(prompt, /원문: /, 'the slim ledger carries no quotes');
assert.doesNotMatch(prompt, /<speaker/, 'speaker tags are taken off');
assert.match(prompt, /\(서술\) /, 'narration lines are marked; spoken lines get who → whom (unit tests)');
console.log('ok 3: scenes outside the window are in the prompt, newest expanded');

// 4) One reply does not fold (only 2 new messages); four replies do, in one call.
const before = (await calls()).scenes;
state = await reply(chatId, '오늘 뭐 해?');
assert.equal((await calls()).scenes, before, 'no fold for 2 messages');
for (const t of ['응', '그래', '좋아']) state = await reply(chatId, t);
assert.equal((await calls()).scenes, before + 1, 'one fold once 8 have gathered');
assert.equal(state.scenes.coveredThrough, 62);
console.log(`ok 4: folded again after 8 new messages, now through ${state.scenes.coveredThrough}`);

// 5) A hand edit sticks and shows in the prompt.
store = await api('GET', `/api/memory-module/chats/${chatId}/scenes`);
const target = store.scenes.filter((x) => x.start < firstInside).at(-1);
await api('PATCH', `/api/memory-module/chats/${chatId}/scenes/${target.id}`, { summary: '손으로 고친 요약: 문틈으로 서약을 밀어 넣음.', recollections: [{ who: '서아', text: '기억이 없다.', remembers: 'none', why: '몸살기' }] });
prompt = await preview(chatId);
assert.match(prompt, /손으로 고친 요약/);
assert.ok(run('scenes', chatId).includes(`${target.title} (직접 고침)`));
console.log('ok 5: hand edits are kept and used');

// 6) Rerolling the last reply never touches folded scenes.
const callsBefore = (await calls()).scenes;
const msgs = await api('GET', `/api/chats/${chatId}/messages?limit=5`);
const list = Array.isArray(msgs) ? msgs : msgs.messages || msgs.items;
await api('POST', '/api/generate', { chatId, regenerateMessageId: list.filter((m) => m.role === 'assistant').at(-1).id, streaming: true });
await sleep(2000);
state = await settle(chatId);
assert.equal(state.scenes.coveredThrough, 62);
assert.equal((await calls()).scenes, callsBefore);
assert.match(await preview(chatId), /손으로 고친 요약/);
console.log('ok 6: a reroll leaves folded scenes and edits alone');

// 7) Recall: before each reply the memory model picks old scenes; they go into the prompt in full.
let info = await api('GET', `/api/memory-module/chats/${chatId}`);
assert.equal(info.recall.used, 'model', JSON.stringify(info.recall));
assert.deepEqual(info.recall.picks.map((p) => p.id), ['S1'], 'unknown scene ids are dropped');
prompt = await preview(chatId);
assert.match(prompt, /\[지금 떠오르는 지난 장면\]\\n\s*① 장면 1\\n/);
assert.match(run('status', chatId), /최근 회상 \(기억 모델, [\d.]+초\): S1 장면 1 — 테스트 회상/);
const recallCalls = (await calls()).recall;
await api('POST', '/api/generate', { chatId, regenerateMessageId: (await api('GET', `/api/chats/${chatId}/messages?limit=5`)).filter?.((m) => m.role === 'assistant').at(-1)?.id ?? list.at(-1).id, streaming: true });
await sleep(2000);
await settle(chatId);
console.log(`ok 7: recall picked S1 and it is in the prompt in full; a reroll made ${(await calls()).recall - recallCalls} new recall call(s)`);

// 8) Fast mode: no model call, the reply still goes through.
run('recall', 'fast');
const before8 = (await calls()).recall;
await reply(chatId, '그 서약 기억나?');
assert.equal((await calls()).recall, before8);
info = await api('GET', `/api/memory-module/chats/${chatId}`);
assert.equal(info.recall.used, 'fast');
run('recall', 'off');
await reply(chatId, '응');
assert.doesNotMatch(await preview(chatId), /지금 떠오르는 지난 장면/);
run('recall', 'model');
console.log(`ok 8: fast picks without a model call (${info.recall.picks.map((p) => p.id).join(', ') || 'none'}), off leaves recall out`);

// 9) Meaning search: an embedding model indexes every scene; each reply looks for scenes close in meaning.
const bad = await fetch(`${base}/api/memory-module/settings/embedding`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-marinara-csrf': '1' }, body: JSON.stringify({ model: '' }) });
assert.equal(bad.status, 200);
const set = await api('POST', '/api/memory-module/settings/embedding', { model: 'fake-embed' });
assert.equal(set.dimensions, 64);
await api('POST', `/api/memory-module/chats/${chatId}/start`, {});
await sleep(1500);
info = await settle(chatId);
assert.ok(info.vectors && info.vectors.indexed === info.vectors.total && info.vectors.total > 0, JSON.stringify(info.vectors));
const embedBefore = (await calls()).embeddedTexts;
await reply(chatId, '장면 1 때 일 기억나?');
info = await api('GET', `/api/memory-module/chats/${chatId}`);
assert.ok(info.recall.semantic?.length, JSON.stringify(info.recall));
assert.equal(info.recall.semanticError, null);
assert.ok((await calls()).embeddedTexts > embedBefore);
// Off again: nothing more is embedded.
await api('POST', '/api/memory-module/settings/embedding', { model: '' });
info = await api('GET', `/api/memory-module/chats/${chatId}`);
assert.equal(info.vectors, null);
console.log(`ok 9: ${info.scenes.count} scene(s) indexed; meaning search found ${JSON.stringify((await api('GET', `/api/memory-module/chats/${chatId}`)).recall.semantic?.map((x) => x.id) || [])}`);
console.log(run('status', chatId).trim());
console.log('all scene e2e checks passed');
