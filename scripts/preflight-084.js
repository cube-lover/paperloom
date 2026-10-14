/* Fresh paused-source preflight. No translation, no configuration/credential reads. */
var CubePreflight084Promise=(async()=>{
 const h=Zotero.getMainWindow(),a=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),scope={},report={at:new Date().toISOString(),sessions:[],passed:false};
 try{h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/layout.js',{target:scope,ignoreCache:true});const L=scope.PaperLoomLayout;report.layout=L.VERSION;
 for(const [reader,s] of a.inplace){if(!s.paused||s.workers||a.allRequests.size)throw Error('Pause and settle before preflight');let outline=[];try{outline=await s.pdf.getOutline();}catch{}const pages=[];
 for(let i=0;i<s.pdf.numPages;i++){const d=await s.pdf.getPageData(h.Components.utils.cloneInto({pageIndex:i},s.win)),op=await a.readOperatorGeometry(await s.pdf.getPage(i+1));pages.push(L.parsePage(d,{pageIndex:i,outline,operatorList:op}));}
 const model=L.finalize(pages,s.cfg),norm=t=>t.replace(/\s+/g,' ').trim(),old=[...s.records.values()],eligible=model.blocks.filter(b=>!b.skipReason),missing=old.filter(r=>r.status==='done'&&!eligible.some(b=>b.pageIndex===r.layout.pageIndex&&norm(b.text)===norm(r.text)));
 const removed=missing.map(r=>{const ink=r.layout.inkRect,regions=model.pages[r.layout.pageIndex].protectedRegions.filter(t=>['table','text-table'].includes(t.role)&&L.intersection(ink,t.rect)>L.area(ink)*.25);return {id:r.id,page:r.layout.pageIndex+1,edited:!!r.edited,roles:regions.map(t=>t.role),table:regions.length>0};});
 const collisions=eligible.filter(b=>L.frameConflicts(b.rect,model.pages[b.pageIndex].protectedRegions).length);report.sessions.push({itemID:reader.itemID,oldTotal:old.length,oldDone:old.filter(r=>r.status==='done').length,newTotal:eligible.length,restorableDone:old.filter(r=>r.status==='done').length-missing.length,removed,unexpected:removed.filter(r=>!r.table),collisions:collisions.map(b=>b.id)});
 }
 report.passed=report.sessions.length>0&&report.sessions.every(s=>s.unexpected.length===0&&s.collisions.length===0);report.requests=a.allRequests.size;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await h.IOUtils.writeUTF8(local('validation/preflight-084.json'),JSON.stringify(report,null,2));return report;
})();
