'use strict';
// The memory text as the reply model reads it (invented names): fewer and shorter quotes, one numbering for scenes,
// an English memory framed in English with people's Latin names, old cut values shown whole, passed deadlines marked.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../memory-module/lib/scenes.cjs');
const T = require('../memory-module/lib/translate.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const St = require('../memory-module/lib/state.cjs');
const Nb = require('../memory-module/lib/notebook.cjs');

test('an event shows its spoken lines first, at most two, and no scrap or repeat of narration', () => {
  const q = (text, kind, by = '빅터') => ({ text, kind, by });
  const quotes = [q('Wait.', 'narration', null), q('"Stay here."', 'dialogue'), q('"Fine, then."', 'dialogue', '세라'), q('"One more."', 'dialogue')];
  const picked = S.pickQuotes(quotes).map((x) => x.text);
  assert.deepEqual(picked, ['"Stay here."', '"Fine, then."']);
  const seen = new Set();
  const long = 'The harbor lights went out one by one while they waited.';
  assert.deepEqual(S.pickQuotes([q(long, 'narration', null)], seen).length, 1);
  assert.deepEqual(S.pickQuotes([q(long, 'narration', null)], seen).length, 0, 'the same narration is not quoted twice in a scene');
});

test('a scene line starts with its own id, the same one chapters and recalled scenes use', () => {
  const scene = { id: 'S12', time: '25-03-01', place: '부두', title: '열쇠', summary: '요약', events: [], recollections: [] };
  assert.match(S.renderExpanded(scene, 0), /^S12 25-03-01 · 부두 — 열쇠/);
});

test('English memory: Korean glosses after English lines go, headings and labels are English, people get their Latin names', () => {
  const names = T.latinNames({ people: { '세라 문': { aliases: ['Sera', 'Sera Moon', '세라'] }, 빅터: { aliases: ['Viktor'] } } });
  assert.deepEqual(names.map((n) => `${n.from}>${n.to}`).sort(), ['빅터>Viktor', '세라 문>Sera Moon', '세라>Sera']);
  assert.equal(names[0].from, '세라 문', 'longest first');
  const src = [
    '[Memory: notes about "[수첩]" and "[호칭]"; "모름: X" means X does not know.',
    '- More rules.]',
    '',
    '[호칭] 빅터→세라: 꼬마',
    '[수첩] (각 인물이 혼자 정해 둔 대하는 법과 속마음·다짐. 그 인물만 알고 다른 인물은 모름. 말로 꺼내지 말고 그 인물의 선택과 행동에 묻어나게.)',
    '- 빅터: (At the pier) I will wait for her.',
    '  지금 떠오르는 것: (Rain) She hates the rain.',
    '',
    '[아직 끝나지 않은 일]',
    '- 약속 빅터→세라: Walk her home [기한: 25-03-01 (토) 06:00, 오늘, 지남] (최근: Halfway done.)',
    '',
    '[지난 장면들]',
    '  빅터 → 세라: "Stay here." (여기 있어.)',
    '  세라 → 빅터: "싫어."',
  ].join('\n');
  const out = T.translateText(src, 'en', () => null, { names }).text;
  assert.match(out, /^\[Memory: notes about "\[Notebook\]" and "\[Address\]"; "unaware: X" means/);
  assert.match(out, /\n- More rules\.\]\n/, 'the rest of the instructions stay as they are');
  assert.match(out, /\n\[Address\] Viktor→Sera: 꼬마\n/);
  assert.match(out, /\n\[Notebook\] \(What each character privately decided/);
  assert.match(out, /\n- Viktor: \(At the pier\) I will wait for her\.\n  coming to mind now: \(Rain\)/);
  assert.match(out, /\n- Promise Viktor→Sera: Walk her home \[deadline: 25-03-01 \(Sat\) 06:00, today, overdue\] \(latest: Halfway done\.\)/);
  assert.match(out, /\n  Viktor → Sera: "Stay here\."\n/);
  assert.match(out, /\n  Sera → Viktor: "싫어\."$/, 'a Korean line keeps its words');
  // A Korean memory is left as it was.
  assert.equal(T.translateText(src, 'ko', () => null, { names }).text, src);
});

test('a deadline earlier today that has passed says so', () => {
  const ledger = { storyDate: '2025-03-01', storyTime: '2025-03-01T12:30', threads: [] };
  const t = { id: 'T1', kind: 'pending', status: 'open', title: 'Return the key', who: '빅터', evidence: [], clues: [], due: { date: '2025-03-01', time: '06:00' } };
  ledger.threads.push(t);
  assert.match(L.renderCompact(ledger), /06:00, 오늘, 지남\]/);
  t.due.time = '18:00';
  assert.match(L.renderCompact(ledger), /18:00, 오늘\]/);
});

test('a state value cut at an old length limit is shown up to its last whole word', () => {
  const outfit = 'grey wool coat with the collar turned up against the fastest wind'.slice(0, 60);
  assert.equal(outfit.length, 60);
  const file = { version: St.STATE_VERSION, cards: [{ name: '빅터', location: 'a short place', outfit, injuries: [], carrying: [], mood: 'calm' }] };
  const line = St.injectionBlock(file, ['빅터']);
  assert.match(line, /a short place · grey wool coat with the collar turned up against · calm/, 'no cut word, no dangling "the"');
});

test('the notebook gives each person a line of their own', () => {
  const notes = [{ id: 'a', who: '빅터', kind: 'heart', text: 'I will wait.' }, { id: 'b', who: '세라', kind: 'heart', text: 'He lies badly.' }];
  const block = Nb.injectionBlock({ ...Nb.emptyNotebook(), notes }, ['빅터', '세라']);
  assert.match(block, /^\[수첩\] [^\n]+\n- 빅터: I will wait\.\n- 세라: He lies badly\.$/);
});
