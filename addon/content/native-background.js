/* Optional native text removal. Clean backgrounds only; Chinese remains DOM text.
 * External PyMuPDF runtime is separately installed. No dependency/model download.
 */
var CubeNativeBackground;
(function(root){'use strict';
 const VERSION='native-text-1';
 const PREF='extensions.zotero.paperloom.native.runtime';
 const validRect=r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[2]>r[0]&&r[3]>r[1];
 const bounds=q=>[Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1])),Math.max(...q.map(p=>p[0])),Math.max(...q.map(p=>p[1]))];
 const identity=r=>JSON.stringify([r.id,r.pageIndex,r.text,r.sourceQuad||r.quad,r.quad]);
 function eligible(r){return /^PDF(?:-|$)/.test(r.origin||'')&&!!r.target&&!r.legacyLayout&&!r.review&&!r.preserveSource&&!(r.warnings?.length)&&r.score>=.94&&r.directionVerified!==false;}
 function pixelAudit(before,after,rects,{margin=2}={}){
  if(before.width!==after.width||before.height!==after.height||before.data.length!==after.data.length)throw Error('native-render-size-mismatch');
  const {width:w,height:h}=before,mask=new Uint8Array(w*h);let changed=0,outside=0;
  for(const r of rects){if(!validRect(r))throw Error('invalid-erase-rect');for(let y=Math.max(0,Math.floor(r[1])-margin);y<Math.min(h,Math.ceil(r[3])+margin);y++)mask.fill(1,y*w+Math.max(0,Math.floor(r[0])-margin),y*w+Math.min(w,Math.ceil(r[2])+margin));}
  for(let n=0;n<w*h;n++){const i=n*4;if(before.data[i]!==after.data[i]||before.data[i+1]!==after.data[i+1]||before.data[i+2]!==after.data[i+2]||before.data[i+3]!==after.data[i+3]){changed++;if(!mask[n])outside++;}}
  return {changedPixels:changed,outsidePixels:outside,passed:outside===0};
 }
 function composeLocal(before,after,rects,{margin=2}={}){
  if(before.width!==after.width||before.height!==after.height||before.data.length!==after.data.length)throw Error('native-render-size-mismatch');
  const {width:w,height:h}=before,data=new Uint8ClampedArray(before.data);
  for(const r of rects){if(!validRect(r))throw Error('invalid-erase-rect');const x0=Math.max(0,Math.floor(r[0])-margin),x1=Math.min(w,Math.ceil(r[2])+margin);for(let y=Math.max(0,Math.floor(r[1])-margin);y<Math.min(h,Math.ceil(r[3])+margin);y++)data.set(after.data.subarray((y*w+x0)*4,(y*w+x1)*4),(y*w+x0)*4);}
  return {width:w,height:h,data};
 }
 function validateManifest(m,request){
  if(!m||m.version!==1||m.engine!==VERSION||m.sourceSHA256!==request.sourceSHA256||m.pageIndex!==request.pageIndex||m.coordinateSpace!=='pdf-user-space'||!m.checks||['remainingCharactersUnchanged','drawingGeometryAndStyleUnchanged','imageHashesUnchanged','sourceUnchanged'].some(k=>m.checks[k]!==true))throw Error('native-manifest-mismatch');
  if(!Array.isArray(m.labels)||m.labels.length!==request.labels.length)throw Error('native-label-count-mismatch');
  for(const r of request.labels){const a=m.labels.find(l=>l.id===r.id);if(!a||a.text!==r.text||JSON.stringify(a.sourceQuad)!==JSON.stringify(r.sourceQuad)||!validRect(a.eraseRect))throw Error('native-label-mismatch');}
  return m;
 }
 function attach(app,C,L){
  app.nativeJobs=new Set();app.nativeArtifactRevision=0;
  app.nativeBackgroundRuntime=function(){if(this.nativeRuntimeOverride)return this.nativeRuntimeOverride;try{return JSON.parse(Zotero.Prefs.get(PREF,true)||'{}');}catch{return {};}};
  app.nativeBackgroundFor=function(s,row){const a=s.nativeBackgrounds?.get(row.id);return a&&a.identity===identity(row)&&a.fingerprint===s.fingerprint&&a.verified&&eligible(row)?a:null;};
  app.closeNativeBackgrounds=function(s){s.nativeGeneration=(s.nativeGeneration||0)+1;s.nativeControl&&(s.nativeControl.stopped=true);s.nativeControl?.process?.kill();for(const task of s.nativeControl?.renderTasks||[])task.cancel();for(const task of s.nativeControl?.loadingTasks||[])task.destroy().catch(()=>{});s.nativeBackgrounds?.clear();};
  app.runNativeBackgroundWorker=async function(source,request,control){
   const cfg=this.nativeBackgroundRuntime();if(cfg.enabled!==true||!cfg.python)throw Error('native-backend-not-enabled');
   if(!await IOUtils.exists(cfg.python))throw Error('native-python-missing');
   const parent=PathUtils.join(this.dir,'native-backgrounds');await IOUtils.makeDirectory(parent,{ignoreExisting:true});
   const folder=PathUtils.join(parent,crypto.randomUUID());await IOUtils.makeDirectory(folder,{ignoreExisting:true});
   const file=PathUtils.join(folder,'source.pdf'),req=PathUtils.join(folder,'request.json'),worker=PathUtils.join(folder,'worker.py'),out=PathUtils.join(folder,'artifact');
   let proc,timer;
   try{
    await IOUtils.write(file,source);await IOUtils.writeUTF8(req,JSON.stringify(request));
    await IOUtils.writeUTF8(worker,await(await fetch(this.runtimeRoot+'content/native-background.py')).text());
    if(control.stopped||this.stopped)throw Error('native-cancelled');
    const {Subprocess}=ChromeUtils.importESModule('resource://gre/modules/Subprocess.sys.mjs');
    proc=await Subprocess.call({command:cfg.python,arguments:[worker,'--input',file,'--request',req,'--output-dir',out],stderr:'ignore'});control.process=proc;this.nativeJobs.add(proc);
    if(control.stopped||this.stopped)proc.kill();timer=setTimeout(()=>proc.kill(),120000);
    const drain=(async()=>{while(await proc.stdout.readString()){} })();const result=await proc.wait();await drain;
    if(control.stopped||this.stopped)throw Error('native-cancelled');
    if(result.exitCode!==0)throw Error('native-worker-rejected-source');
    const manifest=JSON.parse(await IOUtils.readUTF8(PathUtils.join(out,'manifest.json')));validateManifest(manifest,request);
    const original=await IOUtils.read(PathUtils.join(out,'original.pdf')),clean=await IOUtils.read(PathUtils.join(out,'clean.pdf'));
    if(original.length>80*1024*1024||clean.length>80*1024*1024||await this.nativeBytesHash(original)!==manifest.originalSHA256||await this.nativeBytesHash(clean)!==manifest.cleanSHA256)throw Error('native-output-digest-mismatch');
    return {manifest,original,clean};
   }finally{clearTimeout(timer);if(proc)this.nativeJobs.delete(proc);control.process=null;await IOUtils.remove(folder,{recursive:true,ignoreAbsent:true}).catch(()=>{});}
  };
  app.nativeBytesHash=async function(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');};
  app.renderNativeBackgroundPair=async function(win,artifact,pdf,request,control){
   const un=v=>typeof Components!=='undefined'&&Components.utils?.waiveXrays?Components.utils.waiveXrays(v):v;
   const w=un(win),clone=v=>typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto(v,w,{wrapReflectors:true}):v;
   if(!w.pdfjsLib?.getDocument)throw Error('pdfjs-loader-missing');
   const tasks=[],canvases=[];
   try{
    const live=un(await pdf.getPage(request.pageIndex+1)),base=un(live.getViewport(clone({scale:1,rotation:0}))),scale=Math.min(2,Math.sqrt(6000000/(base.width*base.height)));
    const viewport=un(live.getViewport(clone({scale,rotation:0}))),render=async page=>{
     const vp=un(page.getViewport(clone({scale,rotation:0})));
     if(JSON.stringify(Array.from(vp.transform))!==JSON.stringify(Array.from(viewport.transform))||vp.width!==viewport.width||vp.height!==viewport.height)throw Error('native-page-geometry-mismatch');
     const cv=w.document.createElement('canvas');cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);canvases.push(cv);
     const args=new w.Object();args.canvas=cv;args.canvasContext=cv.getContext('2d',{willReadFrequently:true});args.viewport=vp;args.annotationMode=0;args.intent='print';
     const task=un(page.render(args));control.renderTasks||=new Set();control.renderTasks.add(task);const timer=setTimeout(()=>task.cancel(),45000);try{if(control.stopped)task.cancel();await task.promise;}finally{clearTimeout(timer);control.renderTasks.delete(task);}return cv;
    };
    const originalLive=await render(live),loaded=[];
    for(const bytes of [artifact.original,artifact.clean]){
     if(control.stopped||this.stopped)throw Error('native-cancelled');
     const opts=new w.Object();opts.data=new w.Uint8Array(bytes.length);for(let i=0;i<bytes.length;i+=65536)opts.data.set(clone(Array.from(bytes.subarray(i,i+65536))),i);opts.isEvalSupported=false;opts.enableXfa=false;
     const task=un(w.pdfjsLib.getDocument(opts));tasks.push(task);control.loadingTasks||=new Set();control.loadingTasks.add(task);if(control.stopped)task.destroy().catch(()=>{});const doc=un(await task.promise);loaded.push(await render(un(await doc.getPage(1))));
    }
    const image=cv=>cv.getContext('2d').getImageData(0,0,cv.width,cv.height),rects=artifact.manifest.labels.map(r=>L.mapRect(Array.from(viewport.transform),r.eraseRect));
    const originalPixels=image(originalLive),reloadAudit=pixelAudit(originalPixels,image(loaded[0]),[]),rawEraseAudit=pixelAudit(image(loaded[0]),image(loaded[1]),rects);
    if(!reloadAudit.passed)throw Error('native-pdfjs-source-audit-failed');
    // Redaction reserializes unrelated numeric operands. Never propagate their
    // antialias noise: only verified source-label ink regions may be replaced.
    const composed=composeLocal(originalPixels,image(loaded[1]),rects),eraseAudit=pixelAudit(originalPixels,composed,rects);
    if(!eraseAudit.passed)throw Error('native-pdfjs-composite-audit-failed');
    const ctx=loaded[1].getContext('2d'),pixels=ctx.createImageData(composed.width,composed.height);pixels.data.set(clone(composed.data));ctx.putImageData(pixels,0,0);
    return {canvas:loaded[1],viewport,diagnostics:{reloadAudit,rawEraseAudit,eraseAudit},dispose:()=>{for(const c of canvases)c.width=c.height=0;}};
   }catch(e){for(const c of canvases)c.width=c.height=0;throw e;}
   finally{for(const task of tasks){control.loadingTasks?.delete(task);await task.destroy().catch(()=>{});}}
  };
  app.prepareNativeBackgrounds=async function(s,pageIndex,{rows=s.rows.filter(r=>r.pageIndex===pageIndex&&eligible(r))}={}){
   if(s.nativeControl)throw Error('native-job-busy');
   if(!rows.length)return {prepared:0};
   if(rows.some(r=>r.pageIndex!==pageIndex||!eligible(r)))throw Error('native-ineligible-label');
   const cfg=this.nativeBackgroundRuntime();if(cfg.enabled!==true)throw Error('native-backend-not-enabled');
   if(rows.every(r=>this.nativeBackgroundFor(s,r)))return {prepared:0,cached:rows.length};
   const control={stopped:false,renderTasks:new Set()},generation=s.nativeGeneration||0;s.nativeControl=control;
   const snapshots=rows.map(r=>({row:r,identity:identity(r)}));let pair;
   try{
    const win=s.reader._internalReader?._primaryView?._iframeWindow,pdf=win?.PDFViewerApplication?.pdfDocument;if(!pdf)throw Error('native-reader-closed');
    const source=new Uint8Array(await pdf.getData());if(source.length>80*1024*1024)throw Error('native-input-too-large');
    const request={version:1,sourceSHA256:await this.nativeBytesHash(source),pageIndex,labels:rows.map(r=>({id:r.id,text:r.text,sourceQuad:r.sourceQuad||r.quad}))};
    const artifact=await this.runNativeBackgroundWorker(source,request,control);
    pair=await this.renderNativeBackgroundPair(win,artifact,pdf,request,control);
    if(control.stopped||this.stopped||(s.nativeGeneration||0)!==generation||snapshots.some(x=>identity(x.row)!==x.identity))throw Error('native-stale-result');
    const patches=[],skipped=[];
    for(const r of rows){const erase=artifact.manifest.labels.find(l=>l.id===r.id).eraseRect,frame=bounds(r.quad);
     const pad=2/pair.viewport.scale;
     if(erase[0]-pad<frame[0]||erase[1]-pad<frame[1]||erase[2]+pad>frame[2]||erase[3]+pad>frame[3]){skipped.push({id:r.id,reason:'frame-does-not-contain-erase-margin'});continue;}
     // A frame must not erase another label whose own text may fall back.
     if(artifact.manifest.labels.some(l=>l.id!==r.id&&L.intersection(frame,[l.eraseRect[0]-pad,l.eraseRect[1]-pad,l.eraseRect[2]+pad,l.eraseRect[3]+pad])>0)){skipped.push({id:r.id,reason:'frame-intersects-other-erasure'});continue;}
     // Use PDF-space axis-aligned frame, then orient through the existing quad.
     const G=typeof PaperLoomGraphics!=='undefined'?PaperLoomGraphics:null;if(!G)throw Error('graphics-module-missing');
     const p=G.project(r.quad,Array.from(pair.viewport.transform)),inv=G.inverse(p.matrix),cv=win.document.createElement('canvas'),factor=pair.viewport.scale;
     cv.width=Math.ceil(p.width*factor);cv.height=Math.ceil(p.height*factor);const cx=cv.getContext('2d');cx.setTransform(factor*inv[0],factor*inv[1],factor*inv[2],factor*inv[3],factor*inv[4],factor*inv[5]);cx.drawImage(pair.canvas,0,0);
     patches.push([r.id,{identity:identity(r),fingerprint:s.fingerprint,verified:true,url:cv.toDataURL('image/png'),sourceSHA256:request.sourceSHA256,diagnostics:pair.diagnostics}]);cv.width=cv.height=0;
    }
    s.nativeBackgrounds||=new Map();for(const [id,p]of patches)s.nativeBackgrounds.set(id,p);this.nativeArtifactRevision++;s.paintKeys=new WeakMap();s.paint();
    return {prepared:patches.length,requested:rows.length,skipped,sourceSHA256:request.sourceSHA256,diagnostics:pair.diagnostics};
   }finally{pair?.dispose();for(const task of control.renderTasks)task.cancel();s.nativeControl=null;}
  };
 }
 const api={VERSION,eligible,identity,pixelAudit,composeLocal,validateManifest,attach};CubeNativeBackground=root.CubeNativeBackground=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
