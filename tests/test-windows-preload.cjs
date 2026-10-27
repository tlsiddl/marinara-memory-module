'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Windows installer escapes Node preload paths with spaces and non-ASCII names', () => {
  const installer = fs.readFileSync(path.join(__dirname, '../install.ps1'), 'utf8');
  const bat = installer.slice(installer.indexOf("$bat = @'"), installer.indexOf('$batPath ='));
  assert.ok(bat.includes('setlocal DisableDelayedExpansion'));
  assert.ok(bat.includes('set "MEMORY_MODULE_ROOT=%MEMORY_MODULE_ROOT:\\=/%"'));
  assert.ok(bat.includes('--require="%MEMORY_MODULE_ROOT%memory-module/marinara-memory-runtime.cjs"'));
  // Exercise Node's real NODE_OPTIONS parser; no Windows filesystem or cmd.exe is simulated here.
  for (const root of ['C:\\Users\\사용자 이름\\Marinara-Engine\\', 'C:\\Users\\User Name\\Marinara-Engine\\']) {
    const backslashes = root + 'memory-module\\marinara-memory-runtime.cjs';
    const invoke = name => spawnSync(process.execPath, ['-e', ''], { env: { ...process.env, NODE_OPTIONS: `--require="${name}"` }, encoding: 'utf8' });
    const old = invoke(backslashes);
    assert.notEqual(old.status, 0);
    assert.ok(old.stderr.includes(backslashes.replace(/\\/g, '')), 'old quoted backslashes are swallowed');
    const normalized = backslashes.replace(/\\/g, '/');
    const fixed = invoke(normalized);
    assert.ok(fixed.stderr.includes(normalized), 'forward slashes reach module resolution intact');
  }
});
