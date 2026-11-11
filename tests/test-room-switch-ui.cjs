'use strict';
// Per-room UI state (picks, armed clicks, undo log) must not follow the person into another room; the glossary sync must
// not send an empty glossary for an unreadable config; bulk close logs what it closed; tracker undo needs two clicks.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
const slice = (head, tail) => { const a = source.indexOf(head); assert(a >= 0, head); return source.slice(a, source.indexOf(tail, a) + tail.length); };

function logHarness() {
  const code = `
    let room = 'A'; let armed = '';
    const pickedFacts = new Set(), pickedThreads = new Set(); const actionLog = [];
    let speechRows = [1], speechRowsRoom = 'A', scenePicker = {}, trackerDraft = {}, namePreview = {}, restorePreview = {};
    let worldForm = { person: 'x' }, nameForm = { source: 'x' }, addressForm = { from: 'x' };
    ${slice('  function logAction(', '\n  }\n')}
    ${slice('  const roomLog = ', '\n')}
    ${slice('  function resetRoomUi() {', '\n  }\n')}
    ({ logAction, roomLog, resetRoomUi, pickedFacts, pickedThreads, actionLog, setRoom: (r) => { room = r; }, setArmed: (a) => { armed = a; }, state: () => ({ armed, speechRows, scenePicker, trackerDraft, namePreview, restorePreview, worldForm, nameForm, addressForm }) })`;
  return vm.runInNewContext(code);
}

test('room switch clears picks, armed state, log and drafts', () => {
  const h = logHarness();
  h.pickedFacts.add('F1'); h.pickedThreads.add('T1'); h.setArmed('factBulkDelete');
  h.logAction('T1 닫음', { act: 'reopen', ids: ['T1'] });
  h.setRoom('B'); h.resetRoomUi();
  assert.equal(h.pickedFacts.size, 0);
  assert.equal(h.pickedThreads.size, 0);
  assert.equal(h.actionLog.length, 0);
  const s = h.state();
  assert.equal(s.armed, ''); assert.equal(s.speechRows, null); assert.equal(s.scenePicker, null);
  assert.equal(s.trackerDraft, null); assert.equal(s.namePreview, null); assert.equal(s.restorePreview, null);
  assert.equal(s.worldForm.person, ''); assert.equal(s.nameForm.source, ''); assert.equal(s.addressForm.from, '');
});

test('the log shows only this room and entries remember their room', () => {
  const h = logHarness();
  h.logAction('a', { act: 'reopen', ids: ['T1'] });
  h.logAction('b', { act: 'reopen', ids: ['T2'] }, 'B');
  h.setRoom('B');
  assert.deepEqual(Array.from(h.roomLog(), (x) => x.a.text), ['b']);
  assert.equal(h.actionLog[1].room, 'A');
});

test('every place the room changes resets it, and undo refuses another room', () => {
  assert.match(slice('function openLibrary() {', '\n  }\n'), /room = current;\n\s+resetRoomUi\(\);/);
  assert.match(slice("root.querySelector('#roomSelect').onchange", '\n    };\n'), /room = e\.target\.value;\n\s+resetRoomUi\(\);/);
  assert.equal([...source.matchAll(/(?<![.\w])room = /g)].length, 4, 'a new place assigns room: reset the per-room state there too');
  const undo = slice("case 'undoAction': {", "case 'speechRowAdd'");
  assert.match(undo, /entry\.room !== room/);
  assert.ok(undo.indexOf('entry.room !== room') < undo.indexOf('api('));
});

test('bulk close logs the threads it closed even when one fails, and keeps the rest picked', () => {
  const body = slice("case 'bulkClose': {", "case 'undoAction'");
  assert.match(body, /try \{[\s\S]*closed\.push\(t\)[\s\S]*\} finally \{[\s\S]*logAction\([\s\S]*ids: closed/);
  assert.match(body, /pickedThreads\.delete\(t\)/);
  assert.doesNotMatch(body, /pickedThreads\.clear\(\)/);
  // run the same loop against a server that fails on the 2nd close
  const run = vm.runInNewContext(`(async () => {
    const pickedThreads = new Set(['T1','T2','T3']); const logs = []; const room = 'A';
    const logAction = (t, u, r) => logs.push({ u, r });
    const api = async (m, url) => { if (url.includes('T2')) throw Error('끊김'); };
    const ids = [...pickedThreads]; const closeRoom = room; let error = '';
    try {
      ${slice('          const closed = [];', '\n          }\n        },').slice(0, -10).replace('encodeURIComponent(t)', 't').replace('${chat}', 'A')}
    } catch (e) { error = e.message; }
    return { error, picked: [...pickedThreads], logs };
  })()`.replace(/\$\{chat\}/g, 'A'));
  return run.then((r) => {
    assert.equal(r.error, '끊김');
    assert.deepEqual(Array.from(r.picked), ['T2', 'T3']);
    assert.deepEqual(Array.from(r.logs[0].u.ids), ['T1']);
  });
});

test('syncGlossary sends nothing for a missing config and still sends a cleared glossary', async () => {
  const fnSrc = slice('  async function syncGlossary(id) {', '\n  }\n');
  async function run(stored, sentBefore) {
    const posts = [];
    const api = async (method, url, body) => {
      if (url.endsWith('/runtime/client')) return [{ id: 'g1', name: '번역 프리셋·단어장' }];
      if (url.endsWith('/storage')) { if (stored instanceof Error) throw stored; return stored; }
      posts.push(body); return {};
    };
    const fn = vm.runInNewContext(`(() => { const GLOSSARY_EXTENSION = '번역 프리셋·단어장'; const glossarySent = new Map(${sentBefore ? "[['r', 'old']]" : ''}); let glossaryExtensionId; ${fnSrc}; return syncGlossary; })()`, { api });
    await fn('r');
    return posts;
  }
  assert.equal((await run(null)).length, 0);
  assert.equal((await run({})).length, 0);
  assert.equal((await run({ value: {} })).length, 0);
  assert.equal((await run({ value: { config: {} } })).length, 0);
  assert.equal((await run(new Error('읽기 실패'))).length, 0);
  assert.equal((await run({ value: { config: { defaults: { glossary: 'x' } } } })).length, 1);
  // the person saved an empty glossary for this room after one was sent: that must go out
  const cleared = await run({ value: { config: { chats: { r: { glossary: '' } } } } }, true);
  assert.deepEqual(cleared.map((p) => p.glossary), ['']);
});

test('undoing an auto-applied tracker start date takes two clicks and says what else goes', () => {
  const c = slice("case 'trackerUndoApplied':", "case 'scenePickOpen'");
  assert.ok(c.indexOf("armed !== `trackerUndoApplied:") < c.indexOf('api('));
  assert.match(source, /trackerUndoApplied:\$\{x\.id\}`\s*\?\s*'한 번 더 누르면 되돌립니다\. 그 뒤로 고치거나 더한 시작일도 함께 사라집니다'/);
  assert.match(source, /!\['trackerUndoApplied', 'nameApply'/);
});
