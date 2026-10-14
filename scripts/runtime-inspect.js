/* Read-only runtime inventory; deliberately excludes prefs, keys and error payloads. */
var PaperLoomInspectPromise = (async () => {
  const host = Zotero.getMainWindow();
  const report = { version: Zotero.version, dataDirectory: Zotero.DataDirectory.dir,
    paperloom: !!Zotero.PaperLoom, safeMode: host.Services.appinfo.inSafeMode,
    profile: host.Services.dirsvc.get('ProfD', host.Components.interfaces.nsIFile).path,
    globals: {}, readers: [] };
  for (const key of ['Services', 'ChromeUtils', 'Components', 'IOUtils', 'PathUtils', 'fetch', 'XMLHttpRequest', 'TextEncoder', 'TextDecoder', 'URL', 'Blob', 'crypto', 'setTimeout', 'clearTimeout']) report.globals[key] = typeof host[key];
  const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  report.addons = (await AddonManager.getAllAddons()).filter(a => a.type === 'extension').map(a => ({ id: a.id, name: a.name, version: a.version, active: a.isActive }));
  for (const r of Zotero.Reader._readers) report.readers.push({ itemID: r.itemID, ready: !!r._internalReader, title: r._title });
  const s = new Zotero.Search(); s.addCondition('title', 'contains', 'Methodology and applications of city');
  report.paperIDs = await s.search();
  report.attachments = [];
  for (const id of report.paperIDs) {
    const item = await Zotero.Items.getAsync(id);
    if (item.isRegularItem()) for (const aid of item.getAttachments()) {
      const a = await Zotero.Items.getAsync(aid);
      report.attachments.push({ id: aid, type: a.attachmentContentType });
    }
  }
  return report;
})().catch(e => ({error: e.name + ': ' + e.message, stack: e.stack}));
