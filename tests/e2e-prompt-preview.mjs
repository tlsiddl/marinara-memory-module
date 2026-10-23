// End-to-end check against a running Marinara server (a throwaway test instance, never a real one).
// Usage: node tests/e2e-prompt-preview.mjs http://127.0.0.1:7861 <notes dir>
// Creates a dummy connection, character, chat and a {{기억}} preset section, then asks the
// prompt preview (dry run, returnPrompt) for the exact prompt. No model is called.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const [base, notesDir] = process.argv.slice(2);
const headers = { 'content-type': 'application/json', 'x-marinara-csrf': '1' };
async function api(method, url, body) {
  const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw Error(`${method} ${url} -> ${response.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const connection = await api('POST', '/api/connections', { name: 'memory-test', provider: 'openai', baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'test', model: 'gpt-4o' });
const character = await api('POST', '/api/characters', { data: { name: 'Mira', description: 'A test character.', first_mes: 'Hello.' } });
const presets = await api('GET', '/api/prompts');
const stock = presets.find((item) => item.name === "Marinara's Universal Preset") ?? presets[0];
const copy = await api('POST', `/api/prompts/${stock.id}/duplicate`, {});
const preset = copy?.preset ?? copy;
const sections = await api('GET', `/api/prompts/${preset.id}/sections`);
const target = sections.find((section) => section.enabled !== false && section.enabled !== 'false' && !section.isMarker && section.content) ?? sections[0];
await api('PATCH', `/api/prompts/${preset.id}/sections/${target.id}`, { content: `${target.content}\n\n<memory>\n{{기억}}\n</memory>` });
const chat = await api('POST', '/api/chats', { name: 'memory test', mode: 'roleplay', characterIds: [character.id], promptPresetId: preset.id, connectionId: connection.id });

const preview = async () => api('POST', '/api/generate/dryRun', { chatId: chat.id, returnPrompt: true, userMessage: '안녕' });
const flat = (result) => JSON.stringify(result);

// 1) Shared note.
let result = await preview();
assert.match(flat(result), /기억 모듈 연결 확인/, 'default note should be in the prompt');
assert.doesNotMatch(flat(result), /\{\{기억\}\}/, 'the macro itself should be gone');
console.log('ok 1: _default.txt appears where {{기억}} was written');

// 2) A note for this chat only wins over the shared one.
fs.writeFileSync(path.join(notesDir, `${chat.id}.txt`), '이 방 전용 메모: 100일에 바다 가기로 약속함');
result = await preview();
assert.match(flat(result), /100일에 바다/);
assert.doesNotMatch(flat(result), /기억 모듈 연결 확인/);
console.log('ok 2: <chatId>.txt overrides the shared note');

// 3) Exactly where it was placed: once, inside the <memory> wrapper of the chosen section.
const text = flat(result.prompt);
assert.equal(text.split('100일에 바다').length - 1, 1, 'the note appears exactly once');
assert.match(text, /<memory>\\n\s*이 방 전용 메모: 100일에 바다 가기로 약속함\\n\s*<\/memory>/);
console.log('ok 3: note appears once, inside the chosen section');

fs.rmSync(path.join(notesDir, `${chat.id}.txt`));
console.log('all e2e checks passed');
