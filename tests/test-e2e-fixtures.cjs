'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function fixture(count) {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', `synthetic-${count}.jsonl`), 'utf8');
  return text.trim().split('\n').map((line) => JSON.parse(line));
}

test('scene E2E fixture keeps the 66-turn window and a quoted narrative', () => {
  const [metadata, ...messages] = fixture(66);
  assert.equal(metadata.user_name, '서아');
  assert.equal(messages.length, 66);
  assert.equal(messages[53].is_user, true);
  assert.equal(messages[54].is_user, false);
  assert.ok(messages[37].mes.length >= 30 && messages[37].mes.length < 80);
  assert.ok(messages[43].mes.length >= 30 && messages[43].mes.length < 80);
});

test('ledger E2E fixture keeps 330 turns and leaves the new-reply markers unused', () => {
  const [, ...messages] = fixture(330);
  assert.equal(messages.length, 330);
  assert.equal(messages.at(-1).is_user, false);
  assert.ok(messages.some((m) => m.mes.includes('약속')));
  assert.ok(messages.some((m) => m.mes.includes('서운')));
  assert.ok(messages.every((m) => !/달빛호수|별빛극장/.test(m.mes)));
});
