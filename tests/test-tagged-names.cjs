'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'name-prefix-'));
const S=require('../memory-module/lib/speakers.cjs'),svc=require('../memory-module/lib/service.cjs');
const options={chatId:'room',chatMode:'roleplay',isGroupChat:true,usesIndividualGroupGeneration:false,impersonate:false,charInfo:[{name:'아르민'},{name:'오웬'}]};
const sample='아르민이 세레나를 바라봤다.\n<speaker="아르민">"Look at the old clock." (저 낡은 시계 좀 봐.)</speaker>';
test('speaker tags supply the visible name with bilingual text preserved',()=>{svc._test.saveSettings({chats:{room:{speakerNames:true,speakerTags:false}}});let got=svc.fixSpeakers(sample,options);assert.equal(got,'아르민이 세레나를 바라봤다.\n<speaker="아르민">아르민 | "Look at the old clock." (저 낡은 시계 좀 봐.)</speaker>');assert.equal(svc.fixSpeakers(got,options),got);});
test('unknown tags and unlabelled speech are left to the model, and disabled names leave text unchanged',()=>{svc._test.saveSettings({chats:{room:{speakerNames:true}}});assert.equal(svc.fixSpeakers('<speaker="제3자">"안녕"</speaker>\n"안녕"',options),'<speaker="제3자">"안녕"</speaker>\n"안녕"');svc._test.saveSettings({chats:{room:{speakerNames:false}}});assert.equal(svc.fixSpeakers(sample,options),sample);});
test('single-character RP also supports tagged speech without duplicating a label',()=>{svc._test.saveSettings({chats:{room:{speakerNames:true}}});const o={...options,isGroupChat:false,charInfo:[{name:'아르민'}]};assert.match(svc.fixSpeakers(sample,o),/<speaker="아르민">아르민 \|/);assert.equal(S.prefixTaggedDialogue('<speaker="아르민">아르민 | "Hello"</speaker>',['아르민']),'<speaker="아르민">아르민 | "Hello"</speaker>');});
