/* Isolated graphics QA against current PDF. Never invokes the translation provider or mutates prose. */
var PaperLoomGraphicsRotationPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),passed:false};
 const app=Zotero.PaperLoom,reader=Zotero.Reader._readers.find(r=>app.inplace?.has(r));
 const save=()=>io.writeUTF8(local('validation/graphics-rotation-host.json'),JSON.stringify(report,null,2));
 let qa,s;
 try{
  if(!reader)throw Error('No active PDF session');report.before=app.inplaceStats(reader);report.requestsBefore=app.allRequests.size;
  const scope={Zotero,IOUtils:io,PathUtils:h.PathUtils,Services:h.Services,ChromeUtils:h.ChromeUtils,Components:h.Components,crypto:h.crypto,fetch:h.fetch.bind(h),setTimeout:h.setTimeout.bind(h),clearTimeout:h.clearTimeout.bind(h)};
  h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/graphics.js',{target:scope,ignoreCache:true});
  qa={dir:local('validation/graphics-rotation-qa-data'),runtimeRoot:'file:///'+root+'addon/',writeChain:Promise.resolve(),hash:app.hash.bind(app),writeJSON:app.writeJSON,readJSON:app.readJSON,bindReaderCommand:app.bindReaderCommand,bindPdfEvent:app.bindPdfEvent,measureInPlaceText:app.measureInPlaceText,translate:()=>{throw Error('Provider forbidden in QA');}};
  await io.makeDirectory(qa.dir,{ignoreExisting:true});await io.makeDirectory(h.PathUtils.join(qa.dir,'graphics'),{ignoreExisting:true});
  scope.PaperLoomGraphics.attach(qa,{});
  qa.graphicRuntime=()=>({python:'D:\\Backup\\Downloads\\python312\\python.exe',runtime:local('.local/ocr-runtime'),models:local('.local/ocr-models')});
  const win=reader._internalReader._primaryView._iframeWindow,pdf=win.PDFViewerApplication.pdfDocument,pv=win.PDFViewerApplication.pdfViewer.getPageView(win.PDFViewerApplication.pdfViewer.currentPageNumber-1),canvas=pv.canvas||pv.div.querySelector('.canvasWrapper canvas');
  const raw=h.atob(canvas.toDataURL('image/png').split(',')[1]);await io.write(local('validation/graphics-source-current.png'),Uint8Array.from(raw,c=>c.charCodeAt(0)));
  if(app._graphicsQA)for(const r of [...app._graphicsQA.graphicSessions.keys()])app._graphicsQA.closeGraphics(r);
  s=await qa.openGraphics(reader);app._graphicsQA=qa;
  if(win.PDFViewerApplication.pdfViewer.currentPageNumber!==47)throw Error('Expected inspected chart on page 47; user location unchanged');
  const bounds=pv.viewport.convertToViewportRectangle(h.Components.utils.cloneInto([139.7,286.4,472.3,525.8],win));
  s.rows=[];
  await qa.recognizeGraphicRegion(s,win,pv,canvas,46,[Math.min(bounds[0],bounds[2]),Math.min(bounds[1],bounds[3]),Math.max(bounds[0],bounds[2]),Math.max(bounds[1],bounds[3])]);
  report.recognized=s.rows.map(r=>({id:r.id,text:r.text,quad:r.quad,score:r.score,rotation:r.rotation,directionVerified:r.directionVerified,background:r.background}));
  const fixtures=[[/Average\s*time/i,'尝试识别模型生成新闻的平均耗时'],[/Duration/i,'时长（秒）'],[/control/i,'对照组（105 秒）'],[/Number\s*of\s*parameters/i,'参数量（对数刻度）']];
  for(const row of s.rows){const fixture=fixtures.find(([re])=>re.test(row.text));if(fixture){row.target=fixture[1];row.approved=true;row.fixture=true;}}
  s.replace=true;s.hidden=false;s.paint();s.panel.hidden=true;
  report.fixture='manual labels, not provider translations';
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
  report.mounted=[];
  for(const [name,v] of [['left',reader._internalReader._primaryView],['right',reader._internalReader._secondaryView]]){
   const w=v._iframeWindow,viewer=w.PDFViewerApplication.pdfViewer;
   for(const row of s.rows.filter(r=>r.target)){
    const page=viewer.getPageView(row.pageIndex),box=page.div.querySelector('[data-label-id="'+row.id+'"]');if(!box)continue;
    const corners=row.quad.map(p=>page.viewport.convertToViewportPoint(p[0],p[1])),cv=page.canvas||page.div.querySelector('.canvasWrapper canvas'),cr=cv.getBoundingClientRect(),br=box.getBoundingClientRect(),sx=cr.width/page.viewport.width,sy=cr.height/page.viewport.height;
    const expected={left:cr.left+Math.min(...corners.map(p=>p[0]))*sx,top:cr.top+Math.min(...corners.map(p=>p[1]))*sy,right:cr.left+Math.max(...corners.map(p=>p[0]))*sx,bottom:cr.top+Math.max(...corners.map(p=>p[1]))*sy};
    report.mounted.push({pane:name,text:row.text,target:row.target,mode:box.dataset.mode,fallback:box.dataset.fallback,error:Math.max(...['left','top','right','bottom'].map(k=>Math.abs(br[k]-expected[k]))),transform:box.style.transform,rect:br.toJSON(),font:box.firstChild?.style.fontSize,fit:box.dataset.fitMetrics});
   }
  }
  report.after=app.inplaceStats(reader);report.requestsAfter=app.allRequests.size;
  report.passed=report.recognized.some(r=>r.text==='control (105 seconds)'&&r.score>=.94)&&report.recognized.some(r=>/Duration/.test(r.text)&&r.rotation===270&&r.directionVerified)&&report.mounted.length===8&&report.mounted.every(r=>r.error<1)&&report.mounted.every(r=>r.mode==='replace')&&report.requestsBefore===0&&report.requestsAfter===0&&report.before.done===report.after.done;

 }catch(e){report.error=e.message;report.stack=e.stack;}
 await save();return {passed:report.passed,rows:report.rows,error:report.error};
})();
