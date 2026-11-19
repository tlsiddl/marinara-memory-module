'use strict';
// Required dependencies are checked before Node's test runner can silently skip optional HTTP tests.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const modules = path.resolve(process.env.MEMORY_TEST_DEPS_DIR || path.join(__dirname, 'node_modules'));
const entry = (name) => {
  try { return require.resolve(path.join(modules, name)); }
  catch { console.error(`테스트 의존성 ${name}을 ${modules}에서 찾지 못했습니다. 테스트 전용 폴더에 npm ci --ignore-scripts 를 실행하세요 (tests/README.md 참조).`); process.exitCode = 1; return null; }
};
const happy = entry('happy-dom');
const fastify = entry('fastify');
const shell = spawnSync('sh', ['-c', 'exit 0'], { stdio: 'ignore' });
if (shell.status !== 0) {
  console.error('설치 감지 테스트에 sh가 필요합니다. Windows에서는 Git의 bin 폴더를 PATH에 추가하세요.');
  process.exitCode = 1;
}
if (!happy || !fastify || process.exitCode) process.exit(process.exitCode || 1);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-regression-'));
const files = fs.readdirSync(__dirname).filter((name) => /^test-.*\.(cjs|mjs)$/.test(name) && name !== 'test-macro.mjs').sort().map((name) => path.join(__dirname, name));
const env = { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp, DATA_DIR: path.join(temp, 'data'), NODE_PATH: [modules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter), HAPPY_DOM_MODULE: pathToFileURL(happy).href };
try {
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], { cwd: path.dirname(__dirname), env, stdio: 'inherit' });
  if (result.error) { console.error(result.error); process.exitCode = 1; }
  else process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
