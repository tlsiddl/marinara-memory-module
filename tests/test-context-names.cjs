'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'context-name-'));
const svc=require('../memory-module/lib/service.cjs');
const opt={chatId:'room',chatMode:'roleplay',isGroupChat:true,usesIndividualGroupGeneration:false,impersonate:false,charInfo:[{name:'아르민'},{name:'오웬'}]};
test('group names use explicit adjacent speech cues even with tags off and retain translations',()=>{svc._test.saveSettings({chats:{room:{speakerNames:true,speakerTags:false}}});let s='아르민이 말했다.\n\n"Hello, Nami." (안녕, 나미.)';let out=svc.fixSpeakers(s,opt);assert.equal(out,'아르민이 말했다.\n\n아르민 | "Hello, Nami." (안녕, 나미.)');assert.equal(svc.fixSpeakers(out,opt),out);});
test('ambiguous names, absent cues and other speakers do not get guessed',()=>{svc._test.saveSettings({chats:{room:{speakerNames:true}}});for(const s of ['아르민이 말했다. 오웬이 말했다.\n"Hello."','아르민이 움직였다.\n"Hello."','"Hello."'])assert.equal(svc.fixSpeakers(s,opt),s);});
test('name switch off, impersonation and other modes never add names',()=>{let s='아르민이 말했다.\n"Hello."';svc._test.saveSettings({chats:{room:{speakerNames:false}}});assert.equal(svc.fixSpeakers(s,opt),s);svc._test.saveSettings({chats:{room:{speakerNames:true}}});assert.equal(svc.fixSpeakers(s,{...opt,impersonate:true}),s);assert.equal(svc.fixSpeakers(s,{...opt,chatMode:'conversation'}),s);});
