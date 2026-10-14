const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHarness } = require('./harness.cjs');
const waitUntil = async fn => { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 3)); } throw new Error('Condition timed out'); };

test('application initializes data files and custom columns', async t => {
  const { app, state } = await createHarness(t);
  assert.equal(state.columns.size, 3); assert.ok(await fs.stat(path.join(app.dir, 'jobs.json')));
});
test('no network before affirmative consent', async t => {
  const { app, state } = await createHarness(t); state.confirm = false;
  const job = await app.createJob('A paper paragraph.'); await app.start(job.id);
  assert.equal(state.requests.length, 0); assert.equal(job.status, 'queued');
});
test('translation, glossary restoration, persistent segments and cache hit', async t => {
  const { app, state } = await createHarness(t, { config: { glossary: [{ source: 'band gap', target: '带隙' }] } });
  const job = await app.createJob('The band gap is 2.3 eV.\n\nSee [1].'); await app.start(job.id);
  assert.equal(job.status, 'done'); assert.match(job.segments[0].target, /带隙/);
  assert.equal(state.requests.length, 2);
  const again = await app.translate(job.segments[0].source, job.config); assert.equal(again.cached, true); assert.equal(state.requests.length, 2);
  assert.equal(JSON.parse(await fs.readFile(path.join(app.dir, 'jobs.json'), 'utf8'))[0].status, 'done');
});
test('key storage is scoped by endpoint and never included in config or job export', async t => {
  const { app, state, prefs } = await createHarness(t);
  await app.setSecret('provider', 'test-value-only'); assert.equal(await app.secret(), 'test-value-only');
  const old = app.config;
  await app.saveConfig({ ...old, endpoint: 'http://127.0.0.1:18001/v1', apiKey: 'accidental-secret' });
  assert.equal(await app.secret(), ''); assert.equal(await app.secret('provider', old), 'test-value-only');
  const job = await app.createJob('Document');
  assert.ok(!JSON.stringify(job).includes('accidental-secret'));
  assert.ok(![...prefs.values()].join().includes('test-value-only')); assert.equal(state.logins.length, 1);
});
test('historical task sends only its endpoint-specific test credential', async t => {
  const { app, state } = await createHarness(t);
  await app.setSecret('provider', 'old-test-value'); const job = await app.createJob('Old task');
  await app.saveConfig({ ...app.config, endpoint: 'http://127.0.0.1:18001/v1' }); await app.setSecret('provider', 'new-test-value');
  await app.start(job.id);
  assert.equal(state.requests[0].headers.Authorization, 'Bearer old-test-value');
  assert.ok(state.requests[0].url.includes(':18000/'));
});
test('pause aborts in-flight XHR, then resume completes without stuck active lock', async t => {
  const { app, state } = await createHarness(t); state.response = () => ({ pending: true });
  const job = await app.createJob('Cancel me'); const running = app.start(job.id);
  await waitUntil(() => state.requests.length === 1); app.pause(job.id); await running;
  assert.equal(state.aborted, 1); assert.equal(job.status, 'paused'); assert.equal(job.segments[0].status, 'pending'); assert.equal(app.active.size, 0);
  state.response = null; await app.start(job.id); assert.equal(job.status, 'done');
});
test('401 is not retried and partial jobs can resume later', async t => {
  const { app, state } = await createHarness(t); state.response = () => ({ status: 401, body: { error: 'private-body-must-not-be-logged' } });
  const job = await app.createJob('Text'); await app.start(job.id);
  assert.equal(state.requests.length, 1); assert.equal(job.status, 'partial'); assert.ok(!job.segments[0].error.includes('private-body'));
  state.response = null; await app.start(job.id); assert.equal(job.status, 'done');
});
test('429 retries only to configured limit and succeeds', async t => {
  const { app, state } = await createHarness(t);
  state.response = () => state.requests.length === 1 ? { status: 429, body: {} } : { status: 200, body: { choices: [{ message: { content: 'Translated' }, finish_reason: 'stop' }] } };
  const job = await app.createJob('Text'); await app.start(job.id);
  assert.equal(state.requests.length, 2); assert.equal(job.status, 'done');
});
test('missing math placeholder fails visibly instead of writing damaged translation', async t => {
  const { app, state } = await createHarness(t); state.response = () => ({ body: { choices: [{ message: { content: 'Some incomplete translation' } }] } });
  const job = await app.createJob('The equation is $x=1$.'); await app.start(job.id);
  assert.equal(job.status, 'partial'); assert.equal(job.segments[0].target, ''); assert.match(job.segments[0].error, /保护标记/);
});
test('disk-write failure does not strand task in active map', async t => {
  const { app, IOUtils } = await createHarness(t); const job = await app.createJob('Text');
  IOUtils.writeUTF8 = async () => { throw new Error('disk full'); };
  await assert.rejects(app.start(job.id), /disk full/); assert.equal(app.active.size, 0);
});
test('invalid primary job file restores validated backup and preserves corrupt bytes', async t => {
  const { app, C } = await createHarness(t); await app.createJob('First job'); await app.createJob('Second job');
  await fs.writeFile(path.join(app.dir, 'jobs.json'), '{broken');
  const jobs = await app.readJSON('jobs.json', [], C.recoverJobs);
  assert.equal(jobs.length, 1); assert.ok((await fs.readdir(app.dir)).some(p => p.startsWith('jobs.json.corrupt-'))); assert.equal(app.notices.length, 1);
});
test('manual correction retains prior text and no API calls; clone keeps original', async t => {
  const { app, state } = await createHarness(t); const job = await app.createJob('The value is 2.3 eV.');
  await app.editTranslation(job.id, 's1', '数值为 2.3 eV。', true);
  assert.equal(job.status, 'done'); assert.equal(job.segments[0].manual, true); assert.equal(job.segments[0].reviewed, true); assert.equal(state.requests.length, 0);
  await app.saveConfig({ ...app.config, targetLang: 'English' }); const clone = await app.cloneWithCurrentConfig(job.id);
  assert.equal(clone.config.targetLang, 'English'); assert.equal(job.config.targetLang, '简体中文'); assert.notEqual(job.id, clone.id);
});
test('note export escapes model markup and retains parent item', async t => {
  const { app } = await createHarness(t); const job = await app.createJob('Source', { parentID: 42 });
  await app.editTranslation(job.id, 's1', '<script>bad()</script>');
  const note = await app.exportNote(job.id); assert.ok(!note.getNote().includes('<script>')); assert.match(note.getNote(), /&lt;script&gt;/);
});
test('named FilePicker export is compatible with inspected Zotero 9 API', async t => {
  const { app, state, dir } = await createHarness(t); state.pickerPath = path.join(dir, 'export.md');
  await app.saveFile('export.md', '你好'); assert.equal(await fs.readFile(state.pickerPath, 'utf8'), '你好');
  const file = await app.readFile(); assert.equal(file.text, '你好');
});
test('request registration cleaned up when XHR.send throws synchronously', async t => {
  const { app, state } = await createHarness(t); state.throwSend = true;
  await assert.rejects(app.request('http://127.0.0.1/test', { body: {} })); assert.equal(app.allRequests.size, 0);
});
test('schema-invalid or redirected HTTP responses fail explicitly', async t => {
  const { app, state } = await createHarness(t); state.response = () => ({ raw: 'not-json' });
  await assert.rejects(app.request('http://127.0.0.1/test', { body: {} }), /JSON/);
  state.response = () => ({ url: 'https://example.org/final', body: {} });
  await assert.rejects(app.request('http://127.0.0.1/test', { body: {} }), /跨站/);
});
test('chapter summary produces a persisted note and repeat uses cache', async t => {
  const { app, state } = await createHarness(t);
  const job = await app.createJob('# Methods\n\nA reproducible method.\n\n# Results\n\nValue is 2.3.');
  const out = await app.summarize(job.id, 'outline'); assert.match(out, /Methods/); assert.match(out, /Results/); assert.equal(state.notes.length, 1);
  const count = state.requests.length; await app.summarize(job.id, 'outline'); assert.equal(state.requests.length, count);
  assert.ok(job.lastSummary.noteID); assert.match(state.notes[0].note, /原文证据索引/);
});
test('AI summary cancellation resets busy state and does not save partial note', async t => {
  const { app, state } = await createHarness(t); state.response = () => ({ pending: true });
  const job = await app.createJob('Source paragraph'); const pending = app.summarize(job.id);
  await waitUntil(() => state.requests.length === 1); app.pause(); await assert.rejects(pending, /暂停/);
  assert.equal(app.aiBusy, false); assert.equal(state.notes.length, 0);
});
test('fulltext AI columns cover all body segments and retain evidence scope', async t => {
  const { app, state, Zotero } = await createHarness(t, { config: { columnSource: 'fulltext', columns: [{ id: 'method', name: 'Method', prompt: 'Describe method', enabled: true }] } });
  const paper = new Zotero.Item('journalArticle'); paper.setField('title', 'Sample'); await paper.saveTx();
  const job = await app.createJob('First section\n\nSecond section', { parentID: paper.id });
  await app.generateColumns(job.id);
  const value = app.columnValues[`1/${paper.key}/method`]; assert.equal(value.evidence, 'fulltext'); assert.equal(value.sourceSegments.length, 2); assert.equal(state.requests.length, 3);
});
test('visible-column filtering excludes hidden custom columns', async t => {
  const { app, Zotero } = await createHarness(t, { config: { visibleColumnsOnly: true } });
  Zotero.getMainWindow().ZoteroPane.itemsView._getColumns = () => [{ dataKey: app.columnKeyMap.get('method'), hidden: false }, { dataKey: app.columnKeyMap.get('finding'), hidden: true }];
  assert.equal(app.enabledColumns().length, 1); assert.equal(app.enabledColumns()[0].id, 'method');
});
test('shutdown aborts all request classes including standalone requests', async t => {
  const { app, state } = await createHarness(t); state.response = () => ({ pending: true });
  const request = app.request('http://127.0.0.1/test', { body: {} });
  const rejected = assert.rejects(request, /暂停/); await app.shutdown(); await rejected; assert.equal(state.aborted, 1);
});

test('concurrent duplicate paragraphs share one API request and cache write', async t => {
  const { app, state } = await createHarness(t, { config: { context: false } });
  const job = await app.createJob('Repeated paragraph\n\nRepeated paragraph\n\nRepeated paragraph');
  await app.start(job.id); assert.equal(job.status, 'done'); assert.equal(state.requests.length, 1); assert.equal(app.translations.size, 0);
});

test('credential update failure preserves the previously saved value', async t => {
  const { app, state } = await createHarness(t);
  await app.setSecret('provider', 'old-fixture'); state.failCredentialUpdate = true;
  await assert.rejects(app.setSecret('provider', 'new-fixture'), /storage failed/);
  assert.equal(await app.secret(), 'old-fixture');
});
