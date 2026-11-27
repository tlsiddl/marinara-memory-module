// npm install --no-save happy-dom
// node tests/test-library-cast-cleanup.mjs
// 0.39.2 이름 정리 › 목록 정리: unused names and names that may not be a person are listed; taking one out needs a second
// press and sends confirm; a taken-out name comes back with 되돌리기. (Invented names.)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { Window } = await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
const window = new Window({ url: 'http://library.test', settings: { enableJavaScriptEvaluation: true } });
const { document } = window;
const info = { enabled: true, threads: [], scenes: { count: 1 }, cast: [] };
let names = {
  people: { 하루: { aliases: [], display: null, seeded: true } },
  known: ['하루', 'ㄴ', 'Guard', '빈 이름표'],
  used: [{ name: '하루', count: 9 }, { name: 'Guard', count: 2 }],
  duplicates: [], suggestions: [], history: [], autoMerged: [], busy: false, modelSame: {}, address: null,
  unused: [{ name: 'ㄴ' }, { name: '빈 이름표' }],
  suspects: [{ name: 'ㄴ', why: 'jamo', uses: 0 }, { name: 'Guard', why: 'role', uses: 2 }],
  forgotten: [],
};
window.localStorage.setItem('marinara-active-chat-id', 'room1');
const posted = [];
window.fetch = async (path, opts = {}) => {
  if (opts.method === 'POST') posted.push([path, JSON.parse(opts.body || '{}')]);
  let body;
  if (path.endsWith('/names/forget')) {
    const taken = JSON.parse(opts.body).names;
    names = { ...names, unused: names.unused.filter((x) => !taken.includes(x.name)), suspects: names.suspects.filter((x) => !taken.includes(x.name)), forgotten: taken.map((n) => ({ name: n, at: '2026-11-27T11:00:00.000Z', uses: 0 })) };
    body = { taken: taken.map((n) => ({ name: n, uses: 0 })), forgotten: names.forgotten };
  } else if (path.endsWith('/names/forget-undo')) {
    names = { ...names, forgotten: [] };
    body = { restored: JSON.parse(opts.body).name, forgotten: [] };
  } else body = path.endsWith('/names') ? names : path.endsWith('/scenes') ? { scenes: [], chapters: [], arcs: [], facts: [] } : path.endsWith('/chats') ? [{ id: 'room1', name: '방' }] : path.includes('/translations') ? {} : path.endsWith('/status') ? { settings: {} } : info;
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};
window.marinara = { onCleanup() {} };
window.eval(await readFile(new URL('../deliverable/extension.js', import.meta.url), 'utf8'));
const root = document.querySelector('#memory-module-library').shadowRoot;
const q = (s) => root.querySelector(s);
const text = () => q('#content').textContent;
const all = () => root.textContent; // notices show above the content
const tick = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
document.querySelector('#memory-module-launcher').click();
await tick();
q('[data-tab="person"]').click();
await tick();
q('[data-tab="names"]').click();
await tick();
assert.match(text(), /목록 정리 · 쓰인 곳 없음 2 · 인물이 아닐 수 있음 2/);
assert.match(text(), /자모만 있음 · 기억에 쓰인 곳 0/);
assert.match(text(), /역할 낱말만 · 기억에 쓰인 곳 2/);
assert.ok(!/null|undefined/.test(text()), 'no null or undefined on screen');
// One name: the first press only arms, the second sends confirm.
q('[data-act="nameForget"][data-name="ㄴ"]').click();
await tick();
assert.equal(posted.filter(([p]) => p.endsWith('/names/forget')).length, 0, 'first press does not send');
assert.match(text(), /한 번 더 누르면 뺍니다/);
q('[data-act="nameForget"][data-name="ㄴ"]').click();
await tick();
const sent = posted.find(([p]) => p.endsWith('/names/forget'));
assert.deepEqual(sent[1], { names: ['ㄴ'], confirm: true });
assert.match(all(), /ㄴ을\(를\) 인물 목록에서 뺐습니다/);
assert.match(text(), /뺀 이름 · 1/);
// Put back.
q('[data-act="nameForgetUndo"][data-name="ㄴ"]').click();
await tick();
assert.deepEqual(posted.find(([p]) => p.endsWith('/names/forget-undo'))[1], { name: 'ㄴ' });
assert.match(all(), /ㄴ을\(를\) 인물 목록에 되돌렸습니다/);
console.log('ok · 목록 정리 화면');
process.exit(0);
