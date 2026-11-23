'use strict';
// Renaming and merging people across a room's memory: preview, apply, undo; names that are already the same person
// stored apart (duplicates), and names that only may be the same person (suggestions, never merged on their own).
// Pure logic; the service loads and saves the files and keeps jobs from writing the room meanwhile.

const A = require('./aliases.cjs');
const L = require('./ledger.cjs');
const S = require('./scenes.cjs');

const AREAS = {
  quoteBy: '대사 · 말한 사람',
  quoteTo: '대사 · 들은 사람',
  events: '장면 · 사건',
  facts: '알게 된 사실',
  threads: '아직 끝나지 않은 일',
  routine: '최근 생활',
  chapters: '챕터 · 큰 흐름',
};
const SAMPLE_MAX = 12;
const PLACEHOLDERS = new Set(['user', 'narrator', 'character', '사용자', '서술']);

/**
 * Every field of the memory that holds a name or running text, with where it is and what to mark when it changes.
 * kind: 'name' (one name), 'names' ("A·B" in one string), 'list' (an array of names), 'text', 'texts'.
 * Quoted story lines and source pointers are not fields: they are the story's own words.
 */
function fieldsOf(store, ledger) {
  const out = [];
  const add = (doc, area, path, kind, label, mark) => out.push({ doc, area, path, kind, label, mark });
  const scenes = store?.scenes || [];
  scenes.forEach((sc, si) => {
    const base = ['scenes', si];
    const label = `${sc.id || `S${si + 1}`}${sc.title ? ` · ${sc.title}` : ''}`;
    const mark = { path: base, fields: { nameEditedAt: true } };
    for (const f of ['title', 'summary']) add('scenes', 'events', [...base, f], 'text', label, mark);
    add('scenes', 'events', [...base, 'present'], 'list', label, mark);
    (sc.events || []).forEach((e, ei) => {
      for (const f of ['text', 'why']) add('scenes', 'events', [...base, 'events', ei, f], 'text', label, mark);
      (e.quotes || []).forEach((q, qi) => {
        const qm = { path: [...base, 'events', ei, 'quotes', qi], fields: { manual: true, manualAt: true } };
        add('scenes', 'quoteBy', [...base, 'events', ei, 'quotes', qi, 'by'], 'name', `${label} · #${q.number}.${q.sentence}`, qm);
        add('scenes', 'quoteTo', [...base, 'events', ei, 'quotes', qi, 'to'], 'names', `${label} · #${q.number}.${q.sentence}`, qm);
      });
    });
    (sc.loose || []).forEach((q, qi) => {
      const qm = { path: [...base, 'loose', qi], fields: { manual: true, manualAt: true } };
      add('scenes', 'quoteBy', [...base, 'loose', qi, 'by'], 'name', `${label} · #${q.number}.${q.sentence}`, qm);
      add('scenes', 'quoteTo', [...base, 'loose', qi, 'to'], 'names', `${label} · #${q.number}.${q.sentence}`, qm);
    });
    (sc.recollections || []).forEach((r, ri) => {
      add('scenes', 'events', [...base, 'recollections', ri, 'who'], 'name', label, mark);
      for (const f of ['text', 'why', 'kept']) add('scenes', 'events', [...base, 'recollections', ri, f], 'text', label, mark);
    });
    (sc.later || []).forEach((x, xi) => {
      add('scenes', 'events', [...base, 'later', xi, 'what'], 'text', label, mark);
      add('scenes', 'events', [...base, 'later', xi, 'by'], 'name', label, mark);
    });
    for (const key of ['learned', 'heardLater']) {
      (sc[key] || []).forEach((x, xi) => {
        add('scenes', 'events', [...base, key, xi, 'who'], 'name', label, mark);
        add('scenes', 'events', [...base, key, xi, 'from'], 'name', label, mark);
        if (key === 'learned') add('scenes', 'events', [...base, key, xi, 'what'], 'text', label, mark);
      });
    }
  });
  (store?.facts || []).forEach((f, fi) => {
    const base = ['facts', fi];
    const mark = { path: base, fields: { edited: true } };
    const label = `${f.id || `F${fi + 1}`}`;
    add('scenes', 'facts', [...base, 'about'], 'names', label, mark);
    add('scenes', 'facts', [...base, 'text'], 'text', label, mark);
    for (const k of ['unaware', 'guess', 'knownBy']) add('scenes', 'facts', [...base, k], 'list', label, mark);
  });
  for (const key of ['chapters', 'arcs']) {
    (store?.[key] || []).forEach((c, ci) => {
      const base = [key, ci];
      const mark = { path: base, fields: { edited: true } };
      const label = `${c.id || ''}${c.title ? ` · ${c.title}` : ''}`;
      for (const f of ['title', 'summary']) add('scenes', 'chapters', [...base, f], 'text', label, mark);
      for (const f of ['turns', 'keep']) add('scenes', 'chapters', [...base, f], 'texts', label, mark);
    });
  }
  const threadFields = (doc, area, list, base, counted) => {
    (list || []).forEach((t, ti) => {
      const path = [...base, ti];
      const mark = counted ? { path, fields: { edited: true } } : null;
      const label = `${t.id || ''}${t.title ? ` · ${t.title}` : ''}`;
      for (const f of ['who', 'toward']) add(doc, area, [...path, f], 'names', label, mark);
      for (const f of ['unaware', 'guess']) add(doc, area, [...path, f], 'list', label, mark);
      for (const f of ['title', 'detail', 'cause', 'need']) add(doc, area, [...path, f], 'text', label, mark);
      add(doc, area, [...path, 'latest', 'text'], 'text', label, mark);
      add(doc, area, [...path, 'closed', 'how'], 'text', label, mark);
    });
  };
  const routineFields = (doc, area, list, base, counted) => {
    (list || []).forEach((r, ri) => {
      const path = [...base, ri];
      const mark = counted ? { path, fields: { edited: true } } : null;
      const label = `${r.what || ''}${r.at ? ` · ${r.at}` : ''}`;
      add(doc, area, [...path, 'who'], 'name', label, mark);
      add(doc, area, [...path, 'text'], 'text', label, mark);
    });
  };
  threadFields('ledger', 'threads', ledger?.threads, ['threads'], true);
  routineFields('ledger', 'routine', ledger?.routine, ['routine'], true);
  // The copies kept for rerolls go along, so rolling back a reply does not bring the old name back. Not counted.
  (ledger?.batches || []).forEach((b, bi) => {
    threadFields('ledger', 'snapshot', b.threads, ['batches', bi, 'threads'], false);
    routineFields('ledger', 'snapshot', b.routine, ['batches', bi, 'routine'], false);
  });
  return out;
}

function getPath(root, path) {
  let v = root;
  for (const k of path) {
    if (v == null) return undefined;
    v = v[k];
  }
  return v;
}
function setPath(root, path, value) {
  let v = root;
  for (const k of path.slice(0, -1)) {
    if (v[k] == null || typeof v[k] !== 'object') return false;
    v = v[k];
  }
  const last = path.at(-1);
  if (value === undefined) delete v[last];
  else v[last] = value;
  return true;
}
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isName = (value, source) => typeof value === 'string' && A.fold(value) === A.fold(source);

/** The field's new value with `source` written as `target` (names) or `display` (text); undefined when unchanged. */
function renamed(field, value, { source, target, display, text, protect }) {
  if (field.kind === 'name') return isName(value, source) ? target : undefined;
  if (field.kind === 'names') {
    if (typeof value !== 'string' || !value) return undefined;
    const parts = value.split(/(\s*[·,、/]\s*)/);
    let hit = false;
    const next = parts.map((p, i) => (i % 2 || !isName(p, source) ? p : ((hit = true), target)));
    if (!hit) return undefined;
    // "A·B" where B becomes A: the name once.
    const names = [];
    for (let i = 0; i < next.length; i += 2) if (!names.some((n) => A.fold(n) === A.fold(next[i]))) names.push(next[i]);
    return names.length === Math.ceil(next.length / 2) ? next.join('') : names.join('·');
  }
  if (field.kind === 'list') {
    if (!Array.isArray(value) || !value.some((n) => isName(n, source))) return undefined;
    return [...new Set(value.map((n) => (isName(n, source) ? target : n)))];
  }
  if (!text) return undefined;
  if (field.kind === 'text') {
    if (typeof value !== 'string' || !value) return undefined;
    const r = A.replaceName(value, source, display, { protect });
    return r.count ? r.text : undefined;
  }
  if (field.kind === 'texts') {
    if (!Array.isArray(value)) return undefined;
    let hit = false;
    const next = value.map((t) => {
      if (typeof t !== 'string') return t;
      const r = A.replaceName(t, source, display, { protect });
      if (r.count) hit = true;
      return r.text;
    });
    return hit ? next : undefined;
  }
  return undefined;
}

function check(source, target) {
  const s = A.tidy(source);
  const t = A.tidy(target);
  if (!s || !t) throw Error('바꿀 이름과 새 이름을 모두 적어 주세요.');
  if (s.length > 60 || t.length > 60) throw Error('이름이 너무 깁니다.');
  if (A.fold(s) === A.fold(t)) throw Error('같은 이름입니다.');
  return [s, t];
}

/** A short piece of text around the change, for the preview. */
function snippet(before, after) {
  const b = Array.isArray(before) ? before.join(' / ') : String(before ?? '');
  const a = Array.isArray(after) ? after.join(' / ') : String(after ?? '');
  if (b.length <= 140 && a.length <= 140) return { before: b, after: a };
  let i = 0;
  while (i < b.length && b[i] === a[i]) i++;
  const from = Math.max(0, i - 50);
  const cut = (x) => `${from ? '…' : ''}${x.slice(from, from + 130)}${x.length > from + 130 ? '…' : ''}`;
  return { before: cut(b), after: cut(a) };
}

/**
 * What a rename would change, without changing anything. options: { source, target, display, text } —
 * `target` is the canonical name written in name fields, `display` the form written in running text (default:
 * the target), `text` whether running text changes too (default true).
 */
function plan(store, ledger, table, options) {
  const [source, typed] = check(options.source, options.target);
  // A target the table knows is written as its canonical name; an alias of the source's own person becomes the name.
  const targetCanon = A.canonOf(typed, table);
  const target = targetCanon && targetCanon !== A.canonOf(source, table) ? targetCanon : typed;
  if (A.fold(target) === A.fold(source)) throw Error('같은 이름입니다.');
  const display = A.tidy(options.display) || target;
  const text = options.text !== false;
  // Longer names that contain the source ("하루나" for 하루: it also reads as 하루 + "나") are other people: left alone.
  const others = [...knownPeople(store, ledger, table).flatMap((n) => A.formsOf(n, table)), ...usedNames(store, ledger).map((u) => u.name)];
  const protect = [...new Set([target, display, ...A.formsOf(target, table), ...others])].filter((x) => A.fold(x) !== A.fold(source));
  const docs = { scenes: store, ledger };
  const changes = [];
  const counts = Object.fromEntries(Object.keys(AREAS).map((k) => [k, 0]));
  const samples = [];
  const marks = new Map();
  for (const field of fieldsOf(store, ledger)) {
    const before = getPath(docs[field.doc], field.path);
    const after = renamed(field, before, { source, target, display, text, protect });
    if (after === undefined || same(after, before)) continue;
    changes.push({ doc: field.doc, path: field.path, before, after });
    if (field.area in counts) {
      counts[field.area]++;
      if (samples.length < SAMPLE_MAX && !samples.some((x) => x.area === field.area && x.label === field.label)) samples.push({ area: field.area, areaName: AREAS[field.area], label: field.label, ...snippet(before, after) });
    }
    if (field.mark) marks.set(`${field.doc}:${field.mark.path.join('.')}`, { doc: field.doc, ...field.mark });
  }
  return { source, target, display, text, counts, areas: AREAS, total: Object.values(counts).reduce((a, b) => a + b, 0), samples, changes, marks: [...marks.values()] };
}

/**
 * Several renames as one (the merge of stored duplicates): planned one after another on a copy, then folded into
 * one change list, so they are applied and undone together.
 */
function planMany(store, ledger, table, items) {
  const docs = { scenes: structuredClone(store), ledger: structuredClone(ledger) };
  const t = structuredClone(table);
  const parts = [];
  for (const item of items) {
    const p = plan(docs.scenes, docs.ledger, t, item);
    for (const c of p.changes) setPath(docs[c.doc], c.path, structuredClone(c.after));
    A.addAlias(t, p.source, p.target, { display: p.text ? p.display : undefined, rewrite: p.text });
    parts.push(p);
  }
  const byPath = new Map();
  for (const p of parts) for (const c of p.changes) {
    const key = `${c.doc}:${JSON.stringify(c.path)}`;
    if (byPath.has(key)) byPath.get(key).after = c.after;
    else byPath.set(key, { ...c });
  }
  const marks = new Map();
  for (const p of parts) for (const m of p.marks) marks.set(`${m.doc}:${m.path.join('.')}`, m);
  const counts = Object.fromEntries(Object.keys(AREAS).map((k) => [k, parts.reduce((n, p) => n + p.counts[k], 0)]));
  return {
    kind: 'merge',
    source: parts.map((p) => p.source).join(', '),
    target: [...new Set(parts.map((p) => p.target))].join(', '),
    display: null,
    text: parts.some((p) => p.text),
    items: parts.map(({ source, target, display, text }) => ({ source, target, display, text })),
    counts,
    areas: AREAS,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    samples: parts.flatMap((p) => p.samples).slice(0, SAMPLE_MAX),
    changes: [...byPath.values()].filter((c) => !same(c.before, c.after)),
    marks: [...marks.values()],
  };
}

/**
 * An alias left in running text after a merge (the alias can no longer be picked as a rename source): every whole
 * `alias` in summaries, event texts, titles, recollections, facts, chapters, threads and daily life is written as
 * `display`. Never quoted lines or their translations, never a name field, never an item the user edited by hand;
 * longer names that contain the alias are left alone. Records nothing in the name table.
 * options: { alias, display }
 */
function planAliasText(store, ledger, table, options) {
  const alias = A.tidy(options.alias);
  const display = A.tidy(options.display);
  if (!alias || !display) throw Error('바꿀 표기와 새 표기를 모두 적어 주세요.');
  if (alias.length > 60 || display.length > 60) throw Error('이름이 너무 깁니다.');
  if (A.fold(alias) === A.fold(display)) throw Error('같은 표기입니다.');
  const canon = A.canonOf(alias, table);
  if (!canon || A.fold(canon) === A.fold(alias)) throw Error('이름 표에 있는 다른 이름(별칭)만 고를 수 있습니다.');
  const others = [...knownPeople(store, ledger, table).flatMap((n) => A.formsOf(n, table)), ...usedNames(store, ledger).map((u) => u.name)];
  const protect = [...new Set([display, ...A.formsOf(canon, table), ...others])].filter((x) => A.fold(x) !== A.fold(alias));
  const docs = { scenes: store, ledger };
  const byRename = new Set();
  for (const h of table?.history || []) for (const c of h.changes || []) if (c.path?.at(-1) === 'edited' && c.after === true && !c.before) byRename.add(`${c.doc}:${JSON.stringify(c.path.slice(0, -1))}`);
  const changes = [];
  const counts = Object.fromEntries(Object.keys(AREAS).map((k) => [k, 0]));
  const samples = [];
  for (const field of fieldsOf(store, ledger)) {
    if (field.kind !== 'text' && field.kind !== 'texts') continue;
    // The owner of the field (a scene, fact, chapter, thread, entry) edited by hand is the user's own text. A mark that
    // only an earlier rename put there (kept in the history) is not an edit of the text.
    const owner = field.mark ? getPath(docs[field.doc], field.mark.path) : null;
    if (owner && (owner.manual || (owner.edited && !byRename.has(`${field.doc}:${JSON.stringify(field.mark.path)}`)))) continue;
    const before = getPath(docs[field.doc], field.path);
    const after = renamed(field, before, { source: alias, target: display, display, text: true, protect });
    if (after === undefined || same(after, before)) continue;
    changes.push({ doc: field.doc, path: field.path, before, after });
    if (field.area in counts) {
      counts[field.area]++;
      if (samples.length < SAMPLE_MAX && !samples.some((x) => x.area === field.area && x.label === field.label)) samples.push({ area: field.area, areaName: AREAS[field.area], label: field.label, ...snippet(before, after) });
    }
  }
  return { kind: 'alias-text', source: alias, target: display, display, text: true, items: [], counts, areas: AREAS, total: Object.values(counts).reduce((a, b) => a + b, 0), samples, changes, marks: [] };
}

/** One merged, story-ordered daily-life list: the same entry saved twice (same person, kind and message) once. */
function mergeRoutine(ledger) {
  const before = ledger.routine || [];
  const kept = [];
  for (const r of before) {
    const twin = kept.find((k) => k.who === r.who && k.what === r.what && k.number != null && k.number === r.number && (k.at || null) === (r.at || null));
    if (!twin) kept.push(r);
    else if (!twin.edited && (r.edited || String(r.text || '').length > String(twin.text || '').length)) kept[kept.indexOf(twin)] = r;
  }
  const sorted = [...kept].sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : 0) || (a.number ?? Infinity) - (b.number ?? Infinity));
  return same(sorted, before) ? null : sorted;
}

/**
 * Apply a plan made from the same store and ledger: change the fields, mark what changed as edited by hand, record
 * the source as another name of the target and keep the change list for undo. In place. Returns the history entry.
 */
function apply(store, ledger, table, planned, { now = new Date().toISOString(), kind = 'rename', id = null } = {}) {
  const docs = { scenes: store, ledger };
  const changes = [];
  for (const c of planned.changes) {
    if (!same(getPath(docs[c.doc], c.path), c.before)) throw Error('미리 본 뒤에 기억이 바뀌었습니다. 다시 미리 보기를 해 주세요.');
  }
  for (const c of planned.changes) {
    setPath(docs[c.doc], c.path, structuredClone(c.after));
    changes.push(c);
  }
  // Marked as the user's own: automatic checks and merges leave these alone from now on.
  for (const m of planned.marks) {
    for (const f of Object.keys(m.fields)) {
      const path = [...m.path, f];
      const before = getPath(docs[m.doc], path);
      const after = f.endsWith('At') ? now : true;
      if (f === 'manualAt' && before) continue;
      if (same(before, after)) continue;
      setPath(docs[m.doc], path, after);
      changes.push({ doc: m.doc, path, before, after });
    }
  }
  if (planned.counts.routine) {
    const merged = mergeRoutine(ledger);
    if (merged) {
      changes.push({ doc: 'ledger', path: ['routine'], before: structuredClone(ledger.routine), after: structuredClone(merged), whole: true });
      ledger.routine = merged;
    }
  }
  const tableBefore = { people: structuredClone(table.people || {}), dismissed: structuredClone(table.dismissed || []) };
  // Running text renamed: what the model writes next is written with the chosen name too.
  for (const item of planned.items || [planned]) A.addAlias(table, item.source, item.target, { display: item.text ? item.display : undefined, rewrite: item.text });
  const entry = { id: id || `R${(table.history?.at(-1)?.n || 0) + 1}`, n: (table.history?.at(-1)?.n || 0) + 1, kind: planned.kind || kind, at: now, source: planned.source, target: planned.target, display: planned.display, text: planned.text, counts: planned.counts, tableBefore, changes };
  A.pushHistory(table, entry);
  return entry;
}

/**
 * Put back the last rename: every field still holding what the rename wrote gets its old value; a field changed
 * since then is left as it is now (counted in `kept`). The name table goes back too.
 */
function undo(store, ledger, table) {
  const entry = table.history?.at(-1);
  if (!entry) throw Error('되돌릴 이름 바꾸기가 없습니다.');
  const docs = { scenes: store, ledger };
  let restored = 0;
  let kept = 0;
  for (const c of [...entry.changes].reverse()) {
    const now = getPath(docs[c.doc], c.path);
    if (!same(now, c.after)) {
      kept++;
      continue;
    }
    setPath(docs[c.doc], c.path, c.before === undefined ? undefined : structuredClone(c.before));
    restored++;
  }
  table.people = entry.tableBefore.people;
  table.dismissed = entry.tableBefore.dismissed;
  table.history = table.history.slice(0, -1);
  // Automatic merges made after this rename were in the table that was just put back: they are made again there.
  for (const rec of table.autoMerged || []) {
    if (!(rec.at > entry.at)) continue;
    rec.aliasUndo = [];
    for (const item of rec.items || []) {
      try { rec.aliasUndo.push(A.addAliasUndoable(table, item.source, item.target, { rewrite: false }).undo); } catch {}
    }
  }
  A.touch(table);
  return { undone: entry.id, source: entry.source, target: entry.target, restored, kept };
}

/* ---------- names in use, duplicates and suggestions ---------- */

/** Names written in name fields, with how often (cast and personas included even when unused). */
function usedNames(store, ledger, known = []) {
  const count = new Map();
  const bump = (n) => {
    const name = A.tidy(n);
    if (!name || PLACEHOLDERS.has(name.toLowerCase())) return;
    count.set(name, (count.get(name) || 0) + 1);
  };
  const docs = { scenes: store, ledger };
  for (const field of fieldsOf(store, ledger)) {
    if (field.area === 'snapshot' || !['name', 'names', 'list'].includes(field.kind)) continue;
    const v = getPath(docs[field.doc], field.path);
    if (field.kind === 'name') bump(v);
    else if (field.kind === 'names' && typeof v === 'string') v.split(/\s*[·,、/]\s*/).forEach(bump);
    else if (Array.isArray(v)) v.forEach(bump);
  }
  for (const n of known) if (!count.has(A.tidy(n))) count.set(A.tidy(n), 0);
  return [...count.entries()].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The room's known people: the cast, the user's characters and everyone in the name table (canonical names). */
function knownPeople(store, ledger, table) {
  const out = [];
  for (const n of [...(store?.cast || []), ...(store?.personas || []), ...(ledger?.cast || []), ...Object.keys(table?.people || {})]) {
    const c = A.canonical(n, table);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * Names stored apart that are already one person by rule: an alias in the name table, a particle or the given
 * name alone ("재민이", "재민" for 서재민). Merging them changes name fields only.
 */
function duplicates(store, ledger, table) {
  const people = knownPeople(store, ledger, table);
  const groups = new Map();
  for (const { name, count } of usedNames(store, ledger)) {
    if (!count) continue;
    const canon = A.using(table, () => L.matchName(name, people) || A.canonOf(name, table));
    if (!canon || canon === name) continue;
    if (!groups.has(canon)) groups.set(canon, []);
    groups.get(canon).push({ name, count });
  }
  return [...groups.entries()].map(([target, variants]) => ({ target, variants }));
}

function distance(a, b) {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
}
const hangulOnly = (s) => /^[가-힣\s]+$/.test(s);
const latinOnly = (s) => /^[\p{Script=Latin}\s'’.-]+$/u.test(s);
const consonants = (o) => o.replace(/V/g, '').length;

/** Why two names may be one person, or null. Never used to merge on its own. */
function lookAlike(a, b) {
  const x = A.fold(a).replace(/\s+/g, '');
  const y = A.fold(b).replace(/\s+/g, '');
  if (!x || !y || x === y) return null;
  if ((hangulOnly(a) && latinOnly(b)) || (latinOnly(a) && hangulOnly(b))) {
    const [ko, en] = hangulOnly(a) ? [a, b] : [b, a];
    const words = (s) => [s, ...s.split(/\s+/)].filter(Boolean);
    for (const k of words(ko)) for (const e of words(en)) {
      const outline = S.hangulOutline(k.replace(/\s/g, ''));
      if (consonants(outline) >= 2 && S.latinOutlines(e).includes(outline)) return { reason: 'sound', label: '한글·로마자 표기가 같은 소리' };
    }
    return null;
  }
  const len = Math.min([...x].length, [...y].length);
  const d = distance(x, y);
  if (len >= 2 && hangulOnly(a) && hangulOnly(b) && d === 1 && [...x].length === [...y].length) return { reason: 'spelling', label: '한 글자만 다름' };
  if (len >= 4 && d <= (len >= 7 ? 2 : 1)) return { reason: 'spelling', label: '철자가 비슷함' };
  if (latinOnly(a) && latinOnly(b) && len >= 3) {
    const oa = S.latinOutlines(x);
    if (S.latinOutlines(y).some((o) => oa.includes(o) && consonants(o) >= 2)) return { reason: 'sound', label: '발음이 비슷함' };
  }
  return null;
}

/**
 * "같은 사람일 수 있음": a name in use that the rules do not tie to anyone, next to a known person (or a more used
 * name) it looks or sounds like. The user decides; dismissed pairs are not offered again.
 */
function suggestions(store, ledger, table) {
  const people = knownPeople(store, ledger, table);
  const used = usedNames(store, ledger, people);
  const resolved = (n) => A.using(table, () => L.matchName(n, people) || A.canonOf(n, table));
  const unknown = used.filter((u) => u.count && !people.includes(u.name) && !resolved(u.name));
  const out = [];
  for (const u of unknown) {
    const targets = [...people.map((p) => ({ name: p, count: used.find((x) => x.name === p)?.count || 0, known: true })), ...unknown.filter((v) => v !== u && v.count > u.count)];
    for (const t of targets) {
      if (A.dismissed(table, u.name, t.name)) continue;
      const forms = t.known ? A.formsOf(t.name, table) : [t.name];
      const why = forms.map((f) => lookAlike(u.name, f)).find(Boolean);
      if (!why) continue;
      out.push({ source: u.name, target: t.name, sourceCount: u.count, targetCount: t.count, reason: why.reason, label: why.label });
    }
  }
  return out;
}


/* ---------- 같은 사람 찾기 (the memory model reads the scenes) ---------- */

// Names offered to the model at a time, and what it is shown of each.
const SAME_MAX_NAMES = 40;
const SAME_MAX_SCENES = 3;
const SAME_SNIPPET = 160;

/** Where a name is used: the scenes whose name fields hold it, each with a line it said or was said to, if any. */
function nameContexts(store, ledger, name, max = SAME_MAX_SCENES) {
  const docs = { scenes: store, ledger };
  const want = A.fold(name);
  const hit = new Set();
  for (const field of fieldsOf(store, ledger)) {
    if (field.doc !== 'scenes' || field.path[0] !== 'scenes' || !['name', 'names', 'list'].includes(field.kind)) continue;
    const v = getPath(docs.scenes, field.path);
    const list = field.kind === 'name' ? [v] : field.kind === 'names' && typeof v === 'string' ? v.split(/\s*[·,、/]\s*/) : Array.isArray(v) ? v : [];
    if (list.some((n) => A.fold(A.tidy(n)) === want)) hit.add(field.path[1]);
  }
  const cut = (t) => { const x = A.tidy(t); return x.length > SAME_SNIPPET ? `${x.slice(0, SAME_SNIPPET)}…` : x; };
  return [...hit].sort((a, b) => b - a).slice(0, max).map((i) => {
    const sc = store.scenes[i];
    const quotes = (sc.events || []).flatMap((e) => e.quotes || []);
    const line = quotes.find((q) => A.fold(A.tidy(q.by)) === want) || quotes.find((q) => String(q.to || '').split(/\s*[·,、/]\s*/).some((n) => A.fold(A.tidy(n)) === want));
    return { id: sc.id, title: sc.title || '', summary: cut(sc.summary || (sc.events || []).map((e) => e.text).join(' ')), line: line ? `${A.tidy(line.by)}${line.to ? ` → ${A.tidy(line.to)}` : ''}: ${cut(line.q || line.text || '')}` : null };
  });
}

/**
 * What the model is asked about: the room's people with the names they already go by, and the names in use that
 * are no one's yet (with where they are used). Busy names first; at most SAME_MAX_NAMES.
 */
function sameNameAsk(store, ledger, table) {
  const people = knownPeople(store, ledger, table);
  const used = usedNames(store, ledger, people);
  const resolved = (n) => A.using(table, () => L.matchName(n, people) || A.canonOf(n, table));
  const unknown = used.filter((u) => u.count && !people.includes(u.name) && !resolved(u.name)).slice(0, SAME_MAX_NAMES);
  // People who are not a card or persona name and are little used may be someone else under another name too.
  const loose = people.filter((p) => !table.people?.[p]?.seeded && (used.find((u) => u.name === p)?.count || 0) > 0 && (used.find((u) => u.name === p)?.count || 0) <= 3);
  const ask = [...unknown.map((u) => u.name), ...loose.filter((p) => !unknown.some((u) => u.name === p))].slice(0, SAME_MAX_NAMES);
  return {
    people: people.map((p) => ({ name: p, aliases: (table.people?.[p]?.aliases || []).slice(0, 8), count: used.find((u) => u.name === p)?.count || 0 })),
    names: ask.map((n) => ({ name: n, count: used.find((u) => u.name === n)?.count || 0, contexts: nameContexts(store, ledger, n) })),
  };
}

const SAME_PROMPT = `너는 롤플레이 기억의 인물 이름을 정리하는 도우미야. 한 사람이 여러 이름으로 따로 저장돼 있어: 다른 언어 표기(Daniel/대니얼), 오타, 성만·이름만, 애칭·별명, 직함·호칭(보스, 선생님), 비아냥거리는 멸칭.
[아직 누구인지 모르는 이름]마다 [인물] 가운데 같은 사람이 있는지 장면 내용을 근거로 판단해.
- 근거가 장면에 있을 때만 짝지어. 이름이 비슷하다는 것만으로는 안 돼. 확실하지 않으면 빼.
- 서로 다른 두 사람이 같은 장면에 함께 있으면 같은 사람이 아니야.
- 직함·호칭이 여러 사람에게 쓰이면(예: 아가씨를 두 사람에게) 빼.
- 모르는 이름끼리 같은 사람이고 [인물]에 없으면, 둘 중 더 많이 쓰인 이름을 person에 써.
JSON 하나로만 답해: {"same":[{"name":"모르는 이름","person":"같은 사람의 이름","sure":"high"|"medium","why":"근거 한 문장(장면 번호 포함)","scenes":["S12"]}]}`;

function buildSameNamePrompt(ask) {
  const people = ask.people.map((p) => `- ${p.name}${p.aliases.length ? ` (다른 이름: ${p.aliases.join(', ')})` : ''} · ${p.count}곳`).join('\n');
  const names = ask.names.map((n) => [`- ${n.name} · ${n.count}곳`, ...n.contexts.map((c) => `  ${c.id}${c.title ? ` 「${c.title}」` : ''}: ${c.summary}${c.line ? ` / 대사 ${c.line}` : ''}`)].join('\n')).join('\n');
  return [{ role: 'system', content: SAME_PROMPT }, { role: 'user', content: `## 인물\n${people || '(없음)'}\n\n## 아직 누구인지 모르는 이름\n${names}` }];
}

/** The model's pairs that hold: a name it was asked about, a person (or a busier unknown name), not the same, not dismissed. */
function parseSameNameReply(reply, ask, table, now = new Date().toISOString()) {
  let data = null;
  try { data = JSON.parse(String(reply).replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch { return []; }
  const asked = new Map(ask.names.map((n) => [A.fold(n.name), n.name]));
  const targets = new Map([...ask.people.map((p) => [A.fold(p.name), p.name]), ...ask.names.map((n) => [A.fold(n.name), n.name])]);
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(data?.same) ? data.same : []) {
    const name = asked.get(A.fold(A.tidy(item?.name)));
    const person = targets.get(A.fold(A.tidy(item?.person))) || A.using(table, () => A.canonOf(A.tidy(item?.person), table));
    if (!name || !person || A.fold(name) === A.fold(person)) continue;
    if (A.dismissed(table, name, person)) continue;
    const key = `${A.fold(name)}\u0000${A.fold(person)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, person, sure: item.sure === 'high' ? 'high' : 'medium', why: A.tidy(item.why).slice(0, 200), scenes: (Array.isArray(item.scenes) ? item.scenes : []).map(String).filter((x) => /^S\d+$/.test(x)).slice(0, 4), at: now });
  }
  return out;
}

/** The model's pairs still open: neither merged since (one person now) nor dismissed. */
function openSameNames(store, ledger, table, items = []) {
  const people = knownPeople(store, ledger, table);
  const one = (n) => A.using(table, () => L.matchName(n, people) || A.canonOf(n, table)) || n;
  return (items || []).filter((x) => !A.dismissed(table, x.name, x.person) && A.fold(one(x.name)) !== A.fold(one(x.person)));
}

/* ---------- automatic merges from the user's glossary ---------- */

// Merges made on their own are kept apart from the hand renames (which keep only a few, for the last-undo), so each
// can be looked at and taken back on its own.
const AUTO_KEEP = 40;
const hangulName = (s) => /[가-힣]/.test(s) && !/[A-Za-z]/.test(s);
const words = (s) => A.tidy(s).split(' ').filter(Boolean).length;

/**
 * Groups of names stored apart that the user's glossary says are one person ("Daniel = 다니엘": "Daniel" in the
 * English memory, "다니엘" from the card). Each group: { pair, target, items: [{ source, target, display }] }.
 * `base` 'ko' keeps the Korean form as the name, anything else the foreign (Latin or Chinese) form, so the name
 * follows the language the memory is written in. A full name wins over a first name alone: the card's
 * "Daniel Crowe" and the glossary's "다니엘" become "다니엘 크로우" (`koreanOf`) in a Korean memory.
 * `display` is how the merged name is written in running text: the source's own form in the base language.
 * Two card or persona names are never merged (two people may share a name), nor a pair the user took back.
 */
function glossaryMerges(store, ledger, table, pairs, { base = 'ko', koreanOf = () => null, latinOf = () => null, skip = new Set() } = {}) {
  const people = knownPeople(store, ledger, table);
  const used = usedNames(store, ledger, people);
  const resolve = (n) => {
    const hit = A.using(table, () => L.matchName(n, people) || A.canonOf(n, table));
    if (hit) return hit;
    const u = used.find((x) => x.count && A.fold(x.name) === A.fold(n));
    return u ? u.name : null;
  };
  const seeded = (n) => !!table.people?.[n]?.seeded;
  const out = [];
  for (const pair of pairs || []) {
    if (!pair?.from || !pair?.to) continue;
    const a = resolve(pair.from);
    const b = resolve(pair.to);
    if (!a || !b || A.fold(a) === A.fold(b)) continue;
    const key = `${A.fold(a)}\u0000${A.fold(b)}`;
    if (skip.has(key) || A.dismissed(table, a, b) || A.dismissed(table, pair.from, pair.to)) continue;
    if (seeded(a) && seeded(b)) continue;
    let target;
    if (base === 'ko') target = hangulName(b) && words(a) > words(b) ? koreanOf(a) || b : b;
    else target = !hangulName(a) && words(b) > words(a) ? latinOf(b) || a : a;
    const inBase = (x) => (base === 'ko' ? hangulName(x) : !hangulName(x));
    const display = (x) => (inBase(x) ? x : base === 'ko' ? koreanOf(x) || pair.to : latinOf(x) || pair.from);
    const items = [a, b].filter((x) => A.fold(x) !== A.fold(target)).map((x) => ({ source: x, target, display: display(x), text: true }));
    if (items.length) out.push({ pair, key, target, items });
  }
  return out;
}

/**
 * Apply an automatic merge (a planMany plan): the fields change as in a hand merge, but nothing is marked as edited
 * by hand (later checks still look after those records), and the name table keeps exactly what is needed to take
 * this one merge back later, whatever came after it. Returns the record.
 */
function applyAutoMerge(store, ledger, table, planned, { now = new Date().toISOString(), why = null } = {}) {
  const docs = { scenes: store, ledger };
  const changes = [];
  for (const c of planned.changes) {
    if (!same(getPath(docs[c.doc], c.path), c.before)) continue;
    setPath(docs[c.doc], c.path, structuredClone(c.after));
    changes.push(c);
  }
  if (planned.counts?.routine) {
    const merged = mergeRoutine(ledger);
    if (merged) {
      changes.push({ doc: 'ledger', path: ['routine'], before: structuredClone(ledger.routine), after: structuredClone(merged), whole: true });
      ledger.routine = merged;
    }
  }
  const aliasUndo = [];
  for (const item of planned.items || []) aliasUndo.push(A.addAliasUndoable(table, item.source, item.target, { rewrite: false }).undo);
  const n = (table.autoMerged?.at(-1)?.n || 0) + 1;
  const rec = { id: `G${n}`, n, kind: 'glossary', at: now, why, source: planned.source, target: planned.target, items: planned.items.map(({ source, target, display }) => ({ source, target, display })), counts: planned.counts, changes, aliasUndo };
  table.autoMerged = [...(table.autoMerged || []), rec].slice(-AUTO_KEEP);
  A.touch(table);
  return rec;
}

/**
 * Take one automatic merge back: every field still holding what it wrote gets its old value (a field changed since is
 * left as it is now, counted in `kept`), the other names it added go, and the pair is not merged on its own again.
 * Hand renames made after it keep working: their saved table is put right too.
 */
function undoAutoMerge(store, ledger, table, id) {
  const list = table.autoMerged || [];
  const at = list.findIndex((r) => r.id === id);
  if (at < 0) throw Error('되돌릴 자동 합침을 찾지 못했습니다.');
  const rec = list[at];
  const docs = { scenes: store, ledger };
  let restored = 0;
  let kept = 0;
  for (const c of [...rec.changes].reverse()) {
    if (!same(getPath(docs[c.doc], c.path), c.after)) { kept++; continue; }
    setPath(docs[c.doc], c.path, c.before === undefined ? undefined : structuredClone(c.before));
    restored++;
  }
  for (const u of [...(rec.aliasUndo || [])].reverse()) A.undoAlias(table, u);
  for (const h of table.history || []) {
    if (!h.tableBefore || !(h.at > rec.at)) continue;
    for (const u of [...(rec.aliasUndo || [])].reverse()) A.undoAlias(h.tableBefore, u);
  }
  for (const item of rec.items || []) A.dismiss(table, item.source, item.target);
  table.autoMerged = list.filter((r) => r.id !== id);
  A.touch(table);
  return { undone: rec.id, source: rec.source, target: rec.target, restored, kept };
}

module.exports = { nameContexts, sameNameAsk, buildSameNamePrompt, parseSameNameReply, openSameNames, SAME_MAX_NAMES, glossaryMerges, applyAutoMerge, undoAutoMerge, AUTO_KEEP, AREAS, fieldsOf, plan, planAliasText, planMany, apply, undo, usedNames, knownPeople, duplicates, suggestions, lookAlike, mergeRoutine, getPath };
