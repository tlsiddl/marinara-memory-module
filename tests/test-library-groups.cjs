'use strict';
// The library's seven tabs: every old screen is still there as a sub-tab, and the new screens and tools are wired.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');

test('seven tabs hold every screen; the new ones are in VIEWS', () => {
  const groups = source.slice(source.indexOf('  const GROUPS = ['), source.indexOf('  ];', source.indexOf('  const GROUPS = [')));
  assert.equal((groups.match(/^\s+\['[a-z]+', '/gm) || []).length, 7);
  for (const view of ['home', 'timeline', 'lines', 'scenes', 'setup', 'person', 'facts', 'notebook', 'world', 'names', 'ledger', 'promises', 'life', 'search', 'inject', 'settings']) {
    assert.match(groups, new RegExp(`'${view}'`), `${view} is in a tab`);
  }
  assert.match(source, /const VIEWS = \{ timeline: viewTimeline, lines: viewLines, person: viewPerson,/);
  assert.match(source, /content\.innerHTML = warning \+ translation \+ subTabs\(\) \+ VIEWS\[tab\]\(\);/);
});

test('open items: filters, pick boxes, bulk close with undo; facts picked several at once', () => {
  for (const act of ['ledgerFilter', 'openOld', 'bulkClear', 'bulkClose', 'undoAction', 'factPickClear', 'factBulkExclude', 'factBulkDelete']) assert.match(source, new RegExp(`case '${act}':`));
  assert.match(source, /data-pick-thread=/);
  assert.match(source, /data-pick-fact=/);
  assert.match(source, /logAction\(`\$\{closed\.join\(', '\)\} 닫음`, \{ act: 'reopen', ids: closed \}, closeRoom\)/);
});

test('home: version notice, things to fix, day counts, recent changes, cost; search filters; recent rooms', () => {
  for (const fn of ['versionNote', 'suggestionsCard', 'trackersCard', 'recentCard', 'costCard', 'injectBars', 'quoteRecords', 'recentRooms']) assert.ok(source.includes(`function ${fn}(`), fn);
  assert.match(source, /기억 모듈을 업데이트해 주세요/);
  assert.match(source, /id="searchKind"/);
  assert.match(source, /optgroup label="최근 연 방"/);
});

test('the person page shows a foreign term with its Korean translation as one, like the names tab', () => {
  const person = source.slice(source.indexOf('  function viewPerson() {'), source.indexOf('\n  }\n', source.indexOf('  function viewPerson() {')));
  assert.match(person, /x\.id === e\.pairWith\); return t \? `\$\{e\.term\}\(\$\{t\.term\}\)` : e\.term;/);
  assert.match(person, /!\(e\.pairOf && allCalls\.some\(\(x\) => x\.id === e\.pairOf\)\)/);
  assert.match(person, /“\$\{esc\(callLabel\(e\)\)\}”/);
});
