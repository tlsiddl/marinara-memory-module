'use strict';
// 인물의 수첩 (notebook): what each character would keep in mind, written in that character's own Korean voice — small
// things learned about others (a taste, a habit, a line that stayed) and their own heart (a resolve, something that
// nags). One file per room, <chat>.notebook.json, that holds only what the user changed; the notes themselves come
// from the scenes (the scene call writes them in the same call while the feature is on), like the other optional
// records. A switch in 설정 → 추가 기능 (off by default).
//
//   scene.charNotes  [{ who, kind: 'about' | 'heart', about?, text, evidence: [{ number, sentence }] }]
//   file             { version: 1, edits: { id: text }, stars: [id], hidden: [id], updatedAt }
//
// The user's own character never gets a notebook (the module does not write the user's inner life). The notes are
// always Korean, whatever language the memory is written in: the voice comes from the character's Korean lines — a
// Korean line, the Korean in brackets after a foreign line, or the Korean translation the translation extension saved.

const crypto = require('node:crypto');
const A = require('./aliases.cjs');

const NOTEBOOK_VERSION = 1;
const KINDS = ['about', 'heart'];
const KIND_LABEL = { about: '알게 된 것', heart: '속마음' };
const TEXT_MAX = 160;
const PER_PERSON_SCENE = 2;
const PER_SCENE = 6;
const PER_PERSON_KEPT = 30;
const INJECT_PER_PERSON = 3;
const INJECT_CHARS = 420;
const VOICE_PER_PERSON = 3;
const VOICE_LINE_MAX = 80;

const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const clip = (s, n) => {
  const t = tidy(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const hangul = (s) => (String(s || '').match(/[가-힣]/g) || []).length;
const letters = (s) => (String(s || '').match(/[A-Za-z가-힣㐀-䶿一-鿿]/g) || []).length;
const isKorean = (s) => letters(s) > 0 && hangul(s) / letters(s) >= 0.5;

const emptyNotebook = () => ({ version: NOTEBOOK_VERSION, edits: {}, stars: [], hidden: [], notes: [], updatedAt: null });
const isNotebook = (v) => !!v && typeof v === 'object' && v.version === NOTEBOOK_VERSION;

/* ---------- the scene call ---------- */

const PROMPT = `인물의 수첩 (이 방에서 켠 기능):
각 장면 객체에 "notebook"도 적어. 이 장면에 있던 인물(사용자 캐릭터는 빼고)이 나중에도 마음에 담아 둘 만한 것을, 그 인물이 자기 수첩에 적듯 한두 문장으로 써. 인물마다 0~2개. 대부분의 장면은 0~1개이고, 없으면 [].
- kind "about": 다른 사람에 대해 알게 된 작은 것. 취향, 버릇, 인상 깊었던 말, 몸의 특징, 약한 곳. about에 그 사람 이름.
- kind "heart": 그 인물의 속마음. 다짐, 마음에 걸리는 것, 품은 의문, 바라는 것. about은 null.
- 그 인물이 그 자리에서 직접 보고 듣고 겪은 것만 적어. 없었던 자리의 일, 모르는 일은 적지 마.
- 사실이나 약속을 그대로 옮기지 말고, 그 인물이 그걸 어떻게 받아들였는지를 적어.
- 말투: 그 인물의 한국어 대사 말투 그대로, 1인칭이나 혼잣말로 써. 아래 [말투 참고]가 있으면 그 말투를 따라. 대사가 "원어" (한국어)처럼 병기돼 있으면 괄호 안 한국어 말투를 따라.
- 수첩은 기록 언어 설정과 상관없이 늘 한국어로 써.
- who: 그 인물 이름(등장인물 목록의 표기), evidence: 그렇게 판단한 문장 번호(예: ["23.4"]). 번호가 없으면 적지 마.
형식: "notebook":[{"who":"인물","kind":"about","about":"대상 인물","text":"수첩에 적을 한두 문장","evidence":["23.4"]}]`;

/**
 * Lines that show how each character talks in Korean, for the scene call: from the newest messages back, a line under
 * the character's name tag ("이름 | …" or <speaker="이름">). The Korean is the line itself when it is Korean, the
 * Korean in brackets after a foreign line, or — when the line is foreign only — the same character's line in the
 * Korean translation the translation extension saved with the message (\`m.tr\`). At most VOICE_PER_PERSON per person.
 */
function voiceSamples(messages, cast, { personas = [], max = VOICE_PER_PERSON } = {}) {
  const people = (cast || []).filter((n) => n && !personas.includes(n));
  if (!people.length) return {};
  const owner = (label) => {
    const raw = tidy(label);
    const canon = A.canonOf(raw);
    if (canon && people.includes(canon)) return canon;
    return people.find((p) => p === raw || p.split(' ')[0] === raw) || null;
  };
  const koreanOf = (rest) => {
    const brackets = [...rest.matchAll(/\(([^()]*[가-힣][^()]*)\)/g)].map((m) => m[1]);
    if (brackets.length) return brackets.at(-1);
    const quote = rest.match(/["“]([^"”]+)["”]/);
    if (quote && isKorean(quote[1])) return quote[1];
    return null;
  };
  const linesOf = (text) => {
    const out = [];
    for (const raw of String(text || '').split('\n')) {
      const line = raw.replace(/<\/?speaker[^>]*>/g, (tag) => (tag.startsWith('</') ? '' : ` ${tag} `)).trim();
      const tagged = line.match(/<speaker="([^"]+)">/);
      const labelled = line.replace(/<speaker="[^"]*">/g, '').trim().match(/^([^|"“\n]{1,40}?)\s*\|\s*(.+)$/);
      if (!tagged && !labelled) continue;
      const who = owner(tagged?.[1] || labelled?.[1] || '');
      const rest = labelled ? labelled[2] : line.replace(/<speaker="[^"]*">/g, '');
      // Every name-tagged line is kept (who is null for someone not in the cast) so the translation lines up by place.
      out.push({ who, rest });
    }
    return out;
  };
  const koreanLine = (rest) => koreanOf(rest) || (isKorean(rest) ? rest.replace(/^\s*["“]|["”]\s*$/g, '') : null);
  const found = new Map(people.map((p) => [p, []]));
  for (const m of [...(messages || [])].reverse()) {
    if (m.role === 'user') continue;
    const own = linesOf(m.content);
    const translated = m.tr ? linesOf(m.tr) : [];
    own.forEach((l, i) => {
      const list = l.who && found.get(l.who);
      if (!list || list.length >= max) return;
      // The line's own Korean first; else its line in the saved translation: the one at the same place when the
      // translation has as many name-tagged lines (its labels may be written in Korean), else the same speaker's.
      let ko = koreanOf(l.rest);
      if (!ko && translated.length) {
        if (translated.length === own.length) ko = koreanLine(translated[i].rest);
        else {
          const same = translated.filter((t) => t.who === l.who);
          const k = own.filter((x, j) => x.who === l.who && j < i).length;
          ko = same[k] ? koreanLine(same[k].rest) : null;
        }
      }
      ko = ko && clip(ko, VOICE_LINE_MAX);
      if (ko && isKorean(ko) && !list.includes(ko)) list.push(ko);
    });
    if ([...found.values()].every((l) => l.length >= max)) break;
  }
  return Object.fromEntries([...found].filter(([, l]) => l.length).map(([p, l]) => [p, l.reverse()]));
}

/** The [말투 참고] block for the scene call; empty when there is nothing to show. */
function voiceBlock(samples) {
  const rows = Object.entries(samples || {}).map(([who, lines]) => `- ${who}: ${lines.map((l) => `"${l}"`).join(' / ')}`);
  return rows.length ? `[말투 참고] 각 인물의 한국어 대사(최근):\n${rows.join('\n')}` : '';
}

/**
 * One note from the model, cleaned, or null: a character of the story (never the user's own), Korean text, a known
 * kind, and the person it is about (for "about") from the story's people.
 */
function cleanNote(raw, { cast = [], personas = [], person = (n) => tidy(n) } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const who = person(tidy(raw.who));
  if (!who || personas.includes(who) || (cast.length && !cast.includes(who))) return null;
  const text = clip(raw.text, TEXT_MAX);
  if (!text || !isKorean(text)) return null;
  const kind = KINDS.includes(raw.kind) ? raw.kind : 'heart';
  const about = kind === 'about' ? person(tidy(raw.about)) || null : null;
  if (about === who) return { who, kind: 'heart', text };
  return { who, kind, ...(about ? { about } : {}), text };
}

/* ---------- the notebook ---------- */

const idOf = (sceneId, who, text) => `nb_${crypto.createHash('sha1').update(`${sceneId}|${who}|${tidy(text)}`).digest('hex').slice(0, 10)}`;

/** Character pairs of a note, for telling the same thought written twice from a new one. */
function pairs(text) {
  const flat = String(text || '').replace(/[\s.,!?·()'"“”‘’…~]/g, '');
  const out = new Set();
  for (let i = 0; i < flat.length - 1; i++) out.add(flat.slice(i, i + 2));
  return out;
}
const alike = (a, b) => {
  const x = pairs(a), y = pairs(b);
  if (!x.size || !y.size) return 0;
  let n = 0;
  for (const g of x) if (y.has(g)) n++;
  return n / Math.min(x.size, y.size);
};
const SAME_NOTE = 0.6;

/**
 * The notes as they stand: every scene's notes in story order, the same thought written again replacing the older one,
 * the user's edits, stars and deletions applied, at most PER_PERSON_KEPT per person (starred ones always stay).
 */
function fold(store, previous) {
  const old = isNotebook(previous) ? previous : emptyNotebook();
  const hidden = new Set(old.hidden || []);
  const stars = new Set(old.stars || []);
  const edits = old.edits || {};
  const notes = [];
  for (const scene of store?.scenes || []) {
    for (const n of Array.isArray(scene.charNotes) ? scene.charNotes : []) {
      if (!n?.who || !n.text) continue;
      const id = idOf(scene.id, n.who, n.text);
      if (hidden.has(id)) {
        // A deleted note takes the older wording of the same thought with it (it had replaced that one).
        const older = notes.findIndex((x) => x.who === n.who && x.kind === n.kind && !x.star && alike(x.text, n.text) >= SAME_NOTE);
        if (older >= 0) notes.splice(older, 1);
        continue;
      }
      const number = (n.evidence || []).map((e) => e?.number).filter(Number.isFinite)[0] ?? scene.end ?? null;
      const note = { id, who: n.who, kind: n.kind, ...(n.about ? { about: n.about } : {}), text: edits[id] ?? n.text, ...(edits[id] != null ? { edited: true } : {}), ...(stars.has(id) ? { star: true } : {}), sceneId: scene.id, number };
      const same = notes.findIndex((x) => x.who === n.who && x.kind === n.kind && !x.star && alike(x.text, note.text) >= SAME_NOTE);
      if (same >= 0) notes.splice(same, 1);
      notes.push(note);
    }
  }
  const kept = [];
  const byPerson = new Map();
  for (const n of notes) byPerson.set(n.who, [...(byPerson.get(n.who) || []), n]);
  for (const list of byPerson.values()) {
    const starred = list.filter((n) => n.star);
    const rest = list.filter((n) => !n.star).slice(-Math.max(0, PER_PERSON_KEPT - starred.length));
    kept.push(...list.filter((n) => starred.includes(n) || rest.includes(n)));
  }
  return { ...old, version: NOTEBOOK_VERSION, edits: { ...edits }, stars: [...stars], hidden: [...hidden], notes: kept };
}

const need = (cond, message) => { if (!cond) throw Error(message); };
const findNote = (file, id) => {
  const n = (file.notes || []).find((x) => x.id === id);
  need(n, '해당 메모를 찾지 못했습니다.');
  return n;
};
/** The user's own wording for a note (it stays when the scenes are read again). Empty text puts the original back. */
function editNote(file, id, text, now = new Date().toISOString()) {
  findNote(file, id);
  const next = structuredClone(file);
  const t = clip(text, TEXT_MAX);
  if (t) next.edits[id] = t; else delete next.edits[id];
  next.updatedAt = now;
  return next;
}
/** ★: always kept, and always goes into the memory while the person is in the scene. */
function starNote(file, id, on, now = new Date().toISOString()) {
  findNote(file, id);
  const next = structuredClone(file);
  next.stars = on ? [...new Set([...(next.stars || []), id])] : (next.stars || []).filter((x) => x !== id);
  next.updatedAt = now;
  return next;
}
/** A deleted note is not written back by the scenes. */
function deleteNote(file, id, now = new Date().toISOString()) {
  findNote(file, id);
  const next = structuredClone(file);
  next.hidden = [...new Set([...(next.hidden || []), id])];
  next.stars = (next.stars || []).filter((x) => x !== id);
  delete next.edits[id];
  next.updatedAt = now;
  return next;
}

/* ---------- uses ---------- */

/**
 * "[수첩] 이름: … / … · 이름: …" for the people in the scene now (never the user's own): their starred notes, then the
 * ones closest to what is being said now (character pairs shared with \`query\`), then the newest; INJECT_PER_PERSON
 * each, within \`max\` characters. Empty when nobody here has notes.
 */
function injectionBlock(file, present, { query = '', max = INJECT_CHARS } = {}) {
  if (!isNotebook(file) || !(file.notes || []).length) return '';
  const here = [];
  for (const n of present || []) {
    const c = A.canonical(n);
    if (c && !here.includes(c)) here.push(c);
  }
  const q = pairs(query);
  const near = (t) => { const p = pairs(t); let n = 0; for (const g of p) if (q.has(g)) n++; return p.size ? n / p.size : 0; };
  const parts = [];
  for (const who of here) {
    const list = file.notes.filter((n) => A.canonical(n.who) === who);
    if (!list.length) continue;
    const order = list.map((n, i) => ({ n, i })).sort((a, b) => (b.n.star ? 1 : 0) - (a.n.star ? 1 : 0) || near(b.n.text) - near(a.n.text) || b.i - a.i).slice(0, INJECT_PER_PERSON).map((x) => x.n);
    parts.push({ who, texts: order.map((n) => n.text) });
  }
  if (!parts.length) return '';
  let line = '[수첩] (각 인물만 아는 속마음과 눈여겨본 것. 다른 인물은 모름. 자연스러울 때만 말과 행동에 묻어나게.)';
  for (const p of parts) {
    let piece = ` ${p.who}:`;
    let n = 0;
    for (const t of p.texts) {
      const add = `${n ? ' /' : ''} ${t}`;
      if (line.length + piece.length + add.length > max) break;
      piece += add;
      n++;
    }
    if (n && line.length + piece.length <= max) line += (line.endsWith(')') ? '' : ' ·') + piece;
  }
  return line.endsWith(')') ? '' : line;
}

/** The notes for the screen, grouped by person in story order. */
function view(file) {
  const out = {};
  for (const n of isNotebook(file) ? file.notes || [] : []) (out[n.who] ||= []).push({ ...n });
  return out;
}

module.exports = {
  NOTEBOOK_VERSION, KINDS, KIND_LABEL, TEXT_MAX, PER_PERSON_SCENE, PER_SCENE, PER_PERSON_KEPT, INJECT_CHARS, PROMPT,
  emptyNotebook, isNotebook, voiceSamples, voiceBlock, cleanNote, fold, editNote, starNote, deleteNote, injectionBlock, view, alike,
};
