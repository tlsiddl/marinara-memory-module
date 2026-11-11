'use strict';
// 인물 현재 상태 카드 (characterState): one file per room, <chat>.state.json.
//
// While the feature is on, the scene call may also answer `state` for a scene: the people whose state changed in
// that scene, with only the fields that changed (location, outfit, injuries added/healed, things carried
// gained/lost, mood), each backed by sentence numbers. The cleaned answer is kept on the scene (scene.state), so the
// cards can always be worked out again from the saved scenes (no extra model call).
//
//   cards  [{ name, location, outfit, injuries[], carrying[], mood, other?, asOf: { scene, number },
//             evidence: [{ scene, number, sentence }], source: 'auto' | 'user', sources: { field: 'auto' | 'user' },
//             user: { field: value }, updatedAt }]
//
// A field the user edited (user[field], source 'user') is never replaced by what the scenes say until the user
// gives it back to the automatic value, except the location: where someone is changes with the story, so a scene
// after the edit (userAt.location, the scene the card had reached when it was made) that moves them takes over.
// A person in a scene whose state names no location for them is where the scene is (scene.place).
// Pure logic; the service loads and saves the file and checks the switch.

const A = require('./aliases.cjs');

const STATE_VERSION = 1;
const SCALARS = ['location', 'outfit', 'mood', 'other'];
const LISTS = ['injuries', 'carrying'];
const FIELDS = [...SCALARS, ...LISTS];
const SCALAR_MAX = { location: 60, outfit: 80, mood: 40, other: 60 };
const LIST_CAP = { injuries: 8, carrying: 10 };
const ITEM_MAX = 50;
/**
 * An injury or symptom stays on the card while it is recent: from the person's latest story day, or among their last
 * INJURY_ENTRIES state changes when the scenes have no dates. One that lasts by nature (a cast, stitches, a scar, a
 * burn…) stays until it is healed. A cramp, a faint or nausea from yesterday is not "now".
 */
const INJURY_ENTRIES = 4;
const LASTING = /골절|부러|깁스|붕대|꿰맨|봉합|흉터|화상|흉|임신|실명|절단|fractur|broken|cast\b|stitch|scar|burn|bandag|sling|pregnan|blind|amputat/i;
const dayOf = (time) => String(time || '').match(/\d{2,4}-\d{1,2}-\d{1,2}/)?.[0] || null;
const PER_SCENE_ITEMS = 4;
const EVIDENCE_KEEP = 6;
const MAX_CARDS = 60;
/** The most the injected "[지금 상태]" line may take. */
const INJECT_CHARS = 320;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const clip = (s, max) => {
  const t = tidy(s);
  if (!t || /^(null|none|없음|미상|해당 없음)$/i.test(t)) return '';
  if (t.length <= max) return t;
  let cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  if (space > max * 0.6) cut = cut.slice(0, space);
  // No dangling little word at the end ("leg cramps after jumping from").
  while (/\s(?:from|of|to|with|and|or|the|a|an|after|before|by|in|on|at|for|into|under)$/i.test(cut)) cut = cut.replace(/\s\S+$/, '');
  return cut.replace(/[\s,;:·/-]+$/, '');
};
/** What two spellings of one place or item share: case, spaces and punctuation aside. */
const keyOf = (s) => tidy(s).toLowerCase().replace(/[\s.,!?'"“”‘’·~\-_()[\]]/g, '');
/** true when two item texts say the same thing ("왼팔 붕대" ~ "붕대"): equal, or one holds the other (at least 2 characters). */
const alike = (a, b) => {
  const x = keyOf(a), y = keyOf(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)));
};

/* ---------- the prompt part (added only while the feature is on) ---------- */

const PROMPT = `인물 상태 기록 (이 방에서 켠 기능):
각 장면 객체에 "state"도 적어. 이 장면에서 상태가 바뀐 인물만, 장면이 끝난 시점의 모습으로 적어. 원문에 드러난 것만 쓰고 짐작하거나 지어내지 마. 바뀌지 않은 항목은 아예 생략해(바뀐 인물이 없으면 []). 항목은 모두 짧은 구절로.
- location: 지금 있는 곳 / outfit: 옷차림 / mood: 기분·상태 한 구절(사용자 캐릭터는 본인이 말한 것만)
- injuries: {"add":["새로 생긴 부상·증상"],"heal":["나은 것"]} / carrying: {"gain":["새로 들게 된 물건"],"lose":["잃거나 내려놓은 물건"]}
- evidence: 그렇게 판단한 문장 번호들(예: ["23.4"]). 번호가 없으면 그 인물은 적지 마.
형식: "state":[{"who":"인물","location":"…","outfit":"…","injuries":{"add":[],"heal":[]},"carrying":{"gain":[],"lose":[]},"mood":"…","evidence":["23.4"]}]`;

/* ---------- one scene's answer ---------- */

const list = (v, max) => {
  const out = [];
  for (const raw of Array.isArray(v) ? v : typeof v === 'string' ? [v] : []) {
    const t = clip(raw, ITEM_MAX);
    if (t && !out.some((x) => alike(x, t) && keyOf(x) === keyOf(t))) out.push(t);
    if (out.length >= max) break;
  }
  return out;
};

/**
 * One person's entry from the model, cleaned: `{ who, location?, outfit?, mood?, other?, injuries?: { add, heal },
 * carrying?: { gain, lose } }`, or null when nothing is left. `isUser` drops what only the user's own character may say.
 */
function cleanEntry(raw, who, { isUser = false } = {}) {
  if (!raw || typeof raw !== 'object' || !who) return null;
  const out = { who };
  for (const f of SCALARS) {
    if (isUser && (f === 'mood' || f === 'other')) continue;
    const v = clip(raw[f], SCALAR_MAX[f]);
    if (v) out[f] = v;
  }
  const inj = { add: list(raw.injuries?.add, PER_SCENE_ITEMS), heal: list(raw.injuries?.heal, PER_SCENE_ITEMS) };
  if (inj.add.length || inj.heal.length) out.injuries = Object.fromEntries(Object.entries(inj).filter(([, v]) => v.length));
  const car = { gain: list(raw.carrying?.gain, PER_SCENE_ITEMS), lose: list(raw.carrying?.lose, PER_SCENE_ITEMS) };
  if (car.gain.length || car.lose.length) out.carrying = Object.fromEntries(Object.entries(car).filter(([, v]) => v.length));
  return Object.keys(out).length > 1 ? out : null;
}

/* ---------- the cards ---------- */

function emptyState() {
  return { version: STATE_VERSION, cards: [], updatedAt: null };
}
const isState = (v) => !!v && typeof v === 'object' && v.version === STATE_VERSION && Array.isArray(v.cards);

function applyList(items, add, remove, cap) {
  let out = items.filter((x) => !remove.some((r) => alike(x, r)));
  for (const a of add) {
    out = out.filter((x) => keyOf(x) !== keyOf(a));
    out.push(a);
  }
  return out.slice(-cap);
}

const cleanUser = (field, value) => {
  if (SCALARS.includes(field)) return clip(value, SCALAR_MAX[field]);
  const parts = Array.isArray(value) ? value : String(value ?? '').split(/[·;\n]+/);
  return list(parts, LIST_CAP[field]);
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The cards as the saved scenes say, in scene order (a later scene wins; healed injuries and lost things are taken
 * off), then the user's own edits laid over them. `previous` supplies those edits and the time stamps. Returns
 * the new file; the caller compares and saves.
 */
function fold(store, previous) {
  const old = isState(previous) ? previous : emptyState();
  const auto = new Map();
  const touch = (name) => {
    if (!auto.has(name)) auto.set(name, { name, injuries: [], carrying: [], evidence: [], asOf: null, injuryAt: new Map(), entries: 0, day: null });
    return auto.get(name);
  };
  const sceneOrder = new Map((store?.scenes || []).map((x, i) => [x.id, i]));
  for (const scene of store?.scenes || []) {
    const order = sceneOrder.get(scene.id);
    for (const entry of Array.isArray(scene.state) ? scene.state : []) {
      const name = A.canonical(entry?.who);
      if (!name) continue;
      const card = touch(name);
      for (const f of SCALARS) if (entry[f]) card[f] = entry[f];
      card.injuries = applyList(card.injuries, entry.injuries?.add || [], entry.injuries?.heal || [], LIST_CAP.injuries);
      card.entries++;
      card.day = dayOf(scene.time) || card.day;
      for (const a of entry.injuries?.add || []) card.injuryAt.set(keyOf(a), { entry: card.entries, day: dayOf(scene.time) });
      card.carrying = applyList(card.carrying, entry.carrying?.gain || [], entry.carrying?.lose || [], LIST_CAP.carrying);
      const marks = (entry.evidence || []).filter((e) => Number.isFinite(e?.number)).map((e) => ({ scene: scene.id, number: e.number, sentence: e.sentence }));
      card.evidence = [...card.evidence, ...marks].slice(-EVIDENCE_KEEP);
      card.asOf = { scene: scene.id, number: marks.length ? Math.max(...marks.map((m) => m.number)) : Number.isFinite(scene.end) ? scene.end : 0 };
      if (entry.location) card.locAt = order;
    }
    // Someone who is in the scene, with no location of their own in it, is where the scene takes place.
    const told = new Set((Array.isArray(scene.state) ? scene.state : []).filter((e) => e?.location).map((e) => A.canonical(e.who)));
    const place = clip(scene.place, SCALAR_MAX.location);
    if (place) {
      for (const who of scene.present || []) {
        const name = A.canonical(who);
        if (!name || told.has(name) || !auto.has(name)) continue;
        const card = auto.get(name);
        if (card.location !== place) card.location = place;
        card.locAt = order;
      }
    }
  }
  // Injuries that are not recent any more are left off (lasting ones stay until healed).
  for (const card of auto.values()) {
    card.injuries = card.injuries.filter((x) => {
      if (LASTING.test(x)) return true;
      const at = card.injuryAt.get(keyOf(x));
      if (!at) return true;
      if (at.day && card.day) return at.day === card.day;
      return card.entries - at.entry < INJURY_ENTRIES;
    });
    delete card.injuryAt;
    delete card.entries;
    delete card.day;
  }
  const locAtOf = new Map([...auto].map(([n, c]) => [n, c.locAt]));
  for (const card of auto.values()) delete card.locAt;
  const users = new Map();
  const userAt = new Map();
  for (const c of old.cards) {
    const name = A.canonical(c?.name);
    if (!name || !c.user || !Object.keys(c.user).length) continue;
    users.set(name, { ...(users.get(name) || {}), ...c.user });
    // When the hand edit was made: recorded with it, or (an older edit) the scene the card had reached by then.
    userAt.set(name, { ...(c.userAt || {}), ...(has(c.user, 'location') && !c.userAt?.location ? { location: c.locScene || c.asOf?.scene || null } : {}) });
  }
  // A location set by hand gives way once a later scene puts the person somewhere.
  for (const [name, user] of users) {
    const at = userAt.get(name)?.location;
    const moved = locAtOf.get(name);
    if (has(user, 'location') && at && sceneOrder.has(at) && Number.isFinite(moved) && moved > sceneOrder.get(at)) {
      const { location: _gone, ...rest } = user;
      users.set(name, rest);
      const times = { ...(userAt.get(name) || {}) };
      delete times.location;
      userAt.set(name, times);
    }
  }
  for (const name of users.keys()) touch(name);
  const oldBy = new Map();
  for (const c of old.cards) oldBy.set(A.canonical(c?.name), c);
  const now = new Date().toISOString();
  const cards = [];
  for (const [name, a] of auto) {
    const user = users.get(name) || {};
    const sources = {};
    const card = { name, location: '', outfit: '', injuries: [], carrying: [], mood: '', other: '' };
    for (const f of FIELDS) {
      if (has(user, f)) { card[f] = user[f]; sources[f] = 'user'; } else if (a[f] !== undefined) card[f] = a[f];
    }
    if (!card.other) delete card.other;
    const filled = FIELDS.some((f) => (Array.isArray(card[f]) ? card[f].length : card[f]));
    if (!filled && !Object.keys(user).length) continue;
    card.asOf = a.asOf;
    // The scene the location was last taken from: a hand edit is dated by it.
    const locScene = Number.isFinite(locAtOf.get(name)) ? store.scenes[locAtOf.get(name)]?.id : null;
    if (locScene) card.locScene = locScene;
    card.evidence = a.evidence;
    card.source = Object.keys(sources).length ? 'user' : 'auto';
    card.sources = sources;
    if (Object.keys(user).length) card.user = user;
    const times = Object.fromEntries(Object.entries(userAt.get(name) || {}).filter(([k]) => has(user, k)));
    if (Object.keys(times).length) card.userAt = times;
    const before = oldBy.get(name);
    card.updatedAt = before && same({ ...before, updatedAt: null }, { ...card, updatedAt: null }) ? before.updatedAt : now;
    cards.push(card);
  }
  cards.sort((x, y) => (y.asOf?.number || 0) - (x.asOf?.number || 0) || x.name.localeCompare(y.name));
  const next = { version: STATE_VERSION, cards: cards.slice(0, MAX_CARDS), updatedAt: old.updatedAt };
  if (!same(next.cards, old.cards)) next.updatedAt = now;
  return next;
}
function has(user, f) {
  return Object.prototype.hasOwnProperty.call(user, f);
}

/* ---------- the user's edits (laid over the scenes by fold) ---------- */

function cardOf(file, name) {
  const key = A.canonical(name);
  return { key, at: file.cards.findIndex((c) => A.canonical(c.name) === key) };
}

/** Lock one field to the user's value ("" or [] means "nothing"). Returns a new file with the edit recorded. */
function setField(file, name, field, value) {
  if (!FIELDS.includes(field)) throw Error('고칠 수 없는 항목입니다.');
  const key = A.canonical(name);
  if (!key) throw Error('인물 이름을 적어 주세요.');
  const next = structuredClone(file);
  const { at } = cardOf(next, key);
  const base = at >= 0 ? next.cards[at] : { name: key, injuries: [], carrying: [], location: '', outfit: '', mood: '' };
  base.user = { ...(base.user || {}), [field]: cleanUser(field, value) };
  base.userAt = { ...(base.userAt || {}), [field]: base.locScene || base.asOf?.scene || null };
  if (at >= 0) next.cards[at] = base; else next.cards.push(base);
  return next;
}
/** Give one field back to the scenes. */
function unlockField(file, name, field) {
  if (!FIELDS.includes(field)) throw Error('되돌릴 수 없는 항목입니다.');
  const next = structuredClone(file);
  const { at } = cardOf(next, name);
  if (at < 0 || !next.cards[at].user) return next;
  const user = { ...next.cards[at].user };
  delete user[field];
  if (Object.keys(user).length) next.cards[at].user = user; else delete next.cards[at].user;
  if (next.cards[at].userAt) {
    const times = { ...next.cards[at].userAt };
    delete times[field];
    if (Object.keys(times).length) next.cards[at].userAt = times; else delete next.cards[at].userAt;
  }
  return next;
}
/** A person who has no card yet (so that the user can fill one in by hand). */
function addCard(file, name) {
  const key = A.canonical(tidy(name).slice(0, 40));
  if (!key) throw Error('인물 이름을 적어 주세요.');
  if (cardOf(file, key).at >= 0) return structuredClone(file);
  if (file.cards.length >= MAX_CARDS) throw Error(`인물 카드는 방마다 ${MAX_CARDS}장까지 둘 수 있습니다.`);
  const next = structuredClone(file);
  next.cards.push({ name: key, injuries: [], carrying: [], location: '', outfit: '', mood: '', user: { location: '' } });
  return next;
}
function deleteCard(file, name) {
  const next = structuredClone(file);
  const { at } = cardOf(next, name);
  if (at < 0) throw Error('해당 인물 카드를 찾지 못했습니다.');
  next.cards.splice(at, 1);
  return next;
}

/* ---------- uses ---------- */

// Values saved under the older, shorter limits (30, 40, 60) were cut at that exact length, often in the middle of a word
// ("the back room, c"): shown up to the last whole word instead.
const OLD_CUTS = new Set([30, 40, 60]);
const healed = (v) => {
  const t = tidy(v);
  if (!OLD_CUTS.has(t.length) || /[.!?)]"'”’]$/.test(t) || !/[A-Za-z]$/.test(t)) return t;
  return clip(t, t.length - 1) || t;
};
const segments = (c) => [c.location, c.outfit, ...(c.injuries || []), ...(c.carrying || []), c.mood, c.other].filter(Boolean).map(healed);

/**
 * "[지금 상태] A: 집무실 · 젖은 셔츠 · 왼팔 붕대 · 휴대폰 / B: …": only the people in `present`, within `max`
 * characters. Empty string when no one qualifies.
 */
function injectionBlock(file, present, max = INJECT_CHARS) {
  if (!isState(file)) return '';
  const here = [];
  for (const n of present || []) {
    const c = A.canonical(n);
    if (c && !here.includes(c)) here.push(c);
  }
  if (!here.length) return '';
  const by = new Map(file.cards.map((c) => [A.canonical(c.name), c]));
  let line = '[지금 상태]';
  let used = 0;
  for (const name of here) {
    const card = by.get(name);
    if (!card) continue;
    const sep = used ? ' / ' : ' ';
    let text = `${name}:`;
    let parts = 0;
    for (const seg of segments(card)) {
      const add = `${parts ? ' · ' : ' '}${seg}`;
      if (line.length + sep.length + text.length + add.length > max) break;
      text += add;
      parts++;
    }
    if (!parts) continue;
    line += sep + text;
    used++;
  }
  return used ? line : '';
}

/**
 * Whose last known place clearly differs from the place of a scene: [canonical names]. Only an exact mismatch of the
 * normalized names counts; a person whose place was noted before the scene as the same place (they may only have left
 * during it) is never listed, and nothing is listed when the scene has no place. `key` normalizes a place name.
 */
function awayFrom(store, scene, key = keyOf) {
  const here = key(scene?.place);
  if (!here) return [];
  const scenes = store?.scenes || [];
  const at = scenes.findIndex((s) => s === scene || (s.id && s.id === scene.id));
  if (at < 0) return [];
  const where = (list, name) => {
    for (let i = list.length - 1; i >= 0; i--) for (const e of Array.isArray(list[i].state) ? list[i].state : []) if (A.canonical(e?.who) === name && e.location) return e.location;
    return null;
  };
  const out = [];
  for (const e of Array.isArray(scene.state) ? scene.state : []) {
    const name = A.canonical(e?.who);
    if (!name || !e.location || key(e.location) === here || out.includes(name)) continue;
    const before = where(scenes.slice(0, at), name);
    if (before && key(before) === here) continue;
    out.push(name);
  }
  return out;
}

/** The cards in the shape the screen shows. */
function view(file) {
  return (isState(file) ? file.cards : []).map((c) => ({ ...c }));
}

module.exports = {
  STATE_VERSION, FIELDS, SCALARS, LISTS, PROMPT, INJECT_CHARS, LIST_CAP, MAX_CARDS,
  keyOf, alike, cleanEntry, emptyState, isState, fold, setField, unlockField, addCard, deleteCard, injectionBlock, awayFrom, view,
};
