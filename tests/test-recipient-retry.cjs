'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const S = require('../memory-module/lib/scenes.cjs');
test('retries old checked blanks and progresses across batches while preserving edited recipients', () => {
 const messages = L.prepareMessages(Array.from({length:45}, (_,i)=>({id:'m'+i,number:i+1,role:'assistant',content:'카시안이 이리나를 바라봤다.\n"Hello, sweetheart." (안녕, 여보.)'})));
 const quotes=messages.map(m=>({messageId:m.id,number:m.number,sentence:2,text:'"Hello, sweetheart." (안녕, 여보.)',by:'카시안',to:null,recipientChecked:true}));
 quotes[44].to='킬리안';
 const store={scenes:[{present:['카시안','이리나','킬리안'],events:[{quotes}]}],personas:['이리나']};
 const attempted=new Set(); let batches=0; let seen=0;
 for(;;){ const candidates=S.recipientCandidates(store,messages,20,attempted); if(!candidates.length)break; batches++;seen+=candidates.length;candidates.forEach(({q})=>attempted.add(q));
 const answers=candidates.map(({id},i)=>({id,to:i===0?null:'이리나',evidence:'이리나를 바라봤다'}));S.applyRecipientResults(candidates,answers); }
 assert.equal(batches,3);assert.equal(seen,44);assert.equal(quotes[44].to,'킬리안');assert.equal(quotes.filter(q=>q.to==='이리나').length,41);
 const retry=S.recipientCandidates(store,messages);assert.equal(retry.length,3);assert.ok(retry.every(x=>x.q.to===null));
 assert.equal(S.applyRecipientResults(retry,[{id:'0',to:'이리나',evidence:'없는 근거'}]),0);
});
