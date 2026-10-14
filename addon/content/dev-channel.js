/* Development-build only mailbox. Loaded by bootstrap's explicit build marker.
   No TCP listener, generic evaluation, provider configuration, or arbitrary paths.
 */
var CubeDevChannel;
(function(root){'use strict';
 const ACTIONS=Object.freeze(['status','pause-archive','prepare-native','native-page','inspect-page','audit-layout','update-build','resume-article','open-reader','refresh-page','translate-page','repair-flow-page','inspect-reader-ui','audit-interaction','ocr-selftest','region-translate','region-shortcut','stop']);
 function validateRequest(r,sessionId,now=Date.now()){
  if(!r||r.version!==1||r.sessionId!==sessionId)throw Error('Invalid development session');
  if(typeof r.id!=='string'||!/^job-[a-f0-9]{32}$/.test(r.id))throw Error('Invalid job id');
  if(!ACTIONS.includes(r.action))throw Error('Unknown development action');
  if(!Number.isFinite(r.createdAt)||Math.abs(now-r.createdAt)>30000)throw Error('Stale request');
  if(Object.keys(r).some(k=>!['version','sessionId','id','action','createdAt','itemID','pageIndex','rect'].includes(k)))throw Error('Unexpected request fields');
  if(['native-page','inspect-page','refresh-page','translate-page','repair-flow-page'].includes(r.action)){
   if(!Number.isInteger(r.itemID)||r.itemID<1||!Number.isInteger(r.pageIndex)||r.pageIndex<0)throw Error('Native page requires valid itemID and pageIndex');
  }else if(['resume-article','open-reader','audit-interaction','inspect-reader-ui'].includes(r.action)){if(!Number.isInteger(r.itemID)||r.itemID<1||r.pageIndex!==undefined)throw Error('Item action requires itemID only');}
  else if(['region-translate','region-shortcut'].includes(r.action)){if(!Number.isInteger(r.itemID)||r.itemID<1)throw Error('Region action requires itemID');}
  else if(r.itemID!==undefined||r.pageIndex!==undefined)throw Error('Unexpected page parameters');
  return r;
 }
 function attach(app){
  app.devStatus=async function(){const ocr=await this.ocrInstallState?.().catch(e=>({installed:false,reason:e.message}))||null;return {version:this.version,stopped:!!this.stopped,requests:this.allRequests.size,ocr,readers:(Zotero.Reader._readers||[]).map(r=>{
   const out={};try{out.itemID=r.itemID;out.graphicsFailures=[...this.inplace?.get(r)?.graphicJob?.failed||[]].slice(0,4).map(([page,error])=>[page+1,String(error&&error.message||error).slice(0,180)]);const s=this.inplace?.get(r),g=this.graphicSessions?.get(r);out.stats=s?this.inplaceStats(r):null;if(s?.graphicJob)out.graphicJob={pending:[...s.graphicJob.pending],completed:s.graphicJob.completed.size,failed:[...s.graphicJob.failed],current:s.graphicJob.current,lastError:s.graphicJob.lastError};out.graphics=g?{rows:g.rows.length,translated:g.rows.filter(x=>x.target&&!x.legacyLayout).length,busy:g.busy,native:g.lastNative,nativeCached:g.nativeBackgrounds?.size||0,summary:this.articleGraphicsSummary?.(r)}:null;
    try{out.pages=r._internalReader?._primaryView?._iframeWindow?.PDFViewerApplication?.pdfDocument?.numPages;}catch(e){out.readerUnavailable=e.message;}
   }catch(e){out.readerUnavailable=e.message;}return out;
  })};};
  app.devPauseArchive=async function({exportPDF=false}={}){
   for(const [r]of this.inplace||[])this.pauseInPlace(r,true);
   for(const [,g]of this.graphicSessions||[]){g.control.stopped=true;g.control.process?.kill();g.control.renderTask?.cancel();for(const req of g.control.requests||[])req.abort();}
   const busy=()=>this.allRequests.size||[...this.inplace?.values()||[]].some(s=>s.workers)||[...this.graphicSessions?.values()||[]].some(g=>g.busy||g.nativeControl);
   for(let i=0;i<1200&&busy();i++)await new Promise(r=>setTimeout(r,100));if(busy())throw Error('Active jobs remain');
   await this.flushCheckpoints?.();for(const [,g]of this.graphicSessions||[])await this.saveGraphics(g);await this.writeChain;
   const record={at:new Date().toISOString(),version:this.version,sessions:[...this.inplace||[]].map(([r,s])=>({itemID:r.itemID,paused:s.paused,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited,layout:v.layout,alignment:v.alignment||null}))})),graphics:[...this.graphicSessions||[]].map(([r,g])=>({itemID:r.itemID,file:g.file,fingerprint:g.fingerprint,replace:g.replace,hidden:g.hidden,rows:g.rows.map(({element,...row})=>row)}))};
   const folder=PathUtils.join(this.devChannel.directory,'archives',crypto.randomUUID());await IOUtils.makeDirectory(folder,{ignoreExisting:true});await IOUtils.writeUTF8(PathUtils.join(folder,'snapshot.json'),JSON.stringify(record));
   const exported=[];
   if(exportPDF)for(const [r]of this.inplace||[]){const pdf=r._internalReader?._primaryView?._iframeWindow?.PDFViewerApplication?.pdfDocument;if(!pdf)continue;const bytes=new Uint8Array(await pdf.getData());if(bytes.length>80*1024*1024)throw Error('PDF export exceeds development limit');const file=PathUtils.join(folder,'source-'+r.itemID+'.pdf');await IOUtils.write(file,bytes);exported.push({itemID:r.itemID,file,sha256:await this.nativeBytesHash(bytes)});}
   return {archive:PathUtils.join(folder,'snapshot.json'),exported,status:await this.devStatus()};
  };
  // Verify the shortcut preference round-trips in the real host and that the
  // synthetic key press installs the region covers on the page.
  // 识别只有本地 Python 一条路：用一张合成图把它端到端跑一遍，安装是否可用就看这个。
  app.devOCRSelftest=async function(){
    const cfg=this.graphicRuntime(),paths={python:!!cfg.python,runtime:!!cfg.runtime,models:!!cfg.models};
    for(const [k,v] of Object.entries(paths))if(!v)return {ok:false,reason:'未配置 '+k+' 路径',paths};
    const win=Zotero.getMainWindow(),doc=win.document,canvas=doc.createElement('canvas');
    canvas.width=640;canvas.height=160;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,640,160);ctx.fillStyle='#000';ctx.font='48px Times New Roman';
    ctx.fillText('Figure 8 Power Grid',24,100);
    const t0=Date.now();let parsed;
    try{parsed=await this.runGraphicOCR(canvas,{stopped:false,requests:new Set()});}
    catch(e){return {ok:false,reason:String(e&&e.message||e).slice(0,200),paths};}
    const lines=(parsed&&parsed.lines||[]).map(l=>({text:l.text,score:l.score,corners:(l.polygon||l.quad||[]).length}));
    return {ok:lines.length>0,lines:lines.length,ms:Date.now()-t0,width:parsed&&parsed.width,height:parsed&&parsed.height,sample:lines.slice(0,2),paths};
  };
  app.devRegionShortcut=async function(r){
   const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID)||(Zotero.Reader._readers||[])[0];
   if(!reader)throw Error('No reader open');
   const before=this.readerShortcut(),set=this.setReaderShortcut('Ctrl+Alt+K'),read=this.readerShortcut(),restore=this.setReaderShortcut(before);
   const s=await this.openGraphics(reader),w=reader._internalReader?._primaryView?._iframeWindow||s.win;
   const matched=this.matchShortcut(this.readerShortcut(),{altKey:true,key:'r'}),negative=this.matchShortcut(this.readerShortcut(),{key:'r'});
   const event=new w.KeyboardEvent('keydown',{key:'r',code:'KeyR',altKey:true,bubbles:true,cancelable:true});
   let error='';
   try{w.document.dispatchEvent(event);await new Promise(resolve=>setTimeout(resolve,400));}
   catch(e){error=e.message||String(e);}
   const covers=w.document.querySelectorAll('.pl-graphic-select').length;
   s.selection?.();await new Promise(resolve=>setTimeout(resolve,100));
   return {itemID:reader.itemID,before,set,read,restore,matched,negative,defaultPrevented:event.defaultPrevented,covers,error,cleaned:w.document.querySelectorAll('.pl-graphic-select').length};
  };
  // Exercise the manual box-selection pipeline without a physical mouse: crop the
  // given PDF rect (or the stored graphic bounds) and run recognise + translate.
  app.devRegionTranslate=async function(r){
   const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID)||(Zotero.Reader._readers||[])[0];
   if(!reader)throw Error('No reader open');
   const s=await this.openGraphics(reader),w=reader._internalReader?._primaryView?._iframeWindow||s.win,v=w.PDFViewerApplication.pdfViewer,pdf=w.PDFViewerApplication.pdfDocument;
   const index=r.pageIndex??(v.currentPageNumber-1);if(index>=pdf.numPages)throw Error('Page out of range');
   v.currentPageNumber=index+1;
   for(let i=0;i<80;i++){await new Promise(resolve=>setTimeout(resolve,100));const pv=v.getPageView(index);if(pv?.renderingState===3&&pv.canvas)break;}
   const pv=v.getPageView(index),canvas=pv?.canvas;if(!canvas?.width||pv.renderingState!==3)throw Error('Page not rendered');
   let rect=r.rect;
   if(!rect){
    const rowBounds=(s.rows||[]).filter(x=>x.pageIndex===index).map(x=>({x0:x.quad[0][0],y0:x.quad[0][1],x1:x.quad[2][0],y1:x.quad[2][1]}));
    rect=rowBounds.length?[Math.min(...rowBounds.map(b=>b.x0))-2,Math.min(...rowBounds.map(b=>b.y0))-2,Math.max(...rowBounds.map(b=>b.x1))+2,Math.max(...rowBounds.map(b=>b.y1))+2]
     :[40,40,pv.viewport.width-40,pv.viewport.height-40];
   }
   let ocrProbe={};
   try{
    const sx=canvas.width/pv.viewport.width,sy=canvas.height/pv.viewport.height,x=Math.max(0,Math.floor(rect[0]*sx)),y=Math.max(0,Math.floor(rect[1]*sy)),right=Math.min(canvas.width,Math.ceil(rect[2]*sx)),bottom=Math.min(canvas.height,Math.ceil(rect[3]*sy));
    const crop=w.document.createElement('canvas');crop.width=Math.max(1,right-x);crop.height=Math.max(1,bottom-y);crop.getContext('2d',{willReadFrequently:true}).drawImage(canvas,x,y,crop.width,crop.height,0,0,crop.width,crop.height);
    const parsed=await this.runGraphicOCR(crop,{});
    ocrProbe={crop:[crop.width,crop.height],lines:(parsed?.lines||[]).length,engine:parsed?.engine,sample:(parsed?.lines||[]).slice(0,8).map(l=>l.text)};
   }catch(e){ocrProbe={error:e.message||String(e)};}
   const before={rows:s.rows.length,pageRows:(s.rows||[]).filter(x=>x.pageIndex===index).length,hidden:s.hidden};
   const started=Date.now();let error='';
   const idle=await this.waitGraphicIdle(s,30000);
   try{await this.recognizeGraphicRegion(s,w,pv,canvas,index,Array.from(rect),{manual:true,article:this.inplace?.get(reader)});}
   catch(e){error=e.message||String(e);}
   await new Promise(resolve=>setTimeout(resolve,300));
   const pageRows=(s.rows||[]).filter(x=>x.pageIndex===index);
   return {itemID:reader.itemID,page:index+1,ocrProbe,idle,merge:s.lastMerge||null,ocrError:s.lastOcrError||'',rect:Array.from(rect),ms:Date.now()-started,error,message:s.message,hidden:s.hidden,before,
    rows:{total:s.rows.length,page:pageRows.length,selected:pageRows.filter(x=>x.selected).length,translated:pageRows.filter(x=>x.target).length,origins:[...new Set(pageRows.map(x=>x.origin))]},
    overlays:pv.div.querySelectorAll('.pl-graphic-anchor').length,
    overlayCounts:[s.reader._internalReader?._primaryView?._iframeWindow,s.reader._internalReader?._secondaryView?._iframeWindow].map(x=>x?.document?x.document.querySelectorAll('.pl-graphic-anchor').length:-1),
    rowAnchors:pageRows.map(x=>[x.id,!!(s.reader._internalReader?._secondaryView?._iframeWindow?.document||s.reader._internalReader?._primaryView?._iframeWindow?.document)?.querySelector('[data-label-id="'+x.id+'"]')]),
    lastTranslation:s.lastTranslation||null,lastRegion:s.lastRegion||null,
    replace:!!s.replace,reasons:pageRows.map(x=>this.replacementReason?this.replacementReason(x,s.rows.filter(y=>y!==x)):null),
    detail:pageRows.map(x=>({text:x.text,origin:x.origin,selected:!!x.selected,preserveSource:!!x.preserveSource,legacyLayout:!!x.legacyLayout,target:x.target||'',error:x.error||'',review:!!x.review,score:x.score})),
    samples:pageRows.filter(x=>x.target).slice(0,4).map(x=>({text:x.text,target:x.target,origin:x.origin}))};
  };
  app.devInspectPage=async function(r){
   const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID&&this.inplace?.has(x)),s=this.inplace?.get(reader);
   if(!s||!s.paused||s.workers||this.allRequests.size)throw Error('Inspect requires a paused, idle session');
   const w=s.win,v=w.PDFViewerApplication.pdfViewer,pdf=w.PDFViewerApplication.pdfDocument;if(r.pageIndex>=pdf.numPages)throw Error('Page out of range');
   if(w.document.hidden)throw Error('Select this reader tab before visual inspection; hidden-tab screenshots are not valid evidence');
   const old={page:v.currentPageNumber,scale:v.currentScaleValue,sync:s.syncEnabled};const dir=PathUtils.join(this.devChannel.directory,'inspections',crypto.randomUUID());await IOUtils.makeDirectory(dir,{ignoreExisting:true});
   try{s.syncEnabled=false;v.currentScaleValue='page-fit';v.currentPageNumber=r.pageIndex+1;
    for(let i=0;i<80;i++){await new Promise(resolve=>setTimeout(resolve,100));const pv=v.getPageView(r.pageIndex);if(pv?.renderingState===3&&pv.div?.querySelector('canvas'))break;}
    if(v.getPageView(r.pageIndex)?.renderingState!==3)throw Error('Visual inspection page render timed out');
    for(let i=0;i<12;i++){s.rescan();s.repaint();this.graphicSessions?.get(reader)?.paint();await new Promise(resolve=>setTimeout(resolve,100));const pv=v.getPageView(r.pageIndex),rs=[...s.records.values()].filter(x=>x.layout.pageIndex===r.pageIndex&&!x.layoutConflict);if(pv?.renderingState===3&&rs.every(x=>x.block?.el?.isConnected&&x.block.el.parentNode===pv.div&&x.block.el.getBoundingClientRect().height>0))break;}
    const pv=v.getPageView(r.pageIndex),query=Components.utils.cloneInto({pageIndex:r.pageIndex},w),data=await pdf.getPageData(query),ops=await this.readOperatorGeometry(await pdf.getPage(r.pageIndex+1));
    await IOUtils.writeUTF8(PathUtils.join(dir,'source.json'),JSON.stringify({pageIndex:r.pageIndex,data,operatorList:ops}));
    const report={version:this.version,itemID:r.itemID,pageIndex:r.pageIndex,viewport:{transform:Array.from(pv.viewport.transform),width:pv.viewport.width,height:pv.viewport.height},records:[],graphics:[]};
    for(const rec of s.records.values())if(rec.layout.pageIndex===r.pageIndex){const box=rec.block?.el,body=box?.firstChild;report.records.push({id:rec.id,source:rec.text,target:rec.target,layout:rec.layout,renderedRect:rec.renderedRect,css:box?.style.cssText,bodyCSS:body?.style.cssText,connected:!!box?.isConnected,mountedOnCurrentPage:box?.parentNode===pv.div,metrics:body?this.measureInPlaceText(box,body):null,dataset:box?{...box.dataset}:null});}
    for(const n of pv.div.querySelectorAll('.pl-graphic-anchor'))report.graphics.push({id:n.dataset.labelId,mode:n.dataset.mode,reason:n.dataset.fallback,maskResult:n.dataset.maskResult,fitMetrics:n.dataset.fitMetrics,css:n.style.cssText,bodyCSS:n.firstChild?.style?.cssText,descendants:n.childNodes.length,background:n.ownerDocument.defaultView.getComputedStyle(n).backgroundColor,bodyComputed:n.firstChild?{size:n.ownerDocument.defaultView.getComputedStyle(n.firstChild).fontSize,shadow:n.ownerDocument.defaultView.getComputedStyle(n.firstChild).textShadow,weight:n.ownerDocument.defaultView.getComputedStyle(n.firstChild).fontWeight}:null});
    const g=this.graphicSessions?.get(reader);report.graphicDiagnostics=[];
    for(const box of pv.div.querySelectorAll('.pl-graphic-anchor')){const body=box.firstChild;if(!body)continue;const st=w.getComputedStyle(body),br=body.getBoundingClientRect(),fr=box.getBoundingClientRect(),row=g?.rows.find(x=>x.id===box.dataset.labelId),ranges=[];if(body.firstChild?.nodeType===3)for(let i=0;i<Math.min(28,body.textContent.length);i++){const range=w.document.createRange();range.setStart(body.firstChild,i);range.setEnd(body.firstChild,i+1);const b=range.getBoundingClientRect();ranges.push({t:body.textContent[i],x:b.x,y:b.y,w:b.width,h:b.height});range.detach();}report.graphicDiagnostics.push({id:box.dataset.labelId,source:row?.text,target:body.textContent,frame:{x:fr.x,y:fr.y,w:fr.width,h:fr.height},body:{x:br.x,y:br.y,w:br.width,h:br.height},computed:Object.fromEntries(['font-family','font-size','line-height','letter-spacing','word-spacing','font-stretch','transform','text-indent','white-space','width','height'].map(k=>[k,st.getPropertyValue(k)])),ranges});}
    const h=Zotero.getMainWindow(),rect=pv.div.getBoundingClientRect(),cv=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');cv.width=Math.ceil(rect.width);cv.height=Math.ceil(rect.height);cv.getContext('2d').drawWindow(w,rect.left,rect.top,rect.width,rect.height,'#fff');const raw=h.atob(cv.toDataURL('image/png').split(',')[1]);await IOUtils.write(PathUtils.join(dir,'page.png'),Uint8Array.from(raw,c=>c.charCodeAt(0)));
    const bodies=[...pv.div.querySelectorAll('.pl-graphic-anchor > span')],visibility=bodies.map(n=>n.style.visibility);try{for(const n of bodies)n.style.visibility='hidden';await new Promise(resolve=>setTimeout(resolve,100));cv.getContext('2d').drawWindow(w,rect.left,rect.top,rect.width,rect.height,'#fff');const hidden=h.atob(cv.toDataURL('image/png').split(',')[1]);await IOUtils.write(PathUtils.join(dir,'masks-only.png'),Uint8Array.from(hidden,c=>c.charCodeAt(0)));}finally{bodies.forEach((n,i)=>n.style.visibility=visibility[i]);cv.width=cv.height=0;}
    const originals=[...pv.div.querySelectorAll('.pl-graphic-anchor > span')].map(n=>({n,css:n.style.cssText}));
    const captureVariant=async(name)=>{await new Promise(resolve=>setTimeout(resolve,80));const c=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=Math.ceil(rect.width*2);c.height=Math.ceil(rect.height*2);const ctx=c.getContext('2d');ctx.scale(2,2);ctx.drawWindow(w,rect.left,rect.top,rect.width,rect.height,'#fff');const raw=h.atob(c.toDataURL('image/png').split(',')[1]);await IOUtils.write(PathUtils.join(dir,name+'.png'),Uint8Array.from(raw,ch=>ch.charCodeAt(0)));c.width=c.height=0;};
    try{await captureVariant('detail-default');for(const {n}of originals)n.style.fontFamily='"SimSun",serif';await captureVariant('detail-serif');}finally{for(const {n,css}of originals)n.style.cssText=css;}
    await IOUtils.writeUTF8(PathUtils.join(dir,'report.json'),JSON.stringify(report));return {directory:dir,records:report.records.length,overflow:report.records.filter(x=>x.dataset?.overflow==='true').length,graphics:report.graphics.length};
   }finally{v.currentScaleValue=old.scale;v.currentPageNumber=old.page;s.syncEnabled=old.sync;s.rescan();}
  };
  app.devAuditLayout=async function(){
   const report={at:new Date().toISOString(),version:this.version,sessions:[]};
   for(const [reader,s]of this.inplace||[]){if(!s.paused||s.workers||this.allRequests.size)throw Error('Audit requires paused idle sessions');const host=s.doc.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;width:1000px;pointer-events:none;';s.doc.body.appendChild(host);const result={itemID:reader.itemID,checked:0,failures:[],unmeasured:0};
    try{for(const r of s.records.values()){if(r.status!=='done')continue;const page=s.layout.pages[r.layout.pageIndex],el=s.doc.createElement('div');el.style.cssText='position:relative;width:1000px;height:1200px;';host.appendChild(el);const rec={...r,block:null},vp={transform:[1,0,0,-1,-page.viewBox[0],page.viewBox[3]]};const b=this.paintStructuredBlock(s,rec,el,vp);const m=b?this.measureInPlaceText(b,b.firstChild):null;result.checked++;if(!m?.measurable)result.unmeasured++;if(!m?.fits)result.failures.push({id:r.id,page:r.layout.pageIndex+1,source:r.text,target:r.target,layout:r.layout,metrics:m,css:b?.style.cssText,bodyCSS:b?.firstChild?.style.cssText});el.remove();if(result.checked%20===0)await new Promise(resolve=>setTimeout(resolve,0));}}finally{host.remove();}report.sessions.push(result);
   }const dir=PathUtils.join(this.devChannel.directory,'inspections',crypto.randomUUID());await IOUtils.makeDirectory(dir,{ignoreExisting:true});await IOUtils.writeUTF8(PathUtils.join(dir,'layout-audit.json'),JSON.stringify(report));return {directory:dir,sessions:report.sessions.map(s=>({itemID:s.itemID,checked:s.checked,failures:s.failures.length,unmeasured:s.unmeasured}))};
  };
  app.devAuditInteraction=async function(r){
   const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID&&this.inplace?.has(x)),s=this.inplace?.get(reader);if(!s?.paused||s.workers||this.allRequests.size)throw Error('Interaction audit requires paused idle session');
   const w=s.win,v=w.PDFViewerApplication.pdfViewer;if(w.document.hidden)throw Error('Select the reader tab before interaction audit');
   const old={scale:v.currentScaleValue,sync:s.syncEnabled},selected=w.getSelection(),report={version:this.version,itemID:r.itemID,scope:'host DOM selection/copy event and scale audit, not physical mouse drag',scales:[]};
   try{s.syncEnabled=true;for(const scale of [.75,1,1.5,2]){v.currentScaleValue=scale;await new Promise(resolve=>setTimeout(resolve,700));s.rescan();s.repaint();await new Promise(resolve=>setTimeout(resolve,300));
    const records=[...s.records.values()].filter(x=>x.status==='done'&&x.block?.el?.isConnected&&x.block.el.getBoundingClientRect().height>0),rec=records.find(x=>x.target.length>30);if(!rec)throw Error('No mounted translated paragraph');
    const body=rec.block.el.querySelector('.pl-inplace-text'),range=PaperLoomSelection.domRange(body,0,Math.min(12,rec.target.length));selected.removeAllRanges();selected.addRange(range);const text=selected.toString();
    const capture={text:null,cleared:false},e=new w.Event('copy',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{clearData(){capture.cleared=true;},setData(type,value){if(type==='text/plain')capture.text=value;}}});w.dispatchEvent(e);
    if(s.selectionSync){s.selectionSync.origin='right';s.selectionSync.update();}
    const left=reader._internalReader?._primaryView?._iframeWindow,fit=this.measureInPlaceText(rec.block.el,body),entry={scale,id:rec.id,selectionExact:text===rec.target.slice(0,12),copyExact:capture.text===text,copyPrevented:e.defaultPrevented,linkedDetails:s.selectionSync?.details?.length||0,linkedMarks:s.selectionSync?.nodes?.length||0,fit:fit.fits,leftTranslatedOverlays:left?.document.querySelectorAll('.pl-inplace,.pl-graphic-anchor').length||0};report.scales.push(entry);
   }}finally{selected.removeAllRanges();s.selectionSync?.clear();s.syncEnabled=old.sync;v.currentScaleValue=old.scale;s.rescan();}
   report.passed=report.scales.every(x=>x.selectionExact&&x.copyExact&&x.copyPrevented&&x.linkedDetails>0&&x.linkedMarks>0&&x.fit&&x.leftTranslatedOverlays===0);
   const dir=PathUtils.join(this.devChannel.directory,'inspections',crypto.randomUUID());await IOUtils.makeDirectory(dir,{ignoreExisting:true});await IOUtils.writeUTF8(PathUtils.join(dir,'interaction-audit.json'),JSON.stringify(report));return {directory:dir,...report};
  };
  app.startDevChannel=async function(config){
   if(this.devChannel&&!this.devChannel.stopped)return;
   if(!config||typeof config.directory!=='string'||!config.directory)throw Error('Development mailbox path missing');
   const directory=config.directory,sessionId=crypto.randomUUID(),started=Date.now(),expiresAt=started+2*60*60*1000;
   const state={directory,sessionId,stopped:false,busy:false,seen:new Set(),timer:null};this.devChannel=state;
   await IOUtils.makeDirectory(directory,{ignoreExisting:true});const file=n=>PathUtils.join(directory,n),request=file('request.json'),active=file('active.json');
   for(const p of [request,active])await IOUtils.remove(p,{ignoreAbsent:true});
   const publish=async(id,value)=>{for(let n=0;;n++){try{return await IOUtils.writeUTF8(file(id+'.json'),JSON.stringify(value),{tmpPath:file(id+'.tmp')});}catch(e){if(n>=5)throw e;await new Promise(r=>setTimeout(r,50));}}};
   const execute=async r=>{
    if(r.action==='status')return await this.devStatus();
    if(r.action==='ocr-selftest')return this.devOCRSelftest();
    if(r.action==='region-translate')return this.devRegionTranslate(r);
    if(r.action==='region-shortcut')return this.devRegionShortcut(r);
    if(r.action==='open-reader'){const existing=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID);let dead=false;try{dead=!!existing&&!existing._internalReader?._primaryView?._iframeWindow?.document;}catch{dead=true;}await Zotero.Reader.open(r.itemID,undefined,{allowDuplicate:dead});return {opened:r.itemID,replacedStaleTab:dead};}
    if(r.action==='resume-article'){const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID&&this.inplace?.has(x));if(!reader)throw Error('Open session required');this.pauseInPlace(reader,false);return {resumed:!this.inplace.get(reader).paused,status:await this.devStatus()};}
    if(r.action==='refresh-page'){const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID&&this.inplace?.has(x)),s=this.inplace?.get(reader);if(!s?.paused||s.workers||this.allRequests.size)throw Error('Refresh requires paused idle session');await this.devPauseArchive();const g=await this.autoTranslateGraphics(reader,{translate:false,pageIndex:r.pageIndex,force:true,background:true});return {rows:g.rows.length,message:g.message};}
    if(r.action==='translate-page'||r.action==='repair-flow-page'){
     const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID&&this.inplace?.has(x)),s=this.inplace?.get(reader);if(!s?.paused||s.workers||this.allRequests.size)throw Error('Page translation requires paused idle session');await this.devPauseArchive();
     const g=await this.graphicSession(reader);g.replace=true;g.hidden=false;const repaired=[];
     if(r.action==='repair-flow-page'){for(const x of g.rows.filter(x=>x.pageIndex===r.pageIndex&&x.flowNode&&!x.legacyLayout&&x.target&&!x.edited&&!x.approved)){repaired.push({row:x,target:x.target,warnings:x.warnings});(x.history||=[]).push({source:x.text,target:x.target,quad:x.quad,reason:'flow-context-retranslation',at:new Date().toISOString()});x.target='';}}
     let proseDone=0;try{await this.translateGraphics(g,{rows:g.rows.filter(x=>x.pageIndex===r.pageIndex&&(r.action!=='repair-flow-page'||x.flowNode)),cfg:s.cfg,consentGranted:!!s.graphicsConsent});
      if(r.action==='translate-page')for(const rec of s.records.values()){if(rec.layout.pageIndex!==r.pageIndex||!['pending','error'].includes(rec.status))continue;const out=await this.translate(rec.text,s.cfg,'翻译完整图注或正文；保留数值、公式变量与专名。',s.control);if(!out?.text?.trim())throw Error('Empty page translation');rec.target=out.text;rec.status='done';s.paint(rec);proseDone++;}
     }finally{for(const old of repaired)if(!old.row.target){old.row.target=old.target;old.row.warnings=old.warnings;}await this.saveGraphics(g);await this.flushCheckpoints?.();g.paint();}return {page:r.pageIndex+1,proseDone,retranslated:repaired.length,translation:g.lastTranslation,rows:g.rows.filter(x=>x.pageIndex===r.pageIndex&&!x.legacyLayout).map(x=>({id:x.id,text:x.text,translated:!!x.target,error:x.error}))};
    }
    if(r.action==='inspect-reader-ui'){
     const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID),w=reader?._iframeWindow,d=w?.document;if(!d)throw Error('Reader UI not loaded');const dir=PathUtils.join(directory,'inspections',crypto.randomUUID());await IOUtils.makeDirectory(dir,{ignoreExisting:true});
     this.inplace?.get(reader)?.update();const bar=d.querySelector('.pl-inplace-controls'),menu=d.querySelector('.pl-reader-menu');
     const report={version:this.version,itemID:r.itemID,hidden:d.hidden,toolbarButtons:[...d.querySelectorAll('.pl-reader-action button')].map(n=>({label:n.textContent,aria:n.getAttribute('aria-label')})),menu:[...menu?.querySelectorAll('[role^="menuitem"]')||[]].map(n=>n.textContent),progress:this.readerProgress(reader),statusText:bar?.innerText||bar?.textContent,progressButtons:d.querySelectorAll('.pl-auto-graphics').length,visibleTranslationPanels:[...d.querySelectorAll('.pl-graphics-panel,.pl-reader-panel')].filter(n=>!n.hidden&&n.getBoundingClientRect().height>0).length,images:[]};
     if(!d.hidden)for(const [name,node]of [['toolbar',d.querySelector('.toolbar')],['status',bar]]){const b=node?.getBoundingClientRect();if(!b?.width||!b.height)continue;const h=Zotero.getMainWindow(),c=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=Math.ceil(b.width*2);c.height=Math.ceil(b.height*2);const cx=c.getContext('2d');cx.scale(2,2);cx.drawWindow(w,b.left,b.top,b.width,b.height,'#fff');const raw=h.atob(c.toDataURL('image/png').split(',')[1]);await IOUtils.write(PathUtils.join(dir,name+'.png'),Uint8Array.from(raw,ch=>ch.charCodeAt(0)));report.images.push(name+'.png');c.width=c.height=0;}
     await IOUtils.writeUTF8(PathUtils.join(dir,'reader-ui.json'),JSON.stringify(report));return {directory:dir,...report};
    }
    if(r.action==='inspect-page')return this.devInspectPage(r);
    if(r.action==='audit-layout')return this.devAuditLayout();
    if(r.action==='audit-interaction')return this.devAuditInteraction(r);
    if(r.action==='update-build'){
     const archive=await this.devPauseArchive(),root=PathUtils.parent(PathUtils.parent(directory));
     const version=JSON.parse(await IOUtils.readUTF8(PathUtils.join(root,'package.json'))).version;if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid build version');
     const xpi=PathUtils.join(root,'dist','paperloom-'+version+'-dev.xpi'),sha=(await IOUtils.readUTF8(xpi+'.sha256')).split(/\s/)[0];if(await this.nativeBytesHash(await IOUtils.read(xpi))!==sha)throw Error('Build digest mismatch');
     const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');const install=await AddonManager.getInstallForFile(Zotero.File.pathToFile(xpi));if(install.addon?.id!=='paperloom@local.research')throw Error('Unexpected addon');
     // Publish receipt before replacement closes this mailbox. Startup version and
     // retained records must be checked separately; scheduled is not installed.
     setTimeout(()=>install.install().catch(e=>Zotero.logError(e)),1000);return {scheduled:true,version,sha256:sha,archive:archive.archive};
    }
    if(r.action==='stop'){await this.stopDevChannel();return {stopped:true};}
    if(r.action==='pause-archive'||r.action==='prepare-native')return this.devPauseArchive({exportPDF:r.action==='prepare-native'});
    if(r.action==='native-page'){
     const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID&&this.inplace?.has(x)),s=this.inplace?.get(reader),g=this.graphicSessions?.get(reader);
     if(!s||!g||!s.paused||s.workers||g.busy||this.allRequests.size)throw Error('Native QA requires an open, paused, idle session');
     if(r.pageIndex>=s.pdf.numPages)throw Error('Page out of range');
     const archive=await this.devPauseArchive();return {archive:archive.archive,result:await this.prepareNativeBackgrounds(g,r.pageIndex)};
    }
   };
   const tick=async()=>{
    if(state.stopped)return;
    if(this.stopped||Date.now()>=expiresAt){await this.stopDevChannel();return;}
    try{
     if(!state.busy&&await IOUtils.exists(request)){
      state.busy=true;await IOUtils.move(request,active,{noOverwrite:true});
      if((await IOUtils.stat(active)).size>2048)throw Error('Oversize request');
      const r=validateRequest(JSON.parse(await IOUtils.readUTF8(active)),sessionId);
      if(state.seen.has(r.id))throw Error('Repeated job');state.seen.add(r.id);
      await publish(r.id,{ok:true,state:'running',id:r.id,action:r.action});
      try{const result=await execute(r);await publish(r.id,{ok:true,state:'complete',id:r.id,action:r.action,result});}
      catch(e){await publish(r.id,{ok:false,state:'complete',id:r.id,action:r.action,error:e.message,stack:String(e.stack||'').slice(0,2500)});}
     }
    }catch(e){await IOUtils.writeUTF8(file('channel-error.json'),JSON.stringify({at:new Date().toISOString(),error:e.message}));}
    finally{await IOUtils.remove(active,{ignoreAbsent:true});state.busy=false;if(!state.stopped)state.timer=setTimeout(tick,250);}
   };
   state.tick=tick;
   await IOUtils.writeUTF8(file('session.json'),JSON.stringify({version:1,sessionId,started,expiresAt,actions:Array.from(ACTIONS)}),{tmpPath:file('session.tmp')});
   state.timer=setTimeout(tick,250);
  };
  app.stopDevChannel=async function(){const s=this.devChannel;if(!s)return;s.stopped=true;clearTimeout(s.timer);for(const [,g]of this.graphicSessions||[])this.closeNativeBackgrounds?.(g);await IOUtils.remove(PathUtils.join(s.directory,'session.json'),{ignoreAbsent:true});};
 }
 const api={ACTIONS,validateRequest,attach};CubeDevChannel=root.CubeDevChannel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
