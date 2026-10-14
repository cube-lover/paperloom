/* All document/AI text is rendered with textContent, never evaluated or inserted as HTML. */
(() => {
  'use strict';
  const data = window.arguments?.[0];
  if (!data?.app) return;
  const { app, core: C } = data;
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => { const n = document.createElementNS('http://www.w3.org/1999/xhtml', tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
  const labels = { queued: '等待开始', paused: '已暂停', running: '翻译中', done: '已完成', partial: '部分失败', pending: '待翻译', error: '失败', skipped: '已保留原文' };
  let currentID = app.currentID || app.jobs[0]?.id, layout = app.config.layout, drawTimer, visibleTab = 'translate';
  let termEditIndex = null, editing = null;
  const segmentNodes = new Map();
  function toast(text, error = false) { $('notice').hidden = false; $('notice').textContent = text; $('notice').className = error ? 'error' : ''; }
  async function action(fn, success) {
    try { const value = await fn(); if (success && value !== undefined && value !== null && value !== false) toast(success); return value; }
    catch (error) { toast(error.message || '操作失败', true); return null; }
  }
  const on = (id, fn, success) => $(id).addEventListener('click', () => action(fn, success));
  const current = () => app.jobs.find(j => j.id === currentID);
  function tab(name) {
    visibleTab = name;
    document.querySelectorAll('.tab').forEach(n => { n.hidden = n.id !== 'tab-' + name; });
    document.querySelectorAll('[data-tab]').forEach(n => { n.classList.toggle('active', n.dataset.tab === name); if (n.dataset.tab === name) $('section-title').textContent = n.textContent.trim(); });
    if (name === 'settings') action(fillSettings); if (name === 'glossary') renderTerms();
    if (name === 'columns') { $('columns-json').value = JSON.stringify(app.config.columns, null, 2); $('column-source').value = app.config.columnSource; $('visible-columns').checked = app.config.visibleColumnsOnly; }
    render();
  }
  document.querySelectorAll('[data-tab]').forEach(n => n.addEventListener('click', () => tab(n.dataset.tab)));
  function useJob(job) { if (!job) return null; currentID = app.currentID = job.id; tab('translate'); render(); return job; }
  function schedule() { clearTimeout(drawTimer); drawTimer = setTimeout(render, 100); }
  function render() {
    $('job-count').textContent = String(app.jobs.length);
    if (app.jobs.some(j => j.id === app.currentID)) currentID = app.currentID;
    if (!app.jobs.some(j => j.id === currentID)) currentID = app.jobs[0]?.id;
    const select = $('job-select'); select.replaceChildren();
    if (!app.jobs.length) select.append(make('option', '', '选择任务'));
    for (const job of app.jobs) { const opt = make('option', '', job.title); opt.value = job.id; select.append(opt); }
    select.value = currentID || '';
    if (visibleTab === 'jobs') renderJobs();
    const job = current(); $('empty-state').hidden = !!job; $('job-workspace').hidden = !job;
    if (!job || visibleTab !== 'translate') return;
    const done = job.segments.filter(s => ['done', 'skipped'].includes(s.status)).length;
    const warn = job.segments.filter(s => s.warnings?.length || s.status === 'error').length;
    $('job-title').textContent = job.title;
    const estimate = C.estimate(job.segments);
    $('job-meta').textContent = `${job.config.model} → ${job.config.targetLang} · ${estimate.chars.toLocaleString()} 字符 · 约 ${estimate.roughInputTokens.toLocaleString()} 输入 token（粗估，不含提示词/上下文/输出，非计费报价）`;
    $('job-status').textContent = `${labels[job.status]} · ${done}/${job.segments.length} 段 · ${warn} 段待核对`;
    $('progress').style.width = `${job.segments.length ? done / job.segments.length * 100 : 0}%`;
    $('start').disabled = !!app.active.size || !!app.aiBusy || app.batchActive;
    $('pause').disabled = !app.active.has(job.id) && !app.aiBusy;
    $('ai-progress').textContent = app.aiProgress || '';
    $('source-pdf').disabled = !job.attachmentID;
    for (const id of ['summarize', 'generate-columns']) $(id).disabled = !!app.active.size || !!app.aiBusy;
    $('segments').className = 'segments ' + layout;
    const shown = job.segments.filter(s => !$('warnings-only').checked || !s.reviewed && (s.warnings?.length || s.status === 'error'));
    const cards = [], retained = new Set();
    for (const segment of shown) {
      const key = job.id + '/' + segment.id; retained.add(key);
      const signature = JSON.stringify([segment, app.active.has(job.id), !!app.batchActive]);
      const old = segmentNodes.get(key);
      if (old?.signature === signature) { cards.push(old.node); continue; }
      const card = make('article', 'segment'), head = make('div', 'segment-head');
      head.append(make('span', '', `${segment.id.toUpperCase()}${segment.page ? ` · 第 ${segment.page} 页` : ''}`), make('span', segment.status === 'error' ? 'error' : 'muted', `${labels[segment.status]}${segment.cached ? ' · 命中缓存' : ''}`));
      const retry = make('button', '', '标记重译'); retry.disabled = app.active.has(job.id) || segment.status === 'skipped';
      retry.disabled ||= !!app.batchActive;
      retry.addEventListener('click', () => action(() => app.retrySegment(job.id, segment.id), '已标记，点击“继续翻译”重译该段'));
      const edit = make('button', '', segment.reviewed ? '已核对 · 编辑' : '校订译文');
      edit.disabled = app.active.has(job.id) || !!app.batchActive;
      edit.addEventListener('click', () => editSegment(job, segment));
      if (job.attachmentID) { const sourceButton = make('button', '', segment.page ? `原文第 ${segment.page} 页` : '打开原文'); sourceButton.addEventListener('click', () => action(() => app.openSource(job, segment))); head.append(sourceButton); }
      head.append(edit, retry);
      const row = make('div', 'segment-text'), source = make('div', 'source', segment.source);
      const target = make('div', 'target', segment.target || (segment.status === 'skipped' ? segment.source : segment.status === 'running' ? '正在翻译…' : '译文将在这里显示。'));
      target.tabIndex = 0; target.setAttribute('aria-label', '译文，按回车复制');
      const copy = () => {
        if (window.getSelection()?.toString() || !segment.target) return;
        const mode = app.config.clickAction; if (mode === 'none') return;
        app.copy(mode === 'source' ? segment.source : mode === 'target' ? segment.target : `${segment.source}\n\n${segment.target}`); toast('已复制');
      };
      target.addEventListener('click', copy); target.addEventListener('keydown', e => { if (e.key === 'Enter') copy(); });
      row.append(source, target); card.append(head, row);
      if (segment.error) card.append(make('div', 'warning error', segment.error));
      if (segment.warnings?.length) card.append(make('div', 'warning', '待核对：' + segment.warnings.join('；')));
      cards.push(card); segmentNodes.set(key, { signature, node: card });
    }
    for (const key of segmentNodes.keys()) if (!retained.has(key)) segmentNodes.delete(key);
    // Reuse unchanged rows so progress updates don't recreate the whole paper or reset keyboard focus.
    if (!window.getSelection()?.toString()) {
      const container = $('segments');
      cards.forEach((node, index) => { if (container.children[index] !== node) container.insertBefore(node, container.children[index] || null); });
      while (container.children.length > cards.length) container.lastElementChild.remove();
    }
  }
  function renderJobs() {
    $('jobs-list').replaceChildren();
    if (!app.jobs.length) $('jobs-list').append(make('p', 'muted', '暂无任务。加载 PDF 或粘贴文本创建任务。'));
    for (const job of app.jobs) {
      const card = make('div', 'card job-card'), left = make('div');
      left.append(make('h2', '', job.title), make('p', '', `${labels[job.status]} · ${job.segments.filter(s => s.status === 'done').length}/${job.segments.length} 段已译 · ${new Date(job.created).toLocaleString()}`));
      const open = make('button', '', '查看'), remove = make('button', '', '删除记录');
      open.addEventListener('click', () => useJob(job)); remove.addEventListener('click', () => action(() => app.removeJob(job.id)));
      card.append(left, open, remove); $('jobs-list').append(card);
    }
  }
  function renderTerms() {
    $('terms-body').replaceChildren();
    app.config.glossary.forEach((term, index) => {
      const row = make('tr'), del = make('button', '', '删除');
      del.addEventListener('click', () => action(async () => { const glossary = app.config.glossary.filter((_, i) => i !== index); await app.saveConfig({ ...app.config, glossary }); termEditIndex = null; $('term-source').value = ''; $('term-target').value = ''; renderTerms(); }));
      const edit = make('button', '', '编辑'); edit.addEventListener('click', () => { termEditIndex = index; $('term-source').value = term.source; $('term-target').value = term.target; $('term-case').checked = term.caseSensitive; $('term-source').focus(); });
      const cell = make('td'); cell.append(edit, del); row.append(make('td', '', term.source + (term.caseSensitive ? ' [Aa]' : '')), make('td', '', term.target), cell); $('terms-body').append(row);
    });
  }
  function editSegment(job, segment) {
    editing = { jobID: job.id, segmentID: segment.id };
    $('edit-source').value = segment.source; $('edit-target').value = segment.target || ''; $('edit-reviewed').checked = !!segment.reviewed;
    $('edit-history').replaceChildren(make('option', '', '恢复历史版本到编辑框'));
    $('edit-history').firstElementChild.value = '';
    (segment.history || []).forEach((h, i) => { const option = make('option', '', `${h.at} · ${h.reason}`); option.value = String(i); $('edit-history').append(option); });
    $('edit-dialog').showModal(); $('edit-target').focus();
  }
  $('edit-history').addEventListener('change', () => { if ($('edit-history').value === '') return; const job = app.jobs.find(j => j.id === editing.jobID); const segment = job.segments.find(s => s.id === editing.segmentID); $('edit-target').value = segment.history[Number($('edit-history').value)].target; $('edit-reviewed').checked = false; });
  $('edit-form').addEventListener('submit', e => { e.preventDefault(); action(async () => { await app.editTranslation(editing.jobID, editing.segmentID, $('edit-target').value, $('edit-reviewed').checked); $('edit-dialog').close(); return true; }, '校订已保存，原 PDF 保持不变'); });
  on('edit-cancel', () => $('edit-dialog').close());
  async function fillSettings() {
    for (const [key, value] of Object.entries(app.config)) {
      const input = $('settings-form').elements.namedItem(key); if (!input) continue;
      if (input.type === 'checkbox') input.checked = !!value; else input.value = value;
    }
    $('key-state').textContent = await app.secret() ? '已保存密钥（不显示原值）' : '尚未保存密钥；无认证的本地模型可留空';
  }
  async function saveSettings() {
    const value = { ...app.config };
    for (const input of $('settings-form').elements) {
      if (!input.name) continue; value[input.name] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value.trim();
    }
    const validated = C.validateConfig(value);
    // Credentials are scoped to each endpoint; changing endpoint never forwards the previous key.
    await app.saveConfig(validated);
    if ($('api-key').value) { await app.setSecret('provider', $('api-key').value.trim()); $('api-key').value = ''; }
    if ($('bridge-token').value) { await app.setSecret('bridge', $('bridge-token').value.trim()); $('bridge-token').value = ''; }
    layout = app.config.layout; await fillSettings(); return true;
  }
  $('settings-form').addEventListener('submit', e => { e.preventDefault(); action(saveSettings, '设置已保存；新任务使用新配置，历史任务保留原配置。'); });
  $('job-select').addEventListener('change', () => { currentID = app.currentID = $('job-select').value; render(); });
  $('warnings-only').addEventListener('change', render);
  on('load-selected', async () => { toast('正在本地解析 PDF…'); await app.loadSelected(); currentID = app.currentID; render(); return true; }, '已加载；检查原文顺序后开始翻译');
  on('toggle-input', () => { $('text-input').hidden = !$('text-input').hidden; });
  on('create-text', async () => { const job = await app.createJob($('paper-text').value, { title: $('paper-title').value }); $('text-input').hidden = true; useJob(job); });
  on('import-text', async () => { const file = await app.readFile('*.md; *.txt'); if (file) useJob(await app.createJob(file.text, { title: file.name, parser: 'markdown' })); });
  on('start', () => app.start(currentID)); on('pause', () => { app.pause(currentID); toast('已请求暂停；已完成段落保留。'); });
  on('clone-job', async () => useJob(await app.cloneWithCurrentConfig(currentID)));
  on('start-all', () => app.startAll()); on('toggle-layout', () => { layout = layout === 'columns' ? 'rows' : 'columns'; render(); });
  on('source-pdf', () => app.openSource(current()));
  on('note-export', () => app.exportNote(currentID), '双语笔记已保存到 Zotero');
  on('md-export', () => app.saveFile('PaperLoom-translation.md', C.toMarkdown(current(), current().config)), 'Markdown 已保存');
  on('html-export', () => {
    const job = current();
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${C.escapeHTML(job.title)}</title><style>body{max-width:960px;margin:40px auto;padding:20px;font:16px/1.8 system-ui;color:#172239}blockquote{border-left:3px solid #9ab1ef;margin-left:0;padding-left:18px;color:#58657c}h3{break-after:avoid}@media print{body{margin:0;max-width:none}a{color:inherit}}</style>${C.noteHTML(job, job.config)}</html>`;
    return app.saveFile('PaperLoom-bilingual.html', html, '*.html');
  }, 'HTML 已保存；在浏览器中打印可另存为 PDF（重新排版）');
  on('pdf-export', () => app.exportPDF(currentID), 'PDF 输出已附加到文献条目');
  on('summarize', async () => {
    const mode = $('summary-mode').value;
    const keywords = mode === 'keywords' ? window.prompt('输入筛选关键词，逗号分隔（匹配原文段落）', 'method, result') : '';
    if (keywords === null) return null;
    toast('正在生成分段证据摘要；长论文可能需要多次调用…'); return await app.summarize(currentID, mode, keywords);
  }, 'AI 总结笔记已保存；请核对段落证据');
  on('generate-columns', () => app.generateColumns(currentID), 'AI 列已生成，证据范围已写入记录');
  on('add-term', async () => {
    const glossary = [...app.config.glossary], term = { source: $('term-source').value, target: $('term-target').value, caseSensitive: $('term-case').checked };
    if (termEditIndex === null) glossary.push(term); else glossary[termEditIndex] = term;
    await app.saveConfig({ ...app.config, glossary }); termEditIndex = null;
    $('term-source').value = ''; $('term-target').value = ''; $('term-case').checked = false; renderTerms(); return true;
  }, '术语已保存');
  on('reset-term', () => { termEditIndex = null; $('term-source').value = ''; $('term-target').value = ''; $('term-case').checked = false; });
  on('import-terms', async () => { const file = await app.readFile('*.json'); if (!file) return null; if (!app.confirm('导入术语表', '导入将替换现有术语表；建议先导出备份。继续？')) return null; await app.saveConfig({ ...app.config, glossary: JSON.parse(file.text) }); termEditIndex = null; renderTerms(); return true; }, '术语表已导入（替换原列表）');
  on('export-terms', () => app.saveFile('PaperLoom-glossary.json', JSON.stringify(app.config.glossary, null, 2), '*.json'));
  on('save-columns', async () => { await app.saveConfig({ ...app.config, columns: JSON.parse($('columns-json').value), columnSource: $('column-source').value, visibleColumnsOnly: $('visible-columns').checked }); return true; }, 'AI 列已保存');
  on('import-columns', async () => { const file = await app.readFile('*.json'); if (!file) return; const columns = JSON.parse(file.text); C.validateConfig({ ...app.config, columns }); $('columns-json').value = JSON.stringify(columns, null, 2); return true; }, '已载入定义，点击保存生效');
  on('export-columns', () => app.saveFile('PaperLoom-columns.json', JSON.stringify(app.config.columns, null, 2), '*.json'));
  on('copy-columns', () => app.copy(JSON.stringify(app.config.columns, null, 2)), '已复制 AI 列定义');
  on('test-engine', async () => {
    if (!await saveSettings()) return null;
    if (!app.confirm('测试接口', `向 ${new URL(app.config.endpoint).host} 发送短测试句，可能产生少量费用。继续？`)) return null;
    const result = await app.translate('The measured band gap is 2.3 eV.', app.config); toast('接口返回：' + result.text); return result;
  });
  on('delete-key', async () => { if (app.confirm('删除密钥', '删除 Cube 翻译自身保存的 API 密钥？')) { await app.setSecret('provider', ''); fillSettings(); } });
  on('clear-cache', () => app.clearCache(), '缓存清理操作结束');
  on('data-dir', () => app.openDataDirectory());
  on('export-config', () => app.saveFile('PaperLoom-config.json', JSON.stringify(C.validateConfig(app.config), null, 2), '*.json'));
  on('import-config', async () => { const file = await app.readFile('*.json'); if (!file) return null; const cfg = C.validateConfig(JSON.parse(file.text)); if (!app.confirm('导入配置', '将替换当前设置。旧任务保留原配置；密钥按服务地址保存且不从文件导入。继续？')) return null; await app.saveConfig(cfg); await fillSettings(); return true; }, '配置已导入');
  window.PaperLoomUI = { receive: options => {
    if (options.tab) tab(options.tab);
    if (options.attachmentID) action(async () => { toast('正在本地解析 PDF…'); return useJob(await app.loadAttachment(options.attachmentID)); }, '已加载论文');
    else { if (app.currentID) currentID = app.currentID; render(); }
  }, tab, render };
  app.listeners.add(schedule);
  window.addEventListener('unload', () => { app.listeners.delete(schedule); clearTimeout(drawTimer); });
  render(); window.PaperLoomUI.receive(data.options || {});
  if (app.notices?.length) toast(app.notices.join('；'));
})();
