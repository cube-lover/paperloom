/* Final evidence from installed addon; no translation calls. */
var PaperLoomFinish081Promise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),r=Zotero.Reader._readers.find(r=>app.inplace?.has(r)),s=app.inplace.get(r),g=app.graphicSessions.get(r),left=r._internalReader._primaryView._iframeWindow;
 const report={at:new Date().toISOString(),version:app.version,runtimeRoot:app.runtimeRoot,stats:app.inplaceStats(r),requests:app.allRequests.size,primaryOverlays:left.document.querySelectorAll('.pl-inplace,.pl-graphic-anchor').length,rows:g?.rows.map(x=>({text:x.text,target:x.target,origin:x.origin,autoValidated:x.autoValidated,warnings:x.warnings,review:x.review,score:x.score})),mounted:[...s.win.document.querySelectorAll('.pl-graphic-anchor')].map(n=>({mode:n.dataset.mode,fallback:n.dataset.fallback,text:n.textContent})),note:'Actual toolbar activation reached translation stage; recognition-only arming did not produce a report. Do not classify this run as provider-free QA.'};
 if(g){await app.saveGraphics(g);g.panel.hidden=true;}
 report.passed=app.version==='0.8.1'&&report.primaryOverlays===0&&report.stats.done>=447&&report.requests===0;
 await h.IOUtils.writeUTF8(local('validation/finish-081.json'),JSON.stringify(report,null,2));return report;
})();
