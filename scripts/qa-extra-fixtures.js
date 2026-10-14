/* Manual content rendering test, not a model-quality test. No provider/cache/config writes. */
var PaperLoomExtraQAPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,r=Zotero.Reader._readers.find(r=>r.itemID===474),s=app.inplace?.get(r);if(!s)throw Error('Fixture session missing');
 const out='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/validation/layout-source-audit/'.replace(/\//g,'\\');
 const examples=JSON.parse(await h.IOUtils.readUTF8(out+'manual-extra.json'));
 app.pauseInPlace(r,true);s.syncEnabled=false;
 for(const record of s.records.values()){
  const example=examples.find(t=>record.text.startsWith(t[0]));
  if(example){record.status='done';record.target=example[1];s.paint(record);}
  else if(record.status==='error'){record.status='pending';s.paint(record);}
 }
 const primary=r._internalReader._primaryView._iframeWindow,report={kind:'manual-fixtures-not-model',pages:[]};
 for(const index of [0,1,2,3,6,7]){
  for(const w of [primary,s.win]){const v=w.PDFViewerApplication.pdfViewer;v.pagesRotation=0;v.currentScaleValue='page-width';v.currentPageNumber=index+1;w.getSelection()?.removeAllRanges();}
  await new Promise(resolve=>h.setTimeout(resolve,450));s.rescan();await new Promise(resolve=>h.setTimeout(resolve,150));
  const metrics=[...s.records.values()].filter(r=>r.layout.pageIndex===index&&r.status==='done').map(r=>({id:r.id,role:r.layout.role,overflow:r.block?.el.dataset.overflow,font:r.block?.el.firstChild.style.fontSize,height:r.block?.el.clientHeight,natural:r.block?.el.firstChild.scrollHeight}));
  report.pages.push({page:index+1,metrics});
 }
 for(const w of [primary,s.win])w.PDFViewerApplication.pdfViewer.currentPageNumber=1;
 s.syncEnabled=true;s.update();
 report.passed=report.pages.every(p=>p.metrics.every(m=>m.overflow==='false'));
 await h.IOUtils.writeUTF8(out+'host-extra-fixtures.json',JSON.stringify(report,null,2));return report;
})();
