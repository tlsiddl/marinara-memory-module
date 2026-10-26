'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

test('POSIX install/update pins the compatibility branch and rollback preserves data', { skip: process.platform === 'win32' }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-install-246-'));
  try {
    const root = path.resolve(__dirname, '..');
    const target = path.join(tmp, 'Marinara');
    const bin = path.join(tmp, 'bin');
    const log = path.join(tmp, 'requests.jsonl');
    fs.mkdirSync(path.join(target, 'packages/server'), { recursive: true });
    fs.mkdirSync(bin);
    const sha = 'a'.repeat(40);
    const mock = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), url = args.find(a => a.startsWith('https://'));
fs.appendFileSync(process.env.MM_TEST_LOG, JSON.stringify(url) + '\\n');
if (url === 'https://api.github.com/repos/tlsiddl/marinara-memory-module/commits/marinara-2.4.6') {
  process.stdout.write(JSON.stringify({sha: '${sha}'}));
} else {
  const prefix = 'https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/${sha}/';
  if (!url.startsWith(prefix)) process.exit(2);
  const relative = url.slice(prefix.length);
  if (process.env.MM_TEST_FAIL && relative.endsWith('scenes.cjs')) process.exit(22);
  fs.copyFileSync(path.join(process.env.MM_TEST_REPO, relative), args[args.indexOf('-o') + 1]);
}
`;
    fs.writeFileSync(path.join(bin, 'curl'), mock, { mode: 0o755 });
    const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, MEMORY_MODULE_MODE: 'local', MARINARA_DIR: target, MEMORY_MODULE_BASE: '', MM_TEST_REPO: root, MM_TEST_LOG: log };
    const run = action => execFileSync('sh', [path.join(root, 'install.sh'), action], { env, cwd: target, encoding: 'utf8' });
    run('install');
    const runtime = path.join(target, 'memory-module/marinara-memory-runtime.cjs');
    const expected = fs.readFileSync(path.join(root, 'memory-module/marinara-memory-runtime.cjs'), 'utf8');
    assert.equal(fs.readFileSync(runtime, 'utf8'), expected);
    assert.ok(fs.existsSync(path.join(target, 'start-memory.sh')));
    const data = path.join(target, 'packages/server/data/memory-module/chats');
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, 'room.json'), '{"keep":true}');
    const old = '// Previous installed version\n' + expected;
    fs.writeFileSync(runtime, old);
    run('update');
    assert.equal(fs.readFileSync(runtime, 'utf8'), expected);
    assert.equal(fs.readFileSync(path.join(target, 'memory-module/.prev/marinara-memory-runtime.cjs'), 'utf8'), old);
    run('rollback');
    assert.equal(fs.readFileSync(runtime, 'utf8'), old);
    assert.equal(fs.readFileSync(path.join(data, 'room.json'), 'utf8'), '{"keep":true}');
    const failure = spawnSync('sh', [path.join(root, 'install.sh')], { env: { ...env, MM_TEST_FAIL: '1' }, cwd: target, encoding: 'utf8' });
    assert.notEqual(failure.status, 0);
    assert.equal(fs.readFileSync(runtime, 'utf8'), old, 'failed download must not overwrite the installed version');
    assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /commits\/main|\/main\//);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
