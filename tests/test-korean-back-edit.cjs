'use strict';
// Correcting the Korean of an English memory note: the prompt sends the English, the Korean before and after, and the
// names the other way round (Korean → Latin); the answer is read one line per note; the endpoint refuses bad input and
// does not call the model when the Korean did not change. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-back-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const Tr = require('../memory-module/lib/translate.cjs');
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

test('the prompt carries the note, the Korean before and after, and Korean names written back in Latin', () => {
  const items = [{ en: "Daniel's anger over the forged ledger", before: '위조 장부에 대한 다니엘의 분노', after: '위조 장부와 거짓말에 대한 다니엘의 분노' }];
  const [system, user] = Tr.buildBackPrompt(items, { names: [{ from: 'Daniel', to: '다니엘' }, { from: 'Sera', to: '세라' }] });
  assert.match(system.content, /Change the English only where "after" differs/);
  assert.deepEqual(JSON.parse(user.content), { names: { 다니엘: 'Daniel' }, items });
});

test('the answer is read one English line per note; a missing, empty or runaway line fails the whole answer', () => {
  const items = [{ en: 'Short note.', after: '짧은 메모.' }, { en: 'Another.', after: '하나 더.' }];
  assert.deepEqual(Tr.readBack({ lines: ['Short note, changed.', 'Another.'] }, items), ['Short note, changed.', 'Another.']);
  assert.equal(Tr.readBack({ lines: ['only one'] }, items), null);
  assert.equal(Tr.readBack({ lines: ['ok', ''] }, items), null);
  assert.equal(Tr.readBack({ lines: ['ok', 'x'.repeat(500)] }, items), null);
});

test('the endpoint refuses empty or oversized input, and returns the note as it is when the Korean did not change', async () => {
  assert.match((await call('POST /chats/:id/translations/back', 'b1', { items: [] })).error, /고친 번역이 없습니다/);
  assert.match((await call('POST /chats/:id/translations/back', 'b1', { items: [{ en: 'x', ko: '' }] })).error, /비어 있거나/);
  assert.match((await call('POST /chats/:id/translations/back', 'b1', { items: Array.from({ length: 31 }, () => ({ en: 'x', ko: 'y' })) })).error, /30개/);
  const data = structuredClone(X.loadTranslations('b1'));
  data.items[Tr.key('ko', 'Sera kept the letters.')] = '세라가 편지를 간직함.';
  X.saveTranslations('b1', data);
  // No connection is set: a changed Korean would need the model, an unchanged one does not.
  const same = await call('POST /chats/:id/translations/back', 'b1', { items: [{ en: 'Sera kept the letters.', ko: '세라가 편지를 간직함.' }] });
  assert.ifError(same.error);
  assert.deepEqual(same.result, { items: [{ en: 'Sera kept the letters.' }], changed: 0 });
  assert.match((await call('POST /chats/:id/translations/back', 'b1', { items: [{ en: 'Sera kept the letters.', ko: '세라가 편지를 태움.' }] })).error, /연결을 설정/);
});

test('the library: memory notes get an editable Korean box, story quotes keep the read-only note, saves apply corrections first', () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  for (const x of ['a.title', 'a.summary', 'c.title', 'c.summary', 'e.text', 'e.why', 'r.text', 's.title', 's.summary', 'f.text', 't.title', 't.detail', 't.need']) assert.ok(src.includes('${trEdit(' + x + ')}'), x);
  assert.ok(src.includes('trNote(q.text)') && !src.includes('trEdit(q.text)'), 'quotes stay read-only');
  // act() draws the screen again before it runs: a save must read its form (and the Korean boxes) before act(), or it
  // saves what was on screen before the edit (the 0.15.0 bug).
  for (const act of ['saveArc', 'saveChapter', 'saveScene', 'saveFact', 'editThread']) {
    const at = src.indexOf(`case '${act}'`);
    const block = src.slice(at, src.indexOf("        return act(", at) + 400);
    const actAt = block.indexOf('return act(');
    assert.ok(at > 0 && actAt > 0, act);
    assert.ok(block.indexOf('koreanEditsIn(') > 0 && block.indexOf('koreanEditsIn(') < actAt, `${act}: Korean boxes read before act()`);
    assert.ok(/const (body|\{ id: sid, body \}) = /.test(block.slice(0, actAt)), `${act}: form read before act()`);
    assert.ok(block.slice(actAt).includes('await applyKoreanEdits(fixes, body)'), `${act}: corrections applied to what was read`);
  }
});

test('the library: corrections replace the note in what was read, story quotes stay, and nothing is asked without one', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const start = src.indexOf('  async function applyKoreanEdits(');
  const fnSrc = src.slice(start, src.indexOf('\n  }\n', start) + 4);
  const calls = [];
  const api = async (method, url, body) => { calls.push(body); return { items: body.items.map((x) => ({ en: `${x.en} (fixed)` })) }; };
  const applyKoreanEdits = require('node:vm').runInNewContext(`(${fnSrc.trim()})`, { api, room: 'r1', Map, Object, Array, encodeURIComponent });
  const body = { title: 'Old title', summary: 'Keep me', events: [{ text: 'Old title', quotes: [{ text: 'Old title' }] }] };
  const out = await applyKoreanEdits([{ en: 'Old title', ko: '새 제목' }], body);
  assert.equal(out.title, 'Old title (fixed)');
  assert.equal(out.summary, 'Keep me');
  assert.equal(out.events[0].text, 'Old title (fixed)');
  assert.equal(out.events[0].quotes[0].text, 'Old title', 'a quote from the story is never changed');
  assert.equal(await applyKoreanEdits([], body), body);
  assert.equal(calls.length, 1);
});
