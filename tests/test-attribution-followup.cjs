// node --test tests/test-attribution-followup.cjs
// Follow-up cases to the live dialogue check of 0.11.43, rebuilt with invented names and lines only: narration
// that only mentions someone, saved lines asked again, a role named later, second questions, the check record,
// lines whose source "changed", and story order inside a message.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-attr-follow-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const S = require('../memory-module/lib/scenes.cjs');
const X = require('../memory-module/lib/service.cjs')._test;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

// Invented cast: the user's character 세라 몬티 (called "Signora Monti"), staff member Teodoro, and a guest.
const PERSONA = '세라 몬티';
const STAFF = 'Teodoro';
const GUEST = '가브리엘';
const model = (reply, seen = { calls: 0 }) => async () => ({
  provider: { chatComplete: async (prompt) => { seen.calls++; return { content: JSON.stringify(await reply(JSON.parse(prompt[1].content), prompt[0].content)) }; } },
});
const store1 = (quotes, extra = {}) => ({ ...S.emptyStore(), personas: [PERSONA], cast: [STAFF, GUEST], scenes: [{ id: 'S1', start: 1, end: 1, messages: [{ id: 'm1' }], events: [{ text: '사과', quotes }], present: [PERSONA, STAFF, GUEST], ...extra }] });

const APOLOGY = '"Signora Monti, mi perdoni! La sala è piena."';

test('narration that only mentions the person spoken to does not wipe an agreed value', async () => {
  // After the line: the user's character is mentioned, but nothing says she said it (she is the one called).
  for (const after of ['세라의 말이 끝나자마자였다.', '세라는 대답 대신 고개를 저었다.']) {
    const chat = `room-mention-${after.length}`;
    const q = { number: 1, sentence: 2, messageId: 'm1', text: APOLOGY, by: STAFF, to: PERSONA };
    X.saveScenes(chat, store1([q]));
    const live = X.loadScenes(chat);
    const messages = [{ id: 'm1', number: 1, h: 'h1', role: 'assistant', sentences: ['직원이 허겁지겁 달려왔다.', APOLOGY, after] }];
    assert.equal(S.narrationSpeaker(messages[0].sentences, 1, [PERSONA, STAFF, GUEST]), null, 'the narration attributes nothing');
    // Both answers agree with the stored value; their evidence is not in the source, so neither is "proven".
    const seen = { calls: 0 };
    const answer = (input) => ({ items: input.items.map((x) => ({ id: x.id, by: STAFF, to: [PERSONA], byEvidence: '', toEvidence: APOLOGY })) });
    await X.reviewAttributions(chat, live, messages, model(answer, seen), { cancel: false }, 'resume');
    const saved = X.loadScenes(chat).scenes[0].events[0].quotes[0];
    assert.equal(saved.by, STAFF); assert.equal(saved.to, PERSONA);
    assert.equal(seen.calls, 1, 'a clean answer that agrees with the stored value is not asked twice');
    // The run right after asks nothing: the saved line is not checked again.
    const again = { calls: 0 };
    await X.reviewAttributions(chat, X.loadScenes(chat), messages, model(answer, again), { cancel: false }, 'resume');
    assert.equal(again.calls, 0);
    assert.equal(X.loadScenes(chat).scenes[0].events[0].quotes[0].by, STAFF);
  }

  // The same with two answers (the line is asked twice for another reason): the agreed, called-consistent value stays.
  const q = { number: 1, sentence: 2, messageId: 'm1', text: APOLOGY, by: STAFF, to: PERSONA };
  const store = store1([q]);
  const messages = [{ id: 'm1', number: 1, sentences: ['직원이 허겁지겁 달려왔다.', APOLOGY, '세라의 말이 끝나자마자였다.'] }];
  const c = S.attributionCandidates(store, messages, 20, new Set(), { force: true });
  const answer = [{ id: c[0].id, by: STAFF, to: [PERSONA], byEvidence: '' }];
  S.applyAttributionResults(c, S.confirmAttributionResults(c, answer, answer));
  assert.equal(q.by, STAFF); assert.equal(q.to, PERSONA);
});

test('narration that names this line\'s speaker still wins, and keeps the listeners', () => {
  const q = { number: 1, sentence: 2, messageId: 'm1', text: APOLOGY, by: STAFF, to: PERSONA };
  const ruled = S.enforceAttributionRules(store1([q]), [{ id: 'm1', number: 1, sentences: ['문이 열렸다.', APOLOGY, '가브리엘이 말했다.'] }]);
  assert.equal(q.by, GUEST);
  assert.equal(q.to, PERSONA, 'only the speaker was in doubt: the listener the line calls stays');
  assert.match(ruled.find((x) => x.decision === 'applied').rule, /narration-speaker/);
});

test('a doubtful tag clears only the speaker, not the listener', () => {
  const line = '"Prego, da questa parte."';
  const q = { number: 1, sentence: 2, messageId: 'm1', text: line, by: PERSONA, to: GUEST };
  S.enforceAttributionRules({ scenes: [{ id: 'S1', events: [{ quotes: [q] }], present: [PERSONA, GUEST] }], personas: [PERSONA] }, [{ id: 'm1', number: 1, sentences: ['직원이 앞장섰다.', `${PERSONA} | ${line}`, '직원의 말이 거기서 끊겼다.'] }]);
  assert.equal(q.by, null);
  assert.equal(q.to, GUEST);
});

test('a role is named from a self-introduction in the next message, saved lines and event text', async () => {
  const line = '"Prego, da questa parte."';
  const tagged = ['직원 한 명이 다가왔다.', `${PERSONA} | ${line}`, '직원의 말이 거기서 끊겼다.'];
  // The scene covers message 1 only; the staff member gives his name at the start of message 2.
  const q = { number: 1, sentence: 2, messageId: 'm1', text: line, by: null, to: null };
  const messages = [{ id: 'm1', number: 1, sentences: tagged }, { id: 'm2', number: 2, sentences: ['직원이 메뉴판을 내밀었다.', '"Mi chiamo Teodoro, per qualsiasi cosa."', '직원이 웃었다.'] }];
  S.enforceAttributionRules(store1([q]), messages);
  assert.equal(q.by, STAFF);
  assert.equal(S.sceneScope(store1([]).scenes[0], messages).length, 6, 'the scene and the message after it');

  // No introduction at all, but the scene's other saved lines give the staff member's lines to Teodoro.
  const later = { number: 1, sentence: 5, messageId: 'm1', text: '"Il tavolo è pronto."', by: STAFF, to: PERSONA };
  const q2 = { ...q, by: null };
  S.enforceAttributionRules(store1([q2, later]), [{ id: 'm1', number: 1, sentences: [...tagged, '잠시 뒤.', later.text, '직원이 허리를 숙였다.'] }]);
  assert.equal(q2.by, STAFF);

  // Event text naming the role with the name ("직원 테오도로가") does it too; "직원이 가브리엘에게" does not.
  const q3 = { ...q, by: null };
  const named = store1([q3]);
  named.scenes[0].events[0].text = '직원 테오도로가 세라를 자리로 안내했다';
  S.enforceAttributionRules(named, [{ id: 'm1', number: 1, sentences: tagged }]);
  assert.equal(q3.by, STAFF);
  const q4 = { ...q, by: null };
  const other = store1([q4]);
  other.scenes[0].events[0].text = '직원이 가브리엘에게 사과했다';
  S.enforceAttributionRules(other, [{ id: 'm1', number: 1, sentences: tagged }]);
  assert.equal(q4.by, null, 'the person the role acts on is not its name');

  // The user's character is never the role's name, even when a saved line wrongly gives her the role's lines.
  assert.equal(S.resolveRole('직원', Object.assign([...tagged], { personas: [PERSONA], roleHints: new Map([['직원', new Set([PERSONA])]]) }), [PERSONA, STAFF]), null);
});

test('the record shows the model answers and the role for a line whose role is not named', async () => {
  const line = '"Prego, da questa parte."';
  const q = { number: 1, sentence: 2, messageId: 'm1', text: line, by: null, to: null };
  X.saveScenes('room-role', store1([q], { present: [PERSONA, GUEST] }));
  const messages = [{ id: 'm1', number: 1, h: 'h1', role: 'assistant', sentences: ['직원 한 명이 다가왔다.', `${PERSONA} | ${line}`, '직원의 말이 거기서 끊겼다.'] }];
  await X.reviewAttributions('room-role', X.loadScenes('room-role'), messages, model((input) => ({ items: input.items.map((x) => ({ id: x.id, by: '직원', to: [PERSONA], byEvidence: '직원의 말이 거기서 끊겼다.' })) })), { cancel: false }, 'resume');
  const entry = X.loadAttributionLog('room-role').runs[0].entries.find((e) => e.sentence === 2 && e.source !== 'rule');
  assert.equal(entry.first.by, '직원'); assert.equal(entry.first.byReason, 'role-unresolved');
  assert.equal(entry.second.by, '직원');
  assert.equal(entry.role, '직원'); assert.equal(entry.roleName, null);
});

test('only lines that disagree, break a rule, are called or have no speaker are asked twice', async (t) => {
  // Twenty lines of one message. Sixteen agree with what is stored (half with evidence the code cannot see);
  // two answers name another speaker, one stored speaker is blank, one answer names the person the line calls.
  const sentences = [], quotes = [];
  for (let i = 0; i < 20; i++) {
    const text = i === 19 ? '"Gabriele, ascolta bene."' : `"Riga numero ${i + 1}, va bene."`;
    sentences.push(text, '브루노가 말했다.');
    quotes.push({ number: 50, sentence: i * 2 + 1, messageId: 'm50', text, by: '브루노', to: GUEST });
  }
  quotes[18].by = null; quotes[18].to = null;
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: [{ id: 'S50', start: 50, end: 50, events: [{ quotes }], present: [PERSONA, GUEST, '브루노'] }] };
  X.saveScenes('room-ratio', store);
  const live = X.loadScenes('room-ratio');
  // Speaker from narration is settled by rules only with listeners the line calls: make the rule unable to decide.
  const messages = [{ id: 'm50', number: 50, h: 'h1', role: 'assistant', sentences: sentences.map((s) => (s === '브루노가 말했다.' ? '잠시 조용했다.' : s)) }];
  const answer = (input, system) => ({ items: input.items.map((x) => {
    const n = Number(x.at.split('.')[1]);
    const i = (n - 1) / 2;
    if (/한 번 더 확인/.test(system)) return { id: x.id, by: '브루노', to: [GUEST] };
    if (i === 3 || i === 7) return { id: x.id, by: GUEST, to: ['브루노'], byEvidence: '잠시 조용했다.' };
    if (i === 19) return { id: x.id, by: GUEST, to: [] };
    if (i === 18) return { id: x.id, by: null, to: [] };
    return { id: x.id, by: '브루노', to: [GUEST], byEvidence: i % 2 ? '잠시 조용했다.' : '' };
  }) });
  await X.reviewAttributions('room-ratio', live, messages, model(answer), { cancel: false }, 'resume');
  const run = X.loadAttributionLog('room-ratio').runs[0];
  const ratio = run.counts.second / run.counts.reviewed;
  t.diagnostic(`asked twice: ${run.counts.second}/${run.counts.reviewed} (${Math.round(ratio * 100)}%)`);
  assert.equal(run.counts.reviewed, 20);
  assert.equal(run.counts.second, 4, `asked twice ${run.counts.second} of 20 (19 of 20 for this input before 0.11.44)`);
  assert.ok(ratio <= 0.2);
  const twice = run.entries.filter((e) => e.asked === 2).map((e) => (e.sentence - 1) / 2).sort((a, b) => a - b);
  assert.deepEqual(twice, [3, 7, 18, 19]);
  // The agreeing lines kept their values.
  assert.ok(X.loadScenes('room-ratio').scenes[0].events[0].quotes.slice(0, 18).filter((_, i) => i !== 3 && i !== 7).every((q) => q.by === '브루노' && q.to === GUEST));
});

test('the record keeps changed lines of early scenes and counts the rest per scene', async () => {
  // Scene S1 has one line that changes; S2 has 400 lines checked with nothing to report.
  const early = { number: 1, sentence: 1, messageId: 'm1', text: '"Andiamo."', by: null, to: null };
  const s2 = [], quotes = [];
  for (let i = 0; i < 400; i++) {
    const text = `"Riga ${i + 1}, ascolta."`;
    s2.push(text, '브루노가 가브리엘에게 말했다.');
    quotes.push({ number: 2, sentence: i * 2 + 1, messageId: 'm2', text, by: '브루노', to: GUEST });
  }
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: [
    { id: 'S1', start: 1, end: 1, events: [{ quotes: [early] }], present: [PERSONA, GUEST, '브루노'] },
    { id: 'S2', start: 2, end: 2, events: [{ quotes }], present: [PERSONA, GUEST, '브루노'] },
  ] };
  X.saveScenes('room-log', store);
  const messages = [{ id: 'm1', number: 1, h: 'a', role: 'assistant', sentences: [early.text, '가브리엘이 브루노에게 말했다.'] }, { id: 'm2', number: 2, h: 'b', role: 'assistant', sentences: s2 }];
  await X.reviewAttributions('room-log', X.loadScenes('room-log'), messages, model((input) => ({ items: input.items.map((x) => ({ id: x.id, by: x.at === '1.1' ? GUEST : '브루노', to: [x.at === '1.1' ? '브루노' : GUEST], byEvidence: x.at === '1.1' ? '가브리엘이 브루노에게 말했다.' : '브루노가 가브리엘에게 말했다.', toEvidence: x.at === '1.1' ? '가브리엘이 브루노에게 말했다.' : '브루노가 가브리엘에게 말했다.' })) })), { cancel: false }, 'resume');
  const run = X.loadAttributionLog('room-log').runs[0];
  assert.ok(run.entries.some((e) => e.scene === 'S1' && e.number === 1 && e.sentence === 1 && e.after.by === GUEST), 'the early change is listed');
  assert.equal(run.dropped, 0);
  const s2row = run.summary.find((x) => x.scene === 'S2');
  assert.equal(s2row.unchanged + s2row.listed + s2row.settled, 400);
  assert.ok(run.entries.length < 100, 'lines with nothing to report are counted, not listed');
});

test('a line still in its message is not reported as changed when numbers or sentences shift', async () => {
  const a = { number: 3, sentence: 2, messageId: 'm3', text: '"Va bene."', by: '브루노', to: GUEST };
  const b = { number: 4, sentence: 1, messageId: 'm4', text: '"Non adesso, Gabriele."', by: '브루노', to: GUEST };
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: [{ id: 'S3', start: 3, end: 4, messages: [{ id: 'm3' }, { id: 'm4' }], events: [{ quotes: [a, b] }], present: [PERSONA, GUEST, '브루노'] }] };
  // The same messages read again: every number moved by one, a translation was written into one sentence, and a
  // sentence was split before the other line.
  const messages = [
    { id: 'm3', number: 4, sentences: ['브루노가 고개를 끄덕였다.', '"Va bene." (알겠어.)', '브루노가 말했다.'] },
    { id: 'm4', number: 5, sentences: ['밤이 깊었다.', '바람이 불었다.', '"Non adesso, Gabriele."', '브루노가 말했다.'] },
  ];
  assert.equal(S.quoteSource(a, new Map(messages.map((m) => [m.number, m])), new Map(messages.map((m) => [m.id, m]))).stale, undefined);
  const ruled = S.enforceAttributionRules(store, messages);
  assert.ok(!ruled.some((x) => x.decision === 'skipped'), 'no line is reported as moved or changed');
  assert.deepEqual([a.number, a.sentence, b.number, b.sentence], [4, 2, 5, 3], 'pointers follow the message');
  assert.ok(ruled.some((x) => x.decision === 'relocated' && x.from.number === 4 && x.from.sentence === 1));
  // A line that really is gone is still reported, and only once per run.
  X.saveScenes('room-stale', { ...S.emptyStore(), personas: [PERSONA], scenes: [{ id: 'S9', start: 9, end: 9, events: [{ quotes: [{ number: 9, sentence: 1, messageId: 'm9', text: '"Mai più."', by: '브루노', to: GUEST }] }], present: [PERSONA, GUEST, '브루노'] }] });
  await X.reviewAttributions('room-stale', X.loadScenes('room-stale'), [{ id: 'm9', number: 9, h: 'x', role: 'assistant', sentences: ['"Forse."', '브루노가 말했다.'] }], model(() => ({ items: [] })), { cancel: false }, 'resume');
  const stale = X.loadAttributionLog('room-stale').runs[0].entries.filter((e) => e.decision === 'skipped');
  assert.equal(stale.length, 1); assert.equal(stale[0].rule, 'pointer-mismatch');
});

test('lines of one message are kept in sentence order inside and across events', () => {
  const at = (n) => ({ number: 9, sentence: n, messageId: 'm9', text: `"Battuta ${n}."` });
  const [q8, q9, q14, q16, q18] = [8, 9, 14, 16, 18].map(at);
  const sentences = Array.from({ length: 20 }, (_, i) => `비가 ${i + 1}번 내렸다.`);
  for (const q of [q8, q9, q14, q16, q18]) sentences[q.sentence - 1] = q.text;
  const messages = [{ id: 'm9', number: 9, sentences }];
  // One event that lists a later line in the middle.
  const one = { scenes: [{ id: 'S4', events: [{ quotes: [q8, q18, q9] }] }] };
  assert.ok(S.orderSceneEvents(one, messages) >= 1);
  assert.deepEqual(one.scenes[0].events[0].quotes.map((q) => q.sentence), [8, 9, 18]);
  // Two events: the first holds a line that comes after all of the second.
  const two = { scenes: [{ id: 'S4', events: [{ text: '도착', quotes: [q8, q9, q18] }, { text: '말다툼', quotes: [q14, q16] }] }] };
  S.orderSceneEvents(two, messages);
  const flat = two.scenes[0].events.flatMap((e) => e.quotes.map((q) => q.sentence));
  assert.deepEqual(flat, [8, 9, 14, 16, 18]);
  assert.equal(two.scenes[0].events[0].text, '도착', 'the event order itself stays');
  // An edited scene is left as the user arranged it.
  const edited = { scenes: [{ id: 'S4', edited: true, events: [{ quotes: [q18, q8] }] }] };
  assert.equal(S.orderSceneEvents(edited, messages), 0);
});
