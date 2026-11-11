'use strict';
// Marinara 2.5.1 and 2.5.2 together: the reply-cleanup patch fits both return shapes, the version list, and
// (optionally) every patch against real builds: MARINARA_DIRS="/path/to/2.5.1:/path/to/2.5.2" node tests/test-marinara-252.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.MEMORY_MODULE_HOOK_TEST = '1';
const RT = require('../memory-module/marinara-memory-runtime.cjs');
const SP = require('../memory-module/lib/speakers.cjs');

const cleanup = RT.PATCHES.find((p) => p.name === 'speakers' && p.target.test('/e/packages/server/dist/routes/generate/reply-text-cleanup.js'));

// The shape of each version's cleanGeneratedReply end, reduced to what the patch touches.
const v251 = `export function cleanGeneratedReply(fullResponse, o) {
    let changed = false;
    const oocMessages = [];
    return { text: fullResponse, changed, oocMessages };
}`;
const v252 = `function cleanGeneratedReply(fullResponse, o) {
    let changed = false;
    let trimmedEnding = false;
    const oocMessages = [];
    if (o.trim) { fullResponse = fullResponse.replace(/ unfinished$/, ''); trimmedEnding = true; }
    if (o.ooc) { oocMessages.push(fullResponse); fullResponse = ''; }
    if (!fullResponse.trim() && oocMessages.length > 0) {
        const recovered = cleanGeneratedReply(oocMessages.join("\\n\\n"), { ...o, ooc: false, connectedChatId: null });
        if ("dropped" in recovered || !recovered.text.trim())
            return recovered;
        fullResponse = recovered.text;
        trimmedEnding ||= recovered.trimmedEnding;
        oocMessages.length = 0;
        changed = true;
    }
    return { text: fullResponse, changed, trimmedEnding, oocMessages };
}`;

const runPatched = (source, fix) => {
  const out = RT.patchSource(source, cleanup);
  assert.ok(out, 'patch applies');
  let calls = 0;
  const fn = vm.runInNewContext(out.replace(/^export /, '') + '; cleanGeneratedReply', {
    globalThis: { __marinaraMemory: { fixSpeakers: (t) => { calls++; return fix(t); } } },
  });
  return { out, fn, calls: () => calls };
};
const fix = (t) => SP.restoreSpeakerTags(t, ['하준']);

test('TESTED_MARINARA covers 2.5.1 and 2.5.2', () => {
  assert.deepEqual(RT.TESTED_MARINARA, ['2.5.1', '2.5.2']);
});

test('2.5.1 shape: repair goes in right before the return', () => {
  const { out, fn } = runPatched(v251, fix);
  assert.match(out, /fixSpeakers\?\.\(fullResponse, o\)[^\n]*\n    return \{ text: fullResponse, changed, oocMessages \};/);
  const r = fn('하준 | "안녕."', {});
  assert.equal(r.text, '<speaker="하준">하준 | "안녕."</speaker>');
  assert.equal(r.changed, true);
  assert.equal('trimmedEnding' in r, false);
});

test('2.5.2 shape: repair goes in, trimmedEnding is kept, OOC recovery is repaired once and stays the same', () => {
  const { out, fn, calls } = runPatched(v252, fix);
  assert.match(out, /fixSpeakers\?\.\(fullResponse, o\)[^\n]*\n    return \{ text: fullResponse, changed, trimmedEnding, oocMessages \};/);
  const trimmed = fn('하준 | "안녕." unfinished', { trim: true });
  assert.equal(trimmed.text, '<speaker="하준">하준 | "안녕."</speaker>');
  assert.equal(trimmed.trimmedEnding, true, 'the trimmed-ending flag reaches the caller');
  assert.equal(fn('그냥 지문.', {}).trimmedEnding, false);
  const before = calls();
  const recovered = fn('하준 | "OOC 뒤에 남은 말."', { ooc: true });
  assert.equal(recovered.text, '<speaker="하준">하준 | "OOC 뒤에 남은 말."</speaker>');
  assert.equal(calls() - before, 2, 'inner and outer cleanup each ask; the second sees tagged text');
  assert.equal(fix(recovered.text), recovered.text, 'repair is idempotent');
});

test('fail closed and idempotent on either shape', () => {
  for (const src of [v251, v252]) {
    const once = RT.patchSource(src, cleanup);
    assert.equal(RT.patchSource(once, cleanup), once);
    const ret = src.match(/^ *return \{ text: fullResponse.*$/m)[0];
    assert.equal(RT.patchSource(src + '\n' + ret, cleanup), null, 'two returns: off');
  }
  assert.equal(RT.patchSource('return { text: fullResponse, changed, somethingElse, oocMessages };', cleanup), null);
  // A throwing or missing repair leaves the reply as it was.
  for (const api of [undefined, { fixSpeakers: () => { throw Error('x'); } }]) {
    const fn = vm.runInNewContext(RT.patchSource(v252, cleanup) + '; cleanGeneratedReply', { globalThis: { __marinaraMemory: api } });
    assert.equal(JSON.stringify(fn('하준 | "원문"', {})), JSON.stringify({ text: '하준 | "원문"', changed: false, trimmedEnding: false, oocMessages: [] }));
  }
});

test('health reports a tested version as itself and an untested one as the list (old library screens compare strings)', () => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mm-health-'));
  process.env.DATA_DIR = dir;
  const T = require('../memory-module/lib/service.cjs')._test;
  globalThis.__marinaraMemory = { testedMarinara: RT.TESTED_MARINARA, patches: { macro: 'ok' } };
  const h = T.health();
  assert.deepEqual(h.testedList, ['2.5.1', '2.5.2']);
  // No server entry in this test, so the version is unknown.
  assert.equal(h.marinara, null);
  assert.equal(h.tested, '2.5.1, 2.5.2');
  delete globalThis.__marinaraMemory;
  fs.rmSync(dir, { recursive: true, force: true });
});

// Every patch against real builds, when given.
const FILES = {
  macro: 'packages/shared/dist/utils/macro-engine.js',
  app: 'packages/server/dist/app.js',
  speakerNamesPrompt: 'packages/server/dist/routes/generate.routes.js',
  speakerPrompt: 'packages/server/dist/routes/generate.routes.js',
  speakerPreview: 'packages/server/dist/routes/chats.routes.js',
  speakerDryRun: 'packages/server/dist/routes/generate/dry-run-route.js',
  namesPreview: 'packages/server/dist/routes/chats.routes.js',
  namesDryRun: 'packages/server/dist/routes/generate/dry-run-route.js',
};
for (const root of String(process.env.MARINARA_DIRS || '').split(':').filter(Boolean)) {
  test(`real build ${root}: every patch applies once, the legacy route is skipped`, () => {
    const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
    assert.ok(RT.TESTED_MARINARA.includes(version), `${version} is listed as tested`);
    for (const p of RT.PATCHES) {
      const rel = FILES[p.name] || (p.target.test('/x/packages/server/dist/routes/generate/reply-text-cleanup.js') ? 'packages/server/dist/routes/generate/reply-text-cleanup.js' : 'packages/server/dist/routes/generate.routes.js');
      const source = fs.readFileSync(path.join(root, rel), 'utf8');
      if (p.skipIf) {
        assert.ok(p.skipIf.test(source), `${p.name} legacy route is skipped on ${version}`);
        continue;
      }
      const out = RT.patchSource(source, p);
      assert.ok(out && out !== source, `${p.name} applies on ${version}`);
      assert.equal(RT.patchSource(out, p), out);
    }
  });
}
