var PaperLoomLayoutRunPromise=(async()=>{
 const host=Zotero.getMainWindow(),scope={Zotero};
 const base='file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/scripts/';
 host.Services.scriptloader.loadSubScriptWithOptions(base+'dev-reload.js',{target:scope,ignoreCache:true});
 const result=await scope.PaperLoomReloadPromise;if(!result.ok)return result;
 host.Services.scriptloader.loadSubScriptWithOptions(base+'dev-layout-session.js',{target:scope,ignoreCache:true});
 return await scope.PaperLoomLayoutTestPromise;
})();
