/* Update only PaperLoom. Archive all in-place results, install, restore paused by source. No provider calls. */
var PaperLoomUpdatePromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 const local=p=>(root+p).replace(/\//g,'\\'),sleep=ms=>new Promise(r=>h.setTimeout(r,ms));
 const report={at:new Date().toISOString(),pid:h.Services.appinfo.processID,expected:'0.7.5',restored:[],passed:false};
 const save=()=>io.writeUTF8(local('validation/update-075.json'),JSON.stringify(report,null,2));
 try{
  const old=Zotero.PaperLoom;if(!old||old.stopped)throw Error('Plugin not ready');
  report.beforeVersion=old.version;
  if(old.version==='0.7.5')throw Error('Version already installed: use verification, not another update');
  old._clickProbe?.cleanup();
  const sessions=[...(old.inplace||new Map())];
  if(sessions.some(([,s])=>s.stage!=='ready'))throw Error('Wait for current layout parsing to finish before updating');
  for(const [r] of sessions)old.pauseInPlace(r,true);
  for(let i=0;i<600&&(old.allRequests.size||sessions.some(([,s])=>s.workers));i++)await sleep(100);
  if(old.allRequests.size||sessions.some(([,s])=>s.workers))throw Error('Requests still active; update deferred, sessions paused');
  const archived={at:new Date().toISOString(),version:old.version,sessions:sessions.map(([r,s])=>({itemID:r.itemID,fontScale:s.fontScale,hidden:s.hidden,syncEnabled:s.syncEnabled,config:s.cfg,page:s.win.PDFViewerApplication.pdfViewer.currentPageNumber,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited}))}))};
  report.archive='validation/pre-075-sessions-'+Date.now()+'.json';await io.writeUTF8(local(report.archive),JSON.stringify(archived,null,2));
  const installed=h.PathUtils.join(h.PathUtils.profileDir,'extensions','paperloom@local.research.xpi');
  report.backup='validation/pre-075-'+old.version+'-'+Date.now()+'.xpi';await io.copy(installed,local(report.backup));await save();
  const scope={Zotero};h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'scripts/install-in-host.js',{target:scope,ignoreCache:true});
  report.install=await scope.PaperLoomInstallPromise;if(!report.install.passed)throw Error('Installation verification failed');
  const app=Zotero.PaperLoom;report.version=app.version;report.runtimeRoot=app.runtimeRoot;
  for(const a of archived.sessions){
   const r=Zotero.Reader._readers.find(r=>r.itemID===a.itemID);if(!r){report.restored.push({itemID:a.itemID,archivedOnly:true});continue;}
   const entry={itemID:a.itemID,previousDone:a.records.filter(v=>v.status==='done').length};report.restored.push(entry);await save();
   const s=await app.translateInPlace(r,{restoredRecords:a.records,startPaused:true});
   Object.assign(s.cfg,a.config||{});s.syncEnabled=a.syncEnabled!==false;s.fontScale=a.fontScale||1;if(a.hidden)app.toggleInPlace(r);
   for(const view of [r._internalReader._primaryView,r._internalReader._secondaryView]){const v=view?._iframeWindow?.PDFViewerApplication?.pdfViewer;if(v)v.currentPageNumber=a.page||1;}
   s.repaint();s.rescan();await sleep(450);
   entry.stats=app.inplaceStats(r);
   const button=r._iframeWindow.document.querySelector('.pl-main-button');
   entry.buttonNoDrag=button&&r._iframeWindow.getComputedStyle(button).getPropertyValue('-moz-window-dragging');
   entry.toolbar=r._iframeWindow.document.querySelectorAll('.pl-main-button').length;
   entry.contentsInQueue=[...s.records.values()].filter(v=>v.layout.role==='contents').length;
   entry.captions=[...s.records.values()].filter(v=>v.layout.role==='caption').length;
   entry.unmappedArchiveRecords=a.records.filter(v=>v.status==='done'&&![...s.records.values()].some(n=>n.target===v.target&&n.text.replace(/\s+/g,' ').trim()===v.text.replace(/\s+/g,' ').trim())).map(v=>v.id);
   await save();
  }
  // Pure classification against the installed jar, not workspace code.
  const qa={};h.Services.scriptloader.loadSubScriptWithOptions(app.runtimeRoot+'content/layout.js',{target:qa,ignoreCache:true});
  const d=JSON.parse(await io.readUTF8(local('tests/layout-gpt3.fixture.json'))),L=qa.PaperLoomLayout;
  const m=L.finalize(d.pages.map(p=>L.parsePage(p,{outline:d.outline,operatorList:p.operatorList})));
  report.classification={model:L.VERSION,contentsEligible:m.pages[1].blocks.filter(b=>!b.skipReason).length,figure11:m.pages[2].blocks.filter(b=>b.text.startsWith('Figure 1.1:')&&!b.skipReason).map(b=>({role:b.role,lines:b.lines.length})),figure12:m.pages[3].blocks.filter(b=>b.text.startsWith('Figure 1.2:')&&!b.skipReason).map(b=>({role:b.role,lines:b.lines.length}))};
  report.requests=app.allRequests.size;
  report.priorityAPI=typeof app.prioritizeInPlace==='function';
  const c=report.classification;report.passed=app.version==='0.7.5'&&app.runtimeRoot.startsWith('jar:')&&report.requests===0&&report.priorityAPI&&c.contentsEligible===0&&c.figure11[0]?.lines===6&&c.figure12[0]?.lines===5&&report.restored.every(r=>r.archivedOnly||r.stats?.paused&&r.toolbar===1&&r.buttonNoDrag==='no-drag'&&r.unmappedArchiveRecords.length===0&&r.contentsInQueue===0);
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await save();return {passed:report.passed,version:report.version,error:report.error,restored:report.restored.map(r=>({itemID:r.itemID,stats:r.stats}))};
})();
