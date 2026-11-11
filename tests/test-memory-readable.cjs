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
    '- 약속 빅터→세라: Carry the bag — 지금: Halfway there. [25-03-01] (처음: She asked him to.)',
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
  assert.match(out, /\n- Promise Viktor→Sera: Carry the bag — now: Halfway there\. \[25-03-01\] \(at first: She asked him to\.\)/);
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

test('a name inside a Korean phrase stays Korean; a time of day after a date is in English', () => {
  const names = [{ from: '세라', to: 'Sera' }];
  assert.equal(T.latinizeNames('- 세라: 세라의 열쇠 · 세라는 모름', names), '- Sera: 세라의 열쇠 · 세라는 모름');
  const out = T.translateText('[지난 이야기 흐름]\nC1 25-03-01 (토) 오후 ~ 25-03-01 (토) 17:00 — Title: Text.', 'en', () => null).text;
  assert.match(out, /C1 25-03-01 \(Sat\) afternoon ~ 25-03-01 \(Sat\) 17:00/);
});

test('a shortened old chapter keeps how it began and where it ended, and its three most exact details', () => {
  const store = S.emptyStore();
  const long = 'First Sera arrives at the harbor. Then a lot happens. More happens. Viktor gives her the key. They watch the boats.';
  store.chapters = Array.from({ length: 40 }, (_, i) => ({ id: `C${i + 1}`, scenes: [], title: `t${i + 1}`, summary: i === 0 ? long : 'Filler day. '.repeat(30).trim(), turns: [],
    keep: i === 0 ? ['Sera waits outside.', 'The ferry leaves at 06:00.', 'Viktor owes 300 coins.', 'It rains.', 'If the bell rings twice, they leave.'] : [] }));
  const text = S.renderChapters(store, 4000, '');
  assert.match(text, /C1 t1: First Sera arrives at the harbor\. … Viktor gives her the key\. They watch the boats\./);
  assert.match(text, /※ The ferry leaves at 06:00\.\n  ※ Viktor owes 300 coins\.\n  ※ If the bell rings twice, they leave\./);
  assert.doesNotMatch(text, /Sera waits outside|It rains/);
});

test('a mostly English line with a Korean phrase in it (a place, a short note) is still sent to be translated', () => {
  const kind = (l) => T.planLines(`[지난 장면들]\n${l}`, 'en')[1].kind;
  assert.equal(kind('S5 25-03-01 (토) 06:00 · 북쪽 부두에 묶인 작은 배의 선실 — Dawn: The boat docks before sunrise with no one around.'), 'translate');
  assert.equal(kind('- Viktor: The boat docks before sunrise with no one around. 세라 문'), 'keep', 'a name is not a phrase');
  assert.equal(kind('- Note: "세라는 부두에서 오래 기다렸다" said Viktor, in English, as he always does.'), 'keep', 'quoted words stay as they are');
});

test('the first word of a full Korean name is mapped too (how lines mostly call people), unless two people share it', () => {
  const names = T.latinNames({ people: { '빅터 문': { aliases: ['Viktor'] }, '세라 문': { aliases: ['Sera'] }, '마르코 벨': { aliases: ['Marco'] }, '마르코 린': { aliases: ['Marko'] } } });
  const map = Object.fromEntries(names.map((n) => [n.from, n.to]));
  assert.equal(map['빅터'], 'Viktor');
  assert.equal(map['세라'], 'Sera');
  assert.equal(map['마르코'], undefined, 'shared by two people');
  assert.equal(T.latinizeNames("Main room of 빅터's boat · 빅터 and 세라 talk.", names), "Main room of Viktor's boat · Viktor and Sera talk.");
  assert.match(T.TRANSLATE_PROMPT.en, /A name already in Latin letters stays in Latin letters/);
});

test('an indented fact line ("  · …") gets its labels and names in English; a quoted story line keeps its words', () => {
  const names = [{ from: '세라', to: 'Sera' }];
  const out = T.translateText('[알게 된 사실]\n- 빅터:\n  · Keeps the harbor key in his coat. [모름: 세라]\n\n[지난 장면들]\n  빅터 → 세라: "세라, 모름: 이건 대사야."', 'en', () => null, { names }).text;
  assert.match(out, /  · Keeps the harbor key in his coat\. \[unaware: Sera\]/);
  assert.match(out, /"세라, 모름: 이건 대사야\."/);
});

test('a place cut at the old 60 letters ends at its last whole part; weather, close notes and passages read in English', () => {
  const scene = { id: 'S9', time: '25-03-01', place: "Viktor's boat, lower master cabin, North Pier, Port of Harbo", title: 't', summary: 's', events: [], recollections: [] };
  assert.equal(scene.place.length, 60);
  assert.match(S.renderExpanded(scene, 0), /^S9 25-03-01 · Viktor's boat, lower master cabin, North Pier — t/);
  assert.match(T.translateText("[지난 장면들]\nS9 25-03-01 (토) 06:00 · Viktor's boat · 맑음 — Dawn: They talk.", 'en', () => null).text, /· Clear — Dawn/);
  assert.equal(T.planLines('[지난 장면들]\n→ later: Walk her home — 데려다줌 (직접 닫음)', 'en')[1].kind, 'translate');
  const raw = T.translateText('[원문에서 떠오른 대목]\n- (98번) "Stay here." (여기 있어.) / 그 뒤로 낯선 얼굴. / "Fine." (좋아.)', 'en', () => null).text;
  assert.match(raw, /^\[Passages from the story\]\n- \(#98\) "Stay here\." \/ 그 뒤로 낯선 얼굴\. \/ "Fine\."$/);
});

test('the remembering notes after a scene line ("※ 빅터는 흐릿하게만 기억함") read in English', () => {
  const names = [{ from: '빅터', to: 'Viktor' }, { from: '세라', to: 'Sera' }];
  const out = T.translateText('[지난 장면들]\nS3 25-03-01 · same place — Dawn: They talk. ※ 빅터는 흐릿하게만 기억함(saw only the swell), 세라는 기억 못 함, 마르코: 자리에 없어 모름, 세라: 나중에 빅터에게 들음', 'en', () => null, { names }).text;
  assert.match(out, /※ Viktor remembers it only dimly\(saw only the swell\), Sera does not remember it, 마르코: not there, unaware, Sera: heard later from Viktor$/);
});

test('the room glossary (번역 프리셋·단어장) is used for the English memory: in the translation and for what is left in Korean', () => {
  const glossary = T.parseGlossary('Marco = 마르코\nSea lion = 물개\nViktor = 빅토르');
  const names = T.latinNames({ people: { '빅터 문': { aliases: ['Viktor'] } } }, glossary);
  const map = Object.fromEntries(names.map((n) => [n.from, n.to]));
  assert.equal(map['마르코'], 'Marco', 'someone not in the name table');
  assert.equal(map['물개'], 'Sea lion', 'a word, not only names');
  assert.equal(T.latinizeNames('- 마르코: Saw the 물개 cub. 마르코는 몰랐다.', names), '- Marco: Saw the Sea lion cub. 마르코는 몰랐다.');
  const user = JSON.parse(T.buildTranslatePrompt(['마르코가 물개를 봤다.'], 'en', { glossary })[1].content);
  assert.deepEqual(user.terms, { 마르코: 'Marco', 물개: 'Sea lion' });
  assert.match(T.TRANSLATE_PROMPT.en, /When the input has "terms" \(the user's glossary\)/);
  assert.equal(JSON.parse(T.buildTranslatePrompt(['마르코'], 'ko', { glossary })[1].content).terms, undefined, 'into Korean: the names list as before');
});
