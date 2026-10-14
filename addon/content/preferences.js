/* PaperLoom preferences pane: full engine/glossary/column configuration inline. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = () => Zotero.PaperLoom;

  function notice(text, error = false) {
    const node = $('pl-notice'); if (!node) return;
    node.hidden = false; node.textContent = text; node.className = error ? 'error' : '';
  }
  async function guard(fn, success) {
    try { const value = await fn(); if (success && value !== false) notice(success); return value; }
    catch (e) { Zotero.logError(e); notice(e.message || String(e), true); return false; }
  }

  function ocrPane() {
    const pane = app();
    const python = $('pl-ocr-python'), runtime = $('pl-ocr-runtime'), models = $('pl-ocr-models');
    if (!python || !models) return;
    const values = pane.graphicRuntime ? pane.graphicRuntime() : {};
    python.value = values.python || '';
    runtime.value = values.runtime || '';
    models.value = values.models || '';
    const persist = () => {
      if (!pane.setGraphicRuntimeValue) return;
      pane.setGraphicRuntimeValue('python', python.value.trim());
      pane.setGraphicRuntimeValue('runtime', runtime.value.trim());
      pane.setGraphicRuntimeValue('models', models.value.trim());
    };
    for (const el of [python, runtime, models]) el.addEventListener('change', persist);
  }

  function fillForm() {
    const config = app().config;
    for (const el of $('pl-form').elements) {
      if (!el.name || !(el.name in config)) continue;
      if (el.type === 'checkbox') el.checked = !!config[el.name];
      else el.value = config[el.name];
    }
    $('pl-columns').value = JSON.stringify(config.columns, null, 2);
    ocrPane();
    renderTerms();
    return app().secret().then(key => {
      $('pl-key-state').textContent = key ? '已保存密钥（不显示原值）' : '尚未保存；无认证的本地模型可留空';
    });
  }

  async function saveForm() {
    const value = { ...app().config };
    for (const el of $('pl-form').elements) {
      if (!el.name) continue;
      value[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
    }
    await app().saveConfig(value); // validateConfig runs inside; throws on bad input.
    if ($('pl-key').value) { await app().setSecret('provider', $('pl-key').value.trim()); $('pl-key').value = ''; }
    if ($('pl-bridge-token').value) { await app().setSecret('bridge', $('pl-bridge-token').value.trim()); $('pl-bridge-token').value = ''; }
    await fillForm();
    return true;
  }

  function renderTerms() {
    const body = $('pl-term-rows'); body.replaceChildren();
    const glossary = app().config.glossary;
    if (!glossary.length) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 4; td.className = 'muted'; td.textContent = '暂无术语。添加后翻译会强制使用这些对应译法。';
      tr.append(td); body.append(tr); return;
    }
    glossary.forEach((term, index) => {
      const tr = document.createElement('tr');
      for (const text of [term.source, term.target, term.caseSensitive ? '是' : '否']) {
        const td = document.createElement('td'); td.textContent = text; tr.append(td);
      }
      const td = document.createElement('td');
      const del = document.createElement('button'); del.type = 'button'; del.textContent = '删除';
      del.addEventListener('click', () => guard(async () => {
        const next = app().config.glossary.filter((_, i) => i !== index);
        await app().saveConfig({ ...app().config, glossary: next }); renderTerms(); return true;
      }, '术语已删除'));
      td.append(del); tr.append(td); body.append(tr);
    });
  }

  function bind() {
    const form = $('pl-form');
    if (!form || !app()) { setTimeout(bind, 200); return; }

    $('pl-open').addEventListener('click', () => guard(() => { app().open({ tab: 'translate' })?.focus(); return false; }));
    $('pl-test').addEventListener('click', () => guard(async () => {
      await saveForm();
      const probe = await app().translate('PaperLoom connectivity check.', app().config, '');
      notice('连接成功：' + (probe.text || '').slice(0, 60)); return false;
    }));

    form.addEventListener('submit', e => { e.preventDefault(); guard(saveForm, '设置已保存；新任务使用新配置，历史任务保留原配置。'); });
    $('pl-reload').addEventListener('click', () => guard(() => fillForm().then(() => true), '已重新载入当前配置'));

    $('pl-term-add').addEventListener('click', () => guard(async () => {
      const source = $('pl-term-source').value.trim(), target = $('pl-term-target').value.trim();
      if (!source || !target) throw new Error('请填写原文和译文');
      const glossary = [...app().config.glossary, { source, target, caseSensitive: $('pl-term-case').checked }];
      await app().saveConfig({ ...app().config, glossary });
      $('pl-term-source').value = ''; $('pl-term-target').value = ''; $('pl-term-case').checked = false;
      renderTerms(); return true;
    }, '术语已添加'));

    $('pl-term-import').addEventListener('click', () => guard(async () => {
      const file = await app().readFile('*.json'); if (!file) return false;
      if (!app().confirm('导入术语表', '导入将替换现有术语表，建议先导出备份。继续？')) return false;
      await app().saveConfig({ ...app().config, glossary: JSON.parse(file.text) }); renderTerms(); return true;
    }, '术语表已导入（替换原列表）'));
    $('pl-term-export').addEventListener('click', () => guard(() =>
      app().saveFile('PaperLoom-glossary.json', JSON.stringify(app().config.glossary, null, 2), '*.json').then(() => false)));

    $('pl-columns-save').addEventListener('click', () => guard(async () => {
      await app().saveConfig({ ...app().config, columns: JSON.parse($('pl-columns').value) }); fillForm(); return true;
    }, 'AI 列已保存，可在文献列表列选择器中启用'));
    $('pl-columns-reset').addEventListener('click', () => guard(() => {
      $('pl-columns').value = JSON.stringify([
        { id: 'method', name: '⭐ 研究方法', prompt: '用一句话描述研究方法，不超过60字。', enabled: true },
        { id: 'finding', name: '⭐ 核心发现', prompt: '用一句话提取核心发现，不超过60字。', enabled: true },
        { id: 'limitation', name: '⭐ 局限性', prompt: '简述文中明确陈述的局限性；未报告则写“未报告”。', enabled: true }
      ], null, 2); return false;
    }));

    fillForm();
  }

  bind();
})();
