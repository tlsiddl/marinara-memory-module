'use strict';
// Speaker tags: in a merged group chat with speaker colors on, each character's line is wrapped in
// <speaker="Name">…</speaker> so the app can color it. Models sometimes drop the tags, and because Marinara
// keeps the tags only on the newest reply as the example, one miss repeats from then on. This puts them back
// on lines that clearly belong to a character ("하준 | …"), together with a translation line right after.
// Pure logic only.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is this line a translation that belongs to the line above, like "(사랑해, 서아야.)"? */
function isTranslationLine(line) {
  return /^\s*\(.*[가-힣].*\)\s*$/.test(line);
}

/**
 * Wrap untagged character lines. `names` are the chat's characters; only a line starting with one of them
 * followed by "|" or ":" is touched, so narration and other text stay as they are. Returns the same string
 * when there was nothing to fix.
 */
function restoreSpeakerTags(text, names) {
  const list = [...new Set((names || []).map((n) => String(n || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!text || !list.length) return text;
  const start = new RegExp(`^(\\s*)(${list.map(escape).join('|')})\\s*[|:｜]\\s*\\S`);
  const lines = String(text).split('\n');
  const out = [];
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<speaker="[^"]*">/g) || []).length;
    const closes = (line.match(/<\/speaker>/g) || []).length;
    const m = depth === 0 && opens === 0 ? line.match(start) : null;
    if (!m) {
      depth = Math.max(0, depth + opens - closes);
      out.push(line);
      continue;
    }
    const block = [line.slice(m[1].length)];
    // The translation on the next line(s) goes inside the same tag.
    while (i + 1 < lines.length && isTranslationLine(lines[i + 1]) && !lines[i + 1].includes('<speaker')) block.push(lines[++i].trim());
    out.push(`${m[1]}<speaker="${m[2]}">${block.join('\n')}</speaker>`);
  }
  const result = out.join('\n');
  return result === text ? text : result;
}

/** Does a reply have character lines that lack tags? */
function needsSpeakerTags(text, names) {
  return restoreSpeakerTags(text, names) !== text;
}

/** Match Marinara's native hidden speaker-tag protocol at generation time. */
function speakerInstructions(names) {
  const list = [...new Set((names || []).filter((n) => typeof n === 'string').map((n) => n.trim()).filter((n) => n && !/[<>"\r\n]/.test(n)))];
  if (!list.length) return '';
  return [
    'Native Marinara speaker-tag format (metadata, not visible name labels):',
    `Canonical speaker names: ${JSON.stringify(list)}. Use the exact name, including spelling and case, inside each speaker tag; no aliases.`,
    'Write every character dialogue in <speaker="Exact Name">"Dialogue"</speaker>, including quote-only dialogue with no visible name prefix. Use lowercase speaker, a double-quoted name, and a matching </speaker>.',
    'The interface hides these tags and uses them for character dialogue colors. A request for dialogue in quotation marks without character-name labels still permits these hidden tags.',
    'Keep narration outside the tags. Do not nest tags or add story content to explain them. Keep any required original-language dialogue and its parenthetical translation together inside the same tag, preserving the requested bilingual format.',
    'Do not add visible Name: or Name | labels unless the requested dialogue style already uses them. Keep all existing valid speaker tags.',
    `Format example only: <speaker="${list[0]}">"…"</speaker>`,
  ].join('\n');
}

module.exports = { restoreSpeakerTags, needsSpeakerTags, isTranslationLine, speakerInstructions };
