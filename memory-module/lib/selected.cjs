'use strict';
// User-selected memories are separate from scene coverage and survive normal rebuilds.
const L = require('./ledger.cjs');
function validateParts(parts, messages) {
  if (!Array.isArray(parts) || !parts.length || parts.length > 30) throw Error('선택한 메시지 범위를 확인해 주세요.');
  const byId = new Map(messages.map(m => [m.id, m])); let size = 0;
  return parts.map(part => {
    const m = byId.get(part?.sourceId), text = typeof part?.text === 'string' ? part.text.trim() : '';
    size += text.length;
    if (!m || !text || size > 50000) throw Error('선택한 메시지를 확인하지 못했습니다.');
    const normal = s => String(s || '').replace(/\s+/g, ' ').trim();
    if (!normal(m.content).includes(normal(text))) throw Error('선택한 글이 현재 원문과 일치하지 않습니다. 다시 선택해 주세요.');
    return { sourceId: m.id, number: m.number, hash: m.h, text };
  });
}
function fingerprint(parts) { return L.hashText(JSON.stringify(parts.map(p => [p.sourceId, p.hash, p.text]))); }
function stale(entry, messages) { const byId = new Map(messages.map(m => [m.id, m.h])); return entry.parts.some(p => byId.get(p.sourceId) !== p.hash); }
function make(parts, result) {
  const title = typeof result?.title === 'string' ? result.title.trim().slice(0, 100) : '';
  const summary = typeof result?.summary === 'string' ? result.summary.trim().slice(0, 4000) : '';
  if (!title || !summary) throw Error('선택한 글의 정리 결과가 비어 있습니다.');
  return { id: fingerprint(parts), title, summary, parts, createdAt: new Date().toISOString() };
}
function render(entries, query, maxChars = 2500) {
  const words = s => new Set((String(s || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []).flatMap(w => [w, ...Array.from({length: Math.max(0, w.length - 1)}, (_, i) => w.slice(i, i + 2))]));
  const q = words(query); if (!q.size) return '';
  const ranked = entries.filter(e => !e.stale).map(e => { const w = words([e.title, e.summary, ...e.parts.map(p => p.text)].join(' ')); let score = 0; for (const t of q) if (w.has(t)) score++; return {e,score}; }).filter(x => x.score >= 2).sort((a,b) => b.score-a.score).slice(0, 3);
  let out = ''; for (const {e} of ranked) { const line = `${e.title}: ${e.summary}\n원문: ${e.parts.map(p => p.text).join(' / ')}`; if (out.length + line.length > maxChars) continue; out += (out ? '\n\n' : '') + line; } return out;
}
module.exports = {validateParts, fingerprint, stale, make, render};
