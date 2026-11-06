'use strict';
// node --test tests/test-alias-text.cjs
// An alias that a merge left in running text can be written as a form the user types: running text only, never quoted
// lines, name fields or hand-edited items; recorded in the rename history with undo; refused while a job writes the room.
// Invented names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-alias-text-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const T = service._test;
const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
T.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const call = async (key, id, body) => {
  let error = null;
  const reply = { status() { return { send(x) { error = x.error; return x; } }; } };
  const result = await handlers[key]({ params: { id }, body }, reply);
  return { result, error };
};

const FULL = '리나 벨', ALIAS = '리나', SHOW = '린아', OTHER = '리나스', PERSONA = '유온';

function seed(room) {
  const store = Object.assign(S.emptyStore(), { cast: [FULL, OTHER], personas: [PERSONA] });
  const line = { number: 1, sentence: 1, text: `"${ALIAS}야, 이리 와." (${ALIAS}에게)`, by: ALIAS, to: PERSONA };
  const manualLine = { number: 1, sentence: 2, text: `"${ALIAS}는 안 와."`, by: PERSONA, to: ALIAS, manual: true };
  store.scenes.push({ id: 'S1', start: 1, end: 1, title: `${ALIAS}의 편지`, summary: `${ALIAS}는 ${PERSONA}에게 편지를 줬다. ${FULL}이 웃었다. ${OTHER}는 지켜보았다.`, present: [ALIAS, PERSONA], events: [{ text: `${ALIAS}가 웃었다`, quotes: [line, manualLine] }], recollections: [{ who: ALIAS, text: `${ALIAS}는 기뻤다.`, remembers: 'full' }] });
  store.scenes.push({ id: 'S2', start: 2, end: 2, title: '손본 장면', summary: `${ALIAS}는 손으로 고친 글이다.`, edited: true, present: [], events: [], recollections: [] });
  store.facts.push({ id: 'F1', about: FULL, text: `${ALIAS}는 비 오는 날을 싫어한다.`, evidence: [] });
  store.facts.push({ id: 'F2', about: FULL, text: `${ALIAS}는 손으로 고친 사실이다.`, evidence: [], edited: true });
  store.chapters.push({ id: 'C1', title: '1장', summary: `${ALIAS}가 떠났다.`, turns: [`${ALIAS}가 돌아왔다.`], keep: [] });
  const ledger = L.emptyLedger();
  ledger.threads = [{ id: 'T1', title: `${ALIAS}의 부탁`, who: `${ALIAS}·${PERSONA}`, detail: `${ALIAS}가 ${PERSONA}에게 부탁했다.` }];
  T.saveScenes(room, store);
  T.saveLedger(room, ledger);
  const t = A.emptyTable();
  A.addPerson(t, FULL, [ALIAS]);
  T.saveNames(room, t);
}
const body = { alias: ALIAS, display: SHOW };

test('the preview counts running text per area with samples and saves nothing', async () => {
  seed('a1');
  const p = await call('POST /chats/:id/names/alias-text-preview', 'a1', body);
  assert.ifError(p.error);
  assert.ok(p.result.counts.events >= 4, 'title, summary, event text, recollection');
  assert.ok(p.result.counts.facts >= 1 && p.result.counts.chapters >= 2 && p.result.counts.threads >= 1);
  assert.equal(p.result.counts.quoteBy + p.result.counts.quoteTo, 0, 'name fields and quoted lines are not counted');
  assert.ok(p.result.samples.length > 0);
  assert.equal(T.loadScenes('a1').scenes[0].title, `${ALIAS}의 편지`);
  assert.match((await call('POST /chats/:id/names/alias-text-apply', 'a1', body)).error, /미리 보기를 확인/);
  assert.match((await call('POST /chats/:id/names/alias-text-apply', 'a1', { ...body, confirm: true, token: 'stale' })).error, /미리 본 뒤에/);
});

test('only an alias of the name table can be chosen', async () => {
  seed('a2');
  assert.match((await call('POST /chats/:id/names/alias-text-preview', 'a2', { alias: PERSONA, display: SHOW })).error, /별칭/);
  assert.match((await call('POST /chats/:id/names/alias-text-preview', 'a2', { alias: FULL, display: SHOW })).error, /별칭/);
  assert.match((await call('POST /chats/:id/names/alias-text-preview', 'a2', { alias: ALIAS, display: ALIAS })).error, /같은/);
  assert.match((await call('POST /chats/:id/names/alias-text-preview', 'a2', { alias: ALIAS, display: '' })).error, /모두 적어/);
});

test('apply rewrites running text only, keeps particles right, protects longer names, then undo restores it', async () => {
  seed('a3');
  const p = (await call('POST /chats/:id/names/alias-text-preview', 'a3', body)).result;
  const a = await call('POST /chats/:id/names/alias-text-apply', 'a3', { ...body, confirm: true, token: p.token });
  assert.ifError(a.error);
  const store = T.loadScenes('a3');
  const [s1, s2] = store.scenes;
  assert.equal(s1.title, `${SHOW}의 편지`);
  assert.equal(s1.summary, `${SHOW}는 ${PERSONA}에게 편지를 줬다. ${FULL}이 웃었다. ${OTHER}는 지켜보았다.`, 'the full name and a longer name are left alone; no doubled name');
  assert.equal(s1.events[0].text, `${SHOW}가 웃었다`);
  assert.equal(s1.recollections[0].text, `${SHOW}는 기뻤다.`);
  // Quoted lines, their speakers and listeners, name fields.
  assert.equal(s1.events[0].quotes[0].text, `"${ALIAS}야, 이리 와." (${ALIAS}에게)`);
  assert.equal(s1.events[0].quotes[0].by, ALIAS);
  assert.equal(s1.events[0].quotes[1].text, `"${ALIAS}는 안 와."`);
  assert.deepEqual(s1.present, [ALIAS, PERSONA]);
  assert.equal(s1.recollections[0].who, ALIAS);
  // Hand-edited items.
  assert.equal(s2.summary, `${ALIAS}는 손으로 고친 글이다.`);
  assert.equal(store.facts[0].text, `${SHOW}는 비 오는 날을 싫어한다.`);
  assert.equal(store.facts[1].text, `${ALIAS}는 손으로 고친 사실이다.`);
  assert.equal(store.facts[0].about, FULL);
  assert.equal(store.chapters[0].summary, `${SHOW}가 떠났다.`);
  assert.deepEqual(store.chapters[0].turns, [`${SHOW}가 돌아왔다.`]);
  const ledger = T.loadLedger('a3');
  assert.equal(ledger.threads[0].title, `${SHOW}의 부탁`);
  assert.equal(ledger.threads[0].who, `${ALIAS}·${PERSONA}`);
  assert.equal(ledger.threads[0].detail, `${SHOW}가 ${PERSONA}에게 부탁했다.`);
  // History and table.
  const names = (await call('GET /chats/:id/names', 'a3')).result;
  assert.equal(names.history.length, 1);
  assert.equal(names.history[0].kind, 'alias-text');
  assert.deepEqual(names.people[FULL].aliases, [ALIAS], 'the table is not changed by it');
  // A second run has nothing left to change.
  assert.match((await call('POST /chats/:id/names/alias-text-apply', 'a3', { ...body, confirm: true, token: (await call('POST /chats/:id/names/alias-text-preview', 'a3', body)).result.token })).error, /바꿀 곳이 없습니다/);
  const u = await call('POST /chats/:id/names/undo', 'a3');
  assert.ifError(u.error);
  const back = T.loadScenes('a3');
  assert.equal(back.scenes[0].title, `${ALIAS}의 편지`);
  assert.equal(back.scenes[0].summary, `${ALIAS}는 ${PERSONA}에게 편지를 줬다. ${FULL}이 웃었다. ${OTHER}는 지켜보았다.`);
  assert.equal(back.facts[0].text, `${ALIAS}는 비 오는 날을 싫어한다.`);
  assert.equal(T.loadLedger('a3').threads[0].detail, `${ALIAS}가 ${PERSONA}에게 부탁했다.`);
  assert.equal((await call('GET /chats/:id/names', 'a3')).result.history.length, 0);
});

test('refused while a job writes the room', async () => {
  seed('a4');
  const p = (await call('POST /chats/:id/names/alias-text-preview', 'a4', body)).result;
  T.sceneJobs.set('a4', { state: 'running' });
  assert.match((await call('POST /chats/:id/names/alias-text-apply', 'a4', { ...body, confirm: true, token: p.token })).error, /정리하는 중/);
  T.sceneJobs.delete('a4');
  assert.equal(T.loadScenes('a4').scenes[0].title, `${ALIAS}의 편지`);
});

test('the rename tab offers the action per alias and the built extension carries it', () => {
  for (const file of ['../extension/runtime.js', '../deliverable/extension.js']) {
    const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(code, /글 속 표기 바꾸기/, file);
    assert.match(code, /names\/alias-text-preview/, file);
    assert.match(code, /names\/alias-text-apply/, file);
  }
});

test('every two-click button keeps its armed state across the render in between', () => {
  // A button that arms on the first click re-renders; the click handler clears `armed` for any act not on its keep list,
  // so a missing act could never reach its second click (aliasApply once did).
  const code = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  const keep = code.split('\n').find((l) => l.includes("actName !== 'fresh'"));
  assert.ok(keep, 'keep-list line not found');
  const armedActs = [...code.matchAll(/if \(armed !== '(\w+)'\)/g)].map((m) => { const c = code.slice(0, m.index).match(/case '(\w+)':(?![\s\S]*case '\w+':)/); return c && c[1]; }).filter(Boolean);
  for (const act of ['nameApply', 'mergeApply', 'aliasApply', 'nameUndo']) {
    assert.ok(armedActs.includes(act), `${act} should be a two-click act`);
    assert.ok(keep.includes(`'${act}'`), `${act} is missing from the armed keep list`);
  }
  for (const act of armedActs) assert.ok(keep.includes(`'${act}'`), `${act} is missing from the armed keep list`);
});