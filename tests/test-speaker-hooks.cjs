// node --test tests/test-speaker-hooks.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const RT = require('../memory-module/marinara-memory-runtime.cjs');
const SP = require('../memory-module/lib/speakers.cjs');
const route = '/tmp/engine/packages/server/dist/routes/generate.routes.js';
const legacy = RT.PATCHES.find(p => p.name === 'speakers' && p.target.test(route));
const modern = RT.PATCHES.find(p => p.name === 'speakers' && p.target.test('/tmp/engine/packages/server/dist/routes/generate/reply-text-cleanup.js'));
const source = `function run(text, options) {
  const {input, chatMode, isGroupChat, usesIndividualGroupGeneration, charInfo} = options;
  let fullResponse = text;
  let contentReplaced = false;
  const streamed = [];
  if (contentReplaced) { streamed.push(fullResponse); }
  const saved = fullResponse;
  return {saved, streamed, contentReplaced};
}`;
const options = {input:{chatId:'room',impersonate:false},chatMode:'roleplay',isGroupChat:true,usesIndividualGroupGeneration:false,charInfo:[{name:'하준'},{name:'하루'}]};

test('legacy route repairs before streaming and persistence with the full current context', () => {
  assert.ok(legacy);
  const out = RT.patchSource(source, legacy);
  assert.ok(out); assert.equal(RT.patchSource(out,legacy),out);
  let context;
  const run = vm.runInNewContext(out+'; run', {globalThis:{__marinaraMemory:{fixSpeakers:(text,o)=>{context=o;return SP.restoreSpeakerTags(text,o.charInfo.map(c=>c.name));}}}});
  const result = run('하준 | "안녕."',options);
  assert.equal(result.saved,'<speaker="하준">하준 | "안녕."</speaker>');
  assert.equal(result.streamed[0],result.saved);
  assert.equal(result.contentReplaced,true);
  assert.equal(context.chatId,'room');assert.equal(context.impersonate,false);
  assert.equal(context.charInfo,options.charInfo);
  assert.equal(run('"이름 없는 대사"',options).saved,'"이름 없는 대사"');
});

test('missing or duplicate route anchor is rejected, and a missing/throwing repair preserves original', () => {
  assert.equal(RT.patchSource('unrelated file',legacy),null);
  assert.equal(RT.patchSource(source+'\nif (contentReplaced) {}',legacy),null);
  for(const api of [undefined,{fixSpeakers:()=>{throw Error('unavailable');}},{fixSpeakers:()=>null}]) {
    const run=vm.runInNewContext(RT.patchSource(source,legacy)+'; run',{globalThis:{__marinaraMemory:api}});
    const result=run('하준 | "원문"',options);
    assert.equal(result.saved,'하준 | "원문"');assert.equal(result.contentReplaced,false);assert.equal(result.streamed.length,0);
  }
});

if(modern) test('modern cleanup keeps its own hook; the route is skipped to avoid double repair', () => {
  const modernRoute=source+'\ncleanGeneratedReply(fullResponse, {});';
  assert.equal(RT.patchSource(modernRoute,legacy),modernRoute);
  const cleanup='function cleanGeneratedReply(fullResponse, o) { let changed = false; const oocMessages = [];\n    return { text: fullResponse, changed, oocMessages };\n}';
  const patched=RT.patchSource(cleanup,modern);assert.ok(patched);assert.notEqual(patched,cleanup);
  const run=vm.runInNewContext(patched+'; cleanGeneratedReply',{globalThis:{__marinaraMemory:{fixSpeakers:t=>SP.restoreSpeakerTags(t,['하준'])}}});
  assert.equal(run('하준 | "안녕"',{}).changed,true);
});

test('real Node loader installs the legacy hook and reports success', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mm-speaker-loader-'));
  try {
    const file=path.join(dir,'packages/server/dist/routes/generate.routes.js');fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,source+'\nmodule.exports = run;');
    const runtime=path.resolve(__dirname,'../memory-module/marinara-memory-runtime.cjs');
    const code=`require(${JSON.stringify(runtime)});globalThis.__marinaraMemory.fixSpeakers=(t)=>'fixed:'+t;const run=require(${JSON.stringify(file)});const result=run('reply',${JSON.stringify(options)});require('node:assert/strict').equal(result.saved,'fixed:reply');require('node:assert/strict').equal(globalThis.__marinaraMemory.patches.speakers,'ok');`;
    execFileSync(process.execPath,['-e',code],{env:{...process.env,MEMORY_MODULE_ANY_PROCESS:'1',MEMORY_MODULE_HOOK_TEST:'0'},stdio:'pipe'});
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
