'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.MEMORY_MODULE_HOOK_TEST = '1';
const { PATCHES, patchSource, TESTED_MARINARA } = require('../memory-module/marinara-memory-runtime.cjs');
const SP = require('../memory-module/lib/speakers.cjs');
const speaker = PATCHES.find(p => p.name === 'speakers');

test('2.4.6 targets the inline response cleanup, not the later extracted file', () => {
  assert.equal(TESTED_MARINARA, '2.4.6');
  assert.ok(speaker.target.test('/app/packages/server/dist/routes/generate.routes.js'));
  assert.ok(speaker.target.test('C:\\Marinara\\packages\\server\\dist\\routes\\generate.routes.js'));
  assert.equal(speaker.target.test('/app/packages/server/dist/routes/generate/reply-text-cleanup.js'), false);
  assert.equal(patchSource('unrecognized upstream', speaker), null);
  assert.equal(patchSource(speaker.anchor + '\n' + speaker.anchor, speaker), null);
});

test('inline hook passes the 2.4.6 context and marks corrected replies for the existing stream/save path', () => {
  const original = '하준 | "안녕."';
  const options = { chatId: 'room', chatMode: 'roleplay', isGroupChat: true, usesIndividualGroupGeneration: false, impersonate: false, charInfo: [{ name: '하준' }, { name: '하루' }] };
  const run = fixSpeakers => {
    const context = { fullResponse: original, contentReplaced: false, input: { chatId: options.chatId, impersonate: false }, ...options, __marinaraMemory: { fixSpeakers } };
    vm.runInNewContext(patchSource(speaker.anchor + '}\n', speaker), context);
    return context;
  };
  const fixed = run((text, o) => {
    assert.deepEqual(JSON.parse(JSON.stringify(o)), options);
    return SP.restoreSpeakerTags(text, o.charInfo.map(c => c.name));
  });
  assert.match(fixed.fullResponse, /<speaker="하준">/);
  assert.equal(fixed.contentReplaced, true);
  for (const callback of [undefined, text => text, () => { throw Error('unavailable'); }, () => null]) {
    const unchanged = run(callback);
    assert.equal(unchanged.fullResponse, original);
    assert.equal(unchanged.contentReplaced, false);
  }
  const patched = patchSource(speaker.anchor + '}\n', speaker);
  assert.equal(patchSource(patched, speaker), patched);
});

test('all compatibility installers stay on the dedicated branch', () => {
  const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  for (const name of ['install.sh', 'install.ps1', 'update.sh', 'README.md']) {
    const source = read(name);
    assert.doesNotMatch(source, /marinara-memory-module\/main|commits\/main/);
    assert.match(source, /marinara-2\.4\.6/);
  }
  assert.match(read('install.sh'), /commits\/marinara-2\.4\.6/);
  assert.match(read('install.ps1'), /\$ref = 'marinara-2\.4\.6'/);
  assert.doesNotMatch(read('extension/publish-branch.sh'), /git push/);
});
