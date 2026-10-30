// node --test tests/test-model-options.cjs
// DeepSeek's own API thinks by default, and the thinking eats the room for the answer: memory calls turn it off.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-opts-'));
const X = require('../memory-module/lib/service.cjs')._test;
test.after(() => fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }));

test('DeepSeek connections get thinking turned off for memory work; others and explicit choices are left alone', () => {
  const off = { customParameters: { thinking: { type: 'disabled' } } };
  assert.deepEqual(X.memoryCallOptions({ provider: 'deepseek' }, 'https://api.deepseek.com'), off);
  assert.deepEqual(X.memoryCallOptions({ provider: 'openai' }, 'https://api.deepseek.com/v1'), off, '2.4.6 style: an OpenAI-type connection to DeepSeek');
  assert.deepEqual(X.memoryCallOptions({ provider: 'custom' }, 'https://api.deepseek.com:443/v1'), off);
  assert.deepEqual(X.memoryCallOptions({ provider: 'openai' }, 'https://api.openai.com/v1'), {});
  assert.deepEqual(X.memoryCallOptions({ provider: 'openrouter' }, 'https://openrouter.ai/api/v1'), {}, 'other routes to DeepSeek models are not touched');
  assert.deepEqual(X.memoryCallOptions({ provider: 'custom' }, 'https://notdeepseek.com.example.org/v1'), {});
  assert.deepEqual(X.memoryCallOptions({ provider: 'deepseek', defaultParameters: '{"customParameters":{"thinking":{"type":"enabled"}}}' }, 'https://api.deepseek.com'), {}, 'the connection says how to think: kept');
});
