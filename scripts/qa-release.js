/* Runs only recorded/manual translations against the installed release. No credentials/provider. */
var PaperLoomReleaseQAPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 const local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),host:Zotero.version,pid:h.Services.appinfo.processID,checks:[],papers:[]};
 const save=()=>io.writeUTF8(local('validation/layout-source-audit/release-host.json'),JSON.stringify(report,null,2));
 try{
  const app=Zotero.PaperLoom,version=JSON.parse(await io.readUTF8(local('package.json'))).version;
  report.runtime={version:app?.version,root:app?.runtimeRoot};
  if(app?.version!==version||!app.runtimeRoot.startsWith('jar:')||app.stopped)throw Error('Expected installed release');
  if(app.allRequests.size||[...app.inplace.values()].some(s=>s.workers||s.stage==='parsing'))throw Error('Active session: wait before QA replay');
  // Preserve all existing content before replacing a QA target session, with no config secrets.
  const archived=[];for(const [r,s] of app.inplace||[])archived.push({itemID:r.itemID,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited}))});
  if(archived.length)await io.writeUTF8(local('validation/layout-source-audit/pre-release-sessions-'+Date.now()+'.json'),JSON.stringify(archived,null,2));
  const old=JSON.parse(await io.readUTF8(local('validation/layout-source-audit/live-layout.json'))).sessions.find(s=>s.itemID===381);
  const first=JSON.parse(await io.readUTF8(local('validation/layout-v2/manual-translations.json'))),extra=JSON.parse(await io.readUTF8(local('validation/layout-source-audit/manual-extra.json')));
  for(const itemID of [381,474]){
   const r=await Zotero.Reader.open(itemID,{pageIndex:0});await Promise.race([r._initPromise,new Promise((_,reject)=>h.setTimeout(()=>reject(Error('Reader init timeout')),30000))]);app.clearInPlace(r);
   const saved=archived.find(s=>s.itemID===itemID)?.records.filter(r=>r.status==='done').map(r=>[r.text,r.target])||[];
   const examples=[...saved,...(itemID===381?old.records.filter(r=>r.status==='done').map(r=>[r.text,r.target]):[...first,...extra])];
   let calls=0;
   const s=await app.translateInPlace(r,{translateBlock:async text=>{calls++;const match=examples.find(t=>itemID===381?t[0]===text:text.startsWith(t[0]));if(!match)throw Error('Unmatched offline fixture');return {text:match[1]};}});
   app.pauseInPlace(r,true);s.syncEnabled=false;
   for(const v of s.records.values()){
    const match=examples.find(t=>itemID===381?t[0]===v.text:v.text.startsWith(t[0]));
    if(match){v.target=match[1];v.status='done';}else v.status='pending';
    s.paint(v);
   }
   const primary=r._internalReader._primaryView._iframeWindow,paper={itemID,calls,graphicsErrors:s.graphicsErrors||[],pages:[]};report.papers.push(paper);
   const numbers=itemID===381?[1,2,3,4,5,6]:[1,2,3,4,7,8];
   for(const page of numbers){
    for(const w of [primary,s.win]){w.PDFViewerApplication.pdfViewer.pagesRotation=0;w.PDFViewerApplication.pdfViewer.currentScaleValue='page-width';w.PDFViewerApplication.pdfViewer.currentPageNumber=page;}
    await new Promise(res=>h.setTimeout(res,450));s.rescan();await new Promise(res=>h.setTimeout(res,160));
    const p=s.layout.pages[page-1],overlaps=[];
    for(const b of p.blocks.filter(b=>!b.skipReason))for(const o of p.blocks){if(o===b)continue;const a=b.rect,c=o.inkRect||o.rect;const area=Math.max(0,Math.min(a[2],c[2])-Math.max(a[0],c[0]))*Math.max(0,Math.min(a[3],c[3])-Math.max(a[1],c[1]));if(area>.1)overlaps.push([b.id,o.id,area]);}
    const metrics=[...s.records.values()].filter(v=>v.layout.pageIndex===page-1&&v.status==='done').map(v=>({id:v.id,overflow:v.block?.el.dataset.overflow,font:v.block?.el.firstChild.style.fontSize,frame:v.block?.el.clientHeight,natural:v.block?.el.firstChild.scrollHeight}));
    paper.pages.push({page,metrics,overlaps});
    const win=s.win;win.PDFViewerApplication.pdfViewer.currentScaleValue='page-fit';win.PDFViewerApplication.pdfViewer.currentPageNumber=page;
    await new Promise(res=>h.setTimeout(res,1200));s.rescan();await new Promise(res=>h.setTimeout(res,400));
    const viewPage=win.document.querySelector('#viewer .page[data-page-number="'+page+'"]');
    paper.pages.at(-1).capture={scale:win.PDFViewerApplication.pdfViewer.currentScale,overlays:viewPage?.querySelectorAll('.pl-inplace').length,done:viewPage?.querySelectorAll('.pl-inplace[data-state="done"]').length,hidden:win.document.querySelector('#viewer').className};
    const canvas=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=win.innerWidth;canvas.height=win.innerHeight;
    win.getSelection()?.removeAllRanges();canvas.getContext('2d').drawWindow(win,0,0,win.innerWidth,win.innerHeight,'#fff');
    const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
    await io.write(local('validation/layout-source-audit/release-'+itemID+'-page-'+page+'.png'),new Uint8Array(await blob.arrayBuffer()));
   }
   const before=calls;s.syncEnabled=true;primary.PDFViewerApplication.pdfViewer.currentPageNumber=1;
   await new Promise(res=>h.setTimeout(res,500));report.checks.push({name:'sync-'+itemID,ok:s.win.PDFViewerApplication.pdfViewer.currentPageNumber===1});
   for(const w of [primary,s.win])w.PDFViewerApplication.pdfViewer.pagesRotation=90;
   await new Promise(res=>h.setTimeout(res,300));s.rescan();await new Promise(res=>h.setTimeout(res,150));
   report.checks.push({name:'rotation-no-request-'+itemID,ok:calls===before});
   for(const w of [primary,s.win]){w.PDFViewerApplication.pdfViewer.pagesRotation=0;w.PDFViewerApplication.pdfViewer.currentPageNumber=itemID===381?2:1;}
   report.checks.push({name:'left-original-'+itemID,ok:primary.document.querySelectorAll('.pl-inplace').length===0});
   app.toggleInPlace(r);report.checks.push({name:'hide-'+itemID,ok:s.doc.querySelector('#viewer').classList.contains('pl-hide-translations')});app.toggleInPlace(r);
   paper.toolbar=r._iframeWindow.document.querySelectorAll('.pl-main-button').length;
   const bar=r._iframeWindow.document.querySelector('.pl-inplace-controls');if(bar){const tag=bar.ownerDocument.createElement('strong');tag.textContent='排版复验：既有译文回放，未调用模型';bar.prepend(tag);}
   s.update();await save();
  }
  report.passed=report.checks.every(c=>c.ok)&&report.papers.every(p=>p.toolbar===1&&!p.graphicsErrors.length&&p.pages.every(pg=>!pg.overlaps.length&&pg.metrics.every(m=>m.overflow==='false')));
 }catch(e){report.passed=false;report.error=e.message;report.stack=e.stack;}
 await save();return {passed:report.passed,papers:report.papers.map(p=>({itemID:p.itemID,done:p.pages.reduce((n,p)=>n+p.metrics.length,0)}))};
})();
