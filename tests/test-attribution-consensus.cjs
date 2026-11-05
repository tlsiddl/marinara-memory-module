const assert = require('node:assert/strict');
const S = require('../memory-module/lib/scenes.cjs');
const quote={number:1,sentence:1,text:'"실례합니다."',by:'나현',to:'상민'};
const scene={events:[{quotes:[quote]}],present:['나현','상민','직원']};
const messages=[{number:1,sentences:[quote.text,'직원의 말이 중단되었다.','상민이 직원에게 이름을 물었다.']}];
let c=S.attributionCandidates({scenes:[scene]},messages);
const a={id:'0',by:'직원',to:['상민'],byEvidence:'직원의 말이 중단되었다.',toEvidence:'상민이 직원에게 이름을 물었다.'};
const b={...a}; let agreed=S.confirmAttributionResults(c,[a],[b]);
S.applyAttributionResults(c,agreed);assert.equal(quote.by,'직원');assert.equal(quote.to,'상민');
delete quote.attributionChecked;delete quote.attributionFp;
c=S.attributionCandidates({scenes:[scene]},messages);
// Narration right after the line ("직원의 말이 중단되었다") names the speaker: another answer cannot outvote it.
const wrong={...a,by:'상민',to:['직원'],byEvidence:'상민이 직원에게 이름을 물었다.'};agreed=S.confirmAttributionResults(c,[a],[wrong]);
assert.equal(agreed[0].second.byReason,'narration-conflict');S.applyAttributionResults(c,agreed);assert.equal(quote.by,'직원');
// Two proven but different speakers: nothing new is decided and the existing value, which breaks no rule, stays.
const q2={number:5,sentence:2,text:'"좋아요."',by:'나현',to:'상민'};const scene2={events:[{quotes:[q2]}],present:['나현','상민']};
const m2=[{number:5,sentences:['나현이 상민을 바라보았다.',q2.text,'상민이 고개를 들었다.']}];
let c2=S.attributionCandidates({scenes:[scene2]},m2);
agreed=S.confirmAttributionResults(c2,[{id:'0',by:'나현',to:['상민'],byEvidence:'나현이 상민을 바라보았다.',toEvidence:'나현이 상민을 바라보았다.'}],[{id:'0',by:'상민',to:['나현'],byEvidence:'상민이 고개를 들었다.',toEvidence:''}]);
assert.equal(agreed[0].reason,'disagree');S.applyAttributionResults(c2,agreed);assert.equal(q2.by,'나현');assert.equal(q2.to,'상민');
assert.equal(c2[0].outcome.rule,'kept-disagree');
// An answer without proof is no disagreement: the proven one is used.
delete quote.attributionChecked;delete quote.attributionFp;quote.by=null;quote.to=null;c=S.attributionCandidates({scenes:[scene]},messages);
agreed=S.confirmAttributionResults(c,[a],[{...wrong,byEvidence:'직원의 말이 중단되었다.'}]);assert.equal(agreed[0].reason,'one-proven');
S.applyAttributionResults(c,agreed);assert.equal(quote.by,'직원');
// Both answers missing: nothing to apply, the value stays.
delete quote.attributionChecked;delete quote.attributionFp;c=S.attributionCandidates({scenes:[scene]},messages);
assert.equal(S.confirmAttributionResults(c,[],[]).length,0);assert.equal(S.confirmAttributionResults(c,null,undefined).length,0);assert.equal(quote.by,'직원');
console.log('independent attribution tests passed');
