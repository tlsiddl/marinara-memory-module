'use strict';
// One table per room of the other names a person goes by: canonical name → aliases (Korean/English forms, a nickname
// the story used early on, a form the user merged in). Every name comparison in the module asks this table first,
// through matchName (ledger.cjs) and matchAlias (scenes.cjs).
// Pure logic; the service loads and saves the table (<chat>.names.json) and runs each job inside `using`.

const { AsyncLocalStorage } = require('node:async_hooks');

const NAMES_VERSION = 1;
const HISTORY_KEEP = 5;

function emptyTable() {
  return { version: NAMES_VERSION, people: {}, dismissed: [], history: [], updatedAt: null };
}

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const fold = (s) => tidy(s).toLowerCase();

/* ---------- the table of the room being worked on ---------- */

const als = new AsyncLocalStorage();
let loader = null;
/** How a chat id becomes its table (set by the service). */
function setLoader(fn) {
  loader = typeof fn === 'function' ? fn : null;
}
/** Run fn with this table (or the table of this chat id) as the one every name comparison uses. */
function using(source, fn) {
  return als.run(source ?? null, fn);
}
function current() {
  const s = als.getStore();
  if (!s) return null;
  if (typeof s === 'string') {
    try {
      return loader ? loader(s) : null;
    } catch {
      return null;
    }
  }
  return s;
}

const indexes = new WeakMap();
/** lower-cased name or alias → canonical name. */
function indexOf(table) {
  if (!table || typeof table !== 'object') return null;
  let idx = indexes.get(table);
  if (idx && idx.rev === (table.rev || 0)) return idx.map;
  const map = new Map();
  for (const canon of Object.keys(table.people || {})) {
    if (!map.has(fold(canon))) map.set(fold(canon), canon);
  }
  for (const [canon, entry] of Object.entries(table.people || {})) {
    for (const a of entry?.aliases || []) if (fold(a) && !map.has(fold(a))) map.set(fold(a), canon);
  }
  idx = { rev: table.rev || 0, map };
  indexes.set(table, idx);
  return map;
}

/** The canonical name this exact name or alias stands for (case and spacing aside); null when the table does not know it. */
function canonOf(raw, table = current()) {
  const map = indexOf(table);
  if (!map) return null;
  return map.get(fold(raw)) || null;
}
/** The canonical name, or the name itself. */
const canonical = (raw, table = current()) => canonOf(raw, table) || tidy(raw);
/** Every name the person goes by (canonical first); just the name itself when the table does not know them. */
function formsOf(name, table = current()) {
  const canon = canonOf(name, table);
  if (!canon) return [tidy(name)].filter(Boolean);
  return [...new Set([canon, ...(table.people[canon]?.aliases || []).map(tidy)].filter(Boolean))];
}
/** The form to write in running text ("display" chosen in the rename tool), or the canonical name. */
function displayOf(name, table = current()) {
  const canon = canonOf(name, table);
  return (canon && tidy(table.people[canon]?.display)) || canon || tidy(name);
}
/** [form, person] pairs for a list of names: each name and every alias of it, with the canonical person. */
function namePairs(names, table = current()) {
  const out = [];
  const seen = new Set();
  for (const n of Array.isArray(names) ? names : []) {
    if (typeof n !== 'string' || !n.trim()) continue;
    const person = canonOf(n, table) || n.trim();
    for (const form of table ? [n.trim(), ...formsOf(n, table)] : [n.trim()]) {
      const key = `${form}\u0000${person}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([form, person]);
    }
  }
  return out;
}

/* ---------- editing the table ---------- */

/** "Kassian (카시안)", "카시안 / Kassian": a card or persona name written in two scripts gives both as aliases. */
function scriptForms(name) {
  const n = tidy(name);
  const out = new Set();
  const paren = n.match(/^(.+?)\s*[(（\[]\s*(.+?)\s*[)）\]]$/);
  if (paren) out.add(tidy(paren[1])).add(tidy(paren[2]));
  for (const part of n.split(/\s*[/|·]\s*/)) if (part && part !== n) out.add(tidy(part));
  return [...out].filter((x) => x && x !== n && x.replace(/\s/g, '').length >= 2);
}

/** Add a person (and aliases) to the table. An alias that already belongs to someone else is left where it is. */
function addPerson(table, canon, aliases = [], { seeded = false } = {}) {
  const name = tidy(canon);
  if (!name) return false;
  table.people ||= {};
  const owner = canonOf(name, table);
  const target = owner || name;
  let changed = false;
  if (!table.people[target]) {
    table.people[target] = { aliases: [], display: null, ...(seeded ? { seeded: true } : {}) };
    changed = true;
  }
  const entry = table.people[target];
  for (const a of aliases.map(tidy).filter(Boolean)) {
    if (fold(a) === fold(target) || entry.aliases.some((x) => fold(x) === fold(a))) continue;
    const other = canonOf(a, table);
    if (other && other !== target) continue;
    entry.aliases.push(a);
    changed = true;
  }
  if (changed) touch(table);
  return changed;
}

/** The card and persona names of the room, each a person of its own with the forms its name is written in. */
function seed(table, names) {
  let changed = false;
  for (const n of Array.isArray(names) ? names : []) {
    if (typeof n !== 'string' || !tidy(n)) continue;
    if (canonOf(n, table) && !scriptForms(n).length) continue;
    changed = addPerson(table, n, scriptForms(n), { seeded: true }) || changed;
  }
  return changed;
}

/**
 * Make `source` another name of `target`: the source's own aliases go with it, and the display form is kept.
 * A source that was a person of its own is folded into the target.
 */
function addAlias(table, source, target, { display, rewrite = true } = {}) {
  const from = tidy(source);
  const to = canonOf(target, table) || tidy(target);
  if (!from || !to) throw Error('이름이 비어 있습니다.');
  table.people ||= {};
  // Renaming a person to one of their own aliases (undoing a wrong rename by hand): that alias becomes the name.
  const sameCanon = canonOf(from, table);
  if (sameCanon && sameCanon === canonOf(target, table) && fold(target) !== fold(sameCanon) && fold(from) === fold(sameCanon)) {
    const entry = table.people[sameCanon];
    delete table.people[sameCanon];
    const name = tidy(target);
    entry.aliases = [sameCanon, ...(entry.aliases || []).filter((a) => fold(a) !== fold(name) && fold(a) !== fold(sameCanon))];
    if (display !== undefined) entry.display = tidy(display) && fold(display) !== fold(name) ? tidy(display) : null;
    if (rewrite) entry.rewrite = true;
    table.people[name] = entry;
    touch(table);
    return name;
  }
  if (fold(from) === fold(to)) throw Error('같은 이름입니다.');
  const own = table.people[canonOf(from, table) || ''];
  const sourceCanon = canonOf(from, table);
  table.people[to] ||= { aliases: [], display: null };
  const entry = table.people[to];
  const moved = [from, ...(sourceCanon && sourceCanon !== to ? [sourceCanon, ...(own?.aliases || [])] : [])];
  if (sourceCanon && sourceCanon !== to) delete table.people[sourceCanon];
  for (const a of moved) if (fold(a) !== fold(to) && !entry.aliases.some((x) => fold(x) === fold(a))) entry.aliases.push(tidy(a));
  if (display !== undefined) entry.display = tidy(display) && fold(display) !== fold(to) ? tidy(display) : null;
  if (rewrite) entry.rewrite = true;
  table.dismissed = (table.dismissed || []).filter((d) => !(fold(d[0]) === fold(from) && fold(d[1]) === fold(to)));
  touch(table);
  return to;
}

function dismiss(table, source, target) {
  table.dismissed ||= [];
  if (!table.dismissed.some((d) => fold(d[0]) === fold(source) && fold(d[1]) === fold(target))) table.dismissed.push([tidy(source), tidy(target)]);
  touch(table);
}
const dismissed = (table, a, b) => (table?.dismissed || []).some((d) => (fold(d[0]) === fold(a) && fold(d[1]) === fold(b)) || (fold(d[0]) === fold(b) && fold(d[1]) === fold(a)));

function touch(table) {
  // The revision tells a cached index that the table changed.
  table.rev = (table.rev || 0) + 1;
  table.updatedAt = new Date().toISOString();
}

/** Keep the change list of the last few renames, for undo. */
function pushHistory(table, entry) {
  table.history = [...(table.history || []), entry].slice(-HISTORY_KEEP);
  touch(table);
}

/** People whose new memory text is written with their chosen name (they were renamed or merged by hand). */
function rewrites(table = current()) {
  const out = [];
  for (const [canon, entry] of Object.entries(table?.people || {})) {
    if (!entry?.rewrite) continue;
    for (const a of entry.aliases || []) if (fold(a) !== fold(canon)) out.push({ from: a, to: canon, display: tidy(entry.display) || canon });
  }
  // Longer names first, so "Kassian Vale" is replaced before "Kassian".
  return out.sort((a, b) => b.from.length - a.from.length);
}


/* ---------- writing a name in running text ---------- */

// Particles whose form depends on whether the name ends in a final consonant: [after a final, after none].
const PAIRS = [
  ['이에요', '예요'], ['이었', '였'], ['이라고', '라고'], ['이라는', '라는'], ['이라', '라'], ['이지만', '지만'], ['이든', '든'], ['이며', '며'],
  ['이랑', '랑'], ['이나', '나'], ['이여', '여'], ['이네', '네'], ['이고', '고'], ['이다', '다'], ['이야', '야'], ['으로', '로'],
  ['이가', '가'], ['이는', '는'], ['이를', '를'], ['이도', '도'], ['이한테', '한테'], ['이에게', '에게'], ['이의', '의'],
  ['이', '가'], ['은', '는'], ['을', '를'], ['과', '와'], ['아', '야'],
];
const HYPOCORISTIC = new Set(['이가', '이는', '이를', '이도', '이한테', '이에게', '이의']);
const FIXED = ['에게서', '한테서', '께서', '에게', '한테', '에서', '부터', '까지', '조차', '마저', '처럼', '보다', '하고', '밖에', '인데', '입니다', '의', '께', '도', '만', '에', '씨', '님', '군', '양', '들', '뿐', '요', '와', '과'];
const PARTICLES = [...new Set([...PAIRS.flat(), ...FIXED])].sort((a, b) => b.length - a.length);
const isHangul = (ch) => /[가-힣]/.test(ch || '');
/** true: ends in a final consonant, 'r': in ㄹ, false: in a vowel, null: not a Korean syllable (keep the particle). */
function finalOf(word) {
  const ch = String(word || '').trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return null;
  const f = code % 28;
  return f === 0 ? false : f === 8 ? 'r' : true;
}
/** The particle that fits after `name`: "하루가" → "도윤이", "도윤은" → "서아는". */
function fitParticle(particle, name, rest = '') {
  const final = finalOf(name);
  if (final === null) return particle;
  if (particle === '로' || particle === '으로') return final === true ? '으로' : '로';
  // "야" after a vowel is either a call ("니코야,") or "is" ("니코야."): a call comes before , ! ~.
  if (particle === '야' && final) return /^\s*[,!~]/.test(rest) ? '아' : '이야';
  // "이가", "이는" after a name with a final consonant ("재민이가") lose the 이 after a vowel; "가" itself pairs with "이".
  const pair = PAIRS.find((p) => p[0] === particle) || PAIRS.find((p) => p[1] === particle && !HYPOCORISTIC.has(p[0]));
  if (!pair) return particle;
  return final ? pair[0] : pair[1];
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Write `to` for every whole-name `from` in a text. A Korean name must stand alone or with particles attached
 * ("하루가", "하루에게는"); the first particle is fitted to the new name. Parts of longer words ("하루나" for 하루) and
 * of the protected forms (a longer name that contains `from`) are left alone. Returns { text, count }.
 */
function replaceName(text, from, to, { protect = [] } = {}) {
  const src = String(text ?? '');
  const f = tidy(from);
  const t = tidy(to);
  if (!src || !f || !t || f === t) return { text: src, count: 0 };
  const guarded = [];
  for (const p of [...new Set([t, ...protect.map(tidy)])].filter((x) => x && x !== f && x.includes(f))) {
    for (const m of src.matchAll(new RegExp(esc(p), 'g'))) guarded.push([m.index, m.index + p.length]);
  }
  const hangul = isHangul(f[0]) || isHangul(f.slice(-1));
  const re = new RegExp(esc(f), 'g');
  let out = '';
  let last = 0;
  let count = 0;
  for (const m of src.matchAll(re)) {
    const start = m.index;
    const end = start + f.length;
    if (guarded.some(([a, b]) => start < b && end > a)) continue;
    const before = src[start - 1] || '';
    if (hangul ? /[가-힣A-Za-z0-9]/.test(before) : /[\p{L}\p{N}]/u.test(before)) continue;
    let rest = src.slice(end);
    let particle = '';
    if (hangul || /^[가-힣]/.test(rest)) {
      // Particles attached to the name; the word must end right after them.
      let consumed = '';
      let more = rest;
      for (;;) {
        const p = PARTICLES.find((x) => more.startsWith(x));
        if (!p) break;
        consumed += p;
        more = more.slice(p.length);
        if (!particle) particle = p;
      }
      if (isHangul(more[0])) continue;
      if (!consumed && hangul && isHangul(rest[0])) continue;
    } else if (/^[\p{L}\p{N}]/u.test(rest)) continue;
    const fitted = particle ? fitParticle(particle, t, rest.slice(particle.length)) : '';
    out += src.slice(last, start) + t + fitted;
    last = end + particle.length;
    count++;
  }
  return { text: out + src.slice(last), count };
}

/** New memory text with the names of renamed people written the way the user chose. */
function rewriteText(text, table = current()) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const r of rewrites(table)) out = replaceName(out, r.from, r.display, { protect: formsOf(r.to, table) }).text;
  return out;
}
/** A name field written by the model: the canonical name of a renamed person. */
function rewriteName(name, table = current()) {
  if (typeof name !== 'string' || !name.trim()) return name;
  return name
    .split(/(\s*[·,、/]\s*)/)
    .map((part, i) => (i % 2 ? part : canonOf(part, table) || part))
    .join('');
}

// Fields of saved memory that hold names, and fields of running text. Quoted story lines and source pointers are
// the story's own words: they are never rewritten.
const NAME_FIELDS = new Set(['by', 'to', 'who', 'toward', 'about', 'from', 'present', 'unaware', 'guess']);
const TEXT_FIELDS = new Set(['title', 'summary', 'text', 'why', 'kept', 'what', 'detail', 'cause', 'need', 'how', 'turns', 'keep', 'latest', 'closed']);
const LINE_LISTS = new Set(['quotes', 'loose']);
const SOURCE_FIELDS = new Set(['evidence', 'clues', 'sentences', 'messages', 'parts', 'covered']);

/** A memory record just written by the model, with renamed people written the way the user chose. In place. */
function rewriteDeep(value, table = current(), key = null) {
  if (!table || !Object.keys(table.people || {}).length || value == null) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] === 'string') value[i] = NAME_FIELDS.has(key) ? rewriteName(value[i], table) : TEXT_FIELDS.has(key) ? rewriteText(value[i], table) : value[i];
      else rewriteDeep(value[i], table, key);
    }
    return value;
  }
  if (typeof value !== 'object') return value;
  for (const [k, v] of Object.entries(value)) {
    if (SOURCE_FIELDS.has(k)) continue;
    if (LINE_LISTS.has(k) && Array.isArray(v)) {
      for (const q of v) if (q && typeof q === 'object') for (const f of ['by', 'to']) if (typeof q[f] === 'string') q[f] = rewriteName(q[f], table);
      continue;
    }
    if (typeof v === 'string') {
      if (NAME_FIELDS.has(k)) value[k] = rewriteName(v, table);
      else if (TEXT_FIELDS.has(k)) value[k] = rewriteText(v, table);
    } else if (v && typeof v === 'object') rewriteDeep(v, table, k);
  }
  return value;
}

module.exports = {
  touch,
  rewriteDeep,
  NAME_FIELDS,
  TEXT_FIELDS,
  replaceName,
  rewriteText,
  rewriteName,
  fitParticle,
  finalOf,
  NAMES_VERSION,
  HISTORY_KEEP,
  emptyTable,
  setLoader,
  using,
  current,
  canonOf,
  canonical,
  formsOf,
  displayOf,
  namePairs,
  scriptForms,
  addPerson,
  seed,
  addAlias,
  dismiss,
  dismissed,
  pushHistory,
  rewrites,
  tidy,
  fold,
};
