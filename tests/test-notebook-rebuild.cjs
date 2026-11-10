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

test('several calls at a time: at most three in flight, saved in story order, nothing after a failed one', async () => {
  const par = 'nbpar1';
  X.saveSettings({ ...X.settings(), connection: 'conn', autoTranslate: false, chats: { ...X.settings().chats, [par]: { enabled: true, features: { notebook: 'on' } } } });
  // Long messages: each scene is a call of its own.
  const long = (n) => `빅터는 창가에 서서 비 오는 거리를 오래 내려다봤다. `.repeat(n);
  const extra = [];
  for (let i = 0; i < 10; i++) extra.push({ id: `p${i}`, rowid: 100 + i, role: 'assistant', characterId: 'c-viktor', content: `${long(300)}"우산은 내가 챙기지."` });
  rows.push(...extra);
  const ids = ['S1', 'S2', 'S3', 'S4', 'S5'];
  const TEXTS = { S1: '미나는 비 오는 날 늘 우산을 잊음.', S2: '창가에 서 있으면 마음이 가라앉는다고 느낌.', S3: '다음 주 생일에는 꽃을 사 가기로 함.', S4: '거리의 가로등이 고장 난 걸 신고하기로 함.', S5: '오래된 시계를 고쳐 두기로 마음먹음.' };
  X.saveScenes(par, { ...S.emptyStore(), cast: ['Viktor'], personas: ['Mina'], scenes: ids.map((id, i) => scene(id, 100 + i * 2, 101 + i * 2)) });
  let inFlight = 0, most = 0;
  // 80 ms in: S2~S4 answered, S1 not yet.
  const saveOrder = [];
  const run = async (failOn) => {
    answer = async (messages) => {
      const id = /## (S\d)/.exec(messages[1].content)[1];
      inFlight++; most = Math.max(most, inFlight);
      // The first scene answers last.
      await new Promise((r) => setTimeout(r, id === 'S1' ? 200 : 10));
      inFlight--;
      if (id === failOn) throw Error('rate limited');
      return { scenes: [{ id, notebook: [{ who: 'Viktor', kind: 'heart', when: `${id}에서 비가 올 때`, text: TEXTS[id], evidence: [`${100 + ids.indexOf(id) * 2 + 1}.1`] }] }] };
    };
    const job = X.rebuildNotebook(par, { all: true });
    // While the first scene is still being answered, the later ones (answered already) are not saved yet.
    await new Promise((r) => setTimeout(r, 80));
    saveOrder.push(X.loadScenes(par).scenes.filter((sc) => sc.charNotes?.length).length);
    await job.run;
    return job;
  };
  const job = await run(null);
  assert.equal(job.state, 'done', job.error || '');
  assert.equal(job.calls >= 5, true);
  assert.equal(most, 3, 'three at a time');
  assert.equal(saveOrder[0], 0, 'nothing saved before the first scene is in');
  // A failure in the middle: the ones before it are saved, nothing after it.
  for (const sc of X.loadScenes(par).scenes) assert.ok(sc.charNotes?.length);
  const st = X.loadScenes(par);
  for (const sc of st.scenes) delete sc.charNotes;
  X.saveScenes(par, st);
  const failed = await run('S3');
  assert.equal(failed.state, 'error');
  assert.match(failed.error, /rate limited/);
  assert.deepEqual(X.loadScenes(par).scenes.map((sc) => !!sc.charNotes?.length), [true, true, false, false, false]);
  assert.equal(failed.done, 2);
  rows.splice(rows.length - extra.length, extra.length);
});

test('수첩 언어: one language for everyone, or each one\'s own; the route saves it and the scene call follows it', async () => {
  // The language map
  assert.deepEqual(Nb.langsFor({ Viktor: ['Sit.'] }, ['Viktor', 'Sera'], 'en'), { Viktor: 'en', Sera: 'en' });
  assert.deepEqual(Nb.langsFor({ Viktor: ['Sit.'], Sera: ['싫어.'] }, ['Viktor', 'Sera'], 'character'), { Viktor: 'en', Sera: 'ko' });
  // The scene prompt and the notes it keeps
  const slice = require('../memory-module/lib/ledger.cjs').prepareMessages([{ id: 'x1', number: 1, role: 'assistant', speaker: 'Narrator', content: 'Viktor | "앉아." 비가 왔다.' }]);
  const store = { ...S.emptyStore(), cast: ['Viktor'] };
  assert.match(S.buildScenePrompt(store, slice, 1, null, { notebook: true, notebookLang: 'en' })[0].content, /\[수첩 언어\] 모두 English/);
  assert.match(S.buildScenePrompt(store, slice, 1, null, { notebook: true })[0].content, /\[수첩 언어\] Viktor: 한국어/);
  const result = { scenes: [{ end: 1, time: 't', place: 'p', title: 't', summary: 's', present: ['Viktor'], events: [{ text: 'e', quotes: [] }], recollections: [], facts: [], notebook: [{ who: 'Viktor', kind: 'heart', when: '비가 올 때', text: '비 오는 날엔 창문을 닫아 두기로 함.', evidence: ['1.2'] }] }] };
  assert.equal(S.applyScenes(store, result, slice, 1, undefined, { notebook: true, notebookLang: 'en' }).scenes[0].charNotes[0].wantLang, 'en', 'a Korean note in an English notebook is rewritten');
  // The setting: the memory's language by default
  const lang = 'nblang1';
  X.saveSettings({ ...X.settings(), writeLanguage: 'en', chats: { ...X.settings().chats, [lang]: { enabled: true, features: { notebook: 'on' } } } });
  assert.equal(X.notebookLanguageSetting(lang), 'write');
  assert.equal(X.notebookLanguageOf(lang), 'en');
  const handlers = {};
  const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
  service.attach(app);
  const reply = { status() { return { send(x) { return x; } }; } };
  const view = await handlers['POST /chats/:id/notebook/language']({ params: { id: lang }, body: { language: 'character' } }, reply);
  assert.equal(view.notebookLanguage, 'character');
  assert.equal(X.notebookLanguageOf(lang), 'character');
  await handlers['POST /chats/:id/notebook/language']({ params: { id: lang }, body: { language: 'write' } }, reply);
  assert.equal(X.settings().chats[lang].notebookLanguage, undefined);
  X.saveSettings({ ...X.settings(), writeLanguage: undefined });
});

test('a note that points at someone without a name ("그 애", "저 녀석") is rewritten with the name', async () => {
  const opts = { cast: ['Viktor', 'Sera'], person: (n) => n };
  assert.equal(Nb.cleanNote({ who: 'Viktor', kind: 'about', about: 'Sera', when: '부두에서', text: '그 애는 비가 오면 꼭 우산을 잊음.' }, opts).vague, true);
  assert.equal(Nb.cleanNote({ who: 'Viktor', kind: 'about', about: 'Sera', when: '부두에서', text: '세라는 비가 오면 꼭 우산을 잊음. 애정이 가는 버릇임.' }, opts).vague, undefined);
  const vroom = 'nbvague1';
  X.saveSettings({ ...X.settings(), connection: 'conn', chats: { ...X.settings().chats, [vroom]: { enabled: true, features: { notebook: 'on' } } } });
  const store = { ...S.emptyStore(), cast: ['Viktor', 'Sera'], scenes: [scene('S1', 1, 2, { charNotes: [{ who: 'Viktor', kind: 'about', about: 'Sera', when: '부두에서 비가 올 때', text: '그 애는 비가 오면 꼭 우산을 잊음.', vague: true, evidence: [] }] })] };
  let asked = null;
  answer = (messages) => { asked = JSON.parse(messages[1].content); return { lines: [{ when: '부두에서 비가 올 때', text: '세라는 비가 오면 꼭 우산을 잊음.' }] }; };
  await X.fixNoteLanguages(vroom, store, null);
  assert.deepEqual(asked.people, ['Viktor', 'Sera']);
  assert.equal(asked.notes[0].about, 'Sera');
  assert.equal(asked.notes[0].lang, 'ko', 'asked in its own language');
  assert.equal(store.scenes[0].charNotes[0].text, '세라는 비가 오면 꼭 우산을 잊음.');
  assert.equal('vague' in store.scenes[0].charNotes[0], false);
});

test('the notebook is not the facts: a note that only says a fact is dropped; the rebuild shows the scene\'s facts', () => {
  // The check
  assert.ok(Nb.isFact('Sera only remembers the people who turn her down.', ['Remembers only the people who turn her down; forgets the rest after a kiss.']));
  assert.ok(!Nb.isFact('So I will not say yes to Sera right away.', ['Remembers only the people who turn her down; forgets the rest after a kiss.']));
  // In a scene call: a fact written in the same answer, or one known before, is not a note too.
  const slice = require('../memory-module/lib/ledger.cjs').prepareMessages([{ id: 'f1', number: 1, role: 'assistant', speaker: 'Narrator', content: 'Sera laughed at the bar and ordered another round. Viktor said nothing.' }]);
  const store = { ...S.emptyStore(), cast: ['Viktor', 'Sera'], facts: [{ id: 'F1', about: 'Sera', text: 'Sera hates the rain and stays in when it pours.', sceneId: 'S0' }] };
  const result = { scenes: [{ end: 1, time: 't', place: 'p', title: 't', summary: 's', present: ['Viktor', 'Sera'], events: [{ text: 'e', quotes: [] }], recollections: [],
    facts: [{ about: 'Sera', text: 'Sera remembers only the people who turn her down.', evidence: ['1.1'] }],
    notebook: [
      { who: 'Viktor', kind: 'about', about: 'Sera', when: 'When Sera laughed at the bar', text: 'Sera remembers only the people who turn her down.', evidence: ['1.1'] },
      { who: 'Sera', kind: 'heart', when: 'When it rained at the bar', text: 'Sera hates the rain and stays in when it pours.', evidence: ['1.1'] },
    ] }] };
  const stats = {};
  const notes = S.applyScenes(store, result, slice, 1, undefined, { notebook: true, notebookLang: 'en', notebookStats: stats }).scenes[0].charNotes;
  assert.equal(notes, undefined, 'both only say a fact');
  assert.equal(stats.isFact, 2);
  // The rebuild prompt lists each scene's facts.
  const [system, user] = Nb.buildRebuildPrompt([{ scene: { id: 'S1', title: 't' }, messages: slice }], { facts: { S1: ['Sera hates the rain.'] } });
  assert.match(user.content, /## S1[^]*\[이 장면의 알게 된 사실\] \(수첩에 다시 적지 마\)\n- Sera hates the rain\./);
  assert.match(system.content, /수첩은 사실을 적는 곳이 아니야/);
  assert.equal(Nb.KIND_LABEL.about, '대하는 법');
});

test('a rewrite that still names its owner is asked again; a clean one is kept', async () => {
  const room = 'nbself2';
  X.saveSettings({ ...X.settings(), connection: 'conn', chats: { ...X.settings().chats, [room]: { enabled: true, features: { notebook: 'on' } } } });
  const store = { ...S.emptyStore(), cast: ['Viktor', 'Sera'], scenes: [scene('S1', 1, 2, { charNotes: [{ who: 'Viktor', kind: 'about', about: 'Sera', when: 'At the pier', text: 'Sera bolts, so Viktor should wait.', vague: true, evidence: [] }] })] };
  answer = () => ({ lines: [{ when: 'At the pier', text: 'Sera bolts when pressed, so Viktor will wait.' }] });
  await X.fixNoteLanguages(room, store, null);
  assert.equal(store.scenes[0].charNotes[0].vague, true, 'still names Viktor: asked again');
  answer = () => ({ lines: [{ when: 'At the pier', text: 'Sera bolts when pressed, so I will wait.' }] });
  await X.fixNoteLanguages(room, store, null);
  assert.equal(store.scenes[0].charNotes[0].text, 'Sera bolts when pressed, so I will wait.');
  assert.equal('vague' in store.scenes[0].charNotes[0], false);
});

test('names left in another script in saved notes are fixed with no model call', async () => {
  const A = require('../memory-module/lib/aliases.cjs');
  const room = 'nbnames1';
  X.saveSettings({ ...X.settings(), connection: null, chats: { ...X.settings().chats, [room]: { enabled: true, features: { notebook: 'on' } } } });
  X.saveNames(room, { version: 1, people: { 세라: { aliases: ['Sera'] }, 빅터: { aliases: ['Viktor'] } } });
  const store = { ...S.emptyStore(), cast: ['빅터', '세라'], scenes: [scene('S1', 1, 2, { charNotes: [{ who: '빅터', kind: 'about', about: '세라', when: 'When 세라 sat down', text: 'Learned that 세라 hates waiting.', evidence: [] }] })] };
  prompts.length = 0;
  await A.using(room, () => X.fixNoteLanguages(room, store, null));
  assert.equal(store.scenes[0].charNotes[0].text, 'Learned that Sera hates waiting.');
  assert.equal(store.scenes[0].charNotes[0].when, 'When Sera sat down');
  assert.equal(prompts.length, 0, 'no model call');
});

test('a saved note whose situation line is in another language is rewritten too, and given up on after two tries', async () => {
  const room = 'nbwhen1';
  X.saveSettings({ ...X.settings(), connection: 'conn', chats: { ...X.settings().chats, [room]: { enabled: true, features: { notebook: 'on' } } } });
  const note = () => ({ who: 'Viktor', kind: 'about', about: 'Sera', when: '세라가 부두에서 도망쳤을 때', text: 'Sera bolts when pressed, so I will wait.', evidence: [] });
  let store = { ...S.emptyStore(), cast: ['Viktor', 'Sera'], scenes: [scene('S1', 1, 2, { charNotes: [note()] })] };
  prompts.length = 0;
  answer = () => ({ lines: [{ when: 'When Sera ran from the pier', text: 'Sera bolts when pressed, so I will wait.' }] });
  await X.fixNoteLanguages(room, store, null);
  assert.equal(prompts.length, 1, 'no wantLang mark, still asked');
  assert.equal(store.scenes[0].charNotes[0].when, 'When Sera ran from the pier');
  prompts.length = 0;
  await X.fixNoteLanguages(room, store, null);
  assert.equal(prompts.length, 0, 'fixed: not asked again');
  // An answer that keeps the Korean line twice: left as it is, and not asked every run after that.
  store = { ...S.emptyStore(), cast: ['Viktor', 'Sera'], scenes: [scene('S1', 1, 2, { charNotes: [note()] })] };
  answer = () => ({ lines: [{ when: '세라가 부두에서 도망쳤을 때', text: 'Sera bolts when pressed, so I will wait.' }] });
  await X.fixNoteLanguages(room, store, null);
  await X.fixNoteLanguages(room, store, null);
  prompts.length = 0;
  await X.fixNoteLanguages(room, store, null);
  assert.equal(prompts.length, 0);
  assert.equal(store.scenes[0].charNotes[0].langGaveUp, true);
});
