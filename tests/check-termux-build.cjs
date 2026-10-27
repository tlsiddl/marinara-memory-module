// node tests/check-termux-build.cjs <official 2.4.6 checkout> <tools/node_modules>
// Checks official source with both compilers and isolates HTTP registration with real loader/service/Fastify.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const upstream = path.resolve(process.argv[2]), deps = path.resolve(process.argv[3]);
const esbuild = require(path.join(deps, 'esbuild')), ts = require(path.join(deps, 'typescript'));
process.env.MEMORY_MODULE_HOOK_TEST = '1';
const runtimePath = path.resolve(__dirname, '../memory-module/marinara-memory-runtime.cjs');
const runtime = require(runtimePath);
assert.equal(JSON.parse(fs.readFileSync(path.join(upstream, 'package.json'))).version, '2.4.6');
const files = { macro: 'packages/shared/src/utils/macro-engine.ts', app: 'packages/server/src/app.ts', speakers: 'packages/server/src/routes/generate.routes.ts', speakerPrompt: 'packages/server/src/routes/generate.routes.ts', speakerPreview: 'packages/server/src/routes/chats.routes.ts', speakerDryRun: 'packages/server/src/routes/generate/dry-run-route.ts' };
for (const patch of runtime.PATCHES) {
  const source = fs.readFileSync(path.join(upstream, files[patch.name]), 'utf8');
  for (const compiler of ['tsc', 'esbuild']) {
    const code = compiler === 'tsc' ? ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText : esbuild.transformSync(source, { loader: 'ts', platform: 'node', format: 'esm', target: 'es2022' }).code;
    const fixed = runtime.patchSource(code, patch);
    assert.notEqual(fixed, null, `${patch.name}/${compiler}`);
    assert.equal(runtime.patchSource(fixed, patch), fixed);
    assert.equal(runtime.patchSource(code + '\n' + patch.anchor, patch), null, 'ambiguous anchor stays disabled');
    console.log(`PASS official source: ${patch.name}/${compiler}`);
  }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-termux-'));
try {
  const put = (name, content) => { const file = path.join(tmp, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
  put('package.json', '{"type":"module"}');
  const dist = 'packages/server/dist/';
  // Only storage/provider dependencies are fixtures; module loader, memory service, routes and Fastify are real.
  for (const [name, content] of Object.entries({ 'db/connection.js': 'export async function getDB(){return {}}', 'services/storage/chats.storage.js': 'export function createChatsStorage(){return {list:async()=>[]}}', 'services/storage/characters.storage.js': 'export function createCharactersStorage(){return {}}', 'services/storage/connections.storage.js': 'export function createConnectionsStorage(){return {}}', 'services/llm/provider-registry.js': 'export function createLLMProvider(){}', 'services/generation/connection-base-url.js': 'export function resolveBaseUrl(){}' })) put(dist + name, content);
  const official = fs.readFileSync(path.join(upstream, files.app), 'utf8');
  const decorate = official.split('\n').find(line => line.includes('app.decorate("db", db);'));
  assert.ok(decorate);
  const source = `import Fastify from ${JSON.stringify(path.join(deps, 'fastify/fastify.js'))};\nexport async function buildApp(){const app=Fastify();const db={};\n${decorate}\nreturn app;}`;
  put(dist + 'app.js', esbuild.transformSync(source, { loader: 'ts', platform: 'node', format: 'esm', target: 'es2022' }).code);
  put(dist + 'index.js', `import {buildApp} from './app.js';const app=await buildApp();const r=await app.inject('/api/memory-module/chats');console.log(JSON.stringify({status:r.statusCode,body:r.json()}));await app.close();`);
  const run = (off, loader = runtimePath) => JSON.parse(execFileSync(process.execPath, ['--require', loader, path.join(tmp, dist, 'index.js')], { env: { ...process.env, MEMORY_MODULE_HOOK_TEST: '0', MEMORY_MODULE_OFF: off ? '1' : '0', DATA_DIR: path.join(tmp, 'data') }, encoding: 'utf8' }).trim());
  assert.equal(run(true).status, 404);
  // Reconstruct the previous whitespace-sensitive app anchor to reproduce the reported failure.
  put('before.cjs', fs.readFileSync(runtimePath, 'utf8').replace("anchor: 'app.decorate", "anchor: '    app.decorate").replace("require('./lib/service.cjs')", `require(${JSON.stringify(path.resolve(__dirname, '../memory-module/lib/service.cjs'))})`));
  assert.equal(run(false, path.join(tmp, 'before.cjs')).status, 404);
  assert.deepEqual(run(false), { status: 200, body: [] });
  console.log('PASS HTTP: disabled=404, previous Termux hook=404, corrected hook=200 []; storage is a fixture');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
