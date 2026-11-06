'use strict';
// 기록 충돌 알림 (conflicts, built in): the cheap check (positives and negatives), no duplicates, the user's answers and their
// effect on the memory text, persistence, the routes, backup and room delete, and the screen. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-conflicts-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const S = require('../memory-module/lib/scenes.cjs');
const Cf = require('../memory-module/lib/conflicts.cjs');
const B = require('../memory-module/lib/backup.cjs');
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
const DOHA = '도하', IAN = '이안', SOYUL = '소율';

// ---- the check ----
const kind = (a, b) => Cf.compare(a, b)?.kind || null;

test('check: the same thing with and without a negation, different numbers, colours, sides and opposite states', () => {
  assert.equal(kind('커피를 즐겨 마신다', '커피를 즐겨 마시지 않는다'), 'negation');
  assert.equal(kind('매운 음식을 잘 먹는다', '매운 음식을 못 먹는다'), 'negation');
  assert.equal(kind('He drinks coffee at home', 'He does not drink coffee at home'), 'negation');
  assert.equal(kind('동생이 7살이다', '동생이 9살이다'), 'number');
  assert.equal(kind('7월 3일에 도서관에서 만나기로 했다', '7월 9일에 도서관에서 만나기로 했다'), 'number');
  assert.equal(kind('머리카락이 검은색이다', '머리카락이 흰색이다'), 'value');
  assert.equal(kind('The cat is black and lives in the garden', 'The cat is white and lives in the garden'), 'value');
  assert.equal(kind('왼쪽 팔에 큰 흉터가 있다', '오른쪽 팔에 큰 흉터가 있다'), 'value');
  assert.equal(kind('아버지는 살아 계신다', '아버지는 돌아가셨다'), null, 'words the check does not know are not guessed at');
  assert.equal(kind('아버지는 살아 있다', '아버지는 죽었다'), 'value');
  assert.match(Cf.compare('동생이 7살이다', '동생이 9살이다').reason, /숫자가 다름: 7살 ↔ 9살/);
  assert.match(Cf.compare('머리카락이 검은색이다', '머리카락이 흰색이다').reason, /검정 ↔ 흰색/);
});

test('check: unrelated, merely different, updated and identical facts are not conflicts', () => {
  assert.equal(kind('커피를 마신다', '차를 마시지 않는다'), null, 'different things');
  assert.equal(kind('눈이 푸른색이다', '손이 크다'), null);
  assert.equal(kind('동생이 7살이다', '어머니가 40살이다'), null, 'different people in the sentence');
  assert.equal(kind('고양이를 키운다', '강아지를 키우지 않는다'), null);
  assert.equal(kind('이제는 커피를 마시지 않는다', '커피를 즐겨 마신다'), null, 'a fact that tells of a change is an update');
  assert.equal(kind('예전에는 커피를 즐겨 마셨다', '커피를 즐겨 마시지 않는다'), null);
  assert.equal(kind('He used to drink coffee', 'He does not drink coffee'), null);
  assert.equal(kind('항구 근처에 산다', '항구 근처에 오래 산다'), null);
  assert.equal(kind('커피를 즐겨 마신다', '커피를 즐겨 마신다'), null, 'identical');
  assert.equal(kind('', '커피를 즐겨 마신다'), null);
  assert.equal(kind('동생이 7살이다', '동생이 7살이다 (확실하다)'), null, 'the same number');
  assert.equal(kind('동생이 7살이다', '동생은 키가 크다'), null, 'no number to compare');
});

// ---- the facts of a room ----
const fact = (id, about, text, extra = {}) => ({ id, about, text, sceneId: 'S1', evidence: [], unaware: [], guess: [], edited: false, ...extra });
const storeOf = (facts, over = {}) => ({ ...S.emptyStore(), cast: [DOHA, IAN, SOYUL], personas: [], facts, scenes: [{ id: 'S1', start: 1, end: 2, title: '첫 장면', summary: '요약', present: [DOHA, IAN], events: [], recollections: [] }], ...over });
const base = () => storeOf([
  fact('F1', DOHA, '커피를 즐겨 마신다'),
  fact('F2', DOHA, '커피를 즐겨 마시지 않는다'),
  fact('F3', IAN, '커피를 즐겨 마시지 않는다'),
  fact('F4', DOHA, '동생이 7살이다'),
  fact('F5', DOHA, '동생이 9살이다'),
  fact('F6', DOHA, '항구 근처에 산다'),
]);

test('detect: only facts about the same person are compared; replaced ones and explicit replacements are left out', () => {
  const found = [...Cf.detect(base()).values()].map((c) => `${c.a}-${c.b}:${c.kind}`).sort();
  assert.deepEqual(found, ['F1-F2:negation', 'F4-F5:number']);
  const s = base();
  s.facts[0].replacedBy = 'F2';
  assert.deepEqual([...Cf.detect(s).values()].map((c) => `${c.a}-${c.b}`), ['F4-F5'], 'a replaced fact is no longer a live one');
  const t = base();
  t.facts[1].replaces = 'F1';
  assert.deepEqual([...Cf.detect(t).values()].map((c) => `${c.a}-${c.b}`), ['F4-F5'], 'a fact that says it replaces the other');
  assert.equal(Cf.detect(storeOf([fact('F1', '', '커피를 즐겨 마신다'), fact('F2', '', '커피를 즐겨 마시지 않는다')])).size, 0, 'no subject, no comparison');
  assert.equal(Cf.detect(null).size, 0);
});

test('fold: new conflicts open with ids that are not reused; a second look adds no duplicates and keeps the time stamp', () => {
  const store = base();
  const file = Cf.fold(store, null, '2026-01-01T00:00:00.000Z');
  assert.equal(file.conflicts.length, 2);
  assert.deepEqual(file.conflicts.map((c) => [c.id, c.a, c.b, c.about, c.status]), [['C1', 'F1', 'F2', DOHA, 'open'], ['C2', 'F4', 'F5', DOHA, 'open']]);
  const again = Cf.fold(store, file, '2026-02-02T00:00:00.000Z');
  assert.deepEqual(again, file, 'nothing changed: the very same file, time stamp included');
  // Answered, then looked at again.
  const answered = Cf.answer(file, 'C1', 'both', '2026-03-03T00:00:00.000Z');
  assert.equal(answered.conflicts[0].status, 'both');
  assert.equal(answered.conflicts[0].answeredAt, '2026-03-03T00:00:00.000Z');
  const later = Cf.fold(store, answered);
  assert.equal(later.conflicts.length, 2, 'an answered pair is not asked again');
  assert.equal(later.conflicts[0].status, 'both');
  // A new fact that disagrees gets the next number.
  store.facts.push(fact('F7', DOHA, '고양이를 키운다'), fact('F8', DOHA, '머리카락이 검은색이다'), fact('F9', DOHA, '머리카락이 흰색이다'));
  const grown = Cf.fold(store, later);
  assert.deepEqual(grown.conflicts.map((c) => c.id), ['C1', 'C2', 'C3']);
  assert.equal(grown.conflicts[2].kind, 'value');
});

test('fold: an open conflict goes away when the facts stop disagreeing or are gone; an answered one stays while both exist', () => {
  const store = base();
  let file = Cf.fold(store, null);
  file = Cf.answer(file, 'C2', 'keepA');
  // The user fixes F2 by hand: no longer a conflict.
  store.facts[1].text = '아침에만 커피를 즐겨 마신다';
  file = Cf.fold(store, file);
  assert.deepEqual(file.conflicts.map((c) => c.id), ['C2']);
  // F5 is deleted: the answered conflict goes with it.
  store.facts = store.facts.filter((f) => f.id !== 'F5');
  assert.deepEqual(Cf.fold(store, file).conflicts, []);
  // An answered one stays even if the wording changed.
  store.facts.push(fact('F5', DOHA, '동생이 8살이다'));
  const kept = Cf.fold(store, file);
  assert.deepEqual(kept.conflicts.map((c) => c.id), ['C2']);
  assert.equal(Cf.fold(store, file).conflicts[0].status, 'keepA');
});

test('fold: at most 30 stay open', () => {
  const facts = [];
  for (let i = 0; i < 40; i++) facts.push(fact(`F${i * 2 + 1}`, `인물${i}`, '약속 장소는 도서관이다'), fact(`F${i * 2 + 2}`, `인물${i}`, '약속 장소는 도서관이 아니다'));
  const file = Cf.fold(storeOf(facts), null);
  assert.equal(file.conflicts.filter((c) => c.status === 'open').length, Cf.MAX_OPEN);
});

test('answers: five statuses, a wrong one or a missing conflict is refused', () => {
  const file = Cf.fold(base(), null);
  for (const status of Cf.STATUSES) assert.equal(Cf.answer(file, 'C1', status).conflicts[0].status, status);
  assert.equal(Cf.answer(Cf.answer(file, 'C1', 'both'), 'C1', 'open').conflicts[0].answeredAt, undefined, 'reopened');
  assert.throws(() => Cf.answer(file, 'C1', 'whatever'), /중 하나여야/);
  assert.throws(() => Cf.answer(file, 'C9', 'both'), /찾지 못했습니다/);
  assert.equal(file.conflicts[0].status, 'open', 'the file given is not changed');
});

test('hidden: keeping the earlier hides the later and the other way round; nothing else hides anything; nothing is deleted', () => {
  const store = base();
  let file = Cf.fold(store, null);
  assert.deepEqual([...Cf.hiddenIds(file, store)], [], 'open: both stay');
  file = Cf.answer(Cf.answer(file, 'C1', 'keepA'), 'C2', 'keepB');
  assert.deepEqual([...Cf.hiddenIds(file, store)].sort(), ['F2', 'F4']);
  for (const status of ['both', 'dismissed', 'open']) assert.deepEqual([...Cf.hiddenIds(Cf.answer(file, 'C1', status), store)], ['F4']);
  assert.equal(store.facts.length, 6, 'no fact was deleted');
  assert.deepEqual([...Cf.hiddenIds(file, storeOf([]))], [], 'a fact that is gone hides nothing');
  assert.deepEqual([...Cf.hiddenIds(null, store)], []);
});

test('view: open ones first, both texts and scenes, answered ones after', () => {
  const store = base();
  const file = Cf.answer(Cf.fold(store, null), 'C1', 'both');
  const v = Cf.view(file, store);
  assert.equal(v.open, 1);
  assert.deepEqual(v.conflicts.map((c) => [c.id, c.status]), [['C2', 'open'], ['C1', 'both']]);
  assert.deepEqual([v.conflicts[0].aText, v.conflicts[0].bText, v.conflicts[0].aScene], ['동생이 7살이다', '동생이 9살이다', 'S1']);
  assert.deepEqual(Cf.view(null, store), { open: 0, conflicts: [] });
});

// ---- injection ----
const memory = (text) => text.split('\n').filter((l) => l.startsWith('- '));
function seedRoom(room) {
  X.saveScenes(room, base());
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true } } });
}

test('injection: open conflicts put both facts in unchanged; the user\'s choice leaves the other out; the fact itself stays on screen and in the file', async () => {
  seedRoom('ca');
  assert.equal(X.refreshWorld('ca', X.loadScenes('ca')), true);
  const open = X.renderMemorySource('ca');
  assert.match(open, /커피를 즐겨 마신다/);
  assert.match(open, /커피를 즐겨 마시지 않는다/);
  assert.doesNotMatch(open, /이전 기록과 다름/, 'no extra wording is added to the text');
  assert.match(open, /동생이 7살이다/);
  const answer = (cid, action) => call('POST /chats/:id/conflicts/:cid', 'ca', { action }, { cid });
  await answer('C1', 'keepA');
  const kept = X.renderMemorySource('ca');
  assert.match(kept, /커피를 즐겨 마신다/);
  assert.doesNotMatch(kept.split('\n').filter((l) => l.startsWith('- 도하')).join('\n'), /마시지 않는다/);
  assert.equal(X.loadScenes('ca').facts.length, 6, 'not deleted');
});

test('injection: both / dismiss change nothing in the text; keepB leaves the earlier fact out; reopen brings it back', async () => {
  seedRoom('cb');
  X.refreshWorld('cb', X.loadScenes('cb'));
  const plain = X.renderMemorySource('cb');
  const answer = (cid, action) => call('POST /chats/:id/conflicts/:cid', 'cb', { action }, { cid });
  await answer('C1', 'both');
  await answer('C2', 'dismiss');
  assert.equal(X.renderMemorySource('cb'), plain);
  await answer('C1', 'keepB');
  const text = X.renderMemorySource('cb');
  assert.doesNotMatch(memory(text).join('\n'), /도하: 커피를 즐겨 마신다 /);
  assert.match(text, /커피를 즐겨 마시지 않는다/);
  await answer('C1', 'reopen');
  assert.equal(X.renderMemorySource('cb'), plain);
});

// ---- the service ----
test('service: no file for a room without conflicts; the file appears with the first one and its answers survive a rescan', async () => {
  X.saveScenes('cc', storeOf([fact('F1', DOHA, '커피를 즐겨 마신다'), fact('F2', DOHA, '항구 근처에 산다')]));
  X.saveSettings({ connection: null, chats: { cc: { enabled: true } } });
  assert.equal(X.refreshConflicts('cc', X.loadScenes('cc')), false);
  assert.equal(fs.existsSync(path.join(CHATS, 'cc.conflicts.json')), false);
  X.saveScenes('cc', base());
  assert.equal(X.refreshConflicts('cc', X.loadScenes('cc')), true);
  const stored = JSON.parse(fs.readFileSync(path.join(CHATS, 'cc.conflicts.json'), 'utf8'));
  assert.equal(stored.version, 1);
  assert.equal(stored.conflicts.length, 2);
  assert.equal(X.refreshConflicts('cc', X.loadScenes('cc')), false, 'a second look changes nothing');
  await call('POST /chats/:id/conflicts/:cid', 'cc', { action: 'keepA' }, { cid: 'C1' });
  X.clearRoomCaches('cc');
  assert.equal(X.loadConflicts('cc').conflicts[0].status, 'keepA', 'read back from the file');
  X.refreshConflicts('cc', X.loadScenes('cc'));
  assert.equal(X.loadConflicts('cc').conflicts[0].status, 'keepA', 'a rescan keeps the answer');
  // When the last conflict is gone the file stays (it holds the record) and is empty.
  const store = X.loadScenes('cc');
  store.facts = store.facts.filter((f) => !['F2', 'F5'].includes(f.id));
  X.saveScenes('cc', store);
  X.refreshConflicts('cc', store);
  assert.deepEqual(X.loadConflicts('cc').conflicts, []);
});

test('service: a hand edit of a fact (the facts route) rechecks right away', async () => {
  seedRoom('cd');
  X.refreshWorld('cd', X.loadScenes('cd'));
  assert.equal((await call('GET /chats/:id/conflicts', 'cd')).result.open, 2);
  const r = await call('PATCH /chats/:id/facts/:factId', 'cd', { text: '아침에만 커피를 즐겨 마신다' }, { factId: 'F2' });
  assert.ifError(r.error);
  const v = (await call('GET /chats/:id/conflicts', 'cd')).result;
  assert.equal(v.open, 1);
  assert.deepEqual(v.conflicts.map((c) => c.id), ['C2']);
  const del = await call('DELETE /chats/:id/facts/:factId', 'cd', null, { factId: 'F5' });
  assert.ifError(del.error);
  assert.equal((await call('GET /chats/:id/conflicts', 'cd')).result.open, 0);
});

test('routes: answer, refuse bad input, the room id is checked', async () => {
  seedRoom('ce');
  X.refreshWorld('ce', X.loadScenes('ce'));
  const get = (await call('GET /chats/:id/conflicts', 'ce')).result;
  assert.equal(get.open, 2);
  assert.equal(get.conflicts[0].aText, '커피를 즐겨 마신다');
  const r = await call('POST /chats/:id/conflicts/:cid', 'ce', { action: 'keepA' }, { cid: 'C1' });
  assert.equal(r.result.open, 1);
  assert.equal(r.result.conflicts.find((c) => c.id === 'C1').status, 'keepA');
  assert.match((await call('POST /chats/:id/conflicts/:cid', 'ce', { action: 'x' }, { cid: 'C1' })).error, /keepA, keepB, both, dismiss, reopen/);
  assert.match((await call('POST /chats/:id/conflicts/:cid', 'ce', { action: 'both' }, { cid: 'C99' })).error, /찾지 못했습니다/);
  assert.match((await call('GET /chats/:id/conflicts', '../x')).error, /invalid chat id/);
  // never switched off: a stored "off" is ignored
  X.saveSettings({ connection: null, chats: { ce: { enabled: true, features: { conflicts: 'off' } } }, features: { conflicts: false } });
  assert.equal((await call('GET /chats/:id/conflicts', 'ce')).result.open, 1);
});

test('backup carries the file and the restore preview counts it; a bad file is refused', async () => {
  seedRoom('cf');
  X.refreshWorld('cf', X.loadScenes('cf'));
  assert.ok(B.KEYS.includes('conflicts'));
  const { result } = await call('GET /chats/:id/backup', 'cf', null);
  assert.ok(result.backup.files.conflicts);
  assert.equal(B.counts(result.backup.files).conflicts, 2);
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(result.backup))));
  const broken = JSON.parse(JSON.stringify(result.backup));
  broken.files.conflicts = { version: 1, conflicts: 'x' };
  broken.header.fileHashes.conflicts = B.hashOf(broken.files.conflicts);
  assert.throws(() => B.validate(broken), /conflicts/);
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, cg: { enabled: true } } });
  const applied = await call('POST /chats/:id/restore/apply', 'cg', { backup: result.backup, crossRoom: true });
  assert.ifError(applied.error);
  assert.equal(X.loadConflicts('cg').conflicts.length, 2);
});

test('deleting the room removes the file and its cache; installers list the new library files', () => {
  seedRoom('ch');
  X.refreshWorld('ch', X.loadScenes('ch'));
  const file = path.join(CHATS, 'ch.conflicts.json');
  assert.ok(fs.existsSync(file));
  X.purgeChatMemory('ch');
  assert.ok(!fs.existsSync(file));
  assert.equal(X.loadConflicts('ch').conflicts.length, 0, 'the cache is cleared too');
  for (const name of ['install.sh', 'install.ps1']) {
    const text = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    for (const lib of ['knowledge', 'conflicts', 'keepsakes']) assert.match(text, new RegExp(`lib/${lib}\\.cjs`), `${name} ${lib}`);
  }
});

// ---- the screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fn = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc });
};

test('screen: a banner with the count, both facts side by side, four buttons; answered ones show the answer and "다시 열기"', () => {
  const paper = fn('conflictsPaper');
  assert.equal(paper(null, {}), '');
  assert.equal(paper({ open: 0, conflicts: [] }, {}), '');
  const c = { open: 1, conflicts: [
    { id: 'C1', a: 'F1', b: 'F2', about: DOHA, reason: '한쪽은 아니라고 함', aText: '<b>커피</b>를 마신다', bText: '커피를 안 마신다', aScene: 'S1', bScene: null, status: 'open' },
    { id: 'C2', a: 'F4', b: 'F5', about: DOHA, reason: '숫자가 다름', aText: '7살', bText: '9살', status: 'keepB' },
  ] };
  const html = paper(c, { scenes: [{ id: 'S1', title: '첫 장면' }] });
  assert.match(html, /서로 다른 기록 1건/);
  assert.match(html, /도하 · 한쪽은 아니라고 함/);
  assert.match(html, /앞 · F1 · S1 첫 장면<\/small><p>&lt;b&gt;커피&lt;\/b&gt;를 마신다<\/p>/, 'escaped, with the scene');
  assert.match(html, /뒤 · F2<\/small><p>커피를 안 마신다/);
  for (const [answer, label] of [['keepA', '앞의 것 유지'], ['keepB', '뒤의 것 유지'], ['both', '둘 다 맞음'], ['dismiss', '무시']]) assert.match(html, new RegExp(`data-id="C1" data-answer="${answer}">${label}`), answer);
  assert.match(html, /내 답: 뒤의 것을 남김 <button class="ghost" data-act="conflictAnswer" data-id="C2" data-answer="reopen">다시 열기/);
  assert.match(html, /답할 때까지는 둘 다 그대로 들어갑니다/);
  assert.match(paper({ open: 0, conflicts: [c.conflicts[1]] }, {}), /서로 다른 기록 · 모두 답함/);
});

test('screen: the facts tab loads and shows them, the answer is wired, and a fact left out says so', () => {
  assert.match(source, /\$\{conflictsPaper\(conflicts, store\)\}/);
  assert.match(source, /\/chats\/\$\{encodeURIComponent\(id\)\}\/conflicts/);
  assert.match(source, /if \(needsConflicts\(\)\) await loadConflicts\(id\)/);
  assert.match(source, /void ensureConflicts\(\)/);
  assert.match(source, /case 'conflictAnswer':/);
  assert.match(source, /conflicts\/\$\{encodeURIComponent\(id\)\}`, \{ action: answer \}/);
  assert.match(source, /기록 충돌에서 뒤로 물림\(기억 칸에서 제외\)/);
});
