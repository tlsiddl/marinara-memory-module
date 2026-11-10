'use strict';
// The memory text the reply model reads ({{기억}}), checked as that model would read it: no stale "now", the author's
// plans apart from what characters remember, instructions only for sections that are there, and less repetition.
// (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-text-'));
const service = require('../memory-module/lib/service.cjs');
const St = require('../memory-module/lib/state.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const Tk = require('../memory-module/lib/trackers.cjs');
const X = service._test;

test('[지금 상태]: yesterday\'s cramp and faint are not "now"; a lasting injury stays; a long value ends at a word', () => {
  const store = { scenes: [
    { id: 'S1', time: '25-03-01 (토) 15:00', end: 2, state: [{ who: '세라', injuries: { add: ['leg cramps after jumping from the wall', '왼팔 붕대'] }, evidence: [{ number: 2, sentence: 1 }] }] },
    { id: 'S2', time: '25-03-01 (토) 20:00', end: 4, state: [{ who: '세라', injuries: { add: ['unconscious from the cold'] }, evidence: [{ number: 4, sentence: 1 }] }] },
    { id: 'S3', time: '25-03-02 (일) 10:00', end: 6, state: [{ who: '세라', location: 'the cabin', evidence: [{ number: 6, sentence: 1 }] }] },
  ] };
  assert.deepEqual(St.fold(store, null).cards[0].injuries, ['왼팔 붕대']);
  // Same day: still there.
  assert.deepEqual(St.fold({ scenes: store.scenes.slice(0, 2) }, null).cards[0].injuries.length, 3);
  // A cut value does not end on "from".
  const cut = St.cleanEntry({ location: 'the lower cabin of the yacht moored at the north pier after jumping from the deck' }, '세라');
  assert.ok(cut.location.length <= 60 && !/\s(from|of|the)$/.test(cut.location), cut.location);
});

test('the header names only the sections that are in the memory; plans have their own block and note', () => {
  const room = 'txt1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true } } });
  const store = S.emptyStore();
  store.scenes = [{ id: 'S1', start: 1, end: 2, messages: [], time: '25-03-01 (토) 15:00', place: '부두 끝 창고', title: '창고', summary: '빅터와 세라가 창고에서 만남.', events: [], recollections: [] }];
  store.window = { size: 4, firstInside: 50 };
  X.saveScenes(room, store);
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'secret', plan: true, status: 'open', title: '빅터는 등대지기의 딸에게 빚이 있음', detail: '아직 이야기에 안 나옴', who: null, toward: null, evidence: [], clues: [], unaware: [], guess: [], updatedAt: 'x' });
  X.saveLedger(room, ledger);
  const text = X.renderMemorySource(room);
  assert.match(text, /\n\[작가 계획\]\n- 빅터는 등대지기의 딸에게 빚이 있음 — /);
  assert.ok(text.includes('"[작가 계획]" is where the author means the story to go. No character knows it'));
  assert.ok(!text.includes('[아직 끝나지 않은 일]'), 'a plan is not among what the characters remember');
  assert.ok(!text.includes('"[수첩]"') && !text.includes('"[장소]"') && !text.includes('"[최근 생활]"'), 'no rule about a section that is not there');
  // In English, the headings the header names are the English ones too.
  X.saveSettings({ connection: null, memoryLanguage: 'en', chats: { [room]: { enabled: true } } });
  const en = service.renderLedger(room);
  assert.ok(en.includes('"[Author\'s plan]" is where the author means'), en.slice(0, 200));
  assert.ok(en.includes("\n[Author's plan]\n"));
});

test('[지난 장면들]: a line after one of the same day and place says only what changed', () => {
  const store = S.emptyStore();
  const sc = (id, time, place, title) => ({ id, start: Number(id.slice(1)) * 2 - 1, end: Number(id.slice(1)) * 2, messages: [], time, place, weather: '맑음', title, summary: `${title} 요약`, events: [], recollections: [] });
  store.scenes = [sc('S1', '25-03-01 (토) 21:45~21:55', '북쪽 부두에 묶인 요트의 아래층 선실', '하나'), sc('S2', '25-03-01 (토) 22:00', '북쪽 부두에 묶인 요트의 아래층 선실', '둘'), sc('S3', '25-03-02 (일) 08:00', '부두 카페', '셋')];
  const text = S.renderScenes(store, 100, { expand: 0 });
  assert.match(text, /① 25-03-01 \(토\) 21:45~21:55 · 북쪽 부두에 묶인 요트의 아래층 선실 · 맑음 — 하나/);
  assert.match(text, /② 22:00 · 같은 곳 — 둘/);
  assert.match(text, /③ 25-03-02 \(일\) 08:00 · 부두 카페 · 맑음 — 셋/);
});

test('[알게 된 사실]: what a ※ line says is not said again; a fact cut when merged ends at a whole sentence', () => {
  const store = S.emptyStore();
  store.chapters = [{ id: 'C1', title: '첫날', summary: '부두에서 만남.', scenes: [], turns: [], keep: ['세라는 금괴 세 개를 옷 속에 숨겨 다닌다.'] }];
  const long = 'Keeps a spare key under the third plank of the pier. Owes the harbour master two months of rent. Has never once been seen at the morning market, and nobody in the quarter knows where she sleeps, though the baker swears she saw her near the old';
  store.facts = [
    { id: 'F1', about: '세라', text: '세라는 금괴 세 개를 옷 속에 숨겨 다닌다.', evidence: [], sceneId: 'S1' },
    { id: 'F2', about: '세라', text: long, evidence: [], sceneId: 'S1' },
  ];
  const text = S.renderScenes(store, null, {});
  assert.match(text, /※ 세라는 금괴 세 개를/);
  assert.ok(!/알게 된 사실[^]*금괴 세 개/.test(text), 'the ※ line already says it');
  assert.match(text, /two months of rent\.(\n|$)/);
  assert.doesNotMatch(text, /near the old/);
});

test('[최근 생활]: bites of one dish are one dish; [기록]: a name the label already says is not written before it', () => {
  const ledger = L.emptyLedger();
  const meal = (at, text) => ({ who: '세라', what: 'meal', at, text, number: 1 });
  ledger.routine = [{ who: '세라', what: 'wake', at: '2025-03-02 08:00', number: 1 }, meal('2025-03-02 11:05', 'a bite of raw lamb stew from his spoon'), meal('2025-03-02 11:08', 'second piece of iced lamb stew from his spoon'), meal('2025-03-02 11:10', 'chilled lamb stew')];
  const line = L.renderRoutine(ledger, '2025-03-02 11:30');
  assert.equal((line.match(/lamb stew/g) || []).length, 1, line);
  assert.equal(Tk.entryText({ scope: 'people', people: ['빅터 헤일'], label: '빅터 만난 지', type: 'since' }, { short: '5일째' }), '빅터 만난 지 5일째');
  assert.equal(Tk.entryText({ scope: 'people', people: ['세라'], label: '생일까지', type: 'until' }, { short: 'D-3' }), '세라 생일까지 D-3');
});
