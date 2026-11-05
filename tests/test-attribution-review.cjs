const assert = require('node:assert/strict');
const S = require('../memory-module/lib/scenes.cjs');
const q = {number:1,sentence:2,text:'"안녕."',by:'하준',to:'하준 서'};
const scene = {events:[{quotes:[q]}],present:['하준 서','민수','영희']};
const store = {scenes:[scene]};
const messages = [{number:1,sentences:['민수가 하준과 영희를 보았다.','"안녕."','민수가 둘에게 인사했다.']}];
let candidates = S.attributionCandidates(store,messages);
assert.equal(candidates.length,1);
assert.equal(S.applyAttributionResults(candidates,[{id:'0',by:'민수',to:['하준 서','영희'],byEvidence:'민수가 둘에게 인사했다.',toEvidence:'민수가 하준과 영희를 보았다.'}]),1);
assert.equal(q.by,'민수'); assert.equal(q.to,'하준 서·영희');
assert.equal(S.attributionCandidates(store,messages).length,0);
delete q.attributionChecked;
// Evidence that is not in the source proves nothing, and it does not erase the earlier proven value either.
assert.equal(S.applyAttributionResults(S.attributionCandidates(store,messages),[{id:'0',by:'민수',to:['영희'],byEvidence:'없는 근거',toEvidence:'민수가 둘에게 인사했다.'}]),0);
assert.equal(q.by,'민수'); assert.equal(q.to,'하준 서·영희');
scene.edited=true; assert.equal(S.attributionCandidates(store,messages).length,0);
scene.edited=false; q.messageId='different'; messages[0].id='source'; assert.equal(S.attributionCandidates(store,messages).length,0);
console.log('attribution tests passed');
