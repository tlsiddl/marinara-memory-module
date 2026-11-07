// node --test tests/test-attribution-mode.cjs
// 대사 확인 방식 (off | rules | default | thorough): setting resolution and persistence, each mode's model calls,
// the rules in "rules" mode, nothing in "off", upgrading later, and the screen. Invented names and lines only.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-attr-mode-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const service = require('../memory-module/lib/service.cjs');
const F = require('../memory-module/lib/features.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body, query: {} }, reply);
  return { result, error };
};
const settingsFile = path.join(dir, 'memory-module/settings.json');
const onDisk = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));

test('resolution: the default is 기본; a room follows the global unless it has its own choice', () => {
  assert.deepEqual(F.resolveAttribution({}, 'a'), { global: 'default', room: 'follow', mode: 'default' });
  assert.deepEqual(F.resolveAttribution({ attributionCheck: 'rules', chats: { a: {}, b: { attributionCheck: 'thorough' } } }, 'a'), { global: 'rules', room: 'follow', mode: 'rules' });
  assert.equal(F.resolveAttribution({ attributionCheck: 'rules', chats: { b: { attributionCheck: 'thorough' } } }, 'b').mode, 'thorough');
  assert.equal(F.resolveAttribution({ attributionCheck: 'bogus', chats: { c: { attributionCheck: 'nonsense' } } }, 'c').mode, 'default', 'unknown values follow the default');
  assert.deepEqual(F.ATTRIBUTION_MODES, ['off', 'rules', 'default', 'thorough']);
});

test('routes persist the global default and the room choice; bad input is refused; other settings stay', async () => {
  X.saveSettings({ connection: 'c', recall: 'fast', chats: { r1: { organize: { npcCoverage: 'standard', quoteMode: 'dialogue', detailLevel: 'standard' } } } });
  assert.deepEqual((await call('POST /settings/attribution-check', null, { mode: 'rules' })).result.attributionCheck, { global: 'rules', room: 'follow', mode: 'rules' });
  assert.equal(onDisk().attributionCheck, 'rules');
  assert.equal(onDisk().recall, 'fast');
  assert.equal(X.attributionSetting('r1').mode, 'rules');
  assert.deepEqual((await call('POST /chats/:id/attribution-check', 'r1', { mode: 'off' })).result.attributionCheck, { global: 'rules', room: 'off', mode: 'off' });
  assert.equal(onDisk().chats.r1.attributionCheck, 'off');
  assert.equal(onDisk().chats.r1.organize.quoteMode, 'dialogue', 'the room\'s other settings are kept');
  assert.equal(X.attributionSetting('other').mode, 'rules');
  // an explicit 기본 in a room differs from following a global that is not 기본
  assert.equal((await call('POST /chats/:id/attribution-check', 'r1', { mode: 'default' })).result.attributionCheck.mode, 'default');
  assert.equal((await call('POST /chats/:id/attribution-check', 'r1', { mode: 'follow' })).result.attributionCheck.mode, 'rules');
  assert.equal('attributionCheck' in onDisk().chats.r1, false, 'following stores nothing');
  assert.match((await call('POST /settings/attribution-check', null, { mode: 'follow' })).error, /off, rules, default, thorough/);
  assert.match((await call('POST /chats/:id/attribution-check', 'r1', { mode: 'maybe' })).error, /follow/);
  assert.match((await call('POST /chats/:id/attribution-check', '../x', { mode: 'off' })).error, /invalid chat id/);
  await call('POST /settings/attribution-check', null, { mode: 'default' });
});

// ---- model calls per mode ----
const PERSONA = '하담';
const SETTLED = '"Tommaso, vieni qui."';
const APOLOGY = '"Signor Rossi, mi perdoni!"';
const THANKS = '"Grazie."';
const messages = [
  { id: 'm1', number: 1, role: 'assistant', sentences: [`${PERSONA} | ${SETTLED}`, '그는 걸음을 멈췄다.', APOLOGY, '홀 안이 조용해졌다.', 'Tommaso lowered his head.'] },
  { id: 'm2', number: 2, role: 'assistant', sentences: ['Rossi smiled.', THANKS, '그가 웃었다.'] },
];
const setUp = (chat, mode) => {
  const quotes = [
    { number: 1, sentence: 1, messageId: 'm1', text: SETTLED, by: PERSONA, to: 'Tommaso' },
    { number: 1, sentence: 3, messageId: 'm1', text: APOLOGY, by: null, to: null },
    { number: 2, sentence: 2, messageId: 'm2', text: THANKS, by: 'Tommaso', to: null },
  ];
  X.saveScenes(chat, { ...S.emptyStore(), personas: [PERSONA], cast: ['Tommaso', 'Rossi'], scenes: [{ id: 'S1', start: 1, end: 2, events: [{ text: '사과', quotes }], present: [PERSONA, 'Tommaso', 'Rossi'] }] });
  const all = X.settings();
  all.chats = { ...(all.chats || {}), [chat]: { ...(all.chats?.[chat] || {}), attributionCheck: mode } };
  X.saveSettings(all);
  return X.loadScenes(chat);
};
const quotesOf = (chat) => X.loadScenes(chat).scenes[0].events[0].quotes;
// A model that answers every asked line with the speaker the narration shows; counts calls and lines asked.
const makeModel = (log) => async () => ({ provider: { chatComplete: async (prompt) => {
  const input = JSON.parse(prompt[1].content);
  log.push({ second: /한 번 더 확인/.test(prompt[0].content), n: input.items.length });
  return { content: JSON.stringify({ items: input.items.map((x) => ({ id: x.id, by: 'Tommaso', to: ['Rossi'], byEvidence: 'Tommaso lowered his head.', toEvidence: APOLOGY })) }) };
} } });
const review = (chat, log) => X.reviewAttributions(chat, X.loadScenes(chat), messages, makeModel(log), { cancel: false }, 'resume');

test('끄기: no rules, no model, nothing changed or recorded', async () => {
  setUp('room-off', 'off');
  const log = [];
  assert.equal(await review('room-off', log), 0);
  assert.equal(log.length, 0);
  const q = quotesOf('room-off');
  assert.deepEqual(q.map((x) => [x.by, x.to]), [[PERSONA, 'Tommaso'], [null, null], ['Tommaso', null]], 'values stay as the organizing model wrote them (the vocative rule did not run)');
  assert.ok(q.every((x) => !x.attributionFp && !x.toGuess));
  assert.equal(X.loadAttributionLog('room-off').runs.length, 0);
});

test('규칙만: the rules run and a guess may fill a listener, but the model is never called and nothing is stamped', async () => {
  setUp('room-rules', 'rules');
  const log = [];
  assert.equal(await review('room-rules', log), 0);
  assert.equal(log.length, 0);
  const q = quotesOf('room-rules');
  assert.equal(q[1].to, 'Rossi', 'the vocative rule made the called person the listener');
  assert.equal(q[1].by, null, 'no model: no speaker was invented');
  assert.ok(q[2].to && q[2].to.includes('Rossi'), 'a listener was guessed from the people nearby');
  assert.equal(q[2].toGuess, true, 'and marked as a guess');
  assert.ok(q[0].attributionFp, 'a line the rules settle is recorded as settled');
  assert.ok(!q[1].attributionFp && !q[2].attributionFp, 'lines only the rules touched are not recorded as model-checked');
  const run = X.loadAttributionLog('room-rules').runs[0];
  assert.equal(run.mode, 'rules');
  assert.ok(run.entries.some((e) => e.rule === '추정한 상대'));
  assert.equal(await review('room-rules', log), 0);
  assert.equal(log.length, 0);
});

test('기본: the model is asked only about the lines the rules did not settle, once', async () => {
  setUp('room-default', 'default');
  const log = [];
  const calls = await review('room-default', log);
  assert.ok(calls >= 1);
  assert.equal(log.filter((c) => c.second).length, 0, 'no second ask while the answers raise no flag');
  assert.ok(log[0].n <= 2, 'the settled line was not sent');
  const q = quotesOf('room-default');
  assert.equal(q[1].by, 'Tommaso');
  assert.ok(q.every((x) => x.attributionFp));
  assert.equal(X.loadAttributionLog('room-default').runs[0].mode, 'default');
});

test('꼼꼼히: every reviewed group is asked a second time; the number of calls stays bounded', async () => {
  setUp('room-thorough', 'thorough');
  const log = [];
  const calls = await review('room-thorough', log);
  assert.equal(calls, 2, 'one group: one first and one second ask');
  assert.equal(log.length, 2);
  assert.equal(log[1].second, true);
  assert.equal(log[1].n, log[0].n, 'every line of the group is asked again, flagged or not');
  assert.ok(quotesOf('room-thorough').every((x) => x.attributionFp));
  assert.equal(await review('room-thorough', log), 0, 'checked lines are not asked again');
});

test('switching modes never wipes values; going from 규칙만 to 기본 reviews only the lines no model has checked', async () => {
  setUp('room-up', 'rules');
  const log = [];
  await review('room-up', log);
  const afterRules = quotesOf('room-up').map((x) => [x.by, x.to, !!x.toGuess]);
  assert.equal(log.length, 0);
  await call('POST /chats/:id/attribution-check', 'room-up', { mode: 'off' });
  await review('room-up', log);
  assert.deepEqual(quotesOf('room-up').map((x) => [x.by, x.to, !!x.toGuess]), afterRules);
  assert.equal(log.length, 0);
  await call('POST /chats/:id/attribution-check', 'room-up', { mode: 'default' });
  const calls = await review('room-up', log);
  assert.ok(calls >= 1);
  assert.equal(log[0].n, 2, 'the settled first line is not sent, the other two (rules-only) are');
  const q = quotesOf('room-up');
  assert.ok(q.every((x) => x.attributionFp), 'now model-checked');
  assert.equal(q[0].by, PERSONA, 'the settled line is untouched');
  const before = log.length;
  assert.equal(await review('room-up', log), 0);
  assert.equal(log.length, before);
  const kept = q.map((x) => [x.by, x.to]);
  await call('POST /chats/:id/attribution-check', 'room-up', { mode: 'rules' });
  await review('room-up', log);
  assert.deepEqual(quotesOf('room-up').map((x) => [x.by, x.to]), kept, 'downgrading keeps what the model wrote');
});

test('the room data carries the mode, and the overview shows it in the check record header', async (t) => {
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
  const run = { at: '2026-01-02T03:04:05.000Z', reason: 'resume', mode: 'rules', notes: [], entries: [], counts: { total: 3, skipped: 0, settled: 1, reviewed: 0, second: 0, calls: 0 } };
  const room = { enabled: true, threadStats: { open: 0, emotion: 0, promise: 0 }, scenes: { count: 1 }, job: { state: 'done' }, sceneJob: { state: 'done' }, attributionRuns: 1, attributionStamp: 'a', attributionCheck: { global: 'thorough', room: 'rules', mode: 'rules' } };
  const elements = new Map();
  const document = { createElement() { const e = new Element(); e.attachShadow = () => (e.shadowRoot = new Shadow(e)); return e; }, getElementById(id) { return elements.get(id) || null; }, body: { append(e) { elements.set(e.id, e); } }, head: { append(e) { elements.set(e.id, e); } }, addEventListener() {}, removeEventListener() {} };
  let cleanup;
  t.after(() => cleanup?.());
  const fetch = async (url) => ({ ok: true, status: 200, text: async () => JSON.stringify(url.endsWith('/chats') ? [{ id: 'room', name: '시험 방', enabled: true }] : url.endsWith('/attribution-log') ? { runs: [run] } : room) });
  const storage = { getItem: (k) => (k === 'marinara-active-chat-id' ? 'room' : null), setItem() {}, removeItem() {} };
  const context = { window: { matchMedia: () => ({ matches: false }), dispatchEvent() {} }, document, fetch, localStorage: storage, marinara: { onCleanup: (fn) => { cleanup = fn; } }, addEventListener() {}, CustomEvent: class {}, setTimeout, clearTimeout, innerWidth: 390, innerHeight: 844, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../deliverable/extension.js'), 'utf8'), context);
  const root = elements.get('memory-module-library').shadowRoot;
  const launcher = elements.get('memory-module-launcher');
  launcher.dataset.exdHidden = '';
  launcher.click();
  const content = root.querySelector('#content');
  for (let i = 0; i < 100 && !String(content.innerHTML || '').includes('대사 확인 기록'); i++) await new Promise((r) => setTimeout(r, 10));
  assert.match(content.innerHTML, /대사 확인 기록 \(1회\) · 확인 방식: 규칙만/);
  root.querySelector('#close').onclick();
});

test('the room info route reports the mode', async () => {
  X.saveSettings({ connection: null, attributionCheck: 'thorough', chats: { rx: { attributionCheck: 'off' } } });
  assert.deepEqual(X.attributionSetting('rx'), { global: 'thorough', room: 'off', mode: 'off' });
  assert.deepEqual(X.attributionSetting('ry'), { global: 'thorough', room: 'follow', mode: 'thorough' });
});

test('the built screen offers the four options with their cost hints, globally and per room', () => {
  const js = fs.readFileSync(path.join(__dirname, '../deliverable/extension.js'), 'utf8');
  for (const word of ['대사 확인 방식', '모델 호출 없음, 정리 모델이 적은 값 그대로', '모델 호출 없음, 이름 부름·앞 대사·호칭 규칙으로 고침', '장면마다 1~2번, 애매한 대사만 물어봄, 추천', '장면마다 2~4번, 한 번 더 확인', 'setAttributionCheck', 'data-attribution-room', '기본값 따름']) assert.ok(js.includes(word), word);
});
