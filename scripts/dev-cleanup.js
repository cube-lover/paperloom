/* Leave only the real dev plugin active; remove test overlays and verify other addons. */
var PaperLoomCleanupPromise=(async()=>{
  const h=Zotero.getMainWindow(), app=Zotero.PaperLoom;
  for(const reader of app?.inplace?.keys()||[])app.clearInPlace(reader);
  delete Zotero.PaperLoomDevHoldPreview;
  const {AddonManager}=h.ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const addons=(await AddonManager.getAllAddons()).filter(a=>a.type==='extension').map(a=>({id:a.id,version:a.version,active:a.isActive}));
  const report={paperloomLoaded:!!app,activeSessions:app?.inplace?.size||0,activeRequests:app?.allRequests?.size||0,addons};
  await h.IOUtils.writeUTF8(h.PathUtils.join('D:','Users','Administrator','Pi-Agent','home','pi-cwd-20260926','paperloom','validation','post-inplace-host.json'),JSON.stringify(report,null,2));
  return report;
})();
