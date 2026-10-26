// node tests/check-compat-246.cjs <official v2.4.6 checkout> <typescript module path>
// Uses externally supplied upstream source; no upstream engine code is redistributed here.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(process.argv[2]);
const ts = require(path.resolve(process.argv[3]));
process.env.MEMORY_MODULE_HOOK_TEST = '1';
const runtime = require('../memory-module/marinara-memory-runtime.cjs');
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '2.4.6');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-246-'));
try {
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const files = {
    macro: 'packages/shared/src/utils/macro-engine.ts',
    app: 'packages/server/src/app.ts',
    speakers: 'packages/server/src/routes/generate.routes.ts',
  };
  for (const patch of runtime.PATCHES) {
    const source = ts.transpileModule(read(files[patch.name]), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      reportDiagnostics: true,
    });
    assert.equal(source.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const compiled = source.outputText;
    const patched = runtime.patchSource(compiled, patch);
    assert.notEqual(patched, null, `${patch.name}: unique upstream anchor`);
    assert.notEqual(patched, compiled);
    assert.equal(runtime.patchSource(patched, patch), patched);
    const out = path.join(tmp, files[patch.name].replace('/src/', '/dist/').replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, patched);
    execFileSync(process.execPath, ['--check', out]);
    if (patch.name === 'speakers') {
      const hookAt = patched.indexOf(patch.insert);
      assert.ok(hookAt < patched.indexOf('if (contentReplaced)', hookAt));
      assert.ok(hookAt < patched.indexOf('await chats.addSwipe(', hookAt));
      assert.ok(hookAt < patched.indexOf('await chats.createMessage(', hookAt));
    }
    if (patch.name === 'macro') {
      // Import the unpatched compiled file through the real Node load hook.
      fs.writeFileSync(out, compiled);
      const notes = path.join(tmp, 'notes');
      fs.mkdirSync(notes);
      fs.writeFileSync(path.join(notes, '_default.txt'), 'DEFAULT NOTE');
      fs.writeFileSync(path.join(notes, 'chat-own.txt'), 'OWN NOTE');
      fs.writeFileSync(path.join(notes, 'chat-sneaky.txt'), '{{user}}');
      execFileSync(process.execPath, ['--require', path.resolve(__dirname, '../memory-module/marinara-memory-runtime.cjs'), path.join(__dirname, 'test-macro.mjs'), out], {
        env: { ...process.env, MEMORY_MODULE_HOOK_TEST: '0', MEMORY_MODULE_ANY_PROCESS: '1', MEMORY_MODULE_NOTES_DIR: notes, DATA_DIR: path.join(tmp, 'data') },
        stdio: 'inherit',
      });
    }
    console.log(`PASS: compiled upstream ${patch.name} hook and syntax`);
  }
  const contracts = {
    'services/storage/chats.storage.ts': ['createChatsStorage', 'async getById(', 'async listMessages(', 'async updateMessageContent('],
    'services/storage/characters.storage.ts': ['createCharactersStorage', 'async getById('],
    'services/storage/connections.storage.ts': ['createConnectionsStorage', 'async getWithKey(', 'async list('],
    'services/storage/game-state.storage.ts': ['createGameStateStorage', 'async getCommittedForMessages(', 'async getLatestForMessages(', 'async getByChatAndMessage('],
    'services/llm/provider-registry.ts': ['createLLMProvider(', 'defaultParameters?: unknown'],
    'services/generation/connection-base-url.ts': ['resolveBaseUrl('],
  };
  for (const [file, symbols] of Object.entries(contracts)) {
    const source = read('packages/server/src/' + file);
    for (const symbol of symbols) assert.ok(source.includes(symbol), `${file}: ${symbol}`);
  }
  console.log('PASS: upstream storage/provider API source contracts (not a running server test)');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
