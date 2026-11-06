'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');

const messages = L.prepareMessages([
  {id:'a', number:1, speaker:'민', content:'민이 차가운 얼음을 손님의 뺨에 대었다. 민 | "Please sit here." (여기 앉으세요.)'},
  {id:'b', number:2, speaker:'손님', role:'user', content:'"무슨 뜻이지?" 손님이 의자에 앉았다.'},
  {id:'c', number:3, speaker:'민', content:'민 | "What is your name?" (이름이 뭐예요?)'},
]);

test('mixed mode keeps original narration with dialogue in source order', () => {
  const result = S.applyScenes(S.emptyStore(), {scenes:[{end:3,title:'방문',events:[{text:'민이 차가운 얼음을 손님의 뺨에 대었다',quotes:[{n:'1.2'}]},{text:'이름을 묻는다',quotes:[{n:'3.1'}]}]}]}, messages, 3, undefined, {quoteMode:'both'});
  assert.ok(!result.error, result.error);
  const quotes = result.scenes[0].events[0].quotes;
  assert.ok(quotes.some(q => q.text.includes('얼음을') && q.by === null));
  assert.ok(quotes.some(q => q.text.includes('Please sit')));
  assert.deepEqual(quotes.map(q=>q.sentence), [...quotes.map(q=>q.sentence)].sort((a,b)=>a-b));
});

test('a wrong phrase cannot turn an unrelated numbered line into evidence', () => {
  const result = S.applyScenes(S.emptyStore(), {scenes:[{end:3,title:'방문',events:[{text:'완전히 다른 주문을 받았다',quotes:[{n:'3.1',q:'존재하지 않는 구절'}]}]}]}, messages, 3, undefined, {quoteMode:'both'});
  assert.ok(!result.error, result.error);
  assert.deepEqual(result.scenes[0].events[0].quotes, []);
});

test('uncertain cross-scene dialogue remains loose and is not attached by speaker alone', () => {
  const result = S.applyScenes(S.emptyStore(), {scenes:[{end:1,title:'첫 장면',events:[{text:'차가운 얼음을 뺨에 댄다',quotes:[{n:'3.1'}]}]},{end:3,title:'다음 장면',events:[{text:'손님이 의자에 앉았다',quotes:[{n:'2.2'}]}]}]}, messages, 3, undefined, {quoteMode:'both'});
  assert.ok(!result.error, result.error);
  assert.ok(result.scenes[1].loose?.some(q=>q.text.includes('What is your name')));
});

test('prompts distinguish a completed invitation from continuing conditions and preserve chronology', () => {
  const prompt = S.buildScenePrompt(S.emptyStore(),messages,3,null,{quoteMode:'both'})[0].content;
  assert.match(prompt,/별도 사건/); assert.match(prompt,/서술/); assert.match(prompt,/시각/);
  const ledgerPrompt = L.buildPrompt(L.emptyLedger(),messages)[0].content;
  assert.match(ledgerPrompt,/합석했다면/); assert.match(ledgerPrompt,/도착만으로 닫지 마/);
});

test('mixed quote cap retains a later narrative citation', () => {
  const lines = Array.from({length:12},(_,i)=>`"Line number ${i} speaks."`).join(' ') + ' 손님이 차가운 창문을 양손으로 만졌다.';
  const batch = L.prepareMessages([{id:'cap',number:1,speaker:'민',content:lines}]);
  const pointers = batch[0].sentences.map((_,i)=>({n:`1.${i+1}`}));
  const result = S.applyScenes(S.emptyStore(),{scenes:[{end:1,title:'창문',events:[{text:'손님이 차가운 창문을 양손으로 만졌다',quotes:pointers}]}]},batch,1,undefined,{quoteMode:'both'});
  assert.ok(!result.error, result.error);
  assert.equal(result.scenes[0].events[0].quotes.length,8);
  assert.ok(result.scenes[0].events[0].quotes.some(q=>q.text.includes('창문을 양손으로')));
});

test('evidenced completion closes the invitation while an ongoing condition stays open', () => {
  const ledger=L.emptyLedger();
  const source=L.prepareMessages([{id:'open',number:1,speaker:'민',content:'"여기에 앉으세요." "머무는 동안 언제든 떠나도 됩니다."'}]);
  L.applyResult(ledger,{open:[{kind:'promise',title:'초대',evidence:[{n:'1.1'}]},{kind:'promise',title:'체류 조건',evidence:[{n:'1.2'}]}]},source);
  const next=L.prepareMessages([{id:'done',number:2,speaker:'손님',content:'손님이 초대를 받아들여 의자에 앉았다.'}]);
  L.applyResult(ledger,{close:[{id:'T1',how:'초대를 수락하고 앉았다',evidence:[{n:'2.1'}]}]},next);
  assert.equal(ledger.threads[0].status,'closed');
  assert.equal(ledger.threads[1].status,'open');
});

test('long backlogs are bounded without splitting a user message and reply', () => {
  const batch=L.prepareMessages(Array.from({length:16},(_,i)=>({id:`m${i}`,number:i+1,role:i%2 ? 'user' : 'assistant',speaker:i%2?'손님':'민',content:`사건 ${i+1}이 일어났다.`})));
  const next=S.nextSlice(S.emptyStore(),batch,0,{lead:0,minVisible:0,maxMessages:8});
  assert.equal(next.slice.length,9);
  assert.equal(next.slice.at(-1).role,'assistant');
  assert.ok(next.required <= next.slice.at(-1).number);
});

test('untagged speakers can be inferred from source context, and unsupported recipients stay blank', () => {
  const batch=L.prepareMessages([{id:'m',number:1,role:'assistant',speaker:'주인공',content:'지훈은 맞은편을 바라보며 말을 꺼냈다. "그 얘기 정말이야?" 민수가 지훈에게 고개를 돌렸다. "나도 그렇게 들었어."'}]);
  const quotes=batch[0].sentences;
  const first=quotes.findIndex(x=>x.includes('그 얘기 정말이야'))+1;
  const second=quotes.findIndex(x=>x.includes('나도 그렇게'))+1;
  const input={scenes:[{end:1,title:'대화',events:[{text:'두 사람이 대화한다',quotes:[
    {n:`1.${first}`,by:'지훈',byEvidence:'지훈은 맞은편을 바라보며',to:'주인공'},
    {n:`1.${second}`,by:'민수',byEvidence:'민수가 지훈에게 고개를 돌렸다',to:'지훈',toEvidence:'민수가 지훈에게 고개를 돌렸다'},
  ]}]}]};
  const result=S.applyScenes(S.emptyStore(),input,batch,1,undefined,{verifyAttribution:true});
  assert.ok(!result.error,result.error);
  assert.deepEqual(result.scenes[0].events[0].quotes.map(q=>[q.by,q.to]),[['지훈',null],['민수','지훈']]);
});

test('a substantial message without an event quote triggers retry and cannot silently pass partial fallback', () => {
  const batch=L.prepareMessages([{id:'a',number:1,role:'assistant',speaker:'민',content:'"먼저 앉으세요."'}, {id:'b',number:2,role:'assistant',speaker:'민',content:'긴 서술이 이어진다. '.repeat(12)+'민이 이름을 듣고 질문을 이어갔다.'}]);
  const input={scenes:[{end:2,title:'대화',events:[{text:'민이 앉으라고 한다',quotes:[{n:'1.1'}]}]}]};
  const strict=S.applyScenes(S.emptyStore(),input,batch,2,undefined,{strictCoverage:true});
  assert.match(strict.error,/2번 메시지/);
  assert.match(S.applyScenes(S.emptyStore(),input,batch,2,undefined,{strictCoverage:true,partial:true}).error,/2번 메시지/);
});

test('strict ledger close requires a matching source phrase and rejects an ongoing condition', () => {
  const ledger=L.emptyLedger();
  const start=L.prepareMessages([{id:'s',number:1,speaker:'민',content:'"머무는 동안은 언제든 떠나도 돼."'}]);
  L.applyResult(ledger,{open:[{kind:'promise',title:'체류 조건',evidence:[{n:'1.1'}]}]},start);
  const later=L.prepareMessages([{id:'t',number:2,speaker:'손님',content:'손님이 저택에 도착했다.'}]);
  const stats=L.applyResult(ledger,{close:[{id:'T1',how:'조건이 완료됐다',evidence:[{n:'2.1',q:'조건이 끝났다'}]}]},later,undefined,{strictCloseEvidence:true});
  assert.equal(stats.closed,0); assert.equal(ledger.threads[0].status,'open');
});

test('strict tidy does not close an ongoing promise based only on a model explanation', () => {
  const ledger=L.emptyLedger();
  const start=L.prepareMessages([{id:'s',number:1,speaker:'민',content:'"머무는 동안 언제든 떠나도 돼."'}]);
  L.applyResult(ledger,{open:[{kind:'promise',title:'체류 조건',evidence:[{n:'1.1'}]}]},start);
  const stats=L.applyTidy(ledger,{close:[{id:'T1',why:'done',how:'도착해서 완료됨'}]},undefined,{strictCloseEvidence:true});
  assert.equal(stats.closed,0); assert.equal(ledger.threads[0].status,'open');
});

test('detail levels keep standard unchanged and request progressively more detail', () => {
  const standard=S.buildScenePrompt(S.emptyStore(),messages,3,null,{detailLevel:'standard'})[0].content;
  const detailed=S.buildScenePrompt(S.emptyStore(),messages,3,null,{detailLevel:'detailed'})[0].content;
  const very=S.buildScenePrompt(S.emptyStore(),messages,3,null,{detailLevel:'very_detailed'})[0].content;
  assert.doesNotMatch(standard,/장면을 아주 자세히 기록해/);
  assert.match(detailed,/행동, 반응, 대화의 맥락/);
  assert.match(very,/장면을 아주 자세히 기록해/);
});
