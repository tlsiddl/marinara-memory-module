// node tests/check-speaker-upstream.cjs <official engine checkout> <typescript module path>
// Checks externally supplied upstream code; engine source is not redistributed.
'use strict';
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const RT=require('../memory-module/marinara-memory-runtime.cjs');
const ts=require(path.resolve(process.argv[3]));const root=path.resolve(process.argv[2]);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mm-speaker-upstream-'));
try {
 const route=path.join(root,'packages/server/src/routes/generate.routes.ts');
 const source=fs.readFileSync(route,'utf8');
 const transpile=text=>{const r=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});assert.equal(r.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);return r.outputText;};
 const compiled=transpile(source);
 const legacy=RT.PATCHES.find(p=>p.name==='speakers'&&p.target.test(route.replace('/src/','/dist/').replace(/\.ts$/,'.js')));
 assert.ok(legacy,'generation route is supported');
 const modern=/\bcleanGeneratedReply\s*\(/.test(compiled);
 const patched=RT.patchSource(compiled,legacy);assert.ok(patched);
 if(modern) {
  assert.equal(patched,compiled,'modern route delegates to separately patched cleanup');
  const cleanup=transpile(fs.readFileSync(path.join(path.dirname(route),'generate/reply-text-cleanup.ts'),'utf8'));
  const patch=RT.PATCHES.find(p=>p.name==='speakers'&&p.target.test('/engine/packages/server/dist/routes/generate/reply-text-cleanup.js'));
  assert.ok(patch);const out=RT.patchSource(cleanup,patch);assert.ok(out);assert.notEqual(out,cleanup);
  fs.writeFileSync(path.join(dir,'cleanup.mjs'),out);execFileSync(process.execPath,['--check',path.join(dir,'cleanup.mjs')]);
 } else {
  assert.notEqual(patched,compiled);
  assert.equal(RT.patchSource(patched,legacy),patched);
  const at=patched.indexOf(legacy.insert);assert.ok(at>=0);
  assert.ok(at<patched.indexOf('if (contentReplaced)',at));
  assert.ok(at<patched.indexOf('await chats.addSwipe(',at));
  assert.ok(at<patched.indexOf('await chats.createMessage(',at));
  // Layouts without the old gameDraft temporary are supported too.
  assert.ok(RT.patchSource(compiled.replace('const gameDraftWithCommands = fullResponse;','const renamedGameDraft = fullResponse;'),legacy));
 }
 fs.writeFileSync(path.join(dir,'route.mjs'),patched);execFileSync(process.execPath,['--check',path.join(dir,'route.mjs')]);
 console.log(`PASS: compiled official ${modern?'modern cleanup + skipped route':'legacy route before stream, save and swipe'}, syntax and idempotence`);
} finally {fs.rmSync(dir,{recursive:true,force:true});}
