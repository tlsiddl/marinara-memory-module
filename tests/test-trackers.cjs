'use strict';
// 날짜·주기 트래커 (trackers, switch, off by default): date math, the two clocks, the injected line, suggestions, the routes,
// backup, room delete and the screen. Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-trackers-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const A = require('../memory-module/lib/aliases.cjs');
const Tk = require('../memory-module/lib/trackers.cjs');
const B = require('../memory-module/lib/backup.cjs');
const F = require('../memory-module/lib/features.cjs');
const T = require('../memory-module/lib/translate.cjs');
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
const EUNSEO = '은서', RAON = '라온', DAIN = '다인';
const cast = [EUNSEO, RAON, DAIN];

// ---- registry ----
test('registry: a switch, off by default, ready', () => {
  assert.equal(F.FEATURES.trackers.default, false);
  assert.equal(F.FEATURES.trackers.ready, true);
  assert.match(F.FEATURES.trackers.label, /트래커/);
  X.saveSettings({ connection: null, chats: { t1: {} } });
  assert.equal(X.featureOn('t1', 'trackers'), false);
  X.saveSettings({ connection: null, chats: { t1: { features: { trackers: 'on' } } } });
  assert.equal(X.featureOn('t1', 'trackers'), true);
});

// ---- date math ----
test('dates: YYYY-MM-DD and YY-MM-DD are read, real calendar dates only, leap years count', () => {
  assert.equal(Tk.parseDate('2024-07-16'), '2024-07-16');
  assert.equal(Tk.parseDate('24-07-16'), '2024-07-16');
  assert.equal(Tk.parseDate(' 24.7.6 '), '2024-07-06');
  assert.equal(Tk.parseDate('2024-02-29'), '2024-02-29');
  assert.equal(Tk.parseDate('2023-02-29'), null);
  assert.equal(Tk.parseDate('2100-02-29'), null, '2100 is not a leap year');
  assert.equal(Tk.parseDate('2000-02-29'), '2000-02-29');
  assert.equal(Tk.parseDate('24-13-01'), null);
  assert.equal(Tk.parseDate('내일'), null);
  assert.equal(Tk.parseDate(''), null);
  assert.equal(Tk.daysBetween('2024-02-28', '2024-03-01'), 2, 'a leap February');
  assert.equal(Tk.daysBetween('2023-02-28', '2023-03-01'), 1);
  assert.equal(Tk.daysBetween('2023-12-31', '2024-01-01'), 1);
  assert.equal(Tk.daysBetween('2024-03-01', '2024-02-28'), -2);
  assert.equal(Tk.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(Tk.addMonths('2023-01-31', 1), '2023-02-28');
  assert.equal(Tk.addMonths('2024-11-15', 3), '2025-02-15');
  assert.equal(Tk.addDays('2024-02-28', 2), '2024-03-01');
  assert.equal(Tk.localDate(new Date(2024, 6, 5, 23, 59)), '2024-07-05');
});

const base = { label: '시험', scope: 'room', people: [], clock: 'story', inject: 'present', createdAt: '', updatedAt: '' };
const count = (start, firstDay = 1) => ({ ...base, id: 'c', type: 'count', label: '만난 지', count: { start, firstDay } });
const until = (target) => ({ ...base, id: 'u', type: 'until', until: { target } });
const cycle = (c) => ({ ...base, id: 'y', type: 'cycle', label: '주기', cycle: { every: 28, unit: 'day', length: 5, starts: [], predict: 'fixed', ...c } });

test('count: days since the start, the first day as 1 or 0; before the start it says so', () => {
  assert.equal(Tk.evaluate(count('2024-07-04'), '2024-07-16').short, '13일째');
  assert.equal(Tk.evaluate(count('2024-07-04', 0), '2024-07-16').short, '12일째');
  assert.equal(Tk.evaluate(count('2024-07-16'), '2024-07-16').short, '1일째');
  assert.equal(Tk.evaluate(count('2024-07-16', 0), '2024-07-16').short, '0일째');
  assert.equal(Tk.evaluate(count('2024-02-20'), '2024-03-05').short, '15일째', 'across a leap day');
  assert.equal(Tk.evaluate(count('2024-07-20'), '2024-07-16').short, '시작 전 D-4');
});

test('until: D-N, D-day, D+N', () => {
  assert.equal(Tk.evaluate(until('2024-07-19'), '2024-07-16').short, 'D-3');
  assert.equal(Tk.evaluate(until('2024-07-16'), '2024-07-16').short, 'D-day');
  assert.equal(Tk.evaluate(until('2024-07-14'), '2024-07-16').short, 'D+2');
  assert.equal(Tk.evaluate(until('2024-03-01'), '2024-02-28').short, 'D-2');
});

test('cycle: in the cycle k/length; fixed and average predictions; month unit; overdue; nothing recorded', () => {
  const c = cycle({ starts: ['2024-07-10'] });
  assert.equal(Tk.evaluate(c, '2024-07-10').short, '진행 중 (1/5일째)');
  assert.equal(Tk.evaluate(c, '2024-07-14').short, '진행 중 (5/5일째)');
  assert.equal(Tk.evaluate(c, '2024-07-15').short, '다음까지 D-23', 'fixed: every 28 days from 07-10 = 08-07');
  assert.equal(Tk.evaluate(c, '2024-08-07').short, '다음까지 D-day');
  assert.equal(Tk.evaluate(c, '2024-08-10').short, '예정일 3일 지남');
  // average of the last intervals (30 and 26 -> 28 -> same here; use 20 and 30 -> 25)
  const avg = cycle({ predict: 'average', starts: ['2024-05-01', '2024-05-21', '2024-06-20'] });
  assert.equal(Tk.evaluate(avg, '2024-06-26').short, '다음까지 D-19', 'mean 25 days: 06-20 + 25 = 07-15');
  const one = cycle({ predict: 'average', every: 30, starts: ['2024-06-20'] });
  assert.equal(Tk.evaluate(one, '2024-06-26').short, '다음까지 D-24', 'one start only: falls back to every');
  const month = cycle({ unit: 'month', every: 1, starts: ['2024-01-31'], length: 3 });
  assert.equal(Tk.evaluate(month, '2024-02-10').short, '다음까지 D-19', '31 Jan + 1 month = 29 Feb');
  const empty = cycle({});
  assert.equal(Tk.evaluate(empty, '2024-07-16').ok, false);
  const future = cycle({ starts: ['2024-07-20'] });
  assert.equal(Tk.evaluate(future, '2024-07-16').short, '다음까지 D-4');
  assert.equal(Tk.evaluate(cycle({ starts: ['2024-07-10', '2024-07-20'] }), '2024-07-12').short, '진행 중 (3/5일째)', 'a start after today is not the last one yet');
});

test('clocks: story uses the story date, real uses the given date; an unknown story date says so', () => {
  const items = [{ ...count('2024-07-04'), id: 'a' }, { ...count('2024-07-04'), id: 'b', clock: 'real' }];
  const known = Tk.view({ version: 1, items }, { story: '2024-07-16', real: '2025-01-01' });
  assert.equal(known[0].status.text, '13일째');
  assert.equal(known[1].status.text, '182일째');
  const unknown = Tk.view({ version: 1, items }, { story: null, real: '2024-07-05' });
  assert.equal(unknown[0].status.text, '이야기 날짜 모름');
  assert.equal(unknown[0].status.ok, false);
  assert.equal(unknown[0].line, '');
  assert.equal(unknown[1].status.text, '2일째');
});

// ---- items ----
test('items: add, edit, delete with checks; people become canonical; scope decides how many', () => {
  A.using({ people: { [EUNSEO]: { aliases: ['Eunseo'] } }, rev: 1 }, () => {
    let file = Tk.emptyTrackers();
    file = Tk.addItem(file, { type: 'count', label: '만난 지', scope: 'pair', people: ['Eunseo', RAON], count: { start: '24-07-04' } }, 'T0');
    assert.deepEqual(file.items[0].people, [EUNSEO, RAON]);
    assert.equal(file.items[0].count.start, '2024-07-04');
    assert.equal(file.items[0].count.firstDay, 1);
    assert.equal(file.items[0].id, 'tk1');
    assert.equal(file.items[0].clock, 'story');
    assert.equal(file.items[0].inject, 'present');
    assert.throws(() => Tk.addItem(file, { type: 'count', label: 'x', scope: 'pair', people: [EUNSEO], count: { start: '24-07-04' } }), /두 사람/);
    assert.throws(() => Tk.addItem(file, { type: 'count', label: 'x', scope: 'person', people: [], count: { start: '24-07-04' } }), /한 사람/);
    assert.throws(() => Tk.addItem(file, { type: 'count', label: '', count: { start: '24-07-04' } }), /이름/);
    assert.throws(() => Tk.addItem(file, { type: 'count', label: 'x', count: { start: '24-02-31' } }), /시작일/);
    assert.throws(() => Tk.addItem(file, { type: 'until', label: 'x' }), /목표일/);
    assert.throws(() => Tk.addItem(file, { type: 'nope', label: 'x' }), /종류/);
    assert.throws(() => Tk.addItem(file, { type: 'cycle', label: 'x', cycle: { every: 0 } }), /주기/);
    assert.throws(() => Tk.addItem(file, { type: 'cycle', label: 'x', cycle: { starts: ['아무때나'] } }), /시작일 형식/);
    assert.throws(() => Tk.addItem(file, { type: 'count', label: 'x', clock: 'moon', count: { start: '24-07-04' } }), /날짜 기준/);
    file = Tk.editItem(file, 'tk1', { label: '사귄 지', inject: 'always', count: { start: '24-07-05', firstDay: 0 } }, 'T1');
    assert.equal(file.items[0].label, '사귄 지');
    assert.equal(file.items[0].count.firstDay, 0);
    assert.equal(file.items[0].type, 'count', 'the type cannot change');
    assert.equal(file.items[0].createdAt, 'T0');
    file = Tk.addItem(file, { type: 'until', label: '시험', until: { target: '2024-08-01' } });
    assert.equal(file.items[1].id, 'tk2');
    file = Tk.deleteItem(file, 'tk1');
    assert.deepEqual(file.items.map((i) => i.id), ['tk2']);
    assert.throws(() => Tk.deleteItem(file, 'zz'), /찾지 못/);
    const full = Array.from({ length: Tk.MAX_ITEMS }, (_, i) => ({ id: `tk${i + 1}`, type: 'until', label: 'x', scope: 'room', people: [], clock: 'story', inject: 'present', until: { target: '2024-08-01' } }));
    assert.throws(() => Tk.addItem({ version: 1, items: full, suggestions: [] }, { type: 'until', label: 'y', until: { target: '2024-08-01' } }), /개까지/);
  });
});

test('cycle history: add, edit, remove, kept sorted and capped at 12; a date is kept once', () => {
  let file = Tk.addItem(Tk.emptyTrackers(), { type: 'cycle', label: '발정기', scope: 'person', people: [EUNSEO], cycle: { every: 30, length: 5 } });
  for (let i = 1; i <= 14; i++) file = Tk.addStart(file, 'tk1', `2024-${String(Math.ceil(i / 2)).padStart(2, '0')}-${i % 2 ? '01' : '15'}`);
  assert.equal(file.items[0].cycle.starts.length, 12);
  assert.equal(file.items[0].cycle.starts.at(-1), '2024-07-15');
  assert.equal(file.items[0].cycle.starts[0], '2024-02-01', 'the oldest two fell away');
  file = Tk.addStart(file, 'tk1', '2024-07-15');
  assert.equal(file.items[0].cycle.starts.length, 12, 'the same date is kept once');
  file = Tk.editStart(file, 'tk1', '2024-07-15', '2024-07-18');
  assert.equal(file.items[0].cycle.starts.at(-1), '2024-07-18');
  file = Tk.removeStart(file, 'tk1', '2024-07-18');
  assert.equal(file.items[0].cycle.starts.at(-1), '2024-07-01');
  assert.throws(() => Tk.removeStart(file, 'tk1', '2020-01-01'), /기록에 없습니다/);
  const c = Tk.addItem(Tk.emptyTrackers(), { type: 'count', label: 'x', count: { start: '24-07-01' } });
  assert.throws(() => Tk.addStart(c, 'tk1', '2024-07-02'), /주기 트래커만/);
});

test('from a scene: a count tracker starts on the date, a cycle gets a start, a new count tracker can be made, until cannot', () => {
  let file = Tk.addItem(Tk.emptyTrackers(), { type: 'count', label: '만난 지', count: { start: '24-01-01' } });
  file = Tk.addItem(file, { type: 'cycle', label: '주기', cycle: {} });
  file = Tk.addItem(file, { type: 'until', label: '시험', until: { target: '2024-08-01' } });
  let next = Tk.startFromDate(file, { trackerId: 'tk1', date: '2024-07-16' });
  assert.equal(next.items[0].count.start, '2024-07-16');
  next = Tk.startFromDate(file, { trackerId: 'tk2', date: '2024-07-16' });
  assert.deepEqual(next.items[1].cycle.starts, ['2024-07-16']);
  assert.throws(() => Tk.startFromDate(file, { trackerId: 'tk3', date: '2024-07-16' }), /D-day/);
  next = Tk.startFromDate(file, { label: '사귄 지', scope: 'pair', people: [EUNSEO, RAON], date: '2024-07-16' });
  assert.equal(next.items.at(-1).type, 'count');
  assert.equal(next.items.at(-1).count.start, '2024-07-16');
  assert.deepEqual(next.items.at(-1).people, [EUNSEO, RAON]);
});

// ---- the injected line ----
const lineFile = () => {
  let f = Tk.emptyTrackers();
  f = Tk.addItem(f, { type: 'count', label: '만난 지', scope: 'person', people: [DAIN], inject: 'always', count: { start: '2024-07-04' } });
  f = Tk.addItem(f, { type: 'count', label: '사귄 지', scope: 'pair', people: [EUNSEO, RAON], inject: 'present', count: { start: '2024-07-13' } });
  f = Tk.addItem(f, { type: 'cycle', label: '발정기', scope: 'person', people: [EUNSEO], inject: 'present', cycle: { every: 30, length: 5, starts: ['2024-07-15'] } });
  f = Tk.addItem(f, { type: 'until', label: '시험', scope: 'room', inject: 'present', until: { target: '2024-07-19' } });
  f = Tk.addItem(f, { type: 'until', label: '비밀', scope: 'room', inject: 'never', until: { target: '2024-07-19' } });
  f = Tk.addItem(f, { type: 'count', label: '실제', scope: 'room', inject: 'always', clock: 'real', count: { start: '2024-07-01' } });
  return f;
};

test('line: always first, then present ones whose people are all there (a room tracker always counts); never is never', () => {
  const file = lineFile();
  const at = (present, extra = {}) => Tk.injectionBlock(file, { present, story: '2024-07-16', real: '2024-07-31', ...extra });
  assert.equal(at([EUNSEO, RAON]), '[기록] 다인 만난 지 13일째 · 31일째 · 은서·라온 사귄 지 4일째 · 은서 발정기: 진행 중 (2/5일째) · 시험 D-3'.replace('· 31일째', '· 실제 31일째'));
  assert.equal(at([EUNSEO]), '[기록] 다인 만난 지 13일째 · 실제 31일째 · 은서 발정기: 진행 중 (2/5일째) · 시험 D-3', 'the pair needs both');
  assert.equal(at([]), '[기록] 다인 만난 지 13일째 · 실제 31일째 · 시험 D-3');
  assert.doesNotMatch(at([EUNSEO, RAON]), /비밀/);
  assert.equal(at([EUNSEO, RAON], { story: null }), '[기록] 실제 31일째', 'story-clock trackers say nothing without a story date');
  assert.equal(Tk.injectionBlock(null, { present: [] }), '');
  assert.equal(Tk.injectionBlock(Tk.emptyTrackers(), { present: [] }), '');
});

test('line: names are matched through the name table; the cap leaves out what does not fit', () => {
  A.using({ people: { [EUNSEO]: { aliases: ['Eunseo'] } }, rev: 2 }, () => {
    const file = Tk.addItem(Tk.emptyTrackers(), { type: 'count', label: '만난 지', scope: 'person', people: ['Eunseo'], count: { start: '2024-07-04' } });
    assert.deepEqual(file.items[0].people, [EUNSEO]);
    assert.equal(Tk.injectionBlock(file, { present: ['Eunseo'], story: '2024-07-16' }), '[기록] 은서 만난 지 13일째');
    assert.equal(Tk.injectionBlock(file, { present: [EUNSEO], story: '2024-07-16' }), '[기록] 은서 만난 지 13일째');
    assert.equal(Tk.injectionBlock(file, { present: [DAIN], story: '2024-07-16' }), '');
  });
  let file = Tk.emptyTrackers();
  for (let i = 0; i < 20; i++) file = Tk.addItem(file, { type: 'count', label: `기념일${i}`, scope: 'room', inject: 'always', count: { start: '2024-07-04' } });
  const line = Tk.injectionBlock(file, { present: [], story: '2024-07-16' });
  assert.ok(line.length <= Tk.INJECT_CHARS && line.startsWith('[기록] 기념일0 13일째'), line.length);
  assert.ok(!line.endsWith(' · '));
  assert.equal(Tk.injectionBlock(file, { present: [], story: '2024-07-16', max: 8 }), '', 'nothing fits');
  assert.equal(T.planLines(line, 'en')[0].kind, 'keep', 'never sent for translation');
});

// ---- suggestions ----
const sc = (id, end, extra = {}) => ({ id, start: end, end, time: null, events: [], present: [], recollections: [], summary: '', ...extra });
const dateOf = (scene) => L.parseClock(scene.time)?.date || null;

test('suggestions: a start the story states becomes an open suggestion; once; never twice; answered ones stay answered', () => {
  const file = Tk.addItem(Tk.emptyTrackers(), { type: 'cycle', label: '은서 발정기', scope: 'person', people: [EUNSEO], cycle: { every: 30, length: 5, starts: ['2024-06-10'] } });
  const store = { ...S.emptyStore(), cast, scenes: [
    sc('S1', 3, { time: '24-07-16 (화)', summary: '은서가 아침에 일어났다. 은서의 발정기가 시작되었다.' }),
    sc('S2', 6, { time: '24-07-17', summary: '라온은 책을 읽었다.', events: [{ text: '은서는 발정기 때문에 쉬었다.', quotes: [] }] }),
    sc('S3', 9, { time: '24-07-18', summary: '은서의 발정기는 아직 시작되지 않았다.' }),
    sc('S4', 12, { summary: '은서의 발정기가 시작됐다.' }),
    sc('S5', 15, { time: '24-07-20', summary: '라온의 발정기가 시작됐다.' }),
    sc('S6', 18, { time: '24-07-21', summary: '은서가 집에 왔다.' }),
  ] };
  const next = Tk.suggest(file, store, dateOf, 'N');
  assert.equal(next.suggestions.length, 1, 'only S1: a start word with the label word and the person, a date, no negation');
  assert.deepEqual({ ...next.suggestions[0], id: 'x' }, { id: 'x', trackerId: 'tk1', date: '2024-07-16', sceneId: 'S1', status: 'open', text: '은서 은서 발정기 시작을 24-07-16(으)로 기록할까요?', createdAt: 'N' });
  assert.equal(Tk.suggest(next, store, dateOf), next, 'no duplicate: nothing new, the same object');
  assert.deepEqual(next.items[0].cycle.starts, ['2024-06-10'], 'nothing is applied by itself');
  const ignored = Tk.answerSuggestion(next, next.suggestions[0].id, 'ignore');
  assert.equal(ignored.suggestions[0].status, 'ignored');
  assert.equal(Tk.suggest(ignored, store, dateOf), ignored, 'an ignored one is not asked again');
  assert.deepEqual(ignored.items[0].cycle.starts, ['2024-06-10']);
  assert.throws(() => Tk.answerSuggestion(ignored, ignored.suggestions[0].id, 'accept'), /이미 답한/);
  const accepted = Tk.answerSuggestion(next, next.suggestions[0].id, 'accept');
  assert.deepEqual(accepted.items[0].cycle.starts, ['2024-06-10', '2024-07-16']);
  assert.equal(accepted.suggestions[0].status, 'done');
  assert.equal(Tk.suggest(accepted, store, dateOf), accepted, 'a date already recorded is not suggested');
  assert.throws(() => Tk.answerSuggestion(next, 'nope', 'accept'), /찾지 못/);
  // Only cycle trackers are looked at, and a label with nothing but names and generic words has no keyword.
  const other = Tk.addItem(Tk.emptyTrackers(), { type: 'count', label: '발정기', count: { start: '24-07-01' } });
  assert.equal(Tk.suggest(other, store, dateOf), other);
  assert.deepEqual(Tk.keywordsOf({ label: '은서 주기', people: [EUNSEO] }), []);
  assert.deepEqual(Tk.keywordsOf({ label: '은서 발정기', people: [EUNSEO] }), ['발정기']);
  // A room-wide tracker needs no name in the sentence.
  const room = Tk.addItem(Tk.emptyTrackers(), { type: 'cycle', label: '장마', cycle: { every: 365, length: 30 } });
  const rainy = { ...S.emptyStore(), scenes: [sc('S1', 3, { time: '24-06-25', summary: '장마가 시작되었다.' })] };
  assert.equal(Tk.suggest(room, rainy, dateOf).suggestions[0].date, '2024-06-25');
  // Deleting the tracker removes its suggestions.
  assert.equal(Tk.deleteItem(next, 'tk1').suggestions.length, 0);
});

// ---- the service ----
const settingsFor = (room, features = {}) => X.saveSettings({ connection: null, chats: { [room]: { enabled: true, features: { autoApply: 'off', ...features } } } });
function seedRoom(room, { date = '24-07-16' } = {}) {
  const store = { ...S.emptyStore(), cast, scenes: [
    sc('S1', 3, { title: '만남', summary: '은서와 라온이 처음 만났다.', place: '카페', time: '24-07-04 (목)', present: [EUNSEO, RAON], events: [{ text: '만났다', quotes: [] }] }),
    sc('S2', 6, { title: '다시', summary: '은서의 발정기가 시작되었다.', place: '집', time: date ? `${date} (화)` : '', present: [EUNSEO, DAIN], events: [{ text: '이야기', quotes: [] }] }),
  ] };
  X.saveScenes(room, store);
  return store;
}
const item = (extra) => ({ type: 'count', label: '만난 지', scope: 'person', people: [DAIN], inject: 'present', count: { start: '24-07-04' }, ...extra });

test('service: off writes and injects nothing and the payloads are unchanged; on injects the line for the last scene\'s people', async () => {
  seedRoom('ta');
  const ledger = L.emptyLedger();
  ledger.storyDate = '2024-07-16';
  X.saveLedger('ta', ledger);
  settingsFor('ta', {});
  const plain = X.renderMemorySource('ta');
  assert.equal(X.refreshWorld('ta', X.loadScenes('ta')), false);
  assert.equal(fs.existsSync(path.join(CHATS, 'ta.trackers.json')), false);
  assert.doesNotMatch(plain, /\[기록\]/);
  const world = (await call('GET /chats/:id/world', 'ta')).result;
  assert.equal('trackers' in world, false, 'the world payload has no trackers key while off');
  assert.equal('trackerPick' in (await call('GET /chats/:id', 'ta')).result, false);
  settingsFor('ta', { trackers: 'on' });
  const added = await call('POST /chats/:id/trackers', 'ta', { action: 'add', item: item({}) });
  assert.ifError(added.error);
  assert.equal(added.result.items[0].status.text, '13일째');
  assert.equal(added.result.storyDate, '2024-07-16');
  assert.match(X.renderMemorySource('ta'), /\[기록\] 다인 만난 지 13일째/);
  settingsFor('ta', {});
  assert.equal(X.renderMemorySource('ta'), plain, 'off again: the very same text as before the feature');
  assert.ok(fs.existsSync(path.join(CHATS, 'ta.trackers.json')), 'the file stays');
  settingsFor('ta', { trackers: 'on' });
  // The line follows who is in the last scene: Dain is in S2, Raon is not.
  await call('POST /chats/:id/trackers', 'ta', { action: 'add', item: item({ label: '약속', people: [RAON], count: { start: '24-07-10' } }) });
  const text = X.renderMemorySource('ta');
  assert.match(text, /\[기록\] 다인 만난 지 13일째\n/);
  assert.doesNotMatch(text, /라온 약속/);
});

test('service: an unknown story date says so and injects nothing for story trackers; real-clock trackers still work', async () => {
  seedRoom('tb');
  settingsFor('tb', { trackers: 'on' });
  let r = await call('POST /chats/:id/trackers', 'tb', { action: 'add', item: item({ scope: 'room', people: [] }) });
  assert.equal(r.result.items[0].status.text, '이야기 날짜 모름');
  assert.equal(r.result.storyDate, null);
  assert.doesNotMatch(X.renderMemorySource('tb'), /\[기록\]/);
  r = await call('POST /chats/:id/trackers', 'tb', { action: 'add', item: item({ label: '실제', scope: 'room', people: [], clock: 'real', count: { start: Tk.localDate() } }) });
  assert.equal(r.result.items[1].status.text, '1일째');
  assert.match(X.renderMemorySource('tb'), /\[기록\] 실제 1일째/);
  r = await call('POST /chats/:id/trackers', 'tb', { action: 'add', item: { type: 'cycle', label: '주기', scope: 'room', cycle: { every: 28, length: 5 } } });
  const id = r.result.items[2].id;
  const err = await call('POST /chats/:id/trackers', 'tb', { action: 'start', id });
  assert.match(err.error, /이야기 속 오늘 날짜/);
  const real = await call('POST /chats/:id/trackers', 'tb', { action: 'edit', id, item: { clock: 'real' } });
  assert.ifError(real.error);
  const started = await call('POST /chats/:id/trackers', 'tb', { action: 'start', id });
  assert.deepEqual(started.result.items[2].cycle.starts, [Tk.localDate()]);
  assert.equal(started.result.items[2].status.text, '진행 중 (1/5일째)');
});

test('routes: refused while off; add, edit, start, history, delete; bad input refused', async () => {
  seedRoom('tc');
  const ledger = L.emptyLedger();
  ledger.storyDate = '2024-07-16';
  X.saveLedger('tc', ledger);
  settingsFor('tc', {});
  for (const key of ['GET /chats/:id/trackers', 'POST /chats/:id/trackers']) assert.match((await call(key, 'tc', { action: 'add', item: item({}) })).error, /꺼져 있습니다/, key);
  assert.equal(fs.existsSync(path.join(CHATS, 'tc.trackers.json')), false);
  settingsFor('tc', { trackers: 'on' });
  const view = (await call('GET /chats/:id/trackers', 'tc')).result;
  assert.deepEqual({ ...view, items: [], realDate: 'x' }, { on: true, storyDate: '2024-07-16', realDate: 'x', items: [], suggestions: [], applied: [], people: view.people, sceneDates: { S1: '2024-07-04', S2: '2024-07-16' } });
  assert.deepEqual(view.people, cast, 'the names to pick from');
  const bad = async (body, re) => assert.match((await call('POST /chats/:id/trackers', 'tc', body)).error, re);
  await bad({ action: 'fly' }, /중 하나/);
  await bad({ action: 'add', item: { type: 'count', label: 'x', count: { start: 'x' } } }, /시작일/);
  await bad({ action: 'edit', id: 'zz', item: {} }, /찾지 못/);
  await bad({ action: 'delete', id: 'zz' }, /찾지 못/);
  assert.equal(fs.existsSync(path.join(CHATS, 'tc.trackers.json')), false, 'a refused request writes nothing');
  await call('POST /chats/:id/trackers', 'tc', { action: 'add', item: { type: 'cycle', label: '발정기', scope: 'person', people: [EUNSEO], cycle: { every: 30, length: 5, starts: ['24-06-10'] } } });
  let r = await call('POST /chats/:id/trackers', 'tc', { action: 'start', id: 'tk1' });
  assert.deepEqual(r.result.items[0].cycle.starts, ['2024-06-10', '2024-07-16'], 'today = the story\'s today');
  r = await call('POST /chats/:id/trackers', 'tc', { action: 'addStart', id: 'tk1', date: '24-05-01' });
  r = await call('POST /chats/:id/trackers', 'tc', { action: 'editStart', id: 'tk1', from: '2024-05-01', to: '2024-05-02' });
  assert.deepEqual(r.result.items[0].cycle.starts, ['2024-05-02', '2024-06-10', '2024-07-16']);
  r = await call('POST /chats/:id/trackers', 'tc', { action: 'removeStart', id: 'tk1', date: '2024-05-02' });
  assert.equal(r.result.items[0].cycle.starts.length, 2);
  assert.match((await call('POST /chats/:id/trackers', 'tc', { action: 'removeStart', id: 'tk1', date: '2024-05-02' })).error, /없습니다/);
  r = await call('POST /chats/:id/trackers', 'tc', { action: 'edit', id: 'tk1', item: { label: '컨디션', inject: 'always' } });
  assert.equal(r.result.items[0].label, '컨디션');
  assert.equal(r.result.items[0].inject, 'always');
  // The world payload and the scene cards' picker data carry it.
  const world = (await call('GET /chats/:id/world', 'tc')).result;
  assert.equal(world.trackers.items.length, 1);
  const info = (await call('GET /chats/:id', 'tc')).result;
  assert.deepEqual(info.trackerPick.items.map((t) => t.id), ['tk1']);
  assert.deepEqual(info.trackerPick.sceneDates, { S1: '2024-07-04', S2: '2024-07-16' });
  r = await call('POST /chats/:id/trackers', 'tc', { action: 'delete', id: 'tk1' });
  assert.deepEqual(r.result.items, []);
});

test('routes: "이 장면부터" uses the scene\'s own date; a scene without one is refused', async () => {
  seedRoom('td');
  const store = X.loadScenes('td');
  store.scenes.push(sc('S3', 9, { title: '날짜 없음', summary: '조용한 하루' }));
  X.saveScenes('td', store);
  settingsFor('td', { trackers: 'on' });
  let r = await call('POST /chats/:id/trackers', 'td', { action: 'fromScene', sceneId: 'S1', label: '사귄 지', people: [EUNSEO, RAON], scope: 'pair' });
  assert.ifError(r.error);
  assert.equal(r.result.items[0].count.start, '2024-07-04');
  assert.deepEqual(r.result.items[0].people, [EUNSEO, RAON]);
  r = await call('POST /chats/:id/trackers', 'td', { action: 'fromScene', sceneId: 'S2', id: 'tk1' });
  assert.equal(r.result.items[0].count.start, '2024-07-16');
  assert.match((await call('POST /chats/:id/trackers', 'td', { action: 'fromScene', sceneId: 'S3', id: 'tk1' })).error, /작중 날짜가 없습니다/);
  assert.match((await call('POST /chats/:id/trackers', 'td', { action: 'fromScene', sceneId: 'S9', id: 'tk1' })).error, /장면을 찾지/);
  assert.equal((await call('GET /chats/:id', 'td')).result.trackerPick.sceneDates.S3, undefined);
});

test('service: suggestions come from a scan, are not applied by themselves, can be accepted or ignored, and are not made twice', async () => {
  seedRoom('te');
  settingsFor('te', { trackers: 'on' });
  await call('POST /chats/:id/trackers', 'te', { action: 'add', item: { type: 'cycle', label: '은서 발정기', scope: 'person', people: [EUNSEO], cycle: { every: 30, length: 5 } } });
  assert.equal(X.refreshWorld('te', X.loadScenes('te')), true);
  let view = (await call('GET /chats/:id/trackers', 'te')).result;
  assert.equal(view.suggestions.length, 1);
  assert.match(view.suggestions[0].text, /24-07-16\(으\)로 기록할까요/);
  assert.deepEqual(view.items[0].cycle.starts, [], 'nothing recorded by itself');
  assert.equal(X.refreshWorld('te', X.loadScenes('te')), false, 'a second scan finds nothing new');
  const sid = view.suggestions[0].id;
  const done = await call('POST /chats/:id/trackers', 'te', { action: 'accept', sid });
  assert.deepEqual(done.result.items[0].cycle.starts, ['2024-07-16']);
  assert.deepEqual(done.result.suggestions, []);
  assert.equal(X.refreshWorld('te', X.loadScenes('te')), false);
  assert.match((await call('POST /chats/:id/trackers', 'te', { action: 'accept', sid })).error, /이미 답한/);
  // Ignoring: a new tracker for the same story sees the same sentence and asks once.
  await call('POST /chats/:id/trackers', 'te', { action: 'add', item: { type: 'cycle', label: '은서 발정기 둘째', scope: 'person', people: [EUNSEO], cycle: { every: 30, length: 5 } } });
  X.refreshWorld('te', X.loadScenes('te'));
  view = (await call('GET /chats/:id/trackers', 'te')).result;
  assert.equal(view.suggestions.length, 1);
  const ignored = await call('POST /chats/:id/trackers', 'te', { action: 'ignore', sid: view.suggestions[0].id });
  assert.deepEqual(ignored.result.suggestions, []);
  X.refreshWorld('te', X.loadScenes('te'));
  assert.deepEqual((await call('GET /chats/:id/trackers', 'te')).result.suggestions, [], 'not asked again');
  // Off: no scan, no suggestions.
  seedRoom('tf');
  X.saveScenes('tf', X.loadScenes('te'));
  settingsFor('tf', {});
  assert.equal(X.refreshWorld('tf', X.loadScenes('tf')), false);
  assert.equal(fs.existsSync(path.join(CHATS, 'tf.trackers.json')), false);
});

test('backup carries the file and the restore preview counts it; a bad file is refused', async () => {
  seedRoom('tg');
  settingsFor('tg', { trackers: 'on' });
  await call('POST /chats/:id/trackers', 'tg', { action: 'add', item: item({}) });
  assert.ok(B.KEYS.includes('trackers'));
  const { result } = await call('GET /chats/:id/backup', 'tg', null);
  assert.ok(result.backup.files.trackers);
  assert.equal(B.counts(result.backup.files).trackers, 1);
  assert.doesNotThrow(() => B.validate(JSON.parse(JSON.stringify(result.backup))));
  const broken = JSON.parse(JSON.stringify(result.backup));
  broken.files.trackers = { version: 1, items: {} };
  broken.header.fileHashes.trackers = B.hashOf(broken.files.trackers);
  assert.throws(() => B.validate(broken), /trackers/);
  X.saveSettings({ ...X.settings(), chats: { ...X.settings().chats, th: { enabled: true } } });
  const applied = await call('POST /chats/:id/restore/apply', 'th', { backup: result.backup, crossRoom: true });
  assert.ifError(applied.error);
  assert.equal(X.loadTrackers('th').items.length, 1);
});

test('deleting the room removes the file and its cache', async () => {
  seedRoom('ti');
  settingsFor('ti', { trackers: 'on' });
  await call('POST /chats/:id/trackers', 'ti', { action: 'add', item: item({}) });
  const file = path.join(CHATS, 'ti.trackers.json');
  assert.ok(fs.existsSync(file));
  X.purgeChatMemory('ti');
  assert.ok(!fs.existsSync(file));
  assert.equal(X.loadTrackers('ti').items.length, 0);
});

test('installers list the new file', () => {
  const root = path.join(__dirname, '..');
  assert.match(fs.readFileSync(path.join(root, 'install.sh'), 'utf8'), /memory-module\/lib\/trackers\.cjs/);
  assert.match(fs.readFileSync(path.join(root, 'install.ps1'), 'utf8'), /memory-module\/lib\/trackers\.cjs/);
});

// ---- the screen ----
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fn = (name, globals = {}) => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, ...globals });
};
const constant = (name) => {
  const start = source.indexOf(`  const ${name} = `);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n', start));
};

test('screen: a card per tracker with its status, cycle history and buttons; the form follows the type', () => {
  const globals = {
    trackerDraft: null,
    ...vm.runInNewContext(`(() => { ${constant('TK_TYPES')}; ${constant('TK_INJECT')}; ${constant('TK_CLOCK')}; return { TK_TYPES, TK_INJECT, TK_CLOCK }; })()`),
  };
  const paper = (w, armed) => fn('trackersPaper', { ...globals, trackerForm: (t) => `<form>${t.items.length}</form>` })(w, armed);
  assert.equal(paper(null, ''), '');
  assert.equal(paper({}, ''), '');
  const items = [
    { id: 'tk1', type: 'count', label: '<b>만난 지</b>', scope: 'person', people: [DAIN], clock: 'story', inject: 'always', status: { ok: true, text: '13일째', today: '2024-07-16' } },
    { id: 'tk2', type: 'cycle', label: '발정기', scope: 'room', people: [], clock: 'real', inject: 'present', cycle: { starts: ['2024-06-10', '2024-07-16'] }, status: { ok: true, text: '진행 중 (1/5일째)', today: '2024-07-16' } },
    { id: 'tk3', type: 'until', label: '시험', scope: 'room', people: [], clock: 'story', inject: 'never', status: { ok: false, text: '이야기 날짜 모름', today: null } },
  ];
  const html = paper({ trackers: { items, suggestions: [{ id: 'sg_1', text: '발정기 시작을 24-07-16(으)로 기록할까요?', sceneId: 'S2' }], people: [EUNSEO], storyDate: '2024-07-16', realDate: '2024-07-31' } }, '');
  assert.match(html, /날짜·주기 트래커 · 3개/);
  assert.match(html, /&lt;b&gt;만난 지&lt;\/b&gt; <span class="pill ">13일째<\/span>/, 'escaped, with its status');
  assert.match(html, /<span class="pill neutral">이야기 날짜 모름<\/span>/);
  assert.match(html, /진행 중 \(1\/5일째\)/);
  assert.match(html, /data-tk-start="tk2" data-from="2024-06-10" value="2024-06-10"/);
  assert.match(html, /data-act="trackerDropStart" data-id="tk2" data-date="2024-07-16">지우기/);
  assert.match(html, /data-act="trackerStart" data-id="tk2">오늘 시작/);
  assert.match(html, /data-act="trackerAddStart" data-id="tk2"/);
  assert.equal((html.match(/data-act="trackerStart"/g) || []).length, 1, 'only the cycle has 오늘 시작');
  assert.match(html, /data-act="trackerEdit" data-id="tk1"/);
  assert.match(html, /data-act="trackerDelete" data-id="tk3">지우기/);
  assert.match(html, /data-act="trackerAnswer" data-sid="sg_1" data-answer="accept">기록/);
  assert.match(html, /data-act="trackerAnswer" data-sid="sg_1" data-answer="ignore">무시/);
  assert.match(html, /data-goto-scene="S2"/);
  assert.match(html, /이야기 속 2024-07-16/);
  assert.match(paper({ trackers: { items, suggestions: [], people: [], storyDate: null, realDate: '2024-07-31' } }, 'trackerDelete:tk3'), /한 번 더 누르면 지웁니다/);
  assert.match(paper({ trackers: { items, suggestions: [], people: [], storyDate: null, realDate: '2024-07-31' } }, 'trackerDropStart:tk2:2024-07-16'), /한 번 더 누르면 지웁니다/);
  assert.match(paper({ trackers: { items: [], suggestions: [], people: [], storyDate: null, realDate: 'x' } }, ''), /아직 없습니다/);
  assert.doesNotMatch(paper({ trackers: { items, suggestions: [], people: [], storyDate: null, realDate: 'x' } }, ''), /note/, 'no suggestion box without suggestions');
  // The form.
  const blank = vm.runInNewContext(`${constant('tkBlank')}; tkBlank`);
  const form = (d) => fn('trackerForm', { ...globals, trackerDraft: d })({ items: [] });
  assert.match(form(null), /data-act="trackerNew">트래커 추가/);
  const count = form({ ...blank(), type: 'count' });
  assert.match(count, /data-tk="start"/);
  assert.doesNotMatch(count, /data-tk="target"|data-tk="every"/);
  assert.match(form({ ...blank(), type: 'until' }), /data-tk="target"/);
  const cyc = form({ ...blank(), type: 'cycle' });
  for (const k of ['every', 'unit', 'length', 'predict', 'starts']) assert.match(cyc, new RegExp(`data-tk="${k}"`), k);
  assert.match(form({ ...blank(), scope: 'pair' }), /data-tk="p1"[^>]*list="trackerPeople"[\s\S]*data-tk="p2"/);
  assert.doesNotMatch(form({ ...blank(), scope: 'room' }), /data-tk="p1"/);
  assert.match(form({ ...blank(), id: 'tk1' }), /트래커 고치기/);
  assert.doesNotMatch(form({ ...blank(), id: 'tk1' }), /data-tk="type"/, 'the type of a saved tracker cannot change');
  assert.match(form({ ...blank(), label: '"x"' }), /value="&quot;x&quot;"/);
  // The body sent follows the type and the scope.
  const body = (d) => JSON.parse(JSON.stringify(fn('tkBody', {})(d)));
  assert.deepEqual(body({ ...blank(), type: 'count', label: 'a', scope: 'person', p1: DAIN, p2: RAON, start: '24-07-04', firstDay: '0' }), { type: 'count', label: 'a', scope: 'person', people: [DAIN], clock: 'story', inject: 'present', count: { start: '24-07-04', firstDay: 0 } });
  assert.deepEqual(body({ ...blank(), type: 'cycle', label: 'a', starts: '24-06-10, 24-07-10' }).cycle, { every: 28, unit: 'day', length: 5, predict: 'fixed', starts: ['24-06-10', '24-07-10'] });
  assert.deepEqual(body({ ...blank(), type: 'until', label: 'a', scope: 'room', target: '24-08-01' }).people, []);
});

test('screen: the scene card button needs a date, offers existing trackers or a new one', () => {
  const box = (info, scenePicker) => fn('scenePickerBox', { info, scenePicker })({ id: 'S2' });
  assert.equal(box(null, null), '', 'off: nothing on the card');
  assert.equal(box({}, null), '');
  const pick = { items: [{ id: 'tk1', label: '만난 지', type: 'count', people: [DAIN] }, { id: 'tk2', label: '주기', type: 'cycle', people: [] }], people: [EUNSEO], sceneDates: { S2: '2024-07-16' } };
  assert.match(box({ trackerPick: { ...pick, sceneDates: {} } }, null), /<button class="ghost" disabled title="이 장면에는 작중 날짜가 없어/, 'disabled with a reason');
  const closed = box({ trackerPick: pick }, null);
  assert.match(closed, /data-act="scenePickOpen" data-id="S2"[^>]*title="[^"]*2024-07-16/);
  assert.doesNotMatch(closed, /scenePickApply/);
  const open = box({ trackerPick: pick }, { scene: 'S2', trackerId: '', label: '', p1: '', p2: '' });
  assert.match(open, /data-sp="trackerId"[\s\S]*<option value="">새 ‘며칠째’ 트래커 만들기/);
  assert.match(open, /<option value="tk1" >다인 만난 지/);
  assert.match(open, /data-sp="label"/);
  assert.match(open, /data-act="scenePickApply" data-id="S2"/);
  const existing = box({ trackerPick: pick }, { scene: 'S2', trackerId: 'tk1', label: '', p1: '', p2: '' });
  assert.doesNotMatch(existing, /data-sp="label"/, 'an existing tracker needs no name');
  assert.doesNotMatch(box({ trackerPick: pick }, { scene: 'S1', trackerId: '', label: '', p1: '', p2: '' }), /scenePickApply/, 'the picker belongs to another scene');
});

test('screen: the tab shows the section, the actions are wired and the scene card has its button', () => {
  assert.match(source, /\$\{trackersPaper\(world, armed\)\}/);
  assert.match(source, /\$\{scenePickerBox\(s\)\}/);
  for (const act of ['trackerNew', 'trackerCancel', 'trackerEdit', 'trackerSave', 'trackerDelete', 'trackerStart', 'trackerAddStart', 'trackerDropStart', 'trackerAnswer', 'scenePickOpen', 'scenePickApply']) assert.match(source, new RegExp(`case '${act}'`), act);
  assert.match(source, /dataset\?\.tkStart/);
  assert.match(source, /'trackerDelete', 'trackerDropStart'\]\.includes\(actName\)\) armed = ''/);
  assert.match(source, /<b>날짜·주기 트래커<\/b>가 모두 꺼져 있습니다/);
  assert.match(source, /!world\.keepsakes && !world\.trackers/);
});
