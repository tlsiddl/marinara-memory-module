// Usage: node tests/e2e-native-speakers.mjs <Marinara URL> <fake-model URL> <reply-file>
// Start tests/fake-llm.mjs with MEMORY_TEST_NATIVE_SPEAKERS=1. The fixture model emits
// native tags only when it receives the enhanced protocol. This tests wiring, not real-model compliance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const [base,llm,replyFile]=process.argv.slice(2);
const headers={'x-marinara-csrf':'1','content-type':'application/json'};
const marker='Native Marinara speaker-tag format';
async function api(method,url,body){const r=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw Error(`${method} ${url}: ${r.status} ${text.slice(0,300)}`);try{return JSON.parse(text);}catch{return text;}}
const source='"I love you, Ari."\n(사랑해, 아리.)\n\n"Shut up." (닥쳐.)';
fs.writeFileSync(replyFile,source);
const connection=await api('POST','/api/connections',{name:'native speaker protocol test',provider:'openai',baseUrl:llm+'/v1',apiKey:'test',model:'fake-model'});
const a=await api('POST','/api/characters',{data:{name:'하준',description:'.',extensions:{dialogueColor:'#ef4444'}}});
const b=await api('POST','/api/characters',{data:{name:'하루',description:'.',extensions:{dialogueColor:'#3b82f6'}}});
const chat=await api('POST','/api/chats',{name:'native speaker test',mode:'roleplay',characterIds:[a.id,b.id]});
await api('PATCH',`/api/chats/${chat.id}`,{connectionId:connection.id});
await api('PATCH',`/api/chats/${chat.id}/metadata`,{groupSpeakerColors:true,groupChatMode:'merged'});
const last=async()=>{const result=await api('GET',`/api/chats/${chat.id}/messages?limit=20`);const rows=Array.isArray(result)?result:result.messages||result.items;return rows.filter(x=>x.role==='assistant').at(-1);};
const send=body=>api('POST','/api/generate',{chatId:chat.id,streaming:true,...body});
const prompt=async()=>JSON.parse(await (await fetch(llm+'/__lastrp')).text());
const flat=p=>p.map(m=>typeof m.content==='string'?m.content:'').join('\n');
const strip=text=>text.replace(/<speaker="[^"]*">|<\/speaker>/g,'');
await send({userMessage:'따옴표만 쓰고 보이는 이름표는 넣지 마.'});
assert.equal((await last()).content,source);assert.ok(!flat(await prompt()).includes(marker));
console.log('ok 1: off leaves the native engine instruction untouched');
await api('POST',`/api/memory-module/chats/${chat.id}/speaker-tags`,{on:true});
const dry=await api('POST','/api/generate/dryRun',{chatId:chat.id,userMessage:'다음 대화',returnPrompt:true});
assert.ok(JSON.stringify(dry).includes(marker),'dry-run has the native protocol enhancement');
const stream=await send({userMessage:'따옴표만 쓰고 보이는 이름표는 넣지 마.'});
const live=flat(await prompt());
assert.equal(live.split(marker).length-1,1);assert.ok(live.includes('Canonical speaker names: ["하준","하루"]'));
assert.ok(live.includes('quote-only dialogue with no visible name prefix'));
let reply=await last();assert.match(reply.content,/<speaker="하준">"I love you, Ari\."/);assert.match(reply.content,/<speaker="하루">"Shut up\."/);assert.equal(strip(reply.content),source);assert.doesNotMatch(strip(reply.content),/하준|하루/);
// Tags originated at the fixture model. The memory post-processor never inferred a speaker.
assert.equal((await api('GET','/api/memory-module/status')).health.patches.speakerPrompt,'ok');
console.log('ok 2: real generation receives exact canonical names; model-originated native tags survive storage without visible labels');
const reroll=await send({regenerateMessageId:reply.id});assert.ok(!/"type"\s*:\s*"error"/.test(reroll));
assert.equal((await last()).id,reply.id);assert.equal(strip((await last()).content),source);assert.match((await last()).content,/<speaker="하루">/);
console.log('ok 3: reroll preserves native tag attribution and exact bilingual text');
const peek=await api('POST',`/api/chats/${chat.id}/peek-prompt`,{});assert.ok(JSON.stringify(peek).includes(marker));
await api('PATCH',`/api/chats/${chat.id}/metadata`,{groupSpeakerColors:false});await send({userMessage:'색상 끔'});assert.ok(!flat(await prompt()).includes(marker));assert.equal((await last()).content,source);
await api('PATCH',`/api/chats/${chat.id}/metadata`,{groupSpeakerColors:true});await api('POST',`/api/memory-module/chats/${chat.id}/speaker-tags`,{on:false});await send({userMessage:'보강 끔'});assert.ok(!flat(await prompt()).includes(marker));assert.equal((await last()).content,source);
console.log('ok 4: native color and per-room switches gate the enhancement; prompt preview retains exact sent instructions');
await api('POST',`/api/memory-module/chats/${chat.id}/speaker-tags`,{on:true});await send({userMessage:'화면 확인'});
const status=await api('GET','/api/memory-module/status');
fs.writeFileSync(replyFile+'.result.json',JSON.stringify({chatId:chat.id,version:status.version,health:status.health,lastReply:await last()},null,2));
console.log('all native speaker-protocol e2e checks passed');
