'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'context-name-'));
const svc=require('../memory-module/lib/service.cjs');
const opt={chatId:'room',chatMode:'roleplay',isGroupChat:true,usesIndividualGroupGeneration:false,impersonate:false,charInfo:[{name:'카시안'},{name:'킬리안'}]};
test('group names use explicit adjacent speech cues even with tags off and retain translations',()=>{svc._test.saveSettings({chats:{room:{speakerNames:true,speakerTags:false}}});let s='카시안이 말했다.\n\n"Hello, Lili." (안녕, 리리.)';let out=svc.fixSpeakers(s,opt);assert.equal(out,'카시안이 말했다.\n\n카시안 | "Hello, Lili." (안녕, 리리.)');assert.equal(svc.fixSpeakers(out,opt),out);});
test('ambiguous names, absent cues and other speakers do not get guessed',()=>{svc._test.saveSettings({chats:{room:{speakerNames:true}}});for(const s of ['카시안이 말했다. 킬리안이 말했다.\n"Hello."','카시안이 움직였다.\n"Hello."','"Hello."'])assert.equal(svc.fixSpeakers(s,opt),s);});
test('name switch off, impersonation and other modes never add names',()=>{let s='카시안이 말했다.\n"Hello."';svc._test.saveSettings({chats:{room:{speakerNames:false}}});assert.equal(svc.fixSpeakers(s,opt),s);svc._test.saveSettings({chats:{room:{speakerNames:true}}});assert.equal(svc.fixSpeakers(s,{...opt,impersonate:true}),s);assert.equal(svc.fixSpeakers(s,{...opt,chatMode:'conversation'}),s);});
