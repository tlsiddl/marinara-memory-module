// npm install --no-save happy-dom
// node tests/test-library-folds.mjs
// A redraw (the check every few seconds, the first press of a two-press button) keeps what the reader opened and
// where they were reading. (Invented story.)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { Window } = await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
const window = new Window({ url: 'http://library.test', settings: { enableJavaScriptEvaluation: true } });
const { document } = window;
const threads = Array.from({ length: 12 }, (_, i) => ({ id: `T${i + 1}`, kind: 'promise', status: 'open', title: `약속 ${i + 1}`, text: '다시 만나기', evidence: [], who: '하루' }));
const info = { enabled: true, threads, scenes: { count: 0 }, cast: [] };
const records = { scenes: [], chapters: [], arcs: [], facts: [] };
window.localStorage.setItem('marinara-active-chat-id', 'room1');
const posted = [];
window.fetch = async (path, opts = {}) => {
  if (opts.method === 'POST') posted.push(path);
  return { ok: true, status: 200, text: async () => JSON.stringify(path.endsWith('/scenes') ? records : path.endsWith('/chats') ? [{ id: 'room1', name: '시험 방' }] : path.includes('/translations') ? { items: {} } : info) };
};
window.marinara = { onCleanup() {} };
window.eval(await readFile(new URL('../deliverable/extension.js', import.meta.url), 'utf8'));
const root = document.querySelector('#memory-module-library').shadowRoot;
const q = (s) => root.querySelector(s);
const tick = async () => { for (let i = 0; i < 15; i++) await new Promise((r) => setTimeout(r, 0)); };
document.querySelector('#memory-module-launcher').click();
await tick();
q('[data-tab="ledger"]').click();
await tick();
const item = () => q('details[data-tid="T9"]');
assert.ok(item(), 'the 9th open item is listed');
item().open = true;
// First press of 「끝난 일로 닫기」: the page is drawn again; the item stays open with the second press in view.
q('details[data-tid="T9"] [data-act="closeThread"]').click();
await tick();
assert.equal(item().open, true, 'still open after the first press');
assert.match(q('details[data-tid="T9"] [data-act="closeThread"]').textContent, /한 번 더/);
assert.equal(q('details[data-tid="T3"]').open, false, 'the others as they were');
// Closed again by the reader: a redraw keeps it closed.
item().open = false;
q('[data-tab="ledger"]').click();
await tick();
assert.equal(item().open, false);
console.log('ok - folds kept across redraws');
process.exit(0);
