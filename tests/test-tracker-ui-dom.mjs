import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { Window } = await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
const window = new Window({ url: 'http://library.test', settings: { enableJavaScriptEvaluation: true } });
const { document } = window;
const items = { A: [{ id: 'tk1', type: 'cycle', label: '가상 주기', scope: 'room', people: [], clock: 'story', inject: 'present', cycle: { every: 28, unit: 'day', length: 5, predict: 'fixed', starts: ['2025-01-01'] }, status: { ok: true, text: '진행 중', today: '2025-01-02' } }], B: [], C: [{ id: 'kept', type: 'count', label: '보존된 기록', scope: 'room', people: [], clock: 'story', inject: 'present', count: { start: '2025-01-01', firstDay: 1 }, status: { ok: true, text: '2일째' } }] };
const calls = [], snapshots = [];
const enabled = { A: true, B: true, C: false };
let blockNext = false, release;
const response = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
const world = (id) => ({ characterState: false, places: false, keepsakes: false, ...(!enabled[id] ? {} : { trackers: { items: items[id], suggestions: [], applied: [{ id: 'ap1', text: '가상 적용', sceneId: 'S1' }], people: [], storyDate: '2025-01-02', realDate: '2025-01-02' } }), cards: [], placeList: [], keepList: [], sceneTitles: { S1: '가상 장면' } });
const info = (id) => ({ enabled: true, job: { state: 'idle' }, sceneJob: { state: 'idle' }, scenes: { count: 1 }, threads: [], cast: [], features: [{ key: 'trackers', label: '날짜·주기', description: '', global: true, room: enabled[id] ? 'on' : 'off' }], ...(!enabled[id] ? {} : { trackerPick: { sceneDates: { S1: '2025-01-02' }, items: items[id], people: [] } }) });
window.localStorage.setItem('marinara-active-chat-id', 'A');
window.fetch = async (url, init = {}) => {
  const p = String(url), method = init.method || 'GET', match = p.match(/\/chats\/([ABC])(?:\/([^?]+))?/), id = match?.[1], part = match?.[2];
  if (method === 'POST' && id && part === 'feature-mode') { const body = JSON.parse(init.body); enabled[id] = body.mode === 'on'; return response({}); }
  if (method === 'POST' && id && part === 'trackers') {
    const body = JSON.parse(init.body); calls.push({ room: id, body });
    if (blockNext) { blockNext = false; await new Promise((r) => { release = r; }); }
    if (body.action === 'add') items[id].push({ ...body.item, id: 'added', status: { ok: true, text: '1일째' } });
    if (body.action === 'edit') Object.assign(items[id].find((x) => x.id === body.id), body.item);
    if (body.action === 'delete') items[id] = items[id].filter((x) => x.id !== body.id);
    return response({ items: items[id] });
  }
  if (p.endsWith('/chats')) return response([{ id: 'A', name: '가상 A' }, { id: 'B', name: '가상 B' }, { id: 'C', name: '가상 C (off)' }]);
  if (id && part === 'world') return response(world(id));
  if (id && part === 'scenes') return response({ scenes: [{ id: 'S1', start: 1, end: 2, title: '가상 장면', summary: '가상', events: [], recollections: [] }], chapters: [], arcs: [], facts: [] });
  if (id && !part) return response(info(id));
  if (part === 'threads') return response({ threads: [] });
  if (p.includes('/personal-extensions/')) return response([]);
  return response({});
};
let cleanup;
window.marinara = { onCleanup: (fn) => { cleanup = fn; } };
window.eval(await readFile(process.env.MEMORY_TEST_BUNDLE || new URL('../deliverable/extension.js', import.meta.url), 'utf8'));
const root = document.querySelector('#memory-module-library').shadowRoot;
const q = (s) => root.querySelector(s);
const wait = async (predicate, label) => { for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise((r) => setTimeout(r, 5)); } throw Error(`timed out: ${label}`); };
const click = (s) => { assert.ok(q(s), s); q(s).click(); };
const idle = () => wait(() => !q('#panel').classList.contains('is-running'), 'UI idle');
const set = (s, value, event = 'input') => { assert.ok(q(s), s); q(s).value = value; q(s).dispatchEvent(new window.Event(event, { bubbles: true, composed: true })); };
try {
  document.querySelector('#memory-module-launcher').click(); await idle();
  await wait(() => q('.tracker-tile'), 'home tracker tile'); snapshots.push(q('.tracker-tile').outerHTML);
  click('[data-tab="world"]'); await wait(() => q('[data-tracker="tk1"]'), 'tracker world');
  snapshots.push(q('[data-tracker="tk1"]').closest('.paper').outerHTML);
  click('[data-act="trackerNew"]'); set('[data-tk="label"]', '새 기록'); set('[data-tk="scope"]', 'person', 'change');
  assert.equal(q('[data-tk="label"]').value, '새 기록'); set('[data-tk="p1"]', '라온'); set('[data-tk="start"]', '2025-01-01');
  snapshots.push(q('[data-tk="scope"]').closest('.paper').outerHTML); click('[data-act="trackerSave"]'); await idle();
  assert.deepEqual(calls.at(-1).body, { action: 'add', item: { type: 'count', label: '새 기록', scope: 'person', people: ['라온'], clock: 'story', inject: 'present', count: { start: '2025-01-01', firstDay: 1 } } });
  click('[data-act="trackerEdit"][data-id="tk1"]'); set('[data-tk="label"]', '고친 주기'); click('[data-act="trackerSave"]'); await idle(); assert.equal(calls.at(-1).body.action, 'edit'); assert.equal(calls.at(-1).body.item.label, '고친 주기');
  click('[data-act="trackerStart"][data-id="tk1"]'); await idle(); assert.equal(calls.at(-1).body.action, 'start');
  set('[data-tk-new="tk1"]', '2025-02-01'); click('[data-act="trackerAddStart"][data-id="tk1"]'); await idle(); assert.equal(calls.at(-1).body.action, 'addStart');
  set('[data-tk-start="tk1"]', '2025-01-03', 'change'); await idle(); assert.equal(calls.at(-1).body.action, 'editStart');
  let n = calls.length; click('[data-act="trackerDropStart"][data-id="tk1"]'); assert.equal(calls.length, n); click('[data-act="trackerDropStart"][data-id="tk1"]'); await idle(); assert.equal(calls.at(-1).body.action, 'removeStart');
  n = calls.length; click('[data-act="trackerUndoApplied"]'); assert.equal(calls.length, n); click('[data-act="trackerUndoApplied"]'); await idle(); assert.equal(calls.at(-1).body.action, 'undoApplied');
  click('[data-tab="timeline"]'); click('[data-tab="scenes"]'); await wait(() => q('[data-act="scenePickOpen"]'), 'scene picker'); click('[data-act="scenePickOpen"]'); set('[data-sp="label"]', '장면 기준'); click('[data-act="scenePickApply"]'); await idle(); assert.equal(calls.at(-1).body.action, 'fromScene'); assert.equal(calls.at(-1).body.sceneId, 'S1');
  click('[data-tab="world"]'); await wait(() => q('[data-act="trackerDelete"][data-id="tk1"]'), 'tracker world after scene');
  n = calls.length; click('[data-act="trackerDelete"][data-id="tk1"]'); assert.equal(calls.length, n); click('[data-act="trackerDelete"][data-id="tk1"]'); await idle(); assert.equal(calls.at(-1).body.action, 'delete');
  click('[data-act="trackerNew"]'); set('[data-tk="label"]', '지연 중인 A'); blockNext = true; click('[data-act="trackerSave"]'); await wait(() => !!release, 'slow save');
  set('#roomSelect', 'B', 'change'); release(); await idle(); await wait(() => q('#roomSelect')?.value === 'B' && q('[data-act="trackerNew"]'), 'room B');
  assert.equal(q('[data-tk="label"]'), null, 'room A draft does not follow into B'); assert.equal(calls.at(-1).room, 'A');
  click('[data-act="trackerNew"]'); assert.equal(q('[data-tk="label"]').value, '', 'room B opens a clean draft');
  set('#roomSelect', 'C', 'change'); await idle(); await wait(() => q('#roomSelect')?.value === 'C' && q('#content')?.textContent.includes('모두 꺼져'), 'tracker feature off'); assert.equal(q('[data-act="trackerNew"]'), null);
  click('[data-tab="settings"]'); await wait(() => q('[data-feature-room="trackers"]'), 'tracker setting'); set('[data-feature-room="trackers"]', 'on', 'change'); await idle(); assert.equal(enabled.C, true);
  click('[data-tab="world"]'); click('[data-act="refresh"]'); await idle(); await wait(() => q('[data-tracker="kept"]'), 'tracker feature on retains prior record');
  console.log('TRACKER_UI_SNAPSHOT ' + JSON.stringify({ snapshots, calls }));
} finally { cleanup(); await window.happyDOM.close(); }
