/* One trusted automatic-button click verifies recognition only, never calls a provider. Restores method immediately. */
var PaperLoomArm081Promise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,reader=Zotero.Reader._readers.find(r=>app.inplace?.has(r)),root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const s=app.inplace.get(reader);if(!s.paused||s.workers||app.allRequests.size)throw Error('Pause before QA');
 const report={at:new Date().toISOString(),version:app.version,before:app.inplaceStats(reader),passed:false},button=reader._iframeWindow.document.querySelector('.pl-auto-graphics');
 const clicked=e=>{report.trusted=e.isTrusted;};button.addEventListener('click',clicked,{once:true});const original=app.autoTranslateGraphics;
 app.autoTranslateGraphics=async function(r){app.autoTranslateGraphics=original;try{const g=await original.call(app,r,{translate:false});report.page=g.lastAuto?.pageIndex+1;report.regions=g.lastAuto?.regions;report.rows=g.rows.map(x=>({text:x.text,origin:x.origin,selected:x.selected,autoValidated:x.autoValidated}));report.after=app.inplaceStats(r);report.requests=app.allRequests.size;report.passed=report.trusted&&report.regions.length>0&&report.after.done===report.before.done&&report.requests===0;g.panel.hidden=true;}catch(e){report.error=e.message;report.stack=e.stack;}finally{await h.IOUtils.writeUTF8(local('validation/installed-081-auto-button.json'),JSON.stringify(report,null,2));}return report;};
 h.setTimeout(()=>{if(app.autoTranslateGraphics!==original){app.autoTranslateGraphics=original;button.removeEventListener('click',clicked);}},120000);
 return {armed:true,rect:button.getBoundingClientRect().toJSON()};
})();
