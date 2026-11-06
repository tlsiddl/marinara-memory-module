'use strict';
// 날짜·주기 트래커 (trackers): "만난 지 N일째", "D-N", "다음까지 D-N / 진행 중 (k/length일째)". One file per room,
// <chat>.trackers.json: { version: 1, items: [...], suggestions: [...] }. A switch in 설정 → 추가 기능 (off by default).
//
// Pure logic; the service loads and saves the file, checks the switch and supplies the two clocks. Nothing here calls a
// model: the dates are the user's own or the story's (the scene's date), and the day counts are worked out from them
// when they are shown or injected, so a stored tracker never goes stale.
//
//   item  { id, label, type: 'count' | 'until' | 'cycle', scope: 'room' | 'person' | 'pair', people: [canonical names],
//           clock: 'story' | 'real', inject: 'present' | 'always' | 'never', createdAt, updatedAt,
//           count: { start, firstDay: 1 | 0 } | until: { target } | cycle: { every, unit, length, starts[], predict } }
//   suggestions  [{ id, trackerId, date, sceneId, status: 'open' | 'done' | 'ignored', text, createdAt }]  (never applied by itself)
//
// Dates are ISO "YYYY-MM-DD" inside; "YY-MM-DD" and "YYYY.MM.DD" are accepted when typed.

const crypto = require('node:crypto');
const A = require('./aliases.cjs');

const TRACKERS_VERSION = 1;
const TYPES = ['count', 'until', 'cycle'];
const SCOPES = ['room', 'person', 'pair'];
const CLOCKS = ['story', 'real'];
const INJECTS = ['present', 'always', 'never'];
const UNITS = ['day', 'month'];
const PREDICTS = ['fixed', 'average'];
const MAX_ITEMS = 30;
const MAX_STARTS = 12;
const MAX_SUGGESTIONS = 40;
const LABEL_MAX = 30;
const INJECT_CHARS = 200;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- dates ---------- */

/** "2024-07-16" / "24-07-16" / "24.7.16" → "2024-07-16"; null for anything else (a real calendar date only). */
function parseDate(text) {
  const m = /^\s*(\d{2}|\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*$/.exec(String(text ?? ''));
  if (!m) return null;
  const year = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
  const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() !== year || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return d.toISOString().slice(0, 10);
}
const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
/** Whole days from a to b (positive when b is later). */
const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** n months later; the day is cut back to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb). */
function addMonths(iso, n) {
  const [y, m, day] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first.toISOString().slice(0, 10);
}
/** The server's local calendar date. */
function localDate(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
/** "24-07-16" for showing. */
const shortDate = (iso) => (iso ? iso.slice(2) : '');

/* ---------- counting ---------- */

const sortedStarts = (list) => [...new Set((Array.isArray(list) ? list : []).map(parseDate).filter(Boolean))].sort();

/** The next start the cycle predicts after `last` (a date), from the whole history. */
function nextStart(c, starts, last) {
  if (c.predict === 'average' && starts.length >= 2) {
    const recent = starts.slice(-7);
    let total = 0;
    for (let i = 1; i < recent.length; i++) total += daysBetween(recent[i - 1], recent[i]);
    const mean = Math.max(1, Math.round(total / (recent.length - 1)));
    return addDays(last, mean);
  }
  return c.unit === 'month' ? addMonths(last, c.every) : addDays(last, c.every);
}

/**
 * What a tracker says on `today`: { ok, short, kind } where `short` is "12일째", "D-3", "진행 중 (2/5일째)", "다음까지 D-9".
 * ok is false when there is nothing to say yet (no start date, unknown story date); then `short` explains it.
 */
function evaluate(item, today) {
  if (!today) return { ok: false, short: item.clock === 'story' ? '이야기 날짜 모름' : '날짜 모름', kind: 'unknown' };
  if (item.type === 'count') {
    const c = item.count;
    if (!c?.start) return { ok: false, short: '시작일 없음', kind: 'unknown' };
    const days = daysBetween(c.start, today);
    if (days < 0) return { ok: true, short: `시작 전 D-${-days}`, kind: 'before' };
    return { ok: true, short: `${days + (c.firstDay === 0 ? 0 : 1)}일째`, kind: 'count', days };
  }
  if (item.type === 'until') {
    const target = item.until?.target;
    if (!target) return { ok: false, short: '목표일 없음', kind: 'unknown' };
    const d = daysBetween(today, target);
    return { ok: true, short: d > 0 ? `D-${d}` : d === 0 ? 'D-day' : `D+${-d}`, kind: 'until', days: d };
  }
  const c = item.cycle;
  const starts = sortedStarts(c?.starts);
  const past = starts.filter((s) => s <= today);
  if (!past.length) {
    const later = starts.find((s) => s > today);
    return later ? { ok: true, short: `다음까지 D-${daysBetween(today, later)}`, kind: 'wait' } : { ok: false, short: '시작일 기록 없음', kind: 'unknown' };
  }
  const last = past.at(-1);
  const k = daysBetween(last, today) + 1;
  const length = Math.max(1, Number(c.length) || 1);
  if (k <= length) return { ok: true, short: `진행 중 (${k}/${length}일째)`, kind: 'active', day: k, length };
  const next = nextStart(c, starts.filter((s) => s <= last), last);
  const d = daysBetween(today, next);
  return { ok: true, short: d > 0 ? `다음까지 D-${d}` : d === 0 ? '다음까지 D-day' : `예정일 ${-d}일 지남`, kind: 'wait', days: d, next };
}

/** The date a tracker counts on: the story's today or the server's date. */
const todayFor = (item, ctx) => (item.clock === 'real' ? ctx.real || localDate() : ctx.story || null);

/* ---------- the items ---------- */

const emptyTrackers = () => ({ version: TRACKERS_VERSION, items: [], suggestions: [], updatedAt: null });
const isTrackers = (v) => !!v && typeof v === 'object' && v.version === TRACKERS_VERSION && Array.isArray(v.items);

const need = (cond, message) => { if (!cond) throw Error(message); };
const pick = (value, list, fallback, what) => {
  if (value === undefined || value === null || value === '') return fallback;
  need(list.includes(value), `${what}은(는) ${list.join(', ')} 중 하나여야 합니다.`);
  return value;
};
const dateField = (value, what) => {
  const d = parseDate(value);
  need(d, `${what}은(는) 2024-07-16 또는 24-07-16 형식으로 적어 주세요.`);
  return d;
};
const intField = (value, min, max, what) => {
  const n = Number(value);
  need(Number.isInteger(n) && n >= min && n <= max, `${what}은(는) ${min}~${max} 사이의 정수여야 합니다.`);
  return n;
};
/** Canonical, de-duplicated names (A.canonical uses the room's name table when run inside A.using). */
function cleanPeople(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[·,;\n]+/);
  const out = [];
  for (const raw of list) {
    const name = A.canonical(tidy(raw).slice(0, 40));
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** A full, valid item from the user's input over `old` (or a new one). Throws a Korean message when something is wrong. */
function normalizeItem(raw, old = null) {
  const input = { ...(old || {}), ...(raw || {}) };
  const type = old ? old.type : pick(input.type, TYPES, null, '종류');
  need(type, '트래커 종류(count, until, cycle)를 골라 주세요.');
  const label = tidy(input.label).slice(0, LABEL_MAX);
  need(label, '이름을 적어 주세요.');
  const scope = pick(input.scope, SCOPES, 'room', '대상 범위');
  const people = scope === 'room' ? [] : cleanPeople(input.people);
  if (scope === 'person') need(people.length === 1, '한 사람을 골라 주세요.');
  if (scope === 'pair') need(people.length === 2, '두 사람을 골라 주세요.');
  const item = {
    id: old?.id || '', label, type, scope, people,
    clock: pick(input.clock, CLOCKS, 'story', '날짜 기준'),
    inject: pick(input.inject, INJECTS, 'present', '기억 칸에 넣기'),
    createdAt: old?.createdAt || '', updatedAt: old?.updatedAt || '',
  };
  if (type === 'count') {
    const c = input.count || {};
    item.count = { start: dateField(c.start, '시작일'), firstDay: Number(c.firstDay) === 0 ? 0 : 1 };
  } else if (type === 'until') {
    item.until = { target: dateField(input.until?.target, '목표일') };
  } else {
    const c = input.cycle || {};
    const unit = pick(c.unit, UNITS, 'day', '주기 단위');
    const starts = sortedStarts(c.starts);
    need((Array.isArray(c.starts) ? c.starts : []).every((x) => parseDate(x)), '시작일 형식이 올바르지 않습니다.');
    item.cycle = {
      every: intField(c.every ?? 28, 1, unit === 'month' ? 36 : 366, '주기'),
      unit,
      length: intField(c.length ?? 5, 1, 120, '기간'),
      starts: starts.slice(-MAX_STARTS),
      predict: pick(c.predict, PREDICTS, 'fixed', '다음 날짜 계산'),
    };
  }
  return item;
}

const findAt = (file, id) => {
  const at = file.items.findIndex((p) => p.id === id);
  need(at >= 0, '해당 트래커를 찾지 못했습니다.');
  return at;
};
function nextId(file) {
  let n = 0;
  for (const it of file.items) { const m = /^tk(\d+)$/.exec(it.id); if (m) n = Math.max(n, Number(m[1])); }
  for (const s of file.suggestions || []) { const m = /^tk(\d+)$/.exec(s.trackerId || ''); if (m) n = Math.max(n, Number(m[1])); }
  return `tk${n + 1}`;
}
const stamp = (item, now, created = false) => ({ ...item, createdAt: created ? now : item.createdAt, updatedAt: now });

function addItem(file, raw, now = new Date().toISOString()) {
  need(file.items.length < MAX_ITEMS, `트래커는 방마다 ${MAX_ITEMS}개까지 둘 수 있습니다.`);
  const next = structuredClone(file);
  const item = normalizeItem(raw, null);
  item.id = nextId(next);
  next.items.push(stamp(item, now, true));
  next.updatedAt = now;
  return next;
}
function editItem(file, id, raw, now = new Date().toISOString()) {
  const next = structuredClone(file);
  const at = findAt(next, id);
  next.items[at] = stamp(normalizeItem(raw, next.items[at]), now);
  next.updatedAt = now;
  return next;
}
function deleteItem(file, id, now = new Date().toISOString()) {
  const next = structuredClone(file);
  next.items.splice(findAt(next, id), 1);
  next.suggestions = (next.suggestions || []).filter((s) => s.trackerId !== id);
  next.updatedAt = now;
  return next;
}

/** Cycle history: the date is added (a date already there is kept once), the oldest beyond 12 fall away. */
function addStart(file, id, date, now = new Date().toISOString()) {
  const next = structuredClone(file);
  const it = next.items[findAt(next, id)];
  need(it.type === 'cycle', '주기 트래커만 시작일을 기록할 수 있습니다.');
  const d = dateField(date, '시작일');
  it.cycle.starts = sortedStarts([...it.cycle.starts, d]).slice(-MAX_STARTS);
  it.updatedAt = now;
  next.updatedAt = now;
  return next;
}
function removeStart(file, id, date, now = new Date().toISOString()) {
  const next = structuredClone(file);
  const it = next.items[findAt(next, id)];
  need(it.type === 'cycle', '주기 트래커만 시작일을 기록할 수 있습니다.');
  const d = dateField(date, '시작일');
  need(it.cycle.starts.includes(d), '그 시작일이 기록에 없습니다.');
  it.cycle.starts = it.cycle.starts.filter((s) => s !== d);
  it.updatedAt = now;
  next.updatedAt = now;
  return next;
}
function editStart(file, id, from, to, now = new Date().toISOString()) {
  return addStart(removeStart(file, id, from, now), id, to, now);
}

/** "이 장면부터": an existing count tracker starts on `date` (a cycle gets it as a start); or a new count tracker is made. */
function startFromDate(file, { trackerId = '', label = '', scope = 'room', people = [], date, clock = 'story' }, now = new Date().toISOString()) {
  const d = dateField(date, '시작일');
  if (trackerId) {
    const it = file.items[findAt(file, trackerId)];
    need(it.type !== 'until', 'D-day 트래커에는 시작일이 없습니다.');
    if (it.type === 'cycle') return addStart(file, trackerId, d, now);
    return editItem(file, trackerId, { count: { ...it.count, start: d } }, now);
  }
  return addItem(file, { type: 'count', label, scope, people, clock, inject: 'present', count: { start: d, firstDay: 1 } }, now);
}

/* ---------- suggestions (a cycle's start the story states; never applied by itself) ---------- */

const START_WORDS = /(시작(?:됐|되었|했|됨|된|돼|해|이야|이다|이었)|시작(?![가-힣])|왔(?:다|어|네|는|구나)|터졌|들어섰|접어들|started|began|begins|onset)/i;
const NOT_START = /(시작(?:되지|하지|할|하려|한다고|안)|않|못|안\s|아직|끝났|끝나|멈췄|그쳤|ended|stopped|not\s|n't)/i;
const GENERIC = new Set(['주기', '기간', '시작', '날짜', '일정', '다음', '기록']);

const sentencesOf = (text) => String(text || '').split(/(?<=[.!?。…])\s+|\n+/).map(tidy).filter(Boolean);

/** Words of a tracker's label that name the thing (the person names and generic words taken out). */
function keywordsOf(item) {
  const names = new Set(item.people.map((n) => tidy(n).toLowerCase()));
  return tidy(item.label).split(/[\s·,/]+/).map((w) => w.replace(/[()[\]'"“”‘’]/g, '')).filter((w) => w.length >= 2 && !GENERIC.has(w) && !names.has(w.toLowerCase()) && ![...names].some((n) => w.toLowerCase().startsWith(n)));
}
const suggestionId = (trackerId, date) => `sg_${crypto.createHash('sha1').update(`${trackerId}|${date}`).digest('hex').slice(0, 8)}`;

/**
 * Looks through the scenes (summary and event lines) for a cycle tracker's start: a sentence with one of the label's words
 * and a "시작/왔다/started" word, not negated, that names a tracked person (any person for a room-wide tracker), in a scene
 * that has a story date. Adds one open suggestion per tracker and date, once (an answered one is not asked again, and a date
 * that is already a start is not suggested). `dateOf(scene)` gives the scene's ISO date or null.
 */
function suggest(file, store, dateOf, now = new Date().toISOString()) {
  let next = null;
  const draft = () => (next ||= structuredClone(file));
  for (const item of file.items) {
    if (item.type !== 'cycle') continue;
    const words = keywordsOf(item);
    if (!words.length) continue;
    const forms = item.people.flatMap((n) => A.formsOf(n)).map((n) => n.toLowerCase());
    for (const scene of store?.scenes || []) {
      const date = dateOf(scene);
      if (!date || item.cycle.starts.includes(date)) continue;
      const id = suggestionId(item.id, date);
      if ((next || file).suggestions.some((s) => s.id === id)) continue;
      const hit = [scene.summary, ...(scene.events || []).map((e) => e.text)].flatMap(sentencesOf).find((s) => {
        const low = s.toLowerCase();
        if (!words.some((w) => low.includes(w.toLowerCase())) || !START_WORDS.test(s) || NOT_START.test(s)) return false;
        return !forms.length || forms.some((f) => low.includes(f));
      });
      if (!hit) continue;
      const who = item.people.length ? `${item.people.join('·')} ` : '';
      const out = draft();
      out.suggestions.push({ id, trackerId: item.id, date, sceneId: scene.id, status: 'open', text: `${who}${item.label} 시작을 ${shortDate(date)}(으)로 기록할까요?`, createdAt: now });
      if (out.suggestions.length > MAX_SUGGESTIONS) {
        const drop = out.suggestions.findIndex((s) => s.status !== 'open');
        out.suggestions.splice(drop >= 0 ? drop : 0, 1);
      }
    }
  }
  if (next) next.updatedAt = now;
  return next || file;
}

/** accept: the date becomes a start; ignore: it is marked and never asked again. */
function answerSuggestion(file, sid, action, now = new Date().toISOString()) {
  const sug = (file.suggestions || []).find((s) => s.id === sid);
  need(sug, '해당 제안을 찾지 못했습니다.');
  need(sug.status === 'open', '이미 답한 제안입니다.');
  need(action === 'accept' || action === 'ignore', 'accept 또는 ignore만 할 수 있습니다.');
  let next = action === 'accept' ? addStart(file, sug.trackerId, sug.date, now) : structuredClone(file);
  next.suggestions.find((s) => s.id === sid).status = action === 'accept' ? 'done' : 'ignored';
  next.updatedAt = now;
  return next;
}

/** A branch keeps the trackers; suggestions that point at scenes the branch does not have are dropped. */
function forBranch(file, store) {
  const next = structuredClone(file);
  const ids = new Set((store?.scenes || []).map((s) => s.id));
  next.suggestions = (next.suggestions || []).filter((s) => ids.has(s.sceneId));
  return next;
}

/* ---------- uses ---------- */

/** The words a tracker gives the reply model: "하린·세아 사귄 지 3일째", "하린 발정기: 진행 중 (2/5일째)". */
function entryText(item, status) {
  const who = item.scope !== 'room' && item.people.length ? `${item.people.join('·')} ` : '';
  return item.type === 'cycle' ? `${who}${item.label}: ${status.short}` : `${who}${item.label} ${status.short}`;
}

/**
 * "[기록] a · b · c": the trackers set to 'always', then those set to 'present' whose people are all in `present` (a
 * room-wide tracker counts as present), each worked out on its own clock. A tracker with nothing to say (no story date, no
 * start) is left out. Within `max` characters; whatever does not fit is left out. Empty string when nothing qualifies.
 */
function injectionBlock(file, { present = [], story = null, real = null, max = INJECT_CHARS } = {}) {
  if (!isTrackers(file)) return '';
  const here = new Set(present.map((n) => A.canonical(n)).filter(Boolean));
  const ctx = { story, real: real || localDate() };
  const lines = [];
  for (const mode of ['always', 'present']) {
    for (const item of file.items) {
      if (item.inject !== mode) continue;
      if (mode === 'present' && item.scope !== 'room' && item.people.length && !item.people.every((n) => here.has(A.canonical(n)))) continue;
      const status = evaluate(item, todayFor(item, ctx));
      if (status.ok) lines.push(entryText(item, status));
    }
  }
  let out = '[기록]';
  let used = 0;
  for (const text of lines) {
    const add = `${used ? ' · ' : ' '}${text}`;
    if (out.length + add.length > max) continue;
    out += add;
    used++;
  }
  return used ? out : '';
}

/** The items for the screen, each with what it says today. */
function view(file, ctx) {
  const c = { story: ctx?.story || null, real: ctx?.real || localDate() };
  return (isTrackers(file) ? file.items : []).map((it) => {
    const today = todayFor(it, c);
    const status = evaluate(it, today);
    return { ...it, status: { ok: status.ok, text: status.short, kind: status.kind, today }, line: status.ok ? entryText(it, status) : '' };
  });
}

module.exports = {
  TRACKERS_VERSION, TYPES, SCOPES, CLOCKS, INJECTS, UNITS, PREDICTS, INJECT_CHARS, MAX_ITEMS, MAX_STARTS,
  parseDate, daysBetween, addDays, addMonths, localDate, shortDate, evaluate, todayFor, emptyTrackers, isTrackers,
  normalizeItem, addItem, editItem, deleteItem, addStart, removeStart, editStart, startFromDate, keywordsOf, suggest, answerSuggestion, forBranch, entryText, injectionBlock, view,
};
