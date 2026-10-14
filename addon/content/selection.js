/* Plugin-owned selectable overlays + ephemeral bilingual selection. No PDF/annotation edits. */
var PaperLoomSelection;
(function(root){
 'use strict';
 const norm=c=>c.normalize('NFKC').replace(/[\s\u00ad]/g,'');
 function indexText(text){let flat='',offsets=[];for(let i=0;i<text.length;){const c=String.fromCodePoint(text.codePointAt(i)),n=norm(c);for(const x of n){flat+=x;offsets.push(i);}i+=c.length;}return {flat,offsets};}
 function sentences(text){
  const out=[];if(typeof Intl.Segmenter==='function'){for(const s of new Intl.Segmenter(/[\u3400-\u9fff]/.test(text)?'zh':'en',{granularity:'sentence'}).segment(text))if(s.segment.trim())out.push({start:s.index,end:s.index+s.segment.length,text:s.segment});}
  else{const re=/[^。！？!?]+(?:[。！？!?]+|$)/g;let m;while((m=re.exec(text)))out.push({start:m.index,end:m.index+m[0].length,text:m[0]});}
  return out.length?out:[{start:0,end:text.length,text}];
 }
 function mappedRange(source,target,start,end,terms=[]){
  if(!(start<end)||!source||!target)return null;start=Math.max(0,start);end=Math.min(source.length,end);
  const selected=source.slice(start,end).trim();
  const entries=terms;
  for(const term of entries){if(typeof term.source!=='string'||typeof term.target!=='string')continue;
   if(selected.toLowerCase()!==term.source.toLowerCase())continue;const p=target.indexOf(term.target);if(p>=0&&target.indexOf(term.target,p+1)<0)return {start:p,end:p+term.target.length,level:'term'};
  }
  if(selected&&/^[\p{L}\p{N}_.%+−-]+$/u.test(selected)){const p=target.indexOf(selected);if(p>=0&&target.indexOf(selected,p+1)<0)return {start:p,end:p+selected.length,level:'literal'};}
  const a=sentences(source),b=sentences(target);
  if(a.length===b.length){const hits=a.map((s,i)=>s.end>start&&s.start<end?i:-1).filter(i=>i>=0);
   if(hits.length)return {start:b[hits[0]].start,end:b[hits.at(-1)].end,level:'sentence'};
  }
  return {start:0,end:target.length,level:'paragraph'};
 }
 function sourceMap(record,chars){
  const [lo,hi]=record.layout.sourceRange||[0,chars.length],index=indexText(record.text);let flat='',indices=[];
  const splitLines=record.layout.lines?.filter(l=>Number.isFinite(l.columnGutter));
  for(let i=lo;i<Math.min(hi,chars.length);i++){const c=chars[i];if(c.ignorable)continue;
   if(splitLines?.length&&!splitLines.some(l=>i>=l.start&&i<l.end&&c.rect&&(c.rect[0]+c.rect[2])/2>=l.rect[0]-.1&&(c.rect[0]+c.rect[2])/2<=l.rect[2]+.1))continue;
   for(const ch of norm(c.u||c.c||'')){flat+=ch;indices.push(i);}}
  if(flat!==index.flat)return null;
  return {indices,offsets:index.offsets};
 }
 function domRange(body,start,end){
  const doc=body.ownerDocument,walk=doc.createTreeWalker(body,4),nodes=[];let n,offset=0;
  while((n=walk.nextNode())){nodes.push({n,start:offset,end:offset+n.length});offset+=n.length;}
  if(!nodes.length)return null;const a=nodes.find(x=>x.end>start)||nodes.at(-1),b=nodes.find(x=>x.end>=end)||nodes.at(-1),range=doc.createRange();
  range.setStart(a.n,Math.min(a.n.length,Math.max(0,start-a.start)));range.setEnd(b.n,Math.min(b.n.length,Math.max(0,end-b.start)));return range;
 }
 function attach(app){
  app.nativeOverlayBindings||=new Map();
  app.bindNativeOverlayInput=function(reader){
   let binding=this.nativeOverlayBindings.get(reader);if(binding)return binding;
   binding={cleanup:[],views:new Set(),drag:null};this.nativeOverlayBindings.set(reader,binding);
   const outer=reader._iframeWindow,unload=()=>this.closeNativeOverlayInput(reader);outer?.addEventListener?.('unload',unload,{once:true});binding.cleanup.push(()=>outer?.removeEventListener?.('unload',unload));
   const bind=()=>{for(const view of [reader._internalReader?._primaryView,reader._internalReader?._secondaryView]){
    if(!view||binding.views.has(view))continue;const win=view._iframeWindow;if(!win?.document)continue;binding.views.add(view);
    const style=win.document.createElement('style');style.textContent='.pl-inplace,.pl-inplace-text,.pl-inplace-text *,.pl-graphic-anchor[data-mode="replace"],.pl-graphic-anchor[data-mode="replace"] *{user-select:text !important;-moz-user-select:text !important;cursor:text !important;-moz-window-dragging:no-drag !important}.pl-inplace-text::selection,.pl-inplace-text *::selection{background:#76aaff88}.pl-graphic-select{user-select:none !important;-moz-user-select:none !important;-moz-window-dragging:no-drag !important;pointer-events:auto !important}';win.document.head.appendChild(style);binding.cleanup.push(()=>style.remove());
    const original=view.pointerEventToPosition;
    if(typeof original==='function'){
     const wrapped=function(e){const target=e.target?.nodeType===1?e.target:e.target?.parentElement;
      if(binding.drag?.win===win||target?.closest?.('.pl-inplace,.pl-graphic-select,.pl-graphic-anchor[data-mode="replace"]'))return null;
      return original.call(this,e);
     };view.pointerEventToPosition=wrapped;binding.cleanup.push(()=>{if(view.pointerEventToPosition===wrapped)view.pointerEventToPosition=original;});
    }
    const down=e=>{if(e.button!==0)return;const el=e.target?.closest?.('.pl-inplace,.pl-graphic-anchor[data-mode="replace"]');if(el)binding.drag={win};};
    const up=()=>{if(binding.drag?.win===win)binding.drag=null;};
    // Zotero's earlier copy capture handler writes underlying PDF text. Replace
    // clipboard contents only when selection belongs to our own translated DOM.
    const copy=e=>{const selection=win.getSelection(),node=selection?.anchorNode,el=node?.nodeType===1?node:node?.parentElement;
     if(!selection?.toString()||!el?.closest?.('.pl-inplace-text,.pl-graphic-anchor[data-mode="replace"]'))return;
     if(e.clipboardData){e.clipboardData.clearData();e.clipboardData.setData('text/plain',selection.toString());e.preventDefault();e.stopImmediatePropagation();}
    };
    const key=e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.key.toLowerCase()!=='c')return;const selection=win.getSelection(),n=selection?.anchorNode,el=n?.nodeType===1?n:n?.parentElement;
     if(selection?.toString()&&el?.closest?.('.pl-inplace-text,.pl-graphic-anchor[data-mode="replace"]')&&app.copy){e.preventDefault();e.stopImmediatePropagation();app.copy(selection.toString());binding.lastCopy={text:selection.toString(),trusted:e.isTrusted};}
    };
    win.addEventListener('mousedown',down,true);win.addEventListener('pointerup',up);win.addEventListener('copy',copy,true);win.addEventListener('keydown',key,true);win.addEventListener('blur',up);
    binding.cleanup.push(()=>{win.removeEventListener('mousedown',down,true);win.removeEventListener('pointerup',up);win.removeEventListener('copy',copy,true);win.removeEventListener('keydown',key,true);win.removeEventListener('blur',up);});
   }};binding.bind=bind;bind();return binding;
  };
  app.closeNativeOverlayInput=function(reader){const b=this.nativeOverlayBindings.get(reader);if(!b)return;for(const f of b.cleanup.splice(0))try{f();}catch{}this.nativeOverlayBindings.delete(reader);};
  app.bindSelectionSync=function(s){
   this.bindNativeOverlayInput(s.reader).bind();if(s.selectionSync)return;
   const left=s.reader._internalReader?._primaryView,right=s.reader._internalReader?._secondaryView;if(!left?._iframeWindow||!right?._iframeWindow)return;
   const state={origin:null,timer:null,nodes:[],last:null,details:[],bookmark:null,reflowUntil:0},cleanup=[];s.selectionSync=state;
   const clear=()=>{for(const n of state.nodes.splice(0))n.remove();state.details=[];};
   const rectMark=(page,r,level)=>{if(!(r.width>0&&r.height>0))return;const pr=page.getBoundingClientRect(),mark=page.ownerDocument.createElement('div');mark.className='pl-linked-selection';mark.dataset.level=level;mark.setAttribute('aria-hidden','true');
    mark.style.cssText='position:absolute;pointer-events:none;user-select:none;z-index:65;background:rgba(65,140,245,.28);border-radius:1px;mix-blend-mode:multiply;';mark.style.left=(r.left-pr.left)+'px';mark.style.top=(r.top-pr.top)+'px';mark.style.width=r.width+'px';mark.style.height=r.height+'px';page.appendChild(mark);state.nodes.push(mark);};
   const markTarget=(r,start,end,level)=>{const body=r.block?.el?.querySelector('.pl-inplace-text');if(!body)return;const range=domRange(body,start,end);for(const rect of Array.from(range?.getClientRects?.()||[]))rectMark(r.block.pageEl,rect,level);};
   const markSource=(r,start,end,level)=>{const chars=left._pdfPages?.[r.layout.pageIndex]?.chars;if(!chars)return;const map=sourceMap(r,chars),pv=left._iframeWindow.PDFViewerApplication.pdfViewer.getPageView(r.layout.pageIndex);if(!pv?.div||!map)return;
    const indices=[...new Set(map.indices.filter((_,i)=>map.offsets[i]>=start&&map.offsets[i]<end))],groups=[];
    for(const i of indices){const c=chars[i],q=Array.from(c.rect||[]);if(q.length!==4)continue;const prev=groups.at(-1);if(prev&&Math.abs(prev[1]-q[1])<2&&q[0]-prev[2]<8&&q[0]>=prev[0]){prev[2]=Math.max(prev[2],q[2]);prev[3]=Math.max(prev[3],q[3]);}else groups.push(q);}
    const pr=pv.div.getBoundingClientRect(),cv=pv.canvas||pv.div.querySelector('.canvasWrapper canvas'),sx=(cv?.clientWidth||pv.viewport.width)/pv.viewport.width,sy=(cv?.clientHeight||pv.viewport.height)/pv.viewport.height;
    for(const q of groups){const t=pv.viewport.transform,pts=[[q[0],q[1]],[q[0],q[3]],[q[2],q[1]],[q[2],q[3]]].map(([x,y])=>[t[0]*x+t[2]*y+t[4],t[1]*x+t[3]*y+t[5]]),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);rectMark(pv.div,{left:pr.left+Math.min(...xs)*sx,top:pr.top+Math.min(...ys)*sy,width:(Math.max(...xs)-Math.min(...xs))*sx,height:(Math.max(...ys)-Math.min(...ys))*sy},level);}
   };
   const update=()=>{state.timer=null;if(state.disposed)return;if(!s.alive()||!s.syncEnabled||s.hidden){state.last=null;clear();return;}const hits=[];
    if(state.origin==='left'){
     for(const range of Array.from(left._selectionRanges||[])){if(range.collapsed)continue;const page=range.pageIndex??range.position?.pageIndex,lo=Math.min(range.anchorOffset,range.headOffset),hi=Math.max(range.anchorOffset,range.headOffset);
      if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo===hi)continue;const chars=left._pdfPages?.[page]?.chars;if(!chars)continue;
      for(const r of s.records.values()){if(r.status!=='done'||r.layout.pageIndex!==page)continue;const map=sourceMap(r,chars);if(!map)continue;const positions=map.offsets.filter((_,i)=>map.indices[i]>=lo&&map.indices[i]<hi);if(positions.length)hits.push({r,start:Math.min(...positions),end:Math.max(...positions)+1});}
     }
    }else if(state.origin==='right'){
     const selection=s.win.getSelection();if(selection&&!selection.isCollapsed&&selection.rangeCount){const range=selection.getRangeAt(0);
      for(const r of s.records.values()){const body=r.block?.el?.querySelector('.pl-inplace-text');if(r.status!=='done'||!body||!range.intersectsNode(body))continue;
       let start=0,end=r.target.length;if(body.contains(range.startContainer)){const prefix=body.ownerDocument.createRange();prefix.selectNodeContents(body);prefix.setEnd(range.startContainer,range.startOffset);start=prefix.toString().length;}
       if(body.contains(range.endContainer)){const prefix=body.ownerDocument.createRange();prefix.selectNodeContents(body);prefix.setEnd(range.endContainer,range.endOffset);end=prefix.toString().length;}
       if(start<end)hits.push({r,start,end});
      }
     }
    }
    if(state.origin==='right'){
     if(hits.length)state.bookmark=hits.map(({r,start,end})=>({id:r.id,target:r.target,start,end}));
     else if(state.bookmark&&Date.now()<state.reflowUntil){
      const saved=state.bookmark.map(b=>({...b,r:s.records.get(b.id)}));
      if(saved.every(b=>b.r?.target===b.target&&b.r.block?.el?.isConnected)){
       const first=saved[0],last=saved.at(-1),a=domRange(first.r.block.el.querySelector('.pl-inplace-text'),first.start,first.end),b=domRange(last.r.block.el.querySelector('.pl-inplace-text'),last.start,last.end);
       if(a&&b){a.setEnd(b.endContainer,b.endOffset);const selection=s.win.getSelection();selection.removeAllRanges();selection.addRange(a);for(const v of saved)hits.push({r:v.r,start:v.start,end:v.end});}
      }
     }else state.bookmark=null;
    }
    const signature=JSON.stringify([state.origin,s.syncEnabled,hits.map(h=>[h.r.id,h.start,h.end,h.r.target]),left._iframeWindow.scrollY,s.win.scrollY]);if(state.last===signature)return;state.last=signature;clear();
    for(const {r,start,end} of hits){const reverse=state.origin==='right',terms=(s.cfg.glossary||[]).map(t=>reverse?{source:t.target,target:t.source}:t),mapped=app.alignedRange?.(r.alignment,reverse?r.target:r.text,reverse?r.text:r.target,start,end,reverse)||mappedRange(reverse?r.target:r.text,reverse?r.text:r.target,start,end,terms);if(!mapped)continue;
     state.details.push({id:r.id,origin:state.origin,selected:[start,end],mapped:[mapped.start,mapped.end],level:mapped.level});for(const span of mapped.spans||[mapped]){if(reverse)markSource(r,span.start,span.end,mapped.level);else markTarget(r,span.start,span.end,mapped.level);}
    }
   };
   const schedule=()=>{if(!state.disposed&&!state.timer)state.timer=setTimeout(update,25);};
   for(const [name,view] of [['left',left],['right',right]]){const win=view._iframeWindow;
    const down=e=>{if(e.button!==0||e.target?.closest?.('.pl-graphic-select'))return;state.origin=name;state.last=null;state.bookmark=null;state.reflowUntil=0;clear();
     // Passive pane uses visual marks, not an active selection or annotation.
     const other=name==='left'?right:left;other._iframeWindow.getSelection()?.removeAllRanges();schedule();};
    const move=e=>{if(e.buttons&1){state.origin=name;schedule();}};const changed=e=>{if(e?.key==='Escape'){state.bookmark=null;state.reflowUntil=0;}if(state.origin===name)schedule();};
    win.addEventListener('pointerdown',down,true);win.addEventListener('pointermove',move);win.addEventListener('pointerup',changed);win.document.addEventListener('selectionchange',changed);win.addEventListener('keyup',changed);
    cleanup.push(()=>{win.removeEventListener('pointerdown',down,true);win.removeEventListener('pointermove',move);win.removeEventListener('pointerup',changed);win.document.removeEventListener('selectionchange',changed);win.removeEventListener('keyup',changed);});
    for(const e of ['pagerendered','scalechanging','rotationchanging','updateviewarea'])this.bindPdfEvent(win,e,()=>{if(['scalechanging','rotationchanging'].includes(e)&&state.origin==='right'&&state.bookmark)state.reflowUntil=Date.now()+2500;state.last=null;schedule();},cleanup);
   }
   state.update=()=>{clearTimeout(state.timer);state.timer=null;state.last=null;update();};state.clear=()=>{state.last=null;state.bookmark=null;state.reflowUntil=0;clear();};
   state.dispose=()=>{state.disposed=true;for(const f of cleanup.splice(0))f();clearTimeout(state.timer);clear();if(s.selectionSync===state)delete s.selectionSync;};
   s.cleanup.push(state.dispose);
  };
 }
 PaperLoomSelection={attach,indexText,sentences,mappedRange,sourceMap,domRange};root.PaperLoomSelection=PaperLoomSelection;
 if(typeof module==='object'&&module.exports)module.exports=PaperLoomSelection;
})(globalThis);
