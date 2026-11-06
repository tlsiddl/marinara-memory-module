'use strict';
// 호칭 사전 (addressBook): terms collected from saved dialogue, their use in the speaker/listener rules and in the
// injected memory, the routes, backup and room delete. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-address-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const Addr = require('../memory-module/lib/address.cjs');
const B = require('../memory-module/lib/backup.cjs');
const T = require('../memory-module/lib/translate.cjs');
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

const ADEL = '아델', VITO = '비토', SILVI = '실비', NERO = '네로';
const names = [ADEL, VITO, SILVI, NERO];
const dq = (number, sentence, text, by, to, extra = {}) => ({ number, sentence, text, by, to, ...extra });
const storeOf = (quotes, extra = {}) => ({ scenes: [{ id: 'S1', start: 1, end: 9, present: names, events: [{ text: '이야기', quotes }] }], cast: names, personas: [], ...extra });

test('terms: a call at the start or the end of the line, a title, a generic call; not interjections, not names, not the middle', () => {
  const terms = (text) => S.vocativeTerms(text, names).map((t) => `${t.at}:${t.term}`);
  assert.deepEqual(terms('"Zuzu, vieni qui."'), ['start:Zuzu']);
  assert.deepEqual(terms('"Hai sentito, Zuzu?"'), ['end:Zuzu'], 'the sentence before the call is not a term (lower-case word)');
  assert.deepEqual(terms('"Signor Valle, venga con me."'), ['start:Signor Valle']);
  assert.deepEqual(terms('"Boss, è tutto pronto."'), ['start:Boss']);
  assert.deepEqual(terms('"보스, 다 됐어요."'), ['start:보스']);
  assert.deepEqual(terms('"쭈쭈야, 이리 와."'), ['start:쭈쭈']);
  assert.deepEqual(terms('"Sì, certo."'), [], 'an interjection is no term');
  assert.deepEqual(terms('"네, 알겠습니다."'), []);
  assert.deepEqual(terms('"비토, 이리 와."'), [], 'a known name is addressedIn\'s job');
  assert.deepEqual(terms('"Vieni, Zuzu, adesso."'), [], 'the middle of a line is not taken');
  assert.deepEqual(S.vocativeTerms('"Zuzu, vieni." (쭈쭈, 와.)', names).map((t) => t.term), ['Zuzu', '쭈쭈'], 'the translation in brackets is read too');
  assert.deepEqual(terms('그냥 말했다'), []);
});

test('collection: ≥2 times with a known speaker and one certain listener; user entries stay at any count; places and counts', () => {
  const store = storeOf([
    dq(1, 1, '"Zuzu, vieni qui."', ADEL, VITO),
    dq(2, 1, '"Hai sentito, Zuzu?"', ADEL, VITO),
    dq(3, 1, '"Boss, tutto pronto."', ADEL, SILVI),
    dq(4, 1, '"Pippo, aspetta."', ADEL, NERO, { toGuess: true }),
    dq(5, 1, '"Pippo, aspetta."', ADEL, NERO, { toGuess: true }),
    dq(6, 1, '"Gigi, ascolta."', null, VITO),
    dq(7, 1, '"Gigi, ascolta."', ADEL, null),
    dq(8, 1, '"Mimmo, andiamo."', ADEL, `${VITO}·${NERO}`),
    dq(8, 2, '"Mimmo, andiamo."', ADEL, `${VITO}·${NERO}`),
    dq(9, 1, '"Tato, vieni."', ADEL, VITO, { viaBook: true }),
    dq(9, 2, '"Tato, vieni."', ADEL, VITO, { viaBook: true }),
  ]);
  const found = [...Addr.tally(store).values()];
  assert.deepEqual(found.map((r) => `${r.from}>${r.to}:${r.term}×${r.count}`).sort(), ['아델>비토:Zuzu×2', '아델>실비:Boss×1']);
  const book = Addr.emptyBook();
  assert.equal(Addr.refresh(book, store), true);
  assert.equal(book.entries.length, 1, 'Boss was seen once: not kept');
  assert.deepEqual({ ...book.entries[0], id: undefined }, { id: undefined, from: ADEL, to: VITO, term: 'Zuzu', count: 2, firstSeen: { number: 1, sentence: 1 }, lastSeen: { number: 2, sentence: 1 }, source: 'auto', useForCheck: true });
  assert.equal(Addr.refresh(book, store), false, 'nothing changed: nothing to save');
  // A third use raises the count; a user entry survives at count 0 and is counted when the dialogue shows it.
  Addr.addEntry(book, { from: ADEL, to: SILVI, term: 'Boss' });
  store.scenes[0].events[0].quotes.push(dq(10, 1, '"Zuzu, dai."', ADEL, VITO));
  Addr.refresh(book, store);
  const byTerm = Object.fromEntries(book.entries.map((e) => [e.term, e]));
  assert.equal(byTerm.Zuzu.count, 3);
  assert.deepEqual(byTerm.Zuzu.lastSeen, { number: 10, sentence: 1 });
  assert.equal(byTerm.Boss.source, 'user');
  assert.equal(byTerm.Boss.count, 1, 'the dialogue shows it once');
  // The dialogue no longer shows Zuzu: the automatic entry goes, the user entry stays.
  Addr.refresh(book, storeOf([]));
  assert.deepEqual(book.entries.map((e) => [e.term, e.source]), [['Boss', 'user']]);
});

test('names are read through the room\'s alias table, and equal entries merge', () => {
  const table = A.emptyTable();
  A.addPerson(table, VITO, ['비토 아르디']);
  const store = storeOf([
    dq(1, 1, '"Zuzu, vieni qui."', ADEL, '비토 아르디'),
    dq(2, 1, '"Zuzu, dai."', ADEL, VITO),
  ], { cast: [...names, '비토 아르디'] });
  const book = Addr.emptyBook();
  A.using(table, () => Addr.refresh(book, store));
  assert.deepEqual(book.entries.map((e) => [e.from, e.to, e.term, e.count]), [[ADEL, VITO, 'Zuzu', 2]]);
  // A stored entry written under an alias is read as the canonical person.
  const old = { ...Addr.emptyBook(), entries: [{ from: ADEL, to: '비토 아르디', term: 'Zuzu', count: 1, source: 'user' }, { from: ADEL, to: VITO, term: 'zuzu', count: 2, source: 'auto' }] };
  const merged = A.using(table, () => Addr.normalize(old));
  assert.equal(merged.length, 1);
  assert.deepEqual([merged[0].to, merged[0].count, merged[0].source], [VITO, 3, 'user']);
});

// ---- the rules ----
const msgs = (...lines) => [{ id: 'm1', number: 1, role: 'assistant', sentences: lines }];
const nick = new Map([['zuzu', VITO], ['boss', SILVI]]);
const withBook = (map, fn) => { S.setAddressProvider(() => map); try { return fn(); } finally { S.setAddressProvider(null); } };

test('attribution: a nickname from the book makes its person the listener (rule 호칭 사전) and never the speaker', () => {
  const q1 = dq(1, 1, '"Zuzu, vieni qui."', ADEL, null);
  const q2 = dq(1, 3, '"Zuzu, sono qui."', VITO, ADEL);
  const store = storeOf([q1, q2]);
  const m = msgs('"Zuzu, vieni qui."', '아델이 손짓했다.', '"Zuzu, sono qui."');
  // Without the book the nickname means nothing to the rules.
  S.enforceAttributionRules(structuredClone(store), m);
  assert.equal(q1.to, null);
  const ruled = withBook(nick, () => S.enforceAttributionRules(store, m));
  assert.equal(q1.to, VITO);
  assert.equal(q1.viaBook, true, 'marked: the book must not learn from its own answer');
  assert.ok(ruled.some((x) => x.sentence === 1 && x.rule.includes('address-book')), JSON.stringify(ruled));
  // The person the nickname calls cannot be the speaker of that line.
  assert.equal(q2.by, null);
  assert.ok(ruled.some((x) => x.sentence === 3 && x.rule.includes('vocative-speaker')));
  // The facts the model-check uses say the same.
  const facts = withBook(nick, () => S.attributionCandidates(storeOf([dq(1, 1, '"Zuzu, vieni qui."', ADEL, null)]), m, 5)[0]?.facts);
  assert.deepEqual(facts.addressed, [VITO]);
  assert.deepEqual(facts.booked, [VITO]);
});

test('attribution: a hand-corrected line is never touched; an ambiguous term and a switched-off entry are not used', () => {
  const manual = dq(1, 1, '"Zuzu, vieni qui."', ADEL, NERO, { manual: true });
  const m = msgs('"Zuzu, vieni qui."');
  withBook(nick, () => S.enforceAttributionRules(storeOf([manual]), m));
  assert.equal(manual.to, NERO);
  assert.equal(manual.viaBook, undefined);
  // The same term for two people: Addr.termMap leaves it out.
  const book = { ...Addr.emptyBook(), entries: [
    { from: ADEL, to: VITO, term: 'Zuzu', count: 3, source: 'auto', useForCheck: true },
    { from: NERO, to: SILVI, term: 'zuzu', count: 2, source: 'auto', useForCheck: true },
    { from: ADEL, to: SILVI, term: 'Boss', count: 4, source: 'auto', useForCheck: false },
    { from: ADEL, to: NERO, term: 'Capitano', count: 2, source: 'auto', useForCheck: true },
  ] };
  assert.deepEqual([...Addr.termMap(book)], [['capitano', NERO]], 'ambiguous and switched-off terms are not used');
});

test('attribution: the settled-by-rules path and the fingerprint know about the book', () => {
  const q = dq(1, 1, '"Zuzu, vieni qui."', ADEL, VITO);
  q.attributionChecked = 7;
  const store = storeOf([q]);
  const m = msgs('아델은 문을 열었다.', '"Zuzu, vieni qui."', '아델이 말했다.');
  q.sentence = 2;
  const off = S.attributionCandidates(store, m, 5, new Set(), { force: true })[0];
  const on = withBook(nick, () => S.attributionCandidates(store, m, 5, new Set(), { force: true })[0]);
  assert.notEqual(on.fingerprint, off.fingerprint, 'a line the book now explains is checked again');
  assert.equal(withBook(nick, () => S.settledByRules(on)), 'settled-narration');
  assert.equal(S.settledByRules(off), null, 'without the book nothing proves the listener');
});

// ---- injection ----
test('injection block: only pairs of people present, most used first, within the cap', () => {
  const book = { ...Addr.emptyBook(), entries: [
    { from: ADEL, to: SILVI, term: 'Boss', count: 9, source: 'auto' },
    { from: SILVI, to: VITO, term: 'Zuzu', count: 4, source: 'auto' },
    { from: ADEL, to: VITO, term: '쭈쭈', count: 2, source: 'user' },
    { from: ADEL, to: NERO, term: 'Capitano', count: 5, source: 'auto' },
  ] };
  assert.equal(Addr.injectionBlock(book, [ADEL, SILVI, VITO]), '[호칭] 아델→실비: Boss · 실비→비토: Zuzu · 아델→비토: 쭈쭈');
  assert.equal(Addr.injectionBlock(book, [ADEL, SILVI]), '[호칭] 아델→실비: Boss', 'Nero is not there: his pairs are left out');
  assert.equal(Addr.injectionBlock(book, [VITO]), '');
  assert.equal(Addr.injectionBlock(book, []), '');
  const many = { ...Addr.emptyBook(), entries: Array.from({ length: 30 }, (_, i) => ({ from: ADEL, to: SILVI, term: `Soprannome${i}`, count: 30 - i, source: 'auto' })) };
  const line = Addr.injectionBlock(many, [ADEL, SILVI]);
  assert.ok(line.length <= 120 && line.startsWith('[호칭] 아델→실비: Soprannome0'), line);
  assert.equal(T.planLines(line, 'en')[0].kind, 'keep', 'never sent for translation');
});

// ---- the service ----
const settingsOn = (room, mode = 'on') => X.saveSettings({ connection: null, chats: { [room]: { enabled: true, features: { addressBook: mode } } } });
function seedRoom(room) {
  const store = S.emptyStore();
  store.cast = names;
  store.scenes = [{ id: 'S1', start: 1, end: 6, messages: [], title: '골목', summary: '아델과 실비, 비토가 골목에서 만났다.', present: [ADEL, SILVI, VITO], events: [{ text: '이야기', importance: 'major', quotes: [
    dq(1, 1, '"Zuzu, vieni qui."', ADEL, VITO), dq(2, 1, '"Zuzu, dai."', ADEL, VITO), dq(3, 1, '"Boss, pronto."', ADEL, SILVI), dq(4, 1, '"Boss, andiamo."', ADEL, SILVI),
    dq(5, 1, '"Capitano, ecco."', ADEL, NERO), dq(6, 1, '"Capitano, via."', ADEL, NERO),
  ] }], recollections: [] }];
  X.saveScenes(room, store);
  return store;
}

test('service: off collects and injects nothing; on collects, injects only the people present, and the book survives switching off', () => {
  seedRoom('ra');
  settingsOn('ra', 'off');
  assert.equal(X.refreshAddress('ra', X.loadScenes('ra')), false);
  assert.equal(fs.existsSync(path.join(CHATS, 'ra.address.json')), false);
  assert.doesNotMatch(X.renderMemorySource('ra'), /\[호칭\]/);
  settingsOn('ra', 'on');
  assert.equal(X.refreshAddress('ra', X.loadScenes('ra')), true);
  const stored = JSON.parse(fs.readFileSync(path.join(CHATS, 'ra.address.json'), 'utf8'));
  assert.equal(stored.version, 1);
  assert.deepEqual(stored.entries.map((e) => `${e.from}>${e.to}:${e.term}×${e.count}`).sort(), ['아델>네로:Capitano×2', '아델>비토:Zuzu×2', '아델>실비:Boss×2']);
  const text = X.renderMemorySource('ra');
  const line = text.split('\n').find((l) => l.startsWith('[호칭]'));
  assert.ok(line, text);
  assert.match(line, /아델→실비: Boss/);
  assert.match(line, /아델→비토: Zuzu/);
  assert.doesNotMatch(line, /네로|Capitano/, 'Nero is not in the scene');
  assert.ok(line.length <= 120);
  // Off again: the line is gone and the file stays.
  settingsOn('ra', 'off');
  assert.doesNotMatch(X.renderMemorySource('ra'), /\[호칭\]/);
  assert.equal(fs.existsSync(path.join(CHATS, 'ra.address.json')), true);
  // The same line when the memory goes to English: kept as written, no translation asked for.
  settingsOn('ra', 'on');
  assert.deepEqual(T.translateText(text, 'en', () => null).missing.filter((l) => l.startsWith('[호칭]')), []);
});

test('routes: add, edit, delete, toggle; refused while off; bad input refused', async () => {
  seedRoom('rb');
  settingsOn('rb', 'off');
  assert.match((await call('POST /chats/:id/address', 'rb', { action: 'add', entry: { from: ADEL, to: VITO, term: 'Zuzu' } })).error, /꺼져 있습니다/);
  settingsOn('rb', 'on');
  let r = await call('POST /chats/:id/address', 'rb', { action: 'add', entry: { from: ADEL, to: VITO, term: ' Zuzu ', note: '애칭' } });
  assert.ifError(r.error);
  assert.deepEqual({ ...r.result.entry, id: undefined }, { id: undefined, from: ADEL, to: VITO, term: 'Zuzu', count: 0, firstSeen: null, lastSeen: null, source: 'user', useForCheck: true, note: '애칭' });
  const id = r.result.entry.id;
  assert.equal(r.result.entries.length, 1);
  assert.equal(X.loadAddress('rb').entries.length, 1, 'saved');
  assert.match((await call('POST /chats/:id/address', 'rb', { action: 'add', entry: { from: ADEL, to: ADEL, term: 'x' } })).error, /같습니다/);
  assert.match((await call('POST /chats/:id/address', 'rb', { action: 'add', entry: { from: ADEL, to: VITO, term: '' } })).error, /부르는 말/);
  assert.match((await call('POST /chats/:id/address', 'rb', { action: 'add', entry: { from: '', to: VITO, term: 'x' } })).error, /모두 적어/);
  assert.match((await call('POST /chats/:id/address', 'rb', { action: 'nope' })).error, /add, edit, delete, toggle/);
  assert.match((await call('POST /chats/:id/address', 'rb', { action: 'delete', id: 'zzz' })).error, /찾지 못했습니다/);
  // toggle
  assert.match((await call('POST /chats/:id/address', 'rb', { action: 'toggle', id, on: 'no' })).error, /on: true/);
  r = await call('POST /chats/:id/address', 'rb', { action: 'toggle', id, on: false });
  assert.equal(r.result.entry.useForCheck, false);
  assert.equal(X.loadAddress('rb').entries[0].useForCheck, false);
  // edit: becomes (stays) a user entry with a new id
  r = await call('POST /chats/:id/address', 'rb', { action: 'edit', id, entry: { term: 'Zuzu-chan', note: '' } });
  assert.ifError(r.error);
  assert.equal(r.result.entry.term, 'Zuzu-chan');
  assert.equal(r.result.entry.source, 'user');
  assert.equal(r.result.entry.note, undefined);
  assert.equal(r.result.entries.length, 1);
  // an automatic entry that is edited becomes the user's own
  await call('POST /chats/:id/address', 'rb', { action: 'delete', id: r.result.entry.id });
  X.refreshAddress('rb', X.loadScenes('rb'));
  const auto = X.loadAddress('rb').entries.find((e) => e.term === 'Boss');
  assert.equal(auto.source, 'auto');
  r = await call('POST /chats/:id/address', 'rb', { action: 'edit', id: auto.id, entry: { term: 'Capo' } });
  assert.equal(r.result.entry.source, 'user');
  X.refreshAddress('rb', X.loadScenes('rb'));
  assert.ok(X.loadAddress('rb').entries.some((e) => e.term === 'Capo' && e.source === 'user'), 'a later scan keeps it');
  // delete + the list
  r = await call('POST /chats/:id/address', 'rb', { action: 'delete', id: r.result.entry.id });
  assert.ok(!r.result.entries.some((e) => e.term === 'Capo'));
  const get = (await call('GET /chats/:id/address', 'rb')).result;
  assert.equal(get.addressBook, true);
  assert.equal(get.learnFromEdits, false);
  // the names tab carries it; off and nothing to show: null
  assert.equal((await call('GET /chats/:id/names', 'rb')).result.address.addressBook, true);
  settingsOn('rb', 'off');
  assert.equal((await call('GET /chats/:id/names', 'rb')).result.address, null);
  assert.deepEqual((await call('GET /chats/:id/address', 'rb')).result.entries, []);
});

test('a hand-corrected listener is counted as the user\'s evidence even when the book first gave it', () => {
  const quote = dq(1, 1, '"Zuzu, vieni."', ADEL, VITO, { viaBook: true });
  const again = dq(2, 1, '"Zuzu, dai."', ADEL, VITO, { viaBook: true, manual: true });
  assert.equal([...Addr.tally(storeOf([quote, again])).values()].length, 1);
  assert.equal([...Addr.tally(storeOf([quote, again])).values()][0].count, 1);
});

test('backup carries the file and the restore preview counts it', async () => {
  seedRoom('rc');
  settingsOn('rc', 'on');
  X.refreshAddress('rc', X.loadScenes('rc'));
  assert.ok(B.KEYS.includes('address'));
  const { result } = await call('GET /chats/:id/backup', 'rc', null);
  assert.ok(result.backup.files.address);
  assert.equal(B.counts(result.backup.files).addressEntries, 3);
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(result.backup))));
  const bad = JSON.parse(JSON.stringify(result.backup));
  bad.files.address = { version: 1, entries: 'x' };
  bad.header.fileHashes.address = B.hashOf(bad.files.address);
  assert.throws(() => B.validate(bad), /address/);
  // restore into another room brings the book along
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, rd: { enabled: true } } });
  const applied = await call('POST /chats/:id/restore/apply', 'rd', { backup: result.backup, crossRoom: true });
  assert.ifError(applied.error);
  assert.equal(X.loadAddress('rd').entries.length, 3);
});

test('deleting the room removes the address file and its cache', async () => {
  seedRoom('re');
  settingsOn('re', 'on');
  X.refreshAddress('re', X.loadScenes('re'));
  const file = path.join(CHATS, 're.address.json');
  assert.ok(fs.existsSync(file));
  X.purgeChatMemory('re');
  assert.equal(fs.existsSync(file), false);
  assert.equal(X.loadAddress('re').entries.length, 0, 'caches are cleared too');
});

// ---- the screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fn = (name) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc });
};

test('screen: the 호칭 section lists entries with the toggle, edit and delete, and the form', () => {
  const paper = fn('addressPaper');
  assert.equal(paper(null, {}, '', []), '');
  assert.equal(paper({ addressBook: false, learnFromEdits: false }, {}, '', []), '');
  const a = { addressBook: true, learnFromEdits: false, suggestions: [], entries: [
    { id: 'e1', from: ADEL, to: VITO, term: 'Zuzu', count: 3, source: 'auto', useForCheck: true },
    { id: 'e2', from: ADEL, to: SILVI, term: '<b>Boss</b>', count: 0, source: 'user', useForCheck: false, note: '별명' },
  ] };
  const html = paper(a, { id: '', from: '', to: '', term: '', note: '' }, '', [ADEL]);
  assert.match(html, /호칭 사전 · 2개/);
  assert.match(html, /<b>아델<\/b> → <b>비토<\/b>: <b>Zuzu<\/b> ×3 <small>자동<\/small>/);
  assert.match(html, /data-address-use="e1" checked>대사 확인에 쓰기/);
  assert.match(html, /data-address-use="e2" >대사 확인에 쓰기/);
  assert.match(html, /직접 추가 · 별명/);
  assert.doesNotMatch(html, /<b>Boss<\/b>/, 'text is escaped');
  assert.match(html, /data-act="addressEdit" data-id="e1"/);
  assert.match(html, />지우기<\/button>/);
  assert.match(paper(a, {}, 'addressDelete:e1', []), /한 번 더 누르면 지웁니다/);
  assert.match(html, /호칭 직접 추가/);
  assert.match(html, /data-act="addressSave">추가/);
  assert.match(paper(a, { id: 'e1', from: ADEL, to: VITO, term: 'Zuzu', note: '' }, '', []), /호칭 고치기[\s\S]*data-act="addressSave">저장[\s\S]*addressCancel/);
  assert.doesNotMatch(html, /직접 고친 것에서 배운 제안/, 'the suggestion list belongs to the other feature');
});

test('screen: the names tab shows the section and its actions are wired', () => {
  assert.match(source, /\$\{addressPaper\(names\.address, addressForm, armed, names\.known \|\| \[\]\)\}/);
  for (const act of ['addressSave', 'addressEdit', 'addressDelete', 'addressCancel']) assert.match(source, new RegExp(`case '${act}'`));
  assert.match(source, /dataset\?\.addressUse/);
  assert.match(source, /'address-book': '호칭 사전/);
});
