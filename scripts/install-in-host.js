/* Installs the version built from this workspace. Does not read credentials. */
var PaperLoomInstallPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,paths=h.PathUtils;
 const root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom'.replace(/\//g,'\\');
 const report={started:new Date().toISOString(),runtime:Zotero.version};
 try{
  const {version}=JSON.parse(await io.readUTF8(paths.join(root,'package.json')));
  const {AddonManager}=h.ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const inventory=async()=> (await AddonManager.getAllAddons()).filter(a=>a.type==='extension').map(a=>({id:a.id,version:a.version,active:a.isActive}));
  report.beforeAddons=await inventory();
  const existing=await AddonManager.getAddonByID('paperloom@local.research');
  report.before=existing&&{version:existing.version,active:existing.isActive};
  if(!existing||existing.version!==version){
   const install=await AddonManager.getInstallForFile(Zotero.File.pathToFile(paths.join(root,'dist','paperloom-'+version+'.xpi')));
   if(install.addon?.id!=='paperloom@local.research')throw Error('Unexpected addon ID');
   await install.install();
  }
  for(let i=0;i<100&&(Zotero.PaperLoom?.version!==version||Zotero.PaperLoom?.stopped||!Zotero.PaperLoom?.config);i++)await new Promise(r=>h.setTimeout(r,100));
  const addon=await AddonManager.getAddonByID('paperloom@local.research'),app=Zotero.PaperLoom;
  report.addon=addon&&{id:addon.id,version:addon.version,active:addon.isActive};
  report.app=app&&{version:app.version,root:app.runtimeRoot,stopped:app.stopped,layout:typeof app.readOperatorGeometry==='function'};
  report.otherAddons=await inventory();
  report.othersUnchanged=report.beforeAddons.filter(a=>a.id!=='paperloom@local.research').every(a=>report.otherAddons.some(b=>JSON.stringify(a)===JSON.stringify(b)));
  report.toolsMenu=!!h.document.getElementById('paperloom-tools');
  report.passed=!!(report.addon?.active&&report.addon.version===version&&report.app?.version===version&&report.app.layout&&!report.app.stopped&&!report.app.root.startsWith('file:')&&report.othersUnchanged&&report.toolsMenu);
 }catch(e){report.passed=false;report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(paths.join(root,'validation','install-host-report.json'),JSON.stringify(report,null,2));
 return {passed:report.passed,version:report.app?.version};
})();
