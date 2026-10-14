/* Install only PaperLoom; fresh archive, geometric preflight, source/page restore; no provider use. */
var PaperLoomUpdate085Promise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,paths=h.PathUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),sleep=ms=>new Promise(r=>h.setTimeout(r,ms));
 const report={at:new Date().toISOString(),expected:'0.8.5',restored:[],passed:false},save=()=>io.writeUTF8(local('validation/update-085.json'),JSON.stringify(report,null,2));
 try{
  const old=Zotero.PaperLoom;if(!old||old.stopped||old.version==='0.8.5')throw Error('Update requires a live older version');
  report.beforeVersion=old.version;const sessions=[...old.inplace],cfgs=new Map(sessions.map(([r,s])=>[r.itemID,s.cfg]));
  if(sessions.some(([,s])=>s.stage!=='ready'))throw Error('Layout is still parsing');
  const original=sessions.map(([r,s])=>({itemID:r.itemID,paused:s.paused}));for(const [r] of sessions)old.pauseInPlace(r,true);
  for(let i=0;i<600&&(old.allRequests.size||sessions.some(([,s])=>s.workers));i++)await sleep(100);
  if(old.allRequests.size||sessions.some(([,s])=>s.workers))throw Error('Active requests remain; paused without installing');
  const graphics=[...old.graphicSessions||[]],qaSessions=[...old._graphicsQA?.graphicSessions||[]];
  if([...graphics,...qaSessions].some(([,s])=>s.busy))throw Error('Graphic tasks are busy');
  const scope={Zotero};h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'scripts/preflight-085.js',{target:scope,ignoreCache:true});report.preflight=await scope.CubePreflight085Promise;if(!report.preflight.passed)throw Error('Preflight found unexplained layout changes');
  const graphicArchive=entries=>entries.map(([r,s])=>({itemID:r.itemID,fingerprint:s.fingerprint,file:s.file,replace:s.replace,hidden:s.hidden,panelHidden:s.panel?.hidden,rows:s.rows.map(({element,...v})=>v)}));
  const archive={at:new Date().toISOString(),version:old.version,sessions:sessions.map(([r,s])=>({itemID:r.itemID,paused:original.find(a=>a.itemID===r.itemID).paused,fontScale:s.fontScale,hidden:s.hidden,syncEnabled:s.syncEnabled,pages:[r._internalReader._primaryView,r._internalReader._secondaryView].map(v=>v?._iframeWindow?.PDFViewerApplication?.pdfViewer?.currentPageNumber),records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited,pageIndex:v.layout.pageIndex,inkRect:v.layout.inkRect,rect:v.layout.rect,protectedTable:!!v.protectedTable}))})),graphics:graphicArchive(graphics),graphicsQA:graphicArchive(qaSessions)};
  const stamp=Date.now();report.archive='validation/pre-085-install-'+stamp+'.json';const serialized=JSON.stringify(archive,null,2);await io.writeUTF8(local(report.archive),serialized);
  await io.makeDirectory(paths.join(old.dir,'recovery'),{ignoreExisting:true});report.recovery=paths.join(old.dir,'recovery','pre-085-'+stamp+'.json');await io.writeUTF8(report.recovery,serialized);
  report.backup='validation/pre-085-'+old.version+'-'+stamp+'.xpi';await io.copy(paths.join(paths.profileDir,'extensions','paperloom@local.research.xpi'),local(report.backup));
  for(const [,s] of graphics)await old.saveGraphics(s);
  if(old._graphicsQA){for(const [r,s] of qaSessions){await old._graphicsQA.saveGraphics(s);old._graphicsQA.closeGraphics(r);}old._graphicsQA.stopped=true;delete old._graphicsQA;}
  // 0.8.0 was temporarily given selection bindings during QA. Dispose only
  // plugin wrappers before its older shutdown implementation runs.
  for(const r of [...old.nativeOverlayBindings?.keys()||[]])old.closeNativeOverlayInput(r);
  await old.writeChain;await save();
  h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'scripts/install-in-host.js',{target:scope,ignoreCache:true});report.install=await scope.PaperLoomInstallPromise;if(!report.install.passed)throw Error('Installation verification failed');
  const app=Zotero.PaperLoom;report.version=app.version;report.runtimeRoot=app.runtimeRoot;report.cubeName=report.install.passed;report.selectionAPI=typeof app.bindSelectionSync==='function';report.autoGraphicsAPI=typeof app.autoTranslateGraphics==='function';
  for(const a of archive.sessions){
   const reader=Zotero.Reader._readers.find(r=>r.itemID===a.itemID);if(!reader){report.restored.push({itemID:a.itemID,archivedOnly:true});continue;}
   const s=await app.translateInPlace(reader,{restoredRecords:a.records,startPaused:true});Object.assign(s.cfg,cfgs.get(a.itemID)||{});s.fontScale=a.fontScale||1;s.syncEnabled=a.syncEnabled!==false;if(a.hidden)app.toggleInPlace(reader);
   for(const [i,v] of [reader._internalReader._primaryView,reader._internalReader._secondaryView].entries())if(v?._iframeWindow?.PDFViewerApplication)v._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber=a.pages[i]||1;
   s.repaint();s.rescan();await sleep(350);
   const pre=report.preflight.sessions.find(p=>p.itemID===a.itemID),excluded=s.unmatchedRestoredRecords||[],expected=new Set(pre.removed.map(r=>r.id));
   const current=[...s.records.values()],normalize=t=>t.replace(/\s+/g,' ').trim();
   const preserved=a.records.filter(r=>r.status==='done'&&!expected.has(r.id)).every(r=>current.some(n=>n.layout.pageIndex===r.pageIndex&&normalize(n.text)===normalize(r.text)&&n.target===r.target&&!!n.edited===!!r.edited));
   const archiveResult=await app.preserveLayoutTranslations(reader,excluded);
   report.restored.push({legacyPreserved:archiveResult.preserved,itemID:a.itemID,previousDone:pre.oldDone,stats:app.inplaceStats(reader),preserved,excluded:excluded.map(r=>({id:r.id,page:r.pageIndex+1,edited:r.edited})),unexplained:excluded.filter(r=>!expected.has(r.id)).map(r=>r.id),expectedExcluded:expected.size,primary:{prose:reader._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-inplace').length,graphics:reader._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-graphic-anchor').length},buttons:reader._iframeWindow.document.querySelectorAll('.pl-main-button').length,autoButtons:reader._iframeWindow.document.querySelectorAll('.pl-auto-graphics').length,selectionBound:!!s.selectionSync});await save();
  }
  for(const g of archive.graphics){const reader=Zotero.Reader._readers.find(r=>r.itemID===g.itemID);if(reader){const s=await app.openGraphics(reader);s.panel.hidden=true;}}
  report.graphicPreservation=archive.graphics.map(g=>{const r=Zotero.Reader._readers.find(r=>r.itemID===g.itemID),rows=app.graphicSessions.get(r)?.rows||[];return {itemID:g.itemID,preserved:g.rows.every(old=>rows.some(n=>n.id===old.id&&n.text===old.text&&n.target===old.target&&!!n.edited===!!old.edited)),previousDone:g.rows.filter(r=>r.target).length};});
  const runtimePref='extensions.zotero.paperloom.graphics.runtime';
  if(!Zotero.Prefs.get(runtimePref,true)){
   const cfg={python:'D:\\Backup\\Downloads\\python312\\python.exe',runtime:local('.local/ocr-runtime'),models:local('.local/ocr-models')};for(const p of Object.values(cfg))if(!await io.exists(p))throw Error('OCR deployment path missing');Zotero.Prefs.set(runtimePref,JSON.stringify(cfg),true);report.ocrConfigured=true;
  }else report.ocrConfigured='existing-preserved';
  const bytes=await io.read(paths.join(paths.profileDir,'extensions','paperloom@local.research.xpi')),digest=await h.crypto.subtle.digest('SHA-256',bytes);report.installedSHA256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');report.expectedSHA256=(await io.readUTF8(local('dist/paperloom-0.8.5.xpi.sha256'))).split(/\s/)[0];
  report.requests=app.allRequests.size;report.passed=app.version==='0.8.5'&&app.runtimeRoot.startsWith('jar:')&&report.requests===0&&report.graphicPreservation.every(g=>g.preserved)&&report.installedSHA256===report.expectedSHA256&&report.restored.every(r=>r.archivedOnly||r.preserved&&r.unexplained.length===0&&r.excluded.length===r.expectedExcluded&&r.legacyPreserved===r.expectedExcluded&&r.stats.paused&&r.primary.prose===0&&r.primary.graphics===0&&r.buttons===1&&r.autoButtons===1&&r.selectionBound);
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await save();return {passed:report.passed,version:report.version,error:report.error,restored:report.restored};
})();
