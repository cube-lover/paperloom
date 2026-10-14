/* Installed-release verification via the current replay suite, never a dev reload. */
var PaperLoomInstalledQAPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 const local=p=>(root+p).replace(/\//g,'\\'),report={at:new Date().toISOString(),host:Zotero.version,pid:h.Services.appinfo.processID};
 try{
  const expected=JSON.parse(await io.readUTF8(local('package.json'))).version;
  const app=Zotero.PaperLoom,{AddonManager}=h.ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const addon=await AddonManager.getAddonByID('paperloom@local.research');
  report.runtime={version:app?.version,root:app?.runtimeRoot,addonVersion:addon?.version,active:addon?.isActive,stopped:app?.stopped};
  if(app?.version!==expected||addon?.version!==expected||!addon?.isActive||!app.runtimeRoot.startsWith('jar:')||app.stopped)throw Error('Expected installed '+expected+' runtime');
  if(app.allRequests.size||[...app.inplace.values()].some(s=>s.workers||s.stage==='parsing'))throw Error('Active session: wait before QA replay');
  const scope={Zotero};h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'scripts/qa-release.js',{target:scope,ignoreCache:true});
  report.replay=await scope.PaperLoomReleaseQAPromise;
  report.fixtureKind='Existing translations plus manual fixtures; no provider requests. Sessions archived by qa-release.js.';
  report.passed=report.replay.passed;
 }catch(e){report.passed=false;report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/layout-source-audit/installed-after-restart.json'),JSON.stringify(report,null,2));
 return {passed:report.passed,version:report.runtime?.version};
})();
