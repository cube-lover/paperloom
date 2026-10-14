/* Inspect real selection; synthetic copy uses a local data transfer, never reads system clipboard. */
var PaperLoomSelectionEvidencePromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const r=Zotero.Reader._readers.find(r=>app.inplace?.has(r)),s=app.inplace.get(r),left=r._internalReader._primaryView._iframeWindow,right=s.win;
 const report={at:new Date().toISOString(),stats:app.inplaceStats(r),origin:s.selectionSync?.origin,details:s.selectionSync?.details,nodes:s.selectionSync?.nodes.map(n=>({level:n.dataset.level,rect:n.getBoundingClientRect().toJSON(),pane:n.ownerDocument===left.document?'left':'right'})),left:String(left.getSelection()),right:String(right.getSelection()),requests:app.allRequests.size};
 const dt=new right.DataTransfer(),event=new right.ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:dt});right.dispatchEvent(event);report.syntheticCopy=dt.getData('text/plain');report.lastCopy=app.nativeOverlayBindings?.get(r)?.lastCopy;report.copyMatches=!!report.right&&report.lastCopy?.text===report.right&&report.lastCopy?.trusted===true;
 report.passed=!!report.nodes?.length&&report.requests===0&&(report.origin!=='right'||report.copyMatches);
 await io.writeUTF8(local('validation/selection-'+report.origin+'-evidence.json'),JSON.stringify(report,null,2));return report;
})();
