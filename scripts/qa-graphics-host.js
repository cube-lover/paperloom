/* Isolated graphics QA against current PDF. Never invokes the translation provider or mutates prose. */
var PaperLoomGraphicsQAPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),passed:false};
 const app=Zotero.PaperLoom,reader=Zotero.Reader._readers.find(r=>app.inplace?.has(r));
 const save=()=>io.writeUTF8(local('validation/graphics-host-qa.json'),JSON.stringify(report,null,2));
 let qa,s;
 try{
  if(!reader)throw Error('No active PDF session');report.before=app.inplaceStats(reader);report.requestsBefore=app.allRequests.size;
  const scope={Zotero,IOUtils:io,PathUtils:h.PathUtils,Services:h.Services,ChromeUtils:h.ChromeUtils,Components:h.Components,crypto:h.crypto,fetch:h.fetch.bind(h),setTimeout:h.setTimeout.bind(h),clearTimeout:h.clearTimeout.bind(h)};
  h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/graphics.js',{target:scope,ignoreCache:true});
  qa={dir:local('validation/graphics-qa-data'),runtimeRoot:'file:///'+root+'addon/',writeChain:Promise.resolve(),hash:app.hash.bind(app),writeJSON:app.writeJSON,readJSON:app.readJSON,bindReaderCommand:app.bindReaderCommand,bindPdfEvent:app.bindPdfEvent,measureInPlaceText:app.measureInPlaceText,translate:()=>{throw Error('Provider forbidden in QA');}};
  await io.makeDirectory(qa.dir,{ignoreExisting:true});await io.makeDirectory(h.PathUtils.join(qa.dir,'graphics'),{ignoreExisting:true});
  scope.PaperLoomGraphics.attach(qa,{});
  qa.graphicRuntime=()=>({python:'D:\\Backup\\Downloads\\python312\\python.exe',runtime:local('.local/ocr-runtime'),models:local('.local/ocr-models')});
  const win=reader._internalReader._primaryView._iframeWindow,pdf=win.PDFViewerApplication.pdfDocument,pv=win.PDFViewerApplication.pdfViewer.getPageView(win.PDFViewerApplication.pdfViewer.currentPageNumber-1),canvas=pv.canvas||pv.div.querySelector('.canvasWrapper canvas');
  const raw=h.atob(canvas.toDataURL('image/png').split(',')[1]);await io.write(local('validation/graphics-source-current.png'),Uint8Array.from(raw,c=>c.charCodeAt(0)));
  s={reader,doc:reader._iframeWindow.document,file:'graphics/qa.json',fingerprint:String(pdf.fingerprints[0]),rows:[],control:{stopped:false,requests:new Set()},update(){},paint(){}};
  await qa.recognizeGraphicRegion(s,win,pv,canvas,win.PDFViewerApplication.pdfViewer.currentPageNumber-1,[0,0,pv.viewport.width,pv.viewport.height]);
  report.rows=s.rows.length;report.selected=s.rows.filter(r=>r.selected).length;report.origins=s.rows.reduce((a,r)=>(a[r.origin]=(a[r.origin]||0)+1,a),{});report.message=s.message;
  report.geometry=[];
  const G=scope.PaperLoomGraphics;
  for(const rotation of [0,90,180,270])for(const scale of [.75,1,1.5,2.25]){
   const page=h.Components.utils.waiveXrays(await pdf.getPage(1)),v=page.getViewport(h.Components.utils.cloneInto({scale,rotation},win));let maxError=0;
   for(const r of s.rows){const p=G.project(r.quad,Array.from(v.transform));for(const [i,c] of [[0,[0,0]],[1,[p.width,0]],[3,[0,p.height]]]){const a=G.point(p.matrix,c),b=G.point(Array.from(v.transform),r.quad[i]);maxError=Math.max(maxError,Math.hypot(a[0]-b[0],a[1]-b[1]));}}
   report.geometry.push({rotation,scale,maxError});
  }
  // Detached element probes do not change what the user sees on the page.
  const sample=s.rows.find(r=>r.selected);if(sample){const host=win.document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:1000px;height:1400px;';win.document.body.appendChild(host);
   try{const row={...sample,target:'图表定位测试',approved:false};const state={rows:[row],replace:false,panel:{hidden:true},update(){}};const box=qa.paintGraphicLabel(state,row,host,pv.viewport);report.hotspot={mode:box.dataset.mode,background:box.style.background,children:box.children.length,width:box.style.width,transform:box.style.transform};}finally{host.remove();}}
  // Mount an isolated empty QA panel to validate real native controls. Its saved
  // file is under validation/, never the user's PaperLoom data directory.
  if(app._graphicsQA)for(const r of [...app._graphicsQA.graphicSessions.keys()])app._graphicsQA.closeGraphics(r);
  qa.graphicSessionFile='qa';
  const ui=await qa.openGraphics(reader);report.panel={connected:ui.panel.isConnected,rows:ui.rows.length};app._graphicsQA=qa;
  report.after=app.inplaceStats(reader);report.requestsAfter=app.allRequests.size;
  report.passed=report.rows>0&&report.hotspot?.mode==='hotspot'&&report.hotspot.children===0&&report.geometry.every(x=>x.maxError<1e-7)&&report.before.done===report.after.done&&report.before.paused===report.after.paused;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await save();return {passed:report.passed,rows:report.rows,error:report.error};
})();
