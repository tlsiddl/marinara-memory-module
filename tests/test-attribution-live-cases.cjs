// node --test tests/test-attribution-live-cases.cjs
// Regression cases shaped after a live dialogue check, rebuilt with invented names and lines only, plus the
// speed rules: fingerprint skip, one question per group, a second only for flagged lines, groups in parallel.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-attr-live-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const S = require('../memory-module/lib/scenes.cjs');
const X = require('../memory-module/lib/service.cjs')._test;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

// Invented cast: the user's character 하담, staff member Tommaso (written in Latin letters in the cast list),
// and two others.
const PERSONA = '하담';
const filler = (n) => Array.from({ length: n }, (_, i) => `창밖으로 비가 ${i + 1}번째로 내렸다.`);
const model = (reply, seen = { calls: 0, inFlight: 0, maxInFlight: 0 }) => async () => ({
  provider: {
    chatComplete: async (prompt) => {
      seen.calls++; seen.inFlight++; seen.maxInFlight = Math.max(seen.maxInFlight, seen.inFlight);
      try { return { content: JSON.stringify(await reply(JSON.parse(prompt[1].content), prompt[0].content)) }; } finally { seen.inFlight--; }
    },
  },
});
const idOf = (input, text) => input.items.find((x) => x.quote === text)?.id;

test('a wrong "Name |" tag loses to narration, and the role is named from a later introduction', () => {
  const line = '"Da questa parte, prego…"';
  const q = { number: 1, sentence: 2, messageId: 'm1', text: line, by: PERSONA, to: null };
  const scene = { id: 'S1', start: 1, end: 1, events: [{ text: '안내', quotes: [q] }], present: [PERSONA, 'Tommaso'] };
  const store = { scenes: [scene], personas: [PERSONA], cast: ['Tommaso'] };
  const sentences = ['식당 입구에서 젊은 직원 한 명이 앞장섰다.', `${PERSONA} | ${line}`, '직원의 말이 거기서 끊겼다.', ...filler(24), '"Mi scusi, mi chiamo Tommaso."', '직원이 고개를 숙였다.'];
  const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences }];
  // The introduction is far past the 20 sentences after the line, but in the same scene.
  assert.equal(S.resolveRole('직원', sentences, [PERSONA, 'Tommaso']), 'Tommaso');
  const ruled = S.enforceAttributionRules(store, messages);
  assert.equal(q.by, 'Tommaso');
  assert.match(ruled[0].rule, /narration-speaker/);

  // Introduced in Korean narration only ("토마소라는 직원"), while the cast list writes the name in Latin letters.
  const q2 = { ...q, by: PERSONA };
  const scene2 = { ...scene, events: [{ quotes: [q2] }] };
  const korean = ['식당 입구에서 토마소라는 직원이 앞장섰다.', `${PERSONA} | ${line}`, '직원의 말이 거기서 끊겼다.'];
  S.enforceAttributionRules({ ...store, scenes: [scene2] }, [{ id: 'm1', number: 1, sentences: korean }]);
  assert.equal(q2.by, 'Tommaso');

  // The role is never named: the user's character in the doubtful tag is still not kept as the speaker.
  const q3 = { ...q, by: PERSONA };
  const scene3 = { ...scene, events: [{ quotes: [q3] }], present: [PERSONA] };
  const out = S.enforceAttributionRules({ scenes: [scene3], personas: [PERSONA] }, [{ id: 'm1', number: 1, sentences: ['직원이 앞장섰다.', `${PERSONA} | ${line}`, '직원의 말이 거기서 끊겼다.'] }]);
  assert.equal(q3.by, null);
  assert.match(out[0].rule, /label-contradicted/);
  // A tag naming someone who is not the user's character is taken as the role's name.
  const q4 = { ...q, by: 'Tommaso' };
  S.enforceAttributionRules({ scenes: [{ ...scene3, events: [{ quotes: [q4] }], present: [PERSONA, 'Tommaso'] }], personas: [PERSONA] }, [{ id: 'm1', number: 1, sentences: ['직원이 앞장섰다.', `Tommaso | ${line}`, '직원의 말이 거기서 끊겼다.'] }]);
  assert.equal(q4.by, 'Tommaso');

  // The model is shown the scene's introduction lines and told the tag is doubtful.
  const q5 = { ...q, by: null };
  const store5 = { ...store, scenes: [{ ...scene, events: [{ quotes: [q5] }] }] };
  const c = S.attributionCandidates(store5, [{ id: 'm1', number: 1, sentences: ['식당 입구에서 젊은 직원 한 명이 앞장섰다.', `${PERSONA} | ${line}`, '직원의 말이 거기서 끊겼다.', ...filler(24), '"Mi scusi, mi chiamo Tommaso."'] }]);
  const input = S.attributionInput(c);
  assert.ok(input.scenes[0].roleIntroductions.some((s) => s.includes('mi chiamo Tommaso')));
  assert.equal(input.items[0].speakerTagDoubtful, PERSONA);
});

test('a stored speaker both answers give as the listener is not kept: resolved, swapped or cleared', async () => {
  const line = '"Signora Moretti, mi perdoni! La sala non è pronta."';
  const setUp = (chat, extra = []) => {
    const q = { number: 1, sentence: 2, messageId: 'm1', text: line, by: PERSONA, to: 'Tommaso', attributionChecked: 7 };
    const store = { ...S.emptyStore(), personas: [PERSONA], cast: ['Tommaso'], scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '사과', quotes: [q] }], present: [PERSONA, 'Tommaso'] }] };
    X.saveScenes(chat, store);
    const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: ['직원이 허겁지겁 달려왔다.', line, '직원이 허리를 숙였다.', ...extra] }];
    return { store: X.loadScenes(chat), q: X.loadScenes(chat).scenes[0].events[0].quotes[0], messages };
  };
  // "Moretti" is a family name the cast list does not have, so no rule sees the call; the answers do.
  const answer = (input) => ({ items: [{ id: input.items[0].id, by: '직원', to: [PERSONA], byEvidence: '직원이 허리를 숙였다.', toEvidence: line }] });

  // The role is never named: the reversed pair is turned round.
  let { store, q, messages } = setUp('room-reversed');
  const seen = { calls: 0, inFlight: 0, maxInFlight: 0 };
  await X.reviewAttributions('room-reversed', store, messages, model(answer, seen), { cancel: false }, 'resume');
  assert.equal(seen.calls, 2, 'the answer contradicts the stored value, so it is asked twice');
  assert.equal(q.by, 'Tommaso'); assert.equal(q.to, PERSONA);
  const entry = X.loadAttributionLog('room-reversed').runs[0].entries.find((e) => e.source !== 'rule');
  assert.match(entry.rule, /swapped-reversed/);
  assert.ok(entry.flags.includes('differs-from-stored'));
  assert.ok(entry.rejected.includes('role-unresolved'));

  // The scene names the staff member: the role becomes that name.
  ({ store, q, messages } = setUp('room-named', ['"Sono Tommaso, il responsabile di sala."', '직원이 다시 고개를 숙였다.']));
  await X.reviewAttributions('room-named', store, messages, model(answer), { cancel: false }, 'resume');
  assert.equal(q.by, 'Tommaso'); assert.equal(q.to, PERSONA);

  // Answers that name nobody: the reversed speaker is removed, not kept.
  ({ store, q, messages } = setUp('room-cleared'));
  store.scenes[0].present = [PERSONA, 'Tommaso', '브루노'];
  await X.reviewAttributions('room-cleared', store, messages, model((input) => ({ items: [{ id: input.items[0].id, by: null, to: [PERSONA] }] })), { cancel: false }, 'resume');
  assert.equal(q.by, null);
});

test('a reply to a question by name gets the asker as listener, even when the model leaves it open', async () => {
  const ask = { number: 17, sentence: 1, messageId: 'm17', text: '"Hai sentito, Lucio? Domani si parte."', by: PERSONA, to: '루치오', attributionChecked: 7 };
  const reply = { number: 17, sentence: 3, messageId: 'm17', text: '"Sì, Boss. Ho sentito."', by: '루치오', to: null, attributionChecked: 7 };
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: [{ id: 'S17', start: 17, end: 17, events: [{ quotes: [ask, reply] }], present: [PERSONA, '루치오', '브루노'] }] };
  X.saveScenes('room-reply', store);
  const live = X.loadScenes('room-reply');
  const messages = [{ id: 'm17', number: 17, role: 'assistant', sentences: [ask.text, '루치오는 담배를 비벼 껐다.', reply.text, '루치오가 대답했다.'] }];
  await X.reviewAttributions('room-reply', live, messages, model((input) => ({ items: input.items.map((x) => ({ id: x.id, by: x.quote === reply.text ? '루치오' : PERSONA, to: [], byEvidence: '루치오가 대답했다.' })) })), { cancel: false }, 'auto');
  assert.equal(live.scenes[0].events[0].quotes[1].to, PERSONA);
  // The rule alone does it too, before any model is asked ("Boss" calls the asker back, which is fine).
  const again = { ...reply, to: null };
  S.enforceAttributionRules({ scenes: [{ id: 'S17', events: [{ quotes: [{ ...ask }, again] }], present: [PERSONA, '루치오'] }], personas: [PERSONA] }, messages);
  assert.equal(again.to, PERSONA);
  // The recipient helper is not part of the check; nothing depends on it filling a reply.
});

test('two agreed listeners, one called only by a title, are kept', async () => {
  const line = '"Lucio, porta la macchina. Il carico è pronto, Boss."';
  const both = { number: 20, sentence: 1, messageId: 'm20', text: line, by: '브루노', to: `루치오·${PERSONA}`, attributionChecked: 7 };
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: [{ id: 'S20', start: 20, end: 20, events: [{ quotes: [both] }], present: [PERSONA, '루치오', '브루노'] }] };
  X.saveScenes('room-title', store);
  const live = X.loadScenes('room-title');
  const messages = [{ id: 'm20', number: 20, role: 'assistant', sentences: [line, '브루노가 덧붙였다.'] }];
  const seen = { calls: 0 };
  // Both answers agree on both listeners, but the listener evidence only names one of them.
  await X.reviewAttributions('room-title', live, messages, model((input) => ({ items: [{ id: input.items[0].id, by: '브루노', to: ['루치오', PERSONA], byEvidence: '브루노가 덧붙였다.', toEvidence: line }] }), seen), { cancel: false }, 'resume');
  assert.equal(live.scenes[0].events[0].quotes[0].to, `루치오·${PERSONA}`);

  // Where earlier lines use the title for one person only, the rules give that person as listener on their own.
  const calls = [1, 2].map((i) => ({ number: 30, sentence: i * 2 - 1, messageId: 'm30', text: `"Sì, Boss. Va bene ${i}."`, by: '루치오', to: PERSONA }));
  const fresh = { number: 30, sentence: 5, messageId: 'm30', text: line, by: '브루노', to: '루치오' };
  const titled = { personas: [PERSONA], scenes: [{ id: 'S30', events: [{ quotes: [...calls, fresh] }], present: [PERSONA, '루치오', '브루노'] }] };
  assert.equal(S.titleMap(titled).get('boss'), PERSONA);
  S.enforceAttributionRules(titled, [{ id: 'm30', number: 30, sentences: [calls[0].text, '루치오가 대답했다.', calls[1].text, '루치오가 말했다.', line, '브루노가 덧붙였다.'] }]);
  assert.equal(fresh.to, `루치오·${PERSONA}`);
});

test('a line whose source moved after a swipe is reported and not checked against the wrong text', async () => {
  const q = { number: 9, sentence: 2, messageId: 'm9', text: '"No. Vieni qui, presto!"', by: '브루노', to: '루치오', attributionChecked: 7 };
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: [{ id: 'S9', start: 9, end: 9, events: [{ quotes: [q] }], present: [PERSONA, '루치오', '브루노'] }] };
  X.saveScenes('room-swipe', store);
  // Same message id; the active swipe now has a different text where only "No." still matches.
  const messages = [{ id: 'm9', number: 9, h: 'swiped', role: 'assistant', sentences: ['브루노가 문을 열었다.', '"No.', '그는 다시 문을 닫았다.'] }];
  const seen = { calls: 0 };
  await X.reviewAttributions('room-swipe', X.loadScenes('room-swipe'), messages, model(() => assert.fail('no question about a moved line'), seen), { cancel: false }, 'resume');
  assert.equal(seen.calls, 0);
  const entry = X.loadAttributionLog('room-swipe').runs[0].entries[0];
  assert.equal(entry.decision, 'skipped'); assert.equal(entry.rule, 'pointer-mismatch');
  assert.equal(X.loadScenes('room-swipe').scenes[0].events[0].quotes[0].by, '브루노', 'left as it was');
});

test('lines are checked and recorded in story order even when events are out of order', () => {
  const late = { number: 9, sentence: 18, text: '"Andiamo, allora."', by: null, to: null };
  const a = { number: 9, sentence: 14, text: '"Chi è stato?"', by: null, to: null };
  const b = { number: 9, sentence: 16, text: '"Non lo so, davvero."', by: null, to: null };
  const scene = { id: 'S4', events: [{ quotes: [late] }, { quotes: [a, b] }], present: [PERSONA, '루치오', '브루노'] };
  const sentences = filler(20);
  sentences[13] = a.text; sentences[15] = b.text; sentences[17] = late.text;
  const c = S.attributionCandidates({ scenes: [scene] }, [{ id: 'm9', number: 9, sentences }]);
  assert.deepEqual(c.map((e) => e.q.sentence), [14, 16, 18]);
  assert.equal(S.orderSceneEvents({ scenes: [scene] }, [{ id: 'm9', number: 9, sentences }]), 1);
  assert.equal(scene.events[0].quotes[0], a);
});

// Twenty lines of one message: speaker from narration, listener from evidence, all matching what is stored.
function manyLines(chat, count = 20, number = 40) {
  const sentences = [], quotes = [];
  for (let i = 0; i < count; i++) {
    const text = `"Riga numero ${i + 1}, ascolta bene."`;
    sentences.push(text, '브루노가 루치오에게 말했다.');
    quotes.push({ number, sentence: i * 2 + 1, messageId: `m${number}`, text, by: '브루노', to: '루치오' });
  }
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: [{ id: `S${number}`, start: number, end: number, events: [{ quotes }], present: [PERSONA, '루치오', '브루노'] }] };
  X.saveScenes(chat, store);
  return { store: X.loadScenes(chat), messages: [{ id: `m${number}`, number, h: 'h1', role: 'assistant', sentences }] };
}
const agreeing = (input) => ({ items: input.items.map((x) => ({ id: x.id, by: '브루노', to: ['루치오'], byEvidence: '브루노가 루치오에게 말했다.', toEvidence: '브루노가 루치오에게 말했다.' })) });

test('clean lines are asked once, flagged ones twice, unchanged ones never again (also on resume)', async () => {
  const { store, messages } = manyLines('room-speed');
  const seen = { calls: 0, inFlight: 0, maxInFlight: 0 };
  const calls = await X.reviewAttributions('room-speed', store, messages, model(agreeing, seen), { cancel: false }, 'resume');
  // Before: two questions per four lines = 10 calls for 20 lines. Now: two groups of up to 16, asked once.
  assert.equal(calls, 2); assert.equal(seen.calls, 2);
  const run = X.loadAttributionLog('room-speed').runs[0];
  assert.equal(run.counts.reviewed, 20); assert.equal(run.counts.second, 0);
  assert.ok(run.entries.every((e) => e.asked === 1));

  // A resume with nothing changed asks nothing.
  const again = { calls: 0 }, job = { cancel: false };
  assert.equal(await X.reviewAttributions('room-speed', store, messages, model(agreeing, again), job, 'resume'), 0);
  assert.equal(again.calls, 0);
  assert.equal(job.attributionProgress.skipped, 20);
  assert.match(job.stage, /건너뜀 20 · 전체 20/);

  // A line checked under older rules (another fingerprint) and a changed message are checked once more.
  store.scenes[0].events[0].quotes[0].attributionFp = 'older-rules';
  X.saveScenes('room-speed', store);
  const one = { calls: 0 };
  assert.equal(await X.reviewAttributions('room-speed', store, messages, model(agreeing, one), { cancel: false }, 'resume'), 1);
  messages[0].h = 'h2';
  const all = { calls: 0 };
  await X.reviewAttributions('room-speed', store, messages, model(agreeing, all), { cancel: false }, 'auto');
  assert.equal(all.calls, 2, 'every line of the changed message is checked again');

  // One answer that differs from what is stored: only that line is asked a second time.
  messages[0].h = 'h3';
  const asked = [];
  const flagged = await X.reviewAttributions('room-speed', store, messages, model((input, system) => {
    asked.push(input.items.length);
    const out = agreeing(input);
    const first = input.items.findIndex((x) => x.at === '40.1');
    if (!/한 번 더 확인/.test(system) && first >= 0) out.items[first] = { id: input.items[first].id, by: '루치오', to: ['브루노'], byEvidence: '브루노가 루치오에게 말했다.' };
    return out;
  }), { cancel: false }, 'auto');
  assert.equal(flagged, 3);
  assert.deepEqual(asked.sort((a, b) => a - b), [1, 4, 16]);
  assert.equal(store.scenes[0].events[0].quotes[0].by, '브루노');
});

test('groups run three at a time, in story order, and keep hand edits and edits made during the check', async () => {
  // Three messages of sixteen lines: three groups asked at the same time.
  const parts = [41, 42, 43].map((n) => manyLines(`tmp-${n}`, 16, n));
  const store = { ...S.emptyStore(), personas: [PERSONA], scenes: parts.map((p) => p.store.scenes[0]) };
  const messages = parts.flatMap((p) => p.messages);
  store.scenes[0].events[0].quotes[3] = { ...store.scenes[0].events[0].quotes[3], by: '루치오', to: PERSONA, manual: true };
  X.saveScenes('room-par', store);
  const live = X.loadScenes('room-par');
  const seen = { calls: 0, inFlight: 0, maxInFlight: 0 };
  await X.reviewAttributions('room-par', live, messages, model(async (input) => { await new Promise((r) => setTimeout(r, 5)); return agreeing(input); }, seen), { cancel: false }, 'resume');
  assert.equal(seen.maxInFlight, 3);
  assert.equal(seen.calls, 3);
  const manual = X.loadScenes('room-par').scenes[0].events[0].quotes[3];
  assert.equal(manual.by, '루치오'); assert.equal(manual.to, PERSONA, 'a hand-edited line is never asked about or changed');
  const order = X.loadAttributionLog('room-par').runs[0].entries.map((e) => e.number * 100 + e.sentence);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));

  // A hand edit saved while the second group is being asked: the first group is saved, nothing after it.
  for (const s of live.scenes) for (const q of s.events[0].quotes) if (!q.manual) { q.to = null; delete q.attributionFp; }
  X.saveScenes('room-par', live);
  const racing = X.loadScenes('room-par');
  let n = 0;
  await X.reviewAttributions('room-par', racing, messages, model(async (input) => {
    const mine = ++n;
    if (mine === 2) {
      await new Promise((r) => setTimeout(r, 15));
      const edited = structuredClone(X.loadScenes('room-par'));
      edited.scenes[1].events[0].quotes[0] = { ...edited.scenes[1].events[0].quotes[0], by: '브루노', to: PERSONA, manual: true };
      X.saveScenes('room-par', edited);
    } else await new Promise((r) => setTimeout(r, mine === 3 ? 30 : 1));
    return agreeing(input);
  }), { cancel: false }, 'auto');
  const saved = X.loadScenes('room-par');
  assert.equal(saved.scenes[1].events[0].quotes[0].manual, true);
  assert.equal(saved.scenes[1].events[0].quotes[0].to, PERSONA);
  assert.equal(saved.scenes[0].events[0].quotes[0].to, '루치오', 'the first group, answered before the edit, was saved');
  assert.equal(saved.scenes[1].events[0].quotes[1].to, null, 'the second group was not saved over the edit');
  assert.equal(saved.scenes[2].events[0].quotes[0].to, null, 'nor anything after it');
  assert.ok(X.loadAttributionLog('room-par').runs[0].notes.some((x) => /확인 중 장면이 바뀌어/.test(x)));
});
