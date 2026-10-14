/* Archive only translation records before installing; never read config/credentials. */
var PaperLoomPreservingInstallPromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 if(app.allRequests.size||[...app.inplace.values()].some(s=>s.workers||s.stage==='parsing'))throw Error('Wait for active tasks before installing');
 const data={at:new Date().toISOString(),from:app.version,sessions:[...app.inplace].map(([r,s])=>({itemID:r.itemID,hidden:s.hidden,fontScale:s.fontScale,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited}))}))};
 await h.IOUtils.writeUTF8((root+'validation/layout-source-audit/pre-073-install-sessions.json').replace(/\//g,'\\'),JSON.stringify(data,null,2));
 const scope={Zotero};h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'scripts/install-in-host.js',{target:scope,ignoreCache:true});
 return await scope.PaperLoomInstallPromise;
})();
