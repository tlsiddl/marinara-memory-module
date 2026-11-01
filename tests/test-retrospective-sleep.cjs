'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

function apply(content, rows) {
  const [m] = L.prepareMessages([{ id: 'm', number: 1, role: 'assistant', content: `${content}\n§RP | 25-11-16 (일) | 20:30 | 침실§` }]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { routine: rows.map((row) => ({ ...row, evidence: [{ n: '1.1' }] })) }, [m]);
  return ledger.routine;
}

test('a two-hour nap recalled while waking does not create a bedtime at wake time', () => {
  const result = apply('이리나가 두어 시간 깊은 낮잠을 자고 깨어났다.', [
    { who: '이리나', what: 'sleep', text: '두어 시간 깊은 낮잠' },
    { who: '이리나', what: 'wake', text: '깨어남' },
  ]);
  assert.deepEqual(result.map((r) => r.what), ['wake']);
});

test('a previously recorded 18:15 bedtime survives a 20:30 wake recap without duplication', () => {
  const messages = L.prepareMessages([
    { id: 'start', number: 1, role: 'assistant', content: '이리나가 식곤증에 눈을 감고 잠에 빠졌다.\n§RP | 25-11-16 (일) | 18:15 | 침실§' },
    { id: 'end', number: 2, role: 'assistant', content: '이리나가 두어 시간 깊은 낮잠을 자고 깨어났다.\n§RP | 25-11-16 (일) | 20:30 | 침실§' },
  ]);
  const ledger = L.emptyLedger();
  L.applyResult(ledger, { routine: [{ who: '이리나', what: 'sleep', text: '식곤증에 잠듦', evidence: [{ n: '1.1' }] }] }, [messages[0]]);
  L.applyResult(ledger, { routine: [
    { who: '이리나', what: 'sleep', text: '두어 시간 낮잠', evidence: [{ n: '2.1' }] },
    { who: '이리나', what: 'wake', text: '깨어남', evidence: [{ n: '2.1' }] },
  ] }, [messages[1]]);
  assert.deepEqual(ledger.routine.map((r) => [r.what, r.at]), [
    ['sleep', '2025-11-16T18:15'], ['wake', '2025-11-16T20:30'],
  ]);
});

test('a genuine new bedtime after waking is retained', () => {
  const result = apply('이리나는 두 시간 낮잠에서 깨어났다가 다시 잠들었다.', [
    { who: '이리나', what: 'sleep', text: '다시 잠듦' },
    { who: '이리나', what: 'wake', text: '깨어남' },
  ]);
  assert.deepEqual(result.map((r) => r.what), ['sleep', 'wake']);
});

test('sleep of a different person is not dropped merely because someone else wakes', () => {
  const result = apply('카시안이 깨어났고 이리나는 두 시간 낮잠 중이었다.', [
    { who: '이리나', what: 'sleep', text: '두 시간 낮잠' },
    { who: '카시안', what: 'wake', text: '깨어남' },
  ]);
  assert.equal(result.some((r) => r.who === '이리나' && r.what === 'sleep'), true);
});

test('a previously sleeping person may keep an explicitly new sleep onset', () => {
  const result = apply('이리나는 깨서 물을 마시고 두 시간 낮잠에 다시 잠이 들었다.', [
    { who: '이리나', what: 'sleep', text: '두 시간 낮잠' },
  ]);
  assert.equal(result.length, 1);
});
