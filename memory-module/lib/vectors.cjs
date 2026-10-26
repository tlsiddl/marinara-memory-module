'use strict';
// Meaning search: scenes are turned into vectors by an embedding model, so a question asked in other words
// ("그때 바다 갔던 거") still finds them. Each scene is split into small pieces — its overview and each event with
// its lines — so a side story inside a long scene is found on its own instead of being drowned by the rest.
// Pieces are made again only when their text changes. Pure logic only; the engine side lives in service.cjs.

const crypto = require('node:crypto');

const INDEX_VERSION = 2;
const DOC_MAX_CHARS = 900;
const QUERY_MAX_CHARS = 600;
const MAX_QUERIES = 5;

/** The translation carries the meaning for a Korean question; keep it over the English original. */
function lineText(q) {
  const t = String(q.text || '');
  const translation = t.match(/\(([^()]*[가-힣][^()]*)\)\s*$/);
  return translation ? translation[1] : t;
}

/** The pieces a scene is searched by: "S7" (what the scene is about) and "S7#0", "S7#1" … (each event). */
function sceneDocs(scene) {
  const head = [scene.time, scene.place, scene.title].filter(Boolean).join(' · ');
  const docs = [{ key: scene.id, text: [head, scene.summary, ...(scene.later || []).map((x) => x.what)].filter(Boolean).join(' ') }];
  (scene.events || []).forEach((e, i) => {
    docs.push({ key: `${scene.id}#${i}`, text: [scene.title, e.text, e.why, ...(e.quotes || []).map(lineText)].filter(Boolean).join(' ') });
  });
  for (const d of docs) d.text = d.text.replace(/\s+/g, ' ').trim().slice(0, DOC_MAX_CHARS);
  return docs;
}

/** Everything of a scene in one text (for display and older callers). */
function sceneDoc(scene) {
  return sceneDocs(scene).map((d) => d.text).join(' ');
}

const hash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);

/** Retrieval models that want an instruction on the question side (and some on the document side). */
function prefixes(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('qwen3-embedding')) return { query: 'Instruct: Given a line from a roleplay conversation, retrieve the past events the characters would recall\nQuery: ', doc: '' };
  if (/(^|[/_.-])e5([/_.-]|$)/.test(m) || m.includes('multilingual-e5')) return { query: 'query: ', doc: 'passage: ' };
  if (m.includes('nomic-embed')) return { query: 'search_query: ', doc: 'search_document: ' };
  return { query: '', doc: '' };
}

function pack(vector) {
  return Buffer.from(new Float32Array(vector).buffer).toString('base64');
}

function unpack(text) {
  const buf = Buffer.from(text, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function emptyIndex(model) {
  return { v: INDEX_VERSION, model, items: {} };
}

/** An index made by another model or an older layout starts over. */
function usable(index, model) {
  // Model names differ in case between providers' lists ("Qwen/…" vs "qwen/…"); the vectors are the same.
  return index && String(index.model).toLowerCase() === String(model).toLowerCase() && index.v === INDEX_VERSION;
}

/** Pieces whose vector is missing or stale (the text changed). */
function staleDocs(index, scenes) {
  return scenes.flatMap(sceneDocs).filter((d) => index.items[d.key]?.h !== hash(d.text));
}

function putVectors(index, docs, vectors) {
  docs.forEach((d, i) => {
    if (Array.isArray(vectors[i]) && vectors[i].length) index.items[d.key] = { h: hash(d.text), v: pack(vectors[i]) };
  });
}

/** Drop pieces of scenes (or events) that no longer exist. */
function prune(index, scenes) {
  const keys = new Set(scenes.flatMap(sceneDocs).map((d) => d.key));
  for (const key of Object.keys(index.items)) if (!keys.has(key)) delete index.items[key];
}

/** How many scenes have every piece indexed. */
function indexedScenes(index, scenes) {
  return scenes.filter((s) => sceneDocs(s).every((d) => index.items[d.key]?.h === hash(d.text))).length;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const clean = (t) => String(t || '').replace(/<\/?speaker[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * The question side: the newest user message alone (the long replies before it pull the search toward the
 * scene going on now). A very short message ("응", "그거?") borrows the end of the reply just before it.
 */
function queryText(recent, userMessage) {
  const latest = clean(userMessage || [...recent].reverse().find((m) => m.role === 'user')?.content || '');
  if (latest.length >= 15) return latest.slice(0, QUERY_MAX_CHARS * 2);
  const before = clean([...recent].reverse().find((m) => m.role !== 'user')?.content || '').slice(-400);
  return `${latest} ${before}`.trim();
}

/**
 * The message as a whole, plus its longer sentences one by one: one message often touches two things
 * (the roast beef now, and why he learned cold magic back then), and each should find its own memory.
 */
function queryTexts(recent, userMessage) {
  const whole = queryText(recent, userMessage);
  const sentences = whole
    .split(/(?<=[.?!。…"”])\s+|\n+/)
    .map((x) => x.replace(/^["“]|["”]$/g, '').trim())
    .filter((x) => x.length >= 12);
  const out = [whole.slice(0, QUERY_MAX_CHARS)];
  for (const x of sentences.sort((a, b) => b.length - a.length)) {
    if (out.length >= MAX_QUERIES) break;
    if (!out.includes(x) && x.length < whole.length) out.push(x.slice(0, QUERY_MAX_CHARS));
  }
  return out;
}

/**
 * The candidate scenes closest in meaning, best first. A scene scores by its best piece against any of the
 * questions; `piece` says which event matched. A hit counts as strong only when it stands well apart from the
 * rest (similarity scales differ by model, so the bar is relative to this question's own spread).
 */
function nearest(index, queries, list, k = 5) {
  const qs = Array.isArray(queries[0]) || queries[0] instanceof Float32Array ? queries : [queries];
  const ids = new Set(list.map((s) => s.id));
  const best = new Map();
  for (const [key, item] of Object.entries(index.items)) {
    const id = key.split('#')[0];
    if (!ids.has(id)) continue;
    const v = unpack(item.v);
    let score = -1;
    for (const q of qs) score = Math.max(score, cosine(q, v));
    const prev = best.get(id);
    if (!prev || score > prev.score) best.set(id, { id, score, piece: key.includes('#') ? Number(key.split('#')[1]) : null });
  }
  const scored = [...best.values()].sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const scores = scored.map((x) => x.score);
  const mean = scores.reduce((n, x) => n + x, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((n, x) => n + (x - mean) ** 2, 0) / scores.length) || 1e-6;
  return scored.slice(0, k).map((x) => ({ ...x, z: (x.score - mean) / sd, strong: scored.length >= 8 && (x.score - mean) / sd >= 2.5 }));
}

/** Words that point back at something said or done before. */
const POINTS_BACK = /(했듯|말했듯|얘기했듯|말했잖|얘기했잖|그랬잖|했잖아|했었|했던\s*거|그때|그 때|예전에|저번에|지난번|옛날에|기억나|기억 안 나|기억해\?|라고\s*했|다고\s*했)/;

module.exports = { POINTS_BACK, INDEX_VERSION, sceneDocs, sceneDoc, lineText, prefixes, pack, unpack, emptyIndex, usable, staleDocs, putVectors, prune, indexedScenes, cosine, queryText, queryTexts, nearest, hash };
