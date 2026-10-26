// node --test tests/test-safety.cjs
// Who knows a fact after hand edits, recall freshness after scene edits, broken memory files left untouched.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-safety-'));
process.env.DATA_DIR = dir;
const S = require('../memory-module/lib/scenes.cjs');
const { _test: T } = require('../memory-module/lib/service.cjs');

const secret = () => ({ id: 'F1', about: '서아', text: '서아는 이사를 준비 중이다', unaware: ['도윤', '하준'], evidence: [], sceneId: 'S1' });

test('fixing a fact\'s wording does not stop "who knows" from being undone with its scene', () => {
  const f = secret();
  S.setKnowing(f, '도윤', 'S2', { unaware: false });
  S.editFact(f, { text: '서아는 이사를 준비하고 있다', unaware: [...f.unaware], guess: [] });
  assert.equal(f.edited, true);
  assert.equal(f.knowSet, undefined, 'the form sent the same knowing back: nothing set by hand');
  S.undoKnowing([f], new Set(['S2']));
  assert.deepEqual(f.unaware.sort(), ['도윤', '하준'].sort(), '도윤 no longer knows once the scene is gone');
});

test('knowing set by hand stays for that person only, until a later scene changes it again', () => {
  const f = secret();
  S.setKnowing(f, '도윤', 'S2', { unaware: false });
  S.setKnowing(f, '하준', 'S2', { unaware: false });
  S.editFact(f, { unaware: ['하준'] }); // the user says 하준 does not know after all, and leaves 도윤 alone
  assert.deepEqual(f.knowSet, ['하준']);
  S.undoKnowing([f], new Set(['S2']));
  assert.deepEqual(f.unaware.sort(), ['도윤', '하준'].sort());
  const g = secret();
  S.editFact(g, { unaware: ['도윤'] }); // the user says 하준 knows
  assert.deepEqual(g.knowSet, ['하준']);
  S.setKnowing(g, '하준', 'S3', { unaware: true }); // a later scene says otherwise
  assert.equal(g.knowSet, undefined);
  S.undoKnowing([g], new Set(['S3']));
  assert.deepEqual(g.unaware, ['도윤'], 'undoing S3 goes back to what the user set');
});

test('a fact hand-edited before this version keeps the old protection; editing it now keeps the knowing it had', () => {
  const f = { ...secret(), unaware: ['하준'], knowHistory: [{ who: '도윤', in: 'S2', unaware: true, guess: false }], edited: true };
  S.undoKnowing([structuredClone(f)], new Set(['S2']));
  const kept = structuredClone(f);
  S.undoKnowing([kept], new Set(['S2']));
  assert.deepEqual(kept.unaware, ['하준'], 'old edit: what the user saw stays');
  S.editFact(f, { text: '오타 고침' });
  S.undoKnowing([f], new Set(['S2']));
  assert.deepEqual(f.unaware, ['하준'], 'whatever knowing it had then is treated as set by hand');
});

test('a scene edited a second time gives a new recall key', () => {
  const s = { id: 'S1', title: '비', summary: '우산을 씀.', events: [{ text: '도윤이 우산을 폄', quotes: [] }], recollections: [], edited: true, editedAt: 'a' };
  const first = T.recallFingerprint(s);
  s.events[0].text = '도윤이 우산을 접음';
  assert.notEqual(T.recallFingerprint(s), first, 'same id and same "edited" mark, different content');
});

test('a broken memory file is kept, reported, and never written over; a missing one is just empty', () => {
  const chats = path.join(dir, 'memory-module', 'chats');
  fs.mkdirSync(chats, { recursive: true });
  assert.equal(T.loadScenes('fresh'), null, 'no file: no memory yet, no error');
  assert.deepEqual(T.health().broken, []);
  const file = path.join(chats, 'room.scenes.json');
  fs.writeFileSync(file, '{"version": 1, "scenes": [ broken');
  assert.equal(T.loadScenes('room'), null);
  const [b] = T.health().broken;
  assert.equal(b.file, 'room.scenes.json');
  assert.ok(b.backup && fs.readFileSync(b.backup, 'utf8').includes('broken'), 'the original is copied aside');
  assert.throws(() => T.saveScenes('room', S.emptyStore()), /손상/);
  assert.throws(() => T.checkFiles('room'), /정리를 멈췄습니다/);
  assert.match(fs.readFileSync(file, 'utf8'), /broken/, 'the file itself is untouched');
  fs.unlinkSync(file);
  T.saveScenes('room', S.emptyStore());
  assert.ok(JSON.parse(fs.readFileSync(file, 'utf8')).scenes, 'once the user removes it, saving works again');
});

test('after facts are merged, undoing the scene where someone learned them undoes it on the merged fact too', () => {
  const store = S.emptyStore();
  store.scenes = [{ id: 'S1' }, { id: 'S2' }];
  store.facts = [
    { id: 'F1', about: '서아', text: '서아는 다음 달에 이사한다', unaware: ['도윤'], evidence: [], sceneId: 'S1' },
    { id: 'F2', about: '서아', text: '서아는 이사 비용을 모으고 있다', unaware: ['도윤'], evidence: [], sceneId: 'S1' },
  ];
  store.nextFact = 3;
  for (const f of store.facts) S.setKnowing(f, '도윤', 'S2', { unaware: false });
  assert.equal(S.applyFactMerge(store, '서아', store.facts.slice(), { merged: [{ text: '서아는 다음 달 이사를 앞두고 비용을 모으고 있다', from: ['F1', 'F2'] }] }), 1);
  const merged = store.facts.find((f) => f.id === 'F3');
  assert.deepEqual(merged.unaware, []);
  S.undoKnowing(store.facts, new Set(['S2']));
  assert.deepEqual(merged.unaware, ['도윤'], 'the fact that goes into replies is back to not known');
  // A merge saved by an older version (no history carried): worked out again from its sources.
  const old = structuredClone(store);
  for (const f of old.facts) S.setKnowing(f, '도윤', 'S3', { unaware: false });
  const m = old.facts.find((f) => f.id === 'F3');
  delete m.knowHistory;
  delete m.knowInherited;
  S.undoKnowing(old.facts, new Set(['S3']));
  assert.deepEqual(m.unaware, ['도윤']);
});

test('a memory file in a data version this module does not know is kept, reported and not written over', () => {
  const chats = path.join(dir, 'memory-module', 'chats');
  const file = path.join(chats, 'future.scenes.json');
  const body = JSON.stringify({ version: 2, scenes: [{ id: 'S1', title: '미래 형식' }] });
  fs.writeFileSync(file, body);
  assert.equal(T.loadScenes('future'), null);
  const b = T.health().broken.find((x) => x.file === 'future.scenes.json');
  assert.equal(b.reason, 'version');
  assert.throws(() => T.saveScenes('future', S.emptyStore()), /모르는 형식/);
  assert.equal(fs.readFileSync(file, 'utf8'), body);
});

test('exact details of old chapters still come through, those about the current talk first', () => {
  const store = S.emptyStore();
  store.chapters = Array.from({ length: 100 }, (_, i) => ({ id: `C${i + 1}`, title: `챕터 ${i + 1}`, summary: '여러 일이 있었다. '.repeat(8), turns: ['전환점'], keep: [`${i + 1}번 약속의 기한은 ${(i % 12) + 1}월 ${(i % 28) + 1}일이다`], scenes: [] }));
  store.chapters[2].keep = ['장학금 서류 마감은 3월 2일 정오, 원본 두 부 제출'];
  const plain = S.renderChapters(store, 4000);
  assert.ok(plain.length <= 4000 + 20);
  const withDetails = plain.split('\n').filter((l) => l.startsWith('  ※')).length;
  assert.ok(withDetails >= 40, `old chapters keep their details too (${withDetails})`);
  assert.doesNotMatch(plain, /장학금/, 'an old detail nobody talks about may wait');
  const asked = S.renderChapters(store, 4000, '서아: 장학금 서류 마감이 언제였지?');
  assert.match(asked, /C3 챕터 3\n {2}※ 장학금 서류 마감은 3월 2일 정오, 원본 두 부 제출/);
});

const L = require('../memory-module/lib/ledger.cjs');

test('a ledger that must be read again only gives what rests on messages before the change', () => {
  const ledger = L.emptyLedger();
  ledger.threads = [
    { id: 'T1', kind: 'promise', status: 'open', title: '바다 가기', evidence: [{ number: 3 }], clues: [] },
    { id: 'T2', kind: 'promise', status: 'open', title: '반지 맞추기', evidence: [{ number: 10 }], clues: [] },
    { id: 'T3', kind: 'pending', status: 'open', title: '빚 갚기', evidence: [{ number: 2 }], clues: [], latest: { number: 14, text: '절반 갚음' } },
  ];
  ledger.routine = [{ who: '서아', what: 'meal', number: 4 }, { who: '서아', what: 'sleep', number: 12 }];
  const part = L.verifiedBefore(ledger, 10);
  assert.deepEqual(part.threads.map((t) => t.id), ['T1'], 'the promise from the changed message and anything touched after it are out');
  assert.deepEqual(part.routine.map((r) => r.number), [4]);
  assert.match(L.renderCompact(part), /바다 가기/);
  assert.doesNotMatch(L.renderCompact(part), /반지/);
  assert.equal(L.verifiedBefore(ledger, null), null, 'no known point: nothing goes in');
});

test('editing a scene or chapter by hand takes its old summary out until it is made again', () => {
  const store = S.emptyStore();
  store.scenes = [1, 2, 3, 4].map((n) => ({ id: `S${n}`, start: n, end: n, messages: [], title: `장면 ${n}`, summary: n === 2 ? '여동생이 살아 있다.' : '일상.', events: [], recollections: [] }));
  store.chapters = [
    { id: 'C1', scenes: ['S1', 'S2'], title: '이별', summary: '여동생이 사망했다.', turns: [], keep: [] },
    { id: 'C2', scenes: ['S3', 'S4'], title: '그 뒤', summary: '조용히 지냈다.', turns: [], keep: [] },
  ];
  store.arcs = [{ id: 'A1', chapters: ['C1', 'C2'], title: '상실', summary: '여동생이 사망했다.', turns: [], keep: [] }];
  // A chapter fixed by hand: its arc is out, the fixed chapter goes in.
  store.chapters[0].summary = '여동생이 살아 있다.';
  S.markStale(store, { chapter: 'C1' });
  let text = S.renderChapters(store, 4000);
  assert.doesNotMatch(text, /사망/);
  assert.match(text, /C1 .*여동생이 살아 있다/);
  let redo = S.nextRedo(store);
  assert.equal(redo.kind, 'arc');
  S.applyRedo(store, redo, { title: '되찾음', summary: '여동생이 살아 있음을 알게 됐다.' });
  assert.equal(store.arcs[0].id, 'A1');
  assert.deepEqual(store.arcs[0].chapters, ['C1', 'C2']);
  assert.equal(store.arcs[0].stale, undefined);
  assert.match(S.renderChapters(store, 4000), /A1 .*되찾음/);
  // A scene fixed by hand: its chapter and arc are out, the scenes themselves are told.
  S.markStale(store, { scene: 'S3' });
  text = S.renderScenes(store, 99);
  assert.doesNotMatch(text, /조용히 지냈다/);
  assert.match(text, /장면 3/);
  redo = S.nextRedo(store);
  assert.equal(redo.kind, 'chapter');
  assert.deepEqual(redo.parts.map((x) => x.id), ['S3', 'S4']);
  S.applyRedo(store, redo, { title: '새 그 뒤', summary: '다시 연락했다.' });
  assert.deepEqual(store.chapters[1].scenes, ['S3', 'S4']);
  assert.equal(S.nextRedo(store).kind, 'arc', 'then the arc holding it');
});
