(async () => {
  const report = { runtime: Zotero.version, started: new Date().toISOString(), checks: [] };
  const check = (name, value) => { report.checks.push({ name, passed: !!value }); if (!value) throw new Error('Check failed: ' + name); };
  try {
    await Zotero.uiReadyPromise;
    const app = PaperLoom, C = PaperLoomCore;
    check('isolated-data-directory', Zotero.DataDirectory.dir.replace(/\\/g, '/').includes('paperloom/.runtime-test/data'));
    check('preferences-registered', Zotero.PreferencePanes.pluginPanes.some(p => p.id === 'paperloom-preferences'));
    check('columns-registered', app.columnKeys.length === 3);
    await app.saveConfig({ ...app.config, endpoint: 'http://127.0.0.1:18767/v1', model: 'mock-academic',
      requestsPerMinute: 600, glossary: [{ source: 'band gap', target: '带隙' }], retries: 1, timeoutMs: 3000 });
    const paper = new Zotero.Item('journalArticle'); paper.setField('title', 'PaperLoom runtime test: band gap');
    paper.setField('abstractNote', 'The measured band gap is 2.3 eV. We use density functional theory.'); await paper.saveTx();
    const pdf = await Zotero.Attachments.importFromFile({ file: RUNTIME_ROOT + '/sample.pdf', parentItemID: paper.id, contentType: 'application/pdf', title: 'Runtime test PDF' });
    const job = await app.loadAttachment(pdf.id);
    check('pdf-worker-extracts-real-pdf', job.segments.some(s => s.source.includes('band gap')));
    check('pdf-page-metadata', job.segments.some(s => s.page === 2));
    await app.start(job.id, { consent: false });
    check('translation-completes', job.status === 'done');
    check('glossary-survives-provider', job.segments.some(s => s.target.includes('带隙')));
    const cached = await app.translate(job.segments[0].source, job.config);
    check('cache-hit', cached.cached === true);
    const note = await app.exportNote(job.id);
    check('bilingual-note-saved', note.id && note.parentID === paper.id && note.getNote().includes('AI 译文'));
    check('endpoint-scoped-key-identifiers', app.credentialName('provider', job.config) !== app.credentialName('provider', { ...job.config, endpoint: 'https://example.org/v1' }));
    // A disposable test credential in an isolated profile proves the login-manager adapter only.
    await app.setSecret('provider', 'runtime-test-not-a-real-key');
    check('credential-roundtrip', await app.secret() === 'runtime-test-not-a-real-key');
    await app.setSecret('provider', ''); check('credential-removal', await app.secret() === '');
    const win = app.open();
    await new Promise(resolve => setTimeout(resolve, 1600));
    check('workbench-loaded', !!win.PaperLoomUI);
    check('workbench-title', win.document.getElementById('job-title')?.textContent.includes('PaperLoom runtime test'));
    check('reader-toolbar-api', !!app.readerToolbar);
    check('tools-menu-registered', !!Zotero.getMainWindow().document.getElementById('paperloom-tools'));
    win.PaperLoomUI.tab('translate');
    report.jobID = job.id; report.passed = true;
  } catch (error) { report.passed = false; report.error = String(error); report.stack = error.stack; }
  await IOUtils.writeUTF8(RUNTIME_ROOT + '/runtime-report.json', JSON.stringify(report, null, 2));
})();
