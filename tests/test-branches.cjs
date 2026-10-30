// node --test tests/test-branches.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-branches-'));
process.env.DATA_DIR = dir;
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const V = require('../memory-module/lib/vectors.cjs');
const service = require('../memory-module/lib/service.cjs');
const T = service._test;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

function fixture() {
  const source = L.prepareMessages(Array.from({ length: 6 }, (_, i) => ({
    id: `m${i + 1}`, number: 10 + i * 3, speaker: i % 2 ? 'Narrator' : 'User',
    role: i % 2 ? 'narrator' : 'user', content: `2026-10-${20 + i} 12:00\n${i + 1}번째 일.`,
  })));
  const ledger = L.emptyLedger();
  const evidence = { messageId: source[0].id, number: source[0].number, sentence: 1, text: '첫 약속' };
  for (let i = 0; i < 6; i += 2) {
    L.beginBatch(ledger, i);
    if (!i) {
      ledger.nextId = 2;
      ledger.threads.push({ id: 'T1', kind: 'promise', title: '약속', who: '도윤', toward: null, detail: null, status: 'open', openedAt: { ...evidence }, evidence: [{ ...evidence }], clues: [], edited: true });
      ledger.routine = [{ who: '도윤', what: 'sleep', text: '잠', number: source[0].number }];
    }
    if (i === 4) {
      ledger.threads[0].status = 'closed';
      ledger.threads[0].closed = { evidence: [{ messageId: 'm5', number: source[4].number, text: '나중에 지킨 약속' }] };
      ledger.routine.push({ who: '도윤', what: 'sleep', text: '미래 수면', number: source[4].number });
    }
    L.commitBatch(ledger, source.slice(i, i + 2));
  }
  const scenes = S.emptyStore();
  scenes.scenes = [0, 2, 4].map((i, j) => ({
    id: `S${j + 1}`, start: source[i].number, end: source[i + 1].number,
    messages: source.slice(i, i + 2).map((m) => ({ id: m.id, h: m.h })),
    title: `장면${j + 1}`, summary: '직접 수정한 기억', events: [{ text: '사건', quotes: [{ ...evidence, messageId: source[i].id, number: source[i].number }] }],
    recollections: [], present: [], heardLater: [], edited: true,
  }));
  scenes.covered = scenes.scenes.flatMap((s) => s.messages);
  scenes.nextScene = 4; scenes.nextFact = 3;
  scenes.facts = [
    { id: 'F1', text: '비밀', sceneId: 'S1', evidence: [{ ...evidence }], unaware: ['도윤'], replacedBy: 'F2' },
    { id: 'F2', text: '미래 사실', sceneId: 'S3', evidence: [{ ...evidence, number: source[4].number, messageId: 'm5' }], unaware: [] },
  ];
  S.setKnowing(scenes.facts[0], '도윤', 'S3', { unaware: false });
  scenes.scenes[0].later = [{ what: '미래 폭로', in: 'S3' }];
  scenes.scenes[0].heardLater = [{ who: '도윤', in: 'S3' }];
  scenes.chapters = [{ id: 'C1', scenes: ['S1'], start: source[0].number, end: source[1].number, title: '첫 챕터', edited: true }, { id: 'C2', scenes: ['S2', 'S3'], start: source[2].number, end: source[5].number, title: '미래 챕터' }];
  scenes.arcs = [{ id: 'A1', chapters: ['C1', 'C2'], title: '미래 큰 흐름' }];
  scenes.window = { size: 30, firstInside: 10 };
  return { source, ledger, scenes };
}
function fork(f, count = 6) {
  const target = f.source.slice(0, count).map((m, i) => ({ ...structuredClone(m), id: `b${i + 1}`, number: 100 + i * 5 }));
  const ids = new Map(f.source.slice(0, count).map((m, i) => [m.id, target[i].id]));
  return { target, ids };
}

test('full branch keeps hand edits, summaries, knowledge and rollback history, remapping every source reference', () => {
  const f = fixture(), { target, ids } = fork(f);
  const before = JSON.stringify(f);
  const out = T.branchMemory(f.ledger, f.scenes, f.source, target, ids);
  assert.equal(out.matched, 6);
  assert.equal(out.ledgerReset, false);
  assert.equal(out.ledger.threads[0].edited, true);
  assert.equal(out.ledger.threads[0].evidence[0].messageId, 'b1');
  assert.equal(out.ledger.threads[0].closed.evidence[0].number, 120);
  assert.equal(out.ledger.lastNumber, 125);
  assert.equal(out.scenes.chapters[0].start, 100);
  assert.equal(out.scenes.scenes[0].events[0].quotes[0].number, 100);
  assert.equal(L.reconcile(out.ledger, target).rolledBack, false);
  assert.equal(S.changedAt(out.scenes, target), -1);
  assert.deepEqual(out.scenes.facts[0].unaware, []);
  assert.equal(out.scenes.window, null);
  assert.equal(JSON.stringify(f), before, 'original never changed');
  target[4].h = 'changed in branch';
  assert.equal(L.reconcile(out.ledger, target).rolledBack, true);
  assert.equal(out.ledger.threads[0].status, 'open', 'copied undo snapshots remain usable');
  assert.equal(out.ledger.threads[0].evidence[0].messageId, 'b1');
  assert.equal(f.ledger.threads[0].status, 'closed', 'source stays independent');
});

test('past fork excludes later events, closures, daily life, revelations, knowledge, chapters and arcs', () => {
  const f = fixture(), { target, ids } = fork(f, 4);
  const before = JSON.stringify(f);
  const out = T.branchMemory(f.ledger, f.scenes, f.source, target, ids);
  assert.equal(out.ledger.threads[0].status, 'open');
  assert.equal(out.ledger.routine.length, 1);
  assert.equal(out.ledger.storyDate, '2026-10-23');
  assert.equal(out.ledger.lastNumber, 115);
  assert.deepEqual(out.scenes.scenes.map((s) => s.id), ['S1', 'S2']);
  assert.deepEqual(out.scenes.facts.map((f) => f.id), ['F1']);
  assert.deepEqual(out.scenes.facts[0].unaware, ['도윤']);
  assert.equal(out.scenes.facts[0].replacedBy, undefined);
  assert.deepEqual(out.scenes.scenes[0].later, []);
  assert.deepEqual(out.scenes.scenes[0].heardLater, []);
  assert.deepEqual(out.scenes.chapters.map((c) => c.id), ['C1']);
  assert.deepEqual(out.scenes.arcs, []);
  assert.equal(JSON.stringify(f), before);
  assert.equal(S.changedAt(out.scenes, target), -1);
});

test('fork through a scene/batch keeps only whole verified units and leaves the tail to be read', () => {
  const f = fixture(), { target, ids } = fork(f, 3);
  const out = T.branchMemory(f.ledger, f.scenes, f.source, target, ids);
  assert.equal(out.scenes.covered.length, 2);
  assert.equal(out.ledger.processed.length, 2);
  assert.equal(L.reconcile(out.ledger, target).from, 2);
  assert.equal(out.scenes.scenes[0].edited, true);
});

test('missing old undo history re-reads the ledger, never carries a future closure', () => {
  const f = fixture(), { target, ids } = fork(f, 2);
  f.ledger.batches = f.ledger.batches.filter((b) => b.start >= 4);
  const out = T.branchMemory(f.ledger, f.scenes, f.source, target, ids);
  assert.equal(out.ledgerReset, true);
  assert.deepEqual(out.ledger.threads, []);
  assert.deepEqual(out.ledger.processed, []);
  assert.equal(out.scenes.scenes.length, 1, 'old scenes do not depend on bounded ledger undo history');
});

test('changed text, hidden messages, speaker, or tracker stops inheritance at the verified common prefix', () => {
  for (const kind of ['text', 'hidden', 'speaker', 'tracker']) {
    const f = fixture(), { target, ids } = fork(f);
    if (kind === 'text') target[2].h = 'different';
    if (kind === 'hidden') target.splice(2, 1);
    if (kind === 'speaker') target[2].speaker = 'Other';
    if (kind === 'tracker') { f.source[2].c = 't2:old'; target[2].c = 't2:new'; }
    const out = T.branchMemory(f.ledger, f.scenes, f.source, target, ids);
    assert.equal(out.matched, 2, kind);
    assert.equal(out.scenes.scenes.length, 1, kind);
    assert.equal(out.ledger.processed.length, 2, kind);
  }
});

test('branching a branch remaps the already inherited IDs again, with no source references left', () => {
  const f = fixture(), first = fork(f);
  const once = T.branchMemory(f.ledger, f.scenes, f.source, first.target, first.ids);
  const target = first.target.slice(0, 4).map((m, i) => ({ ...m, id: `c${i}`, number: 300 + i * 7 }));
  const ids = new Map(first.target.slice(0, 4).map((m, i) => [m.id, target[i].id]));
  const twice = T.branchMemory(once.ledger, once.scenes, first.target, target, ids);
  assert.equal(twice.ledger.threads[0].evidence[0].messageId, 'c0');
  assert.equal(twice.scenes.scenes[1].end, 321);
  assert.equal(L.reconcile(twice.ledger, target).rolledBack, false);
  assert.equal(S.changedAt(twice.scenes, target), -1);
  assert.equal(once.ledger.threads[0].status, 'closed');
  assert.equal(twice.ledger.threads[0].status, 'open');
});

test('empty branch has no inherited events and a parent without memory has nothing to copy', () => {
  const f = fixture();
  const empty = T.branchMemory(f.ledger, f.scenes, f.source, [], new Map());
  assert.deepEqual(empty.ledger.threads, []);
  assert.deepEqual(empty.scenes.scenes, []);
  assert.deepEqual(empty.scenes.facts, []);
  const absent = T.branchMemory(null, null, [], [], new Map());
  assert.equal(absent.ledger, null);
  assert.equal(absent.scenes, null);
});

function mockEngine(f, targetId, count) {
  const rows = (msgs) => msgs.map((m) => ({ id: m.id, rowid: m.number, role: m.role, content: m.content, extra: '{}', activeSwipeIndex: 0, characterId: null }));
  const { target } = fork(f, count);
  const chats = new Map([['parent', rows(f.source)], [targetId, rows(target)]]);
  return { chats: { listMessages: async (id) => chats.get(id) || [], getById: async () => ({ metadata: '{}' }) } };
}

test('service copies files/settings/vectors before successful branch response; independent and idempotent', async () => {
  const f = fixture();
  T.setEngine(mockEngine(f, 'child', 4));
  T.saveLedger('parent', f.ledger); T.saveScenes('parent', f.scenes);
  T.saveSettings({ connection: 'keep-global', chats: { parent: { enabled: true, speakerTags: true }, unrelated: { enabled: false } } });
  const vectors = V.emptyIndex('example');
  V.putVectors(vectors, f.scenes.scenes.flatMap(V.sceneDocs), f.scenes.scenes.flatMap(V.sceneDocs).map(() => [1, 0]));
  const chatDir = path.join(dir, 'memory-module/chats');
  fs.writeFileSync(path.join(chatDir, 'parent.vectors.json'), JSON.stringify(vectors));
  const sourceBytes = fs.readFileSync(path.join(chatDir, 'parent.json'), 'utf8');
  const payload = JSON.stringify({ id: 'child', name: '분기' });
  assert.equal(await T.branchOnSend({ method: 'POST', raw: { url: '/api/chats/parent/branch?x=1' } }, { statusCode: 200 }, payload), payload);
  assert.equal(T.loadLedger('child').processed.length, 4);
  assert.equal(T.loadScenes('child').scenes.length, 2);
  assert.deepEqual(T.settings().chats.child, { enabled: true, speakerTags: true });
  assert.equal(T.settings().connection, 'keep-global');
  assert.deepEqual(T.settings().chats.unrelated, { enabled: false });
  const copied = JSON.parse(fs.readFileSync(path.join(chatDir, 'child.vectors.json')));
  assert.ok(Object.keys(copied.items).length);
  assert.ok(Object.keys(copied.items).every((key) => !key.startsWith('S3')));
  assert.equal(fs.readFileSync(path.join(chatDir, 'parent.json'), 'utf8'), sourceBytes);
  T.loadLedger('child').threads[0].title = '독립 수정';
  assert.equal((await T.inheritBranch('parent', 'child')).skipped, true);
  assert.equal(T.loadLedger('child').threads[0].title, '독립 수정');
  assert.equal(T.loadLedger('parent').threads[0].title, '약속');
});

test('failed/unrelated branch requests and corrupt destinations remain untouched', async () => {
  const payload = JSON.stringify({ id: 'never' });
  for (const [method, url, statusCode] of [['POST', '/api/chats/parent/branch', 500], ['GET', '/api/chats/parent/branch', 200], ['POST', '/api/chats/parent', 200]]) {
    assert.equal(await T.branchOnSend({ method, raw: { url } }, { statusCode }, payload), payload);
  }
  assert.equal(T.loadLedger('never'), null);
  const file = path.join(dir, 'memory-module/chats/broken.json');
  fs.writeFileSync(file, '{bad');
  assert.equal((await T.inheritBranch('parent', 'broken')).skipped, true);
  assert.equal(fs.readFileSync(file, 'utf8'), '{bad');
});

let Fastify;
try { Fastify = require('fastify'); } catch {}
test('Fastify HTTP lifecycle makes inherited memory available before the browser receives the branch', { skip: !Fastify && 'Fastify is optional; set NODE_PATH to a Marinara dependency directory' }, async () => {
  const f = fixture();
  T.setEngine(mockEngine(f, 'http-child', 4));
  const app = Fastify();
  service.attach(app);
  app.post('/api/chats/:id/branch', async () => ({ id: 'http-child' }));
  try {
    const res = await app.inject({ method: 'POST', url: '/api/chats/parent/branch' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().id, 'http-child');
    assert.equal(T.loadLedger('http-child').processed.length, 4);
    assert.equal(T.settings().chats['http-child'].enabled, true);
  } finally { await app.close(); }
});
