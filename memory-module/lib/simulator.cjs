'use strict';
// 세계 시뮬레이터 모드 (방마다 켬, 기본은 캐릭터 RP = 지금 그대로).
// The bot card is the story's narrator, not a person: it is never a speaker of a line, never in the cast, never gets a
// notebook. The people of the story are the NPCs it voices (and the user's character, as in character mode). They join
// the room's cast when a scene names them; with World Archive (세계관 설정집) linked to the room, its people are known
// from the start (read only — contract v1: the memory module does not send suggest).
// Nothing here runs in character mode: every caller checks store.mode === 'simulator' first.

const L = require('./ledger.cjs');

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
    const keys = [name, ...(aliases?.[name] || [])].map(squash).filter((k) => k.length >= 2);
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
 * New people a scene reply names, admitted to the room's cast: a name of their own (not a description), written in
 * the batch's text, not the narrator, not the user's character, not someone the cast already has. Returns the names
 * added (store.cast is changed in place).
 */
function admitPeople(store, scenes, slice) {
  const narrators = store.narrators || [];
  const personas = [...(store.personas || []), ...L.personaNames(slice || [])];
  const text = batchText(slice);
  const cast = (store.cast = Array.isArray(store.cast) ? store.cast : []);
  const added = [];
  for (const item of Array.isArray(scenes) ? scenes : []) {
    const named = [
      ...namesIn(item?.present),
      ...(Array.isArray(item?.events) ? item.events.flatMap((e) => namesIn(e?.with)) : []),
      ...(Array.isArray(item?.recollections) ? item.recollections.flatMap((r) => namesIn(r?.who)) : []),
    ];
    for (const name of named) {
      if (cast.length >= ROOM_CAST_MAX) return added;
      const key = squash(name);
      if (key.length < 2 || isDescribedName(name) || !text.includes(key)) continue;
      if (L.matchName(name, narrators) || L.matchName(name, personas) || L.matchName(name, cast)) continue;
      cast.push(name);
      added.push(name);
    }
  }
  return added;
}

/** The [내레이터] line at the head of a batch prompt. */
function narratorLine(narrators) {
  const list = (narrators || []).filter(Boolean);
  return list.length ? `[내레이터] ${list.join(', ')} (인물이 아님)` : '';
}

module.exports = { MODES, BATCH_CAST_MAX, ROOM_CAST_MAX, NARRATOR_PROMPT, mode, isDescribedName, batchCast, admitPeople, narratorLine, squash };
