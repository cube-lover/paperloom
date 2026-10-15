/* Development-build only mailbox. Loaded by bootstrap's explicit build marker.
   No TCP listener, generic evaluation, provider configuration, or arbitrary paths.
 */
var CubeDevChannel;
(function(root){'use strict';
 const ACTIONS=Object.freeze(['status','pause-archive','prepare-native','native-page','inspect-page','audit-layout','update-build','resume-article','open-reader','refresh-page','translate-page','repair-flow-page','inspect-reader-ui','audit-interaction','ocr-selftest','ocr-install-state','ocr-install','ocr-uninstall','ocr-install-folder','graphics-rows','graphics-forget','graphics-purge-page','graphics-preview','region-badge','region-badge-demo','region-select','clear-translations','menu-click','keyset-fire','region-key-audit','region-key-install','selftest-interaction','selftest-clear-cache','key-watch','region-key-probe','region-translate','region-shortcut','stop']);
 function validateRequest(r,sessionId,now=Date.now()){
  if(!r||r.version!==1||r.sessionId!==sessionId)throw Error('Invalid development session');
  if(typeof r.id!=='string'||!/^job-[a-f0-9]{32}$/.test(r.id))throw Error('Invalid job id');
  if(!ACTIONS.includes(r.action))throw Error('Unknown development action');
  if(!Number.isFinite(r.createdAt)||Math.abs(now-r.createdAt)>30000)throw Error('Stale request');
  if(Object.keys(r).some(k=>!['version','sessionId','id','action','createdAt','itemID','pageIndex','rect','path'].includes(k)))throw Error('Unexpected request fields');
  if(['native-page','inspect-page','refresh-page','translate-page','repair-flow-page'].includes(r.action)){
   if(!Number.isInteger(r.itemID)||r.itemID<1||!Number.isInteger(r.pageIndex)||r.pageIndex<0)throw Error('Native page requires valid itemID and pageIndex');
  }else if(['resume-article','open-reader','audit-interaction','inspect-reader-ui'].includes(r.action)){if(!Number.isInteger(r.itemID)||r.itemID<1||r.pageIndex!==undefined)throw Error('Item action requires itemID only');}
  else if(['region-translate','region-shortcut'].includes(r.action)){if(!Number.isInteger(r.itemID)||r.itemID<1)throw Error('Region action requires itemID');}
  else if(r.action==='ocr-install-folder'&&!r.path)throw Error('Folder action requires path');
  else if(r.action==='graphics-rows'){if(!Number.isInteger(r.itemID)||r.itemID<1||!Number.isInteger(r.pageIndex)||r.pageIndex<0)throw Error('graphics-rows needs itemID and pageIndex');}
  else if(r.action==='graphics-forget'){if(!Number.isInteger(r.itemID)||r.itemID<1||!r.rect)throw Error('graphics-forget needs itemID and ids in rect');}
  else if(r.action==='graphics-purge-page'){if(!Number.isInteger(r.itemID)||r.itemID<1||!Number.isInteger(r.pageIndex)||r.pageIndex<0)throw Error('graphics-purge-page needs itemID and pageIndex');}
  else if(r.action==='graphics-preview'){if(!Number.isInteger(r.itemID)||r.itemID<1||!Number.isInteger(r.pageIndex)||r.pageIndex<0)throw Error('graphics-preview needs itemID and pageIndex');}
  else if(r.action==='region-badge'){if(!Number.isInteger(r.itemID)||r.itemID<1)throw Error('region-badge needs itemID');}
  else if(r.action==='region-select'){if(!Number.isInteger(r.itemID)||r.itemID<1||!Number.isInteger(r.pageIndex)||r.pageIndex<0||!r.rect)throw Error('region-select needs itemID, pageIndex and rect');}
  else if(r.action==='region-badge-demo'){if(!Number.isInteger(r.itemID)||r.itemID<1||!Number.isInteger(r.pageIndex)||r.pageIndex<0)throw Error('region-badge-demo needs itemID and pageIndex');}
  else if(r.action==='clear-translations'){if(!Number.isInteger(r.itemID)||r.itemID<1||!['page','all'].includes(r.rect)||r.pageIndex!==undefined)throw Error('clear-translations needs itemID and explicit page/all scope');}
  else if(r.action==='menu-click'){if(!Number.isInteger(r.itemID)||r.itemID<1||!['clear-page','clear-all'].includes(r.rect)||r.pageIndex!==undefined)throw Error('menu-click needs itemID and known menu action');}
  else if(r.action==='keyset-fire'){if(!Number.isInteger(r.itemID)||r.itemID<1)throw Error('keyset-fire needs itemID');}
  else if(r.action==='region-key-audit'){if(!Number.isInteger(r.itemID)||r.itemID<1)throw Error('region-key-audit needs itemID');}
  else if(r.action==='region-key-install'){if(r.itemID!==undefined||r.pageIndex!==undefined)throw Error('region-key-install has no item parameters');}
  else if(r.action==='key-watch'){if(!Number.isInteger(r.itemID)||r.itemID<1||!['start','report','stop'].includes(r.rect))throw Error('Invalid key watch request');}
  else if(r.action==='selftest-interaction'){if(!Number.isInteger(r.itemID)||r.itemID<1)throw Error('Interaction selftest needs itemID');}
  else if(r.action==='region-key-probe'){if(!Number.isInteger(r.itemID)||r.itemID<1)throw Error('region-key-probe needs itemID');}
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
   for(const [,g]of this.graphicSessions||[]){this.pauseRegionQueue?.(g);g.control.stopped=true;g.control.process?.kill();g.control.renderTask?.cancel();for(const req of g.control.requests||[])req.abort();}
   const busy=()=>this.allRequests.size||[...this.inplace?.values()||[]].some(s=>s.workers)||[...this.graphicSessions?.values()||[]].some(g=>g.busy||g.regionRunning||g.nativeControl);
   for(let i=0;i<1200&&busy();i++)await new Promise(r=>setTimeout(r,100));if(busy())throw Error('Active jobs remain');
   await this.flushCheckpoints?.();for(const [,g]of this.graphicSessions||[])await this.saveGraphics(g);await this.writeChain;
   const record={at:new Date().toISOString(),version:this.version,sessions:[...this.inplace||[]].map(([r,s])=>({itemID:r.itemID,paused:s.paused,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited,layout:v.layout,alignment:v.alignment||null,history:v.history||[],clearedAt:v.clearedAt||null,translationEpoch:v.translationEpoch||null,approved:!!v.approved}))})),graphics:[...this.graphicSessions||[]].map(([r,g])=>({itemID:r.itemID,file:g.file,fingerprint:g.fingerprint,replace:g.replace,hidden:g.hidden,rows:g.rows.map(({element,...row})=>row)}))};
   const folder=PathUtils.join(this.devChannel.directory,'archives',crypto.randomUUID());await IOUtils.makeDirectory(folder,{ignoreExisting:true});await IOUtils.writeUTF8(PathUtils.join(folder,'snapshot.json'),JSON.stringify(record));
   const exported=[];
   if(exportPDF)for(const [r]of this.inplace||[]){const pdf=r._internalReader?._primaryView?._iframeWindow?.PDFViewerApplication?.pdfDocument;if(!pdf)continue;const bytes=new Uint8Array(await pdf.getData());if(bytes.length>80*1024*1024)throw Error('PDF export exceeds development limit');const file=PathUtils.join(folder,'source-'+r.itemID+'.pdf');await IOUtils.write(file,bytes);exported.push({itemID:r.itemID,file,sha256:await this.nativeBytesHash(bytes)});}
   return {archive:PathUtils.join(folder,'snapshot.json'),exported,status:await this.devStatus()};
  };
  // Verify the shortcut preference round-trips in the real host and that the
  // synthetic key press installs the region covers on the page.
  // 识别只有本地 Python 一条路：用一张合成图把它端到端跑一遍，安装是否可用就看这个。
  // 单页图内行清单：排查用。id 是确定性的，所以同一条文字重复识别会落在同一行上。
  app.devGraphicsRows=async function(itemID,pageIndex){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const s=await this.openGraphics(reader);if(s.ready)await s.ready;
    const rows=(s.rows||[]).filter(r=>r.pageIndex===pageIndex);
    return {page:pageIndex+1,total:rows.length,rows:rows.map(r=>({id:r.id,text:String(r.text||'').slice(0,60),target:String(r.target||'').slice(0,40),origin:r.origin||'',edited:!!r.edited,score:r.score}))};
  };
  // 删除指定的图内行（用于清掉早前错误引擎留下的错译文/错角度残留）。
  app.devGraphicsForget=async function(itemID,ids){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const wanted=new Set(String(ids||'').split(',').map(s=>s.trim()).filter(Boolean));
    if(!wanted.size)throw Error('graphics-forget needs ids');
    const s=await this.openGraphics(reader);if(s.ready)await s.ready;
    const dropped=[],keep=[];
    for(const row of s.rows){
      if(wanted.has(row.id))dropped.push({id:row.id,text:String(row.text||'').slice(0,60),page:row.pageIndex+1});
      else keep.push(row);
    }
    s.rows=keep;s.hidden=false;s.replace=true;await this.saveGraphics(s);s.paint();
    return {dropped:dropped.length,droppedRows:dropped,remaining:(s.rows||[]).length};
  };
  // 整页清空图内行（可按 origin 过滤）。用于清掉早前错误引擎留下的整批残留。
  app.devGraphicsPurgePage=async function(itemID,pageIndex,origin){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const s=await this.openGraphics(reader);if(s.ready)await s.ready;
    const keep=[],dropped=[];
    for(const row of s.rows||[]){
      const hit=row.pageIndex===pageIndex&&(!origin||row.origin===origin);
      if(hit&&row.edited){keep.push(row);continue;}
      if(hit)dropped.push({id:row.id,text:String(row.text||'').slice(0,40),origin:row.origin||''});
      else keep.push(row);
    }
    s.rows=keep;s.hidden=false;s.replace=true;await this.saveGraphics(s);s.paint();
    return {page:pageIndex+1,origin:origin||'*',dropped:dropped.length,remaining:(s.rows||[]).filter(x=>x.pageIndex===pageIndex).length,sample:dropped.slice(0,10)};
  };
  // 把真实覆盖层（底色/掩膜/字号/位置都取计算样式）合成成 PNG：用来核对原文有没有擦干净，
  // 不需要阅读器窗口可见，也不依赖截图权限。
  app.devGraphicsPreview=async function(itemID,pageIndex,scale){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const s=await this.openGraphics(reader);if(s.ready)await s.ready;
    const ir=reader._internalReader;
    const win=ir?._secondaryView?._iframeWindow||ir?._primaryView?._iframeWindow||reader._iframeWindow,doc=win.document;
    // 等异步的高分辨率掩膜算完，否则预览看到的是还没换上去的兜底底色。
    for(let i=0;i<60&&(s.pendingMasks?.size||0)>0;i++)await new Promise(resolve=>setTimeout(resolve,250));
    const viewer=win.PDFViewerApplication?.pdfViewer;
    // 目标页可能还没渲染（PDF.js 只渲染视口附近）：先翻到那一页并等它渲染完。
    if(viewer&&viewer.currentPageNumber!==pageIndex+1){viewer.currentPageNumber=pageIndex+1;for(let i=0;i<120;i++){await new Promise(resolve=>setTimeout(resolve,100));const pv=viewer.getPageView(pageIndex);if(pv?.renderingState===3&&pv.canvas?.width)break;}}
    const pageEl=doc.querySelector('.page[data-page-number="'+(pageIndex+1)+'"]');if(!pageEl)throw Error('Page not found');
    const canvas=pageEl.querySelector('.canvasWrapper canvas');if(!canvas?.width)throw Error('Page canvas not rendered');
    const k=Math.max(1,Math.min(3,scale||2));
    const out=doc.createElement('canvas');out.width=Math.round(canvas.width*k);out.height=Math.round(canvas.height*k);
    const cx=out.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,out.width,out.height);
    cx.imageSmoothingEnabled=true;cx.drawImage(canvas,0,0,out.width,out.height);
    const pb=pageEl.getBoundingClientRect();
    const anchors=[...pageEl.querySelectorAll('.pl-graphic-anchor')],rows=[];
    for(const box of anchors){
      const cs=win.getComputedStyle(box),rect=box.getBoundingClientRect();
      const x=(rect.left-pb.left)*k,y=(rect.top-pb.top)*k,w=Math.max(1,rect.width*k),h=Math.max(1,rect.height*k);
      if(cs.backgroundColor&&cs.backgroundColor!=='rgba(0, 0, 0, 0)'){cx.fillStyle=cs.backgroundColor;cx.fillRect(x,y,w,h);}
      const bg=cs.backgroundImage;
      if(bg&&bg.startsWith('url(')){
        const url=bg.slice(4,bg.lastIndexOf(')')).replace(/^["']|["']$/g,'');
        try{const img=await new Promise((resolve,reject)=>{const im=doc.createElement('img');im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});cx.drawImage(img,x,y,w,h);}catch(e){}
      }
      const body=box.firstElementChild;
      if(body?.textContent){
        const bcs=win.getComputedStyle(body),br=body.getBoundingClientRect();
        const m=String(bcs.transform||'').match(/matrix\(([^)]+)\)/),factor=m?Math.abs(Number(m[1].split(',')[0])||1):1;
        const fs=Math.max(6,(parseFloat(bcs.fontSize)||12)*factor);
        const tx=(br.left-pb.left)*k,ty=(br.top-pb.top)*k,tw=Math.max(1,br.width*k||w),th=Math.max(1,br.height*k||h);
        cx.save();cx.beginPath();cx.rect(tx,ty,tw,th);cx.clip();cx.fillStyle=bcs.color||'#111';cx.font='400 '+fs+'px '+bcs.fontFamily;cx.textBaseline='alphabetic';
        cx.fillText(String(body.textContent),tx+1,ty+fs*.92,tw-2);cx.restore();
      }
      rows.push({id:box.dataset.labelId,mode:box.dataset.mode,cover:box.dataset.cover||'',confidence:box.dataset.patchConfidence||'',mask:(box.dataset.maskResult||'')+'|'+(box.dataset.mask||''),text:String(body?.textContent||'').slice(0,30)});
    }
    const dir=PathUtils.join(this.dir,'previews');await IOUtils.makeDirectory(dir,{ignoreExisting:true});
    const file=PathUtils.join(dir,'page-'+(pageIndex+1)+'-'+Date.now()+'.png');
    const base64=out.toDataURL('image/png').split(',')[1];
    await IOUtils.write(file,Uint8Array.from(Zotero.getMainWindow().atob(base64),c=>c.charCodeAt(0)));
    out.width=out.height=0;
    const counts={};for(const row of rows)counts[row.cover||'(none)']=(counts[row.cover||'(none)']||0)+1;
    return {page:pageIndex+1,file,scale:k,replaced:rows.filter(r=>r.mode==='replace').length,total:rows.length,covers:counts,rows};
  };
  // 框选翻译的小圆点状态（含列表内容），用于核对它是不是只在框选后出现。
  app.devRegionBadge=async function(itemID){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const s=await this.openGraphics(reader,{panel:false});
    const badge=s.badge;
    return {badgeError:s.badgeError||null,views:!!this.readerButtons?.get(s.reader),docHasBody:!!(this.readerButtons?.get(s.reader)?[...this.readerButtons.get(s.reader)][0]?.doc?.body:false),visible:!!badge?.root?.isConnected,state:badge?.root?.dataset?.state||null,count:badge?.count?.textContent||null,
      title:badge?.root?.title||null,listOpen:badge?.popover?.style?.display==='block',
      regionList:(s.lastRegionList||[]).length,panelHidden:!!s.panel?.hidden,lastRegion:s.lastRegion||null};
  };
  // 走真实的框选路径（真的拖一次），用来验证小圆点状态机与框选后的自动翻译。
  app.devRegionSelect=async function(itemID,pageIndex,rect){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const box=String(rect||'').split(/[ ,]+/).filter(Boolean).map(Number);
    for(const view of [reader._internalReader?._primaryView,reader._internalReader?._secondaryView])for(const old of view?._iframeWindow?.document?.querySelectorAll('.pl-graphic-select')||[])old.remove();
    if(box.length!==4||!box.every(Number.isFinite))throw Error('region-select needs x0 y0 x1 y1');
    let selectError=null;const open=this.selectGraphicRegion(reader).catch(e=>{selectError=String(e.message||e).slice(0,300);});
    const ir=reader._internalReader;
    let hit=null;
    for(let i=0;i<80&&!hit;i++){
      await new Promise(resolve=>setTimeout(resolve,100));
      for(const view of [ir?._primaryView,ir?._secondaryView]){
        const win=view?._iframeWindow;if(!win?.PDFViewerApplication)continue;
        const pageEl=win.document.querySelector('.page[data-page-number="'+(pageIndex+1)+'"]');
        const cover=pageEl?.querySelector('.pl-graphic-select');
        if(cover)hit={win,pageEl,cover};
      }
    }
    if(!hit){await open.catch(()=>{});throw Error('框选覆盖层没有出现');}
    const {win,pageEl,cover}=hit;
    const viewer=win.PDFViewerApplication.pdfViewer,pv=viewer.getPageView(pageIndex);
    const canvas=pageEl.querySelector('.canvasWrapper canvas'),cr=canvas.getBoundingClientRect(),vp=pv.viewport;
    const toClient=([x,y])=>({clientX:cr.left+x*cr.width/vp.width,clientY:cr.top+y*cr.height/vp.height,button:0,pointerId:1,bubbles:true,cancelable:true,isPrimary:true,pointerType:'mouse'});
    const fire=(type,point)=>cover.dispatchEvent(new win.PointerEvent(type,{...toClient(point),buttons:type==='pointerup'?0:1}));
    fire('pointerdown',[box[0],box[1]]);await new Promise(r=>setTimeout(r,60));
    fire('pointermove',[box[2],box[3]]);await new Promise(r=>setTimeout(r,60));
    fire('pointerup',[box[2],box[3]]);
    const badge=s=>s.badge?{visible:!!s.badge.root.isConnected,state:s.badge.root.dataset.state,count:s.badge.count.textContent}:null;
    const states=[];const session=this.graphicSessions.get(reader);
    states.push(badge(session));
    await open.catch(()=>{});
    for(let i=0;i<300;i++){await new Promise(r=>setTimeout(r,200));states.push(badge(session));const cur=states.at(-1);if(cur&&cur.state==='done')break;}
    const fresh=[...hit.pageEl.querySelectorAll('.pl-graphic-select')].length;
    return {covers:fresh,alive:this.graphicSessions.has(reader),stopped:!!session?.control?.stopped,selectError,badgeError:session?.badgeError||null,badgeTrace:(session?.badgeTrace||[]).map(x=>x.state),badgeKeys:Object.keys(session||{}).filter(k=>k.toLowerCase().includes('badge')),message:session?.message||null,hasSelection:typeof session?.selection==='function',steps:states.slice(0,3).concat(states.slice(-2)),regions:(session?.lastRegionList||[]).length,lastRegion:session?.lastRegion||null,badge:badge(session),panelHidden:!!session?.panel?.hidden};
  };
  // 直接把圆点的四个状态跑一遍（含真实识别结果列表），验证它在阅读器里能被创建、定位、展开。
  app.devRegionBadgeDemo=async function(itemID,pageIndex){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const s=await this.openGraphics(reader,{panel:false});
    const snap=()=>s.badge?{visible:!!s.badge.root.isConnected,state:s.badge.root.dataset.state,count:s.badge.count.textContent,title:s.badge.root.title,left:s.badge.root.getBoundingClientRect().left,top:s.badge.root.getBoundingClientRect().top,listOpen:s.badge.popover.style.display==='block'}:null;
    const out={};
    this.showRegionBadge(s,'armed');out.armed=snap();
    this.showRegionBadge(s,'busy');out.busy=snap();
    this.finishRegionBadge(s,pageIndex);out.done=snap();
    this.toggleRegionList(s);out.opened=snap();
    // 真实点击路径：在圆点内 pointerdown → click 展开 → 面板外 pointerdown 关闭
    const w=s.doc.defaultView,send=(node,type)=>node.dispatchEvent(new (w.PointerEvent||w.MouseEvent)(type,{bubbles:true,cancelable:true,button:0,pointerId:1}));
    const badge=s.badge,steps=[];
    if(badge){
      badge.popover.style.display='none';
      send(badge.root,'pointerdown');steps.push({step:'down-on-badge',alive:!!s.badge,open:!!s.badge&&s.badge.popover.style.display==='block'});
      send(badge.root,'click');steps.push({step:'click',alive:!!s.badge,open:!!s.badge&&s.badge.popover.style.display==='block'});
      send(s.doc.body,'pointerdown');steps.push({step:'outside',alive:!!s.badge});
    }
    out.clickSteps=steps;
    out.rows=(s.lastRegionList||[]).length;
    out.listText=(s.badge?.popover?.textContent||'').slice(0,160);
    out.listRect=(()=>{const r=s.badge?.popover?.getBoundingClientRect();return r?{w:Math.round(r.width),h:Math.round(r.height),left:Math.round(r.left),top:Math.round(r.top)}:null;})();
    this.hideRegionBadge(s);out.hidden=!!s.badge;
    return out;
  };
  // Short-lived, filtered observation of modified R / modifier events only. No typed text logging.
  app.devKeyWatch=function(itemID,mode){
    const reader=(Zotero.Reader._readers||[]).find(r=>r.itemID===itemID),main=Zotero.getMainWindow();
    if(!reader)throw Error('Reader not open');
    const frames=[['main',main],['toolbar',reader._iframeWindow],['primary',reader._internalReader?._primaryView?._iframeWindow],['secondary',reader._internalReader?._secondaryView?._iframeWindow]];
    if(mode==='stop'){this.keyWatch?.cleanup();return {stopped:true};}
    if(mode==='start'){
      this.keyWatch?.cleanup();const state={events:[],clean:[],started:Date.now(),errors:[]};this.keyWatch=state;
      state.cleanup=()=>{clearTimeout(state.timer);for(const f of state.clean.splice(0))try{f();}catch{};state.stopped=true;};
      for(const [name,w]of frames)if(w){
        for(const type of ['keydown','keypress','keyup']){
          const f=e=>{if(!(['r','R','Alt'].includes(e.key)||e.code==='KeyR'))return;if(e.key!=='Alt'&&!e.altKey&&!e.ctrlKey&&!e.metaKey)return;
            state.events.push({at:Date.now(),name,group:'capture',type,key:e.key,code:e.code,alt:e.altKey,ctrl:e.ctrlKey,shift:e.shiftKey,meta:e.metaKey,trusted:e.isTrusted,prevented:e.defaultPrevented,composing:e.isComposing,repeat:e.repeat,target:e.target?.localName,matched:this.matchShortcut(this.readerShortcut(),e)});if(state.events.length>100)state.events.shift();};
          try{w.addEventListener(type,f,true);state.clean.push(()=>w.removeEventListener(type,f,true));}catch(e){state.errors.push(name+':'+e.message);}
        }
      }
      for(const key of main.document.querySelectorAll('#pl-region-keyset key')){const f=e=>state.events.push({name:'keyset',type:'command',trusted:e.isTrusted});key.addEventListener('command',f);state.clean.push(()=>key.removeEventListener('command',f));}
      state.timer=setTimeout(state.cleanup,120000);
    }
    const g=this.graphicSessions.get(reader),views=[...(this.readerButtons.get(reader)||[])];
    return {version:this.version,mode,spec:this.readerShortcut(),watchStopped:this.keyWatch?.stopped??true,selected:main.Zotero_Tabs?.selectedID,tabID:reader.tabID,activeReader:this.activeReader()?.itemID,hits:this.readerShortcutHits||0,matches:this.readerShortcutMatches||0,focus:frames.map(([name,w])=>({name,focus:w?.document.hasFocus(),element:w?.document.activeElement?.localName,hidden:w?.document.hidden})),keys:[...main.document.querySelectorAll('#pl-region-keyset key')].map(k=>({key:k.getAttribute('key'),ns:k.namespaceURI,command:k.getAttribute('command'),oncommand:k.getAttribute('oncommand')})),notice:views[0]?.notice.textContent,bindings:views.map(v=>v.shortcutDocs?.size),covers:frames.slice(2).map(([,w])=>w?.document.querySelectorAll('.pl-graphic-select').length||0),badge:g?.badge?.root.dataset.state||null,events:this.keyWatch?.events||[],errors:this.keyWatch?.errors||[]};
  };
  // 合成按键探针：直接往主窗口派发 keydown，验证匹配与触发（XUL keyset 的默认动作不在其中）。
  app.devRegionKeyProbe=async function(itemID){
    const win=Zotero.getMainWindow?.();if(!win)throw Error('No main window');
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const before={hits:this.readerShortcutHits||0,matches:this.readerShortcutMatches||0};
    for(const mods of [{ctrlKey:true}]){
      win.document.dispatchEvent(new win.KeyboardEvent('keydown',{key:'r',code:'KeyR',bubbles:true,cancelable:true,...mods}));
      await new Promise(resolve=>setTimeout(resolve,300));
    }
    await new Promise(resolve=>setTimeout(resolve,600));
    const out={before,after:{hits:this.readerShortcutHits||0,matches:this.readerShortcutMatches||0},
      mode:this.regionKeyHandler?.mode||'',keysetKeys:[...(win.document.getElementById('pl-region-keyset')?.querySelectorAll('key')||[])].map(k=>k.getAttribute('key')+'|'+k.getAttribute('modifiers')),
      log:this.regionKeyLog||[]};
    this.graphicSessions?.get(reader)?.selection?.();
    return out;
  };

  // 立刻在运行中的会话里注册快捷键通道。
  app.devRegionKeyInstall=async function(){
    const keyset=this.installRegionKeyset(),handler=this.installRegionKeyHandler();
    return {keyset,handler,mode:this.regionKeyHandler?.mode||'',error:this.regionKeyError||'',spec:this.readerShortcut?.()||''};
  };

  // Alt+R 归属审计 + 受信任按键测试（合成事件不会触发 XUL 默认动作，测不出来）。
  app.devRegionKeyAudit=async function(itemID){
    const win=Zotero.getMainWindow?.();if(!win)throw Error('No main window');
    const doc=win.document;
    const sets=[...doc.querySelectorAll('keyset')].map(k=>({id:k.id||'(anon)',parent:k.parentElement?.id||'',
      keys:[...k.querySelectorAll('key')].map(x=>(x.getAttribute('key')||'')+'|'+(x.getAttribute('modifiers')||''))}));
    const clash=[];
    for(const set of sets)for(const key of set.keys)if(/^r\|alt$/i.test(key))clash.push(set.id);
    const has=(key,mods)=>sets.some(set=>set.keys.includes(key+'|'+mods));
    const owner=[...doc.querySelectorAll('keyset key')].filter(k=>/^r$/i.test(k.getAttribute('key')||'')&&/alt/i.test(k.getAttribute('modifiers')||''));
    const ownerInfo=owner.map(k=>({keyset:k.closest('keyset')?.id||'',id:k.id||'',command:k.getAttribute('oncommand')||k.getAttribute('command')||'',label:k.getAttribute('label')||''}));
    const order=(()=>{const all=[...doc.querySelectorAll('keyset')].map(k=>k.id||'(anon)');return all;})();
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    const before={hits:this.readerShortcutHits||0,matches:this.readerShortcutMatches||0};
    let sent='';
    try{win.windowUtils.sendKeyEvent('keydown',82,0,1,0);win.windowUtils.sendKeyEvent('keyup',82,0,1,0);sent='sendKeyEvent';}
    catch(error){sent='failed: '+String(error?.message||error);}
    await new Promise(resolve=>setTimeout(resolve,1200));
    return {sent,sets,altRKeysets:clash,hasAltRKey:has('r','alt'),hasCtrlAltRKey:has('r','control,alt')||has('r','alt,control'),regionKeyLog:this.regionKeyLog||[],
      systemHandler:!!this.regionKeyHandler,systemMode:this.regionKeyHandler?.mode||'',keyError:this.regionKeyError||'',ownerInfo,keysetOrder:order,
      keyset:!!doc.getElementById('pl-region-keyset'),spec:this.readerShortcut?.()||'',
      before,after:{hits:this.readerShortcutHits||0,matches:this.readerShortcutMatches||0},
      log:(this.shortcutLog||[]).slice(0,4)};
  };

  // 主窗口 keyset 的 Alt+R 通道单独验一下：直接派发 command，看是否进入框选。
  app.devKeysetFire=async function(itemID){
    const win=Zotero.getMainWindow?.();if(!win)throw Error('No main window');
    const keyset=win.document.getElementById('pl-region-keyset');
    if(!keyset)throw Error('没有注册 pl-region-keyset');
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const keysetsOverall=win.document.querySelectorAll('keyset').length;
    const keys=[...keyset.querySelectorAll('key')].map(k=>k.getAttribute('key')+'|'+k.getAttribute('modifiers'));
    const before=this.readerShortcutMatches||0;
    keyset.querySelector('key')?.dispatchEvent(new win.Event('command',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,1200));
    return {keys,keysetsOverall,matchesBefore:before,matchesAfter:this.readerShortcutMatches||0,
      overlay:!!reader._iframeWindow?.document?.querySelector('.pl-graphic-select')};
  };

  // 真实点击链：打开 ▾ 菜单 → 展开二级菜单 → 按 action 点子项，并报告命中结果。
  app.devMenuClick=async function(itemID,action){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    const view=[...(this.readerButtons?.get(reader)||[])][0];
    if(!view)throw Error('工具栏按钮还没建好');
    const win=view.doc.defaultView;
    view.wrap.querySelector('.pl-menu-button')?.click();
    const row=[...view.menu.querySelectorAll('[aria-haspopup="true"]')].find(n=>n.textContent.includes('清除翻译'));
    if(!row)throw Error('菜单里没有清除翻译');
    row.dispatchEvent(new win.MouseEvent('mouseenter'));
    const sub=[...view.doc.querySelectorAll('.pl-reader-submenu button')].find(b=>b.dataset.action===action);
    if(!sub)throw Error('没有子项 '+action);
    const box=sub.getBoundingClientRect(),hit=view.doc.elementFromPoint(Math.round(box.left+box.width/2),Math.round(box.top+box.height/2));
    this.menuClickTrace=[];
    sub.dispatchEvent(new win.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0}));
    sub.dispatchEvent(new win.MouseEvent('pointerup',{bubbles:true,cancelable:true,button:0}));
    sub.click();
    await new Promise(resolve=>setTimeout(resolve,4000));
    const g=this.graphicSessions?.get(reader),pageIndex=this.graphicPageIndex(reader);
    return {action,menuOpen:view.menu.style.display!=='none',submenuOpen:sub.offsetParent!==null,
      hitIsSub:hit===sub||sub.contains(hit),hitTag:String(hit?.tagName||'')+'.'+String(hit?.className||''),
      notice:view.notice.textContent,noticeShown:!view.notice.hidden,noticeConnected:!!view.notice.isConnected,
      subButtons:view.doc.querySelectorAll('.pl-reader-submenu button').length,
      views:(this.readerButtons?.get(reader)||new Set()).size,
      trace:this.menuClickTrace||[],
      graphicsTranslated:g?g.rows.filter(r=>r.target).length:null,
      pageTranslated:g?g.rows.filter(r=>r.pageIndex===pageIndex&&r.target).length:null,
      proseRecords:this.inplace?.get(reader)?.records?.size??null};
  };

  // 菜单里「清除翻译 …」的宿主入口，方便不用鼠标也能验证。
  app.devClearTranslations=async function(itemID,scope){
    const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===itemID);
    if(!reader)throw Error('No reader open');
    if(!['page','all'].includes(scope))throw Error('Invalid clear scope');
    const all=scope==='all';
    const out=await this.clearTranslations(reader,all?{all:true}:{pageIndex:this.graphicPageIndex(reader)});
    return {...out,scope:all?'all':'page'};
  };
  // Installed-host selftest. Menu/clear/queue fixtures have independent maps/files;
  // keyboard tests use real PDF documents without translating or clearing user rows.
  app.devSelftestInteraction=async function(itemID){
    const reader=(Zotero.Reader._readers||[]).find(r=>r.itemID===itemID);
    const article=this.inplace?.get(reader),g=this.graphicSessions?.get(reader);
    if(!reader||!article?.paused||article.workers||article.graphicJob?.busy||g?.busy||g?.regionRunning||this.allRequests.size)throw Error('Selftest requires paused idle reader');
    const main=Zotero.getMainWindow(),views=[...(this.readerButtons.get(reader)||[])],frames=[reader._iframeWindow,reader._internalReader?._primaryView?._iframeWindow,reader._internalReader?._secondaryView?._iframeWindow];
    const report={version:this.version,scope:'installed host synthetic input; isolated menu/queue data, no provider',bindings:[],keys:[],menu:[],queue:[]};
    const savedBadge={lastRegionList:g?.lastRegionList,regionResults:g?.regionResults,message:g?.message};
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const covers=()=>frames.slice(1).map(w=>w?.document.querySelectorAll('.pl-graphic-select').length||0);
    for(const v of views){let error='';try{v.rebindShortcuts?.();}catch(e){error=e.message;}report.bindings.push({count:v.shortcutDocs?.size,error,frames:frames.map(w=>({bound:v.shortcutDocs?.has(w?.document),live:!!w?.document,hidden:w?.document.hidden}))});}
    const testListeners=[];
    // Gecko chrome listeners omit wantUntrusted by default on PDF subdocuments.
    // Enable synthetic delivery only for this development test, not normal input.
    for(const v of views)for(const w of frames.slice(1))if(w&&v.shortcutListener){const forward=e=>v.shortcutListener(e);w.document.addEventListener('keydown',forward,true,true);testListeners.push(()=>w.document.removeEventListener('keydown',forward,true));}
    try{
      for(const [name,w]of [['toolbar',frames[0]],['primary',frames[1]],['secondary',frames[2]],['main',main]]){
        if(!w)continue;g?.selection?.();this.regionShortcutAt=0;const before=this.readerShortcutMatches||0;
        const seen={winDefault:0,winUntrusted:0,docDefault:0,docUntrusted:0},callbacks=[];
        for(const [name,target,untrusted]of [['winDefault',w,false],['winUntrusted',w,true],['docDefault',w.document,false],['docUntrusted',w.document,true]]){const f=()=>seen[name]++;target.addEventListener('keydown',f,true,untrusted);callbacks.push(()=>target.removeEventListener('keydown',f,true));}
        const init=Components.utils.cloneInto({key:'r',code:'KeyR',ctrlKey:true,bubbles:true,cancelable:true},w);
        const e=new w.KeyboardEvent('keydown',init);w.document.dispatchEvent(e);await sleep(120);for(const f of callbacks)f();
        report.keys.push({name,before,after:this.readerShortcutMatches||0,prevented:e.defaultPrevented,eventKey:e.key,eventAlt:e.altKey,eventCtrl:e.ctrlKey,covers:covers(),seen});g?.selection?.();
      }
    }finally{for(const restore of testListeners)restore();g?.selection?.();if(g){this.hideRegionBadge(g);Object.assign(g,savedBadge);g.update();}}
    // Same DOM engine and click callbacks, separate reader and durable filenames.
    const doc=frames[0].document,host=doc.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;width:800px;';doc.body.appendChild(host);
    const fixture={itemID:2147483646,_iframeWindow:frames[0],_internalReader:{_primaryView:{_iframeWindow:{document:{querySelector:()=>null},PDFViewerApplication:{pdfDocument:{numPages:1},pdfViewer:{currentPageNumber:1}}}}}},id='qa-'+crypto.randomUUID(),files=[];
    const row={id:'qg',text:'Fixture label',target:'样本标签',pageIndex:0,quad:[[0,0],[10,0],[10,10],[0,10]],edited:true,approved:true};
    const rec={id:'qp',text:'Fixture paragraph',target:'样本校订',status:'done',edited:true,layout:{pageIndex:0,rect:[0,0,10,10],inkRect:[0,0,10,10]}};
    const fses={reader:fixture,pdf:{fingerprints:[id],numPages:1},cfg:{translateGraphics:false},stage:'ready',paused:true,records:new Map([['qp',rec]]),queue:[],workers:0,paint(){},update(){},enqueue(r){if(!this.queue.includes(r))this.queue.push(r);}};
    const gs={reader:fixture,file:'graphics/'+id+'.json',fingerprint:id,rows:[row],paint(){},update(){},control:{stopped:false,requests:new Set()}};
    this.inplace.set(fixture,fses);this.graphicSessions.set(fixture,gs);
    let view,identity,recognize=this.recognizeGraphicRegion,paintBadge=this.showRegionBadge;
    try{
      identity=await this.checkpointIdentity(fixture,fses.pdf);files.push(PathUtils.join(this.dir,...identity.file.split('/')),PathUtils.join(this.dir,...gs.file.split('/')));
      this.buildReaderButton(doc,fixture,n=>host.appendChild(n));view=[...this.readerButtons.get(fixture)][0];
      const panel=[...doc.querySelectorAll('.pl-reader-submenu')].at(-1),parent=view.menu.querySelector('[aria-haspopup="true"]');
      for(let i=0;i<2;i++){
        if(i){row.target='第二次标签';rec.target='第二次正文';rec.status='done';}
        view.notice.textContent='';
        view.wrap.querySelector('.pl-menu-button').click();parent.dispatchEvent(new frames[0].MouseEvent('mouseenter'));
        panel.querySelector('[data-action="clear-page"]').click();
        for(let n=0;n<100&&!view.notice.textContent.startsWith('已清除');n++)await sleep(25);
        await this.writeChain;
        report.menu.push({round:i+1,cleared:!row.target&&!rec.target,pending:rec.status==='pending',queued:fses.queue.includes(rec),notice:view.notice.textContent,graphicHistory:row.history?.length,proseHistory:rec.history?.length});
      }
      const stored=await this.readJSON(identity.file,null);report.historyOnDisk=stored?.records?.[0]?.history?.length===2;
      let release;const started=[];this.showRegionBadge=(s,state,details)=>s===gs?report.queue.push({state,count:details?.count}):paintBadge.call(this,s,state,details);
      this.recognizeGraphicRegion=async function(s,w,pv,canvas,pageIndex,...args){if(s!==gs)return recognize.call(this,s,w,pv,canvas,pageIndex,...args);started.push(pageIndex);await new Promise(r=>{release=r;});s.lastRegionList=[{pageIndex,text:'Fixture',target:'样本'}];};
      gs.regionPaused=false;this.enqueueRegionJob(gs,{pageIndex:0});this.enqueueRegionJob(gs,{pageIndex:1});await sleep(40);report.queuePending=gs.regionQueue.length;release();await sleep(40);release();for(let n=0;n<50&&gs.regionRunning;n++)await sleep(20);
      report.queueOrder=started;report.queueResults=gs.regionResults?.length||0;
    }catch(e){report.error=e.message;}
    finally{
      this.recognizeGraphicRegion=recognize;this.showRegionBadge=paintBadge;this.hideRegionBadge(gs);view?.dispose();host.remove();this.inplace.delete(fixture);this.graphicSessions.delete(fixture);
      await this.writeChain;for(const file of files)for(const suffix of ['', '.bak', '.tmp'])await IOUtils.remove(file+suffix,{ignoreAbsent:true}).catch(()=>{});
    }
    report.passed=!report.error&&report.keys.length>=3&&report.menu.length===2&&report.keys.every(k=>k.after===k.before+1&&k.covers.some(Boolean))&&report.menu.every(m=>m.cleared&&m.pending&&m.notice.startsWith('已清除'))&&report.historyOnDisk&&report.queueResults===2;
    return report;
  };
  // Real host disk/cache pipeline on a separate fixture, no provider or user rows.
  app.devSelftestClearCache=async function(){
    const qa=Object.create(this),directory=PathUtils.join(this.devChannel.directory,'qa-clear-'+crypto.randomUUID());
    qa.dir=directory;qa.writeChain=Promise.resolve();qa.translations=new Map();qa.graphicSessions=new Map();qa.inplace=new Map();qa.readerButtons=new Map();
    qa.checkpointTimers=new Map();qa.restoreTimers=new Map();qa.restorePending=new Set();
    let calls=0;qa.completion=async()=>('fixture-generation-'+(++calls));
    const cfg={...this.config,confirmBeforeSend:false},reader={itemID:2147483645},source='Isolated clear cache paragraph';
    const rec={id:'qp',text:source,target:'',status:'done',layout:{pageIndex:0}},g={reader,file:'graphics/fixture.json',fingerprint:'qa',rows:[],paint(){},update(){}};
    const session={reader,pdf:{fingerprints:['qa'],numPages:1},stage:'ready',records:new Map([['qp',rec]]),paint(){},update(){},enqueue(){}};
    qa.graphicSessions.set(reader,g);qa.inplace.set(reader,session);
    try{
      for(const folder of ['cache','sessions','graphics'])await IOUtils.makeDirectory(PathUtils.join(directory,folder),{ignoreExisting:true});
      rec.target=(await qa.translate(source,cfg)).text;
      const original=rec.target;await qa.clearTranslations(reader,{pageIndex:0});
      const callsAfterClear=calls,identity=await qa.checkpointIdentity(reader,session.pdf),saved=await qa.readJSON(identity.file,null),epoch=saved.records[0].translationEpoch;
      const fresh=await qa.translate(source,cfg,'',undefined,{cacheScope:epoch});
      const callsAfterFresh=calls,untouched=await qa.translate(source,cfg),repeat=await qa.translate(source,cfg,'',undefined,{cacheScope:epoch});
      return {passed:rec.target===''&&!!epoch&&callsAfterClear===1&&callsAfterFresh===2&&calls===2&&fresh.text!==original&&untouched.text===original&&repeat.cached===true&&saved.records[0].history[0].target===original,
        fixture:true,realProviderCalls:0,callsAfterClear,callsAfterFresh,finalMockCalls:calls,storedTarget:saved.records[0].target,scopePersisted:!!epoch,historyRetained:saved.records[0].history.length===1,otherScopeUnchanged:untouched.text===original};
    }finally{await qa.writeChain.catch(()=>{});await IOUtils.remove(directory,{recursive:true,ignoreAbsent:true});}
  };
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
   const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID);
   if(!reader)throw Error('No reader open');
   const before=this.readerShortcut(),set=this.setReaderShortcut('Ctrl+Alt+K'),read=this.readerShortcut(),restore=this.setReaderShortcut(before);
   const s=await this.openGraphics(reader),w=reader._internalReader?._primaryView?._iframeWindow||s.win;
   const matched=this.matchShortcut(this.readerShortcut(),{ctrlKey:true,key:'r'}),negative=this.matchShortcut(this.readerShortcut(),{key:'r'});
   const event=new w.KeyboardEvent('keydown',{key:'r',code:'KeyR',ctrlKey:true,bubbles:true,cancelable:true});
   let error='';
   try{w.document.dispatchEvent(event);await new Promise(resolve=>setTimeout(resolve,400));}
   catch(e){error=e.message||String(e);}
   const covers=w.document.querySelectorAll('.pl-graphic-select').length;
   // 焦点也可能在主窗口上：那里也要能触发。
   let mainHits=0;
   try{const main=Zotero.getMainWindow(),before=this.readerShortcutHits||0;
     main.document.dispatchEvent(new main.KeyboardEvent('keydown',{key:'r',code:'KeyR',ctrlKey:true,bubbles:true,cancelable:true}));
     await new Promise(resolve=>setTimeout(resolve,300));mainHits=(this.readerShortcutHits||0)-before;}catch(e){error=String(e&&e.message||e);}
   const diag={log:(this.shortcutLog||[]).slice(0,6),hits:this.readerShortcutHits||0,gate:this.readerShortcutMatches||0,isPrimary:w===reader._internalReader?._primaryView?._iframeWindow,isSecondary:w===reader._internalReader?._secondaryView?._iframeWindow,active:String(w.document.activeElement?.tagName||'')+'#'+(w.document.activeElement?.id||''),boundDocs:[...(this.readerButtons?.get(reader)||[])].length};
   s.selection?.();await new Promise(resolve=>setTimeout(resolve,100));
   return {itemID:reader.itemID,before,set,read,restore,matched,negative,defaultPrevented:event.defaultPrevented,covers,mainHits,error,cleaned:w.document.querySelectorAll('.pl-graphic-select').length,diag};
  };
  // Exercise the manual box-selection pipeline without a physical mouse: crop the
  // given PDF rect (or the stored graphic bounds) and run recognise + translate.
  app.devRegionTranslate=async function(r){
   const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID);
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
    if(r.action==='key-watch')return this.devKeyWatch(r.itemID,r.rect);
    if(r.action==='selftest-clear-cache')return this.devSelftestClearCache();
    if(r.action==='selftest-interaction')return this.devSelftestInteraction(r.itemID);
    if(r.action==='graphics-rows')return this.devGraphicsRows(r.itemID,r.pageIndex);
    if(r.action==='graphics-forget')return this.devGraphicsForget(r.itemID,String(r.rect||''));
    if(r.action==='graphics-purge-page')return this.devGraphicsPurgePage(r.itemID,r.pageIndex,String(r.rect||''));
    if(r.action==='graphics-preview')return this.devGraphicsPreview(r.itemID,r.pageIndex,Number(r.rect)||2);
    if(r.action==='region-badge')return this.devRegionBadge(r.itemID);
    if(r.action==='region-select')return this.devRegionSelect(r.itemID,r.pageIndex,String(r.rect||''));
    if(r.action==='region-badge-demo')return this.devRegionBadgeDemo(r.itemID,r.pageIndex);
    if(r.action==='clear-translations')return this.devClearTranslations(r.itemID,String(r.rect||'page'));
    if(r.action==='menu-click')return this.devMenuClick(r.itemID,String(r.rect||'clear-page'));
    if(r.action==='keyset-fire')return this.devKeysetFire(r.itemID);
    if(r.action==='region-key-audit')return this.devRegionKeyAudit(r.itemID);
    if(r.action==='region-key-install')return this.devRegionKeyInstall();
    if(r.action==='region-key-probe')return this.devRegionKeyProbe(r.itemID);
    if(r.action==='ocr-install-state')return this.ocrInstallState();
    if(r.action==='ocr-install')return this.installOCREngine({});
    if(r.action==='ocr-uninstall')return this.uninstallOCREngine();
    if(r.action==='ocr-install-folder'){if(!r.path)throw Error('ocr-install-folder needs path');return this.ocrInstallFromFolder(r.path);}
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
     const report={version:this.version,itemID:r.itemID,hidden:d.hidden,toolbarButtons:[...d.querySelectorAll('.pl-reader-action button')].map(n=>({label:n.textContent,aria:n.getAttribute('aria-label')})),menu:[...menu?.querySelectorAll('[role^="menuitem"]')||[]].map(n=>n.textContent),submenus:[...d.querySelectorAll('.pl-reader-submenu')].map(n=>[...n.querySelectorAll('button')].map(b=>b.textContent)),progress:this.readerProgress(reader),statusText:bar?.innerText||bar?.textContent,progressButtons:d.querySelectorAll('.pl-auto-graphics').length,visibleTranslationPanels:[...d.querySelectorAll('.pl-graphics-panel,.pl-reader-panel')].filter(n=>!n.hidden&&n.getBoundingClientRect().height>0).length,images:[]};
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
  app.stopDevChannel=async function(){this.keyWatch?.cleanup();const s=this.devChannel;if(!s)return;s.stopped=true;clearTimeout(s.timer);for(const [,g]of this.graphicSessions||[])this.closeNativeBackgrounds?.(g);await IOUtils.remove(PathUtils.join(s.directory,'session.json'),{ignoreAbsent:true});};
 }
 const api={ACTIONS,validateRequest,attach};CubeDevChannel=root.CubeDevChannel=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
