// node --test tests/test-recall.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const R = require('../memory-module/lib/recall.cjs');

const scene = (id, start, end, title, summary, events = []) => ({ id, start, end, messages: [], time: null, place: null, title, summary, events, recollections: [], edited: false });
const store = {
  ...S.emptyStore(),
  scenes: [
    scene('S1', 1, 3, '약 냄새', '서아가 수면약 냄새를 지적함.'),
    scene('S2', 4, 6, '금주 약속', '하루가 약속서에 서명함.', [{ text: '하루가 약속서에 직접 서명함', importance: 'critical', quotes: [{ number: 5, sentence: 1, text: '<speaker="하루">하루 | "I swear."</speaker> (맹세해.)', to: '서아' }] }]),
    scene('S3', 7, 9, '문신', '문을 이미 열었다고 고백함.'),
    scene('S4', 10, 12, '출근하지 마', '셋이 휴가를 냄.'),
    scene('S5', 13, 15, '아침', '아침이 됨.'),
  ],
};

test('candidates leave out scenes inside the window and the newest two already shown in full', () => {
  assert.deepEqual(R.candidates(store, 13).map((s) => s.id), ['S1', 'S2']);
  assert.deepEqual(R.candidates(store, null).map((s) => s.id), ['S1', 'S2', 'S3']);
});

test('the model pick keeps only known scenes, at most three, no repeats', () => {
  const list = R.candidates(store, null);
  assert.deepEqual(R.applyRecall({ recall: [{ scene: 's2', why: '서약' }, { scene: 'S2' }, { scene: 'S9' }, { scene: '1' }, { scene: 'S3' }] }, list).map((p) => p.id), ['S2', 'S1', 'S3']);
  assert.deepEqual(R.applyRecall({ nope: 1 }, list), []);
});

test('the table of contents marks the key events', () => {
  const [, user] = R.buildRecallPrompt(R.candidates(store, null), null, [{ speaker: '서아', content: '그 서약 기억나?' }], '');
  assert.match(user.content, /S2 \|  \| 금주 약속: 하루가 약속서에 서명함\. ★하루가 약속서에 직접 서명함/);
  assert.match(user.content, /서아: 그 서약 기억나\?/);
});

test('fast pick finds the scene that shares rare words with the talk now', () => {
  const picks = R.fastRecall(R.candidates(store, null), null, [{ speaker: '서아', content: '그때 약속서에 직접 서명한 거, 아직 유효해?' }], '');
  assert.equal(picks[0]?.id, 'S2');
  assert.deepEqual(R.fastRecall(R.candidates(store, null), null, [{ speaker: 'x', content: '응.' }], ''), []);
});

test('a recalled scene is shown in full, with who said what to whom', () => {
  const text = R.renderRecalled(store, [{ id: 'S2' }]);
  assert.match(text, /^\[지금 떠오르는 지난 장면\]\n② 금주 약속\n/);
  assert.match(text, /- ★ 하루가 약속서에 직접 서명함\n  하루 → 서아: "I swear\." \(맹세해\.\)/);
});

test('a long line keeps its whole translation', () => {
  const long = `<speaker="하준">하준 | "${'word '.repeat(120)}end."</speaker> (번역은 이렇게 끝까지 남아야 해.)`;
  const line = S.quoteLine({ text: long });
  assert.ok(line.length <= 440);
  assert.match(line, /^하준: "word/);
  assert.match(line, /… \(번역은 이렇게 끝까지 남아야 해\.\)$/);
});

test('the user character is named in the scene and ledger prompts', () => {
  const msgs = L.prepareMessages([
    { id: 'a', number: 1, speaker: '하루', role: 'assistant', content: '하루가 웃었다.' },
    { id: 'b', number: 2, speaker: '서아', role: 'user', content: '"응."' },
  ]);
  assert.match(S.buildScenePrompt(S.emptyStore(), msgs, 2)[1].content, /^\[사용자 캐릭터\] 서아/);
  assert.match(L.buildPrompt(L.emptyLedger(), msgs)[1].content, /^\[사용자 캐릭터\] 서아/);
});

test('a direct question finds its scene by a word said once, even if the model chose others', () => {
  const st = { ...S.emptyStore(), scenes: [
    scene('S1', 1, 3, '야근', '하준이 코딩을 대신 고쳐 줌.', [{ text: '하준이 오로라 일을 자동으로 돌려놓음', importance: 'major', quotes: [] }]),
    scene('S2', 4, 6, '서약', '서약에 서명함.'),
    scene('S3', 7, 9, '고백', '사랑한다고 말함.'),
    scene('S4', 10, 12, '연락', '둘이 몰래 연락한 걸 앎.'),
    scene('S5', 13, 15, '아침', '아침이 됨.'),
    scene('S6', 16, 18, '밤', '밤이 됨.'),
  ] };
  const list = R.candidates(st, null);
  const recent = [{ role: 'assistant', speaker: '하루', content: '향수이 진하다.' }, { role: 'user', speaker: '서아', content: '오로라 일은?' }];
  assert.equal(R.latestUser(recent, '').text, '오로라 일은?');
  const hit = R.directHit(list, '오로라 일은?');
  assert.equal(hit?.id, 'S1');
  const picks = R.withDirectHit([{ id: 'S2' }, { id: 'S3' }, { id: 'S4' }, { id: 'S5' }], hit);
  assert.deepEqual(picks.map((p) => p.id), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(R.directHit(list, '배고파.'), null);
  const [, user] = R.buildRecallPrompt(list, null, recent, '');
  assert.match(user.content, /## 방금 들어온 메시지 \(서아\)\n오로라 일은\?$/);
  assert.match(user.content, /S1 \|  \| 야근: 하준이 코딩을 대신 고쳐 줌\. ·하준이 오로라 일을/);
});

test('a detail a summary dropped is found in the original old messages, with speaker and translation', () => {
  const msgs = L.prepareMessages([
    { id: 'a', number: 1, speaker: '하루', role: 'assistant', content: '<speaker="하준">하준 | "It\'s Vanguard Astral Logistics."\n(오로라 아스트랄 로지스틱스네.)</speaker>\n하준이 웃었다.' },
    { id: 'b', number: 2, speaker: '서아', role: 'user', content: '"배고파."' },
    { id: 'c', number: 3, speaker: '하루', role: 'assistant', content: '하루가 스테이크를 구웠다.' },
    { id: 'd', number: 4, speaker: '서아', role: 'user', content: '"졸려."' },
    { id: 'e', number: 5, speaker: '하루', role: 'assistant', content: '아침이 밝았다.' },
  ]);
  const raw = R.rawHits(msgs, '오로라 일은?');
  assert.equal(raw.length, 1);
  assert.equal(raw[0].text, '(1번) 하준: "It\'s Vanguard Astral Logistics." (오로라 아스트랄 로지스틱스네.)');
  assert.match(R.renderRaw(raw), /^\[원문에서 떠오른 대목\]\n- \(1번\) 하준:/);
  assert.deepEqual(R.rawHits(msgs, '오늘 뭐 해?'), []);
});

test('a long story: the table of contents groups old scenes under chapters and can drop their lines, never the heading', () => {
  const list = Array.from({ length: 400 }, (_, i) => ({ id: `S${i + 1}`, start: i, end: i, time: null, place: null, title: `장면 ${i + 1} ${'제목'.repeat(10)}`, summary: '요약 '.repeat(30), events: [], recollections: [] }));
  const chapters = Array.from({ length: 30 }, (_, i) => ({ id: `C${i + 1}`, scenes: list.slice(i * 12, i * 12 + 12).map((s) => s.id), time: null, title: `챕터 ${i + 1}`, summary: '챕터 요약.' }));
  const toc = R.buildToc(list, chapters);
  assert.ok(toc.length <= 50500, String(toc.length));
  assert.match(toc, /^## C1 챕터 1 \(S1~S12\): 챕터 요약\.$/m);
  assert.match(toc, /^## 챕터로 묶이지 않은 최근 장면$/m);
  assert.match(toc, /^S400 \| /m);
  // The model may answer with a chapter: the scene in it that fits the talk now comes up.
  list[14].summary = '오로라 아스트랄 보고서';
  const picks = R.applyRecall({ recall: [{ scene: 'C2', why: '그 시기' }] }, list, chapters, '오로라 보고서는 어떻게 됐어?');
  assert.deepEqual(picks.map((p) => p.id), ['S15']);
});

test('a long contents list drops event lines before titles, and keeps the scenes the meaning search found whole', () => {
  const list = Array.from({ length: 330 }, (_, i) => ({ id: `S${i + 1}`, start: i, end: i, time: null, place: null, title: `장면 ${i + 1}`, summary: `요약 ${i + 1} ${'내용 '.repeat(25)}`, events: [{ text: `사건 ${i + 1} ${'자세히 '.repeat(12)}`, importance: 'major', quotes: [] }], recollections: [] }));
  list[9].summary = '하준이 서아 때문에 빙결 공학 수석이 됐다';
  const toc = R.buildToc(list, [], new Set(['S10']));
  assert.ok(toc.length <= 50500, String(toc.length));
  assert.match(toc, /^S10 \| .*빙결 공학 수석.*사건 10/m, 'kept whole');
  assert.match(toc, /^S1 \|  \| 장면 1: 요약 1/m, 'old ones keep their summary first');
  const prompt = R.buildRecallPrompt(list, null, [], '빙결 공학 얘기', [], [{ id: 'S10', score: 0.8 }])[1].content;
  assert.match(prompt, /## 뜻이 가까운 장면[^\n]*\n- S10 장면 10/);
});

test('close-in-meaning scenes that did not come up in full go in as just the matching event', () => {
  const store = { scenes: [
    { id: 'S1', time: '24-10-20 17:32', place: '침실', title: '등산', summary: '등산 장면', events: [{ text: '산에 오름', quotes: [] }, { text: '하루가 하준이 서아 때문에 동아리방에 살았다고 폭로', quotes: [{ text: '"Mr. I-Dont-Care was living in the club room." (동아리방에서 살다시피 하더군.)', by: '하루', to: '서아' }] }], recollections: [] },
    { id: 'S2', time: null, place: null, title: '브런치', summary: '브런치 먹음', events: [], recollections: [] },
  ] };
  const text = R.renderNearEvents(store, [{ id: 'S1', piece: 1 }, { id: 'S2', piece: null }], [{ id: 'S2' }]);
  assert.match(text, /^\[뜻이 가까운 지난 사건\]\n- 24-10-20 17:32 · 침실 — 등산: 하루가 하준이 서아 때문에 동아리방에 살았다고 폭로\n  하루 → 서아: "Mr\. I-Dont-Care/);
  assert.doesNotMatch(text, /브런치/, 'already shown in full');
});
