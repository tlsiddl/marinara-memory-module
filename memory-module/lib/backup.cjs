'use strict';
// Local backup of one room's memory: one JSON document with every per-room file, a header and the room's settings
// entry. This file only builds and checks the document; reading and writing the room's files is done by the service.
const crypto = require('node:crypto');
const L = require('./ledger.cjs');
const S = require('./scenes.cjs');
const A = require('./aliases.cjs');
const V = require('./vectors.cjs');

const FORMAT = 'marinara-memory-backup';
const VERSION = 1;
/** The most a backup may weigh, as JSON text. The same limit applies to what the server accepts. */
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_NODES = 5_000_000;

/** Backup key -> file name suffix after "<chatId>" (the ledger has none). Nothing else is ever read or written. */
const FILES = {
  ledger: '.json',
  scenes: '.scenes.json',
  names: '.names.json',
  selected: '.selected.json',
  translations: '.translations.json',
  'attribution-log': '.attribution-log.json',
  vectors: '.vectors.json',
  address: '.address.json',
  state: '.state.json',
  places: '.places.json',
  conflicts: '.conflicts.json',
  keepsakes: '.keepsakes.json',
  'recall-prefs': '.recall-prefs.json',
  trackers: '.trackers.json',
  lang: '.lang.json',
};
const KEYS = Object.keys(FILES);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hashOf = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const CHECKS = {
  ledger: (v) => v.version === L.LEDGER_VERSION && Array.isArray(v.threads),
  scenes: (v) => v.version === S.SCENES_VERSION && Array.isArray(v.scenes) && Array.isArray(v.facts),
  names: (v) => v.version === A.NAMES_VERSION && isObject(v.people),
  selected: (v) => v.version === 1 && Array.isArray(v.items),
  translations: (v) => v.v === 1 && isObject(v.items),
  'attribution-log': (v) => v.version === 1 && Array.isArray(v.runs),
  vectors: (v) => v.v === V.INDEX_VERSION && isObject(v.items),
  address: (v) => v.version === 1 && Array.isArray(v.entries),
  state: (v) => v.version === 1 && Array.isArray(v.cards),
  places: (v) => v.version === 1 && Array.isArray(v.places),
  conflicts: (v) => v.version === 1 && Array.isArray(v.conflicts),
  keepsakes: (v) => v.version === 1 && Array.isArray(v.items),
  'recall-prefs': (v) => v.version === 1 && Array.isArray(v.pinned) && Array.isArray(v.excluded),
  trackers: (v) => v.version === 1 && Array.isArray(v.items),
  lang: (v) => v.version === 1 && ['ko', 'en', 'zh'].includes(v.lang),
};

/** Walks a parsed value once: bounded size, no prototype tricks. */
function scan(value) {
  let nodes = 0;
  const stack = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v === null || typeof v !== 'object') continue;
    if (++nodes > MAX_NODES) throw Error('백업 파일이 너무 복잡합니다.');
    if (Array.isArray(v)) { for (const x of v) stack.push(x); continue; }
    for (const k of Object.keys(v)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') throw Error(`백업 파일에 허용되지 않는 항목(${k})이 있습니다.`);
      stack.push(v[k]);
    }
  }
}

function pad(n) { return String(n).padStart(2, '0'); }

/** 기억백업-<방이름>-<YYYYMMDD-HHmm>.json, safe on every file system. */
function fileName(chatName, date = new Date()) {
  const name = String(chatName || '').normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').replace(/^[ .]+|[ .]+$/g, '').slice(0, 40).trim() || '이름없음';
  const d = date;
  return `기억백업-${name}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/** files: { key: parsed value }; settingsEntry: the room's settings.chats entry or null. */
function build({ chatId, chatName, moduleVersion, files, settingsEntry, jobRunning = false, now = new Date() }) {
  const out = {};
  const fileHashes = {};
  for (const key of KEYS) {
    if (files[key] === undefined) continue;
    out[key] = files[key];
    fileHashes[key] = hashOf(files[key]);
  }
  return {
    header: { format: FORMAT, version: VERSION, moduleVersion: moduleVersion || null, chatId, chatName: chatName || '', createdAt: now.toISOString(), fileHashes, jobRunning: !!jobRunning },
    files: out,
    settings: settingsEntry ?? null,
  };
}

/** Throws a Korean message for anything that is not a well-formed backup; returns the document when it is. */
function validate(doc) {
  if (!isObject(doc)) throw Error('백업 파일이 아닙니다.');
  const top = Object.keys(doc);
  for (const k of top) if (!['header', 'files', 'settings'].includes(k)) throw Error(`알 수 없는 항목(${k})이 있어 불러오지 않습니다.`);
  const h = doc.header;
  if (!isObject(h) || h.format !== FORMAT) throw Error('기억 서재 백업 파일이 아닙니다.');
  if (!Number.isInteger(h.version) || h.version < 1) throw Error('백업 파일의 버전을 확인할 수 없습니다.');
  if (h.version > VERSION) throw Error(`이 모듈보다 새 형식(버전 ${h.version})의 백업입니다. 모듈을 업데이트한 뒤 다시 시도해 주세요.`);
  if (typeof h.chatId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(h.chatId)) throw Error('백업 파일의 방 ID가 올바르지 않습니다.');
  if (typeof h.createdAt !== 'string' || Number.isNaN(Date.parse(h.createdAt))) throw Error('백업 파일의 만든 날짜가 올바르지 않습니다.');
  if (!isObject(h.fileHashes)) throw Error('백업 파일의 파일 검증값이 없습니다.');
  if (!isObject(doc.files)) throw Error('백업 파일에 기억 파일이 없습니다.');
  if (doc.settings !== null && doc.settings !== undefined && !isObject(doc.settings)) throw Error('백업 파일의 방 설정 형식이 올바르지 않습니다.');
  const keys = Object.keys(doc.files);
  for (const k of keys) if (!KEYS.includes(k)) throw Error(`알 수 없는 파일 항목(${k})이 있어 불러오지 않습니다.`);
  if (!keys.length) throw Error('백업 파일에 불러올 기억이 없습니다.');
  for (const k of Object.keys(h.fileHashes)) if (!KEYS.includes(k) || !(k in doc.files)) throw Error(`파일 검증값(${k})이 맞는 파일 없이 있습니다.`);
  scan(doc);
  for (const k of keys) {
    const v = doc.files[k];
    if (!isObject(v) || !CHECKS[k](v)) throw Error(`백업 안의 ${k} 파일 형식이 올바르지 않거나 이 모듈이 모르는 버전입니다.`);
    if (h.fileHashes[k] !== hashOf(v)) throw Error(`백업 안의 ${k} 파일이 손상되었거나 수정되었습니다(검증값 불일치).`);
  }
  return doc;
}

/** Numbers shown side by side in the restore preview. Tolerates missing files. */
function counts(files) {
  const f = files || {};
  const len = (v) => (Array.isArray(v) ? v.length : 0);
  const keys = (v) => (isObject(v) ? Object.keys(v).length : 0);
  let facts = 0;
  try { facts = f.scenes ? S.liveFacts(f.scenes).length : 0; } catch { facts = len(f.scenes?.facts); }
  return {
    scenes: len(f.scenes?.scenes),
    chapters: len(f.scenes?.chapters),
    facts,
    threads: len(f.ledger?.threads),
    routine: len(f.ledger?.routine),
    people: keys(f.names?.people),
    selected: len(f.selected?.items),
    translations: keys(f.translations?.items),
    attributionRuns: len(f['attribution-log']?.runs),
    vectors: keys(f.vectors?.items),
    addressEntries: len(f.address?.entries),
    stateCards: len(f.state?.cards),
    places: len(f.places?.places),
    conflicts: len(f.conflicts?.conflicts),
    keepsakes: len(f.keepsakes?.items),
    trackers: len(f.trackers?.items),
    recallMarks: len(f['recall-prefs']?.pinned) + len(f['recall-prefs']?.excluded),
  };
}

module.exports = { FORMAT, VERSION, MAX_BYTES, FILES, KEYS, hashOf, fileName, build, validate, counts };
