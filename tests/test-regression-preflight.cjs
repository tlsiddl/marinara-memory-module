'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('regression preflight rejects an empty dependency directory even with another NODE_PATH', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-missing-deps-'));
  try {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'run-regression.cjs')], { encoding: 'utf8', env: { ...process.env, MEMORY_TEST_DEPS_DIR: dir } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /happy-dom/);
    assert.match(result.stderr, /fastify/);
    assert.match(result.stderr, /tests\/README\.md/);
    assert.doesNotMatch(result.stdout, /TAP version/, 'tests must not silently start or skip');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
