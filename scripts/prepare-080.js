/* Pause, wait, archive latest records without config/credentials, then inspect page 46. */
var PaperLoomPreparePromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),sleep=ms=>new Promise(r=>h.setTimeout(r,ms));
 const report={at:new Date().toISOString(),version:app?.version,passed:false};
 try{
  if(!app||app.stopped)throw Error('Plugin not ready');const sessions=[...app.inplace];if(sessions.some(([,s])=>s.stage!=='ready'))throw Error('Layout still parsing');
  const before=sessions.map(([r,s])=>({itemID:r.itemID,paused:s.paused,page:s.win.PDFViewerApplication.pdfViewer.currentPageNumber}));
  for(const [r] of sessions)app.pauseInPlace(r,true);
  for(let i=0;i<600&&(app.allRequests.size||sessions.some(([,s])=>s.workers));i++)await sleep(100);
  if(app.allRequests.size||sessions.some(([,s])=>s.workers))throw Error('Active requests remain; stopped before archive');
  if([...app._graphicsQA?.graphicSessions?.values()||[],...app.graphicSessions?.values()||[]].some(s=>s.busy))throw Error('Graphic task busy');
  const records=s=>[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited,pageIndex:v.layout.pageIndex,inkRect:v.layout.inkRect,rect:v.layout.rect,protectedTable:!!v.protectedTable}));
  const archive={at:new Date().toISOString(),version:app.version,sessions:sessions.map(([r,s])=>({...before.find(a=>a.itemID===r.itemID),fontScale:s.fontScale,hidden:s.hidden,syncEnabled:s.syncEnabled,records:records(s)})),graphicsQA:[...app._graphicsQA?.graphicSessions||[]].map(([r,s])=>({itemID:r.itemID,fingerprint:s.fingerprint,replace:s.replace,hidden:s.hidden,rows:s.rows.map(({element,...v})=>v)}))};
  report.archive='validation/pre-080-review-'+Date.now()+'.json';await io.writeUTF8(local(report.archive),JSON.stringify(archive,null,2));
  report.sessions=sessions.map(([r])=>({itemID:r.itemID,stats:app.inplaceStats(r)}));
  const r=sessions.find(([r])=>r.itemID===594)?.[0];if(r)for(const view of [r._internalReader._primaryView,r._internalReader._secondaryView])view._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber=46;
  await sleep(600);report.requests=app.allRequests.size;report.passed=report.requests===0;
 }catch(e){report.error=e.message;}
 await io.writeUTF8(local('validation/prepare-080.json'),JSON.stringify(report,null,2));return report;
})();
