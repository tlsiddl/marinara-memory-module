// npm install --no-save happy-dom
// node tests/test-library-names-group.mjs
// 이름 정리: ticking names under one person, a model guess put into it, and a name taken off a person. (Invented names.)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { Window } = await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
const window = new Window({ url: 'http://library.test', settings: { enableJavaScriptEvaluation: true } });
const { document } = window;
const info = { enabled: true, threads: [], scenes: { count: 1 }, cast: [] };
const names = {
  people: { 하루: { aliases: ['Haru'], display: null, seeded: true }, 미오: { aliases: [], display: null, seeded: true } },
  known: ['하루', '미오'],
  used: [{ name: '하루', count: 9 }, { name: '꼬맹이', count: 4 }, { name: '하루짱', count: 2 }, { name: '미오', count: 5 }],
  duplicates: [], suggestions: [], history: [], autoMerged: [], busy: false,
  modelSame: { at: '2026-11-23T04:00:00.000Z', items: [{ name: '하루짱', person: '하루', sure: 'high', why: 'S3에서 미오가 하루를 하루짱이라 부름', scenes: ['S3'] }] },
  address: null,
};
window.localStorage.setItem('marinara-active-chat-id', 'room1');
const posted = [];
window.fetch = async (path, opts = {}) => {
  if (opts.method === 'POST') posted.push([path, JSON.parse(opts.body || '{}')]);
  const body = path.endsWith('/names/group-preview') ? { items: [{ source: '꼬맹이', target: '하루' }, { source: '하루짱', target: '하루' }], counts: { ledger: 6 }, areas: {}, total: 6, samples: [], token: 't1', text: false }
    : path.endsWith('/names') ? names : path.endsWith('/scenes') ? { scenes: [], chapters: [], arcs: [], facts: [] } : path.endsWith('/chats') ? [{ id: 'room1', name: '방' }] : path.includes('/translations') ? { items: {} } : info;
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};
window.marinara = { onCleanup() {} };
window.eval(await readFile(new URL('../deliverable/extension.js', import.meta.url), 'utf8'));
const root = document.querySelector('#memory-module-library').shadowRoot;
const q = (s) => root.querySelector(s);
const tick = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
document.querySelector('#memory-module-launcher').click();
await tick();
q('[data-tab="person"]').click();
await tick();
q('[data-tab="names"]').click();
await tick();
assert.match(q('#content').textContent, /여러 이름 한꺼번에 묶기/);
assert.match(q('#content').textContent, /같은 사람 찾기 \(모델\) · 1건/);
assert.match(q('#content').textContent, /인물별 이름 · 2명/);
// A model guess goes into the group, then a name ticked by hand; a redraw keeps both.
q('[data-act="sameToGroup"]').click();
await tick();
assert.equal(q('#groupTarget').value, '하루');
assert.equal(q('[data-group-pick="하루짱"]').checked, true);
const kid = q('[data-group-pick="꼬맹이"]');
kid.checked = true;
kid.dispatchEvent(new window.Event('change', { bubbles: true }));
q('[data-tab="names"]').click();
await tick();
assert.equal(q('[data-group-pick="꼬맹이"]').checked, true, 'kept across a redraw');
q('[data-act="groupPreview"]').click();
await tick();
const [path, body] = posted.find(([p]) => p.endsWith('/names/group-preview'));
assert.ok(path);
assert.deepEqual({ ...body, sources: [...body.sources].sort() }, { target: '하루', sources: ['꼬맹이', '하루짱'].sort(), text: false });
assert.match(q('#content').textContent, /미리 보기 · 모두 6곳/);
assert.ok(q('[data-act="groupApply"]'));
// Taking a name off a person asks for a second press.
q('details[data-person="하루"]').open = true;
q('[data-act="aliasRemove"][data-alias="Haru"]').click();
await tick();
assert.match(q('[data-act="aliasRemove"][data-alias="Haru"]').textContent, /한 번 더/);
assert.equal(q('details[data-person="하루"]').open, true);
console.log('ok - names: group, model guesses, names per person');
process.exit(0);
