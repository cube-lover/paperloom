/* Reflow existing completed translations only; no provider calls. Keeps original records archived. */
var PaperLoomLiveReflowPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,r=Zotero.Reader._readers.find(r=>r.itemID===381),s=app.inplace.get(r);
 if(!s||s.workers||!s.paused)throw Error('Expected idle paused session');
 const root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',scope={};
 for(const name of ['core','layout','inplace'])h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/'+name+'.js',{target:scope,ignoreCache:true});
 const L=scope.PaperLoomLayout,tmp={};scope.PaperLoomInPlace.attach(tmp,scope.PaperLoomCore,L);
 for(const name of ['paintStructuredBlock','fitInPlaceText','measureInPlaceText'])app[name]=tmp[name];
 const d=JSON.parse(await h.IOUtils.readUTF8((root+'.local/live-page-data.json').replace(/\//g,'\\')));
 const model=L.finalize(d.pages.map((p,i)=>L.parsePage(p,{outline:d.outline,operatorList:d.operators[i]})),s.cfg);
 s.qaArchive=[...s.records.values()];s.layout=model;s.fontScale=1;
 const next=new Map();for(const b of model.blocks.filter(b=>!b.skipReason)){
  const old=s.records.get(b.id)||s.qaArchive.find(r=>r.text===b.text);if(old){old.layout=b;old.id=b.id;old.mount=null;if(old.block){old.block.el.remove();old.block=null;}next.set(b.id,old);}
  else next.set(b.id,{id:b.id,layout:b,text:b.text,target:'',status:'pending',queued:false});
 }
 for(const old of s.qaArchive)old.block?.el?.remove();s.records=next;s.queue=s.queue.filter(r=>next.get(r.id)===r);s.syncEnabled=false;
 const report={kind:'existing-user-session-reflow-no-network',pages:[]};
 for(let index=0;index<6;index++){
  s.win.PDFViewerApplication.pdfViewer.currentPageNumber=index+1;await new Promise(res=>h.setTimeout(res,350));s.rescan();await new Promise(res=>h.setTimeout(res,200));
  const metrics=[...s.records.values()].filter(r=>r.layout.pageIndex===index&&r.status==='done').map(r=>({id:r.id,overflow:r.block?.el.dataset.overflow,font:r.block?.el.firstChild.style.fontSize,frame:r.block?.el.clientHeight,natural:r.block?.el.firstChild.scrollHeight}));
  report.pages.push({page:index+1,metrics});
  const win=s.win,canvas=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=win.innerWidth;canvas.height=win.innerHeight;
  canvas.getContext('2d').drawWindow(win,0,0,win.innerWidth,win.innerHeight,'#fff');const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
  await h.IOUtils.write((root+'validation/layout-source-audit/live-fixed-page-'+(index+1)+'.png').replace(/\//g,'\\'),new Uint8Array(await blob.arrayBuffer()));
 }
 for(const v of [r._internalReader._primaryView,r._internalReader._secondaryView])v._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber=2;
 s.syncEnabled=true;s.update();report.passed=report.pages.every(p=>p.metrics.every(m=>m.overflow==='false'));
 await h.IOUtils.writeUTF8((root+'validation/layout-source-audit/live-host-reflow.json').replace(/\//g,'\\'),JSON.stringify(report,null,2));return {passed:report.passed};
})();
