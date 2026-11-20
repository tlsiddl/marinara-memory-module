'use strict';
// 세계 시뮬레이터 모드 (방마다 켬, 기본은 캐릭터 RP = 지금 그대로).
// The bot card is the story's narrator, not a person: it is never a speaker of a line, never in the cast, never gets a
// notebook. The people of the story are the NPCs it voices (and the user's character, as in character mode). They join
// the room's cast when a scene names them; with World Archive (세계관 설정집) linked to the room, its people are known
// from the start (read only — contract v1: the memory module does not send suggest).
// Nothing here runs in character mode: every caller checks store.mode === 'simulator' first.

const L = require('./ledger.cjs');
const A = require('./aliases.cjs');

const MODES = ['character', 'simulator'];
/** The most people one batch's prompt names (most recently mentioned first). */
const BATCH_CAST_MAX = 40;
/** The most people a room keeps in its cast (a long story with many walk-ons). */
const ROOM_CAST_MAX = 500;

const NARRATOR_PROMPT = `## 세계 시뮬레이터 방
[내레이터]로 적힌 이름은 이야기를 진행하는 내레이터(봇 카드)야. 인물이 아니야.
- 내레이터를 장면의 present, 사건의 with, 인용의 by·to, 사실의 about, 수첩의 who, 아는 사람·모르는 사람 어디에도 적지 마.
- 내레이터 이름으로 표시된 메시지 안의 따옴표 대사는 본문이 가리키는 인물의 말이야. 누가 말했는지 본문에서 찾을 수 없으면 by는 null로 둬.
- 내레이터의 서술(장면 묘사, 다른 곳에서 일어난 일)은 누구의 말이나 생각도 아니야. 내레이터가 알려 준 것을 인물이 안다고 적지 마. 그 자리에 있었거나 전해 들은 인물만 알아.
- 새 인물은 본문에 이름이 나오는 사람만 적어. 「○○의 누나」처럼 설명으로만 불리는 사람은 이름으로 만들지 마(장면 present에는 본문의 호칭 그대로 둬도 돼).`;

const squash = (t) => String(t ?? '').toLowerCase().replace(/[\s"'“”‘’「」『』.,!?·~\-_()[\]]/g, '');

/**
 * A name made of a description ("이리나의 언니", "the girl's brother"), not a name of its own.
 * From World Archive (tlsiddl/marinara-world-archive c813aeb, world-archive/lib/store.cjs isDescriptiveName), plus the
 * English possessive.
 */
const isDescribedName = (n) => /의\s/.test(String(n || '')) || /['’]s\s/i.test(String(n || ''));

function mode(value) {
  return value === 'simulator' ? 'simulator' : 'character';
}

/** The text of a batch, squashed, for "is this name in it". */
function batchText(messages) {
  return (messages || []).map((m) => squash(m.content || (m.sentences || []).join(' '))).join('\n');
}

/**
 * The people a batch's prompt names: those whose name (or another name) appears in it, the most recently mentioned
 * first, at most BATCH_CAST_MAX. aliases: { name: [other names] }.
 */
function batchCast(cast, messages, aliases = {}, max = BATCH_CAST_MAX) {
  const texts = (messages || []).map((m) => squash(m.content || (m.sentences || []).join(' ')));
  const last = new Map();
  for (const name of cast || []) {
    const keys = [name, ...(aliases?.[name] || []), ...A.formsOf(name)].map(squash).filter((k) => k.length >= 2);
    for (let i = texts.length - 1; i >= 0; i--) {
      if (keys.some((k) => texts[i].includes(k))) {
        last.set(name, i);
        break;
      }
    }
  }
  return [...last.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([name]) => name);
}

const namesIn = (value) =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,·、/]|\s및\s|\s와\s|\s과\s/) : [])
    .map((n) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 40))
    .filter(Boolean);

/**
 * Is this name one of the people in the list? L.matchName also answers with the person the room's name table knows
 * the name for, whether or not that person is in the list; here only a person of the list counts.
 */
function inList(name, list) {
  const hit = L.matchName(name, list || []);
  return !!hit && (list || []).some((x) => (A.canonOf(x) || A.tidy(x)) === hit);
}

const whoOf = (v) => (v && typeof v === 'object' ? v.who : v);

/** Title words that are not a name of their own (from World Archive's NAME_FILLER, c813aeb). */
const NAME_FILLER = new Set(['the', 'and', 'of', 'for', 'with', 'from', 'into', 'house', 'school', 'family', 'lady', 'lord', 'miss', 'mister', 'mrs', 'mr', 'sir', 'madam', 'madame', 'professor', 'young', 'little', 'your', 'grace', 'head', '교수', '교수님', '선생', '선생님', '공작', '부인', '씨', '양', '군']);

/**
 * Is this name written in the text? The whole name, or one word of a spaced name that is a name of its own (2+ Hangul
 * syllables or 4+ Latin letters, not a title): the story calls 「에드워드 베인」 "베인 공작" more often than his full name.
 */
function nameInText(name, text) {
  if (text.includes(squash(name))) return true;
  const words = String(name).split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.some((w) => {
    const k = squash(w);
    if (NAME_FILLER.has(k)) return false;
    if (/^[가-힣]+$/.test(k)) return k.length >= 2 && text.includes(k);
    return /^[a-z]+$/.test(k) && k.length >= 4 && text.includes(k);
  });
}

/**
 * New people a scene reply names (store is not changed): someone who acts as a person in it — speaks a line or is
 * spoken to, keeps a notebook note, is what a fact is about, knows or does not know something, remembers the scene.
 * Being in a scene's present list alone is not enough (an owl, "the guard": they stay the scene's extras, as in
 * character mode). The name must be its own (not a description), written in the batch's text, and not the narrator,
 * the user's character or someone the cast already has.
 */
/** The names a scene reply uses as people (speaker, listener, notebook, fact, knowing, recollection), in order. */
function namedPeople(scenes) {
  return (Array.isArray(scenes) ? scenes : []).flatMap((item) => {
    const events = Array.isArray(item?.events) ? item.events : [];
    const facts = Array.isArray(item?.facts) ? item.facts : [];
    return [
      ...events.flatMap((e) => (Array.isArray(e?.quotes) ? e.quotes : []).flatMap((q) => [...namesIn(q?.by), ...namesIn(q?.to)])),
      ...(Array.isArray(item?.notebook) ? item.notebook : []).flatMap((n) => namesIn(n?.who)),
      ...facts.flatMap((f) => [...namesIn(f?.about), ...namesIn(f?.knownBy), ...(Array.isArray(f?.unaware) ? f.unaware : []).flatMap((u) => namesIn(whoOf(u)))]),
      ...(Array.isArray(item?.recollections) ? item.recollections : []).flatMap((r) => namesIn(r?.who)),
    ];
  });
}

function newPeople(store, scenes, slice) {
  const narrators = store.narrators || [];
  const personas = [...(store.personas || []), ...L.personaNames(slice || [])];
  const text = batchText(slice);
  const cast = Array.isArray(store.cast) ? store.cast : [];
  const added = [];
  {
    for (const name of namedPeople(scenes)) {
      if (cast.length + added.length >= ROOM_CAST_MAX) return added;
      const key = squash(name);
      if (key.length < 2 || isDescribedName(name) || !A.formsOf(name).concat(name).some((n) => nameInText(n, text))) continue;
      if (inList(name, narrators) || inList(name, personas) || inList(name, cast) || inList(name, added)) continue;
      added.push(name);
    }
  }
  return added;
}

const latinOnly = (s) => /[A-Za-z]/.test(s) && !/[가-힣]/.test(s);
const hangulOnly = (s) => /[가-힣]/.test(s) && !/[A-Za-z]/.test(s);
const fold = (s) => String(s ?? '').normalize('NFC').replace(/s+/g, ' ').trim().toLowerCase();

/**
 * Pairs that say two written forms are one person: the room's glossary (번역 프리셋·단어장, "Edward Vane = 에드워드 베인")
 * first, then World Archive's people (a name and another name of theirs in the other script). → [{ from: Latin, to: Korean }]
 */
function scriptPairs(glossary = [], waPeople = []) {
  const out = [];
  const seen = new Set();
  const push = (a, b) => {
    const from = latinOnly(a) ? a : latinOnly(b) ? b : null;
    const to = hangulOnly(a) ? a : hangulOnly(b) ? b : null;
    if (!from || !to || seen.has(fold(from)) || seen.has(fold(to))) return;
    seen.add(fold(from)).add(fold(to));
    out.push({ from: A.tidy(from), to: A.tidy(to) });
  };
  for (const p of Array.isArray(glossary) ? glossary : []) if (p?.from && p?.to) push(String(p.from), String(p.to));
  for (const person of Array.isArray(waPeople) ? waPeople : []) for (const other of person?.aliases || []) push(String(person.name || ''), String(other || ''));
  return out;
}

/**
 * The other names to register so one person is not two: for each name the room's people go by (or a reply just
 * brought in), the pair that writes it in the other script. Returns [{ source, target }]: source becomes another name
 * of target. The target is the form the memory is written in (the Korean one for a Korean memory), except that the
 * user's character keeps their own name. Left out: a pair whose forms are one person already, a pair the user said
 * are not the same (dismissed), and anything that names a narrator (the narrator is not a person).
 */
function nameLinks(names, pairs, table, { korean = true, narrators = [], personas = [] } = {}) {
  const links = [];
  const seen = new Set();
  const is = (n, list) => (list || []).some((x) => fold(x) === fold(n) || (A.canonOf(x, table) && A.canonOf(x, table) === A.canonOf(n, table)));
  for (const name of Array.isArray(names) ? names : []) {
    const key = fold(name);
    const pair = (pairs || []).find((p) => fold(p.from) === key || fold(p.to) === key);
    if (!pair || seen.has(fold(pair.from))) continue;
    seen.add(fold(pair.from));
    if (is(pair.from, narrators) || is(pair.to, narrators)) continue;
    let [source, target] = korean ? [pair.from, pair.to] : [pair.to, pair.from];
    if (is(source, personas) && !is(target, personas)) [source, target] = [target, source];
    const a = A.canonOf(source, table);
    const b = A.canonOf(target, table);
    if (a && b && a === b) continue;
    if (table && A.dismissed(table, source, target)) continue;
    links.push({ source, target });
  }
  return links;
}

/** The most glossary spellings one batch prompt carries. */
const SCRIPT_LINE_MAX = 30;
/**
 * The [이름 표기] line of a batch prompt: how the English names written in these messages are written in Korean, from
 * the room's glossary, so the model writes 「아더 펜들턴」 (the user's spelling), not a spelling of its own. '' when
 * none of them is in the batch.
 */
function scriptLine(pairs, slice) {
  const text = batchText(slice);
  const hits = (pairs || []).filter((p) => p?.from && p?.to && squash(p.from).length >= 2 && text.includes(squash(p.from))).slice(0, SCRIPT_LINE_MAX);
  return hits.length ? `[이름 표기] 본문의 영어 이름은 한국어로 이렇게 적어: ${hits.map((p) => `${p.from} = ${p.to}`).join(', ')}` : '';
}

/** The cast with each person once, under the name the room's name table keeps them by. */
function canonCast(cast) {
  const out = [];
  for (const n of Array.isArray(cast) ? cast : []) {
    const c = A.canonical(n);
    if (c && !out.some((x) => fold(x) === fold(c))) out.push(c);
  }
  return out;
}

/** The [내레이터] line at the head of a batch prompt. */
function narratorLine(narrators) {
  const list = (narrators || []).filter(Boolean);
  return list.length ? `[내레이터] ${list.join(', ')} (인물이 아님)` : '';
}

module.exports = { namedPeople, scriptPairs, nameLinks, canonCast, scriptLine, MODES, BATCH_CAST_MAX, ROOM_CAST_MAX, NARRATOR_PROMPT, mode, isDescribedName, nameInText, batchCast, newPeople, narratorLine, squash };
