const assert=require('node:assert/strict'); const S=require('../memory-module/lib/scenes.cjs');
const q={number:1,sentence:1,text:'"비공개 원문"',by:'직원',to:'손님'};const scene={id:'S1',events:[{quotes:[q]}]};
const entries=S.attributionCandidates({scenes:[scene],personas:['직원','손님']},[{number:1,sentences:[q.text,'직원의 말이 끊겼다.']}]);
const answer={id:'0',by:'직원',to:['손님'],byEvidence:'직원의 말이 끊겼다.',toEvidence:'비공개 원문'};
const result=S.attributionDiagnostics(entries,[answer],[answer],[answer],[{by:null,to:null}]);
assert.equal(result[0].first.byExternalEvidenceFound,true);assert.equal(result[0].after.by,'직원');assert.ok(!JSON.stringify(result).includes('비공개 원문'));assert.ok(!JSON.stringify(result).includes('직원의 말이 끊겼다.'));
console.log('diagnostics omit source and evidence excerpts');
