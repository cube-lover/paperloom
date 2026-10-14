/* Installed recognition/geometry QA. Translation deliberately blocked. No synthetic targets. */
var CubeSpatial084Promise=(async()=>{
 const h=Zotero.getMainWindow(),a=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),report={at:new Date().toISOString(),runs:[],passed:false};let originalTranslate;
 const save=()=>h.IOUtils.writeUTF8(local('validation/spatial-084-host.json'),JSON.stringify(report,null,2));
 try{if(a.version!=='0.8.4')throw Error('Expected installed version');const r=Zotero.Reader._readers.find(r=>a.inplace.has(r)),s=a.inplace.get(r),g=await a.graphicSession(r);if(!s.paused||s.workers||a.allRequests.size||g.busy)throw Error('Pause and settle first');
 report.before=a.inplaceStats(r);report.pagesBefore=[r._internalReader._primaryView,r._internalReader._secondaryView].map(v=>v._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber);const saved=g.rows.map(x=>({id:x.id,text:x.text,target:x.target,edited:!!x.edited}));
 await h.IOUtils.writeUTF8(local('validation/pre-084-recognition-'+Date.now()+'.json'),JSON.stringify({rows:g.rows,stats:report.before}));
 originalTranslate=a.translate;report.providerAttempts=0;a.translate=()=>{report.providerAttempts++;throw Error('Provider blocked during geometry QA');};
 const article={reader:r,paused:false,alive:()=>true};
 for(const index of [13,14,55,56,46]){const start=Date.now();await a.autoTranslateGraphics(r,{translate:false,force:true,pageIndex:index,article});report.runs.push({page:index+1,ms:Date.now()-start,regions:g.lastAuto.regions.map(x=>({role:x.role,rect:x.rect})),rows:g.rows.filter(x=>x.pageIndex===index&&!x.legacyLayout).map(x=>({id:x.id,text:x.text,target:x.target,origin:x.origin,auto:x.autoValidated,direction:x.directionVerified,score:x.score,background:x.background,review:x.review,preserveSource:x.preserveSource,preserveLiterals:x.preserveLiterals,quad:x.quad})),panelHidden:g.panel.hidden});await save();}
 const scope={};h.Services.scriptloader.loadSubScriptWithOptions(a.runtimeRoot+'content/layout.js',{target:scope,ignoreCache:true});const L=scope.PaperLoomLayout;
 report.proseCollisions=[...s.records.values()].filter(x=>L.frameConflicts(x.layout.rect,s.layout.pages[x.layout.pageIndex].protectedRegions).length).map(x=>x.id);
 report.preserved=saved.every(x=>g.rows.some(n=>n.id===x.id&&n.text===x.text&&n.target===x.target&&!!n.edited===x.edited));report.after=a.inplaceStats(r);report.pagesAfter=[r._internalReader._primaryView,r._internalReader._secondaryView].map(v=>v._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber);
 s.rescan();g.paint();report.mounted=[...r._internalReader._secondaryView._iframeWindow.document.querySelectorAll('.pl-graphic-anchor')].map(n=>({id:n.dataset.labelId,mode:n.dataset.mode,fallback:n.dataset.fallback}));report.primaryOverlays=r._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-inplace,.pl-graphic-anchor').length;
 report.passed=report.preserved&&report.before.done===report.after.done&&report.providerAttempts===0&&report.proseCollisions.length===0&&report.primaryOverlays===0&&JSON.stringify(report.pagesBefore)===JSON.stringify(report.pagesAfter)&&report.runs.every(x=>x.panelHidden);
 }catch(e){report.error=e.message;report.stack=e.stack;}finally{if(originalTranslate)a.translate=originalTranslate;}
 await save();return {passed:report.passed,error:report.error,runs:report.runs.map(x=>({page:x.page,ms:x.ms,rows:x.rows.length})),preserved:report.preserved};
})();
