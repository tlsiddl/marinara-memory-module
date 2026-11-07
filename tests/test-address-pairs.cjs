'use strict';
// 호칭 사전: a foreign nickname and its Korean translation as one entry "원어(번역)". Invented names only.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-pairs-'));
process.env.DATA_DIR = dir;
const S = require('../memory-module/lib/scenes.cjs');
const Addr = require('../memory-module/lib/address.cjs');
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const ADEL = '아델', VITO = '비토', SILVI = '실비', NERO = '네로';
const names = [ADEL, VITO, SILVI, NERO];
let n = 0;
// A bilingual line: the original in `text`, the Korean translation in `translation`.
const bq = (text, translation, by = ADEL, to = VITO) => ({ number: ++n, sentence: 1, text, translation, by, to });
const mono = (text, by = ADEL, to = VITO) => ({ number: ++n, sentence: 1, text, by, to });
const storeOf = (quotes) => ({ scenes: [{ id: 'S1', start: 1, end: 99, present: names, events: [{ text: '이야기', quotes }] }], cast: names, personas: [] });
const scan = (quotes, book = Addr.emptyBook()) => { Addr.refresh(book, storeOf(quotes)); return book; };
const by = (book, term) => book.entries.find((e) => e.term === term);

test('pairing: a foreign and a Korean term seen together in at least 2 lines and most of the Korean term\'s translated uses', () => {
  const book = scan([
    bq('"Tesoro, vieni qui."', '"자기, 이리 와."'), bq('"Tesoro, dai."', '"자기, 어서."'), bq('"Ciao, Tesoro."', '"안녕, 자기."'),
  ]);
  const o = by(book, 'Tesoro'), k = by(book, '자기');
  assert.ok(o && k);
  assert.equal(o.translation, '자기');
  assert.equal(o.pairWith, k.id);
  assert.equal(k.pairOf, o.id);
  assert.equal(o.pairCount, 3);
  assert.equal(k.pairCount, 3);
  assert.equal(o.count, 3, 'each entry keeps its own count');
});

test('pairing: one shared line is not enough, and neither is a minority of the Korean term\'s uses', () => {
  const one = scan([bq('"Tesoro, vieni."', '"자기, 와."'), mono('"Tesoro, dai."'), mono('"Tesoro, ecco."'), mono('"자기, 와."'), mono('"자기, 이리."')]);
  assert.equal(by(one, 'Tesoro').pairWith, undefined, 'co-occurs once');
  // 자기 is translated from other words in 3 of its 5 translated lines: 2/5 < 60%
  const quotes = [
    bq('"Tesoro, vieni."', '"자기, 와."'), bq('"Tesoro, dai."', '"자기, 어서."'),
    bq('"Amico, vieni."', '"자기, 와."'), bq('"Amico, dai."', '"자기, 어서."'), bq('"Capo, vieni."', '"자기, 와."'),
  ];
  const few = scan(quotes);
  assert.ok(by(few, '자기'));
  assert.equal(by(few, 'Tesoro').pairWith, undefined, 'a minority of the Korean term\'s uses');
  assert.equal(by(few, '자기').pairOf, undefined);
});

test('pairing: never two Korean terms, never two foreign terms, never across different speaker→listener pairs', () => {
  const book = scan([
    bq('"Tesoro, vieni."', '"자기, 와. 공주님, 이리."'), bq('"Tesoro, dai."', '"자기, 어서. 공주님, 여기."'),
    bq('"Amore, vieni."', '"자기, 와."'), bq('"Amore, dai."', '"자기, 어서."'),
    mono('"공주님, 와."'), mono('"공주님, 어서."'),
  ]);
  for (const e of book.entries) {
    if (e.pairOf || e.pairWith) {
      const other = book.entries.find((x) => x.id === (e.pairOf || e.pairWith));
      assert.notEqual(/[가-힣]/.test(e.term), /[가-힣]/.test(other.term), 'one Korean and one foreign term per pair');
    }
  }
  // different listener: the pair evidence of Adel→Vito does not link terms of Adel→Silvi
  const other = scan([
    bq('"Tesoro, vieni."', '"자기, 와."', ADEL, VITO), bq('"Tesoro, dai."', '"자기, 어서."', ADEL, VITO),
    mono('"대장, 와."', ADEL, SILVI), mono('"대장, 어서."', ADEL, SILVI),
  ]);
  const silvi = other.entries.find((e) => e.to === SILVI && e.term === '대장');
  assert.ok(silvi);
  assert.equal(silvi.pairOf, undefined);
});

test('pairing: a sound-alike spelling pairs even with fewer co-occurrences; a user entry pairs only by evidence; two user entries never', () => {
  const quotes = [mono('"Lili, vieni."'), mono('"Lili, dai."'), mono('"릴리, 와."'), mono('"릴리, 어서."'), bq('"Lili, ecco."', '"릴리, 여기."')];
  const book = scan(quotes);
  assert.equal(by(book, 'Lili').pairWith, by(book, '릴리').id, 'by sound, one shared line');
  assert.equal(by(book, 'Lili').pairCount, 5);
  // a user's Korean term and an automatic foreign term: evidence rule applies
  const user = Addr.emptyBook();
  Addr.addEntry(user, { from: ADEL, to: VITO, term: '자기' });
  scan([bq('"Tesoro, vieni."', '"자기, 와."'), bq('"Tesoro, dai."', '"자기, 어서."'), bq('"Tesoro, su."', '"자기, 자."')], user);
  assert.equal(by(user, 'Tesoro').translation, '자기');
  assert.equal(by(user, '자기').source, 'user');
  // two user entries are never joined
  const both = Addr.emptyBook();
  Addr.addEntry(both, { from: ADEL, to: VITO, term: 'Tesoro' });
  Addr.addEntry(both, { from: ADEL, to: VITO, term: '자기' });
  scan([bq('"Tesoro, vieni."', '"자기, 와."'), bq('"Tesoro, dai."', '"자기, 어서."')], both);
  assert.ok(both.entries.every((e) => !e.pairWith && !e.pairOf));
});

test('injection: "원어(번역)" for a pair, plain for the rest, within the cap, every pair\'s top term first', () => {
  const book = scan([
    bq('"Tesoro, vieni."', '"자기, 와."'), bq('"Tesoro, dai."', '"자기, 어서."'), bq('"Tesoro, su."', '"자기, 자."'),
    mono('"공주님, 와."'), mono('"공주님, 어서."'),
    mono('"Capo, ok."', VITO, ADEL), mono('"Capo, sì."', VITO, ADEL),
  ]);
  assert.equal(Addr.injectionBlock(book, [ADEL, VITO]), '[호칭] 아델→비토: Tesoro(자기)/공주님 · 비토→아델: Capo');
  assert.equal(Addr.injectionBlock(book, [ADEL]), '');
  const many = Addr.emptyBook();
  many.entries = [];
  for (const [from, to, c] of [[ADEL, VITO, 90], [VITO, SILVI, 80], [SILVI, NERO, 70]]) {
    for (let i = 0; i < 12; i++) {
      const O = { from, to, term: `Soprannome${'abcdefghijkl'[i]}${from}`.replace(/[가-힣]/g, 'x'), count: c - i, source: 'auto' };
      const K = { from, to, term: `별명${'가나라마바사자차카타파하'[i]}${'가나라마바사자차카타파하'[i]}`, count: c - i, source: 'auto' };
      const norm = Addr.normalize({ entries: [O, K] });
      const [o, k] = norm;
      o.pairWith = k.id; o.translation = k.term; o.pairCount = c - i; k.pairOf = o.id; k.pairCount = c - i;
      many.entries.push(o, k);
    }
  }
  const line = Addr.injectionBlock(many, [ADEL, VITO, SILVI, NERO]);
  assert.ok(line.length <= Addr.INJECT_CHARS, `${line.length}: ${line}`);
  for (const label of ['아델→비토', '비토→실비', '실비→네로']) assert.ok(line.includes(`${label}: Soprannome`), `${label}: ${line}`);
  assert.match(line, /Soprannomea[^()/·]*\(별명가가\)/);
  const counts = line.split(' · ').map((p) => p.split('/').length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, line);
});

test('attribution: both forms of a pair name the same listener, and the pair is used while either half is on', () => {
  const book = scan([bq('"Tesoro, vieni."', '"자기, 와."'), bq('"Tesoro, dai."', '"자기, 어서."')]);
  const o = by(book, 'Tesoro'), k = by(book, '자기');
  assert.deepEqual([...Addr.termMap(book)].sort(), [['tesoro', VITO], ['자기', VITO]].sort());
  k.useForCheck = false;
  assert.equal(Addr.termMap(book).get('자기'), VITO, 'the other half is on');
  assert.equal(Addr.termMap(book).get('tesoro'), VITO);
  o.useForCheck = false;
  assert.equal(Addr.termMap(book).size, 0, 'both off');
  // toggling one half switches the pair as one
  Addr.toggleEntry(book, o.id, true);
  assert.equal(Addr.termMap(book).size, 2);
  Addr.toggleEntry(book, k.id, false);
  assert.equal(Addr.termMap(book).size, 0);
  assert.ok(book.entries.every((e) => e.useForCheck === false));
});

test('delete removes both halves; 따로 보기 splits a pair and a later scan keeps it split', () => {
  const quotes = [bq('"Tesoro, vieni."', '"자기, 와."'), bq('"Tesoro, dai."', '"자기, 어서."')];
  const book = scan(quotes);
  const o = by(book, 'Tesoro');
  Addr.splitPair(book, by(book, '자기').id);
  assert.ok(book.entries.every((e) => !e.pairWith && !e.pairOf && !e.translation));
  assert.equal(book.split.length, 1);
  Addr.refresh(book, storeOf(quotes));
  assert.ok(book.entries.every((e) => !e.pairWith && !e.pairOf), 'a scan does not join them again');
  assert.match(Addr.injectionBlock(book, [ADEL, VITO]), /Tesoro/);
  assert.throws(() => Addr.splitPair(book, o.id), /짝/);
  // deleting a pair removes both
  const fresh = scan(quotes);
  Addr.deleteEntry(fresh, by(fresh, '자기').id);
  assert.equal(fresh.entries.length, 0);
  // an old file without any pair fields still reads fine
  const old = { version: 1, entries: [{ from: ADEL, to: VITO, term: 'Tesoro', count: 3, source: 'auto' }, { from: ADEL, to: VITO, term: '자기', count: 3, source: 'auto' }], suggestions: [] };
  assert.equal(Addr.normalize(old).length, 2);
  assert.ok(Addr.view(old, { addressBook: true }).entries.every((e) => !e.pairWith));
});

test('screen: a pair is one row "원어(번역) ×N" with the toggle, edit, delete and 따로 보기', () => {
  const source = fs.readFileSync(path.join(__dirname, '../extension/runtime.js'), 'utf8').replace(/\r\n/g, '\n');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const start = source.indexOf('  function addressPaper(');
  const paper = vm.runInNewContext(`(${source.slice(start, source.indexOf('\n  }\n', start) + 4).trim()})`, { esc });
  const a = { addressBook: true, learnFromEdits: false, suggestions: [], entries: [
    { id: 'o1', from: ADEL, to: VITO, term: 'Tesoro', count: 3, pairCount: 4, source: 'auto', useForCheck: false, translation: '자기', pairWith: 'k1' },
    { id: 'k1', from: ADEL, to: VITO, term: '자기', count: 4, pairCount: 4, source: 'auto', useForCheck: true, pairOf: 'o1' },
    { id: 'e2', from: ADEL, to: SILVI, term: 'Capo', count: 2, source: 'auto', useForCheck: true },
  ] };
  const html = paper(a, {}, '', []);
  assert.match(html, /호칭 사전 · 2개/, 'a pair is one entry');
  assert.match(html, /<b>Tesoro\(자기\)<\/b> ×4/);
  assert.doesNotMatch(html, /<b>자기<\/b>/, 'the Korean half has no row of its own');
  assert.match(html, /data-address-use="o1" checked>/, 'on while either half is on');
  assert.match(html, /data-act="addressSplit" data-id="o1">따로 보기/);
  assert.match(html, /data-act="addressEdit" data-id="o1"/);
  assert.match(html, /data-act="addressDelete" data-id="o1">둘 다 지우기/);
  assert.doesNotMatch(html, /data-act="addressSplit" data-id="e2"/, 'a single term cannot be split');
  assert.match(html, /<b>Capo<\/b> ×2/);
  assert.match(source, /case 'addressSplit'/);
  assert.match(source, /action: 'split'/);
});
