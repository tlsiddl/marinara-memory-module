'use strict';
// 아는 사람·모르는 사람 (knowledge): who knows a fact. Part of the module (no switch).
//
// A fact of the story (store.facts) says who does not know it in `unaware` (that list is the fact's "unknownTo" and is
// kept as it always was, so the many places that already keep it right, like learning in a later scene, undoing a scene,
// hand edits and renames, go on working). This file adds the other half, `knownBy`: the people who saw it, heard it or
// were told. It is filled only where the story says so:
//   * the scene call lists `knownBy` for a fact that is a secret or private (no extra model call),
//   * a fact with people who do not know it takes the people of its scene who do (present, not in `unaware`/`guess`),
//   * a person who learns it later (setKnowing in scenes.cjs) is added to a list that already exists.
// An empty `knownBy` means "not specified" and changes nothing. Pure logic, no file of its own.

/** The most names a "(…는 모름)" marker spells out. */
const MARK_NAMES = 3;

const unique = (list) => [...new Set((Array.isArray(list) ? list : []).filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()))];

/** What a fact says about who knows it: `{ knownBy, unknownTo }`. unknownTo is the fact's `unaware` list. */
function knowledgeOf(fact) {
  return { knownBy: unique(fact?.knownBy), unknownTo: unique(fact?.unaware) };
}

/**
 * The people who know a new fact. `listed` is what the model wrote (already matched to the story's people); `present`
 * are the people of the scene. A guessed fact ("(추정)") is one anybody can see, so nothing is recorded. With no list
 * and nobody ignorant of it, nothing is recorded either: that is the common case of a plain fact.
 */
function deriveKnownBy({ listed = [], present = [], unaware = [], guess = [], guessed = false }) {
  if (guessed) return [];
  const out = unique(listed).filter((n) => !unaware.includes(n) && !guess.includes(n));
  if (out.length) return out;
  if (!unaware.length && !guess.length) return [];
  return unique(present).filter((n) => !unaware.includes(n) && !guess.includes(n));
}

/**
 * Keep `knownBy` and the ignorance lists from contradicting each other after `who` changed. `learned` says that a person
 * who is no longer ignorant now knows (only added to a list that exists). A list the user set by hand is left alone.
 */
function syncKnownBy(fact, who, learned) {
  if (fact.knownLock || !fact.knownBy?.length) return;
  const ignorant = fact.unaware?.includes(who) || fact.guess?.includes(who);
  if (ignorant) fact.knownBy = fact.knownBy.filter((n) => n !== who);
  else if (learned && !fact.knownBy.includes(who)) fact.knownBy = [...fact.knownBy, who];
  if (!fact.knownBy.length) { delete fact.knownBy; delete fact.knownLock; }
}

/** After a hand edit: nobody is listed as knowing what they are listed as not knowing. */
function reconcile(fact) {
  if (!fact.knownBy) return;
  fact.knownBy = unique(fact.knownBy).filter((n) => !fact.unaware?.includes(n) && !fact.guess?.includes(n));
  if (!fact.knownBy.length) { delete fact.knownBy; delete fact.knownLock; }
}

/** A merged fact is known by those who know all its parts; unspecified when any part does not say. */
function mergeKnownBy(sources) {
  if (!sources.length || !sources.every((f) => f.knownBy?.length)) return [];
  const first = sources[0].knownBy;
  return unique(first).filter((n) => sources.every((f) => f.knownBy.includes(n)));
}

/**
 * " (B·C는 모름)" for the people in `present` who do not know the fact: named in its unaware list, or (when the fact
 * has a list of who knows it) not in it. The people the fact is about, people who only suspect it and the user's own
 * characters are never marked. `covered` are names a mark of the memory text already spells out.
 */
function unknownMarker(fact, present, { personas = [], covered = [], max = MARK_NAMES } = {}) {
  if (!fact || !Array.isArray(present) || !present.length) return '';
  const about = String(fact.about || '');
  const known = unique(fact.knownBy);
  const names = [];
  for (const n of unique(present)) {
    if (personas.includes(n) || (about && about.includes(n)) || fact.guess?.includes(n) || covered.includes(n) || names.includes(n)) continue;
    if (fact.unaware?.includes(n) || (known.length && !known.includes(n))) names.push(n);
  }
  if (!names.length) return '';
  const shown = names.slice(0, max).join('·');
  return names.length > max ? ` (${shown} 외 ${names.length - max}명은 모름)` : ` (${shown}는 모름)`;
}

module.exports = { MARK_NAMES, knowledgeOf, deriveKnownBy, syncKnownBy, reconcile, mergeKnownBy, unknownMarker };
