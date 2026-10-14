const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../addon/content/core.js');
const P = require('../addon/content/providers.js');

test('OpenAI URL accepts base URL and complete endpoint without duplicating suffix', () => {
  const cfg = C.validateConfig(); const messages = [{ role: 'user', content: 'hello' }];
  for (const endpoint of ['https://example.org/v1', 'https://example.org/v1/chat/completions']) {
    const req = P.buildRequest(messages, { ...cfg, endpoint }, 'test-value');
    assert.equal(req.url, 'https://example.org/v1/chat/completions'); assert.equal(req.headers.Authorization, 'Bearer test-value');
    assert.equal(req.body.temperature, undefined); assert.equal(req.body.stream, false);
  }
});
test('DeepL uses XML ignore-tags, correct endpoint, and language codes', () => {
  const cfg = C.validateConfig({ provider: 'deepl', endpoint: 'https://api-free.deepl.com', sourceLang: 'EN-US' });
  const req = P.buildRequest([{ role: 'user', content: '<source>\nValue ⟦PL_0000⟧ and x < y\n</source>' }], cfg, 'test');
  assert.equal(req.url, 'https://api-free.deepl.com/v2/translate'); assert.equal(req.body.source_lang, 'EN'); assert.equal(req.body.target_lang, 'ZH');
  assert.match(req.body.text[0], /<pl>⟦PL_0000⟧<\/pl>/); assert.match(req.body.text[0], /x &lt; y/);
  assert.deepEqual(req.body.ignore_tags, ['pl']);
});
test('DeepL response decodes only after stripping our wrapper, preserving source markup literally', () => {
  const result = P.parseResponse({ translations: [{ text: '<document>译文 <pl>⟦PL_0000⟧</pl> &lt;script&gt; &amp;lt;</document>' }] }, { provider: 'deepl' });
  assert.equal(result, '译文 ⟦PL_0000⟧ <script> &lt;');
});
test('DeepL refuses unsupported AI operations and invalid languages before network', () => {
  assert.throws(() => P.buildRequest([{ content: 'x' }], { provider: 'deepl', endpoint: 'https://example.org', targetLang: 'ZH' }, '', 'summary'));
  assert.throws(() => P.language('not a language code'));
});
test('truncation and missing content are explicit failures', () => {
  assert.throws(() => P.parseResponse({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }, { provider: 'openai' }), /截断/);
  assert.throws(() => P.parseResponse({}, { provider: 'openai' }));
});
