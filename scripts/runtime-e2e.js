(async () => {
  const root = 'D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom';
  const app = Zotero.PaperLoom, C = PaperLoomCore;
  const report = { started: new Date().toISOString(), checks: [] };
  const check = (name, value, detail) => report.checks.push({ name, passed: !!value, detail });
  const savedConfig = Zotero.Prefs.get('extensions.zotero.paperloom.config', true);
  try {
    await app.saveConfig({ ...app.config, provider: 'openai', endpoint: 'http://127.0.0.1:18767/v1',
      model: 'mock-academic', requestsPerMinute: 600, retries: 1, timeoutMs: 5000,
      glossary: [{ source: 'band gap', target: '带隙', caseSensitive: false }] });
    await app.setSecret('provider', 'runtime-test-not-a-real-key');
    const sample = 'Introduction\n\nThe measured band gap is 2.3 eV in this study.\n\nMethods: We use density functional theory to compute the band gap.';
    const job = await app.createJob(sample, { title: 'PaperLoom 运行时自检：band gap' });
    check('job-created', job.segments.length > 0, job.segments.length);
    await app.start(job.id, { consent: false });
    check('translation-done', job.status === 'done', job.status);
    check('model-text-returned', job.segments.every(s => s.target && s.target.includes('模拟译文')));
    check('glossary-applied', job.segments.some(s => s.target.includes('带隙')));
    const first = job.segments[0].source;
    const cached = await app.translate(first, job.config, '');
    check('cache-hit', cached.cached === true);
    // Clean up: remove the in-memory/persisted test job so the user's data stays clean.
    app.jobs = app.jobs.filter(j => j.id !== job.id);
    await app.persist();
    await app.setSecret('provider', '');
    check('secret-removed', (await app.secret('provider')) === '');
    report.passed = report.checks.every(c => c.passed);
  } catch (e) { report.passed = false; report.error = String(e); report.stack = e.stack; }
  finally {
    if (savedConfig) Zotero.Prefs.set('extensions.zotero.paperloom.config', savedConfig, true);
    else Zotero.Prefs.clear('extensions.zotero.paperloom.config', true);
    app.config = C.validateConfig(JSON.parse(Zotero.Prefs.get('extensions.zotero.paperloom.config', true) || '{}'));
    await app.registerColumns();
  }
  await IOUtils.writeUTF8(root + '\\validation\\runtime-e2e-report.json', JSON.stringify(report, null, 2));
  return JSON.stringify(report, null, 2);
})();
