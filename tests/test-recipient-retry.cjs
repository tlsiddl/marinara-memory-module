'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
test('retries old checked blanks and progresses across batches while preserving edited recipients', () => {
 const messages = L.prepareMessages(Array.from({length:45}, (_,i)=>({id:'m'+i,number:i+1,role:'assistant',content:'아르민이 세레나를 바라봤다.\n"Hello, sweetheart." (안녕, 여보.)'})));
 const quotes=messages.map(m=>({messageId:m.id,number:m.number,sentence:2,text:'"Hello, sweetheart." (안녕, 여보.)',by:'아르민',to:null,recipientChecked:true}));
 quotes[44].to='오웬';
 const store={scenes:[{present:['아르민','세레나','오웬'],events:[{quotes}]}],personas:['세레나']};
 const attempted=new Set(); let batches=0; let seen=0;
 for(;;){ const candidates=S.recipientCandidates(store,messages,20,attempted); if(!candidates.length)break; batches++;seen+=candidates.length;candidates.forEach(({q})=>attempted.add(q));
 const answers=candidates.map(({id},i)=>({id,to:i===0?null:'세레나',evidence:'세레나를 바라봤다'}));S.applyRecipientResults(candidates,answers); }
 assert.equal(batches,3);assert.equal(seen,44);assert.equal(quotes[44].to,'오웬');assert.equal(quotes.filter(q=>q.to==='세레나').length,41);
 const retry=S.recipientCandidates(store,messages);assert.equal(retry.length,3);assert.ok(retry.every(x=>x.q.to===null));
 assert.equal(S.applyRecipientResults(retry,[{id:'0',to:'세레나',evidence:'없는 근거'}]),0);
});
