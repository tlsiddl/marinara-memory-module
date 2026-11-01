const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
const { _test: service } = require('../memory-module/lib/service.cjs');

test('compact RP headers and tracker dates retain the in-story time', () => {
  const expected = { date: '2025-02-14', time: '10:45' };
  assert.deepEqual(L.dateInText('§RP|20250214|10:45|장소|날씨§ 본문'), expected);
  assert.deepEqual(L.parseClock('20250214 10:45'), expected);
  assert.equal(L.parseClock('20251314'), null);
  assert.equal(L.parseClock('123456789'), null);
  assert.deepEqual(L.parseClock('2025-02-14 10:45'), expected);
  const clock = service.trackerClock({ date: '20250214', time: '10:45' });
  assert.equal(clock.date, expected.date);
  assert.equal(clock.time, expected.time);
  const field = service.trackerClock({ worldCustomFields: [{ name: '작중 날짜', value: '20250214' }] });
  assert.equal(field.date, expected.date);
});
