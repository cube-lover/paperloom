/* Passive diagnostics only: no session replacement, provider calls or credential reads. */
var PaperLoomClickDiagPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 if(!app||app.stopped)throw Error('Plugin not ready');app._clickProbe?.cleanup();
 const report={at:new Date().toISOString(),version:app.version,pid:h.Services.appinfo.processID,readers:[],events:[]};
 const path=(root+'validation/single-click-075.json').replace(/\//g,'\\'),cleanup=[];
 const write=()=>h.IOUtils.writeUTF8(path,JSON.stringify(report,null,2));
 const label=el=>el?{tag:el.tagName,id:el.id,className:typeof el.className==='string'?el.className:''}:null;
 for(const r of Zotero.Reader._readers){
  const doc=r._iframeWindow?.document;if(!doc)continue;
  const buttons=[...doc.querySelectorAll('.pl-main-button')],s=app.inplace?.get(r);
  const row={itemID:r.itemID,stats:app.inplaceStats(r),requests:app.allRequests.size,buttons:[]};report.readers.push(row);
  for(const b of buttons){const v=b.getBoundingClientRect();row.buttons.push({label:b.textContent,state:b.dataset.state,rect:[v.x,v.y,v.width,v.height],hit:label(doc.elementFromPoint(v.x+v.width/2,v.y+v.height/2)),pointerEvents:doc.defaultView.getComputedStyle(b).pointerEvents});}
  const sample=(e,phase)=>{if(report.events.length>=100)return;const near=e.target?.closest?.('.pl-reader-action,.pl-reader-menu,.pl-inplace-controls');if(!near)return;
   report.events.push({at:Date.now(),itemID:r.itemID,phase,type:e.type,trusted:e.isTrusted,detail:e.detail,button:e.button,target:label(e.target),defaultPrevented:e.defaultPrevented,state:buttons[0]?.dataset.state,hidden:s?.hidden,paused:s?.paused,queue:s?.queue.length,workers:s?.workers,requests:app.allRequests.size});write().catch(Zotero.logError);
  };
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','click','dblclick'])for(const capture of [true,false]){
   const fn=e=>sample(e,capture?'capture':'bubble');doc.addEventListener(type,fn,capture);cleanup.push(()=>doc.removeEventListener(type,fn,capture));
  }
 }
 app._clickProbe={cleanup:()=>{for(const fn of cleanup.splice(0))try{fn();}catch{}}};
 h.setTimeout(()=>app._clickProbe?.cleanup(),300000);
 await write();return {armed:true,version:report.version,readers:report.readers};
})();
