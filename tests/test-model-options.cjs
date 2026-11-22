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

test('Gemma 4 is asked to think lightly unless the connection says how to think; a site that refuses it is asked without', async () => {
  assert.deepEqual(X.memoryCallOptions({ provider: 'openai', model: 'google/gemma-4-26b-a4b-it' }, 'https://nano-gpt.com/api/v1'), { light: { customParameters: { reasoning_effort: 'low' } } });
  assert.deepEqual(X.memoryCallOptions({ provider: 'openrouter', model: 'google/gemma-4-31b-it' }, 'https://openrouter.ai/api/v1'), { light: { customParameters: { reasoning: { effort: 'low' } } } });
  assert.deepEqual(X.memoryCallOptions({ provider: 'google', model: 'gemma-4-31b-it' }, 'https://generativelanguage.googleapis.com/v1beta'), { light: { reasoningEffort: 'low', enableThinking: true } });
  assert.deepEqual(X.memoryCallOptions({ provider: 'openai', model: 'gemma-4-31b-it', defaultParameters: '{"reasoningEffort":"high"}' }, 'https://x.example/v1'), {}, 'its own setting wins');
  assert.deepEqual(X.memoryCallOptions({ provider: 'openai', model: 'gemma-3-27b-it' }, 'https://x.example/v1'), {});
  const seen = [];
  const model = {
    name: 'gemma-test', model: 'gemma-4-31b-it', extra: X.memoryCallOptions({ provider: 'openai', model: 'gemma-4-31b-it' }, 'https://x.example/v1'),
    provider: { async chatComplete(_m, opts) { seen.push(opts.customParameters?.reasoning_effort || null); if (opts.customParameters) throw Error('400 Unrecognized request argument supplied: reasoning_effort'); return { content: '{"ok":true}' }; } },
  };
  assert.equal(await X.askModel(model, [{ role: 'user', content: 'x' }]), '{"ok":true}');
  assert.deepEqual(seen, ['low', null]);
  await X.askModel(model, [{ role: 'user', content: 'x' }]);
  assert.deepEqual(seen, ['low', null, null], 'not sent again to a site that refused it');
  // Another error is not taken for a refusal.
  const other = { ...model, name: 'gemma-other', provider: { async chatComplete() { throw Error('429 rate limited'); } } };
  await assert.rejects(X.askModel(other, [{ role: 'user', content: 'x' }]), /429/);
});
