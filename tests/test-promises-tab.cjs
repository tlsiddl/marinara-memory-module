'use strict';
// The 약속 tab: promises only, overdue first, then the rest by deadline (dated before undated), ended ones apart with
// how they ended; deadline badges and the 중요 mark. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const start = source.indexOf('  function viewPromises(');
const fnSrc = source.slice(start, source.indexOf('\n  }\n', start) + 4);

function render(threads, info, open = new Set()) {
  const ctx = { esc, info, openLists: open, threadList: () => threads, threadRow: (t) => `[row ${t.id}${t.status !== 'open' ? ` closed: ${t.closed?.how}` : ''}]`, emptyRoom: () => 'EMPTY', Map, Set };
  return vm.runInNewContext(`(${fnSrc.trim()})`, ctx)();
}

const P = (id, extra = {}) => ({ id, kind: 'promise', status: 'open', title: id, ...extra });

test('the tab is in the menu and loads the items with the scenes', () => {
  assert.ok(source.includes("['promises', '약속', 'clock']"));
  assert.ok(source.includes('promises: viewPromises'));
  assert.match(source, /const needsThreads = \(\) => \[[^\]]*'promises'/);
});

test('overdue first, then by deadline (dated before undated), ended apart; other kinds and merged ones left out', () => {
  const threads = [
    P('T1'),
    P('T2', { due: { date: '25-03-20' } }),
    P('T3', { due: { date: '25-03-01' } }),
    P('T4', { due: { date: '25-03-10' } }),
    { id: 'T5', kind: 'emotion', status: 'open', title: 'feeling' },
    P('T6', { status: 'closed', closed: { how: '지킴', at: { number: 40 } } }),
    P('T7', { status: 'closed', closed: { how: 'T4에 합침', at: { number: 41 } }, mergedInto: 'T4' }),
    P('T8', { status: 'closed', closed: { how: '취소함', at: { number: 50 } } }),
  ];
  const info = {
    deadlines: [{ id: 'T3', state: 'overdue', days: -5 }, { id: 'T4', state: 'ahead', days: 4 }, { id: 'T2', state: 'ahead', days: 14 }],
    recallPrefs: { pinned: ['T1'] },
  };
  const html = render(threads, info);
  const order = [...html.matchAll(/\[row (T\d)/g)].map((m) => m[1]);
  assert.deepEqual(order, ['T3', 'T4', 'T2', 'T1', 'T8', 'T6'], 'overdue, by deadline, undated, then ended newest first');
  assert.ok(!html.includes('T5') && !html.includes('[row T7'), 'feelings and merged promises are not listed');
  assert.match(html, /기한 지난 약속 · 1/);
  assert.match(html, /지켜야 할 약속 · 3/);
  assert.match(html, /끝난 약속 2개/);
  assert.match(html, /<span class="pill ">5일 지남<\/span>\[row T3/);
  assert.match(html, /D-4<\/span>\[row T4/);
  assert.match(html, /<span class="pill">중요<\/span>\[row T1/);
  assert.match(html, /closed: 취소함/);
});

test('no promises yet: a short note; no room: the empty room view', () => {
  assert.match(render([], { deadlines: [] }), /아직 약속이 없습니다/);
  assert.equal(render([], null), 'EMPTY');
});
