/* Install development selection handlers only, preserve current records/config; no provider use. */
var PaperLoomDevSelectionPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),sleep=ms=>new Promise(r=>h.setTimeout(r,ms));
 const report={at:new Date().toISOString(),version:app.version,passed:false};
 try{
  const sessions=[...app.inplace];report.before=sessions.map(([r])=>({itemID:r.itemID,stats:app.inplaceStats(r)}));if(sessions.some(([,s])=>!s.paused||s.workers)||app.allRequests.size)throw Error('Pause active work before development binding');
  report.archive='validation/pre-selection-'+Date.now()+'.json';await io.writeUTF8(local(report.archive),JSON.stringify(sessions.map(([r,s])=>({itemID:r.itemID,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:v.edited,pageIndex:v.layout.pageIndex,inkRect:v.layout.inkRect}))})),null,2));
  const scope={Zotero,IOUtils:io,PathUtils:h.PathUtils,Services:h.Services,ChromeUtils:h.ChromeUtils,Components:h.Components,crypto:h.crypto,fetch:h.fetch.bind(h),setTimeout:h.setTimeout.bind(h),clearTimeout:h.clearTimeout.bind(h)};
  for(const name of ['core.js','layout.js','inplace.js','selection.js'])h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/'+name,{target:scope,ignoreCache:true});
  for(const r of [...app.nativeOverlayBindings?.keys()||[]])app.closeNativeOverlayInput(r);
  for(const [,s] of sessions)if(s.selectionSync)throw Error('Selection binding already active; use its cleanup first');
  scope.PaperLoomInPlace.attach(app,scope.PaperLoomCore,scope.PaperLoomLayout);scope.PaperLoomSelection.attach(app);app._selectionDev=scope.PaperLoomSelection;
  for(const [r,s] of sessions){for(const v of s.records.values()){v.block?.el?.remove();v.block=null;}app.bindSelectionSync(s);s.repaint();s.rescan();}
  await sleep(700);report.after=sessions.map(([r,s])=>({itemID:r.itemID,stats:app.inplaceStats(r),bound:!!s.selectionSync}));report.requests=app.allRequests.size;report.passed=report.after.every((a,i)=>a.bound&&a.stats.done===report.before[i].stats.done)&&report.requests===0;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/selection-dev.json'),JSON.stringify(report,null,2));return report;
})();
