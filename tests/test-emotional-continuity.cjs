'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../memory-module/lib/scenes.cjs');
const service = require('../memory-module/lib/service.cjs')._test;

test('chapter input includes only what each person remembers', () => {
  const store = S.emptyStore();
  const scene = {id:'S1', start:1, end:2, title:'변화', summary:'두 사람이 손을 잡았다.', events:[], recollections:[
    {who:'도윤',text:'지안 곁에서 편안했다.',remembers:'full'},
    {who:'지안',text:'잊은 비밀',kept:'손을 잡은 기억만 흐릿하다.',remembers:'partial'},
    {who:'다른 사람',text:'몰랐던 사실',remembers:'none'}
  ]};
  store.scenes.push(scene);
  const text = S.buildChapterPrompt(store,[scene])[1].content;
  assert.match(text,/도윤의 회상: 지안 곁에서 편안했다/);
  assert.match(text,/흐릿함.*손을 잡은 기억/);
  assert.doesNotMatch(text,/잊은 비밀|몰랐던 사실/);
});

test('staged rebuild leaves saved chapters untouched if a later model call fails', async () => {
  const original=S.emptyStore();
  original.scenes=Array.from({length:70},(_,i)=>({id:`S${i+1}`,start:i+1,end:i+1,title:'장면',summary:'이야기',events:[],recollections:[],later:[]}));
  original.chapters=[{id:'C1',scenes:['S1','S2'],title:'기존 챕터',summary:'원래 요약',turns:[],keep:[]}];
  service.saveScenes('continuity-test',original);
  const staged=structuredClone(original);
  staged.chapters=[]; staged.arcs=[]; staged.nextChapter=1; staged.nextArc=1;
  let calls=0;
  const model={provider:{chatComplete:async()=>{calls++; if(calls===2) throw Error('모의 연결 오류'); return {content:JSON.stringify({end:'S20',title:'새 챕터',summary:'새 요약',turns:[],keep:[]})};}}};
  await assert.rejects(service.condense('continuity-test',staged,model,{cancel:false},{maxCalls:Infinity,chaptersOnly:true,staged:true}),/모의 연결 오류/);
  assert.equal(service.loadScenes('continuity-test').chapters[0].title,'기존 챕터');
});

test('short old chapter preserves the later relationship change when it fits', () => {
  const store=S.emptyStore();
  store.chapters=Array.from({length:35},(_,i)=>({
    id:`C${i+1}`,scenes:[],title:`일상 ${i+1}`,
    summary:i===0?'도윤은 아무도 믿지 않았다. 지안이 곁을 지켜준 뒤 도윤은 지안을 믿게 됐다. 두 사람은 손을 잡았다.':'도윤과 지안이 일상을 보냈다. '.repeat(16),
    turns:[],keep:[]
  }));
  const text=S.renderChapters(store,4000,'');
  assert.match(text,/지안을 믿게 됐다/);
});
