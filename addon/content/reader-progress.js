/* Read-only progress presentation. No translation requests, dialogs or page jumps
   happen during rendering; locating a task is an explicit user action. */
var CubeReaderProgress;
(function(root){'use strict';
 const brief=(s,n=60)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
 function model({article:a,graphics:g,pageIndex=0,painted=null}){
  const j=a?.graphicJob,rows=(g?.rows||[]).filter(r=>!r.legacyLayout&&r.selected&&!r.preserveSource),local=rows.filter(r=>r.pageIndex===pageIndex),translated=rows.filter(r=>r.target).length;
  const active=[...(g?.activeLabels?.values()||[])],busy=!!(g?.busy||j?.busy),loc=active[0]||g?.activity||null;
  const taskPage=busy?(active[0]?.pageIndex??j?.current??loc?.pageIndex):null;
  const phase=busy?(g?.phase==='translate'?'正在翻译':g?.phase==='background'?'正在排版':g?.phase==='render'?'读取原图':'本地识别'):a?.paused?'已暂停':j?.pending?.size?'等待处理':j?'检查结束':'尚未开始';
  const totalPages=a?.pdf?.numPages||0,checked=(j?.completed?.size||0)+(j?.failed?.size||0),failed=j?.failed?.size||0;
  let task=phase,detail='',target=null;
  if(busy&&Number.isInteger(taskPage)){
   const region=active[0]?.region||loc?.region;
   task=phase+' · 第 '+(taskPage+1)+' 页'+(region?' · '+region.label:'');
   if(region?.total>1)task+='（'+region.index+'/'+region.total+'）';
   if(active.length){task+=' · '+active.length+' 组文字并行';detail='原文：'+active.map(x=>(x.region?x.region.label+' · ':'')+brief(x.text,54)+(x.copies>1?'（'+x.copies+'处同文复用）':'')).join(' / ');}
   else if(g?.phase==='translate')detail='等待引擎处理本页图中文字';
   else if(region)detail=brief(region.title||'',100);
   if(g?.progress&&g.phase==='translate')task+=' · 本批已译 '+g.progress.done+'/'+g.progress.total;
   target={pageIndex:taskPage,rect:active[0]?.rect||region?.rect||null};
   if(a?.paused)task+=' · 暂停收尾';
  }else if(a?.stage==='parsing')task='版面解析 · 第 '+a.parsed+'/'+totalPages+' 页';
  else if(g?.lastLocation){task+=(a?.paused?' · 停在':' · 最近处理')+'第 '+(g.lastLocation.pageIndex+1)+' 页'+(g.lastLocation.region?' · '+g.lastLocation.region.label:'');target={pageIndex:g.lastLocation.pageIndex,rect:g.lastLocation.region?.rect||null};}
  else if(a?.paused&&j?.pending?.size)detail='继续后优先处理当前阅读页，再推进全文';
  const overall=a?.cfg?.translateGraphics===false?'图表翻译已关闭':'图表：本轮检查 '+checked+'/'+totalPages+' 页 · 已译 '+translated+'/'+rows.length+' 处'+(failed?' · 失败 '+failed+' 页':'');
  let coverage='右侧第 '+(pageIndex+1)+' 页：';
  if(a?.hidden||g?.hidden)coverage+='译文已收起';
  else if(!local.length)coverage+=j?.completed?.has(pageIndex)?'无待译图中文字':'图表待检查';
  else{
   const done=local.filter(r=>r.target).length;coverage+='已译 '+done+'/'+local.length+' 处';
   if(painted===null)coverage+=' · 覆盖待页面显示后核验';
   else{const paintOf=r=>{const v=painted.get(r.id);return v==null?null:typeof v==='string'?{mode:v}:v;},norm=t=>String(t||'').replace(/\s+/g,'').toLowerCase();
    const shown=local.filter(r=>r.target&&paintOf(r)?.mode==='replace'),hidden=local.filter(r=>r.target&&paintOf(r)?.mode==='hotspot');
    // A stored target identical to its source (variable names such as prMF.19)
    // paints no overlay at all; report it as such instead of as missing.
    const noop=local.filter(r=>r.target&&!paintOf(r)&&norm(r.target)===norm(r.text)),unverified=done-shown.length-hidden.length-noop.length;
    coverage+=' · 已原位显示 '+shown.length+' 处';
    // 近似底色的补丁要报出来：它们不是"擦干净"，只是不脏。
    const approx=shown.filter(r=>{const c=paintOf(r)?.cover;return c==='sampled-flat'||c==='paper-fallback';});
    if(approx.length)coverage+='（其中 '+approx.length+' 处为近似底色）';
    if(hidden.length){const why=[...new Set(hidden.map(r=>paintOf(r)?.reason||'待核对定位框'))];coverage+=' · 未显示 '+hidden.length+' 处（'+why.slice(0,2).join('；')+(why.length>2?' 等':'')+'）';}
    if(noop.length)coverage+=' · 原文即译文 '+noop.length+' 处';
    if(unverified)coverage+=' · 待显示核验 '+unverified+' 处';}
  }
  return {phase,busy,task,detail,overall,coverage,target,failed,pageIndex,translated,total:rows.length};
 }
 function attach(app){
  app.readerProgress=function(reader){const a=this.inplace?.get(reader),g=this.graphicSessions?.get(reader),win=reader._internalReader?._secondaryView?._iframeWindow,v=win?.PDFViewerApplication?.pdfViewer;
   const pageIndex=Math.max(0,(v?.currentPageNumber||1)-1),pv=v?.getPageView?.(pageIndex);let painted=null;
   if(pv?.renderingState===3&&pv.div?.isConnected){painted=new Map();for(const n of pv.div.querySelectorAll('.pl-graphic-anchor'))painted.set(n.dataset.labelId,{mode:n.dataset.mode,reason:n.dataset.fallback,cover:n.dataset.cover});}
   return model({article:a,graphics:g,pageIndex,painted});
  };
  app.locateTranslationTask=async function(reader){const target=this.readerProgress(reader).target;if(!target)return;const a=this.inplace?.get(reader),w=reader._internalReader?._secondaryView?._iframeWindow,v=w?.PDFViewerApplication?.pdfViewer;if(!v)return;
   v.currentPageNumber=target.pageIndex+1;
   for(let i=0;i<30;i++){const pv=v.getPageView(target.pageIndex);if(pv?.renderingState===3){if(target.rect){const q=target.rect,x=(q[0]+q[2])/2,y=(q[1]+q[3])/2;const args={pageNumber:target.pageIndex+1,destArray:[null,{name:'XYZ'},x,y,null],allowNegativeOffset:false};v.scrollPageIntoView?.(typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto(args,w):args);}a?.rescan?.();this.graphicSessions?.get(reader)?.paint();return;}await new Promise(r=>setTimeout(r,100));}
  };
  app.requestCurrentGraphics=function(reader){const a=this.inplace?.get(reader);if(!a||a.stage!=='ready')throw Error('先启动本篇原位翻译，待版面解析结束后再补译');
   a.cfg.translateGraphics=true;const index=this.graphicPageIndex(reader),j=this.bindArticleGraphics(a);if(!Number.isInteger(index)||index<0||index>=a.pdf.numPages)return;
   j.completed.delete(index);j.failed.delete(index);j.pending.add(index);(j.forcePages||=new Set()).add(index);j.priorityPage=index;
   this.pauseInPlace(reader,false);a.update();
  };
  app.mountInPlaceControls=function(s){const doc=s.reader._iframeWindow?.document||s.doc;if(!doc.body)return;
   const bar=doc.createElement('section');bar.className='pl-inplace-controls';bar.setAttribute('aria-label','原位翻译状态');
   bar.style.cssText='position:fixed;left:12px;bottom:12px;z-index:100;box-sizing:border-box;width:min(680px,calc(100vw - 24px));max-height:30vh;overflow:auto;display:grid;gap:5px;padding:9px 12px;background:Canvas;color:CanvasText;border:1px solid #aab5c455;border-radius:9px;box-shadow:0 2px 10px #18243612;font:12px/1.45 system-ui;';
   const style=doc.createElement('style');style.textContent='.pl-inplace-controls button{font:inherit;color:inherit;background:transparent;border:1px solid #8797ac55;border-radius:4px;min-height:24px;padding:1px 6px;cursor:pointer;-moz-window-dragging:no-drag}.pl-inplace-controls button:hover{background:#8797ac18}.pl-inplace-controls button:focus-visible{outline:2px solid #4966a0;outline-offset:2px}.pl-inplace-controls [hidden]{display:none!important}.pl-task-source{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pl-translation-meta{opacity:.78;font-variant-numeric:tabular-nums}';bar.appendChild(style);
   const head=doc.createElement('div');head.style.cssText='display:flex;align-items:center;gap:7px;flex-wrap:wrap;';bar.appendChild(head);
   const state=doc.createElement('strong');state.className='pl-reading-state';head.appendChild(state);
   const prose=doc.createElement('span');prose.className='pl-prose-status pl-translation-meta';head.appendChild(prose);
   const spacer=doc.createElement('span');spacer.style.flex='1';head.appendChild(spacer);
   const button=(text,label,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.title=label;head.appendChild(b);const run=()=>Promise.resolve().then(fn).catch(e=>this.refreshReaderButton?.(s.reader,e.message));if(this.bindReaderCommand)s.cleanup.push(this.bindReaderCommand(b,run));else b.addEventListener('click',run);return b;};
   button('A−','缩小正文字号',()=>this.resizeInPlace(s.reader,-.05));button('A+','放大正文字号',()=>this.resizeInPlace(s.reader,.05));
   const locate=button('定位','在右侧查看当前处理位置',()=>this.locateTranslationTask(s.reader));
   const task=doc.createElement('div');task.className='pl-task-location';task.setAttribute('role','status');task.setAttribute('aria-live','polite');task.setAttribute('aria-atomic','true');bar.appendChild(task);
   const source=doc.createElement('div');source.className='pl-task-source pl-translation-meta';bar.appendChild(source);
   const overall=doc.createElement('div');overall.className='pl-article-graphic-status pl-translation-meta';bar.appendChild(overall);
   const coverage=doc.createElement('div');coverage.className='pl-page-graphic-status pl-translation-meta';bar.appendChild(coverage);
   doc.body.appendChild(bar);s.cleanup.push(()=>bar.remove());
   const set=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
   s.update=(checkpoint=true)=>{const c=this.inplaceStats(s.reader);if(!c)return;const p=this.readerProgress(s.reader);
    set(state,s.hidden?'原文视图':s.paused?'已暂停':c.running||p.busy?'翻译中':'原位翻译');
    set(prose,'正文 '+c.done+'/'+c.total+' 段'+(c.error?' · 失败 '+c.error:'')+(c.overflow?' · 排版待调 '+c.overflow:''));
    set(task,p.task);task.hidden=!p.busy&&!p.target&&s.stage!=='parsing';set(source,p.detail);source.hidden=!p.detail||!p.busy;source.title=p.detail;set(overall,p.overall);set(coverage,p.coverage);locate.hidden=!p.target;locate.title=p.target?'查看第 '+(p.target.pageIndex+1)+' 页处理位置':'暂无处理位置';
    this.refreshReaderButton?.(s.reader);if(checkpoint)this.scheduleInPlaceCheckpoint?.(s);
   };
   // A slow read-only refresh covers page turns and mounted-overlay changes even
   // when the translation queue is paused. It never recreates editable text DOM.
   let timer;const tick=()=>{if(!bar.isConnected)return;s.update(false);timer=setTimeout(tick,1000);};timer=setTimeout(tick,1000);s.cleanup.push(()=>clearTimeout(timer));
  };
 }
 const api={model,brief,attach};CubeReaderProgress=root.CubeReaderProgress=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
