// Full flow on a throwaway Marinara test server with the fake model (tests/fake-llm.mjs).
// Usage: node tests/e2e-ledger.mjs <marinara url> <fake llm url> <chat .jsonl> <reply file>
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
async function waitIdle(chatId) {
  for (let i = 0; i < 600; i++) {
    const r = await api('GET', `/api/memory-module/chats/${chatId}`);
    if (r.job.state !== 'running') return r;
    await sleep(500);
  }
  throw Error('timed out');
}

// Setup: model connection, imported real chat, preset with {{기억}}.
const connection = await api('POST', '/api/connections', { name: '나노딥식41플1017', provider: 'openai', baseUrl: `${llm}/v1`, apiKey: 'test', model: 'fake-model' });
const form = new FormData();
form.append('file', new Blob([fs.readFileSync(jsonlPath)]), '테스트방.jsonl');
const imported = await api('POST', '/api/import/st-chat', form);
const chatId = imported.chatId || imported.id || imported.chat?.id;
assert.ok(chatId, `import returned ${JSON.stringify(imported).slice(0, 200)}`);
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

// 1) Commands: connection, list, estimate.
assert.match(run('connection', '나노딥식41플1017'), /기억용 연결: 나노딥식41플1017/);
assert.match(run('list'), new RegExp(chatId));
const estimate = run('estimate', chatId);
assert.match(estimate, /메시지 330개[\s\S]*호출 약 \d+번/);
console.log('ok 1:', estimate.trim());

// 2) First full pass over the real 330 messages. The ledger reads up to the user's latest message only.
const rows = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).slice(1);
const answered = rows.at(-1).is_user ? rows.length : rows.length - 1;
assert.match(run('start', chatId), /처음부터 정리/);
let state = await waitIdle(chatId);
assert.equal(state.job.state, 'done', JSON.stringify(state.job));
assert.equal(state.summary.processed, answered, 'the newest character reply waits until something follows it');
const promise = state.threads.find((t) => t.kind === 'promise');
assert.ok(promise, 'the real chat mentions 약속 somewhere');
assert.ok(rows.some((r) => r.mes.includes(promise.evidence[0].text)), 'evidence text is copied from the real message');
assert.ok(state.summary.lastTidy?.calls >= 1, 'the first pass ends with a tidy');
assert.ok(state.threads.some((t) => t.closed?.how === '테스트 점검'), 'tidy closed a thread');
console.log(`ok 2: ${state.job.total} call(s), ${state.threads.length} thread(s), read through message ${answered}, quotes match the source`);

// 3) The ledger reaches the prompt at {{기억}}, inside <memory>, before the chat history.
let preview = JSON.stringify((await api('POST', '/api/generate/dryRun', { chatId, returnPrompt: true, userMessage: '안녕' })).prompt);
assert.match(preview, /<memory>\\n\s*\[Memory:/);
const shown = state.threads.find((t) => t.status === 'open' && state.rendered.includes(t.title));
assert.ok(shown && preview.includes(shown.title), 'a rendered open thread is in the prompt');
console.log('ok 3: open threads appear at {{기억}} in the prompt preview');

// 4) A reply with a new promise is not read yet; once the user answers it, it is (one memory call).
const memoryCalls = async () => (await (await fetch(`${llm}/__calls`)).json()).memory;
const listMessages = async () => {
  const m = await api('GET', `/api/chats/${chatId}/messages?limit=5`);
  return Array.isArray(m) ? m : m.messages || m.items;
};
const hasThread = (word) => state.threads.some((t) => [t.title, t.detail, t.latest?.text].join(' ').includes(word));
let calls0 = await memoryCalls();
await api('POST', '/api/generate', { chatId, userMessage: '오늘은 좀 피곤해.', streaming: true });
await sleep(2500);
state = await waitIdle(chatId);
assert.ok(!hasThread('달빛호수'), 'the newest reply is not read before the user answers it');
fs.writeFileSync(replyFile, '하루가 하품을 했다. "그럼 푹 자."');
await api('POST', '/api/generate', { chatId, userMessage: '응, 그러자.', streaming: true });
await sleep(2500);
state = await waitIdle(chatId);
assert.ok(hasThread('달빛호수'), 'the answered reply is read');
assert.equal(state.summary.processed, answered + 4);
assert.equal((await memoryCalls()) - calls0, 2, 'one memory call per answered turn');
console.log('ok 4: a reply is read only after the user answers it');

// 5) Rerolling the newest reply changes nothing in the ledger and costs no memory call.
calls0 = await memoryCalls();
fs.writeFileSync(replyFile, '하루가 말했다. "약속할게, 금요일에 별빛극장 가자."');
await api('POST', '/api/generate', { chatId, regenerateMessageId: (await listMessages()).filter((m) => m.role === 'assistant').at(-1).id, streaming: true });
await sleep(2500);
state = await waitIdle(chatId);
assert.equal(await memoryCalls(), calls0);
assert.ok(hasThread('달빛호수') && !hasThread('별빛극장'));
console.log('ok 5: a reroll of the newest reply needs nothing undone and no memory call');

// 5b) A reroll while the memory model is still reading earlier messages does not wait for it.
await fetch(`${llm}/__delay/6000`);
fs.writeFileSync(replyFile, '하루가 어깨를 으쓱했다. "글쎄."');
await api('POST', '/api/generate', { chatId, userMessage: '내일 뭐 해?', streaming: true });
await sleep(2500); // the read of the previous turn has started and is waiting on the slow model
const t0 = Date.now();
await api('POST', '/api/generate', { chatId, regenerateMessageId: (await listMessages()).filter((m) => m.role === 'assistant').at(-1).id, streaming: true });
const waited = Date.now() - t0;
await fetch(`${llm}/__delay/0`);
assert.ok(waited < 3000, `reroll waited ${waited} ms`);
state = await waitIdle(chatId);
assert.equal(state.job.state, 'done', 'the read finished and was saved');
assert.ok(hasThread('별빛극장'), 'the answered (rerolled-away) reply from step 5 was the kept one');
assert.equal(state.summary.processed, answered + 6);
console.log(`ok 5b: a reroll during a read went ahead in ${waited} ms; the read finished`);

// 5c) Pressing send with nothing typed: the reply before it counts as kept and is read.
calls0 = await memoryCalls();
await api('POST', '/api/generate', { chatId, streaming: true });
await sleep(2500);
state = await waitIdle(chatId);
assert.equal(state.summary.processed, answered + 7, 'the reply before the empty send is read');
assert.equal((await memoryCalls()) - calls0, 1);
console.log('ok 5c: an empty send keeps the reply before it, and it is read');

// 6) Turning the chat off stops reply updates, and (since v0.8.2) nothing of its memory goes into the prompt;
// the saved ledger stays on disk and comes back when the chat is turned on again.
run('off', chatId);
const callsOff = (await (await fetch(`${llm}/__calls`)).json()).memory;
await api('POST', '/api/generate', { chatId, userMessage: '잘 자.', streaming: true });
await sleep(2500);
assert.equal((await (await fetch(`${llm}/__calls`)).json()).memory, callsOff);
preview = JSON.stringify((await api('POST', '/api/generate/dryRun', { chatId, returnPrompt: true })).prompt);
assert.doesNotMatch(preview, /\[아직 끝나지 않은 일\]/);
assert.ok((await api('GET', `/api/memory-module/chats/${chatId}`)).threads.length > 0, 'the ledger is kept');
console.log('ok 6: off stops updates and keeps memory out of the prompt; the ledger is kept');

// 7) The tidy command on its own.
assert.match(run('tidy', chatId), /장부 점검을 시작/);
state = await waitIdle(chatId);
assert.equal(state.job.state, 'done', JSON.stringify(state.job));
assert.match(run('status', chatId), /점검 결과: 열린 항목 \d+개 → \d+개/);
const feelingCalls = (await (await fetch(`${llm}/__calls`)).json()).feelings || 0;
assert.ok(feelingCalls >= 1, 'the feeling review ran');
assert.ok(state.threads.some((t) => t.kind === 'emotion' && t.closed?.how === '테스트로 풀림') || !state.threads.some((t) => t.kind === 'emotion'), 'a feeling closed with its line');
console.log('ok 7: tidy command closes and merges on the saved ledger');

// 7b) Hand fixes: reopen a closed item, close it again.
state = await api('GET', `/api/memory-module/chats/${chatId}`);
const shut = state.threads.find((t) => t.status === 'closed' && !t.mergedInto);
assert.match(run('reopen', chatId, shut.id), /다시 열었습니다/);
assert.equal((await api('GET', `/api/memory-module/chats/${chatId}`)).threads.find((t) => t.id === shut.id).status, 'open');
assert.match(run('close', chatId, shut.id, '테스트로', '닫음'), /닫았습니다/);
assert.equal((await api('GET', `/api/memory-module/chats/${chatId}`)).threads.find((t) => t.id === shut.id).closed.how, '테스트로 닫음');
console.log('ok 7b: reopen and close by hand');

// 8) Trial on a slice: nothing saved.
const saved = (await api('GET', `/api/memory-module/chats/${chatId}`)).threads.length;
const trial = run('trial', chatId, '300', '330');
assert.match(trial, /시험 완료: 메시지 31개/);
assert.equal((await api('GET', `/api/memory-module/chats/${chatId}`)).threads.length, saved);
assert.throws(() => run('trial', chatId, '1', '200'));
console.log('ok 8: trial reads a slice without saving');
console.log(run('status', chatId).trim());
console.log('all ledger e2e checks passed');
