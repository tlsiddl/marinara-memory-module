'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('visible names and speaker tags remain independently configurable in one-to-one and group RP', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-names-'));
  const previous = process.env.DATA_DIR;
  try {
    process.env.DATA_DIR = dir;
    const svc = require('../memory-module/lib/service.cjs');
    const RT = require('../memory-module/marinara-memory-runtime.cjs');
    const patch = RT.PATCHES.find(p => p.name === 'speakerNamesPrompt');
    const source = 'function run(chatMode,isGroupChat,input,charInfo) { const finalMessages=[]; function injectIntoOutputFormatOrLastUser(a,b){a.push(b)};\n if (isGroupChat) {\n          // Inject group chat instructions at the end of the last user message\n } return finalMessages; }';
    const patched = RT.patchSource(source, patch);
    assert.ok(patched);
    const run = vm.runInNewContext(patched + ';run', {globalThis:{__marinaraMemory:svc}});
    for (const name of [false,true]) for (const tags of [false,true]) {
      svc._test.saveSettings({chats:{room:{speakerNames:name,speakerTags:tags}}});
      for (const group of [false,true]) {
        const result = run('roleplay', group, {chatId:'room',impersonate:false}, [{name:'하준'}]);
        assert.equal(result.length, name ? 1 : 0);
        if (name) assert.match(result[0], /하준/);
      }
      assert.equal(Boolean(svc.speakerInstructions('room',['하준'])),tags);
      assert.equal(run('conversation',false,{chatId:'room'},[{name:'하준'}]).length,0);
      assert.equal(run('roleplay',false,{chatId:'room',impersonate:true},[{name:'하준'}]).length,0);
    }
  } finally { if (previous === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous; fs.rmSync(dir,{recursive:true,force:true}); }
});
