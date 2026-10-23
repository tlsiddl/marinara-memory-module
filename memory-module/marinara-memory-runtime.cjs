'use strict';
// Marinara Memory Module — runtime loader.
// Patches two Marinara 2.5.1 files in memory only (no files are written):
//   1. packages/shared/dist/utils/macro-engine.js → adds the {{기억}} / {{memory}} macro
//   2. packages/server/dist/app.js               → lets the module see finished replies and add its admin API
// Each patch fails closed on its own: if the expected line is not found exactly once, that part stays off
// and Marinara runs unchanged.

const fs = require('node:fs');
const path = require('node:path');
const { registerHooks } = require('node:module');
const { fileURLToPath } = require('node:url');

const TAG = '[memory-module]';
const VERSION = '0.2.7';
const NOTES_DIR = process.env.MEMORY_MODULE_NOTES_DIR || path.join(__dirname, 'notes');
const DEFAULT_NOTE = '_default.txt';
const MAX_NOTE_CHARS = 20000;

const PATCHES = [
  {
    name: 'macro',
    target: /[\\/]packages[\\/]shared[\\/]dist[\\/]utils[\\/]macro-engine\.js$/,
    anchor: '    result = result.replace(/\\{\\{chatId\\}\\}/gi, ctx.chatId ?? "");',
    insert:
      '\n    result = result.replace(/\\{\\{(?:기억|memory)\\}\\}/gi, () => { try { return globalThis.__marinaraMemory?.render?.(ctx) ?? ""; } catch { return ""; } });',
    ok: '{{기억}} macro ready',
  },
  {
    name: 'app',
    target: /[\\/]packages[\\/]server[\\/]dist[\\/]app\.js$/,
    anchor: '    app.decorate("db", db);',
    insert: '\n    try { globalThis.__marinaraMemory?.attach?.(app); } catch (error) { process.stderr.write("[memory-module] attach failed: " + (error?.message || error) + "\\n"); }',
    ok: 'reply hook and admin API ready',
  },
];

function log(message) {
  process.stderr.write(`${TAG} ${message}\n`);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/** Returns the patched source, or null when this file is not the expected version. */
function patchSource(source, patch = PATCHES[0]) {
  if (source.includes('__marinaraMemory')) return source;
  if (count(source, patch.anchor) !== 1) return null;
  return source.replace(patch.anchor, patch.anchor + patch.insert);
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

let service = null;
function loadService() {
  if (service === null) {
    try {
      service = require('./lib/service.cjs');
    } catch (error) {
      log('service unavailable: ' + (error?.message || error));
      service = false;
    }
  }
  return service || null;
}

const reported = new Set();

/**
 * What {{기억}} becomes: the chat's open threads, plus a hand-written note for this chat (<chatId>.txt).
 * The shared _default.txt is used only for a chat that has neither.
 */
function render(ctx) {
  const chatId = typeof ctx?.chatId === 'string' ? ctx.chatId : '';
  const safeId = /^[A-Za-z0-9_-]{1,128}$/.test(chatId) ? chatId : '';
  const ledgerText = safeId ? loadService()?.renderLedger(safeId) || '' : '';
  const own = safeId ? readNote(`${safeId}.txt`) : null;
  const note = own ?? (ledgerText ? null : readNote(DEFAULT_NOTE));
  const text = sanitize([ledgerText, note ? note.trim() : ''].filter(Boolean).join('\n\n'));
  const key = `${safeId}|${ledgerText ? 'ledger' : ''}|${own != null ? 'own' : note != null ? 'default' : ''}`;
  if (!reported.has(key)) {
    reported.add(key);
    log(`{{기억}} for chat ${safeId || '(none)'}: ${ledgerText ? 'ledger' : 'no ledger'}${own != null ? ' + own note' : note != null ? ' + default note' : ''} (${text.length} chars)`);
  }
  return text;
}

function attach(app) {
  const s = loadService();
  if (s) s.attach(app);
}

function install() {
  if (typeof registerHooks !== 'function') {
    log('this Node.js has no module.registerHooks (need 22.15+); memory module disabled, Marinara unchanged');
    return;
  }
  globalThis.__marinaraMemory = { version: VERSION, render, attach };
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('file:')) return nextLoad(url, context);
      let filename;
      try {
        filename = fileURLToPath(url);
      } catch {
        return nextLoad(url, context);
      }
      const patch = PATCHES.find((p) => p.target.test(filename));
      if (!patch) return nextLoad(url, context);
      const result = nextLoad(url, context);
      const source =
        result.source == null
          ? fs.readFileSync(filename, 'utf8')
          : Buffer.isBuffer(result.source) || result.source instanceof Uint8Array
            ? Buffer.from(result.source).toString('utf8')
            : String(result.source);
      const patched = patchSource(source, patch);
      if (patched == null) {
        log(`fail closed (${patch.name}): this Marinara version does not match; that part is off, Marinara unchanged`);
        return result;
      }
      log(`v${VERSION} applied: ${patch.ok}`);
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

module.exports = { patchSource, sanitize, render, PATCHES, VERSION };
