'use strict';
// node --test tests/test-room-parts.cjs
// 0.12.2: the room data (GET /chats/:id) no longer carries the big parts (open items with their evidence, the dialogue
// check record, the chosen memories): each has its own route, fetched only by the screen that shows it. The scene
// check compares a write stamp instead of serializing the whole store. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-parts-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async getById(id) { return { id, name: '방' }; }, async listMessages() { return []; } } });
service.attach(app);
const call = async (key, id) => handlers[key]({ params: { id }, body: {}, query: {} }, { status() { return { send: (x) => x }; } });
const CHATS = path.join(dir, 'memory-module/chats');

// ---- the scene check: a write stamp, not a copy of the store ----
const PERSONA = '하담';
const SENT = ['"Tommaso, vieni qui."', '그는 걸음을 멈췄다.', '"Signor Rossi, mi perdoni!"', '홀 안이 조용해졌다.'];
const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: SENT }];
const seed = (chat) => {
  const q = (sentence, text) => ({ number: 1, sentence, messageId: 'm1', text, by: null, to: null });
  X.saveScenes(chat, { ...S.emptyStore(), personas: [PERSONA], cast: ['Tommaso', 'Rossi'], scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '사과', quotes: [q(1, SENT[0]), q(3, SENT[2])] }], present: [PERSONA, 'Tommaso', 'Rossi'] }] });
  return X.loadScenes(chat);
};
const noAnswer = async () => ({ provider: { chatComplete: async () => { throw Error('no model'); } } });

test('the check never serializes the whole scene store to look for outside edits', async () => {
  const live = seed('room-spy');
  const real = JSON.stringify;
  let whole = 0, writes = 0;
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = function (file, ...rest) { if (String(file).includes('room-spy.scenes.json')) writes++; return realWrite.call(this, file, ...rest); };
  JSON.stringify = function (value, ...rest) { if (value === live || value === X.loadScenes('room-spy')) whole++; return real.call(this, value, ...rest); };
  try {
    await X.reviewAttributions('room-spy', live, messages, noAnswer, { cancel: false }, 'resume');
  } finally {
    JSON.stringify = real;
    fs.writeFileSync = realWrite;
  }
  assert.ok(whole <= writes, 'the store is serialized only to be saved (' + whole + ' vs ' + writes + ' saves), never for a comparison');
});

test('a stamp moves on every save, and an edit by someone else during the check still discards the answers', async () => {
  const live = seed('room-stamp');
  const answer = (input) => ({ items: input.items.map((x) => ({ id: x.id, by: 'Tommaso', to: ['Rossi'], byEvidence: SENT[0], toEvidence: SENT[2] })) });
  await X.reviewAttributions('room-stamp', live, messages, async () => ({ provider: { chatComplete: async (prompt) => {
    const edited = structuredClone(X.loadScenes('room-stamp'));
    edited.scenes[0].events[0].quotes[0] = { ...edited.scenes[0].events[0].quotes[0], by: 'Rossi', to: PERSONA, manual: true };
    X.saveScenes('room-stamp', edited);
    return { content: JSON.stringify(answer(JSON.parse(prompt[1].content))) };
  } } }), { cancel: false }, 'resume');
  const saved = X.loadScenes('room-stamp').scenes[0].events[0].quotes;
  assert.equal(saved[0].by, 'Rossi', 'the outside edit stays');
  assert.equal(saved[1].by, null, 'the answer was not saved over it');
  assert.ok(X.loadAttributionLog('room-stamp').runs[0].notes.some((n) => /확인 중 장면이 바뀌어/.test(n)));
});

// ---- the routes ----
const ledger = () => {
  const l = L.emptyLedger();
  l.threads = [
    { id: 'T1', kind: 'promise', status: 'open', title: '열쇠 돌려주기', evidence: [{ messageId: 'm1', number: 1, sentence: 1, text: '열쇠를 돌려줄게.' }], clues: [] },
    { id: 'T2', kind: 'emotion', status: 'open', title: '서운함', evidence: [], clues: [] },
    { id: 'T3', kind: 'promise', status: 'closed', title: '끝난 약속', evidence: [], clues: [] },
  ];
  return l;
};

test('GET /chats/:id leaves out the open items, the dialogue check record and the chosen memories; their routes return them', async () => {
  X.saveSettings({ connection: null, chats: {} });
  X.saveLedger('room-parts', ledger());
  X.writeJson(path.join(CHATS, 'room-parts.attribution-log.json'), { version: 1, runs: [{ at: '2026-01-02T03:04:05.000Z', reason: 'resume', notes: ['메모'], entries: [], counts: {} }] });
  X.writeJson(path.join(CHATS, 'room-parts.selected.json'), { version: 1, items: [{ id: 'sel1', title: '고른 기억', summary: '요약', parts: [{ sourceId: 'm9', text: '고른 글' }] }] });
  const info = await call('GET /chats/:id', 'room-parts');
  for (const key of ['threads', 'attributionLog', 'selectedMemories']) assert.ok(!(key in info), `${key} is not in the room data`);
  assert.deepEqual(info.threadStats, { open: 2, emotion: 1, promise: 1 });
  assert.equal(info.attributionRuns, 1);
  assert.equal(info.selectedCount, 1);
  for (const key of ['threadsStamp', 'attributionStamp', 'selectedStamp']) assert.ok(info[key], key);
  assert.ok(JSON.stringify(info).length < 20000, 'what is left is small');

  const threads = await call('GET /chats/:id/threads', 'room-parts');
  assert.deepEqual(threads.threads.map((t) => t.id), ['T1', 'T2', 'T3']);
  assert.equal(threads.threads[0].evidence[0].text, '열쇠를 돌려줄게.');
  const log = await call('GET /chats/:id/attribution-log', 'room-parts');
  assert.equal(log.runs.length, 1);
  assert.deepEqual(log.runs[0].notes, ['메모']);
  const chosen = await call('GET /chats/:id/selected-memories', 'room-parts');
  assert.deepEqual(chosen.items.map((x) => x.id), ['sel1']);
});

test('a room with none of them reports zero counts and empty lists; the stamps move when the files change', async () => {
  X.saveLedger('room-empty', L.emptyLedger());
  const info = await call('GET /chats/:id', 'room-empty');
  assert.equal(info.attributionRuns, 0);
  assert.equal(info.selectedCount, 0);
  assert.deepEqual(info.threadStats, { open: 0, emotion: 0, promise: 0 });
  assert.deepEqual((await call('GET /chats/:id/selected-memories', 'room-empty')).items, []);
  const before = (await call('GET /chats/:id', 'room-parts')).attributionStamp;
  X.writeJson(path.join(CHATS, 'room-parts.attribution-log.json'), { version: 1, runs: [] });
  const after2 = await call('GET /chats/:id', 'room-parts');
  assert.notEqual(after2.attributionStamp, before);
  assert.equal(after2.attributionRuns, 0, 'the memo follows the file');
});

// ---- the screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

test('screen: each large part has one fetch site, used only by its own screen', () => {
  for (const route of ['/threads`', 'attribution-log', 'selected-memories']) assert.equal((source.match(new RegExp(route.replace('`', '`'), 'g')) || []).length, 1, route);
  // the overview (home tab) only: the chosen memories and the record when it is unfolded
  assert.match(source, /function ensureLazyParts\(\) \{\n    if \(!info \|\| tab !== 'home'\) return;/);
  assert.match(source, /if \(info\.selectedCount > 0\) void ensureLazy\('selected', 'selected-memories', info\.selectedStamp\);/);
  assert.match(source, /openLists\.has\('attrlog'\)\)\) void ensureLazy\('attribution', 'attribution-log'/);
  // the open items: with the scenes, for the tabs that list them (not the overview, the side rail or the injection tab)
  assert.match(source, /const needsThreads = \(\) => \['scenes', 'search', 'ledger'\]\.includes\(tab\);/);
  assert.match(source, /if \(needsThreads\(\)\) await loadThreads\(id\);/);
});

test('screen: the overview and the side rail count open items from the stats, and show 불러오는 중… while a part loads', () => {
  const home = source.slice(source.indexOf('  function viewHome() {'), source.indexOf('  function viewHome() {') + 600);
  assert.match(home, /const openCount = threadStats\(\)\.open;/);
  assert.match(source, /const stats = threadStats\(\);\n    return `<div class="rail-title">/);
  assert.match(source, /<b>\$\{stats\.emotion\}<\/b>/);
  const start = source.indexOf('  function selectedMemoriesHtml() {');
  const html = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, info: { selectedCount: 2 }, lazyData: () => null, lazyError: () => '' })();
  assert.match(html, /직접 선택한 기억 · 2개[^]*불러오는 중…/);
  const done = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, info: { selectedCount: 1 }, lazyData: () => ({ items: [{ id: 's1', title: '고른', summary: '요약', parts: [{ text: '글' }] }] }), lazyError: () => '' })();
  assert.doesNotMatch(done, /불러오는 중…/);
  assert.match(done, /<summary>고른<\/summary>/);
  const none = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, info: { selectedCount: 0 }, lazyData: () => null, lazyError: () => '' })();
  assert.equal(none, '');
});

// ---- scene links: one component everywhere ----
test('screen: every scene reference uses the shared scene-link markup (ellipsized title, badge, chevron, side label)', () => {
  const shared = require('./ui-shared.cjs')(source, esc);
  const link = shared.sceneLink({ id: 'S171', title: '고래 뱃속에서 아주 긴 제목이 이어지는 장면' }, '에서 받음');
  assert.match(link, /^<span class="chip-wrap"><a href="#" class="record-link chip" data-goto-scene="S171"><span class="chip-id">S171<\/span><span class="chip-title">고래 뱃속에서[^<]*<\/span><span class="chip-arrow">›<\/span><\/a><small>에서 받음<\/small><\/span>$/);
  assert.equal(shared.sceneRef('S2', '처음', { S2: '항구' }), shared.sceneLink({ id: 'S2', title: '항구' }, '처음'), 'a reference known by its id renders through sceneLink');
  assert.equal(shared.sceneRef('', '처음', {}), '');
  assert.match(shared.sceneRefs(shared.sceneRef('S2', '', {})), /^<div class="record-links">/);
  // no screen writes its own scene anchor any more: the only data-goto-scene markup left is the shared component and the two record rows
  const hand = source.split('\n').filter((l) => l.includes('data-goto-scene='));
  assert.equal(hand.length, 3, 'sceneLink and the two record-row lists');
  // each screen goes through sceneRef / sceneLink
  for (const [fn, expect] of [['card', /sceneRef\(scene, '기준 장면', titles\)/], ['place', /sceneRef\(p\.firstSeen\?\.scene, '처음', titles\)[^]*sceneRef\(p\.lastSeen\?\.scene, '마지막', titles\)/], ['item', /sceneRef\(it\.gotAt\.scene, '처음', titles\)/], ['history', /sceneRef\(h\.scene, '', titles\)/], ['suggestions', /sceneRef\(s\.sceneId, '에서 찾음', w\.sceneTitles\)/], ['applied', /sceneRef\(x\.sceneId, '에서 받음', w\.sceneTitles\)/], ['conflict', /sceneRef\(sid, '', titles\)/], ['attribution', /\$\{sceneRef\(d\.scene, '', \{\}\)\}<strong>/], ['near', /sceneLink\(\{ id: x\.id, title: x\.title \|\| x\.id \}/]]) assert.match(source, expect, fn);
  const css = fs.readFileSync(path.join(__dirname, '../extension/ui.css'), 'utf8');
  assert.match(css, /\.chip-title\{[^}]*text-overflow:ellipsis/);
  assert.match(css, /@media\(max-width:720px\)\{\.record-links\{flex-direction:column/);
});
