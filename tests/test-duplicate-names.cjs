'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'mm-duplicate-'));
const svc=require('../memory-module/lib/service.cjs');const opt={chatId:'room',chatMode:'roleplay',isGroupChat:true,usesIndividualGroupGeneration:false,impersonate:false,charInfo:[{id:'c',name:'카시안'},{id:'k',name:'킬리안'}]};svc._test.saveSettings({chats:{room:{speakerNames:true,speakerTags:false}}});
test('existing name outside speaker tag does not gain an extra prefix inside it',()=>{const s='카시안 | <speaker="카시안">"Did you smile?"</speaker> (웃었어?)';assert.equal(svc.fixSpeakers(s,opt),s);});
test('same name outside and inside speaker tag is reduced to one',()=>{const s='카시안 | <speaker="카시안">카시안 | "Hello."</speaker> (안녕.)';const expected='카시안 | <speaker="카시안">"Hello."</speaker> (안녕.)';const out=svc.fixSpeakers(s,opt);assert.equal(out,expected);assert.equal(svc.fixSpeakers(out,opt),out);});
test('same direct prefix is collapsed, a distinct name is preserved',()=>{assert.equal(svc.fixSpeakers('카시안 | 카시안 | "Hello." (안녕.)',opt),'카시안 | "Hello." (안녕.)');const s='카시안 | 킬리안 | "Hello."';assert.equal(svc.fixSpeakers(s,opt),s);});
test('speaker-tagged quote without a name still gets one, unknown names untouched',()=>{assert.equal(svc.fixSpeakers('<speaker="카시안">"Hello."</speaker>',opt),'<speaker="카시안">카시안 | "Hello."</speaker>');const s='카시안 | <speaker="누군가">"Hello."</speaker>';assert.equal(svc.fixSpeakers(s,opt),s);});
test('repeated prefixes inside an existing speaker tag collapse to one',()=>{assert.equal(svc.fixSpeakers('<speaker="카시안">카시안 | 카시안 | "Hello."</speaker>',opt),'<speaker="카시안">카시안 | "Hello."</speaker>');});
