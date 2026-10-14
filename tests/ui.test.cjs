const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { createHarness } = require('./harness.cjs');

async function setup(t) {
  const h = await createHarness(t);
  const html = await fs.readFile(path.resolve(__dirname, '../addon/content/workbench.xhtml'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://paperloom.test/workbench.xhtml', runScripts: 'outside-only' });
  const { window } = dom; t.after(() => window.close());
  window.arguments = [{ app: h.app, core: h.C, options: {} }];
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.eval(await fs.readFile(path.resolve(__dirname, '../addon/content/workbench.js'), 'utf8'));
  return { ...h, window, $: id => window.document.getElementById(id) };
}
const waitFor = async fn => { for (let i = 0; i < 200; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 3)); } throw new Error('UI condition timed out'); };

test('offline UI renders all tabs and supports empty state without opening Zotero', async t => {
  const { window, $ } = await setup(t);
  assert.ok(window.PaperLoomUI); assert.equal($('empty-state').hidden, false);
  for (const tab of ['translate', 'jobs', 'glossary', 'columns', 'settings', 'about']) {
    window.PaperLoomUI.tab(tab); assert.equal($('tab-' + tab).hidden, false);
  }
});
test('newly created task becomes current and deleted task falls back to remaining task', async t => {
  const { app, window, $ } = await setup(t);
  const first = await app.createJob('Source A', { title: 'First' });
  const second = await app.createJob('Source B', { title: 'Second' });
  window.PaperLoomUI.render(); assert.equal($('job-title').textContent, 'Second');
  await app.removeJob(second.id); window.PaperLoomUI.render();
  assert.equal($('job-title').textContent, 'First'); assert.equal(app.currentID, first.id);
});
test('AI/source HTML is rendered as literal text, never executable nodes', async t => {
  const { app, window, $ } = await setup(t);
  const job = await app.createJob('<img src=x onerror=alert(1)>');
  await app.editTranslation(job.id, 's1', '<script>alert(1)</script>');
  window.PaperLoomUI.render();
  assert.equal($('segments').querySelectorAll('script,img').length, 0);
  assert.match($('segments').textContent, /<script>/);
});
test('unchanged segment DOM nodes are preserved across progress redraws', async t => {
  const { app, window, $ } = await setup(t); await app.createJob('A\n\nB');
  window.PaperLoomUI.render(); const first = $('segments').firstElementChild;
  window.PaperLoomUI.render(); assert.equal($('segments').firstElementChild, first);
});
test('correction dialog saves manual translation and review flag', async t => {
  const { app, window, $ } = await setup(t); const job = await app.createJob('The gap is 2.3 eV.'); window.PaperLoomUI.render();
  [...$('segments').querySelectorAll('button')].find(b => b.textContent === '校订译文').click();
  assert.equal($('edit-dialog').open, true); $('edit-target').value = '带隙为 2.3 eV。'; $('edit-reviewed').checked = true;
  $('edit-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => !$('edit-dialog').open);
  assert.equal(job.segments[0].target, '带隙为 2.3 eV。'); assert.equal(job.segments[0].reviewed, true);
});
test('AI column controls save evidence scope and visibility options', async t => {
  const { app, window, $ } = await setup(t); window.PaperLoomUI.tab('columns');
  $('column-source').value = 'fulltext'; $('visible-columns').checked = true; $('save-columns').click();
  await waitFor(() => app.config.columnSource === 'fulltext'); assert.equal(app.config.visibleColumnsOnly, true);
});
test('glossary UI adds and edits a term without duplicating it', async t => {
  const { app, window, $ } = await setup(t); window.PaperLoomUI.tab('glossary');
  $('term-source').value = 'band gap'; $('term-target').value = '带隙'; $('add-term').click();
  await waitFor(() => $('terms-body').children.length === 1);
  [...$('terms-body').querySelectorAll('button')].find(b => b.textContent === '编辑').click();
  $('term-target').value = '禁带宽度'; $('add-term').click();
  await waitFor(() => app.config.glossary[0].target === '禁带宽度'); assert.equal(app.config.glossary.length, 1);
});

test('cancelled PDF export does not display a false success message', async t => {
  const { app, window, $ } = await setup(t);
  await app.createJob('Source'); app.exportPDF = async () => undefined; window.PaperLoomUI.render();
  $('pdf-export').click(); await new Promise(r => setTimeout(r, 15));
  assert.ok(!$('notice').textContent.includes('PDF 输出已附加'));
});
