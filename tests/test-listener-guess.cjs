// node --test tests/test-listener-guess.cjs
// A line with a speaker and no provable listener gets the most likely listener, stored as a marked guess
// (q.toGuess). Certain values and hand edits are never touched by it. Invented names and lines only.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-guess-'));
process.env.DATA_DIR = dir;
process.env.MEMORY_MODULE_RECALL = 'off';
const S = require('../memory-module/lib/scenes.cjs');
const service = require('../memory-module/lib/service.cjs');
const X = service._test;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const A = '하린', B = '세아', C = '민재', FAR = '가온';
const LINE = `${A} | "이쪽으로 와."`;
const CALL = `${A} | "세아, 이쪽으로 와."`;
const sentences = (line) => [`${A}이 문 앞에 섰다.`, `${B}는 의자에서 고개를 들었다.`, '문 밖은 조용했다.', line, `${C}는 창가에서 지켜보았다.`];
const build = ({ line = LINE, present = [A, B, C], quote = {}, cast = [FAR], text = sentences(line) } = {}) => {
  const q = { number: 1, sentence: 4, messageId: 'm1', text: line, by: A, to: null, ...quote };
  const store = { ...S.emptyStore(), personas: [], cast, scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '부름', quotes: [q] }], present }] };
  const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: text }];
  return { q, store, messages };
};
const ask = ({ store, messages }) => S.attributionCandidates(store, messages, 20, new Set(), { force: true });
const reply = (e, extra) => ({ id: e.id, by: null, to: [], byEvidence: '', toEvidence: '', ...extra });
const run = (world, extra) => {
  const list = ask(world);
  const e = list[0];
  S.applyAttributionResults(list, S.confirmAttributionResults(list, [reply(e, extra)], null));
  return e;
};

test('the model\'s guess is accepted for a person in the scene, stored as a marked guess', () => {
  const w = build();
  const e = run(w, { toGuess: [B] });
  assert.equal(w.q.to, B);
  assert.equal(w.q.toGuess, true);
  assert.equal(w.q.by, A);
  assert.match(e.outcome.rule, /추정한 상대/);
  assert.equal(e.outcome.after.guess, true);
});

test('a guess that is the speaker, or nobody in the scene, is rejected and the people around the line are used', () => {
  let w = build();
  run(w, { toGuess: [A] });
  assert.equal(w.q.to, `${B}·${C}`, 'the speaker is never the listener');
  assert.equal(w.q.toGuess, true);
  w = build();
  run(w, { toGuess: [FAR] });
  assert.equal(w.q.to, `${B}·${C}`, 'a known name that is not around the line is not accepted');
  w = build();
  run(w, { toGuess: ['모르는사람'] });
  assert.equal(w.q.to, `${B}·${C}`, 'an unknown name is not accepted');
});

test('without a usable guess the people around the line are the guess: one, several, or nobody', () => {
  const none = ['문 앞은 고요했다.', '바람만 불었다.', '문 밖은 조용했다.', LINE, '시간이 흘렀다.'];
  let w = build({ present: [A], cast: [], text: none });
  run(w, {});
  assert.equal(w.q.to, null, 'nobody can be identified: left blank');
  assert.equal(w.q.toGuess, undefined);
  assert.equal(w.q.toGuessChecked, 1, 'and marked as asked, so it is not asked again');
  w = build({ present: [A, B], cast: [], text: [`${A}이 문 앞에 섰다.`, `${B}는 고개를 들었다.`, '문 밖은 조용했다.', LINE, '시간이 흘렀다.'] });
  run(w, {});
  assert.equal(w.q.to, B);
  assert.equal(w.q.toGuess, true);
  w = build();
  run(w, {});
  assert.equal(w.q.to, `${B}·${C}`);
  assert.equal(w.q.toGuess, true);
  // Another speaker nearby counts as someone present.
  const other = { number: 1, sentence: 6, messageId: 'm1', text: `${C} | "알겠어."`, by: C, to: null };
  w = build({ present: [A, C], cast: [], text: ['문 앞은 고요했다.', '바람만 불었다.', '문 밖은 조용했다.', LINE, '시간이 흘렀다.', other.text] });
  w.store.scenes[0].events[0].quotes.push(other);
  const list = ask(w);
  S.applyAttributionResults(list, S.confirmAttributionResults(list, list.map((e) => reply(e, {})), null));
  assert.equal(w.q.to, C, 'the other speaker nearby is the one present');
  assert.equal(other.to, A, 'the other speaker\'s listener is the first speaker, guessed the same way');
  assert.equal(other.toGuess, true);
});

test('a call by name beats the guess', () => {
  const w = build({ line: CALL });
  run(w, { toGuess: [C] });
  assert.equal(w.q.to, B);
  assert.equal(w.q.toGuess, undefined);
  const w2 = build({ line: CALL });
  S.enforceAttributionRules(w2.store, w2.messages);
  assert.equal(w2.q.to, B, 'the rule step settles it without any model');
  assert.equal(w2.q.toGuess, undefined);
});

test('a direct reply beats the guess: the answer goes back to the one who asked', () => {
  const asked = { number: 1, sentence: 4, messageId: 'm1', text: `${B} | "어디 가, ${A}?"`, by: B, to: A };
  const answered = { number: 1, sentence: 6, messageId: 'm1', text: `${A} | "시장에."`, by: A, to: null };
  const text = [`${B}가 물었다.`, '바람이 불었다.', '짧은 정적이 흘렀다.', asked.text, '잠시 뒤였다.', answered.text];
  const w = build({ present: [A, B, C], text });
  w.store.scenes[0].events[0].quotes = [asked, answered];
  const list = ask(w);
  const e = list.find((x) => x.q === answered);
  assert.equal(e.facts.reply.asker, B);
  S.applyAttributionResults([e], S.confirmAttributionResults([e], [reply(e, { toGuess: [C] })], null));
  assert.equal(answered.to, B);
  assert.equal(answered.toGuess, undefined);
});

test('a certain listener is not replaced by a guess', () => {
  const w = build({ quote: { to: B } });
  run(w, { toGuess: [C] });
  assert.equal(w.q.to, B);
  assert.equal(w.q.toGuess, undefined);
  const e = ask(build({ quote: { to: B } }));
  assert.equal(S.attributionFlags(e[0], reply(e[0], { toGuess: [C] })).reasons.includes('listener-differs'), false);
});

test('a later certain answer replaces a guess', () => {
  const w = build({ quote: { to: C, toGuess: true } });
  const e = run(w, { by: A, to: [B], byEvidence: LINE, toEvidence: `${B}는 의자에서 고개를 들었다.` });
  assert.equal(w.q.to, B);
  assert.equal(w.q.toGuess, undefined);
  assert.notEqual(e.outcome.decision, 'skipped');
  // The rule step keeps a guess while its speaker is unchanged, and a certain call by name replaces it.
  const kept = build({ quote: { to: C, toGuess: true } });
  S.enforceAttributionRules(kept.store, kept.messages);
  assert.equal(kept.q.to, C); assert.equal(kept.q.toGuess, true);
  const called = build({ line: CALL, quote: { to: C, toGuess: true } });
  S.enforceAttributionRules(called.store, called.messages);
  assert.equal(called.q.to, B); assert.equal(called.q.toGuess, undefined);
  // A guess that names the speaker is dropped by the rules.
  const bad = build({ quote: { to: A, toGuess: true } });
  S.enforceAttributionRules(bad.store, bad.messages);
  assert.equal(bad.q.to, null); assert.equal(bad.q.toGuess, undefined);
});

test('a hand-edited line is never touched, and the guessed listener it holds is not a rule input', () => {
  const w = build({ quote: { manual: true } });
  assert.deepEqual(ask(w), [], 'a manual line is not asked');
  const edited = build({ quote: { to: C, toGuess: true } });
  edited.store.scenes[0].edited = true;
  assert.deepEqual(ask(edited), [], 'a hand-edited scene is not asked');
  const e = ask(build({ quote: { to: C, toGuess: true, manual: true } }));
  assert.deepEqual(e, []);
  // A guessed listener is not a certain one for the rules that read the stored listeners.
  assert.equal(S.quoteLine({ text: LINE, by: A, to: C, toGuess: true }), `${A} → ${C}(추정): "이쪽으로 와."`);
  assert.equal(S.quoteLine({ text: LINE, by: A, to: C }), `${A} → ${C}: "이쪽으로 와."`);
});

test('only lines with a speaker and no listener are asked again; nothing else is sent', () => {
  const quotes = [
    { number: 1, sentence: 1, text: `${A} | "하나."`, by: A, to: null },
    { number: 1, sentence: 2, text: `${A} | "둘."`, by: A, to: B },
    { number: 1, sentence: 3, text: `${A} | "셋."`, by: A, to: C, toGuess: true },
    { number: 1, sentence: 4, text: `${B} | "넷."`, by: B, to: null, manual: true },
    { number: 1, sentence: 5, text: `"다섯."`, by: null, to: null },
    { number: 1, sentence: 6, text: `${B} | "여섯."`, by: B, to: A },
  ];
  const text = [...quotes.map((q) => q.text), `${C}는 조용히 서 있었다.`];
  const base = { ...S.emptyStore(), personas: [], cast: [], scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '대화', quotes }], present: [A, B, C] }] };
  const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: text }];
  quotes.forEach((q) => { q.messageId = 'm1'; });
  const store = structuredClone(base);
  // Every line was checked under the current rules before this feature existed.
  for (const e of S.attributionCandidates(store, messages, Infinity, new Set(), { force: true })) { e.q.attributionChecked = 7; e.q.attributionFp = e.fingerprint; }
  store.scenes[0].events[0].quotes.forEach((q) => { delete q.toGuessChecked; });
  const asked = S.attributionCandidates(store, messages, Infinity, new Set());
  assert.deepEqual(asked.map((e) => e.q.sentence), [1], 'only the blank-listener line (not manual, with a speaker)');
});

test('the check sends only blank-listener lines to the model, once, and the guess is saved', async () => {
  const q1 = { number: 1, sentence: 4, messageId: 'm1', text: LINE, by: A, to: null, attributionChecked: 7 };
  const q2 = { number: 1, sentence: 6, messageId: 'm1', text: `${B} | "그래."`, by: B, to: A, attributionChecked: 7 };
  const text = [...sentences(LINE), q2.text];
  const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: text }];
  const store = { ...S.emptyStore(), personas: [], cast: [], scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '부름', quotes: [q1, q2] }], present: [A, B, C] }] };
  X.saveScenes('room-guess', store);
  const live = X.loadScenes('room-guess');
  // Mark every line as already checked under the current rules, like a chat saved before this feature.
  for (const e of S.attributionCandidates(live, messages, Infinity, new Set(), { force: true })) { e.q.attributionChecked = 7; e.q.attributionFp = e.fingerprint; }
  const sentItems = [];
  let calls = 0;
  const model = async () => ({ provider: { chatComplete: async (prompt) => {
    calls++;
    const input = JSON.parse(prompt[1].content);
    assert.match(prompt[0].content, /toGuess/, 'the question asks for a guess');
    sentItems.push(...input.items.map((x) => x.at));
    return { content: JSON.stringify({ items: input.items.map((x) => ({ id: x.id, by: A, to: [], toGuess: [B], byEvidence: '', toEvidence: '' })) }) };
  } } });
  const job = { cancel: false };
  await X.reviewAttributions('room-guess', live, messages, model, job, 'resume');
  assert.equal(calls, 1);
  assert.deepEqual(sentItems, ['1.4'], 'the line that already has a listener was not sent');
  let saved = X.loadScenes('room-guess').scenes[0].events[0].quotes;
  assert.equal(saved[0].to, B); assert.equal(saved[0].toGuess, true);
  assert.equal(saved[1].to, A); assert.equal(saved[1].toGuess, undefined);
  const logged = X.loadAttributionLog('room-guess').runs[0].entries;
  assert.ok(logged.some((x) => /추정한 상대/.test(x.rule || '') && x.after.guess === true), 'the diagnostics log records the guess');
  // A second run asks nothing: the guess is stored and nothing changed.
  calls = 0;
  await X.reviewAttributions('room-guess', X.loadScenes('room-guess'), messages, model, { cancel: false }, 'resume');
  assert.equal(calls, 0);
  saved = X.loadScenes('room-guess').scenes[0].events[0].quotes;
  assert.equal(saved[0].toGuess, true);
});

test('a blank line nobody can be guessed for is asked once, not on every run', async () => {
  const q = { number: 1, sentence: 2, messageId: 'm1', text: LINE, by: A, to: null, attributionChecked: 7 };
  const messages = [{ id: 'm1', number: 1, role: 'assistant', sentences: ['문 앞은 고요했다.', LINE, '시간이 흘렀다.'] }];
  X.saveScenes('room-alone', { ...S.emptyStore(), personas: [], cast: [], scenes: [{ id: 'S1', start: 1, end: 1, events: [{ text: '혼잣말', quotes: [q] }], present: [A] }] });
  let calls = 0;
  const model = async () => ({ provider: { chatComplete: async (prompt) => { calls++; return { content: JSON.stringify({ items: JSON.parse(prompt[1].content).items.map((x) => ({ id: x.id, by: A, to: [], toGuess: [] })) }) }; } } });
  await X.reviewAttributions('room-alone', X.loadScenes('room-alone'), messages, model, { cancel: false }, 'resume');
  assert.equal(calls, 1);
  const saved = X.loadScenes('room-alone').scenes[0].events[0].quotes[0];
  assert.equal(saved.to ?? null, null);
  await X.reviewAttributions('room-alone', X.loadScenes('room-alone'), messages, model, { cancel: false }, 'resume');
  assert.equal(calls, 1, 'not asked again');
});

test('saving the scene editor: a changed listener becomes the user\'s and clears the guess; an untouched guess stays marked', async () => {
  const routes = new Map();
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((m) => [m, (url, fn) => routes.set(`${m.toUpperCase()} ${url}`, fn)]));
  service.attach({ register: (fn) => fn(app), addHook() {} });
  const res = { status() { return this; }, send(v) { return v; }, json(v) { return v; } };
  X.saveSettings({ connection: null, chats: {} });
  const lines = [
    { number: 1, sentence: 1, text: `${A} | "하나."`, by: A, to: B, toGuess: true },
    { number: 1, sentence: 2, text: `${A} | "둘."`, by: A, to: C, toGuess: true },
  ];
  X.saveScenes('room-edit', { ...S.emptyStore(), scenes: [{ id: 'S1', title: '방', summary: '', events: [{ text: '대화', quotes: lines }], present: [A, B, C] }] });
  const sent = structuredClone(lines);
  sent[1].to = A === sent[1].by ? B : A; // the user types another listener
  await routes.get('PATCH /chats/:id/scenes/:sceneId')({ params: { id: 'room-edit', sceneId: 'S1' }, body: { events: [{ text: '대화', quotes: sent }] } }, res);
  const saved = X.loadScenes('room-edit').scenes[0].events[0].quotes;
  assert.equal(saved[0].toGuess, true, 'an untouched guess stays a guess');
  assert.equal(saved[0].manual, undefined);
  assert.equal(saved[1].manual, true);
  assert.equal(saved[1].toGuess, undefined, 'the user\'s value is certain');
  assert.equal(saved[1].to, B);
});

test('the scene card and the editor show a guessed listener as a guess, and saving the field clears it', () => {
  // The card text and the saving rule are in the source and in the built extension alike.
  for (const file of ['../extension/runtime.js', '../deliverable/extension.js']) {
    const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.match(code, /\$\{q\.to\}\$\{q\.toGuess \? '\(추정\)' : ''\}/, file);
    assert.match(code, /추정 · 고치면 확정/, file);
    assert.match(code, /const \{ toGuess, \.\.\.sure \} = q;/, file);
  }
});

test('memory injection marks a guessed listener', () => {
  const store = { ...S.emptyStore(), scenes: [] };
  const scene = { id: 'S1', title: '부름', summary: '요약', events: [{ text: '부름', importance: 'major', quotes: [{ number: 1, sentence: 1, text: LINE, by: A, to: B, toGuess: true }, { number: 1, sentence: 2, text: `${B} | "응."`, by: B, to: A }] }], present: [A, B] };
  store.scenes.push(scene);
  const text = JSON.stringify(S.quoteLine(scene.events[0].quotes[0])) + S.quoteLine(scene.events[0].quotes[1]);
  assert.match(text, new RegExp(`${A} → ${B}\\(추정\\)`));
  assert.doesNotMatch(S.quoteLine(scene.events[0].quotes[1]), /추정/);
});
