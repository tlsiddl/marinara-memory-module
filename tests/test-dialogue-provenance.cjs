'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

const expectedChat = [
  ['서아', '오늘 저녁 같이 먹자'],
  ['하준', '좋아, 마침 배고팠어.'],
  ['하준', '근데 어쩌지? 한번 맛집을 찾기 시작하면 저녁 한 끼로는 안 끝날 것 같은데.'],
  ['하준', '지금 회의 끝나고 사무실인데, 어디로 데리러 가면 돼?'],
];
const scene = (end, events) => ({ end, title: '저녁 약속', summary: '만날 곳을 정한다.', events, facts: [], recollections: [] });

test('the full original chat-app HTML preserves all four bubbles through memory storage', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/chat-app.html'), 'utf8');
  const messages = L.prepareMessages([
    { id: 'chat-user', number: 1, role: 'user', speaker: '서아', content: '대화를 시작했다.' },
    { id: 'chat-chat', number: 2, role: 'assistant', speaker: 'Narrator', content: html },
  ]);
  const message = messages[1];
  assert.equal(message.content, L.htmlToText(html, { user: '서아' }), 'the plain-text API stays unchanged');
  assert.equal(message.h, L.hashText(html), 'existing edit fingerprints stay unchanged');
  const quotes = expectedChat.map(([by, text]) => {
    const i = message.sentences.indexOf(`${by} | ${text}`);
    assert.ok(i >= 0, `whole speech bubble missing: ${text}`);
    return { n: `2.${i + 1}`, q: text, by, to: by === '서아' ? '하준' : '서아' };
  });
  const result = S.applyScenes(S.emptyStore(), { scenes: [scene(2, [{ text: '서아의 요청에 하준이 응답하며 픽업 장소를 물었다.', quotes }])] }, messages, 2);
  assert.ok(!result.error, result.error);
  const saved = result.scenes[0].events[0].quotes;
  assert.deepEqual(saved.map((q) => [q.by, q.text]), expectedChat);
  assert.deepEqual(saved.map((q) => q.to), ['하준', '서아', '서아', '서아']);
  assert.ok(saved.every((q) => q.messageId === 'chat-chat'));
  assert.doesNotMatch(S.renderExpanded(result.scenes[0], 0), /\(서술\) 한번 맛집을/);
});

test('line breaks inside one HTML speech block remain one source, without carrying its speaker into narration', () => {
  const html = '<div><span class="char-name">Dan</span><div class="msg">Why now?<br>Come back. Please.</div></div><p>문이 닫혔다. 비가 내렸다.</p>';
  const [m] = L.prepareMessages([{ id: 'lines', number: 1, role: 'assistant', speaker: 'Narrator', content: html }]);
  assert.deepEqual(m.sentences, ['Dan | Why now?\nCome back. Please.', '문이 닫혔다.', '비가 내렸다.']);
  const r = S.applyScenes(S.emptyStore(), { scenes: [scene(1, [{ text: 'Dan이 돌아와 달라고 부탁했다.', quotes: [{ n: '1.1', q: 'Come back' }] }])] }, [m], 1);
  assert.equal(r.scenes[0].events[0].quotes[0].by, 'Dan');
  assert.equal(r.scenes[0].events[0].quotes[0].text, 'Why now? Come back. Please.');
});

test('repeated bubbles and encoded punctuation keep separate source IDs and exact decoded wording', () => {
  const html = '<div><b>Dan</b><div class="msg">A &amp; B. Still here?</div><div class="msg">A &amp; B. Still here?</div><div class="msg">&amp;lt; stays literal. Yes.</div></div>';
  const [m] = L.prepareMessages([{ id: 'repeat', number: 1, role: 'assistant', speaker: 'Narrator', content: html }]);
  assert.deepEqual(m.sentences, ['Dan | A & B. Still here?', 'Dan | A & B. Still here?', 'Dan | &lt; stays literal. Yes.']);
  const r = S.applyScenes(S.emptyStore(), { scenes: [scene(1, [{ text: 'Dan이 확인했다.', quotes: [1, 2, 3].map((n) => ({ n: `1.${n}` })) }])] }, [m], 1);
  assert.deepEqual(r.scenes[0].events[0].quotes.map((q) => q.sentence), [1, 2, 3]);
});

test('plain prose and existing speaker-tagged messages retain their sentence numbering and fingerprints', () => {
  for (const content of ['하준 | 근데 어쩌지? 다음에 보자.\n서아는 고개를 끄덕였다.', '<speaker="Dan">Dan | "Why? Come back."</speaker> 문이 닫혔다.']) {
    const [m] = L.prepareMessages([{ id: 'plain', number: 1, role: 'assistant', content }]);
    assert.equal(m.content, content);
    assert.deepEqual(m.sentences, L.segment(content));
    assert.equal(m.h, L.hashText(content));
  }
});

test('a unique speaker name is insufficient to attach an unrelated line to a thermometer event', () => {
  const events = [{ text: '학비 지원 합의', quotes: [] }, { text: '하준이 체온계를 건넴', quotes: [] }];
  const quote = { by: '하준', text: "\"I'll cover it.\"", number: 4, sentence: 1 };
  assert.equal(S.linkQuote({ events }, quote), null);
  assert.equal(S.linkQuote({ events }, { ...quote, by: null }, () => '하준'), null);
  assert.equal(S.linkQuote({ events }, { ...quote, text: '하준' }), null, 'matching the name alone is not topic evidence');
});

test('equal content matches stay unlinked until a unique event can be identified', () => {
  const quote = { by: '하준', text: '"내일 도서관에서 보자."', number: 4, sentence: 1 };
  const event = () => ({ text: '하준이 내일 도서관에서 보자고 말했다.', quotes: [] });
  const s = { events: [event(), event()], loose: [quote] };
  assert.equal(S.relinkLoose(s), 0);
  assert.deepEqual(s.loose, [quote]);
  s.events.pop();
  assert.equal(S.relinkLoose(s), 1);
  assert.equal(s.loose, undefined);
  assert.deepEqual(s.events[0].quotes, [quote]);
});

test('wrong-scene money dialogue stays intact and visible as unlinked, including after manual event edits', () => {
  const messages = L.prepareMessages([
    { id: 'a', number: 1, role: 'user', speaker: '서아', content: '"길이 맞아?"' },
    { id: 'b', number: 2, role: 'assistant', speaker: '하준', content: '"맞아."' },
    { id: 'c', number: 3, role: 'user', speaker: '서아', content: '"학비는 어떻게 해?"' },
    { id: 'd', number: 4, role: 'assistant', speaker: '하준', content: '하준 | "I\'ll cover it."\n하준이 체온계를 건넸다.' },
  ]);
  const result = S.applyScenes(S.emptyStore(), { scenes: [
    scene(2, [{ text: '길 확인', quotes: [{ n: '1.1' }, { n: '4.1', by: '하준', to: '서아' }] }]),
    scene(4, [{ text: '학비 지원 합의', quotes: [{ n: '3.1' }] }, { text: '하준이 체온계를 건넴', quotes: [] }]),
  ] }, messages, 4);
  assert.ok(!result.error, result.error);
  const s = result.scenes[1];
  assert.deepEqual(s.loose.map((q) => [q.by, q.to, q.text, q.messageId]), [['하준', '서아', '"I\'ll cover it."', 'd']]);
  assert.ok(!s.events.some((e) => e.quotes.some((q) => q.text === '"I\'ll cover it."')));
  assert.match(S.renderExpanded(s, 1), /연결 미확정 대사[^\n]*\n\s+하준 → 서아: "I'll cover it\."/);
  assert.equal(S.relinkLoose(s), 0);
  assert.equal(s.loose.length, 1);
});

test('a short form of the speaker\'s name, or the listener\'s name, is not topic evidence either', () => {
  const events = [{ text: '학비 지원 합의', quotes: [] }, { text: '재민이 서아에게 체온계를 건넴', quotes: [] }];
  assert.equal(S.linkQuote({ events }, { by: '서재민', to: '서아', text: '"재민 오빠가 서아 몫까지 낼게."', number: 4, sentence: 1 }), null);
});

test('a bubble kept whole stays on one numbered line in the prompt', () => {
  const html = '<div><span class="char-name">Dan</span><div class="msg">Why now?<br>Come back.</div></div>';
  const [m] = L.prepareMessages([{ id: 'p1', number: 1, role: 'assistant', speaker: 'Dan', content: html }]);
  const prompt = L.buildPrompt(L.emptyLedger(), [m]).map((x) => x.content ?? x).join('\n');
  assert.match(prompt, /\[1\.1\] Dan \| Why now\? \/ Come back\./);
});
