'use strict';
// 기록 충돌 알림 (conflicts): facts about the same person or thing that seem to say different things. Part of the module (no
// switch), and it never calls a model: a cheap check of the saved facts, nothing more.
//
// One file per room, <chat>.conflicts.json, written only once there is something to keep:
//   conflicts [{ id, a, b, about, kind: 'negation' | 'number' | 'value', reason, status, createdAt, answeredAt? }]
//   status    'open' | 'keepA' | 'keepB' | 'both' | 'dismissed'     a = the earlier fact, b = the later one
//   next      the number of the next conflict (ids are not reused)
//
// The check: two live facts with the same `about` that share at least two key terms (word stems) and (a) say the same
// thing with and without a negation (안/않/못/없/아니, never, no longer ...), or (b) give different numbers for the same
// unit, or (c) name different colours, sides (left/right) or opposite states (alive/dead, married/single). A fact that
// explicitly changes the other (a "이제는/예전에는/더 이상" fact, or one that `replaces` the other) is not a conflict.
//
// The user answers each one; nothing is resolved by itself. "앞의 것 유지" / "뒤의 것 유지" mark the other fact as
// superseded: it is not deleted, it is only left out of the memory text. "둘 다 맞음" and "무시" change nothing
// in the memory text. Pure logic; the service loads and saves the file.

const S = require('./scenes.cjs');

const CONFLICTS_VERSION = 1;
const STATUSES = ['open', 'keepA', 'keepB', 'both', 'dismissed'];
/** The most open conflicts kept at once, the most records, and the most facts per person compared. */
const MAX_OPEN = 30;
const MAX_RECORDS = 150;
const PER_ABOUT = 60;
/** Key terms two facts must share before anything else is looked at. */
const MIN_SHARED = 2;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

/* ---------- reading a fact ---------- */

const STOP = new Set(['그녀', '그는', '그가', '매우', '아주', '정말', '항상', '때문', '하는', '있는', '없는', '한다', '했다', '있다', '없다', '이다', '그리', '이후', '이전', '이미', '다시', '함께', '같이', '자주', '가끔', '조금', '많이', '모든', '어떤', '그런', '이런', '하고', '하며', '하지', '해서', '대한', '위해', '통해', '라고', '있었', '없었', '것이', '수가', '때는', '에게', '으로', 'the', 'and', 'was', 'were', 'has', 'have', 'had', 'his', 'her', 'for', 'with', 'that', 'this', 'from', 'are', 'but', 'not', 'never', 'longer', 'does', 'did', 'doesn', 'didn', 'isn', 'wasn', 'its', 'she', 'they', 'them', 'their', 'also', 'very', 'been', 'being', 'into', 'about', 'than', 'then', 'when', 'what', 'who']);
const JOSA = /(으로|에서|에게|한테|까지|부터|처럼|보다|이라고|라고|에는|에도|이며|이고|으며|와|과|은|는|이|가|을|를|에|의|도|만|로|랑)$/;

/** Word stems of a fact: Korean words without their ending particle, cut to two syllables; Latin words without a plural s. */
function terms(text) {
  const out = new Set();
  const clean = tidy(text).toLowerCase().replace(/\(추정\)/g, ' ');
  for (const raw of clean.split(/[^0-9a-zÀ-ɏ가-힣]+/)) {
    if (!raw || /\d/.test(raw)) continue;
    let w = raw;
    if (/[가-힣]/.test(w)) {
      if (w.length >= 3) w = w.replace(JOSA, (m) => (w.length - m.length >= 2 ? '' : m));
      if (w.length >= 3) w = w.slice(0, 2);
      if (w.length < 2) continue;
    } else {
      if (w.length < 3) continue;
      w = w.replace(/s$/, '');
    }
    if (STOP.has(w) || /^(않|없|아니|아닌|못)/.test(w)) continue;
    out.add(w);
  }
  return out;
}

const NEG_KO = /않|(^|\s)안\s|(^|\s)못\s|못\s?(하|해|한|했|먹|가|자|마)|없|아니|아닌|모르|몰랐|싫/;
const NEG_EN = /\b(not|no|never|none|nothing|nobody|cannot|can't|won't|doesn't|don't|didn't|isn't|aren't|wasn't|weren't|hasn't|haven't|dislikes?|hates?)\b/i;
const negated = (text) => NEG_KO.test(text) || NEG_EN.test(text);
/** A fact that tells of a change ("이제는 …", "예전에는 …", "더 이상 …", "no longer", "used to") is an update, not a contradiction. */
const CHANGE = /더\s*이상|이제는|이제\s|예전에는|예전엔|전에는|원래는|그만두|그만했|끊었|끊기로|바뀌|달라졌|no longer|anymore|used to|stopped|quit/i;

const UNITS = '살|세|명|개|번|년|월|일|시간|시|분|초|층|호|원|달러|퍼센트|%|kg|cm|km|m|years?|months?|days?|hours?|times|siblings|children|people';
const NUMBER = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})`, 'gi');
/** Map(unit -> Set(values)) for the numbers that carry a unit. */
function numbers(text) {
  const out = new Map();
  for (const m of String(text).matchAll(NUMBER)) {
    const unit = m[2].toLowerCase().replace(/s$/, '');
    const value = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    if (!out.has(unit)) out.set(unit, new Set());
    out.get(unit).add(value);
  }
  return out;
}

const COLORS = [
  ['검정', /검[은정]|까만|흑발|black/i], ['흰색', /흰|하얀|하얗|백발|white/i], ['빨강', /빨간|빨강|붉|red/i], ['파랑', /파란|파랑|푸른|blue/i],
  ['노랑', /노란|노랑|금발|blond|yellow/i], ['초록', /초록|녹색|green/i], ['갈색', /갈색|밤색|brown/i], ['분홍', /분홍|pink/i],
  ['보라', /보라|purple/i], ['회색', /회색|잿빛|gr[ae]y/i],
];
const SIDES = [['왼쪽', /왼|\bleft\b/i], ['오른쪽', /오른|\bright\b/i]];
const OPPOSITES = [
  [['살아 있음', /살아\s?(있|계|남)|생존|alive/i], ['죽음', /죽었|사망|숨졌|세상을\s?떠|\bdead\b|\bdied\b/i]],
  [['기혼', /결혼했|기혼|\bmarried\b/i], ['미혼·이혼', /미혼|이혼|\bsingle\b|\bdivorced\b/i]],
  [['오른손잡이', /오른손잡이|right-handed/i], ['왼손잡이', /왼손잡이|left-handed/i]],
];

/** [kind, reason] when the two texts name different values of the same kind, else null. */
function values(a, b) {
  for (const group of [COLORS, SIDES]) {
    const x = group.filter(([, re]) => re.test(a)).map(([n]) => n);
    const y = group.filter(([, re]) => re.test(b)).map(([n]) => n);
    if (x.length && y.length && !x.some((n) => y.includes(n))) return `값이 다름: ${x.join('·')} ↔ ${y.join('·')}`;
  }
  for (const [p, q] of OPPOSITES) {
    if ((p[1].test(a) && q[1].test(b) && !p[1].test(b) && !q[1].test(a)) || (q[1].test(a) && p[1].test(b) && !q[1].test(b) && !p[1].test(a))) {
      return `서로 반대: ${p[0]} ↔ ${q[0]}`;
    }
  }
  return null;
}

/** How alike two term sets are: shared count, shared / all, and shared / the smaller set. */
function overlap(x, y) {
  let shared = 0;
  for (const t of x) if (y.has(t)) shared++;
  const all = x.size + y.size - shared;
  const small = Math.min(x.size, y.size);
  return { shared, jaccard: all ? shared / all : 0, within: small ? shared / small : 0 };
}

/**
 * Whether two fact texts seem to contradict each other: `{ kind, reason, score }` or null. The earlier text comes first.
 * Deliberately careful: it needs real overlap in what the facts are about (a negation needs two shared key terms; a number,
 * colour or side needs one shared term and most of the shorter fact), and says nothing about facts that merely differ.
 */
function compare(textA, textB) {
  const a = tidy(textA), b = tidy(textB);
  if (!a || !b || a === b) return null;
  if (CHANGE.test(a) || CHANGE.test(b)) return null;
  const x = terms(a), y = terms(b);
  const { shared, jaccard, within } = overlap(x, y);
  if (shared < 1) return null;
  // different numbers for the same unit
  const na = numbers(a), nb = numbers(b);
  for (const [unit, va] of na) {
    const vb = nb.get(unit);
    if (vb && within >= 0.5 && ![...va].some((v) => vb.has(v))) return { kind: 'number', reason: `숫자가 다름: ${[...va].join('·')}${unit} ↔ ${[...vb].join('·')}${unit}`, score: shared + jaccard };
  }
  // different colours, sides, opposite states
  const v = within >= 0.4 ? values(a, b) : null;
  if (v) return { kind: 'value', reason: v, score: shared + jaccard };
  // the same thing said with and without a negation
  if (shared >= MIN_SHARED && within >= 0.6 && jaccard >= 0.3 && negated(a) !== negated(b)) return { kind: 'negation', reason: `한쪽은 아니라고 함: ${negated(a) ? '앞' : '뒤'} 기록이 부정문`, score: shared + jaccard };
  return null;
}

/* ---------- the file ---------- */

function emptyConflicts() {
  return { version: CONFLICTS_VERSION, conflicts: [], next: 1, updatedAt: null };
}
const isConflicts = (v) => !!v && typeof v === 'object' && v.version === CONFLICTS_VERSION && Array.isArray(v.conflicts);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pairKey = (a, b) => `${a}|${b}`;
const idNumber = (id) => Number(String(id).replace(/\D/g, '')) || 0;

/** Pairs of live facts that seem to contradict each other: Map(key -> { a, b, about, kind, reason, score }). */
function detect(store) {
  const out = new Map();
  const groups = new Map();
  for (const f of S.liveFacts(store || { facts: [] })) {
    const about = tidy(f.about);
    if (!about || !f.id) continue;
    if (!groups.has(about)) groups.set(about, []);
    groups.get(about).push(f);
  }
  for (const [about, list] of groups) {
    const facts = list.sort((p, q) => idNumber(p.id) - idNumber(q.id)).slice(-PER_ABOUT);
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const a = facts[i], b = facts[j];
        if (b.replaces === a.id || a.replaces === b.id) continue;
        const hit = compare(a.text, b.text);
        if (hit) out.set(pairKey(a.id, b.id), { a: a.id, b: b.id, about, ...hit });
      }
    }
  }
  return out;
}

/**
 * The conflicts for the facts as they are now. Answered ones stay while both facts exist; an open one goes away on its own
 * when the facts no longer disagree (one was edited, replaced or deleted); new ones are added open. Returns the new file.
 */
function fold(store, previous, now = new Date().toISOString()) {
  const old = isConflicts(previous) ? previous : emptyConflicts();
  const byId = new Map((store?.facts || []).map((f) => [f.id, f]));
  const found = detect(store);
  const kept = [];
  for (const c of old.conflicts) {
    if (!byId.has(c.a) || !byId.has(c.b)) continue;
    const key = pairKey(c.a, c.b);
    const hit = found.get(key);
    if (c.status === 'open') {
      if (!hit) continue;
      kept.push({ ...c, about: hit.about, kind: hit.kind, reason: hit.reason });
    } else kept.push({ ...c, about: tidy(byId.get(c.a).about) || c.about });
    found.delete(key);
  }
  let next = Math.max(old.next || 1, ...old.conflicts.map((c) => idNumber(c.id) + 1));
  let open = kept.filter((c) => c.status === 'open').length;
  for (const hit of [...found.values()].sort((p, q) => q.score - p.score || idNumber(p.b) - idNumber(q.b))) {
    if (open >= MAX_OPEN) break;
    kept.push({ id: `C${next++}`, a: hit.a, b: hit.b, about: hit.about, kind: hit.kind, reason: hit.reason, status: 'open', createdAt: now });
    open++;
  }
  // Too many records: the oldest answered ones go first.
  while (kept.length > MAX_RECORDS) {
    const at = kept.findIndex((c) => c.status !== 'open');
    if (at < 0) break;
    kept.splice(at, 1);
  }
  const file = { version: CONFLICTS_VERSION, conflicts: kept, next, updatedAt: old.updatedAt };
  if (!same(file.conflicts, old.conflicts)) file.updatedAt = now;
  return file;
}

/** The user's answer to one conflict. Returns a new file. */
function answer(file, id, status, now = new Date().toISOString()) {
  if (!STATUSES.includes(status)) throw Error(`답은 ${STATUSES.join(', ')} 중 하나여야 합니다.`);
  const next = structuredClone(file);
  const c = next.conflicts.find((x) => x.id === id);
  if (!c) throw Error('해당 충돌을 찾지 못했습니다.');
  c.status = status;
  if (status === 'open') delete c.answeredAt; else c.answeredAt = now;
  next.updatedAt = now;
  return next;
}

/** Facts the user decided against ("앞의 것 유지" hides b, "뒤의 것 유지" hides a): left out of the memory text, never deleted. */
function hiddenIds(file, store) {
  const out = new Set();
  if (!isConflicts(file) || !file.conflicts.length) return out;
  const have = new Set((store?.facts || []).map((f) => f.id));
  for (const c of file.conflicts) {
    if (!have.has(c.a) || !have.has(c.b)) continue;
    if (c.status === 'keepA') out.add(c.b);
    else if (c.status === 'keepB') out.add(c.a);
  }
  return out;
}

/** What the screen shows: the open conflicts first, then the answered ones, each with both facts' texts. */
function view(file, store) {
  const facts = new Map((store?.facts || []).map((f) => [f.id, f]));
  const list = (isConflicts(file) ? file.conflicts : [])
    .filter((c) => facts.has(c.a) && facts.has(c.b))
    .map((c) => ({ ...c, aText: facts.get(c.a).text, bText: facts.get(c.b).text, aScene: facts.get(c.a).sceneId || null, bScene: facts.get(c.b).sceneId || null }));
  const open = list.filter((c) => c.status === 'open');
  const answered = list.filter((c) => c.status !== 'open').slice(-20).reverse();
  return { open: open.length, conflicts: [...open, ...answered] };
}

module.exports = {
  CONFLICTS_VERSION, STATUSES, MAX_OPEN, MIN_SHARED, terms, negated, compare, detect, emptyConflicts, isConflicts, fold, answer, hiddenIds, view,
};
