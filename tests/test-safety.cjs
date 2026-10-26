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
