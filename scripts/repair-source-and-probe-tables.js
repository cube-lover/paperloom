/* Immediate source-pane repair and read-only table fixture capture. No translation requests. */
var PaperLoomTableProbePromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),readers:[]},fixtures={pages:[]};
 const rect=r=>({left:r.left,top:r.top,width:r.width,height:r.height});
 for(const reader of Zotero.Reader._readers){
  const primary=reader._internalReader?._primaryView?._iframeWindow,secondary=reader._internalReader?._secondaryView?._iframeWindow,s=app.inplace?.get(reader);if(!primary)continue;
  const entry={itemID:reader.itemID,before:app.inplaceStats(reader),primaryBefore:{graphic:primary.document.querySelectorAll('.pl-graphic-anchor').length,prose:primary.document.querySelectorAll('.pl-inplace').length}};report.readers.push(entry);
  // Keep both saved results and primary PDF canvas. Remove only PaperLoom's
  // mistakenly mounted graphical translations; prevent old QA timers repainting.
  for(const engine of [app,app._graphicsQA])if(engine?.paintGraphicLabel&&!engine._secondaryGuard){
   const original=engine.paintGraphicLabel;engine.paintGraphicLabel=function(state,row,page,vp){if(state.reader&&page.ownerDocument!==state.reader._internalReader?._secondaryView?._iframeWindow?.document)return null;return original.call(this,state,row,page,vp);};engine._secondaryGuard=true;
  }
  for(const node of primary.document.querySelectorAll('.pl-graphic-anchor'))node.remove();
  // Fail closed for stray prose projection on source without deleting records.
  let style=primary.document.getElementById('pl-source-pane-guard');if(!style){style=primary.document.createElement('style');style.id='pl-source-pane-guard';style.textContent='.pl-inplace,.pl-graphic-anchor{display:none!important}';primary.document.head.appendChild(style);}
  const indices=new Set();if(s?.layout)for(const b of s.layout.blocks||[])if(/T5-Small|Total train|Dirty Count|Quac|QuAC|Winogrande/.test(b.text))indices.add(b.pageIndex);
  for(const w of [primary,secondary])if(w?.PDFViewerApplication)indices.add(w.PDFViewerApplication.pdfViewer.currentPageNumber-1);
  entry.matchingPages=[...indices];entry.records=[];
  if(s)for(const r of s.records.values())if(indices.has(r.layout.pageIndex))entry.records.push({id:r.id,pageIndex:r.layout.pageIndex,role:r.layout.role,rect:r.layout.rect,source:r.text,status:r.status,target:r.target});
  const pdf=primary.PDFViewerApplication.pdfDocument;
  for(const index of indices){
   const d=h.Components.utils.waiveXrays(await pdf.getPageData(h.Components.utils.cloneInto({pageIndex:index},primary)));
   fixtures.pages.push({itemID:reader.itemID,pageIndex:index,viewBox:Array.from(d.viewBox),chars:Array.from(d.chars,c=>({c:c.c,u:c.u,rect:Array.from(c.rect),fontSize:c.fontSize,baseline:c.baseline,fontName:c.fontName,bold:c.bold,italic:c.italic,rotation:c.rotation,spaceAfter:c.spaceAfter,ignorable:c.ignorable,lineBreakAfter:c.lineBreakAfter,paragraphBreakAfter:c.paragraphBreakAfter})),operatorList:await app.readOperatorGeometry(await pdf.getPage(index+1))});
  }
  entry.primaryAfter={graphic:primary.document.querySelectorAll('.pl-graphic-anchor').length,prose:primary.document.querySelectorAll('.pl-inplace').length};entry.after=app.inplaceStats(reader);
 }
 report.requests=app.allRequests.size;await io.writeUTF8(local('validation/table-probe.json'),JSON.stringify(report,null,2));await io.writeUTF8(local('tests/layout-dense-tables.fixture.json'),JSON.stringify(fixtures));return {readers:report.readers.map(e=>({itemID:e.itemID,primaryBefore:e.primaryBefore,primaryAfter:e.primaryAfter,pages:e.matchingPages})),requests:report.requests};
})();
