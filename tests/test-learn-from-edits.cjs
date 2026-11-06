'use strict';
// 직접 고친 것 배우기 (learnFromEdits): suggestions from the scene editor, never automatic rules. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-learn-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const X = service._test;
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, a, b) { handlers['POST ' + p] = b || a; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async getById(id) { return { id, name: '방' }; }, async listMessages() { return []; } } });
service.attach(app);
const call = async (key, id, body, params = {}) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id, ...params }, body, query: {} }, reply);
  return { result, error };
};
const CHATS = path.join(dir, 'memory-module/chats');
const bookFile = (room) => path.join(CHATS, `${room}.address.json`);

const ADEL = '아델', VITO = '비토', SILVI = '실비', ELLI = '엘리';
const dq = (number, sentence, text, by, to, extra = {}) => ({ number, sentence, text, by, to, ...extra });
const features = (room, learn, book) => X.saveSettings({ connection: null, chats: { [room]: { features: { ...(learn ? { learnFromEdits: 'on' } : {}), ...(book ? { addressBook: 'on' } : {}) } } } });

function seed(room, quotes, present = [ADEL, VITO, SILVI]) {
  const store = S.emptyStore();
  store.cast = [ADEL, VITO, SILVI];
  store.scenes = [{ id: 'S1', start: 1, end: 9, title: '골목', summary: '골목', present, events: [{ text: '이야기', importance: 'major', quotes }], recollections: [] }];
  X.saveScenes(room, store);
}
/** What the editor sends: the scene's events as stored, with the changes applied to the quotes by position. */
const edit = (room, change) => {
  const events = structuredClone(X.loadScenes(room).scenes[0].events);
  const quotes = events[0].quotes;
  change(quotes);
  return call('PATCH /chats/:id/scenes/:sceneId', room, { events }, { sceneId: 'S1' });
};
const book = (room) => (fs.existsSync(bookFile(room)) ? JSON.parse(fs.readFileSync(bookFile(room), 'utf8')) : null);
const open = (room) => (book(room)?.suggestions || []).filter((s) => s.status === 'open');

test('(a) a line that opens with a term and a listener the user set: suggest speaker → listener, term', async () => {
  features('ra', true, true);
  seed('ra', [dq(1, 1, '"Zuzu, vieni qui."', ADEL, null), dq(2, 1, '"Va bene."', SILVI, null)]);
  const r = await edit('ra', (q) => { q[0].to = VITO; });
  assert.ifError(r.error);
  assert.equal(X.loadScenes('ra').scenes[0].events[0].quotes[0].manual, true, 'the edit itself is saved as before');
  const s = open('ra');
  assert.equal(s.length, 1);
  assert.deepEqual({ kind: s[0].kind, from: s[0].from, to: s[0].to, term: s[0].term, status: s[0].status }, { kind: 'address', from: ADEL, to: VITO, term: 'Zuzu', status: 'open' });
  assert.equal(book('ra').entries.length, 0, 'a suggestion changes no rule: the book is untouched');
  // The same edit again (or a second look at the same line) does not make a duplicate.
  await edit('ra', (q) => { q[0].to = null; });
  await edit('ra', (q) => { q[0].to = VITO; });
  assert.equal(open('ra').length, 1);
  assert.equal(book('ra').suggestions.length, 1);
  // Another listener for the same term is another question.
  await edit('ra', (q) => { q[0].to = SILVI; });
  assert.equal(open('ra').length, 2);
  // The view the screen reads
  const view = (await call('GET /chats/:id/names', 'ra')).result.address;
  assert.equal(view.learnFromEdits, true);
  assert.equal(view.suggestions.length, 2);
  assert.equal(X.loadScenes('ra').scenes[0].events[0].quotes[1].manual, undefined);
});

test('(a) needs the address book on, a certain single listener, and a term that opens the line', async () => {
  features('rb', true, false);
  seed('rb', [dq(1, 1, '"Zuzu, vieni qui."', ADEL, null), dq(2, 1, '"Vieni qui, Zuzu."', ADEL, null), dq(3, 1, '"Andiamo."', ADEL, null), dq(4, 1, '"Zuzu, noi."', ADEL, null)]);
  await edit('rb', (q) => { q[0].to = VITO; });
  assert.equal(open('rb').length, 0, 'address book off: nothing to add to');
  features('rb', true, true);
  await edit('rb', (q) => { q[1].to = VITO; });
  assert.equal(open('rb').length, 0, 'the term closes the line');
  await edit('rb', (q) => { q[2].to = VITO; });
  assert.equal(open('rb').length, 0, 'no term in the line');
  await edit('rb', (q) => { q[3].to = `${VITO}·${SILVI}`; });
  assert.equal(open('rb').length, 0, 'two listeners');
  await edit('rb', (q) => { q[0].by = null; });
  assert.equal(open('rb').length, 0, 'no speaker');
  // an entry the book already has is not suggested
  await call('POST /chats/:id/address', 'rb', { action: 'add', entry: { from: ADEL, to: SILVI, term: 'zuzu' } });
  seed('rb', [dq(1, 1, '"Zuzu, vieni qui."', ADEL, null)]);
  await edit('rb', (q) => { q[0].to = SILVI; });
  assert.equal(open('rb').length, 0);
});

test('(b) a name replaced by another that is no alias of it, used at least twice: suggest the alias', async () => {
  features('rc', true, false);
  seed('rc', [dq(1, 1, '"Ecco."', ELLI, ADEL), dq(2, 1, '"Dai."', ELLI, ADEL), dq(3, 1, '"No."', VITO, ELLI)], [ADEL, VITO]);
  await edit('rc', (q) => { q[0].by = SILVI; });
  const s = open('rc');
  assert.equal(s.length, 1);
  assert.deepEqual({ kind: s[0].kind, source: s[0].source, target: s[0].target, count: s[0].count }, { kind: 'alias', source: ELLI, target: SILVI, count: 3 });
  // Not suggested: used once only; a person present in the scene; already an alias; ignored before.
  seed('rd', [dq(1, 1, '"Ecco."', ELLI, ADEL)], [ADEL, VITO]);
  features('rd', true, false);
  await edit('rd', (q) => { q[0].by = SILVI; });
  assert.equal(open('rd').length, 0, 'only once');
  features('rd', true, false);
  seed('rd', [dq(1, 1, '"Ecco."', ELLI, ADEL), dq(2, 1, '"Dai."', ELLI, ADEL)], [ADEL, VITO, ELLI]);
  await edit('rd', (q) => { q[0].by = SILVI; });
  assert.equal(open('rd').length, 0, 'Elli is in the scene: another person, not another spelling');
  seed('rd', [dq(1, 1, '"Ecco."', ELLI, ADEL), dq(2, 1, '"Dai."', ELLI, ADEL)], [ADEL, VITO]);
  const table = A.emptyTable();
  A.addPerson(table, SILVI, [ELLI]);
  X.saveNames('rd', table);
  await edit('rd', (q) => { q[0].by = SILVI; });
  assert.equal(open('rd').length, 0, 'already known as the same person');
  // a guessed listener replaced is no evidence of a spelling
  seed('rg', [dq(1, 1, '"Ecco."', ADEL, ELLI, { toGuess: true }), dq(2, 1, '"Dai."', ADEL, ELLI, { toGuess: true })], [ADEL, VITO]);
  features('rg', true, false);
  await edit('rg', (q) => { q[0].to = SILVI; });
  assert.equal(open('rg').length, 0);
});

test('(c) a guessed listener the user changed is recorded, nothing is suggested', async () => {
  features('re', true, true);
  seed('re', [dq(1, 1, '"Andiamo."', ADEL, VITO, { toGuess: true }), dq(2, 1, '"Dai."', ADEL, VITO, { toGuess: true })]);
  await edit('re', (q) => { q[0].to = SILVI; delete q[0].toGuess; });
  const b = book('re');
  assert.equal(b.suggestions.length, 0);
  assert.equal(b.edits.length, 1);
  assert.deepEqual({ number: b.edits[0].number, sentence: b.edits[0].sentence, kind: b.edits[0].kind, guessed: b.edits[0].guessed, set: b.edits[0].set }, { number: 1, sentence: 1, kind: 'guess', guessed: VITO, set: SILVI });
  // The untouched guess is not recorded.
  assert.equal(b.edits.filter((e) => e.sentence === 2).length, 0);
});

test('off: no suggestion, no file, and the edit saves exactly as before', async () => {
  features('rf', false, true);
  seed('rf', [dq(1, 1, '"Zuzu, vieni qui."', ADEL, null)]);
  const r = await edit('rf', (q) => { q[0].to = VITO; });
  assert.ifError(r.error);
  assert.equal(fs.existsSync(bookFile('rf')), false);
  assert.equal(X.loadScenes('rf').scenes[0].events[0].quotes[0].to, VITO);
  assert.match((await call('POST /chats/:id/address/suggestion/:sid', 'rf', { action: 'ignore' }, { sid: 'x' })).error, /꺼져 있습니다/);
});

test('accept writes a user entry (address) or an alias; ignore is remembered; neither can be answered twice', async () => {
  features('rh', true, true);
  seed('rh', [dq(1, 1, '"Zuzu, vieni qui."', ADEL, null), dq(2, 1, '"Ecco."', ELLI, ADEL), dq(3, 1, '"Dai."', ELLI, ADEL), dq(4, 1, '"Boss, via."', ADEL, null)], [ADEL, VITO, SILVI]);
  await edit('rh', (q) => { q[0].to = VITO; q[1].by = SILVI; q[3].to = SILVI; });
  const list = open('rh');
  assert.equal(list.length, 3);
  const [address, alias, other] = [list.find((s) => s.term === 'Zuzu'), list.find((s) => s.kind === 'alias'), list.find((s) => s.term === 'Boss')];
  // accept: address
  assert.match((await call('POST /chats/:id/address/suggestion/:sid', 'rh', { action: 'maybe' }, { sid: address.id })).error, /accept 또는 ignore/);
  let r = await call('POST /chats/:id/address/suggestion/:sid', 'rh', { action: 'accept' }, { sid: address.id });
  assert.ifError(r.error);
  assert.equal(r.result.status, 'done');
  assert.deepEqual(book('rh').entries.map((e) => [e.from, e.to, e.term, e.source]), [[ADEL, VITO, 'Zuzu', 'user']]);
  assert.match((await call('POST /chats/:id/address/suggestion/:sid', 'rh', { action: 'accept' }, { sid: address.id })).error, /이미 답한/);
  // accept: alias, through the name table
  r = await call('POST /chats/:id/address/suggestion/:sid', 'rh', { action: 'accept' }, { sid: alias.id });
  assert.ifError(r.error);
  assert.deepEqual(X.loadNames('rh').people[SILVI].aliases, [ELLI]);
  assert.equal(A.canonOf(ELLI, X.loadNames('rh')), SILVI);
  // ignore: remembered, and the same edit later does not bring it back
  r = await call('POST /chats/:id/address/suggestion/:sid', 'rh', { action: 'ignore' }, { sid: other.id });
  assert.equal(r.result.status, 'ignored');
  assert.equal(open('rh').length, 0);
  assert.equal(book('rh').entries.length, 1, 'ignoring adds nothing');
  await edit('rh', (q) => { q[3].to = null; });
  await edit('rh', (q) => { q[3].to = SILVI; });
  assert.equal(open('rh').length, 0, 'asked once, never again');
  assert.equal(book('rh').suggestions.filter((s) => s.term === 'Boss').length, 1, 'no duplicate record');
  assert.match((await call('POST /chats/:id/address/suggestion/:sid', 'rh', { action: 'accept' }, { sid: 'nope' })).error, /찾지 못했습니다/);
});

test('accepting an address suggestion needs the address book on; the suggestion stays open', async () => {
  features('ri', true, true);
  seed('ri', [dq(1, 1, '"Zuzu, vieni qui."', ADEL, null)]);
  await edit('ri', (q) => { q[0].to = VITO; });
  features('ri', true, false);
  const id = open('ri')[0].id;
  assert.match((await call('POST /chats/:id/address/suggestion/:sid', 'ri', { action: 'accept' }, { sid: id })).error, /호칭 사전/);
  assert.equal(open('ri').length, 1);
});

const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const addressPaper = (() => {
  const start = source.indexOf('  function addressPaper(');
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc });
})();

test('screen: the suggestions with [추가] and [무시]; the section shows when only this feature is on', () => {
  const a = { addressBook: false, learnFromEdits: true, entries: [], suggestions: [
    { id: 's1', kind: 'address', from: ADEL, to: VITO, term: 'Zuzu' },
    { id: 's2', kind: 'alias', source: ELLI, target: SILVI, count: 3 },
  ] };
  const html = addressPaper(a, {}, '', []);
  assert.match(html, /제안: ‘Zuzu’은\(는\) 비토을\(를\) 부르는 말일까요\?/);
  assert.match(html, /data-act="suggestAccept" data-id="s1">추가/);
  assert.match(html, /data-act="suggestIgnore" data-id="s1">무시/);
  assert.match(html, /‘엘리’은\(는\) 실비의 다른 이름일까요/);
  assert.match(html, /같은 사람으로 추가/);
  assert.doesNotMatch(html, /호칭 사전 ·/, 'no address-book list while that feature is off');
  assert.match(addressPaper({ ...a, suggestions: [] }, {}, '', []), /제안이 없습니다/);
  for (const act of ['suggestAccept', 'suggestIgnore']) assert.match(source, new RegExp(`case '${act}'`));
});
