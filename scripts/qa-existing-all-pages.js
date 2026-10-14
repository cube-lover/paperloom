/* Inspect the complete EXISTING session without modifying any translation or calling a provider. */
var PaperLoomExistingQAPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,io=h.IOUtils;
 const root='D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\validation\\layout-source-audit\\';
 const itemID=typeof PaperLoomQAItemID==='number'?PaperLoomQAItemID:381;
 const report={at:new Date().toISOString(),itemID,version:app?.version,pid:h.Services.appinfo.processID,kind:'Existing translations, no provider, no session replacement',pages:[],passed:false};
 const save=()=>io.writeUTF8(root+'existing-'+itemID+'-all-pages.json',JSON.stringify(report,null,2));
 const sleep=ms=>new Promise(res=>h.setTimeout(res,ms));
 let s,primary,sync;
 try{
  const r=Zotero.Reader._readers.find(r=>r.itemID===itemID);s=app.inplace.get(r);report.initial=app.inplaceStats(r);report.readers=Zotero.Reader._readers.map(v=>({itemID:v.itemID,hasSession:app.inplace.has(v)}));report.sessions=[...app.inplace].map(([v,x])=>({itemID:v.itemID,stats:app.inplaceStats(v)}));
  if(!app.runtimeRoot.startsWith('jar:')||app.allRequests.size||!s||s.workers||s.queue.length||report.initial.done!==report.initial.total)throw Error('Expected idle complete installed session');
  await io.writeUTF8(root+'existing-'+itemID+'-records-'+Date.now()+'.json',JSON.stringify([...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited})),null,2));
  report.root=app.runtimeRoot;primary=r._internalReader._primaryView._iframeWindow;sync=s.syncEnabled;s.syncEnabled=false;
  if(s.hidden)app.toggleInPlace(r);
  const fingerprint=()=>JSON.stringify([...s.records.values()].map(v=>[v.id,v.text,v.target,v.status,v.edited]));const before=fingerprint();
  const measure=page=>[...s.records.values()].filter(v=>v.layout.pageIndex===page-1).map(v=>{
   const box=v.block?.el,body=box?.firstChild;
   return {id:v.id,role:v.layout.role,status:v.status,mounted:!!box?.isConnected,overflow:box?.dataset.overflow,font:body?.style.fontSize,baseFont:v.layout.typography.fontSize,textLength:v.target?.length,measurement:box?.isConnected?app.measureInPlaceText(box,body):null};
  });
  for(let page=1;page<=s.layout.pages.length;page++){
   for(const w of [primary,s.win]){const v=w.PDFViewerApplication.pdfViewer;v.pagesRotation=0;v.currentScaleValue='page-width';v.currentPageNumber=page;}
   await sleep(600);s.rescan();await sleep(400);
   const p=s.layout.pages[page-1],overlaps=[];
   for(const b of p.blocks.filter(b=>!b.skipReason))for(const o of p.blocks){if(o===b)continue;const a=b.rect,c=o.inkRect||o.rect;const area=Math.max(0,Math.min(a[2],c[2])-Math.max(a[0],c[0]))*Math.max(0,Math.min(a[3],c[3])-Math.max(a[1],c[1]));if(area>.1)overlaps.push([b.id,o.id,area]);}
   const entry={page,overlaps,atWidth:measure(page)};report.pages.push(entry);
   const win=s.win;win.PDFViewerApplication.pdfViewer.currentScaleValue='page-fit';win.PDFViewerApplication.pdfViewer.currentPageNumber=page;
   await sleep(1000);s.rescan();await sleep(450);entry.atFit=measure(page);
   const el=win.document.querySelector('#viewer .page[data-page-number="'+page+'"]');
   entry.capture={scale:win.PDFViewerApplication.pdfViewer.currentScale,overlays:el?.querySelectorAll('.pl-inplace').length,done:el?.querySelectorAll('.pl-inplace[data-state="done"]').length};
   const canvas=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=win.innerWidth;canvas.height=win.innerHeight;
   win.getSelection()?.removeAllRanges();canvas.getContext('2d').drawWindow(win,0,0,win.innerWidth,win.innerHeight,'#fff');
   const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));await io.write(root+'existing-'+itemID+'-page-'+page+'.png',new Uint8Array(await blob.arrayBuffer()));
   await save();
  }
  report.translationsUnchanged=before===fingerprint();report.requests=app.allRequests.size;report.leftOverlays=primary.document.querySelectorAll('.pl-inplace').length;
  report.passed=report.translationsUnchanged&&report.requests===0&&report.leftOverlays===0&&report.pages.every(p=>!p.overlaps.length&&p.capture.done===p.atFit.length&&p.atWidth.concat(p.atFit).every(v=>v.status==='done'&&v.mounted&&v.overflow==='false'&&v.measurement?.fits));
 }catch(e){report.error=e.message;report.stack=e.stack;}
 finally{
  if(s&&primary){s.syncEnabled=sync;for(const w of [primary,s.win]){const v=w.PDFViewerApplication.pdfViewer;v.pagesRotation=0;v.currentScaleValue='page-fit';v.currentPageNumber=1;}await sleep(700);s.rescan();await sleep(300);s.update();}
  await save();
 }
 return {passed:report.passed,pages:report.pages.length,error:report.error};
})();
