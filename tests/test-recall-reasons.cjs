'use strict';
// 회상 이유 and 중요/빼기 (built in): reasons per kind as side data only (the injected text does not change), the
// effect of pinning and leaving out (and their caps), persistence, the route, backup / room delete / branch, and the
// screen. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-reasons-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const R = require('../memory-module/lib/recall.cjs');
const Rp = require('../memory-module/lib/reasons.cjs');
const Selected = require('../memory-module/lib/selected.cjs');
const B = require('../memory-module/lib/backup.cjs');
const F = require('../memory-module/lib/features.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async getById(id) { return { id, name: '방' }; } } });
service.attach(app);
const call = async (key, id, body, params = {}) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id, ...params }, body, query: {} }, reply);
  return { result, error };
};
const CHATS = path.join(dir, 'memory-module/chats');
const HARANG = '하랑', SEOYUN = '서윤', JIHO = '지호';

// ---- the fixture: eight scenes (the window starts at message 19), facts, a chapter, open threads ----
const scene = (n, title, summary, present, extra = {}) => ({
  id: `S${n}`, start: n * 3 - 2, end: n * 3, messages: [], time: `3월 ${n}일`, place: '항구', title, summary, present,
  events: [{ text: `${title} 사건`, importance: 'normal', quotes: [], with: present }], recollections: [], edited: false, ...extra,
});
const fact = (id, about, text, extra = {}) => ({ id, about, text, sceneId: 'S1', evidence: [], unaware: [], guess: [], edited: false, ...extra });
const base = () => ({
  ...S.emptyStore(),
  cast: [HARANG, SEOYUN, JIHO],
  personas: [],
  scenes: [
    scene(1, '부두의 열쇠', '하랑이 부두에서 서윤에게 놋쇠 열쇠를 맡겼다.', [HARANG, SEOYUN]),
    scene(2, '시장 소동', '지호가 시장에서 소란을 피웠다.', [JIHO]),
    scene(3, '등대 방문', '서윤이 오래된 등대를 찾아갔다.', [SEOYUN, JIHO]),
    scene(4, '비 오는 날', '셋이 처마 밑에서 비를 피했다.', [HARANG, SEOYUN, JIHO]),
    scene(5, '아침 식사', '하랑이 죽을 끓였다.', [HARANG]),
    scene(6, '편지', '서윤이 편지를 받았다.', [SEOYUN]),
    scene(7, '골목', '지호가 골목을 걸었다.', [JIHO]),
    scene(8, '귀가', '하랑과 지호가 집에 돌아왔다.', [HARANG, JIHO]),
  ],
  facts: [
    fact('F1', HARANG, '놋쇠 열쇠를 서윤에게 맡겼다'),
    fact('F2', SEOYUN, '등대 근처에서 자랐다'),
    fact('F3', JIHO, '시장 상인들과 친하다'),
  ],
  nextFact: 4,
  chapters: [{ id: 'C1', title: '첫 항구', time: '3월 1일~3월 3일', summary: '항구에 도착해 열쇠를 맡기는 이야기.', turns: [], keep: [], scenes: ['S1', 'S2', 'S3'] }],
  nextChapter: 2,
});
const threads = () => [
  { id: 'T1', kind: 'promise', title: '열쇠를 돌려주기', who: HARANG, toward: SEOYUN, detail: '다음 달에 돌려주기로 했다', status: 'open', openedAt: { number: 2 }, evidence: [{ number: 2 }], clues: [] },
  { id: 'T2', kind: 'secret', title: '등대의 비밀', who: SEOYUN, toward: null, detail: null, status: 'open', openedAt: { number: 8 }, evidence: [{ number: 8 }], clues: [] },
];
function seed(room, mutate) {
  const store = base();
  if (mutate) mutate(store);
  const ledger = L.emptyLedger();
  ledger.threads.push(...threads());
  ledger.lastNumber = 24;
  ledger.nextId = 3;
  X.saveScenes(room, store);
  X.saveLedger(room, ledger);
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true } } });
  X.windows.set(room, 19);
  X.recalls.delete(room);
  X.setSelectedQuery(room, '');
}
const prefsFile = (room) => path.join(CHATS, `${room}.recall-prefs.json`);
const onDisk = (room) => JSON.parse(fs.readFileSync(prefsFile(room), 'utf8'));
const mark = (room, id, action) => call('POST /chats/:id/recall-prefs', room, { id, action });
const section = (report, name) => report.sections.find((s) => s.section === name)?.items || [];
const kinds = (item) => item.reasons.map((r) => r.kind);

// ---- the module itself ----
test('built in: no switch, not in the registry', () => {
  assert.ok(F.BUILTIN.includes('recallReasons'));
  assert.equal(F.known('recallReasons'), false);
  assert.equal(F.resolve({ features: { recallReasons: false } }, 'a', 'recallReasons').enabled, true);
  assert.ok(!F.view({}, 'a').some((f) => f.key === 'recallReasons'));
});

test('marks: pinning and leaving out exclude each other, the same button takes it back, bad ids are refused, an old file shape is repaired', () => {
  let p = Rp.emptyPrefs();
  p = Rp.toggle(p, 'S2', 'excluded');
  assert.deepEqual(p, { version: 1, pinned: [], excluded: ['S2'] });
  p = Rp.toggle(p, 'S2', 'pinned');
  assert.deepEqual(p, { version: 1, pinned: ['S2'], excluded: [] }, 'pinning lifts it out of the left-out list');
  p = Rp.toggle(p, 'S2', 'pinned');
  assert.deepEqual(p, Rp.emptyPrefs());
  assert.throws(() => Rp.toggle(p, '../x', 'pinned'), /정할 수 없는/);
  assert.throws(() => Rp.toggle(p, 'S1', 'both'), /pinned 또는 excluded/);
  assert.deepEqual(Rp.normalize({ pinned: ['S1', 'S1', 'x', 7], excluded: ['S1', 'F2'] }), { version: 1, pinned: ['S1'], excluded: ['F2'] });
  assert.equal(Rp.kindOf('S3'), 'scene');
  assert.equal(Rp.kindOf('C1'), 'chapter');
  assert.equal(Rp.kindOf('F9'), 'fact');
  assert.equal(Rp.kindOf('T4'), 'thread');
});

test('marks: gone items drop silently, a kind that could not be read is kept, merged facts hand their mark on, a left-out chapter hides its scenes', () => {
  const store = base();
  const ledger = { threads: threads() };
  const ids = Rp.liveIds(store, ledger, S.liveFacts);
  const marks = { pinned: ['S1', 'S99', 'F2'], excluded: ['T1', 'T9', 'C1'] };
  assert.deepEqual(Rp.prune(marks, ids), { version: 1, pinned: ['S1', 'F2'], excluded: ['T1', 'C1'] });
  assert.deepEqual(Rp.prune(marks, ids, { ledger: false }).excluded, ['T1', 'T9', 'C1'], 'no ledger to check against: threads stay');
  store.facts[1].replacedBy = 'F3';
  assert.deepEqual(Rp.followMerges({ pinned: ['F2'], excluded: [] }, store).pinned, ['F3']);
  assert.deepEqual([...Rp.hiddenScenes(store, new Set(['C1', 'S5']))].sort(), ['S1', 'S2', 'S3', 'S5']);
  assert.equal(Rp.sets(marks).any, true);
  assert.equal(Rp.sets(null).any, false);
});

test('labels: short Korean text for every kind', () => {
  assert.equal(Rp.label({ kind: 'present', names: [HARANG, SEOYUN] }), `지금 장면에 ${HARANG}·${SEOYUN} 있음`);
  assert.equal(Rp.label({ kind: 'keyword', terms: ['부두'] }), '‘부두’ 언급');
  assert.equal(Rp.label({ kind: 'keyword', terms: [] }), '지금 대화와 낱말이 겹침');
  assert.equal(Rp.label({ kind: 'meaning', score: 0.713 }), '뜻이 비슷함 0.71');
  assert.equal(Rp.label({ kind: 'recent' }), '최근 장면');
  assert.equal(Rp.label({ kind: 'pinned' }), '고정');
  assert.equal(Rp.label({ kind: 'thread-open' }), '끝나지 않은 일');
  assert.equal(Rp.label({ kind: 'selected' }), '직접 선택한 기억');
  assert.equal(Rp.label({ kind: 'follow', from: 'S2' }), 'S2에 이어진 일');
  assert.equal(Rp.label({ kind: 'nonsense' }), '');
  assert.deepEqual(Rp.labelled([{ kind: 'recent' }, { kind: 'nonsense' }]), [{ kind: 'recent', label: '최근 장면' }]);
});

// ---- the text does not change ----
test('text: the memory text is the same with or without the reasons being worked out, and with marks that touch nothing', () => {
  seed('ra');
  X.recalls.set('ra', { mode: 'model', used: 'model', picks: [{ id: 'S2', why: '시장' }], semantic: [{ id: 'S3', score: 0.7134, strong: false, piece: 0 }], raw: [], at: 'x' });
  X.setSelectedQuery('ra', '부두 열쇠');
  const plain = X.renderMemorySource('ra');
  assert.match(plain, /시장 소동/);
  assert.match(plain, /뜻이 가까운 지난 사건/);
  const trace = {};
  assert.equal(X.renderMemorySource('ra', 40000, trace), plain, 'a trace changes nothing');
  X.recallReport('ra');
  assert.equal(X.renderMemorySource('ra'), plain, 'working out the report changes nothing');
  assert.doesNotMatch(plain, /고정|뜻이 비슷함|언급|끝나지 않은 일 \(/, 'no reason wording in the text');
  // marks on things that are not there (a scene inside the window, a thread that does not exist) leave the text alone
  X.saveRecallPrefs('ra', { version: 1, pinned: ['S8', 'T9'], excluded: ['S77'] });
  assert.equal(X.renderMemorySource('ra'), plain);
  X.saveRecallPrefs('ra', Rp.emptyPrefs());
  assert.equal(X.renderMemorySource('ra'), plain);
});

// ---- reasons per kind ----
test('reasons: each kind of memory in the reply says why, in short Korean labels', () => {
  seed('rb');
  X.recalls.set('rb', {
    mode: 'model', used: 'model',
    picks: [{ id: 'S1', why: '열쇠' }, { id: 'S2', why: '방금 메시지의 낱말(시장)이 이 장면에 있음' }, { id: 'S4', why: 'S1에 이어진 일', follow: true, from: 'S1' }],
    direct: { id: 'S2', hits: ['시장'] },
    semantic: [{ id: 'S1', score: 0.7134, strong: false, piece: 0 }, { id: 'S3', score: 0.6021, strong: false, piece: 0 }],
    raw: [{ number: 4, text: '(4번) 열쇠', hits: ['열쇠'] }],
    at: 'x',
  });
  X.setSelectedQuery('rb', '시장에서 열쇠 얘기를 했지');
  const text = X.renderMemorySource('rb');
  const report = X.recallReport('rb');
  const recalled = section(report, 'recalled');
  assert.deepEqual(recalled.map((i) => i.id), ['S1', 'S4', 'S2'], 'a follow-up comes right after the scene it follows');
  assert.ok(kinds(recalled[0]).includes('meaning') && kinds(recalled[0]).includes('model'), 'a model pick that is also close in meaning says both');
  assert.ok(recalled[0].reasons.some((r) => r.label === '뜻이 비슷함 0.71'));
  assert.ok(kinds(recalled[0]).includes('present'), 'the people of the scene shown now are named');
  assert.deepEqual(recalled[0].reasons.find((r) => r.kind === 'present').names, [HARANG]);
  assert.deepEqual(recalled[2].reasons.find((r) => r.kind === 'keyword').terms, ['시장']);
  assert.ok(recalled[2].reasons.some((r) => r.label === '‘시장’ 언급'));
  assert.ok(!kinds(recalled[2]).includes('model'), 'a pick found by a word is not credited to the model');
  assert.deepEqual(kinds(recalled[1]), ['follow']);
  assert.equal(recalled[1].reasons[0].label, 'S1에 이어진 일');
  // close in meaning only
  const near = section(report, 'near');
  assert.deepEqual(near.map((i) => i.id), ['S3']);
  assert.ok(near[0].reasons.some((r) => r.label === '뜻이 비슷함 0.60'));
  // raw lines, chapters, scenes in the overview, facts, open threads
  assert.deepEqual(section(report, 'raw')[0].reasons.map((r) => r.label), ['‘열쇠’ 언급']);
  assert.deepEqual(section(report, 'chapters').map((i) => i.id), ['C1']);
  assert.ok(kinds(section(report, 'chapters')[0]).includes('chapter'));
  assert.deepEqual(section(report, 'overview').map((i) => i.id).sort(), ['S4', 'S5', 'S6'], 'outside the window and not in a chapter');
  assert.ok(section(report, 'overview').every((i) => kinds(i).join() === 'recent'));
  const f1 = section(report, 'facts').find((i) => i.id === 'F1');
  assert.ok(kinds(f1).includes('present') && f1.reasons.find((r) => r.kind === 'present').names[0] === HARANG, 'a fact about someone present now');
  assert.ok(kinds(f1).includes('keyword'), 'a fact the talk touches');
  assert.deepEqual(kinds(section(report, 'facts').find((i) => i.id === 'F2')), ['fact'], 'otherwise just a known fact');
  const t1 = section(report, 'threads').find((i) => i.id === 'T1');
  assert.ok(t1.reasons.some((r) => r.label === '끝나지 않은 일'));
  assert.ok(text.includes('열쇠를 돌려주기'));
  assert.ok(report.sections.every((s) => s.items.every((i) => i.title && i.reasons.every((r) => r.label))), 'every reason has a label');
});

test('reasons: the fast pick, a back-pointing sentence, an unreasoned model pick; the meaning search needs no marks', () => {
  seed('rc');
  X.recalls.set('rc', { mode: 'fast', used: 'fast', picks: [{ id: 'S3', why: null }, { id: 'S2', why: '예전 일을 가리키는 말: "그때"' }], pointed: [{ id: 'S2', text: '그때' }], semantic: [], raw: [], at: 'x' });
  X.renderMemorySource('rc');
  const rec = section(X.recallReport('rc'), 'recalled');
  assert.deepEqual(kinds(rec.find((i) => i.id === 'S3')).filter((k) => k !== 'present'), ['keyword']);
  assert.equal(rec.find((i) => i.id === 'S3').reasons[0].label, '지금 대화와 낱말이 겹침');
  assert.ok(kinds(rec.find((i) => i.id === 'S2')).includes('pointed'));
});

// ---- 중요 / 빼기 in the text ----
test('exclude: a scene left out is not told anywhere by itself (not recalled, not near, not in the overview); the record stays', async () => {
  seed('rd');
  X.recalls.set('rd', { mode: 'model', used: 'model', picks: [{ id: 'S2', why: '시장' }, { id: 'S1', why: '열쇠' }], semantic: [{ id: 'S3', score: 0.7, strong: false, piece: 0 }], raw: [], at: 'x' });
  const before = X.renderMemorySource('rd');
  assert.match(before, /시장 소동/);
  assert.match(before, /등대 방문|서윤이 오래된 등대/);
  assert.ifError((await mark('rd', 'S2', 'exclude')).error);
  assert.ifError((await mark('rd', 'S3', 'exclude')).error);
  const text = X.renderMemorySource('rd');
  assert.doesNotMatch(text, /시장 소동/);
  assert.doesNotMatch(text, /등대 방문|서윤이 오래된 등대/);
  assert.match(text, /부두의 열쇠/, 'the other pick stays');
  assert.equal(X.loadScenes('rd').scenes.length, 8, 'never deleted');
  assert.deepEqual(onDisk('rd'), { version: 1, pinned: [], excluded: ['S2', 'S3'] });
  assert.ifError((await mark('rd', 'S2', 'exclude')).error);
  assert.ifError((await mark('rd', 'S3', 'exclude')).error);
  assert.equal(X.renderMemorySource('rd'), before, 'the same button again brings it all back, unchanged');
  // a scene on the overview list (outside the window, not chaptered) can be left out too
  assert.ifError((await mark('rd', 'S5', 'exclude')).error);
  assert.doesNotMatch(X.renderMemorySource('rd'), /죽을 끓였다/);
});

test('exclude: the recall is offered only the scenes still allowed, and a cached pick that was left out later is dropped at once', async () => {
  seed('re');
  await mark('re', 'S1', 'exclude');
  assert.deepEqual(X.recallCandidates('re', X.loadScenes('re'), 19).map((s) => s.id), ['S2', 'S3', 'S4']);
  await mark('re', 'S1', 'exclude');
  assert.deepEqual(X.recallCandidates('re', X.loadScenes('re'), 19).map((s) => s.id), ['S1', 'S2', 'S3', 'S4']);
  X.recalls.set('re', { mode: 'model', used: 'model', picks: [{ id: 'S2', why: 'x' }], semantic: [], raw: [], at: 'x' });
  assert.match(X.renderMemorySource('re'), /시장 소동/);
  await mark('re', 'S2', 'exclude');
  assert.doesNotMatch(X.renderMemorySource('re'), /시장 소동/, 'no new recall is needed');
  assert.deepEqual(X.recallCandidates('re', X.loadScenes('re'), 19).map((s) => s.id), ['S1', 'S3', 'S4']);
});

test('exclude: a chapter left out leaves its scenes out too; a facts left out stays out; a thread left out stays out', async () => {
  seed('rf');
  const plain = X.renderMemorySource('rf');
  assert.match(plain, /C1 /);
  await mark('rf', 'C1', 'exclude');
  const text = X.renderMemorySource('rf');
  assert.doesNotMatch(text, /C1 3월 1일/);
  assert.doesNotMatch(text, /첫 항구/);
  await mark('rf', 'C1', 'exclude');
  await mark('rf', 'F2', 'exclude');
  assert.doesNotMatch(X.renderMemorySource('rf'), /등대 근처에서 자랐다/);
  assert.match(X.renderMemorySource('rf'), /놋쇠 열쇠를 서윤에게 맡겼다/);
  await mark('rf', 'T1', 'exclude');
  assert.doesNotMatch(X.renderMemorySource('rf'), /열쇠를 돌려주기/);
  assert.match(X.renderMemorySource('rf'), /등대의 비밀/);
  assert.equal(X.loadScenes('rf').facts.length, 3);
  assert.equal(X.loadLedger('rf').threads.length, 2);
  await mark('rf', 'F2', 'exclude');
  await mark('rf', 'T1', 'exclude');
  assert.equal(X.renderMemorySource('rf'), plain);
});

test('exclude: a recollection chosen by hand (직접 선택한 기억) is not touched by marks', () => {
  const entry = { id: 'sel1', title: '선택한 장면', summary: '직접 고른 열쇠 이야기', parts: [{ text: '열쇠를 맡겼다' }], stale: false };
  const picked = [];
  const text = Selected.render([entry], '열쇠 이야기', 2500, picked);
  assert.match(text, /직접 고른 열쇠 이야기/);
  assert.deepEqual(picked, ['sel1']);
  assert.equal(Selected.render([entry], '열쇠 이야기', 2500), text, 'the trace changes nothing');
});

test('pin: a pinned scene is recalled first, in full, even when the recall did not pick it; it wins the usual number', async () => {
  seed('rg');
  X.recalls.set('rg', { mode: 'model', used: 'model', picks: [{ id: 'S2', why: 'a' }, { id: 'S3', why: 'b' }, { id: 'S4', why: 'c' }, { id: 'S5', why: 'd' }], semantic: [], raw: [], at: 'x' });
  const before = X.renderMemorySource('rg');
  // The first scene's head line (a "(C1 시기)" line naming its chapter may come before it).
  const first = (t) => t.split('[지금 떠오르는 지난 장면]\n')[1]?.split('\n').find((l) => !/^\(C\d+ 시기\)$/.test(l));
  assert.match(first(before), /S2 .* — 시장 소동$/);
  assert.deepEqual(section(X.recallReport('rg'), 'recalled').map((i) => i.id), ['S2', 'S3', 'S4', 'S5']);
  // the scenes shown: four (the usual number); a pinned one takes the first place and pushes the last one out
  await mark('rg', 'S1', 'pin');
  const text = X.renderMemorySource('rg');
  assert.match(first(text), /S1 .* — 부두의 열쇠$/, 'pinned first');
  const report = X.recallReport('rg');
  const rec = section(report, 'recalled');
  assert.equal(rec[0].pinned, true);
  assert.equal(rec[0].reasons[0].label, '고정');
  assert.deepEqual(rec.map((i) => i.id), ['S1', 'S2', 'S3', 'S4'], 'within the usual number: the last pick made room');
  // pinned without being picked
  seed('rg2');
  X.recalls.set('rg2', { mode: 'model', used: 'model', picks: [{ id: 'S2', why: 'a' }], semantic: [], raw: [], at: 'x' });
  await mark('rg2', 'S4', 'pin');
  const text2 = X.renderMemorySource('rg2');
  assert.match(first(text2), /S4 .* — 비 오는 날$/);
  assert.match(text2, /S2 .* — 시장 소동\n/);
  // pinned scenes are not offered to the recall again (they come anyway)
  assert.ok(!X.recallCandidates('rg2', X.loadScenes('rg2'), 19).some((s) => s.id === 'S4'));
  // a pinned scene inside a left-out chapter still comes
  await mark('rg2', 'C1', 'exclude');
  await mark('rg2', 'S1', 'pin');
  assert.match(X.renderMemorySource('rg2'), /부두의 열쇠/);
});

test('pin: within the size cap the pinned scene is the one kept; a scene that does not fit is left out, as before', async () => {
  seed('rh', (st) => { st.scenes[0].summary = '긴 장면 '.repeat(1500); });
  X.recalls.set('rh', { mode: 'model', used: 'model', picks: [{ id: 'S2', why: 'a' }, { id: 'S3', why: 'b' }], semantic: [], raw: [], at: 'x' });
  const text = (max) => X.renderMemorySource('rh', max);
  await mark('rh', 'S1', 'pin');
  assert.match(text(40000), /긴 장면/);
});

test('pin: facts and chapters and threads — pinned ones are told first and win a tight cap; the rest keep their order', () => {
  const store = base();
  store.facts = [
    fact('F1', HARANG, '첫 번째 사실입니다 '.repeat(5)),
    fact('F2', HARANG, '두 번째 사실입니다 '.repeat(5)),
    fact('F3', SEOYUN, '세 번째 사실입니다 '.repeat(5)),
    fact('F4', SEOYUN, '네 번째 사실입니다 '.repeat(5)),
  ];
  const lines = (opts) => S.renderScenes(store, null, { factChars: 130, ...opts }).split('[알게 된 사실]\n')[1] || '';
  const plain = lines({});
  assert.doesNotMatch(plain, /첫 번째/, 'a tight cap drops the oldest first');
  assert.match(plain, /두 번째/);
  assert.equal(lines({ pin: { facts: new Set() } }), plain, 'an empty pin changes nothing');
  const pinned = lines({ pin: { facts: new Set(['F1']) } });
  assert.match(pinned, /첫 번째 사실/, 'the pinned fact wins its place');
  assert.ok(pinned.indexOf('첫 번째') < pinned.indexOf('두 번째') || !pinned.includes('두 번째'), 'story order is kept');
  const traced = { facts: [], scenes: [], chapters: [] };
  S.renderScenes(store, null, { factChars: 130, pin: { facts: new Set(['F1']) }, trace: traced });
  assert.ok(traced.facts.includes('F1'));
  const left = lines({ factChars: 4500, hideFacts: new Set(['F4']) });
  assert.doesNotMatch(left, /네 번째/);
  // open threads: a pinned one goes first and is kept even when faded; a left-out one never goes in; the cap holds
  const ledger = L.emptyLedger();
  ledger.lastNumber = 500;
  ledger.threads.push(
    { id: 'T1', kind: 'emotion', title: '오래된 서운함', who: HARANG, toward: SEOYUN, status: 'open', openedAt: { number: 1 }, evidence: [{ number: 1 }], clues: [], need: '사과' },
    { id: 'T2', kind: 'promise', title: '두 번째 약속', who: HARANG, toward: null, detail: '곧', status: 'open', openedAt: { number: 490 }, evidence: [{ number: 490 }], clues: [] },
    { id: 'T3', kind: 'promise', title: '세 번째 약속', who: HARANG, toward: null, detail: '곧', status: 'open', openedAt: { number: 491 }, evidence: [{ number: 491 }], clues: [] },
  );
  const out = (opts) => L.renderCompact(ledger, opts);
  assert.doesNotMatch(out({}), /오래된 서운함/, 'a faded feeling is not told by itself');
  assert.match(out({ pin: new Set(['T1']) }), /^- 감정 .*오래된 서운함/m, 'pinned: told first');
  assert.equal(out({ pin: new Set() }), out({}));
  assert.doesNotMatch(out({ exclude: new Set(['T2']) }), /두 번째 약속/);
  const tight = out({ pin: new Set(['T3']), maxChars: 60 });
  assert.match(tight, /세 번째 약속/, 'within a tight cap the pinned one is the one kept');
  const seen = [];
  out({ trace: seen });
  assert.deepEqual(seen.sort(), ['T2', 'T3']);
  // a chapter inside an arc, pinned, is named on its own
  const arced = { ...S.emptyStore(), scenes: [], chapters: Array.from({ length: 6 }, (_, i) => ({ id: `C${i + 1}`, title: `챕터${i + 1}`, summary: `요약${i + 1}.`, time: null, turns: [], keep: [], scenes: [] })), arcs: [{ id: 'A1', title: '큰 흐름', summary: '앞부분', chapters: ['C1', 'C2', 'C3', 'C4'], turns: [], keep: [] }] };
  assert.doesNotMatch(S.renderChapters(arced, 4000, ''), /C2 /);
  assert.match(S.renderChapters(arced, 4000, '', null, { pin: new Set(['C2']) }), /C2 /);
  const shown = [];
  S.renderChapters(arced, 4000, '', null, { trace: shown });
  assert.ok(shown.includes('C5') && !shown.includes('C2'));
});

// ---- persistence, the route ----
test('route: pin and exclude toggle and persist; the file survives a reload; bad requests are refused and write nothing', async () => {
  seed('ri');
  assert.equal(fs.existsSync(prefsFile('ri')), false, 'no file until the first choice');
  const a = await mark('ri', 'S2', 'pin');
  assert.deepEqual(a.result.recallPrefs, { pinned: ['S2'], excluded: [] });
  await mark('ri', 'F1', 'exclude');
  await mark('ri', 'T2', 'pin');
  await mark('ri', 'C1', 'exclude');
  assert.deepEqual(onDisk('ri'), { version: 1, pinned: ['S2', 'T2'], excluded: ['F1', 'C1'] });
  X.clearRoomCaches('ri');
  assert.deepEqual(X.loadRecallPrefs('ri'), { version: 1, pinned: ['S2', 'T2'], excluded: ['F1', 'C1'] }, 'read back from the file');
  const info = (await call('GET /chats/:id', 'ri', null)).result;
  assert.deepEqual(info.recallPrefs, { pinned: ['S2', 'T2'], excluded: ['F1', 'C1'] });
  assert.ok(!('recallReport' in info), 'GET /chats/:id no longer carries the report');
  const rep = (await call('GET /chats/:id/recall-report', 'ri', null)).result;
  assert.deepEqual(rep, X.recallReport('ri'), 'the route returns the same report');
  assert.ok(Array.isArray(rep.sections));
  assert.ok((await call('GET /chats/:id/recall-report', '../x', null)).error, 'same id guard');
  assert.ok(rep.marks.some((m) => m.id === 'F1' && m.state === 'excluded' && /놋쇠/.test(m.title)), 'a left-out item can be found to undo');
  const same = JSON.stringify(onDisk('ri'));
  for (const body of [{ id: 'S2', action: 'delete' }, { id: '../x', action: 'pin' }, { id: 'S99', action: 'pin' }, { id: 'F99', action: 'exclude' }, { id: '', action: 'pin' }]) {
    assert.ok((await call('POST /chats/:id/recall-prefs', 'ri', body)).error, JSON.stringify(body));
  }
  assert.equal(JSON.stringify(onDisk('ri')), same);
  assert.ok((await call('POST /chats/:id/recall-prefs', '../x', { id: 'S1', action: 'pin' })).error);
  await mark('ri', 'S2', 'pin');
  assert.deepEqual(onDisk('ri').pinned, ['T2']);
});

test('GET /chats/:id does not render the report; the report route does (spy on the traced render)', async () => {
  seed('rs');
  const traced = [];
  const real = S.renderScenes;
  S.renderScenes = function (store, first, opts) { if (opts && opts.trace) traced.push(1); return real.apply(this, arguments); };
  try {
    await call('GET /chats/:id', 'rs', null);
    assert.equal(traced.length, 0, 'no traced (report) render inside GET /chats/:id');
    const rep = (await call('GET /chats/:id/recall-report', 'rs', null)).result;
    assert.ok(traced.length >= 1, 'the report route renders with a trace');
    assert.ok(rep.sections.length);
  } finally { S.renderScenes = real; }
});

test('persistence: ids stay when text is renamed or facts are merged; deleted items drop out on the next choice', async () => {
  seed('rj');
  await mark('rj', 'F2', 'pin');
  await mark('rj', 'S3', 'exclude');
  const store = X.loadScenes('rj');
  store.scenes[2].title = '새 이름';
  store.facts[1].text = '고쳐 쓴 사실';
  X.saveScenes('rj', store);
  assert.deepEqual(onDisk('rj'), { version: 1, pinned: ['F2'], excluded: ['S3'] }, 'a rename touches nothing');
  // F2 merged into F3: the mark follows
  const merged = X.loadScenes('rj');
  merged.facts[1].replacedBy = 'F3';
  X.saveScenes('rj', merged);
  const info = (await call('GET /chats/:id', 'rj', null)).result;
  assert.deepEqual(info.recallPrefs.pinned, ['F3']);
  // a deleted scene drops out silently with the next choice
  const gone = X.loadScenes('rj');
  gone.scenes = gone.scenes.filter((s) => s.id !== 'S3');
  X.saveScenes('rj', gone);
  assert.doesNotThrow(() => X.renderMemorySource('rj'));
  await mark('rj', 'T1', 'pin');
  assert.deepEqual(onDisk('rj'), { version: 1, pinned: ['F3', 'T1'], excluded: [] });
});

test('a broken or unknown-version file is ignored (no marks) and never overwritten by the render', () => {
  seed('rk');
  fs.writeFileSync(prefsFile('rk'), '{ broken');
  X.clearRoomCaches('rk');
  assert.deepEqual(X.loadRecallPrefs('rk'), Rp.emptyPrefs());
  assert.doesNotThrow(() => X.renderMemorySource('rk'));
  assert.equal(fs.readFileSync(prefsFile('rk'), 'utf8'), '{ broken');
});

// ---- backup, room delete, branch ----
test('backup carries the marks and the restore preview counts them; a bad file is refused', async () => {
  seed('rl');
  await mark('rl', 'S2', 'pin');
  await mark('rl', 'F1', 'exclude');
  assert.ok(B.KEYS.includes('recall-prefs'));
  const { result } = await call('GET /chats/:id/backup', 'rl', null);
  assert.deepEqual(result.backup.files['recall-prefs'], { version: 1, pinned: ['S2'], excluded: ['F1'] });
  assert.equal(B.counts(result.backup.files).recallMarks, 2);
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(result.backup))));
  const broken = JSON.parse(JSON.stringify(result.backup));
  broken.files['recall-prefs'] = { version: 1, pinned: {}, excluded: [] };
  broken.header.fileHashes['recall-prefs'] = B.hashOf(broken.files['recall-prefs']);
  assert.throws(() => B.validate(broken), /recall-prefs/);
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, rm: { enabled: true } } });
  const applied = await call('POST /chats/:id/restore/apply', 'rm', { backup: result.backup, crossRoom: true });
  assert.ifError(applied.error);
  assert.deepEqual(X.loadRecallPrefs('rm'), { version: 1, pinned: ['S2'], excluded: ['F1'] });
});

test('deleting the room removes the file and its cache', async () => {
  seed('rn');
  await mark('rn', 'S2', 'pin');
  assert.ok(fs.existsSync(prefsFile('rn')));
  X.purgeChatMemory('rn');
  assert.ok(!fs.existsSync(prefsFile('rn')));
  assert.deepEqual(X.loadRecallPrefs('rn'), Rp.emptyPrefs());
});

test('a branch copies the marks that still fit (see test-branches for the room itself)', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '../memory-module/lib/service.cjs'), 'utf8'), /sourceMarks[^]*saveRecallPrefs\(targetId/);
});

// ---- the screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const src = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  }\n', start) + 4).trim();
};
const fn = (name, deps = []) => vm.runInNewContext(`${deps.map(src).join('\n')}\n(${src(name)})`, { esc });

test('screen: the buttons show their state and name what they do; reasons sit next to each item; escaped', () => {
  const buttons = fn('markButtons');
  const idle = buttons('S2', { pinned: [], excluded: [] });
  assert.match(idle, /data-act="recallMark" data-id="S2" data-mark="pin" aria-pressed="false"[^>]*>중요<\/button>/);
  assert.match(idle, /data-mark="exclude" aria-pressed="false"[^>]*>빼기<\/button>/);
  const on = buttons('S2', { pinned: ['S2'], excluded: [] });
  assert.match(on, /data-mark="pin" aria-pressed="true"[^>]*>중요 해제<\/button>/);
  assert.match(buttons('S2', { pinned: [], excluded: ['S2'] }), /data-mark="exclude" aria-pressed="true"[^>]*>다시 넣기<\/button>/);
  assert.match(buttons('S2', undefined), />중요<\/button>/, 'no data yet: the idle buttons');
  const paper = fn('recallReasonsPaper', ['markButtons']);
  assert.equal(paper(null, {}), '');
  assert.equal(paper({ sections: [], marks: [] }, {}), '');
  const report = {
    sections: [
      { section: 'recalled', items: [{ id: 'S1', kind: 'scene', title: '부두 <열쇠>', pinned: true, reasons: [{ kind: 'pinned', label: '고정' }, { kind: 'meaning', label: '뜻이 비슷함 0.71' }, { kind: 'keyword', label: '‘부두’ 언급' }] }] },
      { section: 'threads', items: [{ id: 'T1', kind: 'thread', title: '열쇠를 돌려주기', pinned: false, reasons: [{ kind: 'thread-open', label: '끝나지 않은 일' }] }] },
      { section: 'raw', items: [{ id: null, kind: 'raw', title: '4번 메시지', pinned: false, reasons: [{ kind: 'keyword', label: '‘열쇠’ 언급' }] }] },
    ],
    marks: [{ id: 'S1', kind: 'scene', state: 'pinned', title: '부두 <열쇠>' }, { id: 'F2', kind: 'fact', state: 'excluded', title: '등대 근처에서 자랐다' }],
  };
  const html = paper(report, { pinned: ['S1'], excluded: ['F2'] });
  assert.match(html, /지금 떠오르는 지난 장면 · 1/);
  assert.match(html, /<b>부두 &lt;열쇠&gt;<\/b>/);
  for (const label of ['고정', '뜻이 비슷함 0.71', '‘부두’ 언급', '끝나지 않은 일', '‘열쇠’ 언급']) assert.ok(html.includes(`>${label}</span>`), label);
  assert.match(html, /data-id="T1" data-mark="pin"/);
  assert.doesNotMatch(html, /data-id="null"/, 'raw lines have no buttons');
  assert.match(html, /중요·뺀 항목 중 지금 들어가지 않는 것 · 1/, 'a pinned item that is shown is not listed again; a left-out one is');
  assert.match(html, /data-id="F2" data-mark="exclude" aria-pressed="true"/);
  assert.match(html, /기억 칸의 글에는 들어가지 않습니다/);
});

test('screen: the tab shows the reasons, the cards carry the buttons, the action is wired', () => {
  assert.match(source, /\$\{recallCard\(\)\}\$\{recallTestCard\(\)\}\$\{recallReasonsPaper\(recallReportRoom === room \? recallReportData : null, info\.recallPrefs,/);
  assert.doesNotMatch(source, /info\.recallReport/, 'the report is no longer part of the room info');
  // fetched only for the injection tab: when that tab's room data reloads, and when the tab is opened
  assert.equal((source.match(/\/recall-report/g) || []).length, 1, 'one fetch site');
  assert.match(source, /async function ensureRecallReport\(\) \{\n    if \(tab !== 'inject'/);
  assert.match(source, /recallReportData = null; recallReportRoom = ''; recallReportError = '';\n    if \(tab === 'inject'\) void ensureRecallReport\(\);/, 'cache dropped when the room data reloads, refetched only on that tab');
  assert.equal((source.match(/void ensureRecallReport\(\)/g) || []).length, 3, 'loadRoom, the tab click, and the room-changed retry');
  assert.match(fn('recallReasonsPaper', ['markButtons'])(null, {}, 'loading'), /왜 이 기억이 들어갔나[^]*불러오는 중…/);
  assert.match(source, /case 'recallMark':/);
  assert.match(source, /\/recall-prefs`, \{ id, action: el\.dataset\.mark \}/);
  for (const id of ['s.id', 'c.id', 'f.id', 't.id']) assert.ok(source.includes(`markButtons(${id}, info?.recallPrefs)`), id);
  assert.doesNotMatch(source, /회상 이유 보기/);
});

test('the installers list the new file', () => {
  for (const f of ['install.sh', 'install.ps1']) assert.match(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), /lib\/reasons\.cjs/, f);
});
