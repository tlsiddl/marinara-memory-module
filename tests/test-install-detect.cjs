'use strict';
// install.sh: which Docker container is Marinara. Only one that runs the Marinara server (already has the memory module,
// starts packages/server/dist/index.js, or has it in /app) counts — a proxy or helper named after Marinara does not.
// Unsure (several, or a Marinara-named container that is not the server) stops without touching anything.
// The real find_container runs under sh with a stand-in "docker" function.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'install.sh').replace(/\\/g, '/');
const hasSh = spawnSync('sh', ['-c', 'echo ok'], { encoding: 'utf8' }).stdout?.trim() === 'ok';

/**
 * containers: [{ name, image, service, project, env?, cmd?, server? }] (running, in "docker ps" order).
 * Returns { out, rc, err } of find_container.
 */
function detect(containers, extraEnv = {}) {
  const rows = containers.map((c) => [c.name, c.image || '', c.service || '', c.project || ''].join('\t')).join('\n');
  const byName = (field) => containers.map((c) => `${c.name})${field(c)};;`).join('\n');
  const fake = `
docker() {
  case "$1" in
    ps)
      if [ "$#" -eq 1 ]; then return 0; fi
      case "$3" in *Label*) printf '%s\\n' "$ROWS" ;; *) printf '%s\\n' "$ROWS" | cut -f1 ;; esac ;;
    inspect)
      if [ "$#" -eq 2 ]; then printf '%s\\n' "$ROWS" | cut -f1 | grep -qx "$2"; return $?; fi
      case "$3" in
        *Env*) case "$4" in
${byName((c) => (c.env ? ` printf '%s\\n' ${JSON.stringify(c.env)}` : ' :'))}
          *) return 1;; esac ;;
        *.Path*) case "$4" in
${byName((c) => ` printf '%s\\n' ${JSON.stringify(c.cmd || 'node server.js')}`)}
          *) return 1;; esac ;;
        *) return 0 ;;
      esac ;;
    exec) case "$2" in
${byName((c) => (c.server ? ' return 0' : ' return 1'))}
          *) return 1;; esac ;;
  esac
}
`;
  const body = `${fake}\nROWS='${rows.replace(/'/g, "'\\''")}'\nMEMORY_MODULE_FUNCTIONS_ONLY=1\n. '${script}'\nRC=0; OUT="$(find_container)" || RC=$?\nprintf 'OUT=%s\\nRC=%s\\n' "$OUT" "$RC"`;
  const r = spawnSync('sh', ['-c', body], { encoding: 'utf8', env: { ...process.env, MARINARA_CONTAINER: '', ...extraEnv } });
  const out = /OUT=(.*)/.exec(r.stdout)?.[1] ?? '';
  const rc = Number(/RC=(\d+)/.exec(r.stdout)?.[1]);
  return { out, rc, err: r.stderr };
}

const engine = { name: 'marinara-engine-marinara-1', image: 'ghcr.io/example/marinara-engine:latest', service: 'marinara', project: 'marinara-engine', cmd: 'docker-entrypoint.sh node packages/server/dist/index.js', server: true };
const proxy = { name: 'chat-marinara-proxy', image: 'chat-marinara-proxy:latest', service: 'proxy', project: 'chat-marinara-proxy', cmd: 'node proxy.js' };

test('a proxy named after Marinara that comes first is not taken; the server is', { skip: !hasSh && 'no sh here' }, () => {
  const r = detect([proxy, engine]);
  assert.deepEqual([r.out, r.rc], ['marinara-engine-marinara-1', 0], r.err);
});

test('a Marinara under a name of its own (custom compose service and image) is found by its server', { skip: !hasSh && 'no sh here' }, () => {
  const mine = { name: 'rp-app-1', image: 'my-registry/rp:3', service: 'app', project: 'rp', cmd: 'sh -c start.sh', server: true };
  const r = detect([proxy, { name: 'postgres-1', image: 'postgres:16' }, mine]);
  assert.deepEqual([r.out, r.rc], ['rp-app-1', 0], r.err);
});

test('already has the memory module: that one, even with nothing else to go by', { skip: !hasSh && 'no sh here' }, () => {
  const r = detect([proxy, { name: 'mm-host', image: 'x', env: 'NODE_OPTIONS=--require=/app/memory-module/marinara-memory-runtime.cjs' }]);
  assert.deepEqual([r.out, r.rc], ['mm-host', 0], r.err);
});

test('several Marinara servers: stop and ask for the name, nothing picked', { skip: !hasSh && 'no sh here' }, () => {
  const second = { ...engine, name: 'marinara-test-marinara-1', project: 'marinara-test' };
  const r = detect([engine, second]);
  assert.deepEqual([r.out, r.rc], ['', 2]);
  assert.match(r.err, /여러 개/);
  assert.match(r.err, /MARINARA_CONTAINER=marinara-engine-marinara-1 sh/);
});

test('only a Marinara-named container that is not the server: stop (not a local install, not the proxy)', { skip: !hasSh && 'no sh here' }, () => {
  const r = detect([proxy, { name: 'db', image: 'postgres:16' }]);
  assert.deepEqual([r.out, r.rc], ['', 2]);
  assert.match(r.err, /chat-marinara-proxy/);
});

test('nothing to do with Marinara running: none (the installer goes on to a local install)', { skip: !hasSh && 'no sh here' }, () => {
  const r = detect([{ name: 'db', image: 'postgres:16' }, { name: 'web', image: 'nginx' }]);
  assert.deepEqual([r.out, r.rc], ['', 1]);
});

test('MARINARA_CONTAINER picks by hand (kept even when the server file is not seen); a wrong name stops', { skip: !hasSh && 'no sh here' }, () => {
  let r = detect([proxy, engine], { MARINARA_CONTAINER: 'marinara-engine-marinara-1' });
  assert.deepEqual([r.out, r.rc], ['marinara-engine-marinara-1', 0]);
  r = detect([proxy, engine], { MARINARA_CONTAINER: 'chat-marinara-proxy' });
  assert.deepEqual([r.out, r.rc], ['chat-marinara-proxy', 0], 'the user said so');
  assert.match(r.err, /확인하지 못했지만/);
  r = detect([proxy, engine], { MARINARA_CONTAINER: 'nope' });
  assert.deepEqual([r.out, r.rc], ['', 2]);
});

test('the installer stops (does not install or restart anything) when the container is unsure', () => {
  // A Windows checkout (core.autocrlf) has CRLF in the working copy; the repo's own copy is LF.
  const src = require('node:fs').readFileSync(script, 'utf8').replace(/\r\n/g, '\n');
  assert.equal((src.match(/RC=0; C="\$\(find_container\)" \|\| RC=\$\?\n\s*\[ "\$RC" = 2 \] && fail /g) || []).length, 2, 'install and rollback both');
  assert.ok(!/\r/.test(src), 'no stray carriage returns (curl | sh)');
});
