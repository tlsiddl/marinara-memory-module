'use strict';
// Marinara Memory Module — runtime loader.
// Patches Marinara 2.4.6 files in memory only (no files are written):
//   1. packages/shared/dist/utils/macro-engine.js → adds the {{기억}} / {{memory}} macro
//   2. packages/server/dist/app.js               → lets the module see finished replies and add its admin API
//   3. packages/server/dist/routes/generate.routes.js → repairs tags before streaming/reply persistence
// Each patch fails closed on its own: if the expected line is not found exactly once, that part stays off
// and Marinara runs unchanged.

const fs = require('node:fs');
const path = require('node:path');
const { registerHooks } = require('node:module');
const { fileURLToPath } = require('node:url');

const TAG = '[memory-module]';
/** Target checked against upstream source and compiled hook contracts; see COMPATIBILITY.md for test scope. */
const TESTED_MARINARA = '2.4.6';
const VERSION = '0.10.2-marinara.2.4.6.1';
const NOTES_DIR = process.env.MEMORY_MODULE_NOTES_DIR || path.join(__dirname, 'notes');
const DEFAULT_NOTE = '_default.txt';
/** Last safety net only: the service already keeps the memory within its own limit (40,000 by default). */
const MAX_NOTE_CHARS = 60000;

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
  {
    name: 'speakers',
    target: /[\\/]packages[\\/]server[\\/]dist[\\/]routes[\\/]generate\.routes\.js$/,
    anchor: 'const gameDraftWithCommands = fullResponse;',
    before: true,
    insert:
      'try { const fixed = globalThis.__marinaraMemory?.fixSpeakers?.(fullResponse, { chatId: input.chatId, chatMode, isGroupChat, usesIndividualGroupGeneration, impersonate: input.impersonate, charInfo }); if (typeof fixed === "string" && fixed !== fullResponse) { fullResponse = fixed; contentReplaced = true; } } catch {}\n',
    ok: 'speaker tags are put back on untagged lines',
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
  return source.replace(patch.anchor, patch.before ? patch.insert + patch.anchor : patch.anchor + patch.insert);
}

/** Memory text must never become new macros or prompt markup. */
function sanitize(text) {
  let out = String(text).replace(/\{\{/g, '{​{').replace(/\}\}/g, '}​}');
  if (out.length > MAX_NOTE_CHARS) {
    // Never in the middle of a line.
    const cut = out.lastIndexOf('\n', MAX_NOTE_CHARS);
    out = out.slice(0, cut > 0 ? cut : MAX_NOTE_CHARS);
  }
  return out.trim();
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

/** Called from Marinara's reply cleanup with the finished reply; returns it with speaker tags put back. */
function fixSpeakers(text, o) {
  return loadService()?.fixSpeakers?.(text, o) ?? text;
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
  // What happened to each patch: 'ok', 'failed' (this Marinara version differs), or missing (file not loaded yet).
  const patches = {};
  globalThis.__marinaraMemory = { version: VERSION, testedMarinara: TESTED_MARINARA, patches, render, attach, fixSpeakers };
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
        patches[patch.name] = 'failed';
        log(`fail closed (${patch.name}): this Marinara version does not match; that part is off, Marinara unchanged`);
        return result;
      }
      patches[patch.name] = 'ok';
      log(`v${VERSION} applied: ${patch.ok}`);
      return { ...result, source: patched, shortCircuit: true };
    },
  });
  log(`v${VERSION} hook registered (no Marinara files changed)`);
}

/**
 * Only the Marinara server itself: with NODE_OPTIONS set for a whole launcher, the same line also reaches the
 * launcher, pnpm and build steps — those stay untouched and silent.
 */
function isServerProcess() {
  if (process.env.MEMORY_MODULE_ANY_PROCESS === '1') return true; // tests that load Marinara files directly
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return /[\\/]packages[\\/]server[\\/]dist[\\/]index\.js$/i.test(entry);
}

if (process.env.MEMORY_MODULE_OFF === '1') log('MEMORY_MODULE_OFF=1; not installed');
else if (process.env.MEMORY_MODULE_HOOK_TEST !== '1' && !globalThis.__marinaraMemory && isServerProcess()) {
  try {
    install();
  } catch (error) {
    log('not installed: ' + (error?.message || error));
  }
}

module.exports = { patchSource, sanitize, render, PATCHES, VERSION, TESTED_MARINARA };

