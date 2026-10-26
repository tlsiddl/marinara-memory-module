// node --test tests/test-speakers.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const SP = require('../memory-module/lib/speakers.cjs');
const RT = require('../memory-module/marinara-memory-runtime.cjs');

const names = ['하루', '하준', '나레이터'];

test('untagged character lines get their tag, with the translation line inside', () => {
  const text = [
    '하준이 웃었다.',
    '',
    '하준 | "I love you, Ari."',
    '(사랑해, 아리.)',
    '',
    '하루 | "Shut up, Cryo-fuck." (닥쳐, 냉동 새끼야.)',
    '하루가 혀를 찼다.',
  ].join('\n');
  assert.equal(
    SP.restoreSpeakerTags(text, names),
    [
      '하준이 웃었다.',
      '',
      '<speaker="하준">하준 | "I love you, Ari."\n(사랑해, 아리.)</speaker>',
      '',
      '<speaker="하루">하루 | "Shut up, Cryo-fuck." (닥쳐, 냉동 새끼야.)</speaker>',
      '하루가 혀를 찼다.',
    ].join('\n'),
  );
});

test('lines already tagged, narration, and other names are left alone', () => {
  const tagged = '<speaker="하준">하준 | "Hi."\n(안녕.)</speaker>\n서아 | "응."\n하준이 말했다: 좋아.';
  assert.equal(SP.restoreSpeakerTags(tagged, names), tagged);
  assert.equal(SP.needsSpeakerTags('그냥 지문만 있다.', names), false);
});

test('the reply-cleanup patch fits Marinara 2.5.1 and puts the call right before the return', () => {
  const file = '/tmp/me/Marinara-Engine/packages/server/dist/routes/generate/reply-text-cleanup.js';
  if (!fs.existsSync(file)) return;
  const patch = RT.PATCHES.find((p) => p.name === 'speakers');
  assert.ok(patch.target.test(file));
  const out = RT.patchSource(fs.readFileSync(file, 'utf8'), patch);
  assert.ok(out);
  assert.match(out, /fixSpeakers\?\.\(fullResponse, o\)[^\n]*\n    return \{ text: fullResponse, changed, oocMessages \};/);
});
