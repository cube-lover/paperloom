/* Capture current PDF iframe only, preserving no settings. Manual fixture QA. */
var PaperLoomCapturePromise=(async()=>{
 const h=Zotero.getMainWindow(),r=Zotero.Reader._readers.find(r=>r.itemID===474),s=Zotero.PaperLoom.inplace.get(r);
 const out='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/validation/layout-source-audit/'.replace(/\//g,'\\');
 const result=[];s.syncEnabled=false;
 for(const page of [1,3,4,7,8]){
  const win=s.win,v=win.PDFViewerApplication.pdfViewer;
  v.currentPageNumber=page;await new Promise(resolve=>h.setTimeout(resolve,400));s.rescan();await new Promise(resolve=>h.setTimeout(resolve,100));
  win.getSelection()?.removeAllRanges();
  const canvas=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=win.innerWidth;canvas.height=win.innerHeight;
  const ctx=canvas.getContext('2d');
  if(typeof ctx.drawWindow!=='function')return {error:'drawWindow absent'};
  ctx.drawWindow(win,0,0,win.innerWidth,win.innerHeight,'#ffffff');
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  await h.IOUtils.write(out+'host-page-'+page+'.png',new Uint8Array(await blob.arrayBuffer()));result.push(page);
 }
 for(const view of [r._internalReader._primaryView,r._internalReader._secondaryView])view._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber=1;
 s.syncEnabled=true;return {pages:result};
})();
