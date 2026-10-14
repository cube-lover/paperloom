/* Reload only plugin input/selection bindings; no document or translation changes. */
var PaperLoomReloadSelectionPromise=(async()=>{try{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,scope={Zotero,setTimeout:h.setTimeout.bind(h),clearTimeout:h.clearTimeout.bind(h)};
 for(const [,s] of app.inplace){if(!s.selectionSync)continue;/* dev-selection appended exactly 2*(1 DOM disposer + 3 PDF disposers)+1 final disposer after the live session was ready. */if(s.cleanup.length<9)throw Error('Incomplete development binding');for(const f of s.cleanup.splice(-9))f();}
 for(const r of [...app.nativeOverlayBindings?.keys()||[]])app.closeNativeOverlayInput(r);
 h.Services.scriptloader.loadSubScriptWithOptions('file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/addon/content/selection.js',{target:scope,ignoreCache:true});scope.PaperLoomSelection.attach(app);app._selectionDev=scope.PaperLoomSelection;for(const [,s] of app.inplace)app.bindSelectionSync(s);
 const report={bound:[...app.inplace.values()].map(s=>!!s.selectionSync)};await h.IOUtils.writeUTF8('D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\validation\\reload-selection.json',JSON.stringify(report));return report;
}catch(e){await Zotero.getMainWindow().IOUtils.writeUTF8('D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\validation\\reload-selection.json',JSON.stringify({error:e.message,stack:e.stack}));throw e;}})();
