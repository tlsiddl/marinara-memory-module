'use strict';
// Why a memory came up (회상 이유) and the room's 중요(고정) / 빼기 choices.
// Pure logic: the reasons are side data returned beside the injection preview, never part of the injected text.
// The choices live in <chatId>.recall-prefs.json: { version, pinned:[ids], excluded:[ids] }. The ids are the ones the
// records already have (scene S12, chapter C3, fact F7, thread T5), so renames and merges keep them.

const RECALL_PREFS_VERSION = 1;
const MAX_IDS = 2000;
const ID_RE = /^[SCFT][0-9]{1,6}$/;
const KIND_OF = { S: 'scene', C: 'chapter', F: 'fact', T: 'thread' };

const emptyPrefs = () => ({ version: RECALL_PREFS_VERSION, pinned: [], excluded: [] });
const kindOf = (id) => KIND_OF[String(id)[0]] || null;
const validId = (id) => typeof id === 'string' && ID_RE.test(id);

function cleanList(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(validId))].slice(0, MAX_IDS);
}

/** Any stored value as a well-formed pair of lists; an id never sits in both (a pin wins). */
function normalize(value) {
  const pinned = cleanList(value?.pinned);
  const pins = new Set(pinned);
  const excluded = cleanList(value?.excluded).filter((id) => !pins.has(id));
  return { version: RECALL_PREFS_VERSION, pinned, excluded };
}

const isPrefs = (v) => !!v && typeof v === 'object' && v.version === RECALL_PREFS_VERSION && Array.isArray(v.pinned) && Array.isArray(v.excluded);

/** Pressing the same button again takes the mark off; pinning something left out lifts it out of the left-out list. */
function toggle(prefs, id, which) {
  if (!validId(id)) throw Error('중요/빼기를 정할 수 없는 항목입니다.');
  if (which !== 'pinned' && which !== 'excluded') throw Error('pinned 또는 excluded만 정할 수 있습니다.');
  const other = which === 'pinned' ? 'excluded' : 'pinned';
  const next = normalize(prefs);
  if (next[which].includes(id)) next[which] = next[which].filter((x) => x !== id);
  else {
    next[which] = [...next[which], id];
    next[other] = next[other].filter((x) => x !== id);
  }
  return next;
}

/** The ids the records have now (live facts, every thread); a mark on something that is gone drops silently. */
function liveIds(store, ledger, liveFacts) {
  const ids = new Set();
  for (const s of store?.scenes || []) ids.add(s.id);
  for (const c of store?.chapters || []) ids.add(c.id);
  for (const f of liveFacts(store || { facts: [] })) ids.add(f.id);
  for (const t of ledger?.threads || []) ids.add(t.id);
  return ids;
}

/** Marks on things that are gone drop out. A kind whose records could not be read right now (scenes, ledger) is kept as it is. */
function prune(prefs, ids, { scenes = true, ledger = true } = {}) {
  const p = normalize(prefs);
  const keep = (id) => ids.has(id) || (!scenes && 'SCF'.includes(id[0])) || (!ledger && id[0] === 'T');
  return { version: RECALL_PREFS_VERSION, pinned: p.pinned.filter(keep), excluded: p.excluded.filter(keep) };
}

/** A fact merged into a newer one (replacedBy) hands its mark to the one that carries it on. */
function followMerges(prefs, store) {
  const p = normalize(prefs);
  const facts = new Map((store?.facts || []).map((f) => [f.id, f]));
  if (![...p.pinned, ...p.excluded].some((id) => facts.get(id)?.replacedBy)) return p;
  const move = (id) => {
    let cur = id;
    for (let n = 0; n < 20; n++) {
      const f = facts.get(cur);
      if (!f?.replacedBy || !facts.has(f.replacedBy)) break;
      cur = f.replacedBy;
    }
    return cur;
  };
  return normalize({ pinned: p.pinned.map(move), excluded: p.excluded.map(move) });
}

const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

/** { pinned:Set, excluded:Set, any } for the render. */
function sets(prefs) {
  const p = normalize(prefs);
  return { pinned: new Set(p.pinned), excluded: new Set(p.excluded), any: p.pinned.length + p.excluded.length > 0 };
}

/** Scenes that stay out of automatic recall: left out one by one, or inside a chapter that was left out. */
function hiddenScenes(store, excluded) {
  const out = new Set();
  if (!excluded?.size) return out;
  for (const s of store?.scenes || []) if (excluded.has(s.id)) out.add(s.id);
  for (const c of store?.chapters || []) if (excluded.has(c.id)) for (const id of c.scenes || []) out.add(id);
  return out;
}

/** Words of `query` (their first two letters, as the other searches use) found in `text`: at most `max`. */
function termsIn(text, query, stems, max = 3) {
  const body = String(text || '').toLowerCase();
  if (!body || !query) return [];
  return [...stems(query)].filter((w) => body.includes(w)).slice(0, max);
}

const joinNames = (names) => (names || []).slice(0, 3).join('·');

/** Short Korean label for one reason. */
function label(r) {
  switch (r?.kind) {
    case 'present': return `지금 장면에 ${joinNames(r.names)} 있음`;
    case 'keyword': return r.terms?.length ? `${r.terms.slice(0, 3).map((t) => `‘${t}’`).join(' ')} 언급` : '지금 대화와 낱말이 겹침';
    case 'meaning': return `뜻이 비슷함 ${Number(r.score).toFixed(2)}`;
    case 'recent': return '최근 장면';
    case 'pinned': return '고정';
    case 'thread-open': return '끝나지 않은 일';
    case 'chapter': return '지난 이야기 흐름';
    case 'selected': return '직접 선택한 기억';
    case 'model': return '기억 모델이 고름';
    case 'follow': return `${r.from || ''}에 이어진 일`.trim();
    case 'pointed': return '예전 일을 가리키는 말';
    case 'fact': return '알게 된 사실';
    default: return '';
  }
}

const labelled = (reasons) => reasons.map((r) => ({ ...r, label: label(r) })).filter((r) => r.label);

module.exports = { RECALL_PREFS_VERSION, emptyPrefs, normalize, isPrefs, toggle, liveIds, prune, followMerges, same, sets, hiddenScenes, termsIn, label, labelled, kindOf, validId };
