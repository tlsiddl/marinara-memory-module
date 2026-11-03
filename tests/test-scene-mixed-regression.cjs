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
  assert.equal(result.scenes[0].events[0].quotes.length,12);
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

test('a cluster of misplaced lines requests a retry, then remains safe in a partial fallback', () => {
  const batch=L.prepareMessages([
    {id:'u',number:1,speaker:'손님',role:'user',content:'"이름은 별입니다."'},
    {id:'a',number:2,speaker:'민',role:'assistant',content:'"어디에서 왔나요?" "이름이 독특하네요."'},
    {id:'u2',number:3,speaker:'손님',role:'user',content:'"멀리서 왔어요."'},
    {id:'a2',number:4,speaker:'민',role:'assistant',content:'"그렇군요."'},
  ]);
  const input={scenes:[
    {end:2,title:'소개',events:[{text:'손님이 이름을 말함',quotes:[{n:'1.1'}]}]},
    {end:4,title:'다음',events:[{text:'민이 별에게 출신과 이름에 관해 묻는다',quotes:[{n:'2.1'},{n:'2.2'}]},{text:'대답을 듣는다',quotes:[{n:'3.1'}]}]},
  ]};
  assert.match(S.applyScenes(S.emptyStore(),input,batch,4).error,/새 사건/);
  const fallback=S.applyScenes(S.emptyStore(),input,batch,4,undefined,{partial:true});
  assert.ok(!fallback.error, fallback.error);
  assert.deepEqual(fallback.scenes[0].loose.map(q=>q.sentence),[1,2]);
});
