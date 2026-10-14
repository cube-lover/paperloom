/* Structured PDF reader projection, independent queue and lifecycle. */
var PaperLoomInPlace;
(function(root){
  'use strict';
  function attach(app,C,L) {
    app.ensureSecondaryPdfWin=async function(reader,alive=()=>true) {
      for(let i=0;i<60&&!reader?._internalReader;i++){if(!alive())return null;await new Promise(r=>setTimeout(r,100));}
      if(!alive())return null;
      const ir=reader?._internalReader;if(!ir)throw new Error('阅读器未就绪');
      if(ir.splitType!=='vertical')ir.toggleVerticalSplit(true);
      for(let i=0;i<80;i++){
        if(!alive())return null;
        const win=ir._secondaryView?._iframeWindow;
        if(win?.PDFViewerApplication?.pdfDocument?.getPageData&&win.document.querySelector('#viewer'))return win;
        await new Promise(r=>setTimeout(r,150));
      }
      throw new Error('PDF 结构化接口尚未就绪；请确认使用 Zotero 9 并等待论文载入');
    };
    app.readOperatorGeometry=async function(page){
      // Await crosses back through an Xray wrapper in Zotero. Unwrap both the page
      // and the returned operator list; retain only numeric geometry, never bitmap bytes.
      const unwrap=value=>typeof Components!=='undefined'&&Components.utils?.waiveXrays
        ?Components.utils.waiveXrays(value):value?.wrappedJSObject||value;
      const proxy=unwrap(page);
      if(typeof proxy?.getOperatorList!=='function')throw new Error('PDF 页未暴露图形算子接口');
      const source=unwrap(await proxy.getOperatorList()),geometry={fnArray:[],argsArray:[]};
      for(let i=0;i<source.fnArray.length;i++){
        const op=source.fnArray[i];if(![10,11,12,91,85,86,83].includes(op))continue;
        const args=source.argsArray[i]||[];let copied=[];
        if(op===12)copied=Array.from(args,Number);
        else if(op===91)copied=[typeof args[0]==='number'?args[0]:Array.from(args[0]||[],Number),[],args[2]?.length===4?Array.from(args[2],Number):null];
        geometry.fnArray.push(op);geometry.argsArray.push(copied);
      }
      return geometry;
    };
    app.inplaceStats=function(reader){const s=this.inplace?.get(reader);if(!s)return null;
      const counts={total:s.records.size,done:0,error:0,pending:0,running:0,overflow:0};
      for(const r of s.records.values()){counts[r.status]=(counts[r.status]||0)+1;try{if(r.block?.el?.dataset.overflow==='true')counts.overflow++;}catch{/* Detached page; translation data remains valid. */}}
      return {...counts,queued:s.queue?.length||0,workers:s.workers||0,parsed:s.parsed,pages:s.pdf.numPages,paused:s.paused,hidden:s.hidden,stage:s.stage};
    };
    app.pauseInPlace=function(reader,pause=true){const s=this.inplace?.get(reader);if(!s)return;
      if(!pause&&s.cfg?.confirmBeforeSend&&!s.graphicsConsent){if(!this.confirm('继续翻译','将论文正文及图表文字发送给所选引擎，图像仅在本地识别。继续？'))return;s.graphicsConsent=true;}
      s.paused=pause;s.update();if(!pause){s.resumeParse?.();s.graphicJob?.retry();s.pump?.();s.graphicJob?.schedule();}else{s.graphicJob?.pause();s.settle?.();}};
    app.retryInPlace=function(reader){const s=this.inplace?.get(reader);if(!s)return;for(const r of s.records.values())if(r.status==='error'){r.status='pending';s.enqueue?.(r);}s.graphicJob?.retry();this.pauseInPlace(reader,false);s.update();};
    app.toggleInPlace=function(reader){const s=this.inplace?.get(reader);if(!s)return;s.hidden=!s.hidden;s.doc.querySelector('#viewer')?.classList.toggle('pl-hide-translations',s.hidden);const g=this.graphicSessions?.get(reader);if(g){g.hidden=s.hidden;g.paint();this.saveGraphics(g).catch(e=>{g.message=e.message;});}s.update();};
    app.resizeInPlace=function(reader,delta){const s=this.inplace?.get(reader);if(!s)return;s.fontScale=Math.min(1.6,Math.max(.8,s.fontScale+delta));s.repaint?.();s.update();};
    app.snapshotInPlace=async function(reader){
      const s=this.inplace?.get(reader);if(!s?.layout)throw new Error('版面解析尚未完成');
      const records=[...s.records.values()];if(!records.some(r=>r.status==='done'))throw new Error('当前还没有完成的译文');
      let job=this.jobs.find(j=>j.id===s.jobID);
      if(!job){job=await this.createJob(records.map(r=>r.text).join('\n\n'),{title:'PDF 原位译文',attachmentID:reader.itemID,parser:L.VERSION});s.jobID=job.id;}
      job.config=JSON.parse(JSON.stringify(s.cfg));
      job.segments=records.map((r,i)=>({id:'s'+(i+1),source:r.text,target:r.target,page:r.layout.pageIndex+1,section:r.layout.section,
        status:r.status==='done'?'done':r.status==='error'?'error':'pending',error:'',warnings:[],manual:!!r.edited,reviewed:false,layoutID:r.id}));
      job.status=records.every(r=>r.status==='done')?'done':'paused';await this.persist();this.emit();return job;
    };
    app.measureInPlaceText=function(box,body){
      // scrollHeight is integer-rounded and min-height used to disguise natural text height.
      // Range rects report logical font extents (not raster ink). Keep conservative
      // bounds and a small internal font allowance; never grow over a neighbouring block.
      const frame=box.getBoundingClientRect(),natural=body.getBoundingClientRect();
      const range=body.ownerDocument.createRange();range.selectNodeContents(body);
      const ink=typeof range.getBoundingClientRect==='function'?range.getBoundingClientRect():null;
      const inside=r=>!r||!r.width||!r.height||r.left>=frame.left-.25&&r.top>=frame.top-.25&&r.right<=frame.right+.25&&r.bottom<=frame.bottom+.25;
      const measurable=box.isConnected!==false&&frame.width>0&&frame.height>0&&natural.height>0;
      const localScale=Number(body.dataset.localScale)||1;
      const fits=measurable&&body.scrollHeight*localScale<=box.clientHeight+(localScale<1?.5:0)&&body.scrollWidth*localScale<=box.clientWidth+(localScale<1?.5:0)&&inside(natural)&&inside(ink);
      const metrics={fits,measurable,naturalHeight:natural.height,inkHeight:ink?.height||0,frameHeight:frame.height,
        heightUse:frame.height&&ink?.height?ink.height/frame.height:null,overflowX:Math.max(0,body.scrollWidth*localScale-box.clientWidth),overflowY:Math.max(0,body.scrollHeight*localScale-box.clientHeight),naturalInside:inside(natural),inkInside:inside(ink)};
      range.detach?.();return metrics;
    };
    app.fitInPlaceText=function(box,body,baseSize) {
      // Keep translated text visible, but never spill an opaque paragraph over
      // neighbouring prose, tables or formulas. Unresolved fitting is reported,
      // not mistaken for success; the full text remains available for correction.
      const fits=()=>{const m=this.measureInPlaceText(box,body);return m.measurable===false||m.fits;};
      const small=baseSize<10,unit=small?4:1,floor=Math.min(baseSize,Math.max(small?4:7,baseSize*.55));
      body.dataset.localScale=String(1/unit);body.style.width=(unit*100)+'%';body.style.transformOrigin='0 0';body.style.transform=unit===1?'none':'scale('+1/unit+')';
      body.style.padding=small?'.14em 0 .08em':'.26em 0 .18em';if(small)body.style.lineHeight='1.45';
      let size=baseSize;body.style.fontSize=size*unit+'px';
      for(let i=0;i<18&&size>floor&&!fits();i++){size=Math.max(floor,size-Math.max(.25,baseSize*.04));body.style.fontSize=size*unit+'px';}
      const measurement=this.measureInPlaceText(box,body),overflow=measurement.measurable!==false&&!measurement.fits;
      box.dataset.layoutState=measurement.measurable===false?'unmeasured':overflow?'overflow':'fitted';box.dataset.overflow=String(overflow);
      box.dataset.textHeight=String(measurement.naturalHeight);box.dataset.inkHeight=String(measurement.inkHeight);
      box.dataset.heightUse=measurement.heightUse==null?'':String(measurement.heightUse);
      body.style.visibility='visible';
      body.style.background=box.dataset.paperBackground;
      box.style.background=box.dataset.paperBackground;
      box.style.overflow='hidden';
      box.style.outline=overflow?'1px dotted #b7791f':'none';
      box.title=overflow?'译文仍超出版面，框外部分未显示；Alt+双击查看和校订完整译文，或调整字号。\n'+body.textContent:'左键拖选并复制译文；Alt+双击校订；按住 Alt 查看原文';
      return !overflow;
    };
    app.paintStructuredBlock=function(s,record,pageEl,viewport) {
      const block=record.layout,protectedRegions=s.layout?.pages[block.pageIndex]?.protectedRegions||[];
      // Second gate at draw time protects against restored/stale record geometry.
      // Record/target remains intact; only the unsafe opaque overlay is withheld.
      if(L.frameConflicts(block.rect,protectedRegions).length){record.block?.el?.remove();record.block=null;record.layoutConflict=true;return null;}
      record.layoutConflict=false;const p=L.projection(block.rect,viewport),doc=s.doc;
      let box=record.block?.el;
      if(!box||box.parentNode!==pageEl){
        box?.remove();box=doc.createElement('div');box.className='pl-inplace';box.tabIndex=0;box.dataset.blockId=block.id;
        box.style.cssText='position:absolute;left:0;top:0;transform-origin:0 0;box-sizing:border-box;z-index:30;padding:0;border:0;overflow:hidden;white-space:normal;';
        const body=doc.createElement('div');body.className='pl-inplace-text';
        body.style.cssText='box-sizing:border-box;width:100%;padding:.26em 0 .18em;margin:0;overflow-wrap:anywhere;white-space:normal;';box.appendChild(body);
        const peek=on=>{body.style.opacity=on?'0':'1';box.style.background=on?'transparent':box.dataset.paperBackground;};
        box.addEventListener('pointermove',e=>peek(e.altKey));box.addEventListener('pointerleave',()=>peek(false));
        box.addEventListener('keydown',e=>{if(e.key==='Alt')peek(true);});box.addEventListener('keyup',e=>{if(e.key==='Alt')peek(false);});box.addEventListener('blur',()=>peek(false));
        box.addEventListener('click',e=>{
          if(e.altKey||record.status!=='done'||s.win.getSelection()?.toString())return;
          const action=s.cfg.clickAction;if(action==='none')return;
          const text=action==='source'?record.text:action==='target'?record.target:record.text+'\n\n'+record.target;
          this.copy?.(text);
        });
        box.addEventListener('dblclick',e=>{
          if(!e.altKey||record.status!=='done')return;
          const value=s.win.prompt('校订此段译文（仅保存到本次原位会话）',record.target);
          if(value?.trim()){record.target=value.trim();record.edited=true;delete record.alignment;s.paint(record);s.update();}
        });
        pageEl.appendChild(box);record.block={el:box,pageEl,viewport};
      }else record.block.viewport=viewport;
      const body=box.firstChild,renderState=record.status==='done'?'done':record.status==='error'?'error':'pending';
      const geometry=[p.width,p.height,...p.matrix].join(',');
      const paintKey=JSON.stringify([renderState,record.target,s.fontScale,s.cfg.reader.serif,block.typography]);
      const theme=s.pageThemes?.get(pageEl);
      if(record.block.paintKey===paintKey&&record.block.theme===theme&&box.dataset.layoutState!=='unmeasured'){
        // Scale/rotation changes affect only the transform, not font measurement.
        if(record.block.geometry!==geometry){const display=record.renderedRect?L.projection(record.renderedRect,viewport):p;box.style.width=display.width+'px';box.style.height=display.height+'px';box.style.transform='matrix('+display.matrix.join(',')+')';record.block.geometry=geometry;}
        return box;
      }
      delete record.renderedRect;record.block.paintKey=paintKey;record.block.geometry=geometry;record.block.theme=theme;
      box.style.width=p.width+'px';box.style.height=p.height+'px';box.style.transform='matrix('+p.matrix.join(',')+')';
      box.dataset.state=renderState;
      const style=theme?null:s.win.getComputedStyle(pageEl),canvas=theme?null:pageEl.querySelector('.canvasWrapper');
      const bg=theme?.bg||style.getPropertyValue('--page-background')||style.getPropertyValue('--pdf-page-background-color')||'#fff';
      box.dataset.paperBackground=bg;box.style.background=bg;box.style.color=theme?.color||style?.getPropertyValue('--page-color')||'#111';
      box.style.filter=theme?.filter||(canvas?s.win.getComputedStyle(canvas).filter:'none');
      body.style.fontFamily=s.cfg.reader.serif?'"Noto Serif SC","SimSun",serif':'"Microsoft YaHei",sans-serif';
      body.style.lineHeight=String(block.typography.lineHeight);body.style.textIndent=block.typography.indent+'px';
      body.style.fontWeight=block.typography.bold?'700':'400';body.style.fontStyle='normal';
      body.style.textAlign=block.role==='body'?'justify':'start';body.style.visibility='visible';
      if(record.status==='done') {
        if(body.textContent!==record.target)body.textContent=record.target;
        const fits=this.fitInPlaceText(box,body,block.typography.fontSize*s.fontScale);
        if(!fits&&block.frameLimits&&L.validRect(block.inkRect)){
          // Whitespace belongs to the midpoint between immutable neighbouring
          // ink boxes. Use it before accepting clipping, without moving ink.
          const pad=block.typography.fontSize*3,expanded=[block.rect[0],Math.max(block.frameLimits.bottom,block.rect[1]-pad),block.rect[2],Math.min(block.frameLimits.top,block.rect[3]+pad)];
          if(L.validRect(expanded)&&!L.frameConflicts(expanded,protectedRegions).length){const ep=L.projection(expanded,viewport);box.style.height=ep.height+'px';box.style.transform='matrix('+ep.matrix.join(',')+')';record.renderedRect=expanded;record.block.geometry=geometry;body.style.lineHeight=String(Math.max(1.1,Math.min(1.3,block.typography.lineHeight)));this.fitInPlaceText(box,body,block.typography.fontSize*s.fontScale);}
        }
      }else {
        body.textContent='';box.style.background='transparent';box.dataset.overflow='false';
        box.style.outline=record.status==='error'?'1px solid #c0392b':'1px dashed #d14b4b';
        if(record.status==='error')box.style.background='transparent';
        box.title=record.status==='error'?'此段翻译失败，原文已保留；点击上方重试失败':'等待翻译';
      }
      return box;
    };
    app.bindPdfEvent=function(win,name,listener,cleanup){
      // EventBus is ordinary content JS, unlike DOM EventTarget. Chrome callbacks
      // must be exported, otherwise dispatch sees an opaque non-callable wrapper.
      const callback=typeof Components!=='undefined'&&Components.utils?.exportFunction
        ?Components.utils.exportFunction(listener,win):listener;
      const bus=win.PDFViewerApplication.eventBus;bus?.on(name,callback);
      cleanup.push(()=>bus?.off(name,callback));return callback;
    };
    app.bindInPlaceSync=function(s){
      const primary=s.reader._internalReader?._primaryView?._iframeWindow;
      if(!primary?.PDFViewerApplication)return;
      const pairs=[[primary,s.win],[s.win,primary]];let lock=null,releaseTimer=null,syncTimer=null,pending=null;
      const last=new WeakMap();
      for(const [source,target] of pairs){
        const src=source.PDFViewerApplication,dst=target.PDFViewerApplication;
        const release=()=>{if(lock===source)lock=null;};
        source.addEventListener('wheel',release,{passive:true});source.addEventListener('pointerdown',release);
        const sync=({location}={})=>{
          if(!s.alive()||!s.syncEnabled||!location||lock===source)return;
          const {pageNumber,left,top,scale}=location;
          if(!Number.isInteger(pageNumber)||!Number.isFinite(left)||!Number.isFinite(top))return;
          const signature=[pageNumber,left,top,scale].join('|');if(last.get(source)===signature)return;
          last.set(source,signature);pending={source,target,dst,pageNumber,left,top,scale};
          if(syncTimer)return;
          syncTimer=setTimeout(()=>{
            syncTimer=null;const p=pending;pending=null;if(!p||!s.alive()||!s.syncEnabled)return;
            lock=p.target;clearTimeout(releaseTimer);
            try{
              const value=typeof p.scale==='number'?p.scale/100:p.scale;
              if(value!=null&&String(p.dst.pdfViewer.currentScaleValue)!==String(value))p.dst.pdfViewer.currentScaleValue=value;
              const destination={pageNumber:p.pageNumber,destArray:[null,{name:'XYZ'},p.left,p.top,null],allowNegativeOffset:true};
              p.dst.pdfViewer.scrollPageIntoView(typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto(destination,p.target):destination);
            }finally{releaseTimer=setTimeout(()=>{lock=null;},180);}
          },16);
        };
        this.bindPdfEvent(source,'updateviewarea',sync,s.cleanup);
        s.cleanup.push(()=>{source.removeEventListener('wheel',release);source.removeEventListener('pointerdown',release);});
      }
      s.cleanup.push(()=>{clearTimeout(releaseTimer);clearTimeout(syncTimer);pending=null;});
    };
    app.prioritizeInPlace=function(s) {
      // Rank only waiting work; never abort/reissue a running request. Use the pane
      // the user last interacted with (left original or right translation).
      const win=s.priorityWin||s.win,viewer=win.PDFViewerApplication?.pdfViewer;
      if(!viewer||s.queue.length<2)return;
      const current=Math.max(0,(Number(viewer.currentPageNumber)||1)-1),container=viewer.container?.getBoundingClientRect();
      const clip=container?.width>0&&container?.height>0?container:{left:0,top:0,right:win.innerWidth||0,bottom:win.innerHeight||0};
      const pages=new Map(),rank=new Map();
      for(const r of s.queue){const index=r.layout.pageIndex;
        if(!pages.has(index)){
          const pv=viewer.getPageView?.(index)||viewer._pages?.[index],el=pv?.div||win.document?.querySelector('#viewer .page[data-page-number="'+(index+1)+'"]');
          const rect=el?.getBoundingClientRect();
          pages.set(index,{pv,rect,visible:!!(rect?.width>0&&rect?.height>0&&rect.bottom>clip.top&&rect.top<clip.bottom&&rect.right>clip.left&&rect.left<clip.right)});
        }
        const {pv,rect,visible}=pages.get(index);let onScreen=false,top=Infinity,left=0;
        if(visible&&pv?.viewport?.transform){
          const b=L.projection(r.layout.inkRect||r.layout.rect,pv.viewport).bounds;
          const sx=pv.viewport.width>0?rect.width/pv.viewport.width:1,sy=pv.viewport.height>0?rect.height/pv.viewport.height:1;
          const q={left:rect.left+b[0]*sx,top:rect.top+b[1]*sy,right:rect.left+b[2]*sx,bottom:rect.top+b[3]*sy};
          onScreen=q.bottom>clip.top&&q.top<clip.bottom&&q.right>clip.left&&q.left<clip.right;top=q.top;left=q.left;
        }
        rank.set(r,[onScreen?0:visible?1:index===current?2:3,Math.abs(index-current),top,left,index,r.layout.sourceRange?.[0]||0]);
      }
      s.queue.sort((a,b)=>{const x=rank.get(a),y=rank.get(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]<y[i]?-1:1;return 0;});
    };
    app.translateInPlace=async function(reader,{translateBlock,pdfDocument,restoredRecords,startPaused=false}={}){
      const existing=this.inplace?.get(reader);
      if(existing){existing.hidden=false;existing.doc.querySelector('#viewer')?.classList.remove('pl-hide-translations');this.pauseInPlace(reader,false);existing.repaint?.();existing.update();return existing;}
      this.inplaceStarting||=new Set();if(this.inplaceStarting.has(reader))return;
      if(this.active.size||this.aiBusy||this.batchActive)throw new Error('已有任务在运行，请稍候');
      this.inplaceStarting.add(reader);this.inplaceTokens||=new Map();
      const CANCELLED=Symbol('cancelled'),token={};token.cancelled=new Promise(resolve=>{token.cancel=()=>resolve(CANCELLED);});this.inplaceTokens.set(reader,token);
      const alive=()=>!this.stopped&&this.inplaceTokens.get(reader)===token;
      const wait=async promise=>{const value=await Promise.race([promise,token.cancelled]);if(value===CANCELLED||!alive())throw CANCELLED;return value;};
      try {
        const cfg=C.validateConfig(this.config);
        if(!startPaused&&cfg.confirmBeforeSend&&!this.confirm('确认翻译','将论文正文及图表文字发送给所选引擎；图像仅在本地识别。继续？'))return;
        const win=await wait(this.ensureSecondaryPdfWin(reader,alive));
        if(this.stopped||this.inplaceTokens.get(reader)!==token)return;
        const pdf=pdfDocument||win.PDFViewerApplication?.pdfDocument;
        if(!pdf?.getPageData)throw new Error('缺少 Zotero PDF 结构化解析接口');
        const s={reader,win,doc:win.document,pdf,cfg,control:{stopped:false,requests:new Set()},records:new Map(),pages:new Map(),queue:[],workers:0,waiters:[],cleanup:[],parsed:0,stage:'parsing',fontScale:1,hidden:false,paused:false,syncEnabled:true,update:()=>{}};
        this.inplace||=new Map();this.inplace.set(reader,s);
        s.alive=()=>!this.stopped&&!s.control.stopped&&this.inplace.get(reader)===s;
        const key='inplace:'+reader.itemID;s.activeKey=key;
        s.pageThemes=new WeakMap();s.dirty=new Set();s.renderCount=0;s.renderBatches=0;
        const visibility=s.doc.createElement('style');visibility.textContent='#viewer.pl-hide-translations .pl-inplace{display:none !important;}';s.doc.head.appendChild(visibility);
        s.cleanup.push(()=>{visibility.remove();s.doc.querySelector('#viewer')?.classList.remove('pl-hide-translations');});
        this.mountInPlaceControls(s);s.update();
        const unload=()=>this.clearInPlace(reader);win.addEventListener('unload',unload,{once:true});s.cleanup.push(()=>win.removeEventListener('unload',unload));
        const layouts=[],outline=await wait(pdf.getOutline().catch(()=>[]));
        for(let i=0;i<pdf.numPages;i++){
          if(!s.alive())return s;
          // Firefox's worker postMessage rejects privileged-realm object wrappers.
          // Clone only this numeric request into the owning PDF iframe realm.
          const query=typeof Components!=='undefined'&&Components.utils?.cloneInto
            ?Components.utils.cloneInto({pageIndex:i},win):{pageIndex:i};
          while(s.paused&&s.alive())await wait(new Promise(resolve=>{s.resumeParse=resolve;}));
          const data=await wait(pdf.getPageData(query));
          if(!s.alive())return s;
          const page=await wait(pdf.getPage(i+1));
          let ops;try{ops=await wait(this.readOperatorGeometry(page));}catch(e){if(e===CANCELLED)throw e;s.graphicsWarning=true;(s.graphicsErrors||=[]).push({page:i,name:e.name,message:e.message});}
          if(!s.alive())return s;
          layouts.push(L.parsePage(data,{pageIndex:i,outline,operatorList:ops}));s.parsed++;s.update();
          // Yield between pages so cancel and reader input stay responsive.
          await new Promise(r=>setTimeout(r,0));
        }
        if(!s.alive())return s;
        if(s.graphicsWarning)throw new Error('PDF 图形解析未完成，已保留原文。请重新打开此 PDF 后重试。');
        s.layout=L.finalize(layouts,cfg);s.stage='ready';
        // Consume each archived record once. Exact source + page/ink identity
        // prevents repeated headings on different pages from sharing corrections.
        const restored=new Map(),used=new Set();
        for(const r of restoredRecords||[])if(r.status==='done'&&typeof r.text==='string'&&typeof r.target==='string'&&r.target.trim()){
          const key=r.text.replace(/\s+/g,' ').trim();if(!restored.has(key))restored.set(key,[]);restored.get(key).push(r);
        }
        for(const b of s.layout.blocks)if(!b.skipReason){
          const pool=(restored.get(b.text.replace(/\s+/g,' ').trim())||[]).filter(r=>!used.has(r));
          const samePage=pool.filter(r=>(r.pageIndex??r.layout?.pageIndex)===b.pageIndex);
          let candidates=samePage.length?samePage:pool.filter(r=>!Number.isInteger(r.pageIndex??r.layout?.pageIndex));
          if(candidates.length>1){const exact=candidates.filter(r=>{const q=r.inkRect||r.layout?.inkRect;return L.validRect(q)&&q.every((v,i)=>Math.abs(v-b.inkRect[i])<.5);});candidates=exact;}
          const old=candidates.length===1?candidates[0]:null;if(old)used.add(old);
          s.records.set(b.id,{id:b.id,layout:b,text:b.text,status:old?'done':'pending',target:old?.target||'',edited:!!old?.edited,alignment:old?.alignment||null,queued:false});
        }
        s.unmatchedRestoredRecords=(restoredRecords||[]).filter(r=>r.status==='done'&&!used.has(r));
        s.paused=!!startPaused;s.graphicsConsent=!startPaused;
        if(!translateBlock&&this.reuseGraphicTranslations)await this.reuseGraphicTranslations(s);
        if(!s.records.size)throw new Error('没有可翻译正文；扫描件请先进行 OCR');
        const flushPaint=()=>{
          s.renderTimer=null;if(!s.alive())return;
          const began=Date.now();let count=0;s.renderBatches++;
          for(const r of s.dirty){
            s.dirty.delete(r);const mount=r.mount;
            if(mount?.pageEl.isConnected){this.paintStructuredBlock(s,r,mount.pageEl,mount.viewport);s.renderCount++;}
            if(++count>=4||Date.now()-began>=6)break;
          }
          if(s.dirty.size)s.renderTimer=setTimeout(flushPaint,16);else {s.update();s.settle();}
        };
        s.paint=r=>{if(!s.alive()||!r.mount?.pageEl.isConnected)return;s.dirty.add(r);if(!s.renderTimer)s.renderTimer=setTimeout(flushPaint,0);};
        s.repaint=()=>{for(const r of s.records.values())s.paint(r);};
        s.settle=()=>{if(!s.workers&&!s.dirty.size&&!s.renderTimer&&(s.paused||!s.queue.length)){
          if(this.active.get(key)===s.control)this.active.delete(key);
          for(const resolve of s.waiters.splice(0))resolve(s);
        }};
        const translate=translateBlock||((text,config,control,context)=>this.translate(text,config,context,control));
        s.pump=()=>{
          if(!s.alive())return;
          if(s.paused){s.settle();return;}
          if([...this.active.values()].some(c=>c!==s.control)||this.aiBusy||this.batchActive){
            if(!s.pumpTimer)s.pumpTimer=setTimeout(()=>{s.pumpTimer=null;s.pump();},250);return;
          }
          s.graphicJob?.schedule();this.prioritizeInPlace(s);
          while(s.workers<cfg.concurrency&&s.queue.length){
            const r=s.queue.shift();r.queued=false;r.status='running';s.workers++;this.active.set(key,s.control);
            const preceding=r.layout.continuesFrom?s.records.get(r.layout.continuesFrom)?.text:'';
            const following=r.layout.continuesTo?s.records.get(r.layout.continuesTo)?.text:'';
            const context=[preceding?'[上接原文，仅供理解] '+preceding:'',following?'[下接原文，仅供理解] '+following:''].filter(Boolean).join('\n');
            Promise.resolve().then(()=>s.alive()?translate(r.text,cfg,s.control,context):null).then(result=>{
              if(!s.alive())return;
              if(!result||typeof result.text!=='string'||!result.text.trim())throw new Error('Empty translation');
              r.target=result.text;r.status='done';s.paint(r);
            }).catch(()=>{if(s.alive()){r.status='error';s.paint(r);}}).finally(()=>{s.workers--;s.update();
              // Cached/failed requests can resolve in a microtask chain; yield before dispatching more.
              if(s.alive()&&!s.pumpTimer)s.pumpTimer=setTimeout(()=>{s.pumpTimer=null;s.pump();},0);
              s.settle();
            });
          }
          s.update();s.settle();
        };
        s.enqueue=r=>{if(r.status==='pending'&&!r.queued){r.queued=true;s.queue.push(r);}};
        s.enqueueAll=()=>{for(const r of s.records.values())s.enqueue(r);this.pauseInPlace(reader,false);};
        const scan=()=>{
          if(!s.alive())return;
          if(reader._internalReader?._secondaryView?._iframeWindow!==win){this.clearInPlace(reader);return;}
          for(const [page] of s.pages)if(!page.isConnected){for(const r of s.records.values())if(r.mount?.pageEl===page){r.block?.el?.remove();r.block=null;r.mount=null;s.dirty.delete(r);}s.pages.delete(page);}
          for(const pageEl of s.doc.querySelectorAll('#viewer .page')){
            const index=Number(pageEl.dataset.pageNumber)-1;
            if(!Number.isInteger(index)||!pageEl.querySelector('.textLayer span, canvas'))continue;
            const pv=win.PDFViewerApplication.pdfViewer?.getPageView?.(index)||win.PDFViewerApplication.pdfViewer?._pages?.[index];
            if(!pv?.viewport?.transform||pv.div&&pv.div!==pageEl)continue;
            if(win.getComputedStyle(pageEl).position==='static'&&!s.pages.has(pageEl)){
              const old=pageEl.style.position;pageEl.style.position='relative';s.cleanup.push(()=>{pageEl.style.position=old;});
            }
            const style=win.getComputedStyle(pageEl),canvas=pageEl.querySelector('.canvasWrapper');
            const theme={bg:style.getPropertyValue('--page-background')||style.getPropertyValue('--pdf-page-background-color')||'#fff',color:style.getPropertyValue('--page-color')||'#111',filter:canvas?win.getComputedStyle(canvas).filter:'none'};
            const old=s.pageThemes.get(pageEl);if(!old||JSON.stringify(old)!==JSON.stringify(theme))s.pageThemes.set(pageEl,theme);
            for(const b of s.layout.pages[index]?.blocks||[]){const r=s.records.get(b.id);if(!r)continue;
              const sig=Array.from(pv.viewport.transform).join(',');
              const changed=r.mount?.pageEl!==pageEl||r.mount?.sig!==sig||r.block?.el?.parentNode!==pageEl||r.block?.theme!==s.pageThemes.get(pageEl)||r.block?.el?.dataset.layoutState==='unmeasured';
              r.mount={pageEl,viewport:pv.viewport,sig};if(changed)s.paint(r);s.enqueue(r);
            }
            s.pages.set(pageEl,true);
          }
          // With sync disabled, the left pane can show a page that is not mounted
          // on the right yet. Queue its records without creating offscreen DOM.
          const activePane=s.priorityWin||win,activeViewer=activePane.PDFViewerApplication?.pdfViewer;
          const focusPage=(Number(activeViewer?.currentPageNumber)||0)-1;
          if(focusPage>=0)for(const b of s.layout.pages[focusPage]?.blocks||[]){const r=s.records.get(b.id);if(r)s.enqueue(r);}
          s.pump();
        };
        const schedule=()=>{if(s.alive()&&!s.timer)s.timer=setTimeout(()=>{s.timer=null;scan();},80);};
        const owned=n=>n?.nodeType===1&&(n.matches?.('.pl-inplace, .pl-inplace-controls, .pl-linked-selection, .pl-graphic-anchor')||n.closest?.('.pl-inplace, .pl-inplace-controls, .pl-linked-selection'));
        const Observer=typeof Zotero!=='undefined'?Zotero.getMainWindow().MutationObserver:win.MutationObserver;
        s.observer=new Observer(records=>{if(records.some(r=>!owned(r.target)&&[...r.addedNodes,...r.removedNodes].some(n=>!owned(n)))||records.some(r=>[...r.removedNodes].some(n=>n.matches?.('.pl-inplace')&&[...s.records.values()].some(v=>v.block?.el===n&&!n.isConnected))))schedule();});
        s.observer.observe(s.doc.querySelector('#viewer'),{childList:true,subtree:true});
        const bus=win.PDFViewerApplication.eventBus;
        for(const event of ['textlayerrendered','pagerendered','scalechanging','rotationchanging'])this.bindPdfEvent(win,event,()=>{schedule();clearTimeout(s.trailingScan);s.trailingScan=setTimeout(()=>{s.trailingScan=null;if(s.alive())scan();},300);},s.cleanup);
        s.cleanup.push(()=>clearTimeout(s.trailingScan));
        this.bindInPlaceSync(s);this.bindSelectionSync?.(s);
        const reprioritize=()=>{if(!s.alive()||s.priorityTimer)return;s.priorityTimer=setTimeout(()=>{s.priorityTimer=null;if(s.alive())scan();},32);};
        for(const pane of new Set([win,reader._internalReader?._primaryView?._iframeWindow].filter(Boolean))){
          const interaction=()=>{s.priorityWin=pane;reprioritize();};
          for(const event of ['wheel','pointerdown','keydown']){pane.addEventListener(event,interaction,{passive:true});s.cleanup.push(()=>pane.removeEventListener(event,interaction));}
          this.bindPdfEvent(pane,'updateviewarea',reprioritize,s.cleanup);
        }
        s.cleanup.push(()=>clearTimeout(s.priorityTimer));
        if(!translateBlock&&s.cfg.translateGraphics!==false)this.bindArticleGraphics?.(s);
        // Translation scheduling is document-wide, independent of PDF.js lazy DOM.
        // Rendering below mounts only visible pages; navigation only reprioritizes
        // the waiting queue and never becomes a prerequisite for translation.
        for(const r of s.records.values())s.enqueue(r);
        s.rescan=scan;scan();s.update();
        if(!s.workers&&!s.queue.length&&!s.dirty.size&&!s.renderTimer)return s;
        return await new Promise(resolve=>s.waiters.push(resolve));
      }catch(error){if(error===CANCELLED)return;if(this.inplaceTokens.get(reader)===token)this.clearInPlace(reader,{keepAction:true});throw error;}
      finally{if(this.inplaceTokens.get(reader)===token){this.inplaceStarting.delete(reader);if(!this.inplace?.has(reader))this.inplaceTokens.delete(reader);}this.refreshReaderButton?.(reader);}
    };
    app.clearInPlace=function(reader,{keepAction=false}={}){
      this.inplaceTokens?.get(reader)?.cancel?.();this.inplaceTokens?.delete(reader);this.inplaceStarting?.delete(reader);
      const action=this.inplaceActions?.get(reader);if(action&&!keepAction){action.cancelled=true;clearTimeout(action.timer);this.inplaceActions.delete(reader);}
      const s=this.inplace?.get(reader);
      if(s){
        clearTimeout(this.checkpointTimers?.get(s));this.checkpointTimers?.delete(s);
        this.saveInPlaceCheckpoint?.(s).catch(e=>{s.checkpointError=e.message;});
        if(s.alignmentControl){s.alignmentControl.stopped=true;for(const req of s.alignmentControl.requests)req.abort();}
        s.control.stopped=true;s.observer?.disconnect();clearTimeout(s.timer);clearTimeout(s.pumpTimer);clearTimeout(s.renderTimer);s.dirty?.clear();s.resumeParse?.();
        for(const xhr of s.control.requests)try{xhr.abort();}catch{}
        for(const fn of s.cleanup)try{fn();}catch{}
        // The iframe may already be destroyed when a reader closes. Always release
        // queue/session ownership even if its DOM wrapper is no longer usable.
        try{for(const el of s.doc.querySelectorAll('.pl-inplace'))el.remove();}catch{}
        s.queue.length=0;for(const resolve of s.waiters.splice(0))resolve(s);
        if(this.active.get(s.activeKey)===s.control)this.active.delete(s.activeKey);
        s.pages.clear();s.records.clear();this.inplace.delete(reader);
      }
      this.refreshReaderButton?.(reader);
    };
  }
  const api={attach};PaperLoomInPlace=root.PaperLoomInPlace=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
