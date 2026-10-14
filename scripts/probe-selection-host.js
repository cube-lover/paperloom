/* Observe only PaperLoom/PDF selection and event routing; no request or clipboard reads. */
var PaperLoomSelectionProbePromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',out={at:new Date().toISOString(),version:app.version,readers:[]};
 for(const reader of Zotero.Reader._readers){const s=app.inplace?.get(reader);if(!s)continue;const entry={itemID:reader.itemID,stats:app.inplaceStats(reader),sync:s.selectionSync&&{origin:s.selectionSync.origin,details:s.selectionSync.details,nodes:s.selectionSync.nodes.length},views:[]};out.readers.push(entry);
  for(const [name,view] of [['left',reader._internalReader._primaryView],['right',reader._internalReader._secondaryView]]){
   const win=view._iframeWindow,viewer=win.PDFViewerApplication.pdfViewer,pv=viewer.getPageView(viewer.currentPageNumber-1),body=pv?.div?.querySelector('.pl-inplace-text');
   entry.views.push({name,page:viewer.currentPageNumber,selection:String(win.getSelection()),hostSelection:Array.from(view._selectionRanges||[],r=>({text:r.text,pageIndex:r.pageIndex,anchorOffset:r.anchorOffset,headOffset:r.headOffset,collapsed:r.collapsed,position:r.position})),body:body&&{style:win.getComputedStyle(body).userSelect,rect:body.getBoundingClientRect().toJSON(),text:body.textContent.slice(0,120)},api:{render:typeof view._render,pages:!!view._pdfPages,setSelection:typeof view._setSelectionRanges},pageClasses:pv?.div?.className});
  }
 }
 await io.writeUTF8((root+'validation/selection-host-probe.json').replace(/\//g,'\\'),JSON.stringify(out,null,2));return out;
})();
