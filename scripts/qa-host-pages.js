/* Host layout inspection only; no provider/cache/key access. Existing fixture session required. */
var PaperLoomPageQAPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,r=Zotero.Reader._readers.find(r=>r.itemID===474),s=app.inplace?.get(r);
 if(!s)throw Error('Fixture session missing');app.pauseInPlace(r,true);s.syncEnabled=false;
 const out='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/validation/layout-source-audit/'.replace(/\//g,'\\');
 const report={host:Zotero.version,at:new Date().toISOString(),graphicsErrors:s.graphicsErrors||[],pages:[],checks:[]};
 const primary=r._internalReader._primaryView._iframeWindow;
 for(const index of [0,1,2,3,6,7]){
  for(const w of [primary,s.win]){w.PDFViewerApplication.pdfViewer.pagesRotation=0;w.PDFViewerApplication.pdfViewer.currentPageNumber=index+1;}
  await new Promise(resolve=>h.setTimeout(resolve,600));s.rescan();await new Promise(resolve=>h.setTimeout(resolve,100));
  const p=s.layout.pages[index],eligible=p.blocks.filter(b=>!b.skipReason),overlaps=[];
  for(const b of eligible){for(const o of p.blocks){if(o===b)continue;const a=b.rect,c=o.inkRect||o.rect;const area=Math.max(0,Math.min(a[2],c[2])-Math.max(a[0],c[0]))*Math.max(0,Math.min(a[3],c[3])-Math.max(a[1],c[1]));if(area>.1)overlaps.push({block:b.id,other:o.id,area});}}
  report.pages.push({page:index+1,eligible:eligible.length,tables:p.protectedRegions.filter(r=>r.role==='table').length,images:p.protectedRegions.filter(r=>r.role==='image').length,overlaps});
 }
 const events=[];const eventCleanup=[];app.bindPdfEvent(s.win,'updateviewarea',()=>events.push('view'),eventCleanup);
 s.syncEnabled=true;primary.PDFViewerApplication.pdfViewer.currentPageNumber=1;
 await new Promise(resolve=>h.setTimeout(resolve,500));
 report.checks.push({name:'syncToPage1',ok:s.win.PDFViewerApplication.pdfViewer.currentPageNumber===1});
 const calls=[...s.records.values()].filter(r=>r.status==='done').length;
 for(const w of [primary,s.win])w.PDFViewerApplication.pdfViewer.pagesRotation=90;
 await new Promise(resolve=>h.setTimeout(resolve,400));s.rescan();await new Promise(resolve=>h.setTimeout(resolve,150));
 report.rotated=[...s.records.values()].filter(r=>r.status==='done'&&r.block).map(r=>({id:r.id,matrix:r.block.el.style.transform,overflow:r.block.el.dataset.overflow}));
 report.checks.push({name:'rotationNoRetranslate',ok:[...s.records.values()].filter(r=>r.status==='done').length===calls});
 for(const w of [primary,s.win]){w.PDFViewerApplication.pdfViewer.pagesRotation=0;w.PDFViewerApplication.pdfViewer.currentPageNumber=1;}
 for(const fn of eventCleanup)fn();await new Promise(resolve=>h.setTimeout(resolve,400));s.rescan();
 report.primaryOverlays=primary.document.querySelectorAll('.pl-inplace').length;
 report.checks.push({name:'noPrimaryOverlay',ok:report.primaryOverlays===0});
 report.passed=!report.graphicsErrors.length&&report.pages.every(p=>!p.overlaps.length)&&report.checks.every(c=>c.ok);
 await h.IOUtils.writeUTF8(out+'host-pages.json',JSON.stringify(report,null,2));return {passed:report.passed,file:out+'host-pages.json'};
})();
