const assert = require('node:assert/strict');
const S = require('../memory-module/lib/scenes.cjs');
const q={number:1,sentence:1,text:'"안녕하세요."',by:null,to:null,attributionChecked:7};
const store={scenes:[{events:[{quotes:[q]}]}]}, messages=[{number:1,sentences:[q.text]}];
assert.equal(S.attributionCandidates(store,messages,4,new Set()).length,0);
let list=S.attributionCandidates(store,messages,4,new Set(),{retryUnresolved:true});assert.equal(list.length,1);
const attempts=new Set([q]);assert.equal(S.attributionCandidates(store,messages,4,attempts,{retryUnresolved:true}).length,0);
q.by='가은'; q.to='도윤';
assert.equal(S.attributionCandidates(store,messages,4,new Set(),{retryUnresolved:true}).length,1);
list=[{id:'0',scene:store.scenes[0],q,names:['가은','도윤'],context:q.text,externalContext:'',source:q.text}];
list=S.attributionCandidates(store,messages,4,new Set(),{retryUnresolved:true});
// An unsure answer does not erase a stored value that breaks no rule.
S.applyAttributionResults(list,[{id:'0',by:null,to:[],byEvidence:'',toEvidence:''}]);assert.equal(q.by,'가은');assert.equal(q.to,'도윤');
console.log('attribution retry tests passed');
