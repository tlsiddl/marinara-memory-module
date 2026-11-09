'use strict';
// 인물의 수첩: the voice comes from each character's Korean lines (Korean, bracketed Korean, or the saved translation of
// an English-only line); notes are cleaned (story people only, never the user's own, Korean, with evidence), folded
// with the user's edits, stars and deletions, and go into the reply for the people in the scene. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-notebook-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const Nb = require('../memory-module/lib/notebook.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const T = require('../memory-module/lib/translate.cjs');
const B = require('../memory-module/lib/backup.cjs');
const X = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body }, reply);
  return { result, error };
};

test('voice: a Korean line, the Korean in brackets, or the saved translation of an English-only line', () => {
  const messages = [
    { role: 'assistant', content: 'Viktor smiled.\nViktor | "Come here, you."\nSera | "Leave me alone." (나 좀 내버려 둬.)', tr: '빅터가 웃었다.\n빅터 | "이리 와, 너."\n세라 | "나 좀 내버려 둬."' },
    { role: 'assistant', content: '<speaker="Viktor">Viktor | "Sit down."</speaker>', tr: '<speaker="Viktor">빅터 | "앉아."</speaker>' },
    { role: 'user', content: 'Mina | "싫은데?"' },
  ];
  assert.deepEqual(Nb.voiceSamples(messages, ['Viktor', 'Sera', 'Mina'], { personas: ['Mina'] }), { Viktor: ['이리 와, 너.', '앉아.'], Sera: ['나 좀 내버려 둬.'] });
  assert.match(Nb.voiceBlock({ Viktor: ['앉아.'] }), /\[말투 참고\][^]*Viktor: "앉아\."/);
  assert.equal(Nb.voiceBlock({}), '');
});

test('a note: a story person (never the user\'s own), Korean, a known kind; about oneself is a feeling', () => {
  const opts = { cast: ['Viktor', 'Sera'], personas: ['Mina'], person: (n) => n };
  assert.deepEqual(Nb.cleanNote({ who: 'Viktor', kind: 'about', about: 'Sera', text: '세라는 단 걸 싫다면서 체리는 네 개째 먹었다.' }, opts), { who: 'Viktor', kind: 'about', about: 'Sera', text: '세라는 단 걸 싫다면서 체리는 네 개째 먹었다.' });
  assert.equal(Nb.cleanNote({ who: 'Mina', kind: 'heart', text: '나는 사실 무서웠다.' }, opts), null, 'the user\'s own character');
  assert.equal(Nb.cleanNote({ who: 'Viktor', kind: 'heart', text: 'I must keep her safe.' }, opts), null, 'not Korean');
  assert.equal(Nb.cleanNote({ who: 'Stranger', kind: 'heart', text: '이상한 날이다.' }, opts), null, 'not a story person');
  assert.deepEqual(Nb.cleanNote({ who: 'Viktor', kind: 'about', about: 'Viktor', text: '내가 왜 그랬을까.' }, opts), { who: 'Viktor', kind: 'heart', text: '내가 왜 그랬을까.' });
});

test('the scene call asks for notes (with the voice lines) only when on, and keeps notes with evidence from the scene', () => {
  const slice = L.prepareMessages([{ id: 'a1', number: 1, role: 'assistant', speaker: 'Narrator', content: '빅터는 세라가 체리를 집는 걸 봤다.\n빅터 | "또 먹어?"' }]);
  const store = { ...S.emptyStore(), cast: ['빅터', '세라'] };
  const prompt = (on) => S.buildScenePrompt(store, slice, 1, null, { notebook: on })[0].content;
  assert.match(prompt(true), /인물의 수첩/);
  assert.match(prompt(true), /\[말투 참고\][^]*빅터: "또 먹어\?"/);
  assert.doesNotMatch(prompt(false), /인물의 수첩/);
  const notebook = [
    { who: '빅터', kind: 'about', about: '세라', text: '세라는 단 걸 싫다면서 체리는 잘만 먹는다.', evidence: ['1.1'] },
    { who: '빅터', kind: 'heart', text: '근거 없는 메모.', evidence: ['9.9'] },
  ];
  const result = { scenes: [{ end: 1, time: '25-03-02', place: '부엌', title: '체리', summary: '요약', present: ['빅터', '세라'], events: [{ text: '봤다', quotes: [] }], recollections: [], facts: [], notebook }] };
  const apply = (opts) => S.applyScenes({ ...store }, result, slice, 1, undefined, opts).scenes[0];
  assert.equal(apply({}).charNotes, undefined);
  assert.deepEqual(apply({ notebook: true }).charNotes, [{ who: '빅터', kind: 'about', about: '세라', text: '세라는 단 걸 싫다면서 체리는 잘만 먹는다.', evidence: [{ number: 1, sentence: 1 }] }]);
});

test('fold: the same thought written again replaces the older one; edits, stars and deletions stay', () => {
  const scene = (id, notes) => ({ id, end: 1, charNotes: notes.map(([who, kind, text]) => ({ who, kind, text, evidence: [{ number: 1, sentence: 1 }] })) });
  const store = { scenes: [
    scene('S1', [['빅터', 'about', '세라는 단 걸 싫다면서 체리는 잘만 먹는다.'], ['빅터', 'heart', '세라를 다시는 혼자 두지 않겠다.']]),
    scene('S2', [['빅터', 'about', '세라는 단 걸 싫다면서 체리는 잘만 먹는구나.']]),
  ] };
  let file = Nb.fold(store, Nb.emptyNotebook());
  assert.deepEqual(file.notes.map((n) => n.text), ['세라를 다시는 혼자 두지 않겠다.', '세라는 단 걸 싫다면서 체리는 잘만 먹는구나.']);
  const vow = file.notes[0].id;
  file = Nb.fold(store, Nb.starNote(Nb.editNote(file, vow, '세라를 다시는 혼자 두지 않는다. 절대.'), vow, true));
  assert.equal(file.notes[0].text, '세라를 다시는 혼자 두지 않는다. 절대.');
  assert.equal(file.notes[0].edited, true);
  assert.equal(file.notes[0].star, true);
  file = Nb.fold(store, Nb.deleteNote(file, file.notes[1].id));
  assert.equal(file.notes.length, 1, 'a deleted note is not written back');
});

test('reply: the people in the scene only, ★ first, three each, with a note that the others do not know', () => {
  const notes = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, who: '빅터', kind: 'heart', text: `빅터 메모 ${i}.` })),
    { id: 'star', who: '빅터', kind: 'heart', text: '세라를 지킨다.', star: true },
    { id: 's1', who: '세라', kind: 'about', text: '빅터는 거짓말할 때 귀를 만진다.' },
    { id: 'm1', who: '마르코', kind: 'heart', text: '자리에 없음.' },
  ];
  const line = Nb.injectionBlock({ ...Nb.emptyNotebook(), notes }, ['빅터', '세라']);
  assert.match(line, /^\[수첩\] \(각 인물만 아는/);
  assert.match(line, /빅터: 세라를 지킨다\./, '★ first');
  assert.equal((line.match(/빅터 메모/g) || []).length, 2, 'three in all for one person');
  assert.match(line, /세라: 빅터는 거짓말할 때 귀를 만진다\./);
  assert.doesNotMatch(line, /마르코/);
  assert.equal(Nb.injectionBlock({ ...Nb.emptyNotebook(), notes }, ['미나']), '');
  // The line is kept in Korean when the memory goes in another language.
  assert.equal(T.planLines(line, 'en')[0].kind, 'keep');
});

test('service: the route edits, stars and deletes; refused while the feature is off; backups carry the notebook', async () => {
  const room = 'nb1';
  X.saveScenes(room, { ...S.emptyStore(), cast: ['빅터'], scenes: [{ id: 'S1', start: 1, end: 1, title: 't', summary: 's', events: [], recollections: [], present: ['빅터'], charNotes: [{ who: '빅터', kind: 'heart', text: '이번엔 늦지 않는다.', evidence: [{ number: 1, sentence: 1 }] }] }] });
  assert.match((await call('POST /chats/:id/notebook', room, { action: 'star', id: 'x' })).error, /인물의 수첩|꺼져/);
  X.saveSettings({ ...X.settings(), chats: { [room]: { enabled: true, features: { notebook: 'on' } } } });
  X.refreshWorld(room, X.loadScenes(room));
  const id = X.loadNotebook(room).notes[0].id;
  const starred = await call('POST /chats/:id/notebook', room, { action: 'star', id });
  assert.ifError(starred.error);
  assert.equal(starred.result.notes['빅터'][0].star, true);
  assert.equal((await call('POST /chats/:id/notebook', room, { action: 'edit', id, text: '이번엔 절대 늦지 않는다.' })).result.notes['빅터'][0].text, '이번엔 절대 늦지 않는다.');
  assert.match((await call('POST /chats/:id/notebook', room, { action: 'fly', id })).error, /edit, star, unstar, delete/);
  assert.deepEqual((await call('POST /chats/:id/notebook', room, { action: 'delete', id })).result.notes, {});
  const doc = B.build({ chatId: room, chatName: 'x', moduleVersion: 'x', files: { notebook: X.loadNotebook(room) }, settingsEntry: null });
  assert.doesNotThrow(() => B.validate(doc));
});

test('both installers copy the new file to the server', () => {
  for (const f of ['install.sh', 'install.ps1']) assert.ok(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').includes('memory-module/lib/notebook.cjs'), f);
});

test('the library: a notebook section per person, and the buttons are wired', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const start = source.indexOf('  function notebookPaper(');
  const fn = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, openLists: new Set(), ...require('./ui-shared.cjs')(source, esc) });
  const html = fn({ notebook: true, notes: { 빅터: [{ id: 'n1', who: '빅터', kind: 'about', about: '세라', text: '체리를 좋아한다.', star: true, sceneId: 'S1' }] }, sceneTitles: { S1: '체리' } }, '');
  assert.match(html, /인물의 수첩 · 1명/);
  assert.match(html, /빅터의 수첩<\/b> · 1개 · ★ 1/);
  assert.match(html, /알게 된 것[^]*세라에 대해/);
  assert.match(html, /data-act="noteUnstar"/);
  assert.equal(fn({ notebook: false }, ''), '');
  assert.ok(source.includes("'keepDelete', 'noteDelete',"), 'the delete confirmation survives the second click');
  assert.ok(source.includes("actName === 'noteStar' ? 'star' : 'unstar'"));
});
