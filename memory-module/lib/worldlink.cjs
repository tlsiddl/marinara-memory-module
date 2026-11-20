'use strict';
// 세계관 설정집 연동 v2 (tlsiddl/marinara-world-archive docs/연동-v2-설계안.md, 계약 수준 2). Read only: the memory
// module never writes to World Archive (relations are changed by its own reader). Pure logic; the service reads
// globalThis.__marinaraWorldArchive.api and passes what it got.
//   - relations: who knows whom from the start (family, friends, lovers, teacher and student, enemies — now or
//     before), for the scene prompt of the batch's people only. Whether two people know each other follows World
//     Archive; what they know (secrets, events) follows the memory's own reading of the chat.
//   - species (종): which people of the room are not people (pets, familiars), for the pet notebook.
//   - names: World Archive's romanized ↔ Korean pairs, for 0.35.4's automatic merges after the glossary's own.
// Nothing here runs for a room that is not linked: the prompt is then exactly as before.

const A = require('./aliases.cjs');
const Sim = require('./simulator.cjs');

/** The most relation lines one batch prompt carries. */
const RELATION_LINES_MAX = 20;

const RELATION_RULE = `## 설정집 관계 (세계관 설정집에서 받음)
[설정집 관계]에 적힌 두 사람은 이야기 처음부터 서로 아는 사이야(「(과거)」는 지금은 아니어도 전에 그랬던 사이).
- 서로 아는 사이인지는 이 목록을 따라. 둘이 처음 만나는 장면처럼 적지 마.
- 무엇을 아는지(비밀, 사건, 약속)는 지금처럼 대화에서만 정리해. 이 목록은 그 사람이 무엇을 안다는 근거가 아니야.`;

/**
 * The name a World Archive person goes by in the memory: one of the batch's people whose name is one of the forms
 * (World Archive's other names count: its 「개러스 어쿼하트」 is the memory's 「가레스 어콰트」 through "Gareth
 * Urquhart"), else the person the room's name table knows by any of the forms, else World Archive's own name.
 * Returns { name, forms } — forms: every way they are written, the memory's too.
 */
function memoryName(forms, people) {
  const given = (forms || []).map((n) => String(n || '').trim()).filter(Boolean);
  const all = [...new Set(given.flatMap((n) => [n, ...A.formsOf(n)]))];
  if (!all.length) return null;
  const keys = new Set(all.flatMap((n) => [Sim.squash(n), Sim.squash(A.canonical(n))]));
  const known = (people || []).find((p) => [p, ...A.formsOf(p)].some((n) => keys.has(Sim.squash(n)) || keys.has(Sim.squash(A.canonical(n)))));
  const canon = known ? A.canonical(known) : all.map((n) => A.canonOf(n)).find(Boolean);
  const name = canon || given[0];
  return { name, forms: [...new Set([...all, ...(canon ? A.formsOf(canon) : [])])], known: Boolean(known) };
}

/** The memory's name for a person of the relation when they are in this batch (one of its people, or written in its text); null otherwise. */
function inBatch(forms, text, people) {
  const m = memoryName(forms, people);
  if (!m) return null;
  return m.known || m.forms.some((n) => Sim.nameInText(n, text)) ? m.name : null;
}

/**
 * The [설정집 관계] lines of a batch: pairs whose two people are both in the batch, each once, at most
 * RELATION_LINES_MAX. "- 에드워드 베인 — 캐서린 베인: 가족(부부)", "- 이리나 — 줄리언 에이버리: 적대 · (과거) 연인".
 */
function relationLines(relations, slice, people = []) {
  const text = (slice || []).map((m) => Sim.squash(m.content || (m.sentences || []).join(' '))).join('\n');
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(relations) ? relations : []) {
    if (out.length >= RELATION_LINES_MAX) break;
    const a = inBatch([String(r?.fromName || '').trim(), ...(r?.fromAliases || [])], text, people);
    const b = inBatch([String(r?.toName || '').trim(), ...(r?.toAliases || [])], text, people);
    if (!a || !b || A.canonical(a) === A.canonical(b)) continue;
    const key = [A.canonical(a), A.canonical(b)].sort().join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    const now = ['가족', '친구', '연인', '스승·제자', '적대'].includes(r.type) ? `${r.type}${r.note && !/과거에는/.test(r.note) ? `(${String(r.note).slice(0, 30)})` : ''}` : '';
    const past = (r.previous || []).map((t) => `(과거) ${t}`);
    const kinds = [now, ...past].filter(Boolean).join(' · ');
    if (kinds) out.push(`- ${a} — ${b}: ${kinds}`);
  }
  return out;
}

/** World Archive's people with a 종 (species) — the beings that are not people. canonical name → species. */
function speciesMap(entities) {
  const out = new Map();
  for (const e of Array.isArray(entities) ? entities : []) {
    const sp = String(e?.fields?.species || '').trim();
    if (e?.type !== 'person' || !sp) continue;
    for (const n of [e.name, ...(e.aliases || [])]) if (typeof n === 'string' && n.trim()) out.set(A.canonical(n), sp);
  }
  return out;
}

/** World Archive's name pairs in the glossary's shape ({ from: romanized, to: Korean }), after the glossary's own. */
function namePairs(glossary, names) {
  const have = new Set((glossary || []).map((p) => String(p?.from || '').toLowerCase()));
  const extra = (Array.isArray(names) ? names : [])
    .filter((n) => n?.original && n?.translation && !have.has(String(n.original).toLowerCase()))
    .map((n) => ({ from: String(n.original), to: String(n.translation), world: true }));
  return [...(glossary || []), ...extra];
}

module.exports = { RELATION_LINES_MAX, RELATION_RULE, relationLines, speciesMap, namePairs, inBatch, memoryName };
