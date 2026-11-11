'use strict';
// An author plan's hidden line ("mystery") must not carry the plan's answer; a plan whose line cannot be written is
// left bare and not asked again and again. (Invented names.)
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../memory-module/lib/ledger.cjs');

const plan = (o = {}) => ({ id: 'T1', status: 'open', plan: true, kind: 'secret', title: "Mara's scar comes from the Harbor fire", detail: 'Mara got the scar saving a boy during the Harbor fire three years ago.', mystery: null, ...o });
const ledger = (t) => ({ cast: ['Mara'], threads: [t] });

test('a topic with no answer is taken', () => {
  const l = ledger(plan());
  assert.equal(L.applyPlanMysteries(l, { items: [{ id: 'T1', mystery: "the real reason for Mara's wrist mark" }] }), 1);
  assert.match(l.threads[0].mystery, /wrist mark/);
});
test('a line with the answer words or a proper noun of the plan is refused, the plan stays bare', () => {
  for (const line of ['the Harbor fire that gave Mara the scar', 'what happened at the Harbor', 'saving a boy during a fire']) {
    const l = ledger(plan());
    assert.equal(L.applyPlanMysteries(l, { items: [{ id: 'T1', mystery: line }] }), 0, line);
    assert.equal(l.threads[0].mystery, null);
    assert.equal(l.threads[0].mysteryTries, 1);
  }
});
test('Korean: the plan\'s words in the hidden line are refused; a plain topic is taken', () => {
  const t = () => plan({ title: '세라의 손목 흉터는 등대 화재에서 생겼다', detail: '세라는 등대 화재 때 아이를 구하다가 손목에 흉터가 생겼다.' });
  const l1 = { cast: ['세라'], threads: [t()] };
  assert.equal(L.applyPlanMysteries(l1, { items: [{ id: 'T1', mystery: '등대 화재에서 아이를 구하다 생긴 상처' }] }), 0);
  const l2 = { cast: ['세라'], threads: [t()] };
  assert.equal(L.applyPlanMysteries(l2, { items: [{ id: 'T1', mystery: '세라가 숨기는 오래된 일' }] }), 1);
});
test('tries: counted per plan text; a plan the answer left out counts too; changed text starts over', () => {
  const t = plan();
  const l = ledger(t);
  L.applyPlanMysteries(l, { items: [] }, undefined, [t]);
  L.applyPlanMysteries(l, { items: [] }, undefined, [t]);
  assert.equal(t.mysteryTries, L.MYSTERY_TRIES);
  t.detail = 'Changed plan text.';
  L.applyPlanMysteries(l, { items: [] }, undefined, [t]);
  assert.equal(t.mysteryTries, 1, 'new text, new count');
});
test('a new plan from the reading and an update keep the same guard', () => {
  const t = plan({ mystery: 'why Mara hides her arm' });
  const l = ledger(t);
  assert.equal(L.mysteryLeaks('why Mara hides her arm', t, l), false);
  assert.equal(L.mysteryLeaks('the Harbor fire', t, l), true);
});
