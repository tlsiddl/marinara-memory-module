'use strict';
// Hand edits through the scene route are marked as the user's, and the dialogue check record is shown on the
// overview while no job runs. Invented names and lines only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-attr-ui-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const routes = new Map();
const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((m) => [m, (url, fn) => routes.set(`${m.toUpperCase()} ${url}`, fn)]));
service.attach({ register: (fn) => fn(app), addHook() {} });
const res = { status() { return this; }, send(v) { return v; }, json(v) { return v; } };

test('a speaker changed in the scene editor is marked as a hand edit and never re-checked', async () => {
  X.saveSettings({ connection: null, chats: {} });
  const lines = [{ number: 1, sentence: 1, text: '"Grazie, Nico."', by: '니코', to: null }, { number: 1, sentence: 2, text: '"Prego."', by: '니코', to: '렌조' }];
  X.saveScenes('room', { ...S.emptyStore(), scenes: [{ id: 'S1', title: '부두', summary: '', events: [{ text: '인사', quotes: lines }], present: ['니코', '렌조'] }] });
  const sent = structuredClone(lines);
  sent[0].by = '렌조'; sent[0].to = '니코';
  await routes.get('PATCH /chats/:id/scenes/:sceneId')({ params: { id: 'room', sceneId: 'S1' }, body: { events: [{ text: '인사', quotes: sent }] } }, res);
  const saved = X.loadScenes('room').scenes[0].events[0].quotes;
  assert.equal(saved[0].manual, true); assert.equal(saved[0].by, '렌조');
  assert.equal(saved[1].manual, undefined, 'an untouched line is not marked');
  saved.forEach((q) => delete q.attributionChecked);
  X.loadScenes('room').scenes[0].edited = false;
  const candidates = S.attributionCandidates(X.loadScenes('room'), [{ id: 'm1', number: 1, sentences: ['"Grazie, Nico."', '"Prego."'] }], 20, new Set(), { retryUnresolved: true });
  assert.deepEqual(candidates.map((e) => e.q.sentence), [2]);
});

class Element {
  constructor() { this.dataset = {}; this.style = { removeProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {} }; this.listeners = {}; this.hidden = false; this.scrollTop = 0; this.offsetParent = null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  setAttribute(k, v) { this[k] = v; }
  remove() {} append() {} focus() {}
  click() { const e = { target: this, stopImmediatePropagation() {}, preventDefault() {} }; for (const f of this.listeners.click || []) f(e); this.onclick?.(e); }
}
class Shadow extends Element {
  constructor(host) { super(); this.host = host; this.nodes = new Map(); }
  querySelector(s) { if (!s.startsWith('#')) return null; if (!this.nodes.has(s)) this.nodes.set(s, new Element()); return this.nodes.get(s); }
  querySelectorAll() { return []; }
}

test('the overview shows the stored dialogue check record while no job runs', async (t) => {
  const run = { at: '2026-01-02T03:04:05.000Z', reason: 'resume', notes: [], entries: [
    { scene: 'S1', number: 1, sentence: 7, before: { by: '도라', to: '파비오' }, first: { by: '도라', to: ['파비오'], byReason: 'vocative' }, second: { by: '도라', to: [], byReason: 'vocative' }, reask: { by: '파비오', to: ['도라'], byReason: 'evidence' }, violations: ['vocative-speaker'], decision: 'applied', rule: 'reask', after: { by: '파비오', to: '도라' } },
    { scene: 'S1', number: 1, sentence: 9, source: 'rule', decision: 'applied', rule: 'reply', before: { by: '렌조', to: null }, after: { by: '렌조', to: '니코' } },
  ] };
  const info = { enabled: true, threads: [], scenes: { count: 1 }, job: { state: 'done' }, sceneJob: { state: 'done' }, attributionLog: [run] };
  const elements = new Map();
  const document = {
    createElement() { const e = new Element(); e.attachShadow = () => (e.shadowRoot = new Shadow(e)); return e; },
    getElementById(id) { return elements.get(id) || null; },
    body: { append(e) { elements.set(e.id, e); } }, head: { append(e) { elements.set(e.id, e); } },
    addEventListener() {}, removeEventListener() {},
  };
  let cleanup;
  t.after(() => cleanup?.());
  const fetch = async (url) => ({ ok: true, status: 200, text: async () => JSON.stringify(url.endsWith('/chats') ? [{ id: 'room', name: '시험 방', enabled: true }] : url.includes('/scenes') ? S.emptyStore() : url.includes('/translations') ? { items: [] } : info) });
  const storage = { getItem: (k) => k === 'marinara-active-chat-id' ? 'room' : null, setItem() {}, removeItem() {} };
  const context = { window: { matchMedia: () => ({ matches: false }), dispatchEvent() {} }, document, fetch, localStorage: storage, marinara: { onCleanup: (fn) => { cleanup = fn; } }, addEventListener() {}, CustomEvent: class {}, setTimeout, clearTimeout, innerWidth: 390, innerHeight: 844, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../deliverable/extension.js'), 'utf8'), context);
  const root = elements.get('memory-module-library').shadowRoot;
  const launcher = elements.get('memory-module-launcher');
  launcher.dataset.exdHidden = '';
  launcher.click();
  const content = root.querySelector('#content');
  for (let i = 0; i < 100 && !String(content.innerHTML || '').includes('대사 확인 기록'); i++) await new Promise((r) => setTimeout(r, 10));
  assert.match(content.innerHTML, /대사 확인 기록 \(1회\)/);
  assert.match(content.innerHTML, /첫 판단: 도라 → 파비오 \(대사 안에서 불린 사람을 화자로 답함\)/);
  assert.match(content.innerHTML, /다시 물음: 파비오 → 도라/);
  assert.match(content.innerHTML, /앞 대사에 대한 대답/);
  root.querySelector('#close').onclick();
});
