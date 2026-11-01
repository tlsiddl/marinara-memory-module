'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');
function render(texts) {
  const routine = [{ who: '이리나', what: 'wake', at: '2025-11-17T08:00' },
    ...texts.map((text, i) => ({ who: '이리나', what: 'meal', text, at: `2025-11-17T08:${String(20 + 5 * i).padStart(2, '0')}` }))];
  const before = JSON.stringify(routine);
  const output = L.renderRoutine({ routine }, '2025-11-17T10:05');
  assert.equal(JSON.stringify(routine), before);
  return output;
}
test('same steak and juice in opposite order appear once each', () => {
  const result = render(['산딸기 주스와 블루 레어 스테이크 몇 입', '블루 레어 스테이크 몇 조각과 산딸기 주스']);
  assert.match(result, /1끼\(08:20 산딸기 주스, 블루 레어 스테이크\)/);
  assert.equal((result.match(/스테이크/g) || []).length, 1);
});
test('subsequent new food survives while duplicates disappear', () => {
  const result = render(['스테이크 한 입과 사과 주스', '사과 주스와 스테이크 몇 점', '샐러드']);
  assert.match(result, /1끼\(08:20 스테이크, 사과 주스, 샐러드\)/);
});
test('one bite remains a bite until another record updates it', () => {
  assert.match(render(['페투치네 몇 입']), /페투치네 몇 입/);
  assert.match(render(['페투치네 몇 입', '페투치네를 더 먹음']), /1끼\(08:20 페투치네\)/);
});
test('food labels in other languages preserve their case', () => {
  assert.match(render(['Steak, Salad', 'more of the Steak']), /Steak, Salad/);
});
test('fettuccine noodles are one dish even in a single historical entry', () => {
  const result = render(['데워진 페투치네 라구 파스타, 블루 레어 스테이크 마지막 두 조각, 페투치네 면, 탄산수']);
  assert.equal((result.match(/페투치네/g) || []).length, 1, result);
  assert.match(result, /페투치네 라구 파스타/);
  assert.match(result, /스테이크/);
  assert.match(result, /탄산수/);
});
test('generic fettuccine does not erase a distinct pasta type or sauce', () => {
  const result = render(['페투치네 면', '페투치네 라구 파스타와 스파게티']);
  assert.equal((result.match(/페투치네/g) || []).length, 1, result);
  assert.match(result, /페투치네 라구 파스타/);
  assert.match(result, /스파게티/);
});
