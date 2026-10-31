// npm install --no-save happy-dom
// node tests/test-library-input-search.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { Window } = await import(process.env.HAPPY_DOM_MODULE || 'happy-dom');
const window = new Window({url:'http://library.test',settings:{enableJavaScriptEvaluation:true}});
const { document } = window;
const scene = {id:'S1',title:'호텔 만남',start:1,end:4,summary:'어디로 갈까?',events:[],recollections:[],present:[],loose:[]};
const records = {scenes:[scene],chapters:[{id:'C1',title:'첫 만남',summary:'호텔에서',scenes:['S1']}],arcs:[{id:'A1',title:'호텔 시절',summary:'지난 만남',chapters:['C1']}],facts:[{id:'F1',about:'서아',text:'홍차를 좋아한다'}]};
const info = {enabled:true,threads:[{id:'T1',title:'호텔 약속',kind:'promise',status:'closed',text:'다시 만나기',evidence:[]}],scenes:{count:1},cast:[]};
window.localStorage.setItem('marinara-active-chat-id','room1');
window.fetch = async path => ({ok:true,status:200,text:async()=>JSON.stringify(path.endsWith('/scenes')?records:path.endsWith('/chats')?[{id:'room1',name:'시험 방'}]:info)});
let cleanup;
window.marinara = {onCleanup:fn=>cleanup=fn};
let helpCount=0;
window.addEventListener('keydown',e=>{if(e.key==='?' && !['INPUT','TEXTAREA'].includes(e.target.tagName)){helpCount++;e.preventDefault();}});
window.eval(await readFile(new URL('../deliverable/extension.js',import.meta.url),'utf8'));
const root=document.querySelector('#memory-module-library').shadowRoot;
const q=s=>root.querySelector(s);
const click=s=>{assert.ok(q(s),s);q(s).click();};
const search=(text,submit=true)=>{
 const input=q('#memorySearchInput');input.value=text;input.dispatchEvent(new window.Event('input',{bubbles:true,composed:true}));
 if(submit) q('#memorySearch').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
};
try {
 document.querySelector('#memory-module-launcher').click();
 for(let i=0;i<10;i++) await new Promise(r=>setTimeout(r,0));
 click('[data-tab="search"]');
 // The scenes are loaded when a tab that needs them opens.
 for(let i=0;i<10;i++) await new Promise(r=>setTimeout(r,0));
 const input=q('#memorySearchInput');
 for(const type of ['keydown','keypress','keyup']) {
  const event=new window.KeyboardEvent(type,{key:'?',bubbles:true,composed:true,cancelable:true});
  input.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
 }
 assert.equal(helpCount,0);
 search('?');assert.ok(q('[data-goto-scene="S1"]'));
 click('[data-goto-scene="S1"]');assert.equal(q('#sSummary').value,'어디로 갈까?');
 q('#sSummary').dispatchEvent(new window.KeyboardEvent('keydown',{key:'?',bubbles:true,composed:true,cancelable:true}));assert.equal(helpCount,0);
 click('[data-tab="search"]');search('호텔');
 for(const kind of ['scene','chapter','arc','thread']) assert.equal(root.querySelectorAll(`[data-goto-${kind}]`).length,1);
 click('[data-goto-chapter="C1"]');assert.equal(q('#chapterEditor').dataset.id,'C1');
 click('[data-tab="search"]');click('[data-goto-arc="A1"]');assert.equal(q('#arcEditor').dataset.id,'A1');
 click('[data-tab="search"]');click('[data-goto-thread="T1"]');assert.equal(q('[data-tid="T1"]').open,true);
 click('[data-tab="search"]');search('홍차');click('[data-goto-fact="F1"]');assert.ok(q('[data-fact="F1"]'));
 click('[data-tab="search"]');search('<img src=x onerror=alert(1)>');assert.equal(root.querySelectorAll('.record-link').length,0);assert.equal(root.querySelectorAll('img').length,0);
 click('[data-act="clearSearch"]');assert.equal(q('#memorySearchInput').value,'');
 click('#close');document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'?',bubbles:true,composed:true}));assert.equal(helpCount,1);
 console.log('PASS: DOM keyboard propagation/default preservation, literal punctuation search, all five record types, result navigation, closed record expansion, query escaping, reset, outside shortcuts');
} finally {cleanup();await window.happyDOM.close();}
