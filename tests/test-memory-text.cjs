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
  ledger.threads.push({ id: 'T1', kind: 'secret', plan: true, status: 'open', title: '빅터는 등대지기의 딸에게 빚이 있음', detail: '아직 이야기에 안 나옴', mystery: '빅터가 등대에 자꾸 가는 이유', who: null, toward: null, evidence: [], clues: [], unaware: [], guess: [], updatedAt: 'x' });
  // A plan made before plans had a hidden line: left out of the reply until it gets one (its title is the answer).
  ledger.threads.push({ id: 'T2', kind: 'secret', plan: true, status: 'open', title: '세라의 흉터는 화재 때 생김', detail: '', who: null, toward: null, evidence: [], clues: [], unaware: [], guess: [], updatedAt: 'x' });
  X.saveLedger(room, ledger);
  const text = X.renderMemorySource(room);
  // By default only what stays hidden goes in: the reply model is never told the answer.
  assert.match(text, /\n\[작가 계획\]\n- 빅터가 등대에 자꾸 가는 이유(\n|$)/);
  assert.ok(!text.includes('등대지기의 딸') && !text.includes('화재'), 'no answer in the reply');
  assert.ok(text.includes('"[작가 계획]" lists what the story keeps unexplained for now'));
  assert.ok(!text.includes('[아직 끝나지 않은 일]'), 'a plan is not among what the characters remember');
  assert.ok(!text.includes('"[수첩]"') && !text.includes('"[장소]"') && !text.includes('"[최근 생활]"'), 'no rule about a section that is not there');
  // The room may give the answers too.
  X.saveSettings({ connection: null, chats: { [room]: { enabled: true, planAnswers: true } } });
  const withAnswers = X.renderMemorySource(room);
  assert.match(withAnswers, /- 빅터는 등대지기의 딸에게 빚이 있음 — 아직 이야기에 안 나옴/);
  assert.ok(withAnswers.includes('is where the author means the story to go (the answers)'));
  // In English, the headings the header names are the English ones too.
  X.saveSettings({ connection: null, memoryLanguage: 'en', chats: { [room]: { enabled: true } } });
  const en = service.renderLedger(room);
  assert.ok(en.includes('"[Author\'s plan]" lists what the story keeps unexplained'), en.slice(0, 200));
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

test('a scene of OOC talk alone is not a scene of the story: not listed, not the scene shown now', () => {
  const store = S.emptyStore();
  const story = { id: 'S1', start: 1, end: 2, messages: [{ id: 'a1' }, { id: 'a2' }], time: 't', place: '부두', title: '부두', summary: '만남', present: ['빅터', '세라'], events: [{ text: 'e', quotes: [] }], recollections: [] };
  const ooc = { id: 'S2', start: 3, end: 4, messages: [{ id: 'a3' }, { id: 'a4' }], time: 't', place: '?', title: 'Out-of-story exchange', summary: 'omitted', present: [], events: [], recollections: [] };
  store.scenes = [story, ooc];
  // Made before OOC was known: marked once the messages say so.
  assert.equal(S.markOocScenes(store, [{ id: 'a1' }, { id: 'a2' }, { id: 'a3', ooc: true }, { id: 'a4', ooc: true }]), 1);
  assert.equal(store.scenes[1].ooc, true);
  assert.equal(S.markOocScenes(store, [{ id: 'a1' }, { id: 'a2' }, { id: 'a3', ooc: true }, { id: 'a4', ooc: true }]), 0, 'nothing twice');
  assert.doesNotMatch(S.renderScenes(store, null, { expand: 0 }), /Out-of-story/);
  assert.equal(S.lastStoryScene(store).id, 'S1');
  assert.deepEqual(X.lastScenePeople(store), ['빅터', '세라'], 'the people now are those of the last story scene');
  // A message set back to story by hand: the scene is a story scene again.
  assert.equal(S.markOocScenes(store, [{ id: 'a3' }, { id: 'a4', ooc: true }]), 1);
  assert.equal(store.scenes[1].ooc, undefined);
});

test('threads already said to be over (in English too) are closed; "not over yet" and plans to finish are not', () => {
  const t = (id, kind, detail, latest) => ({ id, kind, status: 'open', title: id, detail, latest: latest ? { text: latest } : null, evidence: [], clues: [], updatedAt: 'x' });
  const ledger = { ...L.emptyLedger(), threads: [
    t('T1', 'promise', 'Viktor rows the boat out — the race is over; Sera rests on the dock.'),
    t('T2', 'promise', 'Marco called back', 'Marco was paid and crossed off the list.'),
    t('T3', 'promise', 'The race is not over yet.'),
    t('T4', 'pending', 'They will go once the paperwork is done.'),
    t('T5', 'emotion', 'Her anger is over.'),
  ] };
  assert.equal(L.closeDoneThreads(ledger), 2);
  assert.deepEqual(ledger.threads.map((x) => x.status), ['closed', 'closed', 'open', 'open', 'open']);
  assert.match(ledger.threads[1].closed.how, /crossed off/);
});

test('[최근 생활] is a heading of its own line, so it reads the same as the header calls it in every language', () => {
  const ledger = L.emptyLedger();
  ledger.routine = [{ who: '세라', what: 'wake', at: '2025-03-02 08:00', number: 1 }];
  const text = L.renderRoutine(ledger, '2025-03-02 09:00');
  assert.match(text, /^\[최근 생활\]\n지금: /);
  const T = require('../memory-module/lib/translate.cjs');
  assert.equal(T.planLines(text, 'en')[0].text, '[Recent daily life]');
});

test('a pending task that was carried out (answered, found, explained) is closed; a promise or a secret is not by those words', () => {
  const t = (id, kind, latest) => ({ id, kind, status: 'open', title: id, detail: '', latest: { text: latest }, evidence: [], clues: [], updatedAt: 'x' });
  const ledger = { ...L.emptyLedger(), threads: [
    t('T1', 'pending', 'Sera answered the harbour question: she ran from a dinner.'),
    t('T2', 'pending', 'Viktor opened the box and found the letter.'),
    t('T3', 'pending', 'Sera repeated she remembers neither the face nor the shop.'),
    t('T4', 'pending', 'He has not answered yet.'),
    t('T5', 'secret', 'Sera answered both questions.'),
    t('T6', 'pending', '세라가 항구 일을 설명했다.'),
  ] };
  assert.equal(L.closeDoneThreads(ledger), 3);
  assert.deepEqual(ledger.threads.map((x) => x.status), ['closed', 'closed', 'open', 'open', 'open', 'closed']);
});
