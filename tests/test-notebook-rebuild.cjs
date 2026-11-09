'use strict';
// 수첩만 다시 받기: the notes of scenes that are already made are read again from the chat (no organizing again), a few
// scenes per call, saved per scene, then folded into the notebook. Also: a display translation asked for while
// another Korean run is going is done right after it, not left for the next time the room is opened. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-nb-rebuild-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const Nb = require('../memory-module/lib/notebook.cjs');
const X = service._test;

const room = 'nbrebuild1';
const rows = [
  { id: 'm1', rowid: 1, role: 'user', content: '"오늘은 늦었네."', extra: JSON.stringify({ personaSnapshot: { name: 'Mina' } }) },
  { id: 'm2', rowid: 2, role: 'assistant', characterId: 'c-viktor', content: '빅터가 웃었다. "기다렸어."' },
  { id: 'm3', rowid: 3, role: 'user', content: '"체리 먹을래?"', extra: JSON.stringify({ personaSnapshot: { name: 'Mina' } }) },
  { id: 'm4', rowid: 4, role: 'assistant', characterId: 'c-viktor', content: '빅터는 체리를 받아 들었다. "단 건 싫은데, 네가 주니까."' },
  { id: 'm5', rowid: 5, role: 'user', content: '"우산은 두고 갈게."', extra: JSON.stringify({ personaSnapshot: { name: 'Mina' } }) },
  { id: 'm6', rowid: 6, role: 'assistant', characterId: 'c-viktor', content: '빅터는 문가에 남은 우산을 내려다봤다. "다음엔 내가 챙기지."' },
];
const prompts = [];
let answer = null;
const provider = { async chatComplete(messages) { prompts.push(messages); return { content: JSON.stringify(await answer(messages)) }; } };
X.setEngine({
  chats: { async listMessages() { return rows; }, async getById(id) { return { id, metadata: {} }; } },
  characters: { async getById(id) { return id === 'c-viktor' ? { data: JSON.stringify({ name: 'Viktor' }) } : null; } },
  connections: { async list() { return [{ id: 'conn', name: 'conn' }]; }, async getWithKey() { return { id: 'conn', provider: 'openai', model: 'm' }; } },
  resolveBaseUrl() { return 'http://localhost:1'; },
  createLLMProvider() { return provider; },
});

function scene(id, start, end, extra = {}) {
  return { id, start, end, messages: [], time: '', place: '방', title: `장면 ${id}`, summary: '둘이 이야기했다', present: ['Viktor', 'Mina'], events: [], ...extra };
}

test('only scenes with no notes are read again, and the notes go into the notebook', async () => {
  X.saveSettings({ ...X.settings(), connection: 'conn', autoTranslate: false, chats: { [room]: { enabled: true, features: { notebook: 'on' } } } });
  const store = { ...S.emptyStore(), cast: ['Viktor'], personas: ['Mina'], scenes: [
    scene('S1', 1, 2, { charNotes: [{ who: 'Viktor', kind: 'heart', when: '미나가 늦게 돌아왔을 때', text: '오늘도 기다린 보람이 있었다.', evidence: [{ number: 2, sentence: 2 }] }] }),
    scene('S2', 3, 4),
    // A note from before the situation line: this scene is read again too.
    scene('S3', 5, 6, { charNotes: [{ who: 'Viktor', kind: 'heart', text: '저 애가 또 웃었다.', evidence: [{ number: 6, sentence: 1 }] }] }),
  ] };
  X.saveScenes(room, store);
  answer = () => ({ scenes: [
    { id: 'S2', notebook: [{ who: 'Viktor', kind: 'about', about: 'Mina', when: '미나가 체리를 건넸을 때', text: '미나가 준 거라면 단 것도 먹게 되네.', evidence: ['4.2'] }] },
    { id: 'S3', notebook: [{ who: 'Viktor', kind: 'heart', when: '미나가 우산을 두고 갔을 때', text: '미나는 웃으면서 우산을 두고 갔다. 다음엔 내가 챙겨야지.', evidence: ['6.1'] }] },
  ] });
  const job = X.rebuildNotebook(room);
  await job.run;
  assert.equal(job.state, 'done', job.error || '');
  assert.equal(job.total, 2, 'S1 already has notes with their situation');
  assert.equal(job.kept, 2);
  assert.equal(X.loadScenes(room).scenes[2].charNotes[0].when, '미나가 우산을 두고 갔을 때', 'the old note without a situation is replaced');
  assert.equal(prompts.length, 1, 'one call for the scenes');
  const asked = prompts[0][1].content;
  assert.match(asked, /## S2/);
  assert.doesNotMatch(asked, /## S1/);
  assert.match(asked, /\[4\.2\] "단 건 싫은데, 네가 주니까\."/);
  assert.match(prompts[0][0].content, /장면마다 인물의 수첩만 적어/);
  const saved = X.loadScenes(room);
  assert.equal(saved.scenes[1].charNotes[0].text, '미나가 준 거라면 단 것도 먹게 되네.');
  assert.deepEqual(saved.scenes[1].charNotes[0].evidence, [{ number: 4, sentence: 2 }]);
  assert.equal(saved.scenes[0].charNotes.length, 1, 'the other scene is untouched');
  const notes = Nb.view(X.loadNotebook(room));
  assert.equal(notes.Viktor.length, 3);
  assert.equal(notes.Viktor.find((n) => n.sceneId === 'S2').when, '미나가 체리를 건넸을 때');
  assert.deepEqual(X.notebookJobStatus(room).state, 'done');
  assert.equal('run' in X.notebookJobStatus(room), false);
});

test('all: every scene is written again; a starred note stays; a note with no evidence from its scene is not kept', async () => {
  prompts.length = 0;
  // The user starred the first scene's note: it stays when that scene's notes are written again.
  const starred = Nb.view(X.loadNotebook(room)).Viktor.find((n) => n.sceneId === 'S1');
  X.saveNotebook(room, Nb.starNote(X.loadNotebook(room), starred.id, true));
  X.chatLangs.set(room, 'en'); // memory written in English: the notebook call still gets no language note
  answer = () => ({ scenes: [
    { id: 'S1', notebook: [{ who: 'Viktor', kind: 'heart', when: '미나가 늦어서 사과했을 때', text: '늦게 와도 괜찮다고 말해 줄 걸 그랬다.', evidence: ['2.2'] }] },
    { id: 'S2', notebook: [{ who: 'Viktor', kind: 'heart', when: '미나가 체리를 건넸을 때', text: '체리 맛이 아직 남아 있다.', evidence: ['1.1'] }] },
    { id: 'S3', notebook: [] },
  ] });
  const job = X.rebuildNotebook(room, { all: true });
  await job.run;
  assert.equal(job.state, 'done', job.error || '');
  assert.equal(job.total, 3);
  assert.equal(job.kept, 1);
  // The rebuild call carries no memory-language note (each character's notebook language is in the prompt).
  assert.ok(!prompts[0][1].content.includes('[기록 언어]'));
  assert.equal(job.stats.noEvidence, 1, '1.1 is not in S2');
  const saved = X.loadScenes(room);
  assert.deepEqual(saved.scenes[0].charNotes.map((n) => n.text), ['오늘도 기다린 보람이 있었다.', '늦게 와도 괜찮다고 말해 줄 걸 그랬다.']);
  assert.equal(saved.scenes[1].charNotes, undefined, 'its old note is replaced by none');
  assert.ok(Nb.view(X.loadNotebook(room)).Viktor.find((n) => n.id === starred.id)?.star);
});

test('the notes already written that the model sees are those of earlier scenes only', () => {
  const store = { scenes: [
    { id: 'S1', charNotes: [{ who: 'Viktor', text: 'early' }] },
    { id: 'S2', charNotes: [{ who: 'Viktor', text: 'middle' }] },
    { id: 'S3', charNotes: [{ who: 'Viktor', text: 'late' }] },
  ] };
  assert.deepEqual(Nb.priorNotes(store, ['Viktor']), { Viktor: ['late', 'middle', 'early'] });
  assert.deepEqual(Nb.priorNotes(store, ['Viktor'], undefined, { before: 'S2' }), { Viktor: ['early'] });
  assert.deepEqual(Nb.priorNotes(store, ['Viktor'], undefined, { before: 'S1' }), {});
});

test('a rebuild of a middle scene: no later note in the prompt, and a later scene\'s note does not block it', async () => {
  prompts.length = 0;
  const store = X.loadScenes(room);
  store.scenes[2].charNotes = [{ who: 'Viktor', kind: 'heart', when: '나중 장면', text: '아주 나중에야 알게 되는 비밀.', evidence: [{ number: 6, sentence: 1 }] }];
  delete store.scenes[1].charNotes;
  X.saveScenes(room, store);
  answer = () => ({ scenes: [{ id: 'S2', notebook: [{ who: 'Viktor', kind: 'heart', when: '미나가 체리를 건넸을 때', text: '아주 나중에야 알게 되는 비밀.', evidence: ['4.2'] }] }] });
  const job = X.rebuildNotebook(room);
  await job.run;
  assert.equal(job.state, 'done', job.error || '');
  assert.ok(!prompts[0][0].content.includes('아주 나중에야'), 'a later scene\'s note is not shown');
  assert.equal(X.loadScenes(room).scenes[1].charNotes?.[0]?.text, '아주 나중에야 알게 되는 비밀.', 'not taken for a repeat');
});

test('a failed call stops the job with the reason; the notes stay as they were', async () => {
  const before = JSON.stringify(X.loadScenes(room).scenes.map((sc) => sc.charNotes));
  answer = () => { throw Error('rate limited'); };
  const job = X.rebuildNotebook(room, { all: true });
  await job.run;
  assert.equal(job.state, 'error');
  assert.match(job.error, /rate limited/);
  assert.equal(JSON.stringify(X.loadScenes(room).scenes.map((sc) => sc.charNotes)), before);
});

test('the route needs the notebook on; stop asks the running job to stop', async () => {
  const handlers = {};
  const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
  service.attach(app);
  const call = async (id, body) => {
    let error = null;
    const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
    const result = await handlers['POST /chats/:id/notebook/rebuild']({ params: { id }, body }, reply);
    return { result, error };
  };
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, other: { enabled: true } } });
  assert.ok((await call('other', {})).error, 'notebook off');
  answer = () => ({ scenes: [] });
  const { result } = await call(room, { all: true });
  assert.equal(result.notebookJob.state, 'running');
  assert.equal('run' in result.notebookJob, false);
  const stopped = await call(room, { stop: true });
  assert.equal(stopped.result.notebookJob.state, 'running', 'it stops after the call it is on');
  for (let i = 0; i < 400 && X.notebookJobStatus(room).state === 'running'; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(X.notebookJobStatus(room).state, 'stopped');
});

test('display translation: lines asked for while another Korean run is going are translated right after it', async () => {
  const room2 = 'dispcont1';
  X.saveSettings({ ...X.settings(), connection: 'conn', autoTranslate: true, chats: { ...X.settings().chats, [room2]: { enabled: true } } });
  X.chatLangs.set(room2, 'en'); // an English chat: its memory is written in English
  X.saveScenes(room2, { ...S.emptyStore(), scenes: [scene('S1', 1, 2, { title: 'The quiet bakery', summary: 'They shared bread at dawn.' })] });
  const asked = [];
  let release;
  answer = (messages) => {
    const lines = JSON.parse(messages[1].content).lines || [];
    asked.push(...lines);
    const out = { lines: lines.map((l) => `[ko] ${l}`) };
    // The first run waits until the second ask has come in.
    return asked.length === lines.length ? new Promise((r) => { release = () => r(out); }) : out;
  };
  assert.equal(X.translateDisplayLater(room2), true);
  while (!release) await new Promise((r) => setTimeout(r, 5));
  // A new scene while the first run is still going: not started now, but not lost.
  const store = X.loadScenes(room2);
  store.scenes.push(scene('S2', 3, 4, { title: 'The broken lantern', summary: 'The lantern fell into the river.' }));
  X.saveScenes(room2, store);
  assert.equal(X.translateDisplayLater(room2), false);
  release();
  const lookup = () => X.translationLookup(room2, 'ko');
  for (let i = 0; i < 400 && lookup()('The lantern fell into the river.') == null; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(lookup()('They shared bread at dawn.'), '[ko] They shared bread at dawn.');
  assert.equal(lookup()('The lantern fell into the river.'), '[ko] The lantern fell into the river.');
});
