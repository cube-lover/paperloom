/* Read-only current in-place content/geometry audit. No config or credential access. */
var PaperLoomLiveAuditPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom;
 const report={at:new Date().toISOString(),version:app?.version,root:app?.runtimeRoot,sessions:[]};
 for(const [reader,s] of app.inplace||[]){
  report.sessions.push({itemID:reader.itemID,stats:app.inplaceStats(reader),fontScale:s.fontScale,graphicsErrors:s.graphicsErrors||[],layout:s.layout,
   records:[...s.records.values()].map(r=>({id:r.id,text:r.text,target:r.target,status:r.status,overflow:r.block?.el.dataset.overflow,frame:r.block?.el.style.cssText,body:r.block?.el.firstChild.style.cssText,measurement:r.block?.el.dataset}))});
 }
 await h.IOUtils.writeUTF8('D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\validation\\layout-source-audit\\live-layout.json',JSON.stringify(report,null,2));
 return {version:report.version,sessions:report.sessions.map(s=>({itemID:s.itemID,stats:s.stats}))};
})();
