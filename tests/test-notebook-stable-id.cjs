'use strict';
// A notebook note keeps its id when its text is rewritten (language fix), so the user's edit, star and deletion still
// find it; notes the user touched are not rewritten. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-nbid-'));
const service = require('../memory-module/lib/service.cjs');
const Nb = require('../memory-module/lib/notebook.cjs');
const X = service._test;

const mk = () => ({ scenes: [{ id: 'S1', end: 3, charNotes: [
  { who: '빅터', kind: 'heart', text: '세라를 다시는 혼자 두지 않겠다.', evidence: [] },
  { who: '빅터', kind: 'about', text: '세라는 단 걸 싫어한다.', evidence: [] },
] }] });

test('pinIds fixes the id before a rewrite; fold, edits, stars and deletions follow the pinned id', () => {
  const store = mk();
  let file = Nb.fold(store, Nb.emptyNotebook());
  const [vow, sweet] = file.notes.map((n) => n.id);
  assert.equal(Nb.pinIds(store), 2);
  assert.equal(Nb.pinIds(store), 0, 'pinned once');
  file = Nb.fold(store, Nb.starNote(Nb.editNote(file, vow, '세라를 혼자 두지 않는다. 절대.'), vow, true));
  file = Nb.fold(store, Nb.deleteNote(file, sweet));
  // The text is rewritten later (new wording, same note).
  store.scenes[0].charNotes[0].text = '세라를 다시는 혼자 두지 않겠다 (고침).';
  store.scenes[0].charNotes[1].text = '세라는 단 것을 싫어한다 (고침).';
  const again = Nb.fold(store, file);
  assert.equal(again.notes.length, 1, 'the deleted note stays deleted');
  assert.equal(again.notes[0].id, vow);
  assert.equal(again.notes[0].text, '세라를 혼자 두지 않는다. 절대.');
  assert.equal(again.notes[0].star, true);
  assert.equal(Nb.userKept(again, store.scenes[0]).length, 1, 'the starred/edited note is kept by its id');
});

test('without pinning, the old behaviour (hash of the text) still works for old data', () => {
  const store = mk();
  const file = Nb.fold(store, null);
  assert.match(file.notes[0].id, /^nb_[0-9a-f]{10}$/);
});

test('fixNoteLanguages skips notes the user touched and pins ids first', async () => {
  const chatId = 'chat-nbid';
  const store = mk();
  store.scenes[0].charNotes[0].wantLang = 'en';
  store.scenes[0].charNotes[1].wantLang = 'en';
  let file = Nb.fold(store, Nb.emptyNotebook());
  file = Nb.starNote(file, file.notes[0].id, true);
  X.saveNotebook(chatId, file);
  X.setEngine({ chats: {}, connections: { async list() { return []; } } });
  await X.fixNoteLanguages(chatId, store, null).catch(() => {});
  assert.ok(store.scenes[0].charNotes.every((n) => /^nb_/.test(n.id)), 'ids pinned');
  assert.equal(store.scenes[0].charNotes[0].wantLang, 'en', 'the starred note is left alone (no rewrite attempt)');
});
