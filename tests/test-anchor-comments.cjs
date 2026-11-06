'use strict';
// Every patch anchor must work with and without source comments (Android's esbuild build drops them).
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.MEMORY_MODULE_HOOK_TEST = '1';
const RT = require('../memory-module/marinara-memory-runtime.cjs');

const patch = RT.PATCHES.find((p) => p.name === 'speakerNamesPrompt');
const body = (middle) => `function run() {\n    if (isGroupChat) {${middle}        const groupInstructions = [];\n        groupInstructions.push("x");\n    }\n}\n`;
const withComment = body('\n        // Inject something at the end\n');
const lineOnly = body('\n');
const blankLines = body('\n\n\n');
const blockComment = body('\n        /* a note */\n');
const crlf = withComment.replace(/\n/g, '\r\n');

for (const [label, src] of Object.entries({ withComment, lineOnly, blankLines, blockComment, crlf })) {
  test(`speakerNamesPrompt anchor applies once, before the if: ${label}`, () => {
    const out = RT.patchSource(src, patch);
    assert.ok(out, 'applies');
    assert.equal(out.split(patch.insert).length - 1, 1);
    assert.ok(out.indexOf(patch.insert) < out.indexOf('if (isGroupChat) {'), 'inserted before the group-chat block');
    assert.equal(out.replace(patch.insert, ''), src, 'nothing else changed');
  });
}

test('speakerNamesPrompt fails closed when the following statement is different or the anchor repeats', () => {
  assert.equal(RT.patchSource('if (isGroupChat) {\n  const other = 1;\n}\n', patch), null);
  assert.equal(RT.patchSource(lineOnly + lineOnly, patch), null);
});

test('no anchor mentions a comment marker', () => {
  for (const p of RT.PATCHES) {
    const text = p.anchorRegex ? p.anchorRegex.source : p.anchor;
    assert.equal(new RegExp('Inject|[/][/] [A-Z]').test(text), false, p.name);
  }
});
