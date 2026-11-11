'use strict';
// OOC (talk outside the story): marked, left out of scenes, facts, quotes and notes; the plans decided there become
// 작가 계획 (an author's plan: a secret no character knows, labelled as such in the reply). (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-ooc-'));
process.env.DATA_DIR = dir;
const service = require('../memory-module/lib/service.cjs');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
const X = service._test;

const story = [
  { id: 'a1', number: 1, role: 'user', speaker: 'Mina', content: '미나는 부두에 앉아 바다를 봤다. "오늘은 조용하네."' },
  { id: 'a2', number: 2, role: 'assistant', speaker: 'Viktor', content: 'Viktor sat beside her. "It won\'t stay quiet."' },
  // An OOC direction: the reply to it is the story again.
  { id: 'a3', number: 3, role: 'user', speaker: 'Mina', content: 'OOC: 빅터가 한참 동안 말없이 있을 것' },
  { id: 'a4', number: 4, role: 'assistant', speaker: 'Viktor', content: 'Viktor said nothing for a long while. "Go home," he said at last.' },
  // An OOC talk: question, notes-like answers, short follow-ups with no dialogue.
  { id: 'a5', number: 5, role: 'user', speaker: 'Mina', content: '(OOC) 롤플 잠깐 멈추고, 빅터의 과거를 어떻게 풀면 좋을까?' },
  { id: 'a6', number: 6, role: 'assistant', speaker: 'Viktor', content: 'RP를 잠시 멈추고 정리해 볼게요.\n\n📌 **방향 1**\n\n- **등대지기의 딸**' },
  { id: 'a7', number: 7, role: 'user', speaker: 'Mina', content: '1번으로 하자. 빅터는 등대지기의 딸에게 빚이 있다는 걸로' },
  { id: 'a8', number: 8, role: 'assistant', speaker: 'Viktor', content: '좋아요!\n\n---\n\n### 📌 정리\n\n1. **빅터는 등대지기의 딸에게 갚지 못한 빚이 있음**' },
  // Back to the story.
  { id: 'a9', number: 9, role: 'user', speaker: 'Mina', content: '미나는 다시 부두로 걸어갔다. "아직 거기 있어?"' },
  { id: 'a10', number: 10, role: 'assistant', speaker: 'Viktor', content: 'He was. "Where else would I be," Viktor said.' },
];
const prepared = () => L.markOoc(L.prepareMessages(story.map((m) => ({ ...m }))));

test('marking: an OOC direction alone; an OOC talk with its answers and dialogue-free follow-ups; hand-set marks win', () => {
  assert.deepEqual(prepared().map((m) => !!m.ooc), [false, false, true, false, true, true, true, true, false, false]);
  assert.ok(L.OOC_START.test('Ooc. 그는 잠듦') && L.OOC_START.test('((잠깐 질문')  && L.OOC_START.test('[OOC] test') && !L.OOC_START.test('Oocyte was the word'));
  const set = L.markOoc(L.prepareMessages(story.map((m) => ({ ...m }))), { a4: true, a6: false });
  assert.equal(set[3].ooc, true, 'set by hand');
  assert.equal(set[5].ooc, undefined, 'set back to story by hand');
  assert.equal(set[6].ooc, undefined, 'the talk ended where the answer was story');
});

test('scenes: OOC talk is a number only (no sentences), and nothing in it can be quoted', () => {
  const slice = prepared();
  const prompt = S.buildScenePrompt({ ...S.emptyStore(), cast: ['Viktor'] }, slice, 10, null, {})[1].content;
  assert.match(prompt, /\[5\] Mina: \(OOC — 이야기 밖 대화라 생략/);
  assert.doesNotMatch(prompt, /등대지기/);
  assert.match(prompt, /\[4\.1\] Viktor said nothing/);
  const result = { scenes: [{ end: 10, time: 't', place: '부두', title: '부두', summary: 's', present: ['Viktor', 'Mina'],
    events: [{ text: '빅터가 미나를 기다렸다', quotes: [{ n: '8.4', by: 'Viktor' }, { n: '10.1' }] }], recollections: [],
    facts: [{ about: 'Viktor', text: 'Viktor owes the lighthouse keeper\'s daughter a debt.', evidence: ['7.1'] }] }] };
  const made = S.applyScenes({ ...S.emptyStore(), cast: ['Viktor'] }, result, slice, 10, undefined, { quoteMode: 'both' });
  const quotes = made.scenes[0].events.flatMap((e) => e.quotes);
  assert.ok(quotes.every((q) => q.number !== 8), 'no quote from OOC talk');
  assert.ok(!(made.store?.facts || made.facts || []).some?.((f) => /debt/.test(f.text)), 'no fact from OOC talk');
});

test('ledger: OOC talk is marked; a plan from it is an author\'s plan; nothing else rests on OOC talk', () => {
  const batch = prepared();
  const prompt = L.buildPrompt(L.emptyLedger(), batch)[1].content;
  assert.match(prompt, /\[5\] Mina \(OOC — 이야기 밖 대화\):/);
  assert.match(L.buildPrompt(L.emptyLedger(), batch)[0].content, /OOC\(이야기 밖 대화\)[^]*"plan":true/);
  const ledger = L.emptyLedger();
  const stats = L.applyResult(ledger, { open: [
    { kind: 'secret', plan: true, title: '빅터는 등대지기의 딸에게 빚이 있음', who: 'Viktor', detail: '아직 이야기에 안 나옴', unaware: [{ who: 'Mina', why: '모름' }], evidence: [{ n: '7.1', q: '빚이 있다는' }] },
    { kind: 'promise', title: '빅터가 침묵하기로 함', who: 'Viktor', evidence: [{ n: '3.1', q: '말없이' }] },
    { kind: 'promise', title: '미나가 부두로 돌아옴', who: 'Mina', evidence: [{ n: '9.1', q: '부두로 걸어갔다' }] },
  ] }, batch);
  assert.equal(stats.opened, 2);
  const plan = ledger.threads.find((t) => t.plan);
  assert.equal(plan.who, null);
  assert.deepEqual(plan.unaware, []);
  assert.ok(!ledger.threads.some((t) => /침묵/.test(t.title)), 'a promise resting on OOC talk alone is dropped');
  // Updates and closes resting on OOC talk alone are dropped too (a plan may be updated from it).
  const story = ledger.threads.find((t) => !t.plan);
  const r = L.applyResult(ledger, { update: [{ id: story.id, now: '바뀜', evidence: [{ n: '6.1', q: '정리해' }] }, { id: plan.id, now: '빚의 내용이 정해짐', evidence: [{ n: '8.1', q: '좋아요' }] }], close: [{ id: plan.id, how: '다 드러남', evidence: [{ n: '8.1', q: '좋아요' }] }] }, batch);
  assert.equal(r.updated, 1);
  assert.equal(plan.status, 'open', 'a plan is not closed by OOC talk');
  // The reply: labelled as the author's, unknown to the characters, and shown however old.
  // Plans have their own block, never among what the characters remember.
  assert.ok(!L.renderCompact({ ...ledger, lastNumber: 9999 }).includes('등대지기의 딸'));
  assert.doesNotMatch(L.render({ ...ledger, lastNumber: 9999 }), /등대지기의 딸/);
  assert.match(L.renderPlans({ ...ledger, lastNumber: 9999 }, { answers: true }), /^- 빅터는 등대지기의 딸에게 빚이 있음 — /);
  assert.equal(L.renderPlans({ ...ledger, lastNumber: 9999 }), '', 'no hidden line yet: not in the reply');
  assert.equal(plan.toward, null);
});

test('service: chat messages carry the marks; the library lists them and saves hand-set marks', async () => {
  const rows = story.map((m, i) => ({ id: m.id, rowid: i + 1, role: m.role, content: m.content, extra: m.role === 'user' ? JSON.stringify({ personaSnapshot: { name: 'Mina' } }) : '{}' }));
  X.setEngine({ chats: { async listMessages() { return rows; }, async getById(id) { return { id, metadata: {} }; } }, characters: { async getById() { return { data: JSON.stringify({ name: 'Viktor' }) }; } }, connections: { async list() { return []; } } });
  const msgs = await service.chatMessages('ooc1');
  assert.deepEqual(msgs.filter((m) => m.ooc).map((m) => m.id), ['a3', 'a5', 'a6', 'a7', 'a8']);
  const handlers = {};
  const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
  service.attach(app);
  const reply = { status() { return { send(x) { return x; } }; } };
  const list = await handlers['GET /chats/:id/ooc']({ params: { id: 'ooc1' } }, reply);
  assert.equal(list.items.length, 5);
  assert.ok(list.items.every((m) => m.auto && m.set === null));
  const after = await handlers['POST /chats/:id/ooc']({ params: { id: 'ooc1' }, body: { number: 3, ooc: false } }, reply);
  const a3 = after.items.find((m) => m.id === 'a3');
  assert.equal(a3.ooc, false);
  assert.equal(a3.set, false);
  assert.equal((await service.chatMessages('ooc1')).find((m) => m.id === 'a3').ooc, undefined, 'the hand-set mark is used');
  await handlers['POST /chats/:id/ooc']({ params: { id: 'ooc1' }, body: { id: 'a3', ooc: null } }, reply);
  assert.equal(X.settings().chats.ooc1?.ooc, undefined, 'back to automatic');
});

test('library: 작가 계획 has its own group and pill; the OOC list loads on demand and can set marks', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const start = source.indexOf('  function oocPaper(');
  const paper = (list) => vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc, room: 'r', oocRoom: list ? 'r' : '', oocList: list, openLists: new Set() })();
  assert.match(paper(null), /data-act="oocLoad"/);
  const html = paper({ items: [{ id: 'a5', number: 5, role: 'user', preview: '(OOC) 질문', ooc: true, auto: true, set: null }, { id: 'a4', number: 4, role: 'assistant', preview: 'story', ooc: false, auto: false, set: false }] });
  assert.match(html, /#5<\/b> 사용자 · OOC로 봄/);
  assert.match(html, /data-ooc="false">이야기로 보기/);
  assert.match(html, /이야기로 봄 \(직접 정함\)[^]*자동으로 되돌리기/);
  assert.match(html, /data-act="oocMark"/);
  assert.ok(source.includes("${t.plan ? '작가 계획' : KIND[t.kind] || t.kind}"));
  assert.ok(source.includes('<h2>작가 계획 · ${plans.length}</h2>'));
});

test('threads opened from OOC talk alone (before OOC was marked): a secret becomes a plan, the rest are closed', () => {
  const batch = prepared();
  const ledger = L.emptyLedger();
  // Opened as if OOC were not marked yet.
  const plain = batch.map((m) => { const { ooc, ...rest } = m; return rest; });
  L.applyResult(ledger, { open: [
    { kind: 'secret', title: '빅터의 빚', who: 'Viktor', unaware: [{ who: 'Mina', why: '모름' }], evidence: [{ n: '7.1', q: '빚이 있다는' }] },
    { kind: 'pending', title: '빅터의 과거 정하기', who: 'Mina', evidence: [{ n: '5.1', q: '과거를' }] },
    { kind: 'promise', title: '미나가 부두로 돌아옴', who: 'Mina', evidence: [{ n: '9.1', q: '부두로 걸어갔다' }] },
  ] }, plain);
  assert.equal(ledger.threads.length, 3);
  const r = L.tidyOocThreads(ledger, batch);
  assert.deepEqual(r, { planned: 1, closed: 1 });
  const [secret, pending, story] = ledger.threads;
  assert.equal(secret.plan, true);
  assert.equal(secret.who, null);
  assert.deepEqual(secret.unaware, []);
  assert.equal(pending.status, 'closed');
  assert.match(pending.closed.how, /OOC/);
  assert.equal(story.status, 'open', 'a thread from the story stays');
  assert.deepEqual(L.tidyOocThreads(ledger, batch), { planned: 0, closed: 0 }, 'nothing twice');
});

test('a plan keeps a hidden line with no answer; old plans get one from one call; the room may turn answers on', async () => {
  // The ledger call is asked for it, and it is kept.
  assert.match(L.buildPrompt(L.emptyLedger(), prepared())[0].content, /"mystery"[^]*답 없이 한 줄로/);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { open: [{ kind: 'secret', plan: true, title: '빅터는 등대지기의 딸에게 빚이 있음', mystery: '빅터가 등대에 자꾸 가는 이유', evidence: [{ n: '7.1', q: '빚이 있다는' }] }] }, prepared());
  assert.equal(ledger.threads[0].mystery, '빅터가 등대에 자꾸 가는 이유');
  assert.equal(L.renderPlans(ledger), '- 빅터가 등대에 자꾸 가는 이유');
  // An old plan: the call writes its hidden line; a line for another thread or an empty one is not taken.
  const old = L.emptyLedger();
  old.threads.push({ id: 'T9', kind: 'secret', plan: true, status: 'open', title: '세라의 흉터는 화재 때 생김', detail: '', evidence: [], clues: [] });
  const [system, user] = L.buildPlanMysteryPrompt(old.threads);
  assert.match(system.content, /Never put the answer in it/);
  assert.equal(JSON.parse(user.content).plans[0].id, 'T9');
  assert.equal(L.applyPlanMysteries(old, { items: [{ id: 'T9', mystery: '세라의 손목 흉터가 생긴 진짜 이유' }, { id: 'T1', mystery: 'x' }, { id: 'T9', mystery: '' }] }), 1);
  assert.equal(old.threads[0].mystery, '세라의 손목 흉터가 생긴 진짜 이유');
  // The switch.
  const handlers = {};
  const app = { register(fn) { fn(app); }, addHook() {}, get(p, f) { handlers['GET ' + p] = f; }, post(p, f) { handlers['POST ' + p] = f; }, patch(p, f) { handlers['PATCH ' + p] = f; }, delete(p, f) { handlers['DELETE ' + p] = f; } };
  service.attach(app);
  const reply = { status() { return { send(x) { return x; } }; } };
  assert.deepEqual(await handlers['POST /chats/:id/plan-answers']({ params: { id: 'pa1' }, body: { on: true } }, reply), { planAnswers: true });
  assert.equal(X.planAnswersOn('pa1'), true);
  assert.deepEqual(await handlers['POST /chats/:id/plan-answers']({ params: { id: 'pa1' }, body: { on: false } }, reply), { planAnswers: false });
  // The library: the switch and the hidden line in the plan's edit form.
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8');
  assert.ok(source.includes('data-act=\\"planAnswers\\"') || source.includes('data-act="planAnswers"'));
  assert.ok(source.includes("data-f=\\\"mystery\\\"") || source.includes('data-f="mystery"') || source.includes('data-f=\\"mystery\\"'));
  assert.ok(source.includes("for (const f of ['title', 'who', 'toward', 'detail', 'latest', 'need', 'mystery',"));
});
