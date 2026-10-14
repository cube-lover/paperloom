/* Run via loadSubScriptWithOptions(..., {target:{Zotero}, ignoreCache:true}).
   Exposes PaperLoomReloadPromise so Run JavaScript can await actual completion. */
var PaperLoomReloadPromise = (async () => {
  const DEV = 'file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/addon/';
  const PLUGIN_ID = 'paperloom@local.research';
  const host = Zotero.getMainWindow();
  const io = host.IOUtils, paths = host.PathUtils, services = host.Services;
  const dir = paths.join(Zotero.DataDirectory.dir, 'paperloom');
  const status = paths.join(dir, 'dev-reload.txt');
  const log = [];
  const step = async m => {
    log.push(m);
    await io.writeUTF8(status, new Date().toISOString() + '\n' + log.join('\n'));
  };
  try {
    await io.makeDirectory(dir, {ignoreExisting:true});
    await step('start');
    // Compile/load before tearing down the old instance, so a parse error is harmless.
    const scope = {Zotero, rootURI:DEV, pluginID:PLUGIN_ID, pluginVersion:'dev'};
    for (const name of ['Services','ChromeUtils','Components','IOUtils','PathUtils','fetch',
      'XMLHttpRequest','TextEncoder','TextDecoder','URL','Blob','crypto','setTimeout','clearTimeout']) {
      scope[name] = ['setTimeout','clearTimeout','fetch'].includes(name) ? host[name].bind(host) : host[name];
    }
    for (const f of ['core.js','providers.js','app.js','ai.js','readerview.js','layout.js','inplace.js']) {
      services.scriptloader.loadSubScriptWithOptions(DEV + 'content/' + f, {target:scope, ignoreCache:true});
      await step('loaded ' + f);
    }
    scope.PaperLoomAI.attach(scope.PaperLoom, scope.PaperLoomCore);
    scope.PaperLoomReader.attach(scope.PaperLoom, scope.PaperLoomCore);
    scope.PaperLoomInPlace.attach(scope.PaperLoom, scope.PaperLoomCore, scope.PaperLoomLayout);
    await step('attached');
    if (Zotero.PaperLoom) await Zotero.PaperLoom.shutdown();
    Zotero.Reader._unregisterEventListenerByPluginID?.(PLUGIN_ID);
    // Do not unregister other plugins or modify their preferences.
    Zotero.PreferencePanes?.unregister?.('paperloom-preferences');
    for (const r of Zotero.Reader._readers || []) {
      for (const w of [r._iframeWindow, r._internalReader?._primaryView?._iframeWindow,
        r._internalReader?._secondaryView?._iframeWindow]) {
        const d = w?.document;
        d?.getElementById('paperloom-reader-panel')?.remove();
        for (const el of d?.querySelectorAll('.pl-inplace') || []) el.remove();
        for (const sec of d?.querySelectorAll('.toolbar .end .section') || []) {
          if (/译研/.test(sec.textContent || '')) sec.remove();
        }
      }
    }
    await step('teardown done');
    Zotero.PaperLoom = scope.PaperLoom;
    await Zotero.PaperLoom.init();
    await step('init done');
    for (const win of Zotero.getMainWindows()) Zotero.PaperLoom.addWindow(win);
    let injected = 0;
    for (const r of Zotero.Reader._readers || []) {
      const d = r._iframeWindow?.document, end = d?.querySelector('.toolbar .end');
      if (!end || [...end.querySelectorAll('.section')].some(s => /译研/.test(s.textContent || ''))) continue;
      Zotero.PaperLoom.buildReaderButton(d, r, el => {
        const sec = d.createElement('div'); sec.className = 'section'; sec.appendChild(el); end.appendChild(sec);
      });
      injected++;
    }
    await step('DONE reloaded dev; readers=' + (Zotero.Reader._readers?.length || 0) + ' injected=' + injected);
    return {ok:true, status};
  } catch (e) {
    // Startup errors contain module locations, not provider responses or credentials.
    await step('FATAL: ' + e.name + ': ' + e.message + '\n' + (e.stack || ''));
    return {ok:false, status};
  }
})();
