/* Read latest paused session; compute candidate layout without altering records or calling a provider. */
var PaperLoomPreflightPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),scope={};
 h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/layout.js',{target:scope,ignoreCache:true});const L=scope.PaperLoomLayout,report={at:new Date().toISOString(),layout:L.VERSION,sessions:[],passed:false};
 try{
  for(const [reader,s] of app.inplace){if(!s.paused||s.workers||app.allRequests.size)throw Error('Pause and settle before preflight');const pages=[],outline=await s.pdf.getOutline().catch(()=>[]);
   for(let pageIndex=0;pageIndex<s.pdf.numPages;pageIndex++){
    const data=await s.pdf.getPageData(h.Components.utils.cloneInto({pageIndex},s.win)),ops=await app.readOperatorGeometry(await s.pdf.getPage(pageIndex+1));pages.push(L.parsePage(data,{pageIndex,operatorList:ops,outline}));
   }
   const model=L.finalize(pages),normalize=t=>t.replace(/\s+/g,' ').trim(),old=[...s.records.values()],eligible=model.blocks.filter(b=>!b.skipReason);
   const missing=old.filter(r=>r.status==='done'&&!eligible.some(b=>b.pageIndex===r.layout.pageIndex&&normalize(b.text)===normalize(r.text)));
   const removed=missing.map(r=>({id:r.id,page:r.layout.pageIndex+1,edited:!!r.edited,source:r.text.slice(0,120),table:!!r.protectedTable||model.pages[r.layout.pageIndex].protectedRegions?.some(t=>t.role==='table'&&L.intersection(r.layout.inkRect,t.rect)>L.area(r.layout.inkRect)*.25)}));
   report.sessions.push({itemID:reader.itemID,oldTotal:old.length,oldDone:old.filter(r=>r.status==='done').length,newTotal:eligible.length,restorableDone:old.filter(r=>r.status==='done').length-missing.length,removed,unexpected:removed.filter(r=>!r.table)});
  }
  report.passed=report.sessions.length>0&&report.sessions.every(s=>s.unexpected.length===0);report.requests=app.allRequests.size;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/preflight-080.json'),JSON.stringify(report,null,2));return report;
})();
