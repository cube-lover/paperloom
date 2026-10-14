/* Finish UI regression on installed runtime; preserve complete user translation on screen. */
var PaperLoomFinishPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 const local=p=>(root+p).replace(/\//g,'\\'),r=Zotero.Reader._readers.find(r=>r.itemID===474),s=app.inplace.get(r);
 const report={at:new Date().toISOString(),version:app.version,pid:h.Services.appinfo.processID};
 const other=Zotero.Reader._readers.find(r=>r.itemID===381);if(other)app.clearInPlace(other);
 report.clearOther=!app.inplace.has(other);s.paused=false;s.queue.length=0;for(const v of s.records.values())v.queued=false;s.update();
 report.stats=app.inplaceStats(r);if(report.stats.pending||report.stats.error||report.stats.running)throw Error('Expected complete recorded translation');
 await Zotero.Reader.open(474,{pageIndex:0});
 for(const v of [r._internalReader._primaryView,r._internalReader._secondaryView]){const viewer=v._iframeWindow.PDFViewerApplication.pdfViewer;viewer.currentScaleValue='page-fit';viewer.currentPageNumber=1;}
 const bar=r._iframeWindow.document.querySelector('.pl-inplace-controls strong');if(bar)bar.textContent='已恢复既有译文 · 排版修复版 '+app.version;
 report.nativeBefore={hidden:s.hidden,state:r._iframeWindow.document.querySelector('.pl-main-button')?.dataset.state};
 h.setTimeout(async()=>{report.nativeAfter={hidden:s.hidden,state:r._iframeWindow.document.querySelector('.pl-main-button')?.dataset.state,requests:app.allRequests.size};report.nativeToggle=report.nativeBefore.hidden!==report.nativeAfter.hidden&&report.nativeAfter.requests===0;await h.IOUtils.writeUTF8(local('validation/layout-source-audit/release-finish.json'),JSON.stringify(report,null,2));},20000);
 return {armed:true};
})();
