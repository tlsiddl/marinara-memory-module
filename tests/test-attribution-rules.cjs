// Deterministic speaker/listener rules. Invented names and lines only.
const assert = require('node:assert/strict');
const S = require('../memory-module/lib/scenes.cjs');

const fresh = (q) => { delete q.attributionChecked; delete q.attributionFp; return q; };
const answer = (by, to, byEvidence = '', toEvidence = '') => ({ id: '0', by, to, byEvidence, toEvidence });

// 1. Unlabelled staff guidance, then an apology that opens by calling the guest by her family name.
{
  const guide = { number: 1, sentence: 2, text: '"Seguitemi, prego. La sala sul retro è quasi—"', by: null, to: null };
  const apology = { number: 1, sentence: 7, text: '"Signora Bel Caro, mi perdoni! La sala non è ancora pronta…"', by: '도라 벨 카로', to: '파비오', attributionChecked: 7 };
  const scene = { id: 'S1', start: 1, end: 1, events: [{ text: '안내', quotes: [guide] }, { text: '사과', quotes: [apology] }], present: ['도라 벨 카로', '파비오', '니코'] };
  const store = { scenes: [scene], personas: ['도라 벨 카로'] };
  const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: [
    '식당 문이 열리자 직원 한 명이 다가왔다.', guide.text, '직원의 말이 거기서 끊겼다.', '안쪽에서 누군가 손짓했다.',
    '"Mi chiamo Fabio, stasera sono io il responsabile di sala."', '직원이 허리를 숙였다.', apology.text, '도라는 잠시 말이 없었다.',
  ] }];
  // The reversed stored value breaks the "called by name is not the speaker" rule, so it is checked again.
  const list = S.attributionCandidates(store, messages, 20);
  const forApology = list.find((e) => e.q === apology);
  assert.deepEqual(forApology.facts.addressed, ['도라 벨 카로']);
  assert.ok(forApology.violations.includes('vocative-speaker'));
  // The model repeats the reversed answer twice: rejected both times and asked once more.
  const reversed = { id: forApology.id, by: '도라 벨 카로', to: ['파비오'], byEvidence: '도라는 잠시 말이 없었다.', toEvidence: '직원이 허리를 숙였다.' };
  const guideId = list.find((e) => e.q === guide).id;
  let decided = S.confirmAttributionResults(list, [reversed, { id: guideId, by: '직원', to: [], byEvidence: '직원의 말이 거기서 끊겼다.' }], [reversed, { id: guideId, by: null, to: [] }]);
  assert.equal(decided.find((d) => d.id === forApology.id).first.byReason, 'vocative');
  assert.deepEqual(S.reaskCandidates(list, decided).map((e) => e.q), [apology]);
  decided = S.mergeReask(list, decided, [{ id: forApology.id, by: '파비오', to: ['도라 벨 카로'], byEvidence: '직원이 허리를 숙였다.', toEvidence: apology.text }]);
  S.applyAttributionResults(list, decided);
  assert.equal(apology.by, '파비오'); assert.equal(apology.to, '도라 벨 카로');
  // The role in narration ("직원의 말이 끊겼다") is the staff member who later gives his name.
  assert.equal(guide.by, '파비오');

  // Without a successful second question the reversed speaker is removed, never kept.
  Object.assign(fresh(apology), { by: '도라 벨 카로', to: '파비오' });
  const again = S.attributionCandidates(store, messages, 20).filter((e) => e.q === apology);
  S.applyAttributionResults(again, S.confirmAttributionResults(again, [{ ...reversed, id: again[0].id }], [{ ...reversed, id: again[0].id }]));
  assert.equal(apology.by, null); assert.equal(again[0].outcome.rule, 'cleared-vocative');
  // The same rule runs without any model answer.
  Object.assign(apology, { by: '도라 벨 카로', to: '파비오' });
  const ruled = S.enforceAttributionRules(store, messages);
  assert.equal(apology.by, null);
  assert.ok(ruled.some((x) => x.number === 1 && x.sentence === 7 && /vocative-speaker/.test(x.rule)));
  // A role the scene never names stays blank rather than guessed.
  const unnamed = { number: 1, sentence: 2, text: guide.text, by: null, to: null };
  const bare = { scenes: [{ id: 'S2', events: [{ quotes: [unnamed] }], present: ['도라 벨 카로', '니코'] }] };
  const bareMessages = [{ id: 'm1', number: 1, sentences: ['직원이 다가왔다.', guide.text, '직원의 말이 거기서 끊겼다.'] }];
  const c = S.attributionCandidates(bare, bareMessages);
  S.applyAttributionResults(c, [answer('직원', [], '직원의 말이 거기서 끊겼다.')]);
  assert.equal(unnamed.by, null);
  assert.equal(S.judgeAnswer(c[0], answer('직원', [], '직원의 말이 거기서 끊겼다.')).byReason, 'role-unresolved');
}

// 2. Asked to pass words on: the third person is mentioned, not spoken to.
{
  const q = { number: 3, sentence: 2, text: '"그리고 저 남자한텐 전해 줘. 다음엔 없다고."', by: null, to: null };
  const scene = { id: 'S3', events: [{ quotes: [q] }], present: ['세나', '도라 벨 카로', '니코'] };
  const messages = [{ id: 'm3', number: 3, sentences: ['세나가 도라에게 바짝 다가가 니코 쪽을 턱짓했다.', q.text, '세나가 낮게 말했다.'] }];
  const c = S.attributionCandidates({ scenes: [scene] }, messages);
  S.applyAttributionResults(c, [answer('세나', ['도라 벨 카로', '니코'], '세나가 낮게 말했다.', '세나가 도라에게 바짝 다가가 니코 쪽을 턱짓했다.')]);
  assert.equal(q.by, '세나'); assert.equal(q.to, '도라 벨 카로');
  const named = { number: 4, sentence: 1, text: '"Tell Nico the car is ready."', by: '세나', to: '니코' };
  const s2 = { id: 'S4', events: [{ quotes: [named] }], present: ['세나', '도라 벨 카로', '니코'] };
  S.enforceAttributionRules({ scenes: [s2] }, [{ id: 'm4', number: 4, sentences: [named.text] }]);
  assert.equal(named.to, null);
}

// 3–5. A multilingual scene with three people: a reply, a call by name, a line with two addressees, an unclear line.
{
  const ask = { number: 5, sentence: 1, text: '"Hai capito, Renzo? Domani si parte presto."', by: '니코', to: '렌조' };
  const reply = { number: 5, sentence: 4, text: '"Figurati... Io resto qui stanotte."', by: '렌조', to: null };
  const both = { number: 6, sentence: 1, text: '"Nico, prendi la macchina. Dora, tu resta qui."', by: '렌조', to: '니코' };
  const unclear = { number: 6, sentence: 3, text: '"Andiamo."', by: null, to: null };
  const scene = { id: 'S5', start: 5, end: 6, events: [{ quotes: [ask, reply] }, { quotes: [both, unclear] }], present: ['니코', '렌조', '도라 벨 카로'] };
  const messages = [
    { id: 'm5', number: 5, sentences: [ask.text, '(알겠지, 렌조? 내일 일찍 떠나.)', '렌조는 창밖을 보았다.', reply.text] },
    { id: 'm6', number: 6, sentences: [both.text, '세 사람은 잠시 서로를 보았다.', unclear.text, '바람이 차가웠다.'] },
  ];
  S.enforceAttributionRules({ scenes: [scene] }, messages);
  assert.equal(reply.to, '니코', 'a direct reply goes back to the one who asked');
  assert.equal(both.to, '니코·도라 벨 카로', 'both people called in one line are listeners');
  assert.equal(unclear.by, null); assert.equal(unclear.to, null);

  // No reply rule: the reply calls someone else, the question had two listeners, or another line comes between.
  reply.to = null; reply.text = '"Dora, tu che dici?"'; messages[0].sentences[3] = reply.text;
  S.enforceAttributionRules({ scenes: [scene] }, messages);
  assert.equal(reply.to, '도라 벨 카로');
  reply.to = null; reply.text = '"Ma figurati."'; messages[0].sentences[3] = reply.text; ask.to = '렌조·도라 벨 카로';
  S.enforceAttributionRules({ scenes: [scene] }, messages);
  assert.equal(reply.to, null);
  ask.to = '렌조'; messages[0].sentences[2] = '"Davvero?"';
  S.enforceAttributionRules({ scenes: [scene] }, messages);
  assert.equal(reply.to, null);
}

// 6–9. Evidence that does not name the speaker, missing answers, and existing values that break no rule.
{
  const q = { number: 7, sentence: 2, text: '"Non lo so."', by: '니코', to: '렌조' };
  const scene = { id: 'S7', events: [{ quotes: [q] }], present: ['니코', '렌조'] };
  const messages = [{ id: 'm7', number: 7, sentences: ['바람이 차가웠다.', q.text, '렌조는 니코를 바라보았다.'] }];
  const c = S.attributionCandidates({ scenes: [scene] }, messages, 4, new Set(), { retryUnresolved: true });
  assert.equal(S.judgeAnswer(c[0], answer('렌조', [], '바람이 차가웠다.')).byReason, 'evidence-unanchored');
  assert.equal(S.judgeAnswer(c[0], answer('렌조', [], q.text)).byReason, 'evidence-in-quote');
  assert.equal(S.judgeAnswer(c[0], answer('니코', [], '렌조는 니코를 바라보았다.')).byReason, 'evidence-unanchored');
  assert.equal(S.judgeAnswer(c[0], { id: '0', by: 5 }).valid, false);
  // Unproven, unsure, malformed or missing answers leave the stored value as it is.
  S.applyAttributionResults(c, [answer('렌조', ['니코'], '바람이 차가웠다.')]);
  assert.equal(q.by, '니코'); assert.equal(q.to, '렌조');
  fresh(q); S.applyAttributionResults(S.attributionCandidates({ scenes: [scene] }, messages, 4, new Set(), { retryUnresolved: true }), [answer(null, [])]);
  assert.equal(q.by, '니코'); assert.equal(q.to, '렌조');
  fresh(q); S.applyAttributionResults(S.attributionCandidates({ scenes: [scene] }, messages, 4, new Set(), { retryUnresolved: true }), [{ id: '0', by: '렌조' }]);
  assert.equal(q.by, '니코');
  const c2 = S.attributionCandidates({ scenes: [scene] }, messages, 4, new Set(), { retryUnresolved: true });
  assert.equal(S.confirmAttributionResults(c2, null, undefined).length, 0);
  assert.equal(S.applyAttributionResults(c2, null), 0);
  assert.equal(q.by, '니코');
  // One answer missing: the other is used only when the code can see its proof.
  const one = S.confirmAttributionResults(c2, [answer('렌조', ['니코'], '렌조는 니코를 바라보았다.', '렌조는 니코를 바라보았다.')], null);
  assert.equal(one[0].reason, 'single-answer');
}

// 10. Hand edits: never a candidate, never touched by rules, and an edit made while the model is asked wins.
{
  const q = { number: 8, sentence: 1, text: '"Signora Bel Caro, prego."', by: '도라 벨 카로', to: null, manual: true };
  const scene = { id: 'S8', events: [{ quotes: [q] }], present: ['도라 벨 카로', '파비오'] };
  const messages = [{ id: 'm8', number: 8, sentences: [q.text, '파비오가 말했다.'] }];
  assert.equal(S.attributionCandidates({ scenes: [scene] }, messages).length, 0);
  S.enforceAttributionRules({ scenes: [scene] }, messages);
  assert.equal(q.by, '도라 벨 카로');
  delete q.manual;
  const c = S.attributionCandidates({ scenes: [scene] }, messages);
  assert.equal(c.length, 1);
  q.by = '파비오'; q.manual = true; // the user saves a correction meanwhile
  S.applyAttributionResults(c, [answer('파비오', ['도라 벨 카로'], '파비오가 말했다.', q.text)]);
  assert.equal(q.to, null); assert.equal(c[0].outcome.rule, 'manual');
  delete q.manual; q.by = '도라 벨 카로';
  const c3 = S.attributionCandidates({ scenes: [scene] }, messages);
  q.by = null; // changed by something else after the candidates were picked
  S.applyAttributionResults(c3, [answer('파비오', [], '파비오가 말했다.')]);
  assert.equal(q.by, null); assert.equal(c3[0].outcome.rule, 'changed-during-check');
}

// 11. The source changed: reported and left alone.
{
  const moved = { number: 9, sentence: 1, messageId: 'old', text: '"Signora Bel Caro, prego."', by: '도라 벨 카로', to: null };
  const shifted = { number: 9, sentence: 2, messageId: 'm9', text: '"Grazie, Nico."', by: '니코', to: null };
  const scene = { id: 'S9', events: [{ quotes: [moved, shifted] }], present: ['도라 벨 카로', '니코'] };
  const messages = [{ id: 'm9', number: 9, sentences: ['"Signora Bel Caro, prego."', '문이 닫혔다.'] }];
  assert.equal(S.attributionCandidates({ scenes: [scene] }, messages).length, 0);
  const out = S.enforceAttributionRules({ scenes: [scene] }, messages);
  assert.deepEqual(out.map((x) => x.rule), ['message-changed', 'pointer-mismatch']);
  assert.equal(moved.by, '도라 벨 카로'); assert.equal(shifted.by, '니코');
}

// The record names people and reasons only.
{
  const q = { number: 10, sentence: 1, text: '"비밀 대사"', by: null, to: null };
  const scene = { id: 'S10', events: [{ quotes: [q] }], present: ['니코', '렌조'] };
  const c = S.attributionCandidates({ scenes: [scene] }, [{ id: 'm10', number: 10, sentences: [q.text, '니코가 속삭였다.'] }]);
  const a = answer('니코', [], '니코가 속삭였다.');
  const d = S.confirmAttributionResults(c, [a], [a]);
  S.applyAttributionResults(c, d);
  const record = JSON.stringify(S.attributionDiagnostics(c, [a], [a], d, [{ by: null, to: null }]));
  assert.ok(!record.includes('비밀 대사') && !record.includes('속삭였다'));
  assert.match(record, /"decision":"applied"/);
}

console.log('attribution rule tests passed');

// When scenes are first written, a speaker the line calls by name is not saved either.
{
  const L = require('../memory-module/lib/ledger.cjs');
  const messages = L.prepareMessages([{ id: 'f1', number: 1, role: 'assistant', speaker: 'Narrator', content: '직원이 고개를 숙였다. "Signora Bel Caro, mi perdoni!" 도라는 말이 없었다.' }]);
  const n = messages[0].sentences.findIndex((x) => x.includes('perdoni')) + 1;
  const store = { ...S.emptyStore(), personas: ['도라 벨 카로'] };
  const r = S.applyScenes(store, { scenes: [{ end: 1, title: '사과', summary: '', present: ['도라 벨 카로', '파비오'], events: [{ text: '사과', quotes: [{ n: `1.${n}`, q: 'perdoni', by: '도라 벨 카로', byEvidence: '도라는 말이 없었다.', to: '파비오' }] }], facts: [], recollections: [] }] }, messages, 1, undefined, { verifyAttribution: true });
  const saved = (r.scenes || r.made || [])[0]?.events?.[0]?.quotes?.[0] || store.scenes?.[0]?.events?.[0]?.quotes?.[0];
  assert.ok(saved, 'the line is kept');
  assert.equal(saved.by, null);
}
console.log('fold-time vocative test passed');
