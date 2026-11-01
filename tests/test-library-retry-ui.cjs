'use strict';
// Runs the shipped extension against the real translation routes with a small in-process DOM double.
// This checks behavior and rendered text, not browser layout or touch hit testing.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-ui-retry-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

class Element {
  constructor() { this.dataset = {}; this.style = { removeProperty() {} }; this.classList = { toggle() {}, add() {}, remove() {} }; this.listeners = {}; this.hidden = false; this.scrollTop = 0; this.offsetParent = null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  setAttribute(k, v) { this[k] = v; }
  remove() {}
  append() {}
  focus() {}
  click() { const e = { target: this, stopImmediatePropagation() {}, preventDefault() {} }; for (const f of this.listeners.click || []) f(e); this.onclick?.(e); }
}
class Shadow extends Element {
  constructor(host) { super(); this.host = host; this.nodes = new Map(); }
  querySelector(s) { if (!s.startsWith('#')) return null; if (!this.nodes.has(s)) this.nodes.set(s, new Element()); return this.nodes.get(s); }
  querySelectorAll() { return []; }
}

test('drawer launcher, visible error, retry, and close use the real extension and translation routes', async (t) => {
  let modelCalls = 0;
  let release;
  const model = { chatComplete: async (messages) => {
    const lines = JSON.parse(messages[1].content).lines;
    modelCalls++;
    if (modelCalls === 2) throw Error('연결 끊김 테스트');
    if (modelCalls === 3) await new Promise((resolve) => { release = resolve; });
    return { content: JSON.stringify({ lines: lines.map((x) => `번역 ${x}`) }) };
  } };
  X.setEngine({ connections: { list: async () => [{ id: 'm', name: 'm' }], getWithKey: async () => ({ model: 'fake' }) }, resolveBaseUrl: () => 'http://fake', createLLMProvider: () => model });
  X.saveSettings({ connection: 'm', writeLanguage: 'en', chats: { room: { enabled: true } } });
  X.chatLangs.set('room', 'en');
  const store = S.emptyStore();
  store.facts = Array.from({ length: 45 }, (_, i) => ({ id: `F${i}`, text: `This is English memory number ${i}.` }));
  X.saveScenes('room', store);
  const routes = new Map();
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((m) => [m, (url, fn) => routes.set(`${m.toUpperCase()} ${url}`, fn)]));
  service.attach({ register: (fn) => fn(app), addHook() {} });
  const call = async (method, route) => routes.get(`${method} ${route}`)({ params: { id: 'room' }, body: {} }, { status() { return this; }, send(v) { return v; } });
  const elements = new Map();
  const document = {
    createElement() { const e = new Element(); e.attachShadow = () => (e.shadowRoot = new Shadow(e)); return e; },
    getElementById(id) { return elements.get(id) || null; },
    body: { append(e) { elements.set(e.id, e); } }, head: { append(e) { elements.set(e.id, e); } },
    addEventListener() {}, removeEventListener() {},
  };
  let cleanup;
  t.after(() => cleanup?.());
  const info = { enabled: true, threads: [], scenes: { count: 0 }, job: { state: 'idle' }, sceneJob: { state: 'idle' }, chatLang: 'en' };
  const fetch = async (url, init) => {
    let data;
    if (url.endsWith('/translations/retry')) data = await call('POST', '/chats/:id/translations/retry');
    else if (url.endsWith('/translations')) data = await call('GET', '/chats/:id/translations');
    else if (url.endsWith('/chats')) data = [{ id: 'room', name: '시험 방', enabled: true }];
    else data = info;
    return { ok: true, status: 200, text: async () => JSON.stringify(data) };
  };
  const storage = { getItem: (k) => k === 'marinara-active-chat-id' ? 'room' : null, setItem() {}, removeItem() {} };
  const window = { matchMedia: () => ({ matches: false }), dispatchEvent() {} };
  const context = { window, document, fetch, localStorage: storage, marinara: { onCleanup: (fn) => { cleanup = fn; } }, addEventListener() {}, CustomEvent: class {}, setTimeout, clearTimeout, innerWidth: 390, innerHeight: 844, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../deliverable/extension.js'), 'utf8'), context);
  const root = elements.get('memory-module-library').shadowRoot;
  const launcher = elements.get('memory-module-launcher');
  launcher.dataset.exdHidden = '';
  launcher.click();
  const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
  for (let i = 0; i < 100 && !root.querySelector('#content').innerHTML?.includes('연결 끊김 테스트'); i++) {
    await tick();
    // Poll callback in the real extension runs every 10s. Reopening exercises its refresh without waiting.
    if (i === 3) { root.querySelector('#close').onclick(); launcher.click(); }
  }
  const content = root.querySelector('#content');
  assert.match(content.innerHTML, /한국어 번역을 마치지 못했습니다/);
  assert.match(content.innerHTML, /연결 끊김 테스트/);
  assert.match(content.innerHTML, /남은 항목: 5개/);
  assert.match(content.innerHTML, /data-act="retryTranslation"/);
  const button = { dataset: { act: 'retryTranslation' }, closest: (s) => s === 'button' ? button : null };
  for (const fn of root.listeners.click) fn({ target: button });
  for (let i = 0; i < 100 && !release; i++) await tick();
  assert.ok(release, 'retry actually reaches the translation model');
  release();
  for (let i = 0; i < 100 && X.translationLookup('room', 'ko')('This is English memory number 44.') == null; i++) await tick();
  assert.ok(X.translationLookup('room', 'ko')('This is English memory number 44.'));
  root.querySelector('#close').onclick();
  assert.equal(root.querySelector('#panel').hidden, true);
  launcher.click();
  for (let i = 0; i < 100 && content.innerHTML.includes('남은 항목: 5개'); i++) await tick();
  assert.doesNotMatch(content.innerHTML, /한국어 번역을 마치지 못했습니다/);
  assert.doesNotMatch(content.innerHTML, /남은 항목: 5개/);
  root.querySelector('#close').onclick();
  assert.equal(root.querySelector('#panel').hidden, true);
});
