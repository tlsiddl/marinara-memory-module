'use strict';
// 소중한 물건 (keepsakes): gifts, souvenirs, mementos and other objects that carry meaning in the story. One file per room,
// <chat>.keepsakes.json. A switch in 설정 → 추가 기능 (off by default).
//
// While the feature is on, the scene call may also answer `keepsakes` for a scene: the meaningful objects that appeared or
// changed there (who has it, who it is from, what it means, whether it is kept / given away / lost / broken), each backed by
// sentence numbers. The cleaned answer is kept on the scene (scene.keepsakes), so the items can always be worked out again
// from the saved scenes (no extra model call). Ordinary props are not wanted, and what the text does not show is not written.
//
//   items  [{ id, name, aliases[], owner, from, meaning, status, gotAt: { scene, number, date? }, history: [{ scene, number, event }],
//             evidence: [{ scene, number, sentence }], source: 'auto' | 'user', sources: { field: 'auto' | 'user' },
//             user: { field: value }, custom?, updatedAt }]
//   hidden normalized names the user removed (notes under those names are ignored until the user adds them again)
//
// Two names are one item only through the name itself or the alias list the user keeps; nothing is merged by guessing.
// A field the user edited is never replaced by what the scenes say until the user gives it back. Pure logic; the service
// loads and saves the file and checks the switch. This is not the "가진 것" of a person's state card, which is whatever they
// carry right now.

const crypto = require('node:crypto');
const A = require('./aliases.cjs');

const KEEPSAKES_VERSION = 1;
const STATUSES = ['kept', 'given', 'lost', 'broken', 'unknown'];
const STATUS_LABEL = { kept: '간직함', given: '남에게 줌', lost: '잃어버림', broken: '망가짐', unknown: '모름' };
const FIELDS = ['owner', 'from', 'meaning', 'status'];
const NAME_MAX = 30;
const PERSON_MAX = 30;
const MEANING_MAX = 60;
const EVENT_MAX = 60;
const HISTORY_KEEP = 12;
const EVIDENCE_KEEP = 6;
const MAX_ITEMS = 60;
const MAX_ALIASES = 8;
const PER_SCENE = 4;
/** The most the injected "[소중한 물건]" line may take. */
const INJECT_CHARS = 160;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const clip = (s, max) => {
  const t = tidy(s);
  if (!t || /^(null|none|없음|미상|해당 없음)$/i.test(t)) return '';
  return t.slice(0, max);
};
/** What two spellings of one name share: case, spaces and punctuation aside. */
const keyOf = (s) => tidy(s).toLowerCase().replace(/[\s.,!?'"“”‘’·~\-_()[\]]/g, '');
const idOf = (key) => `ks_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 8)}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/* ---------- the prompt part (added only while the feature is on) ---------- */

const PROMPT = `소중한 물건 기록 (이 방에서 켠 기능):
각 장면 객체에 "keepsakes"도 적어. 이야기 속에서 뜻이 담긴 물건만 적어: 선물로 받은 것, 기념품, 유품, 약속이나 특정한 사람과 얽힌 상징적인 물건. 컵·펜·가방 같은 평범한 소품은 적지 마. 이 장면에서 새로 생겼거나 주인·상태가 바뀐 물건만 적고, 원문에 없는 것은 지어내지 마. 없으면 [].
- name: 물건 이름 / owner: 지금 가진 사람 / from: 준 사람이나 유래 / meaning: 담긴 뜻 한 구절 / status: kept(간직함)·given(남에게 줌)·lost(잃어버림)·broken(망가짐), 모르면 null / event: 이 장면에서 일어난 일 한 구절
- evidence: 그렇게 판단한 문장 번호(예: ["23.4"]). 번호가 없으면 그 물건은 적지 마.
형식: "keepsakes":[{"name":"은반지","owner":"인물","from":"준 사람 또는 null","meaning":"한 구절 또는 null","status":"kept","event":"한 구절 또는 null","evidence":["23.4"]}]`;

/* ---------- one scene's answer ---------- */

/**
 * One keepsake from the model, cleaned: `{ name, owner?, from?, meaning?, status?, event? }`, or null when there is no name or
 * nothing else is said. `person` matches a name to the people of the story (owner), or returns '' for a stranger.
 */
function cleanEntry(raw, { person = (n) => clip(n, PERSON_MAX) } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clip(raw.name ?? raw.item, NAME_MAX);
  if (!name) return null;
  const out = { name };
  const owner = person(clip(raw.owner, PERSON_MAX));
  if (owner) out.owner = owner;
  // "from" may be someone outside the cast (a grandmother): kept as written, short.
  const from = person(clip(raw.from, PERSON_MAX)) || clip(raw.from, PERSON_MAX);
  if (from) out.from = from;
  const meaning = clip(raw.meaning, MEANING_MAX);
  if (meaning) out.meaning = meaning;
  const status = STATUSES.includes(String(raw.status ?? '').toLowerCase()) && String(raw.status).toLowerCase() !== 'unknown' ? String(raw.status).toLowerCase() : '';
  if (status) out.status = status;
  const event = clip(raw.event, EVENT_MAX);
  if (event) out.event = event;
  return Object.keys(out).length > 1 ? out : null;
}

/* ---------- the items ---------- */

function emptyKeepsakes() {
  return { version: KEEPSAKES_VERSION, items: [], hidden: [], updatedAt: null };
}
const isKeepsakes = (v) => !!v && typeof v === 'object' && v.version === KEEPSAKES_VERSION && Array.isArray(v.items);

/** Map(normalized name or alias -> item), the first item wins. */
function indexOf(items) {
  const map = new Map();
  for (const it of items) for (const n of [it.name, ...(it.aliases || [])]) {
    const k = keyOf(n);
    if (k && !map.has(k)) map.set(k, it);
  }
  return map;
}

/**
 * The items as the saved scenes say, in scene order (a later owner, meaning or status wins; the origin stays as first
 * written), then the user's own edits laid over them. `previous` supplies the aliases, edits, hand-made items and time
 * stamps. Returns the new file; the caller compares and saves.
 */
function fold(store, previous) {
  const old = isKeepsakes(previous) ? previous : emptyKeepsakes();
  const hidden = new Set((old.hidden || []).map(keyOf));
  const items = [];
  const fresh = (name, id, extra = {}) => ({ id, name, aliases: [], auto: { owner: '', from: '', meaning: '', status: '' }, history: [], evidence: [], gotAt: null, last: -1, ...extra });
  // Items that must stay: made by hand, or carrying something the user wrote.
  for (const it of old.items) {
    if (!it?.name) continue;
    if (!(it.custom || (it.user && Object.keys(it.user).length) || (it.aliases || []).length)) continue;
    items.push(fresh(it.name, it.id || idOf(keyOf(it.name)), { aliases: [...(it.aliases || [])], user: it.user || {}, custom: !!it.custom }));
  }
  let index = indexOf(items);
  const scenes = store?.scenes || [];
  scenes.forEach((scene, order) => {
    for (const entry of Array.isArray(scene.keepsakes) ? scene.keepsakes : []) {
      const key = keyOf(entry?.name);
      if (!key || hidden.has(key)) continue;
      let it = index.get(key) || null;
      if (!it) {
        it = fresh(clip(entry.name, NAME_MAX), idOf(key));
        items.push(it);
        index = indexOf(items);
      }
      const marks = (entry.evidence || []).filter((e) => Number.isFinite(e?.number));
      const first = marks.length ? Math.min(...marks.map((m) => m.number)) : Number.isFinite(scene.end) ? scene.end : 0;
      if (!it.gotAt) it.gotAt = { scene: scene.id, number: first, ...(scene.time ? { date: tidy(scene.time).slice(0, 40) } : {}) };
      if (entry.owner) it.auto.owner = entry.owner;
      if (entry.from && !it.auto.from) it.auto.from = entry.from;
      if (entry.meaning) it.auto.meaning = entry.meaning;
      if (entry.status) it.auto.status = entry.status;
      const event = entry.event || (entry.status ? STATUS_LABEL[entry.status] : '');
      if (event && !it.history.some((h) => h.scene === scene.id && h.event === event)) it.history.push({ scene: scene.id, number: first, event });
      it.history = it.history.slice(-HISTORY_KEEP);
      it.evidence = [...it.evidence, ...marks.map((e) => ({ scene: scene.id, number: e.number, sentence: e.sentence }))].slice(-EVIDENCE_KEEP);
      it.last = order;
    }
  });
  const before = new Map(old.items.map((it) => [it.id, it]));
  const now = new Date().toISOString();
  const out = [];
  for (const it of items) {
    const user = it.user || {};
    const sources = {};
    const card = { id: it.id, name: it.name, aliases: it.aliases };
    for (const f of FIELDS) {
      if (has(user, f)) { card[f] = user[f]; sources[f] = 'user'; } else card[f] = it.auto[f] || (f === 'status' ? 'unknown' : '');
    }
    if (it.aliases.length) sources.aliases = 'user';
    card.gotAt = it.gotAt;
    card.history = it.history;
    card.evidence = it.evidence;
    card.source = Object.keys(sources).some((k) => k !== 'aliases') ? 'user' : 'auto';
    card.sources = sources;
    if (Object.keys(user).length) card.user = user;
    if (it.custom) card.custom = true;
    const had = before.get(it.id);
    card.updatedAt = had && same({ ...had, updatedAt: null }, { ...card, updatedAt: null }) ? had.updatedAt : now;
    card.last = it.last;
    out.push(card);
  }
  out.sort((a, b) => b.last - a.last || a.name.localeCompare(b.name));
  for (const c of out) delete c.last;
  const next = { version: KEEPSAKES_VERSION, items: out.slice(0, MAX_ITEMS), hidden: [...hidden], updatedAt: old.updatedAt };
  if (!same(next.items, old.items) || !same(next.hidden, old.hidden || [])) next.updatedAt = now;
  return next;
}

/* ---------- the user's edits (laid over the scenes by fold) ---------- */

const findAt = (file, id) => {
  const at = file.items.findIndex((p) => p.id === id);
  if (at < 0) throw Error('해당 물건을 찾지 못했습니다.');
  return at;
};
/** Another item already goes by this name or alias. */
const taken = (file, name, except = null) => {
  const k = keyOf(name);
  return file.items.find((p) => p.id !== except && [p.name, ...(p.aliases || [])].some((n) => keyOf(n) === k));
};

function cleanField(field, value) {
  if (field === 'status') {
    const v = String(value ?? '').trim().toLowerCase();
    if (!STATUSES.includes(v)) throw Error(`상태는 ${STATUSES.join(', ')} 중 하나여야 합니다.`);
    return v;
  }
  return clip(value, field === 'meaning' ? MEANING_MAX : PERSON_MAX);
}
/** Lock one field to the user's value. Returns a new file with the edit recorded. */
function setField(file, id, field, value) {
  if (!FIELDS.includes(field)) throw Error('고칠 수 없는 항목입니다.');
  const next = structuredClone(file);
  const it = next.items[findAt(next, id)];
  const v = cleanField(field, value);
  it.user = { ...(it.user || {}), [field]: field === 'owner' || field === 'from' ? A.canonical(v) : v };
  return next;
}
/** Give one field back to the scenes. */
function unlockField(file, id, field) {
  if (!FIELDS.includes(field)) throw Error('되돌릴 수 없는 항목입니다.');
  const next = structuredClone(file);
  const it = next.items[findAt(next, id)];
  if (!it.user) return next;
  const user = { ...it.user };
  delete user[field];
  if (Object.keys(user).length) it.user = user; else delete it.user;
  return next;
}
/** The other names of an item (replaces the list). */
function setAliases(file, id, value) {
  const next = structuredClone(file);
  const it = next.items[findAt(next, id)];
  const list = [];
  for (const raw of Array.isArray(value) ? value : String(value ?? '').split(/[·;,\n]+/)) {
    const t = clip(raw, NAME_MAX);
    if (!t || keyOf(t) === keyOf(it.name) || list.some((x) => keyOf(x) === keyOf(t))) continue;
    const other = taken(next, t, id);
    if (other) throw Error(`‘${t}’은(는) 이미 ‘${other.name}’ 물건의 이름입니다. 합치려면 ‘합치기’를 쓰세요.`);
    list.push(t);
    if (list.length >= MAX_ALIASES) break;
  }
  it.aliases = list;
  return next;
}
function addItem(file, name, owner = '') {
  const t = clip(name, NAME_MAX);
  if (!t) throw Error('물건 이름을 적어 주세요.');
  const other = taken(file, t);
  if (other) throw Error(`‘${other.name}’ 물건이 이미 있습니다.`);
  if (file.items.length >= MAX_ITEMS) throw Error(`소중한 물건은 방마다 ${MAX_ITEMS}개까지 둘 수 있습니다.`);
  const next = structuredClone(file);
  next.hidden = (next.hidden || []).filter((k) => keyOf(k) !== keyOf(t));
  const who = A.canonical(clip(owner, PERSON_MAX)) || '';
  next.items.push({ id: idOf(keyOf(t)), name: t, aliases: [], owner: who, from: '', meaning: '', status: 'unknown', gotAt: null, history: [], evidence: [], custom: true, ...(who ? { user: { owner: who } } : {}) });
  return next;
}
/** `from` becomes another name of `into`; what the user wrote in `from` is carried over where `into` has none. */
function mergeItems(file, fromId, intoId) {
  if (fromId === intoId) throw Error('같은 물건입니다.');
  const next = structuredClone(file);
  const from = next.items[findAt(next, fromId)];
  const into = next.items[findAt(next, intoId)];
  const names = [from.name, ...(from.aliases || [])];
  into.aliases = [...new Set([...(into.aliases || []), ...names.filter((n) => keyOf(n) !== keyOf(into.name))])].slice(0, MAX_ALIASES);
  into.user = { ...(from.user || {}), ...(into.user || {}) };
  if (!Object.keys(into.user).length) delete into.user;
  next.items.splice(findAt(next, fromId), 1);
  return next;
}
/** Remove an item; notes under its name are then ignored until the user adds it again. */
function deleteItem(file, id) {
  const next = structuredClone(file);
  const at = findAt(next, id);
  const it = next.items[at];
  next.hidden = [...new Set([...(next.hidden || []), keyOf(it.name), ...(it.aliases || []).map(keyOf)])];
  next.items.splice(at, 1);
  return next;
}

/* ---------- uses ---------- */

const hasFinal = (word) => {
  const last = String(word).trim().slice(-1);
  const code = last.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
};
const iga = (name) => `${name}${hasFinal(name) ? '이' : '가'}`;

/**
 * "[소중한 물건] 하린: 은반지(세아가 준 것, 약속의 징표) · 나침반(…) / 세아: …": the items of the people in `present` (their
 * owner, or the person it is from), grouped by that person, within `max` characters. A lost, given or broken item says so.
 * Empty string when no one qualifies.
 */
function injectionBlock(file, present, max = INJECT_CHARS) {
  if (!isKeepsakes(file)) return '';
  const here = [];
  for (const n of present || []) {
    const c = A.canonical(n);
    if (c && !here.includes(c)) here.push(c);
  }
  if (!here.length) return '';
  const groups = new Map();
  for (const it of file.items) {
    const owner = A.canonical(it.owner);
    const from = A.canonical(it.from);
    const who = owner && here.includes(owner) ? owner : from && here.includes(from) ? from : null;
    if (!who) continue;
    const bits = [];
    // Under its owner: who gave it. Under the person it is from while the owner is elsewhere: whose it is now.
    if (owner && who !== owner) bits.push(`${owner}의 것`);
    else if (from && from !== owner) bits.push(`${iga(it.from)} 준 것`);
    if (it.meaning) bits.push(it.meaning);
    if (it.status && !['kept', 'unknown'].includes(it.status)) bits.push(STATUS_LABEL[it.status]);
    const text = `${it.name}${bits.length ? `(${bits.join(', ')})` : ''}`;
    if (!groups.has(who)) groups.set(who, []);
    groups.get(who).push(text);
  }
  let line = '[소중한 물건]';
  let used = 0;
  for (const name of here) {
    const list = groups.get(name);
    if (!list) continue;
    const sep = used ? ' / ' : ' ';
    let text = `${name}:`;
    let parts = 0;
    for (const t of list) {
      const add = `${parts ? ' · ' : ' '}${t}`;
      if (line.length + sep.length + text.length + add.length > max) continue;
      text += add;
      parts++;
    }
    if (!parts) continue;
    line += sep + text;
    used++;
  }
  return used ? line : '';
}

/** The items in the shape the screen shows. */
function view(file) {
  return (isKeepsakes(file) ? file.items : []).map((it) => ({ ...it }));
}

module.exports = {
  KEEPSAKES_VERSION, STATUSES, STATUS_LABEL, FIELDS, INJECT_CHARS, PER_SCENE, PROMPT, keyOf, cleanEntry, emptyKeepsakes, isKeepsakes, fold, setField, unlockField, setAliases, addItem, mergeItems, deleteItem, injectionBlock, view,
};
