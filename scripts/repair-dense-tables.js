/* Suppress misclassified table overlays, archive latest records, never retranslate. */
var PaperLoomTableRepairPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const scope={};h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/layout.js',{target:scope,ignoreCache:true});const L=scope.PaperLoomLayout;
 const report={at:new Date().toISOString(),version:app.version,records:[],passed:false},fixtures=JSON.parse(await io.readUTF8(local('tests/layout-dense-tables.fixture.json'))),plans=[];
 for(const reader of Zotero.Reader._readers){const s=app.inplace?.get(reader);if(!s)continue;
  const before=app.inplaceStats(reader),regions=new Map(fixtures.pages.filter(p=>p.itemID===reader.itemID).map(d=>[d.pageIndex,L.tableStructure(d.chars,L.graphics(d.operatorList,d.viewBox).rules)]));
  const affected=[...s.records.values()].filter(r=>(regions.get(r.layout.pageIndex)||[]).some(t=>L.intersection(r.layout.inkRect||r.layout.rect,t.rect)>L.area(r.layout.inkRect||r.layout.rect)*.25));
  report.records.push(...affected.map(r=>({itemID:reader.itemID,id:r.id,pageIndex:r.layout.pageIndex,source:r.text,target:r.target,status:r.status,edited:r.edited,layout:r.layout})));
  plans.push({reader,s,affected,before});
 }
 report.archive='validation/pre-table-guard-'+Date.now()+'.json';await io.writeUTF8(local(report.archive),JSON.stringify(report,null,2));
 if(!app._tablePaintGuard){const old=app.paintStructuredBlock;app.paintStructuredBlock=function(s,r,page,vp){if(r.protectedTable){r.block?.el?.remove();r.block=null;return null;}return old.call(this,s,r,page,vp);};app._tablePaintGuard=true;}
 report.sessions=[];
 for(const {reader,s,affected,before} of plans){
  for(const r of affected){r.protectedTable=true;r.queued=false;r.block?.el?.remove();r.block=null;s.dirty.delete(r);}
  s.queue=s.queue.filter(r=>!r.protectedTable);
  if(!s._tableQueueGuard){const old=s.enqueue;s.enqueue=r=>{if(!r.protectedTable)return old(r);};s._tableQueueGuard=true;}
  s.update();report.sessions.push({itemID:reader.itemID,protected:affected.length,before,after:app.inplaceStats(reader),primaryGraphics:reader._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-graphic-anchor').length,primaryProse:reader._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-inplace').length,wrongTableOverlays:affected.filter(r=>r.block?.el?.isConnected).length});
 }
 report.requests=app.allRequests.size;report.passed=report.sessions.every(s=>s.wrongTableOverlays===0&&s.primaryGraphics===0&&s.primaryProse===0&&s.before.done===s.after.done&&s.before.paused===s.after.paused);
 await io.writeUTF8(local('validation/table-live-repair.json'),JSON.stringify(report,null,2));return {passed:report.passed,sessions:report.sessions,archive:report.archive};
})();
