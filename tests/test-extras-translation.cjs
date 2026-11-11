'use strict';
// Korean for the optional records (인물 상태·장소·소중한 물건·트래커), open items first in the translation order, and the
// background translation after a memory run that only runs with 자동 번역 on. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-extras-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const Tr = require('../memory-module/lib/translate.cjs');
const X = service._test;

test('display texts: open items first, then the newest scenes, and the optional records', () => {
  const store = { scenes: [
    { title: 'Old scene', summary: 'Long ago.', events: [], recollections: [] },
    { title: 'New scene', summary: 'Just now.', events: [], recollections: [] },
  ], facts: [], chapters: [], arcs: [] };
  const ledger = { threads: [{ status: 'closed', title: 'Closed promise' }, { status: 'open', title: 'Meet at the harbor at dawn', detail: 'Daniel promised Sera.' }] };
  const world = {
    cards: [{ name: 'Daniel', location: 'the harbor', outfit: 'a grey coat', mood: 'tense', injuries: ['cut on the left hand'], carrying: ['the forged ledger'] }],
    places: [{ name: 'The harbor', description: 'Foggy docks', layout: 'Piers to the east', features: ['a broken crane'] }],
    keepsakes: [{ name: 'Silver compass', from: 'his mother', meaning: 'a way home', history: [{ event: 'Given at the station' }] }],
    trackers: [{ label: 'Days since meeting' }],
  };
  const texts = Tr.displayTexts(store, ledger, { world });
  assert.deepEqual(texts.slice(0, 2), ['Meet at the harbor at dawn', 'Daniel promised Sera.'], 'open items first');
  assert.ok(texts.indexOf('New scene') < texts.indexOf('Old scene'), 'newest scene before older ones');
  for (const t of ['the harbor', 'a grey coat', 'tense', 'cut on the left hand', 'the forged ledger', 'The harbor', 'Foggy docks', 'Piers to the east', 'a broken crane', 'Silver compass', 'his mother', 'a way home', 'Given at the station', 'Days since meeting']) {
    assert.ok(texts.includes(t), t);
  }
  assert.ok(texts.indexOf('Closed promise') > texts.indexOf('Meet at the harbor at dawn'));
});

test('the 인물·장소 screen shows a Korean line under each field that has one, and names with their Korean', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const trMap = { 'a grey coat': '회색 코트', 'cut on the left hand': '왼손 베인 상처', 'Foggy docks': '안개 낀 부두', 'The harbor': '항구', 'Silver compass': '은 나침반', 'a way home': '집으로 가는 길', Daniel: '다니엘' };
  const shared = require('./ui-shared.cjs')(source, esc, trMap);
  const fn = (name) => {
    const start = source.indexOf(`  function ${name}(`);
    return vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, ...shared });
  };
  const state = fn('statePaper')({ characterState: true, cards: [{ name: 'Daniel', outfit: 'a grey coat', injuries: ['cut on the left hand', 'bruise'] }], sceneTitles: {} }, null, '');
  assert.match(state, /<h3>다니엘<\/h3>/);
  assert.match(state, /한국어<input class="ko-edit"[^>]*value="회색 코트"/);
  assert.match(state, /한국어<input class="ko-edit"[^>]*value="왼손 베인 상처 · bruise"/, 'a list: each item looked up');
  const places = fn('placesPaper')({ places: true, placeList: [{ id: 'p1', name: 'The harbor', description: 'Foggy docks', features: [] }], sceneTitles: {} }, null, '');
  assert.match(places, /The harbor <small class="tr-inline">\(항구\)<\/small>/);
  assert.match(places, /한국어<input class="ko-edit"[^>]*value="안개 낀 부두"/);
  const keeps = fn('keepsakesPaper')({ keepsakes: true, keepList: [{ id: 'k1', name: 'Silver compass', meaning: 'a way home', owner: 'Daniel' }], sceneTitles: {} }, null, '');
  assert.match(keeps, /Silver compass <small class="tr-inline">\(은 나침반\)<\/small>/);
  assert.match(keeps, /한국어<input class="ko-edit"[^>]*value="집으로 가는 길"/);
  assert.match(keeps, /한국어: 다니엘/, 'the owner is a name: written the Korean way');
});

test('after a run the library translation starts in the background only with 자동 번역 on and a connection', () => {
  X.saveSettings({ connection: null, autoTranslate: true, writeLanguage: 'en', chats: {} });
  assert.equal(X.translateDisplayLater('e1'), false, 'no connection: nothing');
  X.saveSettings({ connection: 'c', autoTranslate: false, writeLanguage: 'en', chats: {} });
  assert.equal(X.translateDisplayLater('e1'), false, '자동 번역 off: nothing');
  X.saveSettings({ connection: 'c', autoTranslate: true, writeLanguage: 'en', chats: {} });
  assert.equal(X.translateDisplayLater('e1'), false, 'nothing to translate: nothing');
});
