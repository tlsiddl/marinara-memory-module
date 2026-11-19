'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');
const port=Number(process.argv[2]);if(![49151,49152].includes(port))throw Error('port denied');const base='http://127.0.0.1:'+port;
async function req(method,path,body,headers={}){let r=await fetch(base+path,{method,headers:{'x-marinara-csrf':'1',...(body instanceof FormData?{}:{'content-type':'application/json'}),...headers},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});let t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t};return {status:r.status,body:j,timing:r.headers.get('server-timing')};}
async function ok(m,p,b){let r=await req(m,p,b);assert.equal(r.status,200,JSON.stringify(r));return r.body}
(async()=>{
const ids=[];for(let i=0;i<2;i++){const form=new FormData();form.append('file',new Blob([fs.readFileSync('tests/fixtures/edit-during-read.jsonl')]),'fake.jsonl');let x=await ok('POST','/api/import/st-chat',form);ids.push(x.chatId||x.id||x.chat?.id)}
const [a,b]=ids;assert(a&&b&&a!==b);let url=id=>'/api/memory-module/chats/'+id;
let off=await req('GET',url(a)+'/trackers');assert.equal(off.status,400);assert(off.body.error);assert(off.timing?.includes('total;dur='));
await ok('POST',url(a)+'/feature-mode',{key:'trackers',mode:'on'});
let view=await ok('GET',url(a)+'/trackers');assert.deepEqual(view.items,[]);
let created=await ok('POST',url(a)+'/trackers',{action:'add',item:{type:'count',label:'가상 기록',scope:'room',clock:'story',count:{start:'2025-03-02',firstDay:1}}});let id=created.items[0].id;assert(id);
let world=await ok('GET',url(a)+'/world');assert.equal(world.trackers.items[0].id,id);
let invalid=await req('POST',url(a)+'/trackers',{action:'invalid'});assert.equal(invalid.status,400);assert.equal(typeof invalid.body.error,'string');assert(invalid.timing?.includes('total;dur='));
let foreign=await req('POST',url(a)+'/trackers',{action:'delete',id},{origin:'https://untrusted.example','sec-fetch-site':'cross-site'});assert.equal(foreign.status,403);assert.equal((await ok('GET',url(a)+'/trackers')).items.length,1);
assert.equal((await req('GET',url(b)+'/trackers')).status,400);await ok('POST',url(b)+'/feature-mode',{key:'trackers',mode:'on'});assert.equal((await ok('GET',url(b)+'/trackers')).items.length,0);
await ok('POST',url(a)+'/feature-mode',{key:'trackers',mode:'off'});assert.equal((await req('GET',url(a)+'/trackers')).status,400);await ok('POST',url(a)+'/feature-mode',{key:'trackers',mode:'on'});assert.equal((await ok('GET',url(a)+'/trackers')).items[0].id,id);
await ok('POST',url(a)+'/trackers',{action:'delete',id});assert.equal((await ok('GET',url(a)+'/trackers')).items.length,0);
let fake=await fetch('http://127.0.0.1:49153/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'fake-model',messages:[{role:'user',content:'테스트'}]})});assert.equal(fake.status,200);assert((await fake.json()).choices.length);
console.log(JSON.stringify({port,pass:true,checks:'real imported test chats; tracker on/off preservation, rooms, world, add/delete, errors, timing, untrusted-origin CSRF, fake LLM direct'}));
})().catch(e=>{console.error(e);process.exitCode=1});
