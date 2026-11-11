// node --test tests/test-attribution-said-nothing.cjs
// English narration that says someone did NOT speak ("Viktor said nothing.") does not make them the speaker of the line
// before it. Found by checking a room's memory against its messages; rebuilt with invented names and lines.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-said-nothing-'));
const S = require('../memory-module/lib/scenes.cjs');

const NAMES = ['Viktor', 'Marco', 'Sera'];
const lines = (after) => [
  'Marco set the kettle on the stove.',
  'Marco | <speaker="Marco">"Then we leave at dawn, before the bakery opens."</speaker>',
  after,
];

test('"X said nothing", "X didn\'t answer", "without a word": X is the one who did not speak', () => {
  for (const after of ['Viktor said nothing, watching the rain.', 'Viktor didn\'t answer, folding the map.', 'Viktor did not reply.', 'Viktor put the map away without a word.', 'Viktor made no reply.']) {
    assert.equal(S.narrationSpeaker(lines(after), 1, NAMES), null, after);
  }
});

test('narration that does give the line its speaker still does', () => {
  assert.equal(S.narrationSpeaker(lines('Viktor said it quietly, staring at the window.'), 1, NAMES), 'Viktor');
});
