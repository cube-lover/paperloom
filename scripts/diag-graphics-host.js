/* Read-only host geometry. No provider calls, no change to prose queues. */
var PaperLoomGraphicsDiagPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 const out={at:new Date().toISOString(),version:Zotero.PaperLoom?.version,readers:[]};
 for(const reader of Zotero.Reader._readers){const entry={itemID:reader.itemID,session:Zotero.PaperLoom.inplaceStats(reader),views:[]};out.readers.push(entry);
  for(const [name,view] of [['primary',reader._internalReader?._primaryView],['secondary',reader._internalReader?._secondaryView]]){
   const win=view?._iframeWindow,app=win?.PDFViewerApplication;if(!app)continue;const pdf=app.pdfDocument,index=app.pdfViewer.currentPageNumber-1,pv=app.pdfViewer.getPageView(index),canvas=pv?.canvas||pv?.div?.querySelector('.canvasWrapper canvas');
   entry.views.push({name,index,fingerprints:Array.from(pdf.fingerprints||[]),fingerprint:pdf.fingerprint,renderingState:pv?.renderingState,transform:Array.from(pv?.viewport?.transform||[]),width:pv?.viewport?.width,height:pv?.viewport?.height,canvas:canvas&&{width:canvas.width,height:canvas.height,css:canvas.getBoundingClientRect().toJSON()},page:pv?.div?.getBoundingClientRect().toJSON()});
  }
 }
 await io.writeUTF8((root+'validation/graphics-host-diag.json').replace(/\//g,'\\'),JSON.stringify(out,null,2));return out;
})();
