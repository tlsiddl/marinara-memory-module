const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

test('compact RP headers and tracker dates retain the in-story time', () => {
  const expected = { date: '2025-02-14', time: '10:45' };
  assert.deepEqual(L.dateInText('§RP|20250214|10:45|장소|날씨§ 본문'), expected);
  assert.deepEqual(L.parseClock('20250214 10:45'), expected);
  assert.equal(L.parseClock('20251314'), null);
  assert.equal(L.parseClock('123456789'), null);
  assert.deepEqual(L.parseClock('2025-02-14 10:45'), expected);
});
