'use strict';
// The room's name table: one resolver for every name comparison, rename preview/apply/undo, duplicates and
// "같은 사람일 수 있음" suggestions. Invented names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../memory-module/lib/aliases.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const N = require('../memory-module/lib/names.cjs');

const FULL = '세바스 몬테로';
const NICK = '세바';
const PERSONA = '한별';

function table() {
  const t = A.emptyTable();
  A.seed(t, [FULL, PERSONA]);
  return t;
}

test('the alias table resolves every name form to one person, and an empty table changes nothing', () => {
  const t = table();
  A.addAlias(t, NICK, FULL);
  A.addAlias(t, 'Sebas Montero', FULL);
  const cast = [FULL, PERSONA];
  assert.equal(L.matchName(NICK, cast), null, 'no table: a nickname is nobody');
  A.using(t, () => {
    assert.equal(L.matchName(NICK, cast), FULL);
    assert.equal(L.matchName(`${NICK}가`, cast), FULL, 'with a particle');
    assert.equal(L.matchName('sebas montero', cast), FULL, 'case aside');
    assert.equal(S.matchAlias(NICK, cast), FULL);
    assert.equal(S.matchAlias('Montero', cast), FULL, 'the family name of the English form');
    assert.equal(S.matchAlias(NICK, [NICK, FULL, PERSONA]), FULL, 'two names of one person are one person, not ambiguous');
    assert.deepEqual(S.castNames([NICK, FULL, '아무개'], cast), [FULL]);
    assert.equal(L.canonNames(`${NICK}·${PERSONA}`, cast), `${FULL}·${PERSONA}`);
  });
  assert.equal(S.matchAlias(NICK, cast), null, 'outside the room the table is not used');
});

test('a bilingual card name is seeded with both scripts', () => {
  const t = A.emptyTable();
  A.seed(t, ['Kadel Rhee (카델 리)']);
  assert.equal(A.canonOf('카델 리', t), 'Kadel Rhee (카델 리)');
  assert.equal(A.canonOf('Kadel Rhee', t), 'Kadel Rhee (카델 리)');
  assert.equal(A.seed(t, ['Kadel Rhee (카델 리)']), false, 'seeding again changes nothing');
});

test('attribution: a line that calls someone by an alias does not keep that person as its speaker', () => {
  const msgs = L.prepareMessages([{ id: 'a', number: 1, role: 'assistant', speaker: FULL, content: `${PERSONA}가 문을 열었다.\n"세바, 앉아."` }]);
  const room = Object.assign(S.emptyStore(), { cast: [FULL], personas: [PERSONA] });
  const result = (tbl) => A.using(tbl, () => S.applyScenes(room, { scenes: [{ end: 1, title: '방', summary: '앉으라고 함', events: [{ text: '앉으라고 했다', quotes: [{ n: '1.2', by: NICK, to: PERSONA }] }] }] }, msgs, 1, undefined, { verifyAttribution: false }));
  const plain = A.emptyTable();
  const without = result(plain).scenes[0].events[0].quotes[0];
  assert.equal(without.by, NICK, 'the nickname is unknown without the table: kept as the model wrote it');
  const t = table();
  A.addAlias(t, NICK, FULL);
  const quotes = result(t).scenes[0].events[0].quotes;
  // "세바," calls 세바스 몬테로: the speaker the model gave (the same person by an alias) is dropped.
  assert.equal(quotes[0].by, null);
});

test('recent life: one person is one entry; a look-alike spelling is only suggested, never merged on its own', () => {
  const t = table();
  A.addAlias(t, 'Sebas Montero', FULL);
  const ledger = L.emptyLedger();
  ledger.cast = [FULL];
  const batch = L.prepareMessages([
    { id: 'm1', number: 1, role: 'user', speaker: PERSONA, content: '[2024-03-02 08:10] 아침을 먹었다.' },
    { id: 'm2', number: 2, role: 'assistant', speaker: FULL, content: '[2024-03-02 08:15] He ate toast.' },
    { id: 'm3', number: 3, role: 'assistant', speaker: FULL, content: '[2024-03-02 13:00] Lunch came.' },
    { id: 'm4', number: 4, role: 'assistant', speaker: FULL, content: '[2024-03-02 19:00] Dinner.' },
  ]);
  A.using(t, () => L.applyResult(ledger, {
    routine: [
      { who: 'Sebas Montero', what: 'meal', text: 'toast', evidence: [{ n: '2.1' }] },
      { who: FULL, what: 'meal', text: '점심', evidence: [{ n: '3.1' }] },
      { who: `${PERSONA}이`, what: 'meal', text: '아침', evidence: [{ n: '1.1' }] },
      { who: 'Hanbyeol', what: 'meal', text: 'dinner', evidence: [{ n: '4.1' }] },
      { who: 'Hanbyol', what: 'meal', text: 'snack', evidence: [{ n: '4.1' }] },
    ],
  }, batch));
  const who = ledger.routine.map((r) => r.who);
  assert.deepEqual(who.filter((w) => w === FULL).length, 2, 'English and Korean forms of the card name: one key');
  assert.ok(who.includes(PERSONA), 'the persona written with a particle');
  assert.ok(who.includes('Hanbyeol') && who.includes('Hanbyol'), 'romanized forms are not merged on a guess');
  const store = S.emptyStore();
  store.cast = [FULL];
  store.personas = [PERSONA];
  const sug = N.suggestions(store, ledger, t);
  assert.ok(sug.some((x) => x.source === 'Hanbyeol' && x.target === PERSONA && x.reason === 'sound'));
  assert.ok(sug.some((x) => x.source === 'Hanbyol' && x.target === PERSONA));
  // Accepting: the variant becomes an alias and its entries move to the person.
  const before = ledger.routine.length;
  const p = A.using(t, () => N.plan(store, ledger, t, { source: 'Hanbyeol', target: PERSONA, text: false }));
  assert.equal(p.counts.routine, 1);
  N.apply(store, ledger, t, p);
  assert.equal(ledger.routine.length, before, 'no entry is lost');
  assert.equal(ledger.routine.filter((r) => r.who === PERSONA).length, 2);
  assert.equal(A.canonOf('Hanbyeol', t), PERSONA);
  assert.ok(!N.suggestions(store, ledger, t).some((x) => x.source === 'Hanbyeol'));
  // A pair the user called two different people is not offered again.
  A.dismiss(t, 'Hanbyol', PERSONA);
  assert.ok(!N.suggestions(store, ledger, t).some((x) => x.source === 'Hanbyol' && x.target === PERSONA));
});

test('facts, open threads and ledger names go through the same table', () => {
  const t = table();
  A.addAlias(t, NICK, FULL);
  const store = S.emptyStore();
  store.cast = [FULL];
  store.personas = [PERSONA];
  store.facts = [{ id: 'F1', about: NICK, text: '세바는 비를 싫어한다.' }];
  A.using(t, () => S.tidyKnowledge(store));
  assert.equal(store.facts[0].about, FULL);
  const ledger = L.emptyLedger();
  ledger.cast = [FULL];
  const batch = L.prepareMessages([{ id: 'm1', number: 1, role: 'assistant', speaker: FULL, content: '세바는 돌아오겠다고 약속했다.' }]);
  A.using(t, () => L.applyResult(ledger, { open: [{ kind: 'promise', title: '돌아오기', who: NICK, toward: PERSONA, detail: '돌아온다', evidence: [{ n: '1.1' }] }] }, batch));
  assert.equal(ledger.threads[0].who, FULL);
});

function sample() {
  const store = S.emptyStore();
  store.cast = [FULL];
  store.personas = [PERSONA];
  store.scenes.push({
    id: 'S1', start: 1, end: 2, title: '세바가 온 밤', summary: '세바가 한별에게 사과했다. 세바는 웃었고 세바스찬은 몰랐다.', present: [NICK, PERSONA],
    events: [{ text: '세바가 문을 열었다', quotes: [{ messageId: 'm1', number: 1, sentence: 1, text: '"Scusa, 세바."', by: NICK, to: PERSONA }, { messageId: 'm2', number: 2, sentence: 1, text: '"괜찮아."', by: PERSONA, to: NICK }] }],
    recollections: [{ who: NICK, text: '세바는 미안했다', remembers: 'full' }],
  });
  store.facts.push({ id: 'F1', about: NICK, text: '세바는 커피를 싫어한다.', edited: false });
  store.chapters.push({ id: 'C1', title: '세바의 귀가', summary: '세바와 한별이 화해한다.', turns: ['세바가 사과함'], keep: [], scenes: ['S1'] });
  const ledger = L.emptyLedger();
  ledger.threads.push({ id: 'T1', kind: 'promise', status: 'open', who: NICK, toward: PERSONA, title: '세바의 약속', detail: '세바가 돌아오기로 함', unaware: [] });
  ledger.routine = [
    { who: NICK, what: 'meal', text: '세바가 빵을 먹음', at: '2024-01-01T08:00', number: 1 },
    { who: FULL, what: 'meal', text: '빵', at: '2024-01-01T08:00', number: 1 },
    { who: FULL, what: 'meal', text: '점심', at: '2024-01-01T12:00', number: 2 },
  ];
  ledger.batches = [{ start: 0, nextId: 2, threads: structuredClone(ledger.threads), routine: structuredClone(ledger.routine) }];
  return { store, ledger };
}

test('rename preview counts each area, changes nothing, and apply writes names, text and particles', () => {
  const { store, ledger } = sample();
  const t = table();
  const before = JSON.stringify([store, ledger]);
  const p = A.using(t, () => N.plan(store, ledger, t, { source: NICK, target: FULL, display: '세바스' }));
  assert.equal(JSON.stringify([store, ledger]), before, 'a preview changes nothing');
  assert.deepEqual(p.counts, { quoteBy: 1, quoteTo: 1, events: 6, facts: 2, threads: 3, routine: 2, chapters: 3 });
  assert.ok(p.samples.length && p.samples.every((x) => x.before !== x.after));
  N.apply(store, ledger, t, p);
  const sc = store.scenes[0];
  assert.equal(sc.title, '세바스가 온 밤');
  assert.equal(sc.summary, '세바스가 한별에게 사과했다. 세바스는 웃었고 세바스찬은 몰랐다.', 'a longer word is not a name match');
  assert.deepEqual(sc.present, [FULL, PERSONA]);
  assert.equal(sc.events[0].quotes[0].by, FULL);
  assert.equal(sc.events[0].quotes[0].text, '"Scusa, 세바."', 'the story\'s own words are never rewritten');
  assert.equal(sc.events[0].quotes[1].to, FULL);
  assert.equal(sc.recollections[0].who, FULL);
  assert.equal(store.facts[0].about, FULL);
  assert.equal(store.facts[0].text, '세바스는 커피를 싫어한다.');
  assert.equal(store.chapters[0].summary, '세바스와 한별이 화해한다.', 'the particle fits the new name (와)');
  assert.equal(ledger.threads[0].who, FULL);
  assert.equal(ledger.batches[0].threads[0].who, FULL, 'the copy kept for rerolls goes along');
  // Recent life: the twin entry of the same meal is kept once, the others all stay, in story order.
  assert.deepEqual(ledger.routine.map((r) => [r.who, r.text]), [[FULL, '세바스가 빵을 먹음'], [FULL, '점심']]);
  // Marked as the user's own.
  assert.ok(sc.events[0].quotes.every((q) => q.manual));
  assert.equal(store.facts[0].edited, true);
  assert.equal(ledger.threads[0].edited, true);
  assert.equal(store.chapters[0].edited, true);
  assert.equal(A.canonOf(NICK, t), FULL);
  assert.equal(A.displayOf(FULL, t), '세바스');
});

test('renamed lines are left alone by the automatic dialogue check, and new memory text uses the chosen name', () => {
  const { store, ledger } = sample();
  const t = table();
  N.apply(store, ledger, t, A.using(t, () => N.plan(store, ledger, t, { source: NICK, target: FULL, display: '세바스' })));
  const msgs = L.prepareMessages([
    { id: 'm1', number: 1, role: 'assistant', speaker: FULL, content: '"Scusa, 세바."' },
    { id: 'm2', number: 2, role: 'user', speaker: PERSONA, content: '"괜찮아."' },
  ]);
  const candidates = A.using(t, () => S.attributionCandidates(store, msgs, 50, new Set(), { force: true }));
  assert.equal(candidates.length, 0, 'every renamed line is the user\'s now');
  const rules = A.using(t, () => S.enforceAttributionRules(store, msgs));
  assert.equal(store.scenes[0].events[0].quotes[0].by, FULL, `rules keep the hand-marked speaker (${JSON.stringify(rules)})`);
  // The model keeps calling him by the old nickname: what it writes next is written with the chosen name.
  const applied = { scenes: [{ id: 'S2', title: '세바의 아침', summary: '세바가 한별에게 커피를 건넸다.', present: [NICK], events: [{ text: '세바가 웃었다', quotes: [{ number: 3, sentence: 1, text: '"Buongiorno."', by: NICK, to: PERSONA }] }], recollections: [{ who: NICK, text: '세바는 기뻤다' }] }], facts: [{ id: 'F2', about: NICK, text: '세바는 아침형이다.' }], covered: [], later: [], learned: [] };
  A.using(t, () => S.commitScenes(store, applied));
  const s2 = store.scenes[1];
  assert.equal(s2.summary, '세바스가 한별에게 커피를 건넸다.');
  assert.deepEqual(s2.present, [FULL]);
  assert.equal(s2.events[0].quotes[0].by, FULL);
  assert.equal(s2.events[0].quotes[0].text, '"Buongiorno."');
  assert.equal(store.facts.at(-1).about, FULL);
});

test('undo puts back what the rename wrote, keeps later hand edits, and the history is bounded', () => {
  const { store, ledger } = sample();
  const original = structuredClone({ store, ledger });
  const t = table();
  N.apply(store, ledger, t, A.using(t, () => N.plan(store, ledger, t, { source: NICK, target: FULL, display: '세바스' })));
  store.facts[0].text = '직접 고친 문장.';
  const out = N.undo(store, ledger, t);
  assert.equal(out.kept, 1);
  assert.equal(store.facts[0].text, '직접 고친 문장.', 'a field edited after the rename stays as edited');
  store.facts[0].text = original.store.facts[0].text;
  assert.deepEqual(store, original.store);
  assert.deepEqual(ledger, original.ledger);
  assert.equal(A.canonOf(NICK, t), null, 'the alias goes too');
  assert.throws(() => N.undo(store, ledger, t), /되돌릴/);
  for (let i = 0; i < A.HISTORY_KEEP + 3; i++) {
    const from = i % 2 ? '세바스 M.' : NICK;
    const to = i % 2 ? NICK : '세바스 M.';
    const p = A.using(t, () => N.plan(store, ledger, t, { source: from, target: to }));
    if (p.changes.length) N.apply(store, ledger, t, p);
  }
  assert.ok(t.history.length <= A.HISTORY_KEEP);
});

test('a preview taken before the memory changed cannot be applied', () => {
  const { store, ledger } = sample();
  const t = table();
  const p = A.using(t, () => N.plan(store, ledger, t, { source: NICK, target: FULL }));
  ledger.threads[0].who = '다른 사람';
  assert.throws(() => N.apply(store, ledger, t, p), /미리 본 뒤에/);
});

test('names already one person by rule but stored apart are merged at once, in name fields only', () => {
  const t = table();
  A.addAlias(t, NICK, FULL);
  const store = S.emptyStore();
  store.cast = [FULL, '서재민'];
  store.personas = [PERSONA];
  const ledger = L.emptyLedger();
  ledger.routine = [
    { who: '재민이', what: 'sleep', text: '재민이 잠듦', at: '2024-01-01T23:00', number: 5 },
    { who: '서재민', what: 'sleep', text: '잠', at: '2024-01-01T01:00', number: 1 },
    { who: NICK, what: 'meal', text: '빵', at: '2024-01-01T08:00', number: 2 },
    { who: FULL, what: 'meal', text: '빵', at: '2024-01-01T08:00', number: 2 },
    { who: FULL, what: 'wake', text: '일어남', at: '2024-01-01T07:00', number: 2 },
  ];
  const groups = N.duplicates(store, ledger, t);
  assert.deepEqual(groups.map((g) => [g.target, g.variants.map((v) => v.name)]).sort(), [[FULL, [NICK]], ['서재민', ['재민이']]].sort());
  const items = groups.flatMap((g) => g.variants.map((v) => ({ source: v.name, target: g.target, text: false })));
  const p = A.using(t, () => N.planMany(store, ledger, t, items));
  assert.equal(p.counts.routine, 2);
  N.apply(store, ledger, t, p);
  assert.deepEqual(ledger.routine.map((r) => [r.who, r.what, r.at]), [
    ['서재민', 'sleep', '2024-01-01T01:00'], [FULL, 'wake', '2024-01-01T07:00'], [FULL, 'meal', '2024-01-01T08:00'], ['서재민', 'sleep', '2024-01-01T23:00'],
  ]);
  assert.equal(ledger.routine[3].text, '재민이 잠듦', 'running text is not touched by a duplicate merge');
  assert.equal(N.duplicates(store, ledger, t).length, 0);
  assert.equal(t.history.length, 1, 'one merge, one undo');
  N.undo(store, ledger, t);
  assert.equal(ledger.routine.length, 5);
});

test('Korean particles follow the new name; Latin names keep their boundaries', () => {
  const r = (text, from, to) => A.replaceName(text, from, to).text;
  assert.equal(r('도윤이 웃었다. 도윤은 도윤에게, 도윤과 도윤을 봤다. 도윤아! 도윤으로', '도윤', '하루'), '하루가 웃었다. 하루는 하루에게, 하루와 하루를 봤다. 하루야! 하루로');
  assert.equal(r('하루가 왔다. 하루는 하루를 하루와 봤다. 하루야! 하루로', '하루', '도윤'), '도윤이 왔다. 도윤은 도윤을 도윤과 봤다. 도윤아! 도윤으로');
  assert.equal(r('하루가게 앞의 하루미', '하루', '도윤'), '하루가게 앞의 하루미');
  assert.equal(A.replaceName('하루나와 하루나', '하루', '도윤', { protect: ['하루나'] }).text, '하루나와 하루나', 'a known longer name is another person');
  assert.equal(r('Kai met Kaito. Kai\'s cup.', 'Kai', 'Rowan'), 'Rowan met Kaito. Rowan\'s cup.');
  assert.equal(r('Kai met Kai Vale.', 'Kai', 'Kai Vale'), 'Kai Vale met Kai Vale.', 'never twice');
  assert.equal(r('세린이 말했다', '세린', '세린 벨로'), '세린 벨로가 말했다');
});
