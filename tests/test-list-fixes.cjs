'use strict';
// From a check of a room against its source: a ledger item can name several people on either side and be fixed by
// hand, and a birth told in a flashback is not a day count starting today. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-listfix-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const Tk = require('../memory-module/lib/trackers.cjs');
const X = service._test;

const handlers = {};
const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
X.setEngine({ chats: { async listMessages() { return []; }, async getById(id) { return { id, metadata: {} }; } }, connections: { async list() { return []; } } });
service.attach(app);
const reply = { status() { return { send(x) { return x; } }; } };

test('a ledger item names several people toward whom, set by hand; a plan stays without names', async () => {
  const room = 'lf1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: false } } });
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'promise', status: 'open', title: '조언', who: '세라', toward: '도윤', detail: '', unaware: [], guess: [], evidence: [] });
  ledger.threads.push({ id: 'T2', kind: 'pending', status: 'open', plan: true, title: '계획', who: null, toward: null, detail: '', unaware: [], guess: [], evidence: [] });
  ledger.nextId = 3;
  X.saveLedger(room, ledger);
  const edit = (tid, body) => handlers['POST /chats/:id/threads/:tid/:action']({ params: { id: room, tid, action: 'edit' }, body }, reply);
  await edit('T1', { toward: '도윤, 하준' });
  assert.equal(X.loadLedger(room).threads[0].toward, '도윤·하준');
  await edit('T1', { toward: '' });
  assert.equal(X.loadLedger(room).threads[0].toward, null);
  await edit('T2', { who: '세라' });
  assert.equal(X.loadLedger(room).threads[1].who, null, 'a plan keeps no names');
  assert.match(L.SYSTEM_PROMPT || fs.readFileSync(path.join(__dirname, '../memory-module/lib/ledger.cjs'), 'utf8'), /여럿이면 ·로 이어서/);
});

test('a birth is not a day count; a meeting still is', () => {
  assert.equal(Tk.cleanHint({ type: 'count', label: 'born in Liverpool', people: [] }), null);
  assert.equal(Tk.cleanHint({ type: 'count', label: '태어난 지', people: [] }), null);
  assert.ok(Tk.cleanHint({ type: 'count', label: '만난 지', people: [] }));
  assert.match(Tk.PROMPT, /회상이나 지난 이야기 속의 일/);
});

test('an open item that moved on reads now first, then how it began', () => {
  const ledger = L.emptyLedger();
  const t = { id: 'T1', kind: 'promise', status: 'open', title: 'Walk her home', who: '빅터', toward: '세라', detail: 'He said he would walk her home after the market.', since: '25-03-01', latest: { text: 'They reached the gate together.', number: 9 }, unaware: [], guess: [], evidence: [], clues: [] };
  ledger.threads.push(t);
  const line = L.renderCompact(ledger);
  assert.match(line, /Walk her home — 지금: They reached the gate together\. \[25-03-01\] \(처음: He said he would walk her home after the market\.\)/);
  const plain = L.renderCompact({ ...ledger, threads: [{ ...t, latest: null }] });
  assert.match(plain, /Walk her home — He said he would walk her home after the market\. \[25-03-01\]/);
  assert.doesNotMatch(plain, /처음:/);
});

test('a quoted line is shown with the Korean the chat already has (paragraph translations on the message)', () => {
  const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const p1 = 'The rain stopped. Sera opened the door.';
  const p2 = 'He laughed. Then he left without a word. Nobody followed.';
  const rows = [{ id: 'm1', rowid: 1, role: 'assistant', content: `<speaker="x">${p1}</speaker>\n\n*${p2}*`, extra: JSON.stringify({ paraTranslate: { v: 1, map: { [hash(p1)]: '비가 그쳤다. 세라가 문을 열었다.', [hash(p2)]: '그가 웃더니 말없이 떠났다. 아무도 따라가지 않았다.' } } }) }];
  const map = X.noteSourceKo('src1', rows);
  assert.equal(map.get('Sera opened the door.'), '세라가 문을 열었다.', 'same number of sentences: sentence by sentence');
  assert.equal(map.get('Nobody followed.'), '그가 웃더니 말없이 떠났다. 아무도 따라가지 않았다.', 'otherwise the short paragraph stands for each');
  const room = 'src1';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: false } } });
  X.saveScenes(room, { ...require('../memory-module/lib/scenes.cjs').emptyStore(), scenes: [{ id: 'S1', start: 1, end: 1, title: 't', summary: 's', present: [], events: [{ text: 'e', quotes: [{ number: 1, sentence: 2, text: 'Sera opened the door.' }, { number: 1, sentence: 1, text: '"Hi." (안녕.)', translation: '안녕.' }] }] }] });
  assert.deepEqual(X.sourceQuoteItems(room), { 'Sera opened the door.': '세라가 문을 열었다.' });
  assert.equal(X.translationLookup(room, 'ko')('Sera opened the door.'), '세라가 문을 열었다.');
});

test('story lines for older scenes come from their summaries, only where a scene has none, asked once', () => {
  const S = require('../memory-module/lib/scenes.cjs');
  const store = { ...S.emptyStore(), scenes: [
    { id: 'S1', start: 1, end: 2, title: 'Key', summary: 'Sera hides the shed key.', present: [], events: [] },
    { id: 'S2', start: 3, end: 4, title: 'Search', summary: 'Doyun looks for the key.', present: [], events: [] },
    { id: 'S3', start: 5, end: 6, title: 'Found', summary: 'The key turns up.', present: [], events: [], lines: [{ name: 'Shed key', now: 'Found.' }] },
  ] };
  assert.deepEqual(S.lineFillTargets(store).map((s) => s.id), ['S1', 'S2']);
  const prompt = S.buildLineFillPrompt(store, S.lineFillTargets(store))[1].content;
  assert.doesNotMatch(prompt, /Shed key/, 'a line that began after the asked scenes is not offered');
  assert.match(prompt, /S1 Key: Sera hides the shed key\./);
  const filled = S.applyLineFill(store, { scenes: [{ id: 's1', lines: [{ name: 'Shed key', now: 'Hidden.' }] }, { id: 'S3', lines: [{ name: 'Other' }] }] }, S.lineFillTargets(store));
  assert.equal(filled, 1);
  assert.deepEqual(store.scenes[0].lines, [{ name: 'Shed key', now: 'Hidden.' }]);
  assert.equal(store.scenes[0].linesFilled, true);
  assert.deepEqual(store.scenes[2].lines, [{ name: 'Shed key', now: 'Found.' }], 'a scene that had lines keeps them');
  assert.deepEqual(S.lineFillTargets(store), [], 'S2 was asked and got none: not asked again');
});

test('a feeling filed for a habit moves to a state; the review prompt knows a feeling can fade', () => {
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'emotion', status: 'open', title: 'Calls him by a nickname', who: '세라', toward: '도윤', detail: '', need: 'x', unaware: [], guess: [], evidence: [], clues: [] });
  const stats = L.applyFeelingReview(ledger, { resolved: [], misfiled: [{ id: 'T1', kind: 'state' }] }, []);
  assert.equal(stats.moved, 1);
  assert.equal(ledger.threads[0].kind, 'state');
  assert.match(fs.readFileSync(path.join(__dirname, '../memory-module/lib/ledger.cjs'), 'utf8'), /가라앉음도 풀림이야/);
});

test('a line fill that puts a long stretch on one line is refused; filled lines can be taken back; later lines are not offered', () => {
  const S = require('../memory-module/lib/scenes.cjs');
  const scenes = Array.from({ length: 10 }, (_, i) => ({ id: `S${i + 1}`, start: i * 2 + 1, end: i * 2 + 2, title: `t${i}`, summary: `s${i}`, present: [], events: [] }));
  scenes[9].lines = [{ name: 'Late trip', now: 'Arrived.' }];
  const store = { ...S.emptyStore(), scenes };
  const list = S.lineFillTargets(store);
  assert.doesNotMatch(S.buildLineFillPrompt(store, list)[1].content, /Late trip/, 'a line that starts after the asked scenes is not offered');
  const all = { scenes: list.map((s) => ({ id: s.id, lines: [{ name: 'Late trip' }] })) };
  assert.equal(S.applyLineFill(store, all, list), -1);
  assert.equal(store.scenes.filter((s) => s.lines).length, 1);
  delete store.lineFillTried;
  assert.equal(S.applyLineFill(store, { scenes: [{ id: 'S1', lines: [{ name: 'Key' }] }, { id: 'S2', lines: [{ name: 'Key' }] }] }, S.lineFillTargets(store)), 2);
  assert.equal(S.undoLineFill(store), 2);
  assert.equal(store.scenes.filter((s) => s.lines).length, 1, 'the scene call\'s own lines stay');
  assert.equal(S.lineFillTargets(store).length, 9);
});

test('a story line is renamed in every scene and its now corrected; a filled line fixed by hand stays on redo', async () => {
  const S = require('../memory-module/lib/scenes.cjs');
  const room = 'line-edit';
  X.saveSettings({ connection: null, chats: { [room]: { enabled: false } } });
  const scenes = [
    { id: 'S1', start: 1, end: 2, title: 'a', summary: 'a', present: [], events: [], lines: [{ name: 'Shed key', now: 'Hidden.' }], linesFilled: true },
    { id: 'S2', start: 3, end: 4, title: 'b', summary: 'b', present: [], events: [], lines: [{ name: 'shed key', now: 'Found.' }] },
    { id: 'S3', start: 5, end: 6, title: 'c', summary: 'c', present: [], events: [], lines: [{ name: 'Trip' }] },
  ];
  X.saveScenes(room, { ...S.emptyStore(), scenes, lineFillTried: ['S1'] });
  const edit = (body) => handlers['POST /chats/:id/lines/edit']({ params: { id: room }, body }, reply);
  const out = await edit({ from: 'Shed key', name: 'The shed key', now: 'Found under the step.' });
  assert.deepEqual(out.scenes, ['S1', 'S2']);
  const saved = X.loadScenes(room);
  assert.deepEqual(saved.scenes.map((s) => s.lines[0].name), ['The shed key', 'The shed key', 'Trip']);
  assert.equal(saved.scenes[1].lines[0].now, 'Found under the step.', 'the newest now is the one corrected');
  assert.equal(saved.scenes[0].lines[0].now, 'Hidden.');
  assert.match(JSON.stringify(await edit({ from: 'The shed key', name: 'Trip' })), /이미 있습니다/);
  S.undoLineFill(saved);
  assert.equal(saved.scenes[0].lines[0].name, 'The shed key', 'fixed by hand: not taken back');
  assert.match(S.buildLineFillPrompt(saved, [saved.scenes[0]], { lang: 'en' })[0].content, /영어로 써/);
  const T = require('../memory-module/lib/translate.cjs');
  assert.ok(T.displayTexts(saved, null).includes('Trip'), 'line names are shown in Korean');
});

test('a long line name is cut at a word; a filled line on one scene only is taken off', () => {
  const S = require('../memory-module/lib/scenes.cjs');
  assert.equal(S.lineEntries([{ name: "Irina's arrival at the VIP terrace above the bay" }])[0].name, "Irina's arrival at the VIP");
  const store = { ...S.emptyStore(), scenes: [
    { id: 'S1', lines: [{ name: 'Gold bars' }, { name: 'Trip' }], linesFilled: true },
    { id: 'S2', lines: [{ name: 'Trip' }], linesFilled: true },
    { id: 'S3', lines: [{ name: 'Alone' }], linesFilled: true },
    { id: 'S4', lines: [{ name: 'Own' }] },
  ] };
  assert.equal(S.pruneLoneFilledLines(store), 2);
  assert.deepEqual(store.scenes.map((s) => (s.lines || []).map((l) => l.name)), [['Trip'], ['Trip'], [], ['Own']]);
});

test('people only in events of their own, never with the user\'s character\'s group, were elsewhere', () => {
  const S = require('../memory-module/lib/scenes.cjs');
  const scene = { id: 'S2', present: ['세라', '도윤', '하준', '민호'], events: [
    { text: 'a', with: ['세라', '도윤'] }, { text: 'b', with: ['하준', '민호'] }, { text: 'c', with: ['도윤', '세라'] },
  ] };
  assert.deepEqual(S.separatedPresence(scene, ['세라']), { present: ['세라', '도윤'], elsewhere: ['하준', '민호'] });
  assert.equal(S.separatedPresence({ ...scene, events: [...scene.events, { text: 'd', with: ['하준', '도윤'] }] }, ['세라']), null, 'they met: all present');
  assert.equal(S.separatedPresence({ id: 'S5', present: ['도윤', '하준'], events: [{ text: 'a', with: ['도윤'] }, { text: 'b', with: ['하준'] }] }, ['세라']), null, 'no user character: left alone');
  assert.equal(S.separatedPresence({ ...scene, edited: true }, ['세라']), null);
  const store = { personas: ['세라'], scenes: [scene] };
  assert.equal(S.fixSeparatedPresence(store), 1);
  assert.equal(S.fixSeparatedPresence(store), 0, 'each scene once');
  assert.equal(S.lineEntries([{ name: 'The Vane freighter and the hidden gold' }])[0].name, 'The Vane freighter');
});

test('calls in Greek, Chinese and Japanese are read; a name said in Greek is not a call', () => {
  const S = require('../memory-module/lib/scenes.cjs');
  const terms = (t, o = {}) => S.vocativeTerms(t, [], { mid: true, ...o }).map((x) => x.term);
  assert.deepEqual(terms('"Κύπρι, έλα."'), ['Κύπρι']);
  assert.deepEqual(terms('"ψαρά, σταμάτα."', { anyCase: true }).slice(0, 1), ['ψαρά'], 'lower case only for pairing');
  assert.deepEqual(terms('"师父，你去哪儿？"'), ['师父']);
  assert.deepEqual(terms('"好的，我知道。"'), []);
  assert.deepEqual(terms('"美咲ちゃん、行こう。"'), ['美咲ちゃん']);
  const Addr = require('../memory-module/lib/address.cjs');
  const q = (n, text, translation) => ({ number: n, sentence: 1, text, translation, by: '도윤', to: '세라', kind: 'dialogue' });
  const store = { cast: ['도윤', '세라', '마르코'], personas: ['세라'], scenes: [{ id: 'S1', present: ['도윤', '세라'], events: [{ text: 'e', quotes: [
    q(1, '"Κύπρι, έλα εδώ." (키프리, 이리 와.)', '키프리, 이리 와.'), q(2, '"Μην φεύγεις, Κύπρι." (가지 마, 키프리.)', '가지 마, 키프리.'),
    q(3, '"ψαρά, σταμάτα." (어부 양반, 그만해.)', '어부 양반, 그만해.'), q(4, '"Άκου, ψαρά." (들어 봐, 어부 양반.)', '들어 봐, 어부 양반.'), q(7, '"ψαρά, φτάνει." (어부 양반, 됐어.)', '어부 양반, 됐어.'),
    q(5, '"Μάρκο, έλα." (마르코, 와.)', '마르코, 와.'), q(6, '"Έλα, Μάρκο." (와, 마르코.)', '와, 마르코.'),
  ] }] }] };
  const book = Addr.emptyBook();
  Addr.refresh(book, store);
  const by = new Map(book.entries.map((e) => [e.id, e]));
  const shown = book.entries.filter((e) => !e.pairOf).map((e) => `${e.term}${e.pairWith ? `(${by.get(e.pairWith).term})` : ''}`).sort();
  assert.ok(shown.includes('Κύπρι(키프리)'), shown.join(' '));
  assert.ok(shown.includes('ψαρά(어부 양반)'), shown.join(' '));
  assert.ok(!shown.some((t) => /Μάρκο/.test(t)), 'a name in Greek is a name');
});

test('daily life shows only the people the room picked, with "기록 없음" for one with no record', () => {
  const ledger = { ...L.emptyLedger(), routine: [{ who: '세라', what: 'meal', text: 'soup', at: '2025-03-01T12:00' }, { who: '하준', what: 'meal', text: 'rice', at: '2025-03-01T12:00' }] };
  const out = L.renderRoutine(ledger, '2025-03-01T13:00', { only: ['세라', '도윤'] });
  assert.match(out, /- 세라: /);
  assert.match(out, /- 도윤: 기록 없음/);
  assert.doesNotMatch(out, /하준/);
  assert.match(L.renderRoutine(ledger, '2025-03-01T13:00'), /하준/, 'nobody picked: everyone with a record');
});

test('things carried twice in other words or languages are listed once; a guessed listener only adds to a call already seen', () => {
  const St = require('../memory-module/lib/state.cjs');
  const ko = { "Irina's sunglasses and unlit Sobranie cigarette": '이리나의 선글라스와 불붙이지 않은 소브라니 담배' };
  assert.deepEqual(St.dedupeItems(['이리나의 선글라스', 'black UV parasol', "Irina's unlit Sobranie cigarette", 'folded black parasol', "Irina's sunglasses and unlit Sobranie cigarette", 'white towel'], (t) => ko[t]),
    ['folded black parasol', "Irina's sunglasses and unlit Sobranie cigarette", 'white towel']);
  const Addr = require('../memory-module/lib/address.cjs');
  const q = (n, text, to, extra = {}) => ({ number: n, sentence: 1, text, by: '세라', to, kind: 'dialogue', ...extra });
  const store = { cast: ['도윤', '세라'], personas: ['세라'], scenes: [{ id: 'S1', present: ['도윤', '세라'], events: [{ text: 'e', quotes: [
    q(1, '"아리, 괜찮아?"', '도윤'), q(2, '"Ἄρι, ἔλθε."', '도윤', { toGuess: true }),
    q(3, '"보리, 와."', '도윤', { toGuess: true }), q(4, '"보리, 가."', '도윤', { toGuess: true }),
  ] }] }] };
  const book = Addr.emptyBook();
  Addr.refresh(book, store);
  const by = new Map(book.entries.map((e) => [e.id, e]));
  const shown = book.entries.filter((e) => !e.pairOf).map((e) => `${e.term}${e.pairWith ? `(${by.get(e.pairWith).term})` : ''}`);
  assert.ok(shown.includes('Ἄρι(아리)'), shown.join(' '));
  assert.ok(!shown.some((t) => /보리/.test(t)), 'guesses alone make no call');
});
