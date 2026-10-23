// Usage: node --require=./memory-module/marinara-memory-runtime.cjs tests/test-macro.mjs <path to packages/shared/dist/utils/macro-engine.js>
// Set MEMORY_MODULE_NOTES_DIR to a folder with _default.txt and optional <chatId>.txt files.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const engine = await import(pathToFileURL(process.argv[2]).href);
const base = { char: 'Mira', user: 'Bada', characters: ['Mira'], chatId: 'chat-default', variables: {}, localVariables: {} };

const withDefault = engine.resolveMacros('Before\n{{기억}}\nAfter {{chatId}}', base);
assert.match(withDefault, /DEFAULT NOTE/);
assert.match(withDefault, /After chat-default/);

const own = engine.resolveMacros('{{memory}}', { ...base, chatId: 'chat-own' });
assert.match(own, /OWN NOTE/);
assert.doesNotMatch(own, /DEFAULT NOTE/);

// A note that contains macros must not be expanded further.
const sneaky = engine.resolveMacros('{{기억}}', { ...base, chatId: 'chat-sneaky' });
assert.doesNotMatch(sneaky, /Bada/);

// Other macros keep working.
assert.equal(engine.resolveMacros('{{char}} and {{user}}', base), 'Mira and Bada');
console.log('ok: {{기억}} macro resolves, per-chat notes override, macros inside notes stay inert');
