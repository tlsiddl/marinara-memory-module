'use strict';
// 호칭 사전 (addressBook) and 직접 고친 것 배우기 (learnFromEdits): one file per room, <chat>.address.json.
//
//   applied      [{ id, kind: 'address' | 'alias', sid, text, appliedAt, undone, ... }]: what 제안 자동 적용 did by itself (the last
//                MAX_APPLIED; undone ones stay so that they are never applied again).
//   entries      who calls whom what: { id, from, to, term, count, firstSeen, lastSeen, source: 'auto' | 'user' | 'auto-learned',
//                useForCheck, note? }. 'auto' entries are worked out again from the saved dialogue on every scan
//                (no model call); 'user' entries are never removed or changed by a scan except for their counts. 'auto-learned'
//                entries are the ones 제안 자동 적용 added from a suggestion; a scan treats them like 'user' ones.
//                Pairs (0.12.6): an automatic foreign term and its Korean translation that the saved bilingual lines show together
//                are linked, both entries staying as they are: the foreign one has `translation` (the Korean term) and `pairWith`
//                (its id), the Korean one `pairOf` (that id); both carry `pairCount` (distinct lines of either). The links are
//                worked out again on every scan; `book.split` lists pairs the user chose to see apart.
//   suggestions  what the user's own corrections suggest: { id, kind: 'address' | 'alias', ..., status: 'open' |
//                'ignored' | 'done' }. Nothing here changes any rule until the user accepts it.
//   edits        a short record of listeners the user changed after the module had only guessed them.
// Both are part of the module (no switch since 0.11.59). Pure logic; the service loads and saves the file.

const crypto = require('node:crypto');
const A = require('./aliases.cjs');
const S = require('./scenes.cjs');

const ADDRESS_VERSION = 1;
/** A term seen this many times (as an automatic entry) is kept; a term the user added is kept at any count. */
const MIN_COUNT = 2;
const MAX_ENTRIES = 400;
const MAX_SUGGESTIONS = 100;
const MAX_EDITS = 50;
const MAX_APPLIED = 50;
const isOwn = (e) => e?.source === 'user' || e?.source === 'auto-learned';
/** The most the injected "[호칭]" line may take. */
const INJECT_CHARS = 220;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const keyOfTerm = (term) => tidy(term).toLowerCase();
const hash = (...parts) => crypto.createHash('sha1').update(parts.join('\u0000')).digest('hex').slice(0, 10);

function emptyBook() {
  return { version: ADDRESS_VERSION, entries: [], suggestions: [], applied: [], edits: [], updatedAt: null };
}
/** Whether a parsed file is a book this module understands. */
const isBook = (v) => !!v && typeof v === 'object' && v.version === ADDRESS_VERSION && Array.isArray(v.entries);

const entryKey = (e) => `${e.from}|${e.to}|${keyOfTerm(e.term)}`;
const entryId = (e) => hash('entry', entryKey(e));
const before = (a, b) => a.number < b.number || (a.number === b.number && a.sentence < b.sentence);

/** Entries of a book as stored, with every name read through the room's name table and duplicates merged. */
function normalize(book) {
  const merged = new Map();
  for (const raw of book.entries || []) {
    const from = A.canonical(raw.from), to = A.canonical(raw.to), term = tidy(raw.term);
    if (!from || !to || !term || from === to) continue;
    // An automatic entry that is really a discourse word or a verb is dropped (the user's own entries never are).
    if (!isOwn(raw) && !S.plausibleTerm(term)) continue;
    const e = { ...raw, from, to, term };
    const key = entryKey(e);
    const old = merged.get(key);
    if (!old) { merged.set(key, { ...e, count: Number(e.count) || 0 }); continue; }
    old.count += Number(e.count) || 0;
    if (e.firstSeen && (!old.firstSeen || before(e.firstSeen, old.firstSeen))) old.firstSeen = e.firstSeen;
    if (e.lastSeen && (!old.lastSeen || before(old.lastSeen, e.lastSeen))) old.lastSeen = e.lastSeen;
    if (e.source === 'user') { old.source = 'user'; if (e.note) old.note = e.note; }
    else if (e.source === 'auto-learned' && old.source !== 'user') old.source = 'auto-learned';
    if (e.useForCheck === false) old.useForCheck = false;
  }
  const out = [...merged.values()].map((e) => ({ ...e, id: entryId(e) }));
  // A link whose other half is gone (or does not point back) is dropped.
  const byId = new Map(out.map((e) => [e.id, e]));
  for (const e of out) {
    const other = byId.get(e.pairWith || e.pairOf);
    const ok = other && other !== e && (e.pairWith ? other.pairOf === e.id : other.pairWith === e.id) && other.from === e.from && other.to === e.to;
    if (!ok) { delete e.pairWith; delete e.pairOf; delete e.translation; delete e.pairCount; }
  }
  return out;
}
/** The other half of an entry's pair (in a normalized list), or null. */
const partnerOf = (list, e) => list.find((x) => x.id === (e.pairWith || e.pairOf)) || null;
const hasKo = (t) => /[가-힣]/.test(t);
const pairKey = (o, k) => `${entryKey(o)}~${entryKey(k)}`;

/** A listener share that counts as "the" listener of a term one speaker uses toward several people. */
const MAJORITY = 0.75;

/** Terms the saved dialogue shows: Map(key) -> { from, to, term, count, firstSeen, lastSeen }. */
function tally(store) {
  const rows = new Map(); // from|listener|term -> row (single-listener lines)
  const singles = new Set(); // from|listener|term seen in a single-listener line
  const multi = []; // terms from lines to several listeners, settled below
  const opens = new Map(); // speaker|term -> listeners whose quotes it opens
  const cooc = new Map(); // from|listener|foreign|korean -> ids of lines with the foreign term in the original and the Korean one in the translation
  const bi = new Map(); // from|listener|korean -> ids of lines with a translation whose translation part holds the Korean term
  let nextId = 0;
  const add = (map, key, id) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(id); };
  const bump = (map, key, base, at, id) => {
    const row = map.get(key) || { ...base, count: 0, firstSeen: at, lastSeen: at, ids: new Set() };
    row.count++;
    row.ids.add(id);
    if (before(at, row.firstSeen)) row.firstSeen = at;
    if (before(row.lastSeen, at)) row.lastSeen = at;
    map.set(key, row);
  };
  for (const scene of store?.scenes || []) {
    const names = S.sceneNames(store, scene);
    const quotes = [...(scene.events || []).flatMap((e) => e.quotes || []), ...(scene.loose || [])];
    for (const q of quotes) {
      if (!q || !q.by || q.toGuess || !S.isDialogue(q)) continue;
      // A listener the address book itself gave does not count as evidence for the book (unless the user confirmed it).
      if (q.viaBook && !q.manual) continue;
      const listeners = [...new Set(S.splitTo(q.to).map((n) => A.canonical(n)).filter(Boolean))];
      const from = A.canonical(q.by);
      if (!from || !listeners.length || listeners.includes(from)) continue;
      const at = { number: q.number, sentence: q.sentence };
      const id = nextId++;
      const translated = typeof q.translation === 'string' && q.translation.trim();
      if (translated && listeners.length === 1) {
        const lk = `${from}|${listeners[0]}|`;
        const ours = S.vocativeTerms(q.text, names, { mid: true }).filter((t) => !hasKo(t.term));
        const theirs = S.vocativeTerms(translated, names, { mid: true }).filter((t) => hasKo(t.term));
        for (const k of theirs) {
          add(bi, `${lk}${keyOfTerm(k.term)}`, id);
          for (const o of ours) add(cooc, `${lk}${keyOfTerm(o.term)}|${keyOfTerm(k.term)}`, id);
        }
      }
      for (const { term, at: where } of S.vocativeTerms(S.quoteText(q), names, { mid: true })) {
        if (listeners.length > 1) { multi.push({ from, listeners, term, at, id }); continue; }
        const listener = listeners[0];
        if (where === 'start') {
          const ok = `${from}|${keyOfTerm(term)}`;
          if (!opens.has(ok)) opens.set(ok, new Set());
          opens.get(ok).add(listener);
        }
        const key = `${from}|${listener}|${keyOfTerm(term)}`;
        singles.add(key);
        bump(rows, key, { from, to: listener, term }, at, id);
      }
    }
  }
  // A term in a line to several people counts toward one of them only when the speaker is known to use it toward
  // that person in lines to that person alone, and toward only one of them.
  for (const m of multi) {
    const own = m.listeners.filter((l) => singles.has(`${m.from}|${l}|${keyOfTerm(m.term)}`));
    if (own.length === 1) bump(rows, `${m.from}|${own[0]}|${keyOfTerm(m.term)}`, { from: m.from, to: own[0], term: m.term }, m.at, m.id);
  }
  // One term for several listeners of one speaker belongs to the listener with the clear majority of its uses
  // (at least MIN_COUNT and MAJORITY of all); otherwise it is ambiguous and left out.
  const totals = new Map();
  for (const row of rows.values()) {
    const k = `${row.from}|${keyOfTerm(row.term)}`;
    totals.set(k, (totals.get(k) || 0) + row.count);
  }
  for (const [key, row] of rows) {
    const total = totals.get(`${row.from}|${keyOfTerm(row.term)}`);
    if (row.count < total && !(row.count >= MIN_COUNT && row.count / total >= MAJORITY)) rows.delete(key);
    else if (row.count < total) row.share = row.count / total;
  }
  // A term that is (or is a spelling of) the name of a person in the room is a name, not a nickname.
  const people = new Set([...(store?.cast || []), ...(store?.personas || []).map((p) => p?.name ?? p)].map((n) => A.canonical(n)).filter(Boolean));
  for (const row of rows.values()) { people.add(row.from); people.add(row.to); }
  const words = [...people].flatMap((p) => [p, ...p.split(/\s+/)]).filter((w) => w.length >= 2);
  const lookAlike = require('./names.cjs').lookAlike;
  for (const [key, row] of rows) {
    const t = tidy(row.term);
    if (words.some((w) => keyOfTerm(w) === keyOfTerm(t) || lookAlike(t, w))) rows.delete(key);
  }
  // Two-word terms need one more use. Non-endearment terms that open lines to two or more listeners are discourse words.
  for (const [key, row] of rows) {
    if (/\s/.test(row.term) && row.count < MIN_COUNT + 1) { rows.delete(key); continue; }
    if (S.termExempt(row.term)) continue;
    if ((opens.get(`${row.from}|${keyOfTerm(row.term)}`)?.size || 0) >= 2) rows.delete(key);
  }
  rows.cooc = cooc;
  rows.bi = bi;
  return rows;
}

/** A Korean term pairs with a foreign one seen together in at least this many lines... */
const PAIR_MIN = 2;
/** ...and in at least this share of the Korean term's uses in lines that have a translation. */
const PAIR_SHARE = 0.6;

/**
 * Links each foreign term with its Korean translation inside `entries` (fresh objects of one scan), by the lines that
 * show them together (the foreign term in the original, the Korean one in its translation: at least PAIR_MIN lines and
 * PAIR_SHARE of the Korean term's uses in translated lines) or by sound ("Lili"/"릴리"). Two Korean or two foreign terms
 * are never linked, nor two of the user's own entries; a pair the user split stays apart. Each term has one partner at most.
 */
function pairUp(entries, found, split) {
  const apart = new Set(split || []);
  const groups = new Map();
  for (const e of entries) {
    delete e.pairWith; delete e.pairOf; delete e.translation; delete e.pairCount;
    const key = `${e.from}|${e.to}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const [gk, list] of groups) {
    const cands = [];
    for (const o of list.filter((e) => !hasKo(e.term))) {
      for (const k of list.filter((e) => hasKo(e.term))) {
        if (isOwn(o) && isOwn(k)) continue;
        if (apart.has(pairKey(o, k))) continue;
        const c = found?.cooc?.get(`${gk}|${keyOfTerm(o.term)}|${keyOfTerm(k.term)}`)?.size || 0;
        const total = found?.bi?.get(`${gk}|${keyOfTerm(k.term)}`)?.size || 0;
        const seen = c >= PAIR_MIN && total > 0 && c / total >= PAIR_SHARE;
        const sound = sameSound(o.term, k.term);
        if (seen || sound) cands.push({ o, k, c, sound });
      }
    }
    cands.sort((a, b) => b.c - a.c || (b.sound ? 1 : 0) - (a.sound ? 1 : 0));
    const used = new Set();
    for (const { o, k } of cands) {
      if (used.has(o) || used.has(k)) continue;
      used.add(o); used.add(k);
      const ids = new Set([...(found?.get(`${gk}|${keyOfTerm(o.term)}`)?.ids || []), ...(found?.get(`${gk}|${keyOfTerm(k.term)}`)?.ids || [])]);
      const count = ids.size || Math.max(o.count || 0, k.count || 0);
      o.translation = k.term; o.pairWith = k.id; o.pairCount = count;
      k.pairOf = o.id; k.pairCount = count;
    }
  }
}

/**
 * Bring the book up to date with the saved dialogue: automatic entries are replaced by what the dialogue shows now
 * (terms seen at least MIN_COUNT times), user entries stay and only get their counts and places updated. A switch the
 * user set on an automatic entry is kept. Returns true when anything changed.
 */
function refresh(book, store) {
  const found = tally(store);
  const old = new Map(normalize(book).map((e) => [entryKey(e), e]));
  const next = [];
  for (const [key, row] of found) {
    const prev = old.get(key);
    if (isOwn(prev)) continue;
    if (row.count < MIN_COUNT) continue;
    next.push({ id: entryId(row), from: row.from, to: row.to, term: prev?.term || row.term, count: row.count, firstSeen: row.firstSeen, lastSeen: row.lastSeen, source: 'auto', useForCheck: prev?.useForCheck === false ? false : true });
  }
  for (const [key, prev] of old) {
    if (!isOwn(prev)) continue;
    const row = found.get(key);
    next.push({ ...prev, count: row ? row.count : prev.count || 0, ...(row ? { firstSeen: row.firstSeen, lastSeen: row.lastSeen } : {}) });
  }
  next.sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.term.localeCompare(b.term));
  const entries = next.slice(0, MAX_ENTRIES);
  for (const e of entries) e.id = e.id || entryId(e);
  pairUp(entries, found, book.split);
  if (JSON.stringify(entries) === JSON.stringify(book.entries)) return false;
  book.entries = entries;
  book.updatedAt = new Date().toISOString();
  return true;
}

/** Terms the rules may use: Map(key) -> the one person it calls. A term that calls two people is left out. */
function termMap(book) {
  const by = new Map();
  const list = normalize(book);
  for (const e of list) {
    // A pair is used when either half is switched on.
    if (e.useForCheck === false) { const other = partnerOf(list, e); if (!other || other.useForCheck === false) continue; }
    const key = keyOfTerm(e.term);
    const set = by.get(key) || new Set();
    set.add(e.to);
    by.set(key, set);
  }
  const out = new Map();
  for (const [key, set] of by) if (set.size === 1) out.set(key, [...set][0]);
  return out;
}

const skeleton = (o) => o.replace(/V/g, '');
/** Whether a Korean and a Latin spelling are the same word by sound ("Lili"/"릴리", "Nami"/"나미", "Boss"/"보스"). */
function sameSound(a, b) {
  const ko = /^[가-힣\s]+$/, la = /^[\p{Script=Latin}\s'’.-]+$/u;
  if (!((ko.test(a) && la.test(b)) || (la.test(a) && ko.test(b)))) return false;
  try { if (require('./names.cjs').lookAlike(a, b)) return true; } catch { /* fall through */ }
  const [k, e] = ko.test(a) ? [a, b] : [b, a];
  const sk = skeleton(S.hangulOutline(k.replace(/\s/g, '')));
  return sk.length >= 2 && S.latinOutlines(e).some((o) => skeleton(o) === sk);
}

/** "모모" and "모모오": one call with a stretched ending. */
const stretched = (a, b) => { const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return l.length === s.length + 1 && l.startsWith(s) && '이야아'.includes(l.slice(-1)) && /[가-힣]$/.test(s); };

/** The terms of one pair with spellings of the same word merged (the more used spelling stays; a tie goes to Korean). */
function groupTerms(entries, split) {
  const apart = new Set(split || []);
  const list = entries.slice().sort((a, b) => b.count - a.count || (/[가-힣]/.test(b.term) ? 1 : 0) - (/[가-힣]/.test(a.term) ? 1 : 0) || a.term.localeCompare(b.term));
  const out = [];
  for (const e of list) {
    const same = out.find((g) => keyOfTerm(g.term) === keyOfTerm(e.term) || (!(g.entry && (apart.has(pairKey(g.entry, e)) || apart.has(pairKey(e, g.entry)))) && (sameSound(g.term, e.term) || stretched(g.term, e.term))));
    if (same) {
      same.count = Math.max(same.count, e.count);
      if (!/[가-힣]/.test(same.term) && /[가-힣]/.test(e.term)) { same.term = e.term; same.entry = e; } // the Korean spelling is shown
    } else out.push({ term: e.term, count: e.count, entry: e });
  }
  return out;
}

/**
 * "[호칭] A→B: 보스 · B→C: 릴리": only pairs where both are in `present`, the most used first, within `max` characters.
 * Spellings of one word count once. Every pair gets its most used term before any pair gets a second one; the extra
 * terms of a pair share it ("A→B: 보스/대장"). Empty string when nothing qualifies.
 */
function injectionBlock(book, present, max = INJECT_CHARS) {
  const here = new Set([...(present || [])].map((n) => A.canonical(n)));
  if (!here.size) return '';
  const pairs = new Map();
  const all = normalize(book);
  for (const e of all) {
    if (!here.has(e.from) || !here.has(e.to)) continue;
    const key = `${e.from}→${e.to}`;
    const row = pairs.get(key) || { label: key, entries: [], count: 0 };
    pairs.set(key, row);
    if (e.pairOf && all.some((x) => x.id === e.pairOf)) continue; // shown with its foreign half
    const other = e.pairWith ? partnerOf(all, e) : null;
    // "원어(번역)": a pair is one term, as often used as the lines holding either form.
    const shown = other ? { ...e, term: `${e.term}(${other.term})`, count: e.pairCount || Math.max(e.count, other.count), paired: true } : e;
    row.entries.push(shown);
    row.count += shown.count;
  }
  const rows = [...pairs.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  for (const row of rows) { row.terms = groupTerms(row.entries, book.split).map((g) => g.term); row.n = 0; }
  const render = () => '[호칭] ' + rows.filter((r) => r.n).map((r) => `${r.label}: ${r.terms.slice(0, r.n).join('/')}`).join(' · ');
  const fits = () => rows.some((r) => r.n) && render().length <= max;
  // Round 1: the top term of every pair; later rounds: one more term per pair, in the same order.
  for (let round = 1; round <= Math.max(0, ...rows.map((r) => r.terms.length)); round++) {
    for (const row of rows) {
      if (row.terms.length < round || row.n !== round - 1) continue;
      row.n = round;
      if (render().length > max) row.n = round - 1;
    }
  }
  return fits() ? render() : '';
}

/* ---------- hand-made entries ---------- */

function checkEntry(input) {
  const from = A.canonical(input?.from), to = A.canonical(input?.to), term = tidy(input?.term);
  if (!from || !to) throw Error('부르는 사람과 불리는 사람을 모두 적어 주세요.');
  if (from === to) throw Error('부르는 사람과 불리는 사람이 같습니다.');
  if (!term) throw Error('부르는 말을 적어 주세요.');
  if (term.length > 40) throw Error('부르는 말이 너무 깁니다(40자까지).');
  const note = tidy(input?.note).slice(0, 120);
  return { from, to, term, note };
}

function addEntry(book, input) {
  const { from, to, term, note } = checkEntry(input);
  const entries = normalize(book);
  const key = entryKey({ from, to, term });
  const found = entries.find((e) => entryKey(e) === key);
  if (found) {
    found.source = 'user';
    if (note) found.note = note;
    book.entries = entries;
    return found;
  }
  if (entries.length >= MAX_ENTRIES) throw Error(`호칭은 방마다 ${MAX_ENTRIES}개까지 둘 수 있습니다.`);
  const entry = { id: entryId({ from, to, term }), from, to, term, count: 0, firstSeen: null, lastSeen: null, source: 'user', useForCheck: true, ...(note ? { note } : {}) };
  book.entries = [...entries, entry];
  book.updatedAt = new Date().toISOString();
  return entry;
}

function editEntry(book, id, input) {
  const entries = normalize(book);
  const at = entries.findIndex((e) => e.id === id);
  if (at < 0) throw Error('해당 호칭을 찾지 못했습니다.');
  const old = entries[at];
  const { from, to, term, note } = checkEntry({ from: input?.from ?? old.from, to: input?.to ?? old.to, term: input?.term ?? old.term, note: input?.note ?? old.note });
  const moved = { ...old, from, to, term, source: 'user' };
  if (note) moved.note = note; else delete moved.note;
  moved.id = entryId(moved);
  if (moved.id !== old.id && entries.some((e) => e.id === moved.id)) throw Error('이미 같은 호칭이 있습니다.');
  entries[at] = moved;
  book.entries = entries;
  book.updatedAt = new Date().toISOString();
  return moved;
}

function deleteEntry(book, id) {
  const entries = normalize(book);
  const found = entries.find((e) => e.id === id);
  if (!found) throw Error('해당 호칭을 찾지 못했습니다.');
  const other = partnerOf(entries, found); // a pair goes as one
  book.entries = entries.filter((e) => e.id !== id && e.id !== other?.id);
  book.updatedAt = new Date().toISOString();
  return found;
}

function toggleEntry(book, id, on) {
  const entries = normalize(book);
  const found = entries.find((e) => e.id === id);
  if (!found) throw Error('해당 호칭을 찾지 못했습니다.');
  found.useForCheck = on !== false;
  const other = partnerOf(entries, found); // a pair is switched as one
  if (other) other.useForCheck = found.useForCheck;
  book.entries = entries;
  book.updatedAt = new Date().toISOString();
  return found;
}

/** "따로 보기": a pair is shown as two entries again, and a later scan does not join them. Returns the two entries. */
function splitPair(book, id) {
  const entries = normalize(book);
  const found = entries.find((e) => e.id === id);
  if (!found) throw Error('해당 호칭을 찾지 못했습니다.');
  const other = partnerOf(entries, found);
  if (!other) throw Error('짝이 있는 호칭이 아닙니다.');
  const [o, k] = found.pairWith ? [found, other] : [other, found];
  const key = pairKey(o, k);
  book.split = [...new Set([...(book.split || []), key])].slice(-MAX_ENTRIES);
  for (const e of [o, k]) { delete e.pairWith; delete e.pairOf; delete e.translation; delete e.pairCount; }
  book.entries = entries;
  book.updatedAt = new Date().toISOString();
  return [o, k];
}

/* ---------- suggestions from the user's own corrections ---------- */

const suggestionId = (s) => hash(s.kind, A.canonical(s.from ?? s.source), A.canonical(s.to ?? s.target), keyOfTerm(s.term ?? ''));

function pushSuggestion(book, s) {
  const suggestions = book.suggestions || (book.suggestions = []);
  const id = suggestionId(s);
  // Asked about before (open, ignored or accepted): never again.
  if (suggestions.some((x) => x.id === id)) return null;
  const item = { ...s, id, status: 'open', createdAt: new Date().toISOString() };
  suggestions.push(item);
  if (suggestions.length > MAX_SUGGESTIONS) {
    // Open ones stay; the oldest answered ones go (their ids may then be asked once more).
    const drop = suggestions.findIndex((x) => x.status !== 'open');
    if (drop >= 0) suggestions.splice(drop, 1); else suggestions.shift();
  }
  book.updatedAt = item.createdAt;
  return item;
}

function recordEdit(book, edit) {
  const edits = book.edits || (book.edits = []);
  edits.push({ ...edit, at: new Date().toISOString() });
  if (edits.length > MAX_EDITS) edits.splice(0, edits.length - MAX_EDITS);
}

function answerSuggestion(book, id, status) {
  const item = (book.suggestions || []).find((x) => x.id === id);
  if (!item) throw Error('해당 제안을 찾지 못했습니다.');
  if (item.status !== 'open') throw Error('이미 답한 제안입니다.');
  item.status = status;
  item.answeredAt = new Date().toISOString();
  book.updatedAt = item.answeredAt;
  return item;
}

/**
 * Suggestions from one scene edit. `oldScene` and `newScene` are the scene before and after; `store` the scene store as
 * it was before the edit (for counting how often a name was used); `table` the name table.
 *   address: the line starts with a term and the user set its listener -> speaker calls listener that
 *   alias:   the user replaced a name N with M in lines (N not a person of its own in the scene) and N was used >= 2 times
 *   guess:   the user changed a listener the module had only guessed (recorded, nothing suggested)
 * `options.address` is false when the address book is off (no address suggestions then).
 */
function learnFromSceneEdit(book, { store, oldScene, newScene, table, options = {} }) {
  const quotesOf = (scene) => [...(scene?.events || []).flatMap((e) => e.quotes || []), ...(scene?.loose || [])];
  const place = (q) => `${q.number}.${q.sentence}`;
  const old = new Map(quotesOf(oldScene).map((q) => [place(q), q]));
  const names = S.sceneNames(store, newScene);
  const made = { address: 0, alias: 0, guess: 0 };
  const created = [];
  const push = (s) => { const item = pushSuggestion(book, s); if (item) created.push(item.id); return item; };
  const swapped = new Map();
  const canon = (n) => A.canonical(n, table);
  for (const q of quotesOf(newScene)) {
    const prev = old.get(place(q));
    if (!prev) continue;
    const by = tidy(q.by), to = tidy(q.to), pBy = tidy(prev.by), pTo = tidy(prev.to);
    if (by === pBy && to === pTo) continue;
    // (c) a guessed listener the user replaced
    if (prev.toGuess && to !== pTo) {
      recordEdit(book, { kind: 'guess', number: q.number, sentence: q.sentence, guessed: pTo || null, set: to || null });
      made.guess++;
    }
    // (a) a term that opens the line, and the listener the user gave it
    if (options.address && to && to !== pTo && by && !q.toGuess && S.splitTo(to).length === 1 && S.isDialogue(q)) {
      const first = S.vocativeTerms(S.quoteText(q), names)[0];
      if (first?.at === 'start') {
        const from = canon(by), listener = canon(to);
        const exists = normalize(book).some((e) => e.from === from && e.to === listener && keyOfTerm(e.term) === first.key);
        if (from && listener && from !== listener && !exists && push({ kind: 'address', from, to: listener, term: first.term, number: q.number, sentence: q.sentence })) made.address++;
      }
    }
    // (b) a name replaced by another one
    // (a listener the module only guessed is no evidence of a spelling)
    for (const [n, m] of [...replaced(pBy, by), ...(prev.toGuess ? [] : replaced(pTo, to))]) swapped.set(`${n}|${m}`, [n, m]);
  }
  for (const [n, m] of swapped.values()) {
    if (A.canonOf(n, table) && A.canonOf(n, table) === A.canonOf(m, table)) continue;
    if (A.dismissed(table, n, m)) continue;
    // Someone present in the scene (or the user's own character) is a person, not another spelling.
    const people = [...(newScene.present || []), ...(newScene.events || []).flatMap((e) => e.with || []), ...(store.personas || [])];
    if (people.some((p) => canon(p) === canon(n))) continue;
    if (uses(store, n) < 2) continue;
    if (push({ kind: 'alias', source: n, target: canon(m), count: uses(store, n) })) made.alias++;
  }
  // 제안 자동 적용: the suggestions this very edit made are applied at once (older open ones wait for a click).
  if (options.auto) {
    made.applied = 0;
    made.appliedAlias = 0;
    for (const id of created) {
      const rec = autoApply(book, id, { table });
      if (rec) { made.applied++; if (rec.kind === 'alias') made.appliedAlias++; }
    }
  }
  return made;
}

const appliedId = (sid) => hash('applied', sid);

/**
 * Applies one open suggestion at once (제안 자동 적용) and records it in book.applied. An address suggestion adds the
 * entry (source 'auto-learned'); an alias suggestion registers the other name in `table` (rewrite: false, as an accepted
 * one would). Returns the record, or null when nothing was done: the suggestion is answered, was applied before (an undone
 * one never again), the entry already exists, or the name table refuses (the suggestion then stays open for a click).
 */
function autoApply(book, sid, { table, now = new Date().toISOString() } = {}) {
  const sug = (book.suggestions || []).find((x) => x.id === sid);
  if (!sug || sug.status !== 'open') return null;
  if ((book.applied || []).some((a) => a.sid === sid || a.id === appliedId(sid))) return null;
  let rec;
  if (sug.kind === 'address') {
    const key = entryKey({ from: sug.from, to: sug.to, term: sug.term });
    if (normalize(book).some((e) => entryKey(e) === key)) return null;
    let entry;
    try { entry = addEntry(book, { from: sug.from, to: sug.to, term: sug.term }); } catch { return null; }
    book.entries = book.entries.map((e) => (e.id === entry.id ? { ...e, source: 'auto-learned' } : e));
    rec = { id: appliedId(sid), kind: 'address', sid, entryId: entry.id, from: entry.from, to: entry.to, term: entry.term, text: `‘${entry.term}’ = ${entry.from}이(가) ${entry.to}을(를) 부르는 말`, appliedAt: now, undone: false };
  } else if (sug.kind === 'alias') {
    if (!table) return null;
    let made;
    try { made = A.addAliasUndoable(table, sug.source, sug.target, { rewrite: false }); } catch { return null; }
    rec = { id: appliedId(sid), kind: 'alias', sid, source: sug.source, target: made.name, text: `‘${sug.source}’ = ${made.name}의 다른 이름`, appliedAt: now, undone: false, undo: made.undo };
  } else return null;
  sug.status = 'done';
  sug.auto = true;
  sug.answeredAt = now;
  book.applied = [...(book.applied || []), rec].slice(-MAX_APPLIED);
  book.updatedAt = now;
  return rec;
}

/**
 * Takes back one automatic application: the entry (or the alias, in `table`) goes again and the suggestion counts as
 * ignored, so it is never asked or applied again. An entry the user took over since (edited, so 'user') is left alone.
 * Returns { rec, kept }: kept is true when something was left because the user had changed it.
 */
function undoApplied(book, id, { table, now = new Date().toISOString() } = {}) {
  const rec = (book.applied || []).find((a) => a.id === id);
  if (!rec) throw Error('해당 자동 적용 기록을 찾지 못했습니다.');
  if (rec.undone) throw Error('이미 되돌렸습니다.');
  let kept = false;
  if (rec.kind === 'address') {
    const entries = normalize(book);
    const found = entries.find((e) => e.id === rec.entryId);
    if (found && found.source === 'auto-learned') book.entries = entries.filter((e) => e.id !== rec.entryId);
    else if (found) kept = true;
  } else if (rec.kind === 'alias') {
    if (!table) throw Error('이름 표를 찾지 못했습니다.');
    A.undoAlias(table, rec.undo);
  }
  const sug = (book.suggestions || []).find((x) => x.id === rec.sid);
  if (sug) { sug.status = 'ignored'; sug.answeredAt = now; }
  rec.undone = true;
  rec.undoneAt = now;
  book.updatedAt = now;
  return { rec, kept };
}

/** What the screen lists under "자동으로 적용함": the ones not undone, newest first. */
const appliedView = (book) => (book?.applied || []).filter((a) => !a.undone).map((a) => ({ id: a.id, kind: a.kind, text: a.text, appliedAt: a.appliedAt })).reverse();

/** How many saved lines name this exact name as speaker or listener (before the edit). */
function uses(store, name) {
  let n = 0;
  for (const scene of store?.scenes || []) {
    for (const q of [...(scene.events || []).flatMap((e) => e.quotes || []), ...(scene.loose || [])]) {
      if (tidy(q.by) === name) n++;
      n += S.splitTo(q.to).filter((t) => t === name).length;
    }
  }
  return n;
}

/** [old name, new name] for each place of a speaker/listener value where one name was swapped for another. */
function replaced(a, b) {
  const x = S.splitTo(a), y = S.splitTo(b);
  if (!x.length || x.length !== y.length) return [];
  return x.map((n, i) => [n, y[i]]).filter(([n, m]) => n !== m);
}

/** The part of the book the screen shows. */
function view(book, { addressBook, learnFromEdits }) {
  return {
    addressBook: !!addressBook,
    learnFromEdits: !!learnFromEdits,
    entries: normalize(book).map((e) => ({ ...e })),
    suggestions: (book.suggestions || []).filter((s) => s.status === 'open'),
    applied: appliedView(book),
    edits: (book.edits || []).slice(-10),
  };
}

module.exports = {
  ADDRESS_VERSION, MIN_COUNT, INJECT_CHARS, emptyBook, isBook, normalize, tally, refresh, termMap, injectionBlock,
  MAX_APPLIED, autoApply, undoApplied, appliedView, addEntry, editEntry, deleteEntry, toggleEntry, splitPair, pairUp, pushSuggestion, answerSuggestion, recordEdit, learnFromSceneEdit, view, entryKey, keyOfTerm,
};
