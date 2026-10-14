/* Real mouse-only crop probe; no OCR/provider/data writes outside validation. */
var PaperLoomManualDragPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,qa=app._graphicsQA,reader=Zotero.Reader._readers.find(r=>app.inplace?.has(r)),original=qa.recognizeGraphicRegion;
 qa.recognizeGraphicRegion=async function(s,win,pv,canvas,pageIndex,rect){qa.recognizeGraphicRegion=original;const report={at:new Date().toISOString(),page:pageIndex+1,rect,coverRemaining:win.document.querySelectorAll('.pl-graphic-select').length,passed:rect[2]-rect[0]>20&&rect[3]-rect[1]>20,requests:app.allRequests.size};await h.IOUtils.writeUTF8('D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\validation\\manual-drag-host.json',JSON.stringify(report,null,2));s.message='拖框检查通过，未调用 OCR 或翻译服务';s.update();};
 await qa.selectGraphicRegion(reader);return {covers:[reader._internalReader._primaryView,reader._internalReader._secondaryView].map(v=>v._iframeWindow.document.querySelectorAll('.pl-graphic-select').length)};
})();
