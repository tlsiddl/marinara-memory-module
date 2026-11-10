'use strict';
// How things went on after they were last mentioned (invented names):
// - the ledger check sees the scenes after each open item's last mention, closes what ended there and gives what
//   changed a new "최근" line;
// - a merged fact is never cut off (its newest part would be lost), and old cut ones are undone to be merged again;
// - scenes that no longer fit the memory's scene list become a chapter instead of dropping out of the story's flow.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-continuity-'));
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;

function thread(id, kind, title, number, extra = {}) {
  return { id, kind, status: 'open', title, who: 'Viktor', toward: null, detail: '', evidence: [{ messageId: `m${number}`, number, sentence: 1, text: `line ${number}` }], clues: [], openedAt: { messageId: `m${number}`, number }, updatedAt: 'x', ...extra };
}
const steps = [
  { id: 'C1', start: 1, end: 20, time: '24-10-01', line: 'First days: Sera arrives.' },
  { id: 'S8', start: 21, end: 30, time: '24-10-03 09:00', line: 'Sera wakes up and walks the deck.' },
  { id: 'S9', start: 31, end: 40, time: '24-10-03 12:00', line: 'Mina learns who Viktor is; Sera still does not.' },
];

test('the check sees how the story went on after each item was last mentioned', () => {
  const ledger = { threads: [thread('T1', 'state', 'Sera unconscious', 25), thread('T2', 'secret', 'Viktor hides his past', 22, { unaware: ['Sera', 'Mina'] })] };
  const [system, user] = L.buildTidyPrompt(ledger, [], { after: steps });
  assert.match(system.content, /later = 그 뒤 장면에서 끝났음이 드러남/);
  assert.match(user.content, /T1 \[state\].*\| 마지막 언급: 25번/);
  assert.match(user.content, /## 그 뒤 이야기[^]*S8 \(21~30번\) Sera wakes up[^]*S9 \(31~40번\)/);
  assert.doesNotMatch(user.content, /C1 \(1~20번\)/, 'nothing from before the earliest last mention');
  assert.doesNotMatch(L.buildTidyPrompt(ledger, [])[1].content, /마지막 언급|그 뒤 이야기/, 'no scenes: as before');
});

test('closed when a later scene shows it ended; never from a scene before its last mention, never a feeling', () => {
  const ledger = { threads: [
    thread('T1', 'state', 'Sera unconscious', 25),
    thread('T2', 'pending', 'Find the courier', 35),
    thread('T3', 'emotion', 'Viktor sore at Sera', 5),
    thread('T4', 'promise', 'Walk Sera home', 5),
  ] };
  const stats = L.applyTidy(ledger, { close: [
    { id: 'T1', why: 'later', how: 'She woke up and walked the deck', scene: 'S8' },
    { id: 'T2', why: 'later', how: 'Found', scene: 'S8' },
    { id: 'T3', why: 'later', how: 'Made up', scene: 'S9' },
    { id: 'T4', why: 'later', how: '더 이상 언급되지 않음', scene: 'S9' },
  ] }, 'now', { strictCloseEvidence: true, after: steps });
  assert.equal(stats.closed, 1);
  const t1 = ledger.threads[0];
  assert.equal(t1.status, 'closed');
  assert.equal(t1.closed.at.number, 30);
  assert.match(t1.closed.how, /\(S8\)$/);
  assert.deepEqual(ledger.threads.slice(1).map((t) => t.status), ['open', 'open', 'open'], 'S8 is before T2 was last mentioned; a feeling; "not mentioned"');
  assert.equal(L.applyTidy(ledger, { close: [{ id: 'T4', why: 'later', how: 'Walked her home', scene: 'S77' }] }, 'now', { after: steps }).closed, 0, 'a scene it was not shown');
});

test('what changed after the last mention becomes the item\'s "최근" line, shown to the reply', () => {
  const ledger = { lastNumber: 40, threads: [thread('T2', 'secret', 'Viktor hides his past', 12, { unaware: ['Sera', 'Mina'] }), thread('T3', 'emotion', 'Viktor sore at Sera', 12)] };
  const stats = L.applyTidy(ledger, { update: [
    { id: 'T2', now: 'Mina knows now; Sera still does not.', scene: 'S9' },
    { id: 'T3', now: 'Softened.', scene: 'S9' },
    { id: 'T2', now: 'Again', scene: 'C1' },
  ] }, 'now', { after: steps });
  assert.equal(stats.updated, 1);
  assert.deepEqual(ledger.threads[0].latest, { text: 'Mina knows now; Sera still does not.', at: '24-10-03 12:00', number: 40, scene: 'S9', by: 'check' });
  assert.equal(ledger.threads[1].latest, undefined, 'feelings are reviewed on their own');
  assert.match(L.render(ledger), /최근: Mina knows now; Sera still does not\. \(24-10-03 12:00\)/);
  // A line the check wrote does not move the item's last mention: the next check still sees S8 and S9 and can
  // correct it (the same line again is not counted), or close it from them.
  assert.equal(L.lastSeen(ledger.threads[0]), 40, 'for fading and order');
  assert.equal(L.applyTidy(ledger, { update: [{ id: 'T2', now: 'Mina knows now; Sera still does not.', scene: 'S9' }] }, 'now', { after: steps }).updated, 0);
  assert.match(L.buildTidyPrompt(ledger, [], { after: steps })[1].content, /T2 .*| 마지막 언급: 12번[^]*S8 (21~30번)/);
  assert.equal(L.applyTidy(ledger, { update: [{ id: 'T2', now: 'Mina and Sera both know now.', scene: 'S9' }] }, 'now', { after: steps }).updated, 1);
  assert.equal(ledger.threads[0].latest.text, 'Mina and Sera both know now.');
});

test('the steps: chapters for their scenes, later scenes one by one, no OOC, nothing past the messages read', () => {
  const sc = (id, start, end, extra = {}) => ({ id, start, end, time: `t${id}`, place: 'deck', title: `title ${id}`, summary: `summary ${id}`, ...extra });
  const store = { ...S.emptyStore(), scenes: [sc('S1', 1, 4), sc('S2', 5, 8), sc('S3', 9, 12, { ooc: true }), sc('S4', 13, 16), sc('S5', 17, 20)], chapters: [{ id: 'C1', scenes: ['S1', 'S2'], title: 'Start', summary: 'They meet.' }] };
  const out = X.tidySteps(store, 16);
  assert.deepEqual(out.map((x) => [x.id, x.start, x.end]), [['C1', 1, 8], ['S4', 13, 16]]);
  assert.equal(out[1].line, 'tS4 · deck | title S4: summary S4');
  assert.deepEqual(X.tidySteps(null), []);
});

test('a merged fact too long to keep whole is not taken: the facts stay, nothing is cut', () => {
  const store = S.emptyStore();
  const fact = (id, text) => ({ id, about: 'Sera', text, evidence: [{ number: 1, sentence: 1, text: 'x' }], sceneId: null, when: null, unaware: [], guess: [], edited: false });
  store.facts.push(fact('F1', 'Keeps her savings in a tin.'), fact('F2', 'Moved her savings to the boat safe.'));
  store.nextFact = 3;
  const long = `Keeps her savings in the boat safe now; ${'she counts them every night and '.repeat(20)}sleeps.`;
  assert.ok(long.length > S.MERGED_MAX.en);
  assert.equal(S.applyFactMerge(store, 'Sera', store.facts.slice(), { merged: [{ text: long, from: ['F1', 'F2'] }] }), 0);
  assert.equal(S.liveFacts(store).length, 2);
  assert.equal(S.applyFactMerge(store, 'Sera', store.facts.slice(), { merged: [{ text: 'Keeps her savings in the boat safe now (earlier in a tin).', from: ['F1', 'F2'] }] }), 1);
  assert.deepEqual(S.liveFacts(store).map((f) => f.text), ['Keeps her savings in the boat safe now (earlier in a tin).']);
  assert.match(S.buildFactMergePrompt(store, 'Sera', S.liveFacts(store))[0].content, /지금도 맞는 내용을 앞에 써[^]*영어 450자 이내/);
});

test('an old merged fact cut off mid-sentence is undone so it can be merged again; whole or hand-edited ones stay', () => {
  const store = S.emptyStore();
  const src = (id, by) => ({ id, about: 'Sera', text: `fact ${id}.`, evidence: [], replacedBy: by, edited: false });
  const cut = `Carries her savings in a tin and stays at the inn by the docks; ${'x'.repeat(240)}, her bags and the tin`;
  store.facts.push(src('F1', 'F3'), src('F2', 'F3'), { id: 'F3', about: 'Sera', text: cut, evidence: [], sources: ['F1', 'F2'], edited: false });
  store.facts.push(src('F4', 'F6'), src('F5', 'F6'), { id: 'F6', about: 'Sera', text: `${'y'.repeat(300)} ends whole.`, evidence: [], sources: ['F4', 'F5'], edited: false });
  store.facts.push(src('F7', 'F9'), src('F8', 'F9'), { id: 'F9', about: 'Sera', text: `${'z'.repeat(300)}, cut but edited`, evidence: [], sources: ['F7', 'F8'], edited: true });
  store.mergeTried = { 'Sera:9': true, 'Mina:3': true };
  assert.equal(S.undoCutMerges(store), 1);
  assert.deepEqual(S.liveFacts(store).map((f) => f.id), ['F1', 'F2', 'F6', 'F9']);
  assert.deepEqual(store.mergeTried, { 'Mina:3': true }, 'Sera is merged again');
  assert.equal(S.undoCutMerges(store), 0, 'once');
});

test('scenes that no longer fit the memory\'s scene list become a chapter before they drop out of the flow', () => {
  const store = S.emptyStore();
  const long = 'Something happened at length. '.repeat(10).trim();
  for (let i = 1; i <= 30; i++) store.scenes.push({ id: `S${i}`, start: i * 2 - 1, end: i * 2, title: `t${i}`, summary: i <= 25 ? long : 'short', events: [], recollections: [], present: [] });
  store.window = { firstInside: 51 };
  // 25 long scenes outside the recent messages: about 16 fit, the oldest 9 would drop out.
  const offered = S.nextChapter(store);
  assert.ok(offered, 'offered before 50 scenes piled up');
  assert.equal(offered[0].id, 'S1');
  assert.ok(offered.length >= 9 && offered.length <= 20, String(offered.length));
  // Short summaries all fit: nothing yet.
  for (const s of store.scenes) s.summary = 'short';
  assert.equal(S.nextChapter(store), null);
});

test('a chapter is shown whole with its turning points; the rules for secrets and "still does not know"', () => {
  const sc = (id, start, end) => ({ id, start, end, time: null, place: null, title: id, summary: `summary ${id}` });
  const summary = 'Sera arrives and Viktor finds her at the harbor. '.repeat(14).trim();
  const store = { ...S.emptyStore(), scenes: [sc('S1', 1, 4), sc('S2', 5, 8)], chapters: [{ id: 'C1', scenes: ['S1', 'S2'], title: 'Start', summary, turns: ['S2 Viktor calls Sera by name on the pier'] }] };
  const [c1] = X.tidySteps(store);
  assert.ok(c1.line.length > 600, 'not cut to a scene\'s length');
  assert.match(c1.line, /\| 결정적인 일: S2 Viktor calls Sera by name on the pier$/);
  const system = L.buildTidyPrompt({ threads: [] }, [], { after: [] })[0].content;
  assert.match(system, /'모름'에 적힌 사람이 그 뒤 장면에서 그걸 알고 쓰는 모습\(그 이름으로 부름/);
  assert.match(system, /비밀로 적혔어도 실제로는 찾기·확인·쫓기 같은 일이면/);
  assert.match(system, /"아직 모른다·아직 안 했다"는 그 뒤 장면에서도 그렇다고 드러날 때만 써/);
});

function msg(number, speaker, sentences, extra = {}) {
  return { id: `m${number}`, number, speaker, sentences, content: sentences.join(' '), ...extra };
}

test('old items are asked about one at a time, oldest first, and not again until more of the story has come', () => {
  const ledger = { threads: [
    thread('T1', 'secret', 'Sera hides her name from Viktor', 5),
    thread('T2', 'pending', 'Mina checks the harbor ledger', 90),
    thread('T3', 'emotion', 'Viktor sore at Sera', 3),
    thread('T4', 'promise', 'Walk Sera home', 30),
    thread('T5', 'state', 'Plan item', 2, { plan: true }),
  ] };
  assert.deepEqual(L.oldItemsToReview(ledger, 100).map((t) => t.id), ['T1', 'T4'], 'not recent ones, feelings or plans');
  ledger.threads[0].reviewedUpTo = 90;
  assert.deepEqual(L.oldItemsToReview(ledger, 100).map((t) => t.id), ['T4']);
  assert.deepEqual(L.oldItemsToReview(ledger, 110).map((t) => t.id), ['T1', 'T4'], '20 more messages: asked again');
});

test('one old item: closed on a line that shows it is over now; changed gets a "최근" line that is not a mention', () => {
  const messages = [msg(5, 'Sera', ['I am nobody.']), msg(98, 'Viktor', ['"Sera, come here."', 'He held the door.']), msg(99, 'Sera', ['"Fine."']), msg(100, 'Mina', ['OOC: 잠깐'], { ooc: true })];
  const ledger = { threads: [thread('T1', 'secret', 'Sera hides her name from Viktor', 5), thread('T4', 'promise', 'Walk Sera home', 30)] };
  const review = L.buildOldItemPrompt(ledger, messages, ledger.threads[0], steps);
  const user = review.messages[1].content;
  assert.match(user, /## 항목\nT1 \[secret\].*\| 마지막 언급: 5번/);
  assert.match(user, /## 그 뒤 이야기[^]*C1 \(1~20번\)[^]*S9 \(31~40번\)/);
  assert.match(user, /## 지금 대화[^]*\[98\.1\] "Sera, come here\."/);
  assert.doesNotMatch(user, /OOC: 잠깐/);
  assert.match(review.messages[0].content, /모른다던 사람이 그 이름을 부르거나/);
  // Ended, on Viktor calling her by name.
  assert.equal(L.applyOldItemReview(ledger, ledger.threads[0], { verdict: 'ended', how: 'Viktor calls her Sera now.', evidence: [{ n: '98.1', q: 'Sera, come here' }] }, review.window, steps, 100, 'now'), 'closed');
  assert.equal(ledger.threads[0].closed.at.number, 98);
  // No line or scene after its last mention: nothing happens, but it was asked.
  const t4 = ledger.threads[1];
  assert.equal(L.applyOldItemReview(ledger, t4, { verdict: 'ended', how: 'Done' }, review.window, steps, 100), 'dropped');
  assert.equal(t4.status, 'open');
  assert.equal(t4.reviewedUpTo, 100);
  assert.equal(L.applyOldItemReview(ledger, t4, { verdict: 'ended', how: '더 이상 언급되지 않음', scene: 'S9' }, review.window, steps, 100), 'dropped');
  // Changed: the line is from the check, so the item still counts as last brought up at 30.
  assert.equal(L.applyOldItemReview(ledger, t4, { verdict: 'changed', now: 'Viktor walked her halfway; the rest is still owed.', scene: 'S9' }, review.window, steps, 100), 'updated');
  assert.deepEqual(t4.latest, { text: 'Viktor walked her halfway; the rest is still owed.', at: '24-10-03 12:00', number: 40, by: 'check', scene: 'S9' });
  assert.equal(L.lastMentioned(t4), 30);
  assert.equal(L.applyOldItemReview(ledger, t4, { verdict: 'same' }, review.window, steps, 100), 'same');
});

test('a "최근" line saying it is only partly so is kept (not taken for hedging)', () => {
  const ledger = { threads: [thread('T2', 'secret', 'Viktor hides his past', 12)] };
  assert.equal(L.applyTidy(ledger, { update: [{ id: 'T2', now: '미나는 일부만 알게 됐고, 세라는 아직 모른다.', scene: 'S9' }] }, 'now', { after: steps }).updated, 1);
});

test('the check never reads its own earlier lines back as facts; the reply still gets them', () => {
  const t2 = thread('T2', 'secret', 'Viktor hides his past', 12, { latest: { text: 'Sera still does not know his name.', at: null, number: 40, by: 'check' } });
  const t3 = thread('T3', 'pending', 'Mina checks the ledger', 12, { latest: { text: 'Mina found the page.', at: null, number: 14 } });
  const ledger = { lastNumber: 40, threads: [t2, t3] };
  const tidy = L.buildTidyPrompt(ledger, [], { after: steps })[1].content;
  assert.doesNotMatch(tidy, /still does not know his name/);
  assert.match(tidy, /최근: Mina found the page\./, 'a line from the story stays');
  const one = L.buildOldItemPrompt(ledger, [msg(50, 'Viktor', ['"Sera."'])], t2, steps).messages[1].content;
  assert.doesNotMatch(one, /still does not know his name/);
  assert.match(L.render(ledger), /최근: Sera still does not know his name\./);
  // An older check line (scene only, from 0.28.0/0.28.1) counts as one too.
  assert.doesNotMatch(L.buildTidyPrompt({ threads: [{ ...t2, latest: { text: 'Old check line.', number: 40, scene: 'S9' } }] }, [], { after: steps })[1].content, /Old check line/);
});

test('the one-item check shows the last several long messages', () => {
  const long = (n) => msg(n, 'Viktor', Array.from({ length: 10 }, (_, i) => `Line ${i} of a long reply ${'x'.repeat(480)}.`));
  const messages = [long(96), long(97), long(98), long(99)];
  const review = L.buildOldItemPrompt({ threads: [] }, messages, thread('T1', 'secret', 'Sera hides her name', 5), steps);
  assert.ok(review.window.length >= 3, String(review.window.length));
});

test('summaries end at a whole sentence, with more room for English; cut ones saved before are made again', () => {
  const en = Array.from({ length: 12 }, (_, i) => `Sera and Viktor crossed the harbor for the ${i + 1}th time and argued about the boat.`).join(' ');
  const out = S.summaryText(en, 700);
  assert.ok(out.length > 700 && out.length <= 1260, String(out.length));
  assert.match(out, /boat\.$/);
  const ko = '세라와 빅터가 항구를 건넜다. '.repeat(60).trim();
  assert.ok(S.summaryText(ko, 700).length <= 700);
  assert.match(S.summaryText(ko, 700), /건넜다\.$/);
  assert.equal(S.summaryText('Short one.', 700), 'Short one.');
  const store = { ...S.emptyStore(), chapters: [
    { id: 'C1', scenes: ['S1'], summary: `${'Sera waits at the pier. '.repeat(30)}then walks to the` },
    { id: 'C2', scenes: ['S2'], summary: 'Sera waits at the pier. '.repeat(30).trim() },
    { id: 'C3', scenes: ['S3'], summary: `${'x '.repeat(300)}cut but edited`, edited: true },
  ], arcs: [{ id: 'A1', chapters: ['C1'], summary: `${'y '.repeat(300)}cut` }] };
  assert.equal(S.markCutSummaries(store), 2);
  assert.deepEqual([...store.chapters, ...store.arcs].map((x) => !!x.stale), [true, false, false, true]);
  assert.equal(S.markCutSummaries(store), 0);
});

test('a plan whose answer comes out in the story is closed, by the reading and by the check', () => {
  const [reading] = L.buildPrompt({ threads: [], processed: [] }, [msg(1, 'Viktor', ['Hi.'])]);
  assert.match(reading.content, /작가 계획의 답이 드러나면\(인물 누구라도[^]*일부 인물만 알게 됐어도 닫아/);
  const tidy = L.buildTidyPrompt({ threads: [] }, [], { after: steps })[0].content;
  assert.match(tidy, /\[작가 계획\] 항목은 '그 뒤 이야기'에서 그 답이 이야기 속에 드러났으면/);
  const ledger = { threads: [thread('T9', 'secret', 'The lighthouse keeper is Viktor\'s father', 5, { plan: true, who: null })] };
  assert.equal(L.applyTidy(ledger, { close: [{ id: 'T9', why: 'later', how: 'Viktor says it aloud on the pier.', scene: 'S9' }] }, 'now', { after: steps }).closed, 1);
});
