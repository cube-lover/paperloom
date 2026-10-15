var chromeHandle;
var appScope;

function install() {}
function uninstall() {}

async function startup({ id, version, rootURI }) {
  let stage='initialization';
  try {
  await Zotero.initializationPromise;
  stage='chrome-registration';
  var aomStartup = Components.classes['@mozilla.org/addons/addon-manager-startup;1']
    .getService(Components.interfaces.amIAddonManagerStartup);
  chromeHandle = aomStartup.registerChrome(Services.io.newURI(rootURI + 'manifest.json'), [
    ['content', 'paperloom', rootURI + 'content/']
  ]);
  stage='scope';
  appScope = { Zotero, Services, ChromeUtils, Components, IOUtils, PathUtils,
    fetch, XMLHttpRequest, TextEncoder, TextDecoder, URL, Blob, crypto,
    setTimeout, clearTimeout, rootURI, pluginID: id, pluginVersion: version };
  stage='modules';
  Services.scriptloader.loadSubScript(rootURI + 'content/core.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/providers.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/icon-data.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/app.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/ai.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/readerview.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/layout.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/inplace.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/reader-progress.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/graphic-ink.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/graphic-evidence.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/graphics.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/ocr-install.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/native-background.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/selection.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/checkpoint.js', appScope);
  Services.scriptloader.loadSubScript(rootURI + 'content/alignment.js', appScope);
  appScope.PaperLoomAI.attach(appScope.PaperLoom, appScope.PaperLoomCore);
  appScope.PaperLoomReader.attach(appScope.PaperLoom, appScope.PaperLoomCore);
  appScope.PaperLoomInPlace.attach(appScope.PaperLoom, appScope.PaperLoomCore, appScope.PaperLoomLayout);
  appScope.PaperLoomGraphics.attach(appScope.PaperLoom, appScope.PaperLoomCore, appScope.PaperLoomLayout);
  appScope.CubeNativeBackground.attach(appScope.PaperLoom, appScope.PaperLoomCore, appScope.PaperLoomLayout);
  appScope.PaperLoomSelection.attach(appScope.PaperLoom);
  appScope.CubeOCRInstall.attach(appScope.PaperLoom, appScope.PaperLoomCore, appScope.PaperLoomLayout);
  appScope.CubeReaderProgress.attach(appScope.PaperLoom);
  appScope.CubeCheckpoint.attach(appScope.PaperLoom);
  appScope.CubeAlignment.attach(appScope.PaperLoom);
  // 快捷键要在启动时挂：插件重载不会重建已打开的阅读器工具栏，
  // 挂在 buildReaderButton 里的那份在这些情况下永远不执行。
  try {
    appScope.PaperLoom.installRegionKeyset();
    appScope.PaperLoom.installRegionKeyHandler();
  } catch (error) { appScope.PaperLoom.logError?.(error); }
  Zotero.PaperLoom = appScope.PaperLoom;
  stage='app-init';
  await Zotero.PaperLoom.init();
  stage='windows';
  for (let win of Zotero.getMainWindows()) Zotero.PaperLoom.addWindow(win);
  stage='dev-channel';
  // The marker exists only in explicit --dev packages, never normal releases.
  try { Services.scriptloader.loadSubScript(rootURI + 'content/dev-build.js', appScope); }
  catch (e) { /* Missing optional marker means ordinary release mode. */ }
  if (appScope.CubeDevelopmentBuild?.enabled === true) {
    try {
      Services.scriptloader.loadSubScript(rootURI + 'content/dev-channel.js', appScope);
      appScope.CubeDevChannel.attach(Zotero.PaperLoom);
      if(appScope.CubeDevelopmentBuild.nativePython)Zotero.PaperLoom.nativeRuntimeOverride={enabled:true,python:appScope.CubeDevelopmentBuild.nativePython};
      await Zotero.PaperLoom.startDevChannel(appScope.CubeDevelopmentBuild);
    } catch(e) { Zotero.PaperLoom.devChannelError='Development channel startup failed'; throw e; }
  }
  } catch(e) {
    // Diagnostic contains source location and stage only, never user config or
    // exception text that might include provider responses or credentials.
    try{const dir=PathUtils.join(Zotero.DataDirectory.dir,'paperloom');await IOUtils.makeDirectory(dir,{ignoreExisting:true});await IOUtils.writeUTF8(PathUtils.join(dir,'startup-diagnostic.json'),JSON.stringify({version,stage,name:e.name,line:e.lineNumber||null,file:String(e.fileName||'').split('/').pop(),at:new Date().toISOString()}));}catch{}
    throw e;
  }
}

function onMainWindowLoad({ window }) { Zotero.PaperLoom?.addWindow(window); }
function onMainWindowUnload({ window }) { Zotero.PaperLoom?.removeWindow(window); }

async function shutdown() {
  // A dev reload may have replaced the original bootstrap instance.
  const current = Zotero.PaperLoom || appScope?.PaperLoom;
  if (current) await current.shutdown();
  delete Zotero.PaperLoom;
  chromeHandle?.destruct();
  chromeHandle = null;
  appScope = null;
}
