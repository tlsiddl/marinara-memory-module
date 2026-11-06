'use strict';
// 호칭 사전 (addressBook) and 직접 고친 것 배우기 (learnFromEdits): one file per room, <chat>.address.json.
//
//   entries      who calls whom what: { id, from, to, term, count, firstSeen, lastSeen, source: 'auto' | 'user',
//                useForCheck, note? }. 'auto' entries are worked out again from the saved dialogue on every scan
//                (no model call); 'user' entries are never removed or changed by a scan except for their counts.
//   suggestions  what the user's own corrections suggest: { id, kind: 'address' | 'alias', ..., status: 'open' |
//                'ignored' | 'done' }. Nothing here changes any rule until the user accepts it.
//   edits        a short record of listeners the user changed after the module had only guessed them.
// Pure logic; the service loads and saves the file and decides whether the features are on.

const crypto = require('node:crypto');
const A = require('./aliases.cjs');
const S = require('./scenes.cjs');

const ADDRESS_VERSION = 1;
/** A term seen this many times (as an automatic entry) is kept; a term the user added is kept at any count. */
const MIN_COUNT = 2;
const MAX_ENTRIES = 400;
const MAX_SUGGESTIONS = 100;
const MAX_EDITS = 50;
/** The most the injected "[호칭]" line may take. */
const INJECT_CHARS = 120;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const keyOfTerm = (term) => tidy(term).toLowerCase();
const hash = (...parts) => crypto.createHash('sha1').update(parts.join('\u0000')).digest('hex').slice(0, 10);

function emptyBook() {
  return { version: ADDRESS_VERSION, entries: [], suggestions: [], edits: [], updatedAt: null };
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
    const e = { ...raw, from, to, term };
    const key = entryKey(e);
    const old = merged.get(key);
    if (!old) { merged.set(key, { ...e, count: Number(e.count) || 0 }); continue; }
    old.count += Number(e.count) || 0;
    if (e.firstSeen && (!old.firstSeen || before(e.firstSeen, old.firstSeen))) old.firstSeen = e.firstSeen;
    if (e.lastSeen && (!old.lastSeen || before(old.lastSeen, e.lastSeen))) old.lastSeen = e.lastSeen;
    if (e.source === 'user') { old.source = 'user'; if (e.note) old.note = e.note; }
    if (e.useForCheck === false) old.useForCheck = false;
  }
  return [...merged.values()].map((e) => ({ ...e, id: entryId(e) }));
}

/** Terms the saved dialogue shows: Map(key) -> { from, to, term, count, firstSeen, lastSeen }. */
function tally(store) {
  const out = new Map();
  for (const scene of store?.scenes || []) {
    const names = S.sceneNames(store, scene);
    const quotes = [...(scene.events || []).flatMap((e) => e.quotes || []), ...(scene.loose || [])];
    for (const q of quotes) {
      if (!q || !q.by || q.toGuess || !S.isDialogue(q)) continue;
      // A listener the address book itself gave does not count as evidence for the book (unless the user confirmed it).
      if (q.viaBook && !q.manual) continue;
      const to = S.splitTo(q.to);
      if (to.length !== 1) continue;
      const from = A.canonical(q.by), listener = A.canonical(to[0]);
      if (!from || !listener || from === listener) continue;
      const at = { number: q.number, sentence: q.sentence };
      for (const { term } of S.vocativeTerms(S.quoteText(q), names)) {
        const key = `${from}|${listener}|${keyOfTerm(term)}`;
        const row = out.get(key) || { from, to: listener, term, count: 0, firstSeen: at, lastSeen: at };
        row.count++;
        if (before(at, row.firstSeen)) row.firstSeen = at;
        if (before(row.lastSeen, at)) row.lastSeen = at;
        out.set(key, row);
      }
    }
  }
  return out;
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
    if (prev?.source === 'user') continue;
    if (row.count < MIN_COUNT) continue;
    next.push({ id: entryId(row), from: row.from, to: row.to, term: prev?.term || row.term, count: row.count, firstSeen: row.firstSeen, lastSeen: row.lastSeen, source: 'auto', useForCheck: prev?.useForCheck === false ? false : true });
  }
  for (const [key, prev] of old) {
    if (prev.source !== 'user') continue;
    const row = found.get(key);
    next.push({ ...prev, count: row ? row.count : prev.count || 0, ...(row ? { firstSeen: row.firstSeen, lastSeen: row.lastSeen } : {}) });
  }
  next.sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.term.localeCompare(b.term));
  const entries = next.slice(0, MAX_ENTRIES);
  if (JSON.stringify(entries) === JSON.stringify(book.entries)) return false;
  book.entries = entries;
  book.updatedAt = new Date().toISOString();
  return true;
}

/** Terms the rules may use: Map(key) -> the one person it calls. A term that calls two people is left out. */
function termMap(book) {
  const by = new Map();
  for (const e of normalize(book)) {
    if (e.useForCheck === false) continue;
    const key = keyOfTerm(e.term);
    const set = by.get(key) || new Set();
    set.add(e.to);
    by.set(key, set);
  }
  const out = new Map();
  for (const [key, set] of by) if (set.size === 1) out.set(key, [...set][0]);
  return out;
}

/**
 * "[호칭] A→B: 보스 · B→C: 리리": only pairs where both are in `present`, the most used first, within `max` characters.
 * Several terms of one pair share the pair ("A→B: 보스/대장"). Empty string when nothing qualifies.
 */
function injectionBlock(book, present, max = INJECT_CHARS) {
  const here = new Set([...(present || [])].map((n) => A.canonical(n)));
  if (!here.size) return '';
  const pairs = new Map();
  for (const e of normalize(book)) {
    if (!here.has(e.from) || !here.has(e.to)) continue;
    const key = `${e.from}→${e.to}`;
    const row = pairs.get(key) || { label: key, terms: [], count: 0 };
    row.terms.push(e);
    row.count += e.count;
    pairs.set(key, row);
  }
  const rows = [...pairs.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  let line = '[호칭]';
  let used = 0;
  for (const row of rows) {
    const terms = row.terms.sort((a, b) => b.count - a.count).map((e) => e.term);
    // Fewer terms rather than none when the whole pair does not fit.
    let fit = null;
    for (let n = terms.length; n >= 1 && !fit; n--) {
      const text = `${row.label}: ${terms.slice(0, n).join('/')}`;
      if (line.length + (used ? 3 : 1) + text.length <= max) fit = text;
    }
    if (!fit) continue;
    line += `${used ? ' · ' : ' '}${fit}`;
    used++;
  }
  return used ? line : '';
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
  book.entries = entries.filter((e) => e.id !== id);
  book.updatedAt = new Date().toISOString();
  return found;
}

function toggleEntry(book, id, on) {
  const entries = normalize(book);
  const found = entries.find((e) => e.id === id);
  if (!found) throw Error('해당 호칭을 찾지 못했습니다.');
  found.useForCheck = on !== false;
  book.entries = entries;
  book.updatedAt = new Date().toISOString();
  return found;
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
        if (from && listener && from !== listener && !exists && pushSuggestion(book, { kind: 'address', from, to: listener, term: first.term, number: q.number, sentence: q.sentence })) made.address++;
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
    if (pushSuggestion(book, { kind: 'alias', source: n, target: canon(m), count: uses(store, n) })) made.alias++;
  }
  return made;
}

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
    edits: (book.edits || []).slice(-10),
  };
}

module.exports = {
  ADDRESS_VERSION, MIN_COUNT, INJECT_CHARS, emptyBook, isBook, normalize, tally, refresh, termMap, injectionBlock,
  addEntry, editEntry, deleteEntry, toggleEntry, pushSuggestion, answerSuggestion, recordEdit, learnFromSceneEdit, view, entryKey, keyOfTerm,
};
