var PaperLoomProviders;
(function (root) {
  'use strict';
  const xmlEscape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const xmlDecode = s => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[\da-f]+);/gi, (all, code) => {
    const entities = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
    if (Object.hasOwn(entities, code)) return entities[code];
    const n = code.startsWith('#x') ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isInteger(n) && n <= 0x10ffff && n >= 0 ? String.fromCodePoint(n) : all;
  });
  function language(value, source = false) {
    const aliases = { '简体中文': 'ZH', '中文': 'ZH', '繁體中文': 'ZH-HANT', 'English': 'EN', '英语': 'EN', '日本語': 'JA', '日语': 'JA', '德语': 'DE', '法语': 'FR' };
    const code = aliases[value] || String(value).toUpperCase();
    if (!/^[A-Z]{2,3}(?:-[A-Z]{2,4})?$/.test(code)) throw new Error('DeepL 语言请填写支持的语言代码，如 EN、ZH、JA');
    return source ? code.split('-')[0] : code;
  }
  function buildRequest(messages, cfg, key, task = 'translation') {
    const endpoint = cfg.endpoint.replace(/\/+$/, '');
    const source = messages[messages.length - 1]?.content || '';
    if (cfg.provider === 'deepl') {
      if (task !== 'translation') throw new Error('AI 总结与 AI 列需要 OpenAI 兼容接口；DeepL 仅用于翻译');
      const text = source.replace(/^<source>\n|\n<\/source>$/g, '');
      // DeepL XML ignore_tags keeps formula/glossary placeholders untouched.
      const xml = '<document>' + xmlEscape(text).replace(/⟦PL_[X]*\d+⟧/g, marker => '<pl>' + marker + '</pl>') + '</document>';
      return { url: endpoint.replace(/\/v2(?:\/translate)?$/, '') + '/v2/translate',
        body: { text: [xml], target_lang: language(cfg.targetLang), tag_handling: 'xml', ignore_tags: ['pl'], outline_detection: false, preserve_formatting: true,
          ...(cfg.sourceLang !== 'auto' ? { source_lang: language(cfg.sourceLang, true) } : {}) },
        headers: key ? { Authorization: `DeepL-Auth-Key ${key}` } : {} };
    }
    return { url: /\/chat\/completions$/.test(endpoint) ? endpoint : endpoint + '/chat/completions',
      // Omit temperature/max_tokens to accommodate reasoning-model APIs that reject those fields.
      body: { model: cfg.model, messages, stream: false }, headers: key ? { Authorization: `Bearer ${key}` } : {} };
  }
  function parseResponse(response, cfg) {
    const choice = response?.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('模型输出被截断，请减小分段长度');
    if (choice?.finish_reason === 'content_filter') throw new Error('服务未完成此段输出，请检查服务返回状态');
    let text = cfg.provider === 'deepl' ? response?.translations?.[0]?.text : choice?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('服务未返回有效译文；请检查模型和响应格式');
    if (cfg.provider === 'deepl') text = xmlDecode(text.replace(/<\/?(?:document|pl)(?:\s[^>]*)?>/g, ''));
    return text.trim();
  }
  const api = { buildRequest, parseResponse, language };
  PaperLoomProviders = root.PaperLoomProviders = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
