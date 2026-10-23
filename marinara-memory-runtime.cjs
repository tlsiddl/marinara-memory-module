'use strict';
// Marinara Memory Module — step 1: the {{기억}} / {{memory}} prompt macro.
// Patches packages/shared/dist/utils/macro-engine.js in memory only (no files are written).
// If the expected line is not found exactly once, it fails closed: Marinara runs unchanged.

const fs = require('node:fs');
const path = require('node:path');
const { registerHooks } = require('node:module');
const { fileURLToPath } = require('node:url');

const TAG = '[memory-module]';
const VERSION = '0.1.0';
const TARGET = /[\\/]packages[\\/]shared[\\/]dist[\\/]utils[\\/]macro-engine\.js$/;
const ANCHOR = '    result = result.replace(/\\{\\{chatId\\}\\}/gi, ctx.chatId ?? "");';
const INSERT =
  '\n    result = result.replace(/\\{\\{(?:기억|memory)\\}\\}/gi, () => { try { return globalThis.__marinaraMemory?.render?.(ctx) ?? ""; } catch { return ""; } });';
const NOTES_DIR = process.env.MEMORY_MODULE_NOTES_DIR || '/app/memory-module/notes';
const DEFAULT_NOTE = '_default.txt';
const MAX_NOTE_CHARS = 20000;

function log(message) {
  process.stderr.write(`${TAG} ${message}\n`);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/** Insert the macro right after the {{chatId}} line. Returns null when the source is not the expected one. */
function patchSource(source) {
  if (count(source, ANCHOR) !== 1) return null;
  if (source.includes('__marinaraMemory')) return source;
  return source.replace(ANCHOR, ANCHOR + INSERT);
}

/** Memory text must never become new macros or prompt markup. */
function sanitize(text) {
  return String(text).replace(/\{\{/g, '{​{').replace(/\}\}/g, '}​}').slice(0, MAX_NOTE_CHARS).trim();
}

function readNote(fileName) {
  try {
    return fs.readFileSync(path.join(NOTES_DIR, fileName), 'utf8');
  } catch {
    return null;
  }
}

const reported = new Set();

/** Step 1: a hand-written note per chat (<chatId>.txt), else the shared _default.txt. */
function render(ctx) {
  const chatId = typeof ctx?.chatId === 'string' ? ctx.chatId : '';
  const safeId = /^[A-Za-z0-9_-]{1,128}$/.test(chatId) ? chatId : '';
  const own = safeId ? readNote(`${safeId}.txt`) : null;
  const note = own ?? readNote(DEFAULT_NOTE);
  if (note == null) return '';
  const text = sanitize(note);
  const key = `${safeId}|${own != null ? 'own' : 'default'}`;
  if (!reported.has(key)) {
    reported.add(key);
    log(`{{기억}} filled for chat ${safeId || '(none)'} from ${own != null ? `${safeId}.txt` : DEFAULT_NOTE} (${text.length} chars)`);
  }
  return text;
}

function install() {
  if (typeof registerHooks !== 'function') {
    log('this Node.js has no module.registerHooks (need 22.15+); memory module disabled, Marinara unchanged');
    return;
  }
  globalThis.__marinaraMemory = { version: VERSION, render };
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('file:')) return nextLoad(url, context);
      let filename;
      try {
        filename = fileURLToPath(url);
      } catch {
        return nextLoad(url, context);
      }
      if (!TARGET.test(filename)) return nextLoad(url, context);
      const result = nextLoad(url, context);
      const source =
        result.source == null
          ? fs.readFileSync(filename, 'utf8')
          : Buffer.isBuffer(result.source) || result.source instanceof Uint8Array
            ? Buffer.from(result.source).toString('utf8')
            : String(result.source);
      const patched = patchSource(source);
      if (patched == null) {
        log('fail closed: macro engine did not match this Marinara version; {{기억}} is off, Marinara unchanged');
        return result;
      }
      log(`v${VERSION} applied: {{기억}} macro ready (notes: ${NOTES_DIR})`);
      return { ...result, source: patched, shortCircuit: true };
    },
  });
  log(`v${VERSION} hook registered (no Marinara files changed)`);
}

if (process.env.MEMORY_MODULE_OFF === '1') log('MEMORY_MODULE_OFF=1; not installed');
else if (process.env.MEMORY_MODULE_HOOK_TEST !== '1' && !globalThis.__marinaraMemory) {
  try {
    install();
  } catch (error) {
    log('not installed: ' + (error?.message || error));
  }
}

module.exports = { patchSource, sanitize, render, ANCHOR, TARGET, VERSION };
