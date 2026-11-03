'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mm-fold-'));process.env.DATA_DIR=dir;
const L=require('../memory-module/lib/ledger.cjs'), S=require('../memory-module/lib/scenes.cjs'), T=require('../memory-module/lib/service.cjs')._test;
test('missing early scene coverage retries shorter exchanges and never covers omitted messages',async()=>{
 const messages=L.prepareMessages(Array.from({length:23},(_,i)=>({id:`m${i}`,number:i+1,role:i%2?'user':'assistant',speaker:i%2?'손님':'민',content:`${i+1}번째 사람이 문을 지나 이야기를 나눴다. `.repeat(12)})));
 const sizes=[]; const model={provider:{async chatComplete(prompt){
  const input=prompt[1].content;const ns=[...input.matchAll(/^\[(\d+)\] /gm)].map(x=>Number(x[1]));sizes.push(ns.length);
  const chosen=ns.length>3 ? [ns[0]] : ns;
  return {content:JSON.stringify({scenes:[{end:ns.at(-1),title:'대화',events:chosen.map(n=>({text:`${n}번 이야기`,quotes:[{n:`${n}.1`}]}))}]})};
 }}};
 const store=S.emptyStore();const calls=await T.foldScenes('fold-retry',store,messages,8,model,{cancel:false},{minPending:1});
 assert.ok(calls>2);assert.ok(sizes.some(n=>n>3));assert.ok(sizes.some(n=>n<=3));
 assert.ok(store.covered.length>=15);assert.equal(store.covered.length,new Set(store.covered.map(x=>x.id)).size);
 for(const scene of store.scenes) for(const m of messages.filter(m=>m.number>=scene.start&&m.number<=scene.end)) assert.ok(scene.events.some(e=>e.quotes.some(q=>q.number===m.number)),`missing ${m.number}`);
});

test('persistent omission stops without falsely advancing coverage',async()=>{
 const messages=L.prepareMessages(Array.from({length:10},(_,i)=>({id:`p${i}`,number:i+1,role:'assistant',speaker:'민',content:`${i+1}번째 긴 이야기가 이어졌다. `.repeat(12)})));
 const model={provider:{async chatComplete(prompt){const ns=[...prompt[1].content.matchAll(/^\[(\d+)\] /gm)].map(x=>Number(x[1]));return {content:JSON.stringify({scenes:[{end:ns.at(-1),title:'누락',events:[{text:'관계없는 내용',quotes:[]}]}]})};}}};
 const store=S.emptyStore();await assert.rejects(T.foldScenes('fold-fail',store,messages,8,model,{cancel:false},{minPending:1}),/메시지의 사건과 원문 인용이 빠졌습니다/);
 assert.equal(store.covered.length,0);
});
