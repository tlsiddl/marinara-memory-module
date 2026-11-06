'use strict';
// 장소 기억 (places): one file per room, <chat>.places.json.
//
// While the feature is on, the scene call may also answer `placeNotes` for a scene: stable details of the scene's
// place that the text shows (furniture, view, layout, smell), short. The cleaned answer is kept on the scene
// (scene.placeNotes), so the places can always be worked out again from the saved scenes (no extra model call).
//
//   places  [{ id, name, aliases[], description, layout, features[], firstSeen: { scene }, lastSeen: { scene },
//              scenes[], sources: { description, layout, features, aliases }, user: { description?, layout?, features? },
//              custom?, updatedAt }]
//   hidden  normalized names the user removed (notes under those names are ignored until the user adds them again)
//
// Two names are one place only through the name itself or the alias list the user keeps ("집무실" = "하준의 집무실");
// nothing is merged by guessing. Pure logic; the service loads and saves the file and checks the switch.

const crypto = require('node:crypto');

const PLACES_VERSION = 1;
const FEATURE_CAP = 12;
const MAX_PLACES = 80;
const MAX_ALIASES = 12;
const NAME_MAX = 40;
const DESC_MAX = 80;
const LAYOUT_MAX = 80;
const FEATURE_MAX = 40;
const PER_SCENE_FEATURES = 6;
/** The most the injected "[장소]" line may take. */
const INJECT_CHARS = 160;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const clip = (s, max) => {
  const t = tidy(s);
  if (!t || /^(null|none|없음|미상|해당 없음)$/i.test(t)) return '';
  return t.slice(0, max);
};
/** What two spellings of one place name share: case, spaces and punctuation aside. */
const keyOf = (s) => tidy(s).toLowerCase().replace(/[\s.,!?'"“”‘’·~\-_()[\]]/g, '');
const idOf = (key) => `pl_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 8)}`;

/* ---------- the prompt part (added only while the feature is on) ---------- */

const PROMPT = `장소 기록 (이 방에서 켠 기능):
각 장면 객체에 "placeNotes"도 적어. 이 장면의 장소에서 원문에 보인, 쉽게 바뀌지 않는 모습(가구·전망·배치·냄새·분위기)만 짧게 적어. 원문에 없는 것은 지어내지 마. 새로 보인 것이 없으면 [].
형식: "placeNotes":[{"place":"장소 이름","description":"한 구절(40자 이내)","layout":"배치 한 구절 또는 null","features":["짧은 구절"]}]`;

/* ---------- one scene's answer ---------- */

function cleanFeatures(v, max) {
  const out = [];
  for (const raw of Array.isArray(v) ? v : typeof v === 'string' ? [v] : []) {
    const t = clip(raw, FEATURE_MAX);
    if (t && !out.some((x) => keyOf(x) === keyOf(t))) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** One place note from the model, cleaned: `{ place, description?, layout?, features? }`, or null when nothing is left. */
function cleanNote(raw, fallbackPlace) {
  if (!raw || typeof raw !== 'object') return null;
  const place = clip(raw.place, NAME_MAX) || clip(fallbackPlace, NAME_MAX);
  if (!place) return null;
  const out = { place };
  const description = clip(raw.description, DESC_MAX);
  const layout = clip(raw.layout, LAYOUT_MAX);
  const features = cleanFeatures(raw.features, PER_SCENE_FEATURES);
  if (description) out.description = description;
  if (layout) out.layout = layout;
  if (features.length) out.features = features;
  return Object.keys(out).length > 1 ? out : null;
}

/* ---------- the places ---------- */

function emptyPlaces() {
  return { version: PLACES_VERSION, places: [], hidden: [], updatedAt: null };
}
const isPlaces = (v) => !!v && typeof v === 'object' && v.version === PLACES_VERSION && Array.isArray(v.places);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/** Map(normalized name or alias -> place), the first place wins. */
function indexOf(places) {
  const map = new Map();
  for (const p of places) for (const n of [p.name, ...(p.aliases || [])]) {
    const k = keyOf(n);
    if (k && !map.has(k)) map.set(k, p);
  }
  return map;
}

/**
 * The places as the saved scenes say, in scene order (a later description or layout wins, features are collected
 * without repeats and the newest kept), then the user's own edits laid over them. `previous` supplies the aliases,
 * edits, hand-made places and time stamps. Returns the new file; the caller compares and saves.
 */
function fold(store, previous) {
  const old = isPlaces(previous) ? previous : emptyPlaces();
  const hidden = new Set((old.hidden || []).map(keyOf));
  const places = [];
  const fresh = (name, id, extra = {}) => ({ id, name, aliases: [], auto: { description: '', layout: '', features: [] }, scenes: [], ...extra });
  // Places that must stay: made by hand, or carrying something the user wrote.
  for (const p of old.places) {
    if (!p?.name) continue;
    if (!(p.custom || p.user && Object.keys(p.user).length || (p.aliases || []).length)) continue;
    places.push(fresh(p.name, p.id || idOf(keyOf(p.name)), { aliases: [...(p.aliases || [])], user: p.user || {}, custom: !!p.custom }));
  }
  let index = indexOf(places);
  const find = (name) => index.get(keyOf(name)) || null;
  const scenes = store?.scenes || [];
  for (const scene of scenes) {
    for (const note of Array.isArray(scene.placeNotes) ? scene.placeNotes : []) {
      const key = keyOf(note?.place);
      if (!key || hidden.has(key)) continue;
      let p = find(note.place);
      if (!p) {
        p = fresh(clip(note.place, NAME_MAX), idOf(key));
        places.push(p);
        index = indexOf(places);
      }
      if (note.description) p.auto.description = note.description;
      if (note.layout) p.auto.layout = note.layout;
      for (const f of note.features || []) {
        p.auto.features = p.auto.features.filter((x) => keyOf(x) !== keyOf(f));
        p.auto.features.push(f);
      }
      p.auto.features = p.auto.features.slice(-FEATURE_CAP);
    }
  }
  // Which scenes took place there (by the scene's own place, or by a note that named it).
  const order = new Map(scenes.map((s, i) => [s.id, i]));
  for (const scene of scenes) {
    const named = new Set((Array.isArray(scene.placeNotes) ? scene.placeNotes : []).map((n) => find(n.place)).filter(Boolean));
    const own = scene.place ? find(scene.place) : null;
    if (own) named.add(own);
    for (const p of named) if (!p.scenes.includes(scene.id)) p.scenes.push(scene.id);
  }
  const before = new Map(old.places.map((p) => [p.id, p]));
  const now = new Date().toISOString();
  const out = [];
  for (const p of places) {
    const user = p.user || {};
    const sources = {};
    const card = {
      id: p.id,
      name: p.name,
      aliases: p.aliases,
      description: has(user, 'description') ? user.description : p.auto.description,
      layout: has(user, 'layout') ? user.layout : p.auto.layout,
      features: has(user, 'features') ? user.features : p.auto.features,
    };
    for (const f of ['description', 'layout', 'features']) if (has(user, f)) sources[f] = 'user';
    if (p.aliases.length) sources.aliases = 'user';
    p.scenes.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    card.firstSeen = p.scenes.length ? { scene: p.scenes[0] } : null;
    card.lastSeen = p.scenes.length ? { scene: p.scenes.at(-1) } : null;
    card.scenes = p.scenes;
    card.sources = sources;
    if (Object.keys(user).length) card.user = user;
    if (p.custom) card.custom = true;
    const had = before.get(p.id);
    card.updatedAt = had && same({ ...had, updatedAt: null }, { ...card, updatedAt: null }) ? had.updatedAt : now;
    out.push(card);
  }
  out.sort((a, b) => (order.get(b.lastSeen?.scene) ?? -1) - (order.get(a.lastSeen?.scene) ?? -1) || a.name.localeCompare(b.name));
  const next = { version: PLACES_VERSION, places: out.slice(0, MAX_PLACES), hidden: [...hidden], updatedAt: old.updatedAt };
  if (!same(next.places, old.places) || !same(next.hidden, old.hidden || [])) next.updatedAt = now;
  return next;
}

/* ---------- the user's edits (laid over the scenes by fold) ---------- */

const byId = (file, id) => file.places.findIndex((p) => p.id === id);
const findAt = (file, id) => {
  const at = byId(file, id);
  if (at < 0) throw Error('해당 장소를 찾지 못했습니다.');
  return at;
};
/** Another place already goes by this name or alias. */
const taken = (file, name, except = null) => {
  const k = keyOf(name);
  return file.places.find((p) => p.id !== except && [p.name, ...(p.aliases || [])].some((n) => keyOf(n) === k));
};

function setField(file, id, field, value) {
  if (!['description', 'layout', 'features'].includes(field)) throw Error('고칠 수 없는 항목입니다.');
  const next = structuredClone(file);
  const p = next.places[findAt(next, id)];
  const v = field === 'features'
    ? cleanFeatures(Array.isArray(value) ? value : String(value ?? '').split(/[·;\n]+/), FEATURE_CAP)
    : clip(value, field === 'description' ? DESC_MAX : LAYOUT_MAX);
  p.user = { ...(p.user || {}), [field]: v };
  return next;
}
function unlockField(file, id, field) {
  const next = structuredClone(file);
  const p = next.places[findAt(next, id)];
  if (!p.user) return next;
  const user = { ...p.user };
  delete user[field];
  if (Object.keys(user).length) p.user = user; else delete p.user;
  return next;
}
/** The other names of a place (replaces the list). */
function setAliases(file, id, value) {
  const next = structuredClone(file);
  const p = next.places[findAt(next, id)];
  const list = [];
  for (const raw of Array.isArray(value) ? value : String(value ?? '').split(/[·;,\n]+/)) {
    const t = clip(raw, NAME_MAX);
    if (!t || keyOf(t) === keyOf(p.name) || list.some((x) => keyOf(x) === keyOf(t))) continue;
    const other = taken(next, t, id);
    if (other) throw Error(`‘${t}’은(는) 이미 ‘${other.name}’ 장소의 이름입니다. 합치려면 ‘합치기’를 쓰세요.`);
    list.push(t);
    if (list.length >= MAX_ALIASES) break;
  }
  p.aliases = list;
  return next;
}
function addPlace(file, name) {
  const t = clip(name, NAME_MAX);
  if (!t) throw Error('장소 이름을 적어 주세요.');
  const other = taken(file, t);
  if (other) throw Error(`‘${other.name}’ 장소가 이미 있습니다.`);
  if (file.places.length >= MAX_PLACES) throw Error(`장소는 방마다 ${MAX_PLACES}곳까지 둘 수 있습니다.`);
  const next = structuredClone(file);
  next.hidden = (next.hidden || []).filter((k) => keyOf(k) !== keyOf(t));
  next.places.push({ id: idOf(keyOf(t)), name: t, aliases: [], description: '', layout: '', features: [], scenes: [], custom: true });
  return next;
}
/** `from` becomes another name of `into`; what the user wrote in `from` is carried over where `into` has none. */
function mergePlaces(file, fromId, intoId) {
  if (fromId === intoId) throw Error('같은 장소입니다.');
  const next = structuredClone(file);
  const from = next.places[findAt(next, fromId)];
  const into = next.places[findAt(next, intoId)];
  const names = [from.name, ...(from.aliases || [])];
  into.aliases = [...new Set([...(into.aliases || []), ...names.filter((n) => keyOf(n) !== keyOf(into.name))])].slice(0, MAX_ALIASES);
  into.user = { ...(from.user || {}), ...(into.user || {}) };
  if (!Object.keys(into.user).length) delete into.user;
  next.places.splice(byId(next, fromId), 1);
  return next;
}
/** Remove a place; notes under its name are then ignored until the user adds it again. */
function deletePlace(file, id) {
  const next = structuredClone(file);
  const at = findAt(next, id);
  const p = next.places[at];
  next.hidden = [...new Set([...(next.hidden || []), keyOf(p.name), ...(p.aliases || []).map(keyOf)])];
  next.places.splice(at, 1);
  return next;
}

/* ---------- uses ---------- */

/** The place a name stands for (its name or an alias), or null. */
function resolve(file, name) {
  if (!isPlaces(file)) return null;
  return indexOf(file.places).get(keyOf(name)) || null;
}

/**
 * "[장소] 집무실: 통유리 너머 항구 · 검은 가죽 소파 · …" for the place of the current scene, within `max`
 * characters. Empty string when the place is unknown or nothing is recorded for it.
 */
function injectionBlock(file, placeName, max = INJECT_CHARS) {
  const p = resolve(file, placeName);
  if (!p) return '';
  const pieces = [p.description, p.layout, ...(p.features || [])].filter(Boolean);
  let line = `[장소] ${p.name}:`;
  let used = 0;
  for (const piece of pieces) {
    const add = `${used ? ' · ' : ' '}${piece}`;
    if (line.length + add.length > max) continue;
    line += add;
    used++;
  }
  return used ? line : '';
}

/** The places in the shape the screen shows. */
function view(file) {
  return (isPlaces(file) ? file.places : []).map((p) => ({ ...p }));
}

module.exports = {
  PLACES_VERSION, FEATURE_CAP, INJECT_CHARS, PROMPT, keyOf, cleanNote, emptyPlaces, isPlaces, fold, setField, unlockField, setAliases, addPlace, mergePlaces, deletePlace, resolve, injectionBlock, view,
};
