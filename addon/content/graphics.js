/* Independent chart labels. Immutable PDF-space anchors; never move/erase chart geometry. */
var PaperLoomGraphics;
(function(root){
  'use strict';
  const finite=Number.isFinite;
  const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  function inverse(m){const d=m[0]*m[3]-m[1]*m[2];if(!finite(d)||Math.abs(d)<1e-10)throw Error('无效的页面变换');return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
  function bounds(q){const xs=q.map(p=>p[0]),ys=q.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}
  function area(r){return Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);}
  function overlap(a,b){return area([Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])]);}
  function inside(p,r){return p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];}
  function quad(r){return [[r[0],r[3]],[r[2],r[3]],[r[2],r[1]],[r[0],r[1]]];}
  function project(q,transform){
    const p=q.map(x=>point(transform,x)),w=Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]),h=Math.hypot(q[3][0]-q[0][0],q[3][1]-q[0][1]);
    if(w<.01||h<.01)throw Error('文字定位框为空');
    return {width:w,height:h,matrix:[(p[1][0]-p[0][0])/w,(p[1][1]-p[0][1])/w,(p[3][0]-p[0][0])/h,(p[3][1]-p[0][1])/h,...p[0]]};
  }
  function pixelsToPDF(polygon,capture){return polygon.map(p=>point(inverse(capture.transform),[capture.x+p[0]/capture.sx,capture.y+p[1]/capture.sy]));}
  function translatable(text){return (/^(?:Yes|No)$/i.test(text.trim())||/[A-Za-z]{3,}/.test(text))&&!/^\s*(?:https?:|www\.)/i.test(text);}
  function nativeLabels(chars,rect){
    // Only join on a common baseline with a short inter-character gap. A table row
    // is not a paragraph: never merge words across cell/legend/column gaps.
    const lines=[];
    for(const c of chars||[]){
      const r=c.rect,t=c.u||c.c||'';
      if(!Array.isArray(r)||r.length!==4||!r.every(finite)||!t.trim()||!r.every((v,i)=>v>=(i%2?rect[1]:rect[0])-.1&&v<=(i%2?rect[3]:rect[2])+.1))continue;
      if(Math.abs(Number(c.rotation)||0)>.1)continue; // Rotated glyphs use OCR polygon anchors.
      const height=r[3]-r[1],base=finite(c.baseline)?c.baseline:r[1];
      let line=lines.find(l=>Math.abs(l.base-base)<Math.max(.7,height*.12)&&Math.abs(l.height-height)<height*.25&&r[0]>=l.rect[0]-.2&&r[0]-l.rect[2]<height*.8);
      if(!line){line={base,height,rect:[...r],text:'',last:null};lines.push(line);}
      const gap=r[0]-line.rect[2];if(line.text&&(line.last?.spaceAfter||gap>height*.18))line.text+=' ';
      line.text+=t;line.rect=[Math.min(line.rect[0],r[0]),Math.min(line.rect[1],r[1]),Math.max(line.rect[2],r[2]),Math.max(line.rect[3],r[3])];line.last=c;
    }
    return lines.map(l=>({text:l.text,quad:quad(l.rect),origin:'PDF',score:1}));
  }
  function textTables(chars,rules,L){return L?.textTables?L.textTables(chars,rules):[];}
  function mergeLabels(native,ocr,capture){
    const rows=native.map(r=>({...r}));
    for(const line of (ocr?.lines||[]).slice(0,1000)){
      if(typeof line.text!=='string'||!Array.isArray(line.polygon)||line.polygon.length!==4||!line.polygon.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite)))continue;
      if(!line.polygon.every(p=>p[0]>=-2&&p[1]>=-2&&p[0]<=ocr.width+2&&p[1]<=ocr.height+2))continue;
      const q=pixelsToPDF(line.polygon,capture),b=bounds(q);
      if(!area(b))continue;
      // Suppress duplicate or partially covered OCR lines; partial native/OCR
      // agreement is review-only rather than drawing two overlapping translations.
      const existing=rows.filter(r=>overlap(bounds(r.quad),b)/Math.max(1,Math.min(area(bounds(r.quad)),area(b)))>.3);
      if(existing.length){for(const r of existing)if(r.text.replace(/\s/g,'').toLowerCase()!==line.text.replace(/\s/g,'').toLowerCase())r.review=true;continue;}
      rows.push({text:line.text.trim().slice(0,2000),quad:q,...(line.sourcePolygon?{sourceQuad:pixelsToPDF(line.sourcePolygon,capture)}:{}),origin:'OCR',score:finite(line.score)?line.score:0,review:line.score<.94||line.directionVerified===false,
        directionVerified:line.directionVerified,rotation:line.rotation||0,flowNode:!!line.flowNode,flowEvidence:line.flowEvidence||null,members:line.members||null,fontSize:finite(line.fontSize)?line.fontSize/(Math.hypot(capture.transform[0],capture.transform[1])*capture.sx):undefined,inkRefined:!!line.inkRefined,orientationAgreement:line.orientationAgreement,directionMargin:line.directionMargin,textConfirmed:!!line.textConfirmed,directionEvidence:line.directionEvidence,recognitionPass:line.recognitionPass||'detect',previousText:line.previousText||''});
    }
    return rows.filter(r=>r.text.trim()).sort((a,b)=>bounds(b.quad)[3]-bounds(a.quad)[3]||bounds(a.quad)[0]-bounds(b.quad)[0]);
  }
  const normalizedText=t=>String(t||'').replace(/\s+/g,'').toLowerCase();
  // Orientation matters for the *rendered* label, not for machine review. A
  // horizontal run of readable words is displayable even when the local OCR
  // orientation pass could not beat its own reversed reading.
  const readableLabel=t=>{const n=String(t||'').replace(/\s/g,'');if(!n)return false;const letters=(n.match(/[A-Za-z\u3400-\u9fff]/g)||[]).length;return letters>=3&&letters/n.length>=.6;};
  // Ordered-character cover: OCR passes disagree on i/l/1, so a fragment can be
  // an exact subsequence of the line row without matching it byte for byte.
  const cover=(big,small)=>{
    if(!big||!small||small.length>=big.length)return 0;
    let prev=new Uint32Array(small.length+1);
    for(let i=1;i<=big.length;i++){const cur=new Uint32Array(small.length+1);for(let j=1;j<=small.length;j++)cur[j]=big[i-1]===small[j-1]?prev[j-1]+1:Math.max(prev[j],cur[j-1]);prev=cur;}
    return prev[small.length]/small.length;
  };
  const insideBox=(a,b)=>a[0]>=b[0]-1&&a[1]>=b[1]-1&&a[2]<=b[2]+1&&a[3]<=b[3]+1;
  // A word-level row that sits inside a stored line-level row (or an exact
  // duplicate from a second OCR pass) must never compete with it: only one of
  // them may own the rectangle, otherwise both are hidden by their own overlap.
  const redundant=(keep,drop)=>{
    if(drop.id===keep.id||keep.pageIndex!==drop.pageIndex)return false;
    const nk=normalizedText(keep.text),nd=normalizedText(drop.text);
    if(!nk||!nd)return false;
    const K=bounds(keep.quad),D=bounds(drop.quad),small=Math.max(1,Math.min(area(K),area(D)));
    if(overlap(K,D)/small<.6)return false;
    if(nk===nd)return area(K)!==area(D)?area(K)>area(D):String(keep.id).localeCompare(String(drop.id))<0;
    // A narrower line row that lives inside a much larger stored block (the same
    // visual line read twice with a template prefix) never gets its own box.
    if(area(K)>=area(D)*2&&(insideBox(D,K)||overlap(K,D)/small>=.6))return true;
    return cover(nk,nd)>=.8&&(insideBox(D,K)||overlap(K,D)/small>=.8);
  };
  function replacementReason(row,rows){
    if(row.legacyLayout)return '旧版跨区域译文已保留，请按新单元格校订';
    if(row.preserveSource)return '保留题目原始拼写';
    if(row.preserveLiterals?.some(t=>!String(row.target).includes(t)))return '题目字符需保持原样';
    if(!row.target)return '尚未翻译';
    if(rows.some(r=>redundant(r,row)))return '重复识别，已保留完整一处';
    if(normalizedText(row.target)===normalizedText(row.text))return '译文与原文相同，无需替换';
    const q=row.quad,dx=q[1][0]-q[0][0],dy=q[1][1]-q[0][1],hx=q[3][0]-q[0][0],hy=q[3][1]-q[0][1];
    const w=Math.hypot(dx,dy),h=Math.hypot(hx,hy);
    if(w<.1||h<.1)return '文字定位框为空';
    const verticalFrame=!['PDF-text-table','PDF-caption'].includes(row.origin)&&(h>w*1.6||Math.abs(dy)>Math.abs(dx)*1.6);
    if((verticalFrame||['90','270'].includes(String(row.rotation)))&&row.directionVerified!==true)return '文字阅读方向待核对';
    if(row.directionVerified===false&&!readableLabel(row.text))return '文字阅读方向待核对';
    // Arbitrary page rotation is allowed. Compare edges in local label space,
    // never reject a valid 90/270-degree baseline because it is vertical on screen.
    // Rotation is a valid label geometry (the quad keeps its right angles); only a
    // genuinely sheared proposal – beyond about 10 degrees – keeps the source.
    if(Math.abs(dx*hx+dy*hy)/(w*h)>.18||Math.hypot(q[2][0]-(q[1][0]+hx),q[2][1]-(q[1][1]+hy))>Math.max(.5,h*.12))return '斜切标签定位待核对';
    const b=bounds(q),labelArea=area(b);
    if(rows.some(r=>{if(r===row)return false;if(redundant(row,r))return false;const a=bounds(r.sourceQuad||r.quad),cross=overlap(b,a);if(cross<=.1)return false;
      // Two stored translations only share a rectangle when they really stack:
      // slivers, grazing ticks and adjacent annotation lines never veto each other.
      const ow=Math.max(0,Math.min(b[2],a[2])-Math.max(b[0],a[0])),oh=Math.max(0,Math.min(b[3],a[3])-Math.max(b[1],a[1]));
      if(ow/Math.max(1,Math.min(b[2]-b[0],a[2]-a[0]))<.55||oh/Math.max(1,Math.min(b[3]-b[1],a[3]-a[1]))<.55)return false;
      // A stored translation is only hidden when two text boxes really share
      // space. Numeric ticks that graze the side of a rotated axis title, or a
      // tiny fragment crossing one edge, never own that interior.
      const share=cross/Math.max(1,Math.min(labelArea,area(a)));if(share<=.2)return false;
      if(!r.target&&area(a)<=labelArea*.35)return false;
      // A low-confidence punctuation proposal centred outside a fully audited
      // closed node may have padded corners crossing its edge. The actual node
      // background evidence, not the punctuation detector, owns that interior.
      if(row.flowNode&&row.flowEvidence?.version===2&&row.flowEvidence.unexplainedInk===0&&r.origin==='OCR'&&r.review&&r.score<.8&&!r.target&&!/[\p{L}\p{N}]/u.test(r.text)&&cross<area(a)*.2&&!inside([(a[0]+a[2])/2,(a[1]+a[3])/2],b))return false;return true;}))return '与其他文字相交';
    return '';
  }
  function plainBackground(image,{textBounds=null}={}){
    // Conservative: near-white paper only; reject colour, long strokes touching
    // frame edges, gridlines and opaque/coloured cells. No generative inpainting.
    const {data,width:w,height:h}=image;if(w<8||h<5)return null;
    const dark=(x,y)=>{const i=(y*w+x)*4;return Math.min(data[i],data[i+1],data[i+2])<215;};
    let white=0,border=0,totalBorder=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);
      if(hi-lo>22&&lo<235&&!(textBounds&&inside([x,y],[textBounds[0]-2,textBounds[1]-2,textBounds[2]+2,textBounds[3]+2])))return null;if(lo>240)white++;
      if(x===0||y===0||x===w-1||y===h-1){totalBorder++;if(dark(x,y))border++;}
    }
    if(white/(w*h)<.68||border/totalBorder>.025)return null;
    for(let y=0;y<h;y++){let run=0;for(let x=0;x<w;x++){run=dark(x,y)?run+1:0;if(run>Math.max(12,w*.75))return null;}}
    for(let x=0;x<w;x++){let run=0;for(let y=0;y<h;y++){run=dark(x,y)?run+1:0;if(run>Math.max(12,h*.85))return null;}}
    return '#fff';
  }
  const runtimePref='extensions.zotero.paperloom.graphics.runtime';
  const unwrap=value=>typeof Components!=='undefined'&&Components.utils?.waiveXrays?Components.utils.waiveXrays(value):value?.wrappedJSObject||value;
  function attach(app,C,L){
    app.graphicEngineVersion='graphics-layout-0835';
    app.compatibleGraphicEngines=['0.8.35'];
    app.graphicTableLabels=function(data,selection,rules=[]){
      if(!L?.tableStructure)return {tables:[],labels:[]};
      const tables=L.tableStructure(data.chars,rules).filter(t=>overlap(t.rect,selection)>area(t.rect)*.9);
      const labels=tables.flatMap((t,table)=>{
        const body=t.bodyCells.filter(c=>c.column===0&&/\b(?:fine[- ]tuned|zero[- ]shot|one[- ]shot|few[- ]shot)\b/i.test(c.text)&&!L.numericCell(c.text)).map(c=>{const next=t.columns[1],pad=Math.min(1.5,c.fontSize*.2),peers=t.bodyCells.filter(p=>p.column===0&&p!==c);let lo=c.rect[1]-pad,hi=c.rect[3]+pad;for(const p of peers){if(p.rect[3]<=c.rect[1])lo=Math.max(lo,(p.rect[3]+c.rect[1])/2+.15);if(p.rect[1]>=c.rect[3])hi=Math.min(hi,(p.rect[1]+c.rect[3])/2-.15);}return {...c,inkRect:c.rect,rect:[c.rect[0]-.5,lo,Math.min(next?next.left-2:c.rect[2]+2,c.rect[2]+c.fontSize*2),hi],bodyLabel:true};});
        return [...t.headerCells,...body].map(c=>({text:c.text,quad:quad(c.rect),sourceQuad:quad(c.inkRect),origin:'PDF-table',score:1,table,tableColumn:c.column,review:false,directionVerified:true,bodyLabel:!!c.bodyLabel,
        fontSize:c.fontSize,selected:translatable(c.text)&&!/^\s*(?:N|Acc(?:\/F1\/BLEU)?|F1|BLEU|FLOPS?)\s*$/i.test(c.text),tableRows:t.rowCount,tableColumns:t.columnCount}));});
      return {tables,labels};
    };
    app.graphicSessions=new Map();app.graphicProcesses=new Set();
  const shortcutPref='extensions.zotero.paperloom.reader.shortcut',DEFAULT_SHORTCUT='Alt+R';
  app.readerShortcut=function(){let v=null;try{v=Zotero.Prefs.get(shortcutPref,true);}catch{}
   // An unset preference (undefined) means the shipped default; an explicitly
   // emptied preference turns the shortcut off.
   return typeof v==='string'?v.trim():DEFAULT_SHORTCUT;};
  app.setReaderShortcut=function(value){try{Zotero.Prefs.set(shortcutPref,String(value||'').trim(),true);}catch{}return this.readerShortcut();};
  // "Alt+R" / "Ctrl+Shift+L" / "F9": modifiers are exact, Ctrl and Cmd are one
  // physical modifier so a single setting works on Windows and macOS.
  app.matchShortcut=function(spec,event){
   const parts=String(spec||'').split('+').map(x=>x.trim()).filter(Boolean);if(!parts.length||!event)return false;
   const key=parts.pop().toLowerCase(),mods=new Set(parts.map(x=>x.toLowerCase())),
    wantShift=mods.has('shift'),wantAlt=mods.has('alt')||mods.has('option'),wantCmd=mods.has('ctrl')||mods.has('cmd')||mods.has('control')||mods.has('meta');
   if(wantShift!==!!event.shiftKey||wantAlt!==!!event.altKey||wantCmd!==!!(event.ctrlKey||event.metaKey))return false;
   const name=String(event.key||'').toLowerCase();
   return name===key||(key==='space'&&name===' ')||(key==='esc'&&name==='escape')||(key==='plus'&&name==='+');
  };
    app.graphicRuntime=function(){try{return JSON.parse(Zotero.Prefs.get(runtimePref,true)||'{}');}catch{return {};}};
    app.setGraphicRuntimeValue=function(key,value){
      const next={...this.graphicRuntime()};if(value===undefined||value===null||value==='')delete next[key];else next[key]=value;
      Zotero.Prefs.set(runtimePref,JSON.stringify(next),true);return next;
    };
    // 图内文字识别只走本机 Python 路线（用户已验证的那套：方向判定、结构处理）。
    // 不再内置推理引擎：内置移动模型的识别质量不合格，已整体移除。
    app.runGraphicOCR=async function(canvas,control){return this.runGraphicOCRPython(canvas,control);};
    app.runGraphicOCRPython=async function(canvas,control){
      const cfg=this.graphicRuntime();if(!cfg.python||!cfg.runtime||!cfg.models)throw Error('请先在图表面板配置本地 OCR 路径');
      for(const p of [cfg.python,cfg.runtime,cfg.models])if(!await IOUtils.exists(p))throw Error('本地 OCR 路径不存在，请检查配置');
      const dir=PathUtils.join(this.dir,'graphic-tmp');await IOUtils.makeDirectory(dir,{ignoreExisting:true});
      const id='ocr-'+crypto.randomUUID(),input=PathUtils.join(dir,id+'.png'),output=PathUtils.join(dir,id+'.json'),worker=PathUtils.join(dir,id+'-worker.py');
      let proc,timer;
      try{
        const script=await (await fetch(this.runtimeRoot+'content/ocr-image.py')).text();await IOUtils.writeUTF8(worker,script);
        const raw=Zotero.getMainWindow().atob(canvas.toDataURL('image/png').split(',')[1]);
        await IOUtils.write(input,Uint8Array.from(raw,c=>c.charCodeAt(0)));
        if(control.stopped||this.stopped)throw Error('图表识别已取消');
        const {Subprocess}=ChromeUtils.importESModule('resource://gre/modules/Subprocess.sys.mjs');
        proc=await Subprocess.call({command:cfg.python,arguments:[worker,'--input',input,'--output',output,'--runtime',cfg.runtime,'--models',cfg.models],stderr:'ignore'});
        this.graphicProcesses.add(proc);control.process=proc;if(control.stopped||this.stopped)proc.kill();
        timer=setTimeout(()=>proc.kill(),120000);const drain=(async()=>{while(await proc.stdout.readString()){} })();const result=await proc.wait();await drain;
        if(control.stopped||this.stopped)throw Error('图表识别已取消');
        if(result.exitCode!==0||!await IOUtils.exists(output))throw Error('本地 OCR 运行失败，请检查运行环境和模型');
        const parsed=JSON.parse(await IOUtils.readUTF8(output));
        if(parsed.error||parsed.width!==canvas.width||parsed.height!==canvas.height||!Array.isArray(parsed.lines))throw Error('OCR 返回尺寸不匹配，已停止定位');
        return parsed;
      }finally{clearTimeout(timer);if(proc)this.graphicProcesses.delete(proc);control.process=null;for(const p of [input,output,output.replace(/\.json$/,'.tmp'),worker])await IOUtils.remove(p,{ignoreAbsent:true}).catch(()=>{});}
    };
    app.graphicSession=async function(reader){
      let s=this.graphicSessions.get(reader);if(s)return s;
      const doc=reader._iframeWindow?.document;if(!doc)throw Error('阅读器尚未就绪');
      s={reader,doc,rows:[],cleanup:[],control:{stopped:false,requests:new Set()},hidden:false,replace:false,busy:false,selection:null,update:()=>{},paint:()=>{}};
      this.graphicSessions.set(reader,s);
      s.ready=(async()=>{
        const pdf=reader._internalReader?._primaryView?._iframeWindow?.PDFViewerApplication?.pdfDocument;
        const fingerprint=pdf?.fingerprints?.[0]||pdf?.fingerprint;if(!fingerprint)throw Error('PDF 指纹尚未就绪，请稍后重试');
        await IOUtils.makeDirectory(PathUtils.join(this.dir,'graphics'),{ignoreExisting:true});
        s.fingerprint=String(fingerprint);s.file='graphics/'+await this.hash(String(reader.itemID)+'|'+s.fingerprint)+'.json';
        const saved=await this.readJSON(s.file,null);
        if(saved?.version===1&&saved.fingerprint===s.fingerprint&&Array.isArray(saved.rows)){
          s.rows=saved.rows.filter(r=>r&&typeof r.id==='string'&&typeof r.text==='string'&&typeof r.target==='string'&&Number.isInteger(r.pageIndex)&&Array.isArray(r.quad)&&r.quad.length===4&&r.quad.every(p=>p.length===2&&p.every(finite)));
          s.replace=saved.replace===true;s.hidden=saved.hidden===true;
          if(Number.isInteger(saved.lastLocation?.pageIndex)&&saved.lastLocation.pageIndex>=0&&saved.lastLocation.pageIndex<pdf.numPages)s.lastLocation=saved.lastLocation;
          if(Array.isArray(saved.nativeBackgrounds))s.nativeBackgrounds=new Map(saved.nativeBackgrounds.filter(e=>Array.isArray(e)&&e.length===2&&typeof e[0]==='string'&&e[1]?.verified===true&&e[1]?.fingerprint===s.fingerprint&&typeof e[1]?.url==='string'&&e[1].url.startsWith('data:image/png;base64,')&&e[1].url.length<2000000));
        }
        if(this.stopped||this.graphicSessions.get(reader)!==s)throw Error('图表面板已关闭');
        this.mountGraphicPanel(s);this.bindGraphicPages(s);return s;
      })();
      try{return await s.ready;}catch(e){this.closeGraphics(reader);throw e;}
    };
    app.saveGraphics=function(s){return this.writeJSON(s.file,{version:1,fingerprint:s.fingerprint,replace:!!s.replace,hidden:!!s.hidden,lastLocation:s.lastLocation||null,nativeBackgrounds:[...s.nativeBackgrounds||[]],rows:s.rows.map(({element,...r})=>r)});};
    app.openGraphics=async function(reader,{panel=true}={}){this.bindNativeOverlayInput?.(reader)?.bind();const s=await this.graphicSession(reader);await s.ready;if(panel)s.panel.hidden=false;s.update();return s;};
    app.toggleGraphics=async function(reader){const s=await this.graphicSession(reader);await s.ready;s.hidden=!s.hidden;s.paint();s.update();await this.saveGraphics(s);};
    app.closeGraphics=function(reader){const s=this.graphicSessions.get(reader);if(!s)return;this.closeNativeBackgrounds?.(s);this.graphicSessions.delete(reader);s.control.stopped=true;s.control.process?.kill();s.control.renderTask?.cancel();clearTimeout(s.paintTimer);for(const v of s.hiRes?.values()||[])try{v.canvas.width=v.canvas.height=0;}catch(e){}s.hiRes?.clear();for(const xhr of [...s.control.requests])xhr.abort();s.selection?.();for(const clean of s.cleanup.splice(0))clean();s.panel?.remove();};
    app.bindGraphicPages=function(s){
      const bound=new Set(),paint=()=>{if(this.stopped||!this.graphicSessions.has(s.reader))return;
        // The primary pane is always the unmodified source, even after split
        // recreation. Only the secondary PDF may contain translated overlays.
        const primary=s.reader._internalReader?._primaryView?._iframeWindow;
        for(const node of primary?.document.querySelectorAll('.pl-graphic-anchor')||[])node.remove();
        for(const view of [s.reader._internalReader?._secondaryView]){
          const win=view?._iframeWindow;if(!win?.PDFViewerApplication)continue;s.bindPanelDismiss?.(win);
          if(!bound.has(win)){bound.add(win);for(const e of ['pagerendered','scalechanging','rotationchanging'])this.bindPdfEvent(win,e,()=>{s.paintKeys=new WeakMap();paint();},s.cleanup);}
          const viewer=win.PDFViewerApplication.pdfViewer;
          for(const pageEl of win.document.querySelectorAll('.page[data-page-number]')){
            const index=Number(pageEl.dataset.pageNumber)-1,pv=viewer.getPageView(index);if(!pv?.viewport)continue;
            if(pv.renderingState!==3){s.paintKeys?.delete(pageEl);for(const old of pageEl.querySelectorAll('.pl-graphic-anchor')){old.plDispose?.();old.remove();}continue;}
            const key=JSON.stringify([this.nativeArtifactRevision||0,s.maskRevision||0,s.hidden,s.replace,Array.from(pv.viewport.transform),pageEl.clientWidth,pageEl.clientHeight,s.rows.filter(r=>r.pageIndex===index).map(r=>[r.id,r.legacyLayout,r.preserveSource,r.preserveLiterals,r.text,r.target,r.approved,r.autoValidated,r.review,r.warnings,r.quad,r.directionVerified,r.background,r.fontSize,r.score,r.inkPatch?.quad])]);
            if(s.paintKeys?.get(pageEl)===key)continue;(s.paintKeys||=new WeakMap()).set(pageEl,key);
            for(const old of pageEl.querySelectorAll('.pl-graphic-anchor')){old.plDispose?.();old.remove();}
            if(s.hidden)continue;
            for(const row of s.rows.filter(r=>r.pageIndex===index&&r.target&&!r.legacyLayout))this.paintGraphicLabel(s,row,pageEl,pv.viewport,pv);
          }
        }
      };s.paint=paint;
      let timer;const tick=()=>{paint();const index=this.graphicPageIndex(s.reader);if(index!==s.panelPage){s.panelPage=index;if(!s.busy)s.message='';s.update();}if(this.graphicSessions.get(s.reader)===s)timer=setTimeout(tick,1500);};timer=setTimeout(tick,1500);s.cleanup.push(()=>clearTimeout(timer));
      const onUnload=()=>this.closeGraphics(s.reader);s.doc.defaultView.addEventListener('unload',onUnload,{once:true});s.cleanup.push(()=>s.doc.defaultView.removeEventListener('unload',onUnload));
      s.cleanup.push(()=>{for(const win of bound)try{for(const node of win.document.querySelectorAll('.pl-graphic-anchor')){node.plDispose?.();node.remove();}}catch{}});paint();
    };
    // 在原文框内统计出现最多的颜色（=背景）与占比：地图/色块上用它做不透明补丁。
    // 高分辨率页面缓存：整页按 ~4 倍只渲一次，之后每一行从它上面裁自己的框。
    // 键里不含滚动/偏移，所以滚动不会触发重渲；缩放或旋转变化才失效。
    app.graphicHiResPage=function(s,pv,index){
      let scale=4;while(scale>2&&(pv.viewport.width*scale)*(pv.viewport.height*scale)>12e6)scale--;
      const key=index+'|'+scale.toFixed(2)+'|'+(pv.viewport.rotation||0);
      s.hiRes||=new Map();
      const hit=s.hiRes.get(key);if(hit)return hit.promise?hit.promise:null;
      const entry={canvas:null,viewport:null,promise:null};s.hiRes.set(key,entry);
      const busy=()=>{try{entry.canvas.width=entry.canvas.height=0;}catch(e){}};
      for(const [k,v] of [...s.hiRes])if(s.hiRes.size>2&&(k!==key||v===entry)){try{v.canvas.width=v.canvas.height=0;}catch(e){}s.hiRes.delete(k);}
      entry.promise=(async()=>{
      const page=unwrap(pv.pdfPage||pv.page);
      if(!page?.render||!page?.getViewport)throw Error('页面还在加载，稍后重试');
      // pdf.js 只在页面自己的 realm 里认这些参数：跨 realm 传对象会丢掉 canvasContext。
      const win=pv.div?.ownerDocument?.defaultView||s.doc?.defaultView;
      const local=v=>typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto(v,win,{wrapReflectors:true}):v;
      const viewport=unwrap(page.getViewport(local({scale:pv.viewport.scale*scale}))),canvas=win.document.createElement('canvas');
      canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
      const args=new win.Object();args.canvas=canvas;args.canvasContext=canvas.getContext('2d',{willReadFrequently:true});args.viewport=viewport;args.annotationMode=0;args.intent='print';
      const task=unwrap(page.render(args));
      try{await task.promise;}catch(e){busy();s.hiRes.delete(key);throw e;}
      entry.canvas=canvas;entry.viewport=viewport;return entry;
      })();
      entry.promise.catch(()=>s.hiRes.delete(key));
      return entry.promise;
    };
    app.buildGraphicMaskHiRes=async function(s,row,pv,index,maskKey){
      const page=pv?.pdfPage||pv?.page;
      if(!page?.render||!row?.quad)return null;
      const hi=await this.graphicHiResPage(s,pv,index);
      const q=project(row.quad,Array.from(hi.viewport.transform));
      const x=Math.max(0,Math.floor(q.matrix[4])),y=Math.max(0,Math.floor(q.matrix[5]));
      const w=Math.min(hi.canvas.width-x,Math.max(1,Math.round(q.width))),h=Math.min(hi.canvas.height-y,Math.max(1,Math.round(q.height)));
      if(w<5||h<5)return null;
      const cv=s.doc.createElement('canvas');cv.width=w;cv.height=h;
      const cx=cv.getContext('2d',{willReadFrequently:true});
      cx.drawImage(hi.canvas,x,y,w,h,0,0,w,h);
      const pixels=cx.getImageData(0,0,w,h);
      const m=CubeGraphicInk.mask(pixels)||CubeGraphicInk.mask(pixels,{edgeDashes:true});
      let url=null,kind='none';
      if(m?.uniform||m?.complete){
        cx.setTransform(1,0,0,1,0,0);
        const out=cx.createImageData(m.width,m.height);
        out.data.set(typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto(m.data,s.doc.defaultView):m.data);
        cx.putImageData(out,0,0);kind='glyph-mask';
      }else{
        // 抠不出独立字形（例如文字压在彩条上）时，退成这块框里最亮的那个众数颜色，
        // 纯色不透明地盖住原文——比四周取样的渐变干净得多，也不会留半透明灰影。
        const flat=this.graphicFlatPaperColor(pixels);
        if(!flat){cv.width=cv.height=0;return null;}
        cx.setTransform(1,0,0,1,0,0);cx.fillStyle=flat;cx.fillRect(0,0,cv.width,cv.height);kind='glyph-fill';
      }
      url=cv.toDataURL('image/png');cv.width=cv.height=0;
      (s.paintedMasks||=new Map()).set(maskKey,{url,kind});
      // 一次框选会同时落很多块掩膜：合并成一次重画，别每块都重排整页。
      s.maskRevision=(s.maskRevision||0)+1;
      clearTimeout(s.maskPaintTimer);
      s.maskPaintTimer=setTimeout(()=>{s.maskPaintTimer=null;if(this.graphicSessions?.get(s.reader)===s)s.paint();},300);
      return url;
    };
    // 这块框里最亮的那个众数颜色（纸面底色）。深色字形/彩条按亮度排除，所以不会被染上颜色。
    app.graphicFlatPaperColor=function(pixels){
      const data=pixels?.data;if(!data?.length)return null;
      let max=0;const greys=new Uint8Array(data.length/4);
      for(let i=0,j=0;i<data.length;i+=4,j++){const g=(data[i]*299+data[i+1]*587+data[i+2]*114)/1000;greys[j]=Math.round(g);if(g>max)max=g;}
      const floor=max-14,counts=new Map();
      for(let i=0,j=0;i<data.length;i+=4,j++){
        if(greys[j]<floor)continue;
        const key=(data[i]<<16)|(data[i+1]<<8)|data[i+2];
        const hit=counts.get(key);if(hit)hit.n++;else counts.set(key,{n:1,r:data[i],g:data[i+1],b:data[i+2]});
      }
      let best=null;for(const v of counts.values())if(!best||v.n>best.n)best=v;
      if(!best||best.n<greys.length*.12)return null;
      return 'rgb('+best.r+','+best.g+','+best.b+')';
    };
    app.graphicSampleBackground=function(canvas,p,viewport,cw,ch){
      if(!canvas?.width||!p)return null;
      const kx=canvas.width/(cw||viewport?.width||canvas.width),ky=canvas.height/(ch||viewport?.height||canvas.height);
      const x=Math.max(0,Math.min(canvas.width-1,Math.floor(p.matrix[4]*kx))),y=Math.max(0,Math.min(canvas.height-1,Math.floor(p.matrix[5]*ky)));
      const w=Math.min(canvas.width-x,Math.max(1,Math.round(p.width*kx))),h=Math.min(canvas.height-y,Math.max(1,Math.round(p.height*ky)));
      if(w<2||h<2)return null;
      let data;try{data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(x,y,w,h).data;}catch(e){return null;}
      const counts=new Map();let total=0;
      for(let i=0;i+3<data.length;i+=4){const key=((data[i]>>3)<<10)|((data[i+1]>>3)<<5)|(data[i+2]>>3);counts.set(key,(counts.get(key)||0)+1);total++;}
      let best=null;for(const entry of counts)if(!best||entry[1]>best[1])best=entry;
      if(!best)return null;
      const color=[((best[0]>>10)&31)<<3,((best[0]>>5)&31)<<3,(best[0]&31)<<3];
      return {rgb:color,color:'#'+color.map(v=>v.toString(16).padStart(2,'0')).join(''),share:best[1]/Math.max(1,total),pixels:[w,h]};
    };
    // 非纯色底色（地图、色块、跨边界）：用框四周的环带取色做成 2x2 渐变补丁再放大铺满，
    // 比一个平铺色更像"原本就是这层底"，也不会像半透明那样透出原文。
    app.graphicRingPatch=function(canvas,p,viewport,cw,ch,doc){
      if(!canvas?.width||!p||!doc)return null;
      const kx=canvas.width/(cw||viewport?.width||canvas.width),ky=canvas.height/(ch||viewport?.height||canvas.height);
      const bx=Math.floor(p.matrix[4]*kx),by=Math.floor(p.matrix[5]*ky),bw=Math.max(2,Math.round(p.width*kx)),bh=Math.max(2,Math.round(p.height*ky));
      const x=Math.max(0,Math.min(canvas.width-1,bx)),y=Math.max(0,Math.min(canvas.height-1,by));
      const w=Math.min(canvas.width-x,bw),h=Math.min(canvas.height-y,bh);
      if(w<4||h<4)return null;
      let data;try{data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(x,y,w,h).data;}catch(e){return null;}
      const at=(px,py)=>{const i=(py*w+px)*4;return [data[i],data[i+1],data[i+2]];};
      const dominant=list=>{
        const counts=new Map();for(const c of list){const key=((c[0]>>3)<<10)|((c[1]>>3)<<5)|(c[2]>>3);counts.set(key,(counts.get(key)||0)+1);}
        let best=null;for(const entry of counts)if(!best||entry[1]>best[1])best=entry;
        return [(best[0]>>10&31)<<3,(best[0]>>5&31)<<3,(best[0]&31)<<3];
      };
      const edge=2,left=[],right=[],top=[],bottom=[];
      for(let py=0;py<h;py++){for(let d=0;d<edge;d++){left.push(at(Math.min(w-1,d),py));right.push(at(Math.max(0,w-1-d),py));}}
      for(let px=0;px<w;px++){for(let d=0;d<edge;d++){top.push(at(px,Math.min(h-1,d)));bottom.push(at(px,Math.max(0,h-1-d)));}}
      const cols=[dominant(left),dominant(right),dominant(top),dominant(bottom)];
      const mix=(a,b)=>[Math.round((a[0]+b[0])/2),Math.round((a[1]+b[1])/2),Math.round((a[2]+b[2])/2)];
      const corners=[mix(cols[0],cols[2]),mix(cols[1],cols[2]),mix(cols[0],cols[3]),mix(cols[1],cols[3])];
      const cv=doc.createElement('canvas');cv.width=2;cv.height=2;
      const cx=cv.getContext('2d');
      cx.putImageData((()=>{const im=cx.createImageData(2,2);[[0,0,0],[1,0,1],[0,1,2],[1,1,3]].forEach(([px,py,i])=>{const o=(py*2+px)*4;im.data[o]=corners[i][0];im.data[o+1]=corners[i][1];im.data[o+2]=corners[i][2];im.data[o+3]=255;});return im;})(),0,0);
      const url=cv.toDataURL('image/png');const size=cv.width;cv.width=cv.height=0;
      return {url,corners,edge:cols,size};
    };
    // 原位擦除的补丁决策。**任何情况都不半透明**：半透明白压在原文上就是那层灰影。
    app.graphicPatchFill=function({nativePatch,mask,row,canvas,p,viewport,cw,ch,doc}){
      if(nativePatch)return {url:nativePatch.url,cover:'native-removal',confidence:1};
      if(mask)return {url:mask,cover:'glyph-mask',confidence:1};
      // 现场取样优先于存过的底色：地图上的标签也可能被记成"纸面底色"，
      // 那块白就正好压在色块/线条上，看着就是脏。
      const sample=this.graphicSampleBackground(canvas,p,viewport,cw,ch);
      if(sample&&sample.share>=.85)return {color:sample.color,cover:'sampled-flat',confidence:+sample.share.toFixed(2),sample};
      // 底色不纯（地图、色块、跨边界）：铺一层从四周环带插出来的渐变，胜过一块错色矩形。
      try{const ring=this.graphicRingPatch(canvas,p,viewport,cw,ch,doc);if(ring)return {url:ring.url,cover:'ring-gradient',confidence:sample?+sample.share.toFixed(2):undefined};}catch(e){ /* 取样失败就退回平铺色 */ }
      if(row.inkPatch?.version===5&&row.inkPatch?.uniform)return {color:'rgb('+Array(3).fill(row.inkPatch.background).join(',')+')',cover:'sampled-flat',confidence:1};
      if(row.background)return {color:row.background,cover:'verified-paper',confidence:1};
      if(sample)return {color:sample.color,cover:'sampled-flat',confidence:+sample.share.toFixed(2),sample};
      return {color:'#ffffff',cover:'paper-fallback',confidence:0};
    };
    app.paintGraphicLabel=function(s,row,pageEl,viewport,pv){
      const doc=pageEl.ownerDocument,transform=Array.from(viewport.transform);
      if(row.legacyLayout)return null;
      // Nothing to show when the stored target is identical to the source; an
      // invisible hotspot over the chart would only block native interactions.
      if(normalizedText(row.target)===normalizedText(row.text))return null;
      if(s.reader&&doc!==s.reader._internalReader?._secondaryView?._iframeWindow?.document)return null;
      const prose=[...this.inplace?.get(s.reader)?.records?.values()||[]].filter(r=>r.layout.pageIndex===row.pageIndex);
      if(prose.some(r=>overlap(bounds(row.quad),r.layout.rect)>.1))return null;
      // PDF.js rounds the canvas CSS dimensions. Correct that subpixel scale as
      // well, otherwise a label near a far page edge can drift at fractional zoom.
      const canvas=pageEl.querySelector('.canvasWrapper canvas'),cw=canvas?.clientWidth,ch=canvas?.clientHeight;
      if(cw&&ch){const sx=cw/viewport.width,sy=ch/viewport.height;for(const i of [0,2,4])transform[i]*=sx;for(const i of [1,3,5])transform[i]*=sy;}
      const p=project(row.quad,transform),box=doc.createElement('div');box.setAttribute('role','button');box.tabIndex=0;box.className='pl-graphic-anchor';box.dataset.labelId=row.id;
      box.style.cssText='position:absolute;left:0;top:0;transform-origin:0 0;box-sizing:border-box;appearance:none;min-width:0;min-height:0;margin:0;padding:0;border:0;z-index:45;outline:none;background:transparent;color:transparent;overflow:hidden;cursor:help;display:block;text-align:left;align-content:start;';
      box.style.width=p.width+'px';box.style.height=p.height+'px';box.style.transform='matrix('+p.matrix.join(',')+')';
      box.title=row.text+' → '+row.target+' · Alt+单击打开校订';box.setAttribute('aria-label',box.title);
      const nativePatch=this.nativeBackgroundFor?.(s,row);let mask=row.inkPatch?.version===5&&row.inkPatch?.quad===JSON.stringify(row.quad)?row.inkPatch.url:null;if(mask)box.dataset.maskResult='verified-high-resolution-mask';const peers=s.rows.filter(r=>r.pageIndex===row.pageIndex&&!r.legacyLayout);
      // 掩膜是「抠掉墨迹、留下真实底色」的补丁，比任何平铺色都干净，所以只要有画布就做；
      // 原先要求 1.5 倍像素密度，结果 100% 缩放下的标签全部落到半透明兜底，看着就是脏。
      const maskKey=row.id+'|'+JSON.stringify(row.quad);
      const cachedEntry=(s.paintedMasks||=new Map()).get(maskKey);
      const cachedMask=cachedEntry&&typeof cachedEntry==='object'?cachedEntry.url:cachedEntry;
      if(cachedMask)mask=cachedMask;
      // 斜排/旋转的行页要给掩膜：它们以前只能靠四周取样的渐变，那条轴标签上会
      // 留下没擦掉的英文。高清掩膜是按 quad 的包围盒裁剪的，镜像问题不存在。
      if(!mask&&s.replace&&!nativePatch&&typeof CubeGraphicInk!=='undefined'&&(pv?.pdfPage||pv?.page)?.render&&canvas?.width){
        // 屏幕像素不够：按 4 倍重绘这一页再抠墨迹，异步算好后重画一次。
        const pending=(s.pendingMasks||=new Set());
        if(pending.has(maskKey))box.dataset.maskResult='mask-pending';
        else{
          pending.add(maskKey);
          this.buildGraphicMaskHiRes(s,row,pv,row.pageIndex,maskKey).then(url=>{box.dataset.maskResult=url?(s.paintedMasks?.get(maskKey)?.kind||'glyph-mask'):'no-isolated-glyphs';}).catch(e=>{box.dataset.maskResult='mask-error: '+(e.message||e);}).finally(()=>pending.delete(maskKey));
        }
      }
      const reason=replacementReason(nativePatch?{...row,nativeValidated:true}:mask?{...row,inkValidated:true}:row,peers.filter(r=>r!==row));box.dataset.fallback=reason||(!s.replace?'点选对照':'');
      if(s.replace&&!reason&&!(canvas&&doc.defaultView.getComputedStyle(canvas).filter!=='none')){
        const body=doc.createElement('span');body.textContent=row.target;
        // CJK fallback glyph extents exceed a 1.2em line box in Gecko. Keep
        // ascent/descent within the box instead of shrinking correct text away.
        body.style.cssText='display:block;box-sizing:border-box;line-height:1.5;white-space:normal;overflow-wrap:normal;font-family:"Microsoft YaHei",sans-serif;padding:0;margin:0;text-align:left;';box.appendChild(body);pageEl.appendChild(box);
        // Fit in label-local coordinates: screen AABBs are wrong for rotated axes.
        const screenTransform=box.style.transform,unit=4;box.style.transform='none';box.style.width=p.width*unit+'px';box.style.height=p.height*unit+'px';
        // Shape tiny CJK in a larger local coordinate system before scaling down.
        // Gecko rounds fallback glyph ascent to whole pixels at 3–5px sizes.
        body.style.lineHeight='1.35';body.style.padding='.05em 0 0';body.style.fontWeight='400';body.style.fontStyle='normal';if(row.flowNode)body.style.textAlign='center';if(['PDF-table','PDF-text-table'].includes(row.origin)){body.style.padding='.12em .22em 0';body.style.textAlign=row.origin==='PDF-table'?'center':'left';}
        let size=(row.fontSize||Math.min(p.height/1.5,row.flowNode?8:12))*unit,fits=false;
        const floor=Math.min(size,Math.max(2.8*unit,Math.min(size*.8,p.height/1.5*unit)));
        size=Math.max(size,floor);
        for(;;size=Math.max(floor,size-.25*unit)){body.style.fontSize=size+'px';const m=this.measureInPlaceText(box,body);box.dataset.fitMetrics=JSON.stringify(m);if(m.fits){fits=true;break;}if(size<=floor)break;}
        box.style.width=p.width+'px';box.style.height=p.height+'px';box.style.transform=screenTransform;
        if(unit!==1){body.style.width=p.width*unit+'px';body.style.transformOrigin='0 0';body.style.transform='scale('+1/unit+')';}
        if(fits){const fill=this.graphicPatchFill({nativePatch,mask,row,canvas,p,viewport,cw,ch,doc});box.style.background=fill.url?'transparent':fill.color;if(fill.url){box.style.backgroundImage='url("'+fill.url+'")';box.style.backgroundSize='100% 100%';box.dataset.mask=nativePatch?'native-text-removed':'glyph-only';}else box.style.boxShadow='0 0 0 1.5px '+fill.color;box.dataset.cover=fill.cover;if(fill.confidence!==undefined&&fill.confidence!==1)box.dataset.patchConfidence=String(fill.confidence);box.style.color='#111';box.dataset.mode='replace';}
        else{body.remove();box.dataset.fallback='译文放不下，保留原图';}
      }
      if(box.dataset.mode!=='replace'){box.dataset.mode='hotspot';if(!box.dataset.fallback)box.dataset.fallback='页面颜色滤镜待适配';}
      (s.renderStatus||=new Map()).set(row.id,{mode:box.dataset.mode,reason:box.dataset.fallback||'',mask:box.dataset.maskResult||''});
      box.title=row.text+' → '+row.target+'\n'+(box.dataset.mode==='replace'?'已原位显示':'已有译文 · '+box.dataset.fallback+(box.dataset.maskResult?' · '+box.dataset.maskResult:''))+' · Alt+单击打开校订';box.setAttribute('aria-label',box.title);
      box.addEventListener('keydown',e=>{if(e.altKey&&(e.key==='Enter'||e.key===' ')){e.preventDefault();s.panel.hidden=false;s.update();}});
      box.addEventListener('click',e=>{if(doc.defaultView.getSelection()?.toString())return;e.preventDefault();e.stopPropagation();if(!e.altKey)return;s.panel.hidden=false;if(row.pageIndex!==this.graphicPageIndex(s.reader))s.allPages=true;s.update();s.panel.querySelector('[data-row-id="'+row.id+'"]')?.scrollIntoView({block:'nearest'});});
      let popup=null;const show=()=>{box.style.outline='none';if(box.dataset.mode==='replace'||popup)return;popup=doc.createElement('div');popup.className='pl-graphic-popover';popup.setAttribute('role','tooltip');popup.textContent='已有译文 · '+box.dataset.fallback+'\n'+row.target;popup.style.cssText='position:fixed;z-index:2147483000;max-width:360px;max-height:50vh;overflow:auto;white-space:pre-wrap;padding:8px 10px;background:Canvas;color:CanvasText;border:1px solid #7e99bb;border-radius:5px;font:14px/1.45 system-ui;user-select:text;pointer-events:none;';const r=box.getBoundingClientRect();popup.style.left=Math.max(6,Math.min(r.left,doc.defaultView.innerWidth-380))+'px';popup.style.top=Math.max(6,Math.min(r.bottom+4,doc.defaultView.innerHeight-180))+'px';doc.body.appendChild(popup);};const hide=()=>{box.style.outline='none';popup?.remove();popup=null;};box.addEventListener('pointerenter',show);box.addEventListener('pointerleave',hide);box.addEventListener('focus',show);box.addEventListener('blur',hide);box.plDispose=hide;
      if(!box.parentNode)pageEl.appendChild(box);return box;
    };
    app.graphicPageIndex=function(reader){
      const ir=reader._internalReader,preferred=this.inplace?.get(reader)?.priorityWin,views=[ir?._secondaryView?._iframeWindow,ir?._primaryView?._iframeWindow];
      return ((views.includes(preferred)&&preferred)||views.find(w=>w?.PDFViewerApplication?.pdfDocument))?.PDFViewerApplication?.pdfViewer?.currentPageNumber-1;
    };
    app.graphicPageRows=function(s){return s.rows.filter(r=>s.allPages||r.pageIndex===this.graphicPageIndex(s.reader));};
    app.detectGraphicRegions=function(data,operators){
      if(!L)throw Error('图表版面模块未就绪');
      const drawing=L.regionModel(data,operators),regions=drawing.tables.map(table=>table.role==='text-table'||table.cells?{...table}:{role:'table',rect:table.rect,evidence:table.evidence});
      // Captions excluded by an older three-rule table classification remain
      // native text. Recover only caption-led runs; prose-owned frames are skipped
      // during recognition, so completed captions are never requested twice.
      const physical=L.physicalCells(data.chars);
      for(let i=0;i<physical.length;i++){
        const first=physical[i];if(!/^\s*(?:Figure|Fig\.|Table)\s+(?:(?:[A-Z]\.)?\d+|[IVXLCDM]+)(?:[.:]|\s)/i.test(first.cells.map(c=>c.text).join(' ')))continue;
        const lines=[first];let j=i+1;
        while(j<physical.length){const prev=lines.at(-1),next=physical[j];if(Math.abs(next.rect[0]-first.rect[0])>2||prev.rect[1]-next.rect[3]>first.fontSize*.7||prev.rect[1]<next.rect[3]||drawing.rules.some(r=>r[1]>=next.rect[3]&&r[1]<=prev.rect[1]))break;lines.push(next);j++;}
        const ink=L.union(lines.map(r=>r.rect)),font=first.fontSize;
        const nearRules=drawing.rules.filter(r=>r[0]<ink[2]&&r[2]>ink[0]);
        const low=Math.max(data.viewBox[1],ink[1]-font*.4,...nearRules.filter(r=>r[3]<ink[1]).map(r=>r[3]+2));
        const high=Math.min(data.viewBox[3],ink[3]+font*.2,...nearRules.filter(r=>r[1]>ink[3]).map(r=>r[1]-2));
        const rect=[ink[0],low,ink[2],high];
        if(low>=ink[1]||high<=ink[3])continue;
        regions.push({role:'native-caption',rect,evidence:'native-caption-prefix',cells:[{text:lines.flatMap(r=>r.cells.map(c=>c.text)).join(' '),inkRect:ink,rect,fontSize:font}]});i=j-1;
      }
      for(const image of drawing.regions.filter(r=>r.role==='image')){
        if(overlap(image.rect,Array.from(data.viewBox))<area(image.rect)*.98)continue;
        if(regions.some(r=>overlap(r.rect,image.rect)>Math.min(area(r.rect),area(image.rect))*.25))continue;
        if(regions.some(r=>overlap(r.rect,image.rect)>area(image.rect)*.8))continue;
        // Keep a little surrounding paper so edge glyphs and OCR line spacing
        // are not clipped by an image object's exact raster bounds.
        const v=data.viewBox,pad=3.5,rect=[Math.max(v[0],image.rect[0]-pad),Math.max(v[1],image.rect[1]-pad),Math.min(v[2],image.rect[2]+pad),Math.min(v[3],image.rect[3]+pad)];
        regions.push({...image,rect});
      }
      return {regions:regions.sort((a,b)=>b.rect[3]-a.rect[3]||a.rect[0]-b.rect[0]),rules:drawing.rules};
    };
    app.graphicRegionInfo=function(plan,region,index,data){
      const table=region.role==='table'||region.role==='text-table',r=region.rect;
      if(region.role==='native-caption'){const title=region.cells?.[0]?.text||'',m=title.match(/^((?:Fig(?:ure)?\.?|Table)\s*(?:\d+(?:\.\d+)*|[IVXLCDM]+))/i);return {index:index+1,total:plan.regions.length,label:m?m[1].replace(/^Fig(?:ure)?\.?\s*/i,'图').replace(/^Table\s*/i,'表')+' 图注':'图注 '+(index+1),title,rect:[...r]};}
      const near=(data?.chars?L.readLines(data.chars):[]).map(line=>{const m=line.text.match(/^((?:Fig(?:ure)?\.?|Table)\s*(?:\d+(?:\.\d+)*|[IVXLCDM]+))[.:\s]+(.*)$/i);if(!m||table!==/^Table/i.test(m[1]))return null;const q=line.rect,dx=Math.min(q[2],r[2])-Math.max(q[0],r[0]),gap=q[1]>=r[3]?q[1]-r[3]:q[3]<=r[1]?r[1]-q[3]:Infinity;return dx>Math.min(q[2]-q[0],r[2]-r[0])*.25&&gap<45?{gap,label:m[1].replace(/^Fig(?:ure)?\.?\s*/i,'图 ').replace(/^Table\s*/i,'表 '),title:line.text}:null;}).filter(Boolean).sort((a,b)=>a.gap-b.gap)[0];
      return {index:index+1,total:plan.regions.length,label:near?.label||(region.role==='native-caption'?'图注':table?'表格':'图表')+' '+(index+1),title:near?.title||'',rect:[...r]};
    };
    app.autoTranslateGraphics=async function(reader,{translate=true,pageIndex,article,force=false,cfg,background=false}={}){
      if(translate&&!reader._internalReader?._secondaryView&&this.ensureSecondaryPdfWin)await this.ensureSecondaryPdfWin(reader);
      const s=await this.graphicSession(reader);await s.ready;if(s.busy)return s;this.bindNativeOverlayInput?.(reader)?.bind();
      s.selection?.();s.busy=true;s.control={stopped:false,requests:new Set()};const control=s.control;s.article=article||null;const stop=()=>control.stopped||this.stopped||article&&(article.paused||!article.alive());let offscreen=null;s.phase='recognize';s.activity=Number.isInteger(pageIndex)?{pageIndex,region:null}:null;s.activeLabels=new Map();s.progress=null;s.message='正在查找'+(Number.isInteger(pageIndex)?'第 '+(pageIndex+1)+' 页':'当前页')+'图表…';s.update();
      try{
        if(stop())return s;
        const ir=reader._internalReader,preferred=this.inplace?.get(reader)?.priorityWin;
        const views=[ir?._secondaryView?._iframeWindow,ir?._primaryView?._iframeWindow];
        const win=(views.includes(preferred)&&preferred)||views.find(w=>w?.PDFViewerApplication?.pdfDocument);
        if(!win)throw Error('PDF 尚未载入');
        const viewer=win.PDFViewerApplication.pdfViewer,index=Number.isInteger(pageIndex)?pageIndex:viewer.currentPageNumber-1;
        const pdfDoc=win.PDFViewerApplication.pdfDocument;if(index<0||index>=pdfDoc.numPages)throw Error('页码超出范围');
        const pdf=win.PDFViewerApplication.pdfDocument,query=typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto({pageIndex:index},win):{pageIndex:index};
        const ownerKey=[...this.inplace?.get(reader)?.records?.values()||[]].filter(r=>r.layout.pageIndex===index).map(r=>r.id).join('|');
        s.recognitionCache||=new Map();let cached=s.recognitionCache.get(index);if(force||cached?.ownerKey!==ownerKey)cached=null;
        const data=cached?null:JSON.parse(JSON.stringify(unwrap(await pdf.getPageData(query)))),operators=cached?null:await this.readOperatorGeometry(await pdf.getPage(index+1));
        const plan=cached?.plan||this.detectGraphicRegions(data,operators);
        if(!cached){const prose=[...this.inplace?.get(reader)?.records?.values()||[]].filter(r=>r.layout.pageIndex===index);plan.regions=plan.regions.filter(region=>!region.cells||region.cells.some(cell=>!prose.some(p=>overlap(cell.rect,p.layout.rect)>.1)));}for(const [i,r]of plan.regions.entries())r.progressInfo||=this.graphicRegionInfo(plan,r,i,data);s.activity={pageIndex:index,region:null};s.lastAuto={pageIndex:index,regions:plan.regions,completed:0};if(!article){s.allPages=false;s.body&&(s.body.scrollTop=0);}s.update();
        if(!plan.regions.length){s.recognitionCache.set(index,{ownerKey,plan});s.message='第 '+(index+1)+' 页未检测到待处理图表；继续检查其他页。';return s;}
        if(stop())return s;
        let pv=viewer.getPageView(index),canvas=pv?.canvas||pv?.div?.querySelector('.canvasWrapper canvas');
        // Background full-document work renders only original PDF pixels into an
        // isolated canvas. Never navigate the reader or capture translated DOM.
        if(!cached&&(article||background||!canvas?.width||!pv?.viewport||pv.renderingState!==3)){
          if(!article&&!background)throw Error('当前页正在绘制，请稍后再点自动翻译');
          const page=unwrap(await pdfDoc.getPage(index+1)),local=value=>typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto(value,win,{wrapReflectors:true}):value,base=unwrap(page.getViewport(local({scale:1}))),scale=Math.min(4,Math.sqrt(6000000/(base.width*base.height)));
          const viewport=unwrap(page.getViewport(local({scale}))),cv=win.document.createElement('canvas');cv.width=Math.ceil(viewport.width);cv.height=Math.ceil(viewport.height);offscreen=cv;
          const renderArgs=new win.Object();renderArgs.canvas=cv;renderArgs.canvasContext=cv.getContext('2d');renderArgs.viewport=viewport;renderArgs.annotationMode=0;renderArgs.intent='print';
          // Display intent uses requestAnimationFrame, suspended in hidden tabs.
          // Print intent is only a render scheduling mode; no printer/PDF writes.
          s.phase='render';s.update();const task=unwrap(page.render(renderArgs));control.renderTask=task;const timeout=setTimeout(()=>task.cancel(),45000);
          try{await task.promise;}finally{clearTimeout(timeout);control.renderTask=null;}
          pv={viewport,renderingState:3};canvas=cv;
        }
        if(stop())return s;
        const stamp=cached?'':Array.from(pv.viewport.transform).join(',');
        for(const [i,region] of (cached?[]:plan.regions).entries()){
          if(stop())break;
          if(stamp!==Array.from(pv.viewport.transform).join(',')||pv.renderingState!==3)throw Error('页面缩放或旋转发生变化，已保留完成结果，请再点自动翻译');
          s.phase='recognize';s.activity={pageIndex:index,region:region.progressInfo};s.message='第 '+(index+1)+' 页 · '+region.progressInfo.label+' · 本地识别';s.update();
          await this.recognizeGraphicRegion(s,win,pv,canvas,index,L.mapRect(Array.from(pv.viewport.transform),region.rect),{control,data,rules:plan.rules,automatic:true,tableOnly:region.role==='table',textCells:region.cells||null,nativeCaption:region.role==='native-caption'});s.lastAuto.completed++;
        }
        if(stop()){s.message='图表任务已停止，完成结果保留。';return s;}
        if(cached||s.lastAuto.completed===plan.regions.length)s.recognitionCache.set(index,{ownerKey,plan});
        for(const row of s.rows.filter(r=>r.pageIndex===index&&!r.legacyLayout)){const hits=plan.regions.filter(p=>overlap(bounds(row.quad),p.rect)>area(bounds(row.quad))*.8);if(hits.length===1)row.graphicRegion=hits[0].progressInfo;}
        const rows=s.rows.filter(r=>r.pageIndex===index&&r.selected&&plan.regions.some(p=>overlap(bounds(r.quad),p.rect)>area(bounds(r.quad))*.8));
        if(translate){s.replace=true;s.hidden=false;await this.translateGraphics(s,{control,rows,cfg,article,consentGranted:!!article?.graphicsConsent});await this.saveGraphics(s);s.paint();}
        else{s.message='已自动识别 '+plan.regions.length+' 个图表、'+rows.length+' 个可翻译文字块；尚未调用翻译服务。';}
        if(translate&&!stop()&&this.nativeBackgroundRuntime?.().enabled===true){
          const nativeRows=rows.filter(r=>/^PDF(?:-|$)/.test(r.origin||'')&&r.target&&!r.background&&!r.legacyLayout&&!r.review&&!r.preserveSource&&!r.warnings?.length&&r.directionVerified!==false&&!this.nativeBackgroundFor?.(s,r));
          if(nativeRows.length&&s.nativeAttemptKeys?.get(index)!==JSON.stringify(nativeRows.map(r=>[r.id,r.text,r.quad]))){
            s.phase='background';s.update();const key=JSON.stringify(nativeRows.map(r=>[r.id,r.text,r.quad]));(s.nativeAttemptKeys||=new Map()).set(index,key);
            try{s.lastNative=await this.prepareNativeBackgrounds(s,index,{rows:nativeRows});await this.saveGraphics(s);}catch(e){s.lastNative={error:e.message,page:index+1};}
          }
        }
        return s;
      }finally{if(offscreen){offscreen.width=0;offscreen.height=0;}if(s.activity)s.lastLocation=s.activity;s.activeLabels?.clear();s.activity=null;s.busy=false;s.phase='idle';s.article=null;s.update();this.refreshReaderButton?.(reader);}
    };
    app.articleGraphicsSummary=function(reader){
      const a=this.inplace?.get(reader),g=this.graphicSessions.get(reader),j=a?.graphicJob;
      if(a?.cfg?.translateGraphics===false)return '图表：已关闭';
      const rows=g?.rows.filter(r=>!r.legacyLayout&&r.selected&&!r.preserveSource)||[],done=rows.filter(r=>r.target).length;
      const phase=a?.paused?'已暂停':j?.busy?(g?.phase==='translate'?'翻译中':g?.phase==='background'?'排版中':'识别中'):j?.pending.size?'等待处理':j?'扫描结束':'未开始';
      const page=j?.busy&&Number.isInteger(j.current)?' · 第 '+(j.current+1)+' 页':'';
      return '图表：'+phase+page+(j?' · 已检查 '+(j.completed.size+j.failed.size)+'/'+a.pdf.numPages+' 页':'')+' · 已译 '+done+'/'+rows.length+' 条'+(j?.failed.size?' · '+j.failed.size+' 页待重试':'');
    };
    app.bindArticleGraphics=function(article){
      if(article.graphicJob)return article.graphicJob;
      const job={pending:new Set(Array.from({length:article.pdf.numPages},(_,i)=>i)),completed:new Set(),failed:new Map(),busy:false,current:null,timer:null,disposed:false};article.graphicJob=job;
      const alive=()=>!job.disposed&&article.alive()&&article.cfg.translateGraphics!==false;
      const run=async()=>{
        job.timer=null;if(!alive()||article.paused||job.busy||!job.pending.size)return;
        if(article.cfg.confirmBeforeSend&&!article.graphicsConsent)return;
        const current=this.graphicPageIndex(article.reader),index=job.pending.has(job.priorityPage)?job.priorityPage:[...job.pending].sort((a,b)=>Math.abs(a-current)-Math.abs(b-current)||a-b)[0];if(index===job.priorityPage)job.priorityPage=null;
        const g=this.graphicSessions.get(article.reader);if(g?.busy){job.schedule();return;}
        job.pending.delete(index);job.busy=true;job.current=index;article.update?.();this.refreshReaderButton?.(article.reader);
        try{await this.autoTranslateGraphics(article.reader,{pageIndex:index,article,cfg:article.cfg,force:!!job.forcePages?.has(index)});
          if(job.disposed)return;if(article.paused||article.cfg.translateGraphics===false){job.pending.add(index);return;}
          const gs=this.graphicSessions.get(article.reader),errors=gs?.rows.filter(r=>r.pageIndex===index&&r.selected&&!r.target&&r.error)||[];
          if(errors.length)job.failed.set(index,errors[0].error);else {job.completed.add(index);job.forcePages?.delete(index);}
        }catch(e){if(!job.disposed){if(article.paused||article.cfg.translateGraphics===false)job.pending.add(index);else job.failed.set(index,e.message);job.lastError={page:index+1,message:e.message,stack:String(e.stack||'').slice(0,1800)};}}
        finally{job.busy=false;job.current=null;this.scheduleInPlaceCheckpoint?.(article);article.update?.();this.refreshReaderButton?.(article.reader);job.schedule();}
      };
      job.schedule=()=>{if(!alive()||article.paused||job.busy||job.timer||!job.pending.size)return;job.timer=setTimeout(run,120);};
      job.pause=()=>{clearTimeout(job.timer);job.timer=null;const gs=this.graphicSessions.get(article.reader);if(gs?.article===article){if(gs.nativeControl){gs.nativeControl.stopped=true;gs.nativeControl.process?.kill();for(const t of gs.nativeControl.renderTasks||[])t.cancel();for(const t of gs.nativeControl.loadingTasks||[])t.destroy().catch(()=>{});}gs.control.stopped=true;gs.control.process?.kill();gs.control.renderTask?.cancel();for(const req of gs.control.requests)req.abort();}};
      job.retry=()=>{for(const i of job.failed.keys())job.pending.add(i);job.failed.clear();job.schedule();};
      article.cleanup.push(()=>{job.disposed=true;job.pause();job.pending.clear();});return job;
    };
    // A manual box selection must never be silently dropped because the background
    // page scan happens to be running; wait briefly for it instead.
    app.waitGraphicIdle=async function(s,timeout=25000){const end=Date.now()+timeout;while(s.busy&&Date.now()<end&&!this.stopped)await new Promise(resolve=>setTimeout(resolve,120));return !s.busy;};
    // 框选翻译的轻量提示：平时不占地方，只在框选后出现一个小圆点；
    // 识别/翻译时转圈，结束后停下并显示条数，点一下才展开这次识别到的文字。
    app.regionBadge=function(s){
      const views=this.readerButtons?.get(s.reader),view=views?[...views][0]:null;
      const doc=view?.doc||s.doc;
      if(s.badge&&s.badge.doc===doc&&s.badge.root.isConnected)return s.badge;
      if(s.badge){try{s.badge.root.remove();s.badge.popover.remove();}catch(e){}clearTimeout(s.badge.timer);}
      if(!doc.getElementById('pl-region-badge-style')){
        const style=doc.createElement('style');style.id='pl-region-badge-style';
        style.textContent='.pl-region-badge{position:fixed;z-index:2147483645;width:26px;height:26px;border-radius:50%;border:1px solid #2f6bff;background:Canvas;color:#2f6bff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px #14285a33;font:600 12px/1 system-ui;padding:0}'
          +'.pl-region-badge[data-state="busy"]{cursor:progress}'
          +'.pl-region-badge .pl-region-ring{position:absolute;width:22px;height:22px;border-radius:50%;border:2px solid #2f6bff33;border-top-color:#2f6bff;animation:pl-region-spin .9s linear infinite;display:none}'
          +'.pl-region-badge[data-state="busy"] .pl-region-ring{display:block}'
          +'.pl-region-badge[data-state="busy"] .pl-region-count{opacity:0}'
          +'.pl-region-badge[data-state="error"]{border-color:#c0392b;color:#c0392b}'
          +'.pl-region-list{position:fixed;z-index:2147483646;width:390px;max-width:92vw;max-height:46vh;overflow:auto;background:Canvas;color:CanvasText;border:1px solid #b8c3d6;border-radius:8px;box-shadow:0 8px 24px #14285a2e;padding:8px 10px;font:12px/1.5 system-ui;display:none}'
          +'.pl-region-list header{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:600}'
          +'.pl-region-list header button{margin-left:auto;border:0;background:transparent;cursor:pointer;font:13px system-ui;color:inherit}'
          +'.pl-region-row{display:flex;gap:8px;padding:3px 0;border-top:1px solid rgba(0,0,0,.06)}'
          +'.pl-region-row span{flex:1;min-width:0;overflow-wrap:anywhere}'
          +'.pl-region-row .pl-region-src{color:#5b6b82}'
          +'.pl-region-list footer{display:flex;gap:8px;margin-top:8px}'
          +'.pl-region-list footer button{border:1px solid #b8c3d6;background:transparent;color:inherit;border-radius:5px;padding:3px 8px;cursor:pointer;font:12px system-ui}'
          +'@keyframes pl-region-spin{to{transform:rotate(360deg)}}';
        doc.body.appendChild(style);
      }
      const root=doc.createElement('button');root.type='button';root.className='pl-region-badge';root.dataset.state='armed';
      const ring=doc.createElement('span');ring.className='pl-region-ring';
      const count=doc.createElement('span');count.className='pl-region-count';count.textContent='择';
      root.append(ring,count);
      const popover=doc.createElement('div');popover.className='pl-region-list';popover.setAttribute('role','dialog');
      doc.body.append(root,popover);
      const place=()=>{
        const rect=view?.wrap?.isConnected?view.wrap.getBoundingClientRect():null;
        const left=rect?Math.round(rect.left+4):Math.round(doc.defaultView.innerWidth-64);
        const top=rect?Math.round(rect.bottom+4):48;
        root.style.left=left+'px';root.style.top=top+'px';
        popover.style.left=Math.max(8,Math.min(left,doc.defaultView.innerWidth-400))+'px';popover.style.top=(top+30)+'px';
      };
      root.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();this.toggleRegionList(s);});
      root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.toggleRegionList(s);}});
      s.badge={doc,root,count,popover,place,timer:null};
      doc.addEventListener('pointerdown',e=>{if(s.badge&&!root.contains(e.target)&&!popover.contains(e.target))this.hideRegionBadge(s);},true);
      doc.defaultView.addEventListener('resize',place);
      place();return s.badge;
    };
    app.showRegionBadge=function(s,state,{count,title}={}){
      (s.badgeTrace||=[]).push({state,at:Date.now()});
      let badge;try{badge=this.regionBadge(s);s.badgeError=null;}catch(e){s.badgeError=String(e.message||e);return null;}
      badge.root.dataset.state=state;
      badge.root.title=title||(state==='busy'?'框选翻译：正在识别…':state==='error'?'框选翻译失败':'框选翻译：点这里看识别结果');
      if(Number.isFinite(count))badge.count.textContent=String(count);
      else if(state==='armed')badge.count.textContent='择';
      else if(state==='error')badge.count.textContent='!';
      clearTimeout(badge.timer);
      if(state==='done'||state==='error')badge.timer=setTimeout(()=>this.hideRegionBadge(s),120000);
      badge.place();
      return badge;
    };
    app.hideRegionBadge=function(s){
      const badge=s.badge;if(!badge)return;
      clearTimeout(badge.timer);try{badge.root.remove();badge.popover.remove();}catch(e){}
      s.badge=null;
    };
    app.toggleRegionList=function(s){
      const badge=this.regionBadge(s),open=badge.popover.style.display==='block';
      if(open){badge.popover.style.display='none';return;}
      const list=s.lastRegionList||[];
      badge.popover.replaceChildren();
      const header=badge.doc.createElement('header');
      const title=badge.doc.createElement('span');
      title.textContent='本次框选：识别 '+list.length+' 条 · 已译 '+list.filter(r=>r.target).length+' 条';
      const close=badge.doc.createElement('button');close.type='button';close.textContent='✕';close.title='关闭';
      close.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();this.hideRegionBadge(s);});
      header.append(title,close);badge.popover.appendChild(header);
      for(const row of list){
        const line=badge.doc.createElement('div');line.className='pl-region-row';
        const src=badge.doc.createElement('span');src.className='pl-region-src';src.textContent=row.text||'';
        const dst=badge.doc.createElement('span');dst.textContent=row.target||'（未翻译）';
        line.append(src,dst);badge.popover.appendChild(line);
      }
      const footer=badge.doc.createElement('footer');
      const full=badge.doc.createElement('button');full.type='button';full.textContent='打开图表面板';
      full.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();this.hideRegionBadge(s);if(s.panel)s.panel.hidden=false;s.update();});
      const again=badge.doc.createElement('button');again.type='button';again.textContent='再框一次';
      again.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();this.hideRegionBadge(s);Promise.resolve().then(()=>this.selectGraphicRegion(s.reader)).catch(()=>{});});
      footer.append(full,again);badge.popover.appendChild(footer);
      badge.place();badge.popover.style.display='block';
    };
    app.finishRegionBadge=function(s,pageIndex,error){
      if(error){this.showRegionBadge(s,'error',{title:'框选翻译失败：'+String(error).slice(0,80)});return;}
      const list=(s.lastRegionList||[]).filter(r=>r.pageIndex===pageIndex);
      const translated=list.filter(r=>r.target).length;
      this.showRegionBadge(s,'done',{count:translated||list.length,title:'框选翻译：识别 '+list.length+' 条 · 已译 '+translated+' 条（点击查看）'});
    };
    app.selectGraphicRegion=async function(reader){
      const s=await this.openGraphics(reader,{panel:false});
      if(s.busy){s.message='\u6b63\u5728\u5b8c\u6210\u5f53\u524d\u9875\u8bc6\u522b\uff0c\u968f\u540e\u5f00\u59cb\u6846\u9009\u2026';s.update();await this.waitGraphicIdle(s)||(()=>{throw Error('\u540e\u53f0\u8bc6\u522b\u4ecd\u672a\u7ed3\u675f\uff0c\u8bf7\u7a0d\u5019\u518d\u6846\u9009');})();}
      s.selection?.();
      const clean=[],covers=[];s.message='在左侧或右侧当前 PDF 页上拖框选图；Esc 取消。框选只做本地识别。';s.update();
      this.showRegionBadge(s,'armed');
      const finish=({keepBadge=false}={})=>{for(const f of clean.splice(0))f();for(const n of covers)n.remove();s.selection=null;if(!keepBadge)this.hideRegionBadge(s);s.update();};s.selection=()=>finish();
      for(const view of [reader._internalReader?._primaryView,reader._internalReader?._secondaryView]){
        const win=view?._iframeWindow;if(!win?.PDFViewerApplication)continue;
        // 插件重新加载后可能留下旧的覆盖层，先清掉，避免框到失效的那一层。
        for(const old of win.document.querySelectorAll('.pl-graphic-select'))old.remove();
        const esc=e=>{if(e.key==='Escape'){e.preventDefault();finish();}};win.document.addEventListener('keydown',esc,true);clean.push(()=>win.document.removeEventListener('keydown',esc,true));
        for(const pageEl of win.document.querySelectorAll('.page[data-page-number]')){
          const r=pageEl.getBoundingClientRect();if(r.bottom<0||r.top>win.innerHeight)continue;
          const index=Number(pageEl.dataset.pageNumber)-1,pv=win.PDFViewerApplication.pdfViewer.getPageView(index),canvas=pv?.canvas||pageEl.querySelector('.canvasWrapper canvas');
          if(!canvas?.width||!pv?.viewport||pv.renderingState!==3)continue;
          const cover=win.document.createElement('div');cover.className='pl-graphic-select';cover.style.cssText='position:absolute;inset:0;z-index:200;cursor:crosshair;background:#1684bb09;touch-action:none;user-select:none;pointer-events:auto;-moz-window-dragging:no-drag;';pageEl.appendChild(cover);covers.push(cover);
          const box=win.document.createElement('div');box.style.cssText='position:absolute;border:1px solid #1684bb;background:#1684bb15;pointer-events:none;';cover.appendChild(box);
          let start=null,version=null;
          const loc=e=>{const cr=canvas.getBoundingClientRect();return [Math.max(0,Math.min(pv.viewport.width,(e.clientX-cr.left)*pv.viewport.width/cr.width)),Math.max(0,Math.min(pv.viewport.height,(e.clientY-cr.top)*pv.viewport.height/cr.height))];};
          cover.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();start=loc(e);version=Array.from(pv.viewport.transform).join(',');try{cover.setPointerCapture(e.pointerId);}catch(err){ /* 合成事件没有真实指针，忽略 */ }});
          cover.addEventListener('pointermove',e=>{if(!start)return;e.preventDefault();e.stopPropagation();const p=loc(e),cr=canvas.getBoundingClientRect(),pr=cover.getBoundingClientRect();box.style.left=(cr.left-pr.left+Math.min(start[0],p[0])*cr.width/pv.viewport.width)+'px';box.style.top=(cr.top-pr.top+Math.min(start[1],p[1])*cr.height/pv.viewport.height)+'px';box.style.width=Math.abs(start[0]-p[0])*cr.width/pv.viewport.width+'px';box.style.height=Math.abs(start[1]-p[1])*cr.height/pv.viewport.height+'px';});
          cover.addEventListener('pointercancel',finish);
          cover.addEventListener('pointerup',e=>{if(!start)return;e.preventDefault();e.stopPropagation();const end=loc(e),a=start;start=null;
            const changed=version!==Array.from(pv.viewport.transform).join(',');finish();
            if(changed){s.message='框选期间页面缩放或旋转，请重新框选';s.update();return;}
            if(Math.abs(a[0]-end[0])<10||Math.abs(a[1]-end[1])<10)return;
            s.lastRegionList=null;this.showRegionBadge(s,'busy');
            this.recognizeGraphicRegion(s,win,pv,canvas,index,[Math.min(a[0],end[0]),Math.min(a[1],end[1]),Math.max(a[0],end[0]),Math.max(a[1],end[1])],{manual:true,article:this.inplace?.get(reader)})
              .then(()=>this.finishRegionBadge(s,index))
              .catch(e=>{s.message=e.message;s.paint();s.update();this.finishRegionBadge(s,index,e.message||String(e));});
          });
        }
      }
      if(!covers.length){finish();throw Error('当前页尚未绘制完成，请稍后再框选');}
    };
    app.recognizeGraphicRegion=async function(s,win,pv,canvas,pageIndex,rect,options={}){
      // 上一次的 OCR 失败不该挂在这一次的结果上（否则面板一直显示旧报错）。
      if(!options.keepOcrError)s.lastOcrError='';
      if(s.busy&&!options.control){if(options.manual)throw Error('\u5f53\u524d\u9875\u6b63\u5728\u540e\u53f0\u8bc6\u522b\uff0c\u8bf7\u7a0d\u5019\u518d\u6846\u9009');return;}s.busy=true;s.control=options.control||{stopped:false,requests:new Set()};s.message='本地识别图内文字…';s.update();
      const control=s.control;
      try{
        // Crop ONLY the original PDF canvas. Overlays, UI, translations and other
        // applications are never captured. Store exact crop origin + backing scale.
        const sx=canvas.width/pv.viewport.width,sy=canvas.height/pv.viewport.height;
        const x=Math.floor(rect[0]*sx),y=Math.floor(rect[1]*sy),right=Math.ceil(rect[2]*sx),bottom=Math.ceil(rect[3]*sy);
        if((right-x)*(bottom-y)>16000000||right-x>6000||bottom-y>6000)throw Error('框选区域过大，请缩小范围或降低阅读缩放');
        const capture={transform:Array.from(pv.viewport.transform),x:x/sx,y:y/sy,sx,sy};
        const crop=win.document.createElement('canvas');crop.width=right-x;crop.height=bottom-y;const ctx=crop.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,x,y,crop.width,crop.height,0,0,crop.width,crop.height);
        const pdfRect=bounds(pixelsToPDF([[0,0],[crop.width,0],[crop.width,crop.height],[0,crop.height]],capture));
        const pdf=win.PDFViewerApplication.pdfDocument,query=typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto({pageIndex},win):{pageIndex};
        const data=options.data||JSON.parse(JSON.stringify(unwrap(await pdf.getPageData(query))));const chars=Array.from(data.chars||[],c=>({u:c.u,c:c.c,rect:Array.from(c.rect||[]),rotation:c.rotation,fontSize:c.fontSize,baseline:c.baseline,spaceAfter:c.spaceAfter,ignorable:c.ignorable}));
        let rules=options.rules||[];if(!options.rules&&L&&this.readOperatorGeometry){const operators=await this.readOperatorGeometry(await pdf.getPage(pageIndex+1));rules=L.graphics(operators,Array.from(data.viewBox)).rules;}
        const tableData=this.graphicTableLabels({chars},pdfRect,rules),inTable=q=>tableData.tables.some(t=>overlap(bounds(q),t.rect)>area(bounds(q))*.25);
        let native=options.textCells?options.textCells.map(c=>({text:c.text,quad:quad(c.rect),sourceQuad:quad(c.inkRect),origin:options.nativeCaption?'PDF-caption':'PDF-text-table',score:1,fontSize:c.fontSize,review:false,directionVerified:true,preserveSource:!!c.preserveSource,preserveLiterals:c.preserveLiterals||[],selected:!c.preserveSource&&translatable(c.text)})):
          options.tableOnly?tableData.labels:[...nativeLabels(chars,pdfRect).filter(r=>!inTable(r.quad)),...tableData.labels];
        // Existing prose owns its own frame (translated or pending). Never stack
        // independent graphic translations over it or discard its stored target.
        const prose=[...this.inplace?.get(s.reader)?.records?.values()||[]].filter(r=>r.layout.pageIndex===pageIndex);
        native=native.filter(r=>!prose.some(p=>overlap(bounds(r.quad),p.layout.rect)>.1));
        let ocr=null,warning='';
        // A manual box is often drawn at a low reading zoom; re-render the page
        // region at a higher scale before recognition, otherwise the builtin
        // engine reads 1x pixels and produces unusable text.
        let ocrCrop=crop,ocrFactor=1;
        if(options.manual&&!options.tableOnly&&!options.textCells){
          try{
            const want=Math.min(4,Math.max(1,1000/Math.max(1,Math.min(crop.width,crop.height))));
            if(want>1.05&&pv.page&&typeof pv.page.render==='function'){
              const hiViewport=pv.viewport.clone({scale:pv.viewport.scale*want});
              const off=win.document.createElement('canvas');off.width=Math.ceil(hiViewport.width);off.height=Math.ceil(hiViewport.height);
              const task=pv.page.render({canvasContext:off.getContext('2d',{willReadFrequently:true}),viewport:hiViewport,intent:'print'});
              await task.promise;
              const hx=Math.max(0,Math.floor(x*want)),hy=Math.max(0,Math.floor(y*want)),hw=Math.min(off.width-hx,Math.ceil(crop.width*want)),hh=Math.min(off.height-hy,Math.ceil(crop.height*want));
              if(hw>8&&hh>8){const hi=win.document.createElement('canvas');hi.width=hw;hi.height=hh;hi.getContext('2d',{willReadFrequently:true}).drawImage(off,hx,hy,hw,hh,0,0,hw,hh);ocrCrop=hi;ocrFactor=want;}
              off.width=off.height=0;
            }
          }catch(e){s.lastOcrError='高分辨率重绘失败，改用当前缩放：'+(e.message||e);ocrCrop=crop;ocrFactor=1;}
        }
        try{if(!options.tableOnly&&!options.textCells){const parsed=await this.runGraphicOCR(ocrCrop,control);
          // Polygons come back in the crop's pixels; the capture object maps the
          // displayed canvas, so scale them back before any PDF conversion.
          ocr=ocrFactor===1?parsed:{...parsed,width:parsed.width/ocrFactor,height:parsed.height/ocrFactor,lines:(parsed.lines||[]).map(l=>({...l,quad:(l.quad||[]).map(p=>[p[0]/ocrFactor,p[1]/ocrFactor]),polygon:(l.polygon||[]).map(p=>[p[0]/ocrFactor,p[1]/ocrFactor])}))};
        }}catch(e){if(!native.length||control.stopped)throw e;warning='；OCR 未完成，仅列出 PDF 原生文字';s.lastOcrError=String(e&&e.message||e).slice(0,200);}
        if(control.stopped||this.stopped)return;
        // Validated rule: table interiors belong to the native table path, so OCR
        // lines inside a detected table are handed over rather than drawn twice.
        if(ocr)ocr={...ocr,lines:ocr.lines.filter(line=>!line.polygon&&!line.quad?false:!inTable(pixelsToPDF(line.polygon||line.quad,capture)))};
        const rows=mergeLabels(native,ocr,capture);
        for(const row of rows){
          let pixels=row.quad.map(p=>{const v=point(capture.transform,p);return [(v[0]-capture.x)*sx,(v[1]-capture.y)*sy];});
          // OCR boxes may clip one antialias pixel/descender. A symmetric 2-pixel
          // ink margin is permitted only on verified plain paper and inside the
          // selected crop; the raw source anchor remains stored for audit.
          if(row.origin==='OCR'&&!row.flowNode&&translatable(row.text)){
            const p=pixels,dx=p[1][0]-p[0][0],dy=p[1][1]-p[0][1],hx=p[3][0]-p[0][0],hy=p[3][1]-p[0][1],w=Math.hypot(dx,dy),h=Math.hypot(hx,hy);
            if(w>2&&h>2)for(const margin of [2,1]){const u=[margin*dx/w,margin*dy/w],v=[margin*hx/h,margin*hy/h],padded=p.map((pt,i)=>[pt[0]+([0,3].includes(i)?-u[0]:u[0])+([0,1].includes(i)?-v[0]:v[0]),pt[1]+([0,3].includes(i)?-u[1]:u[1])+([0,1].includes(i)?-v[1]:v[1])]);
              const b=bounds(padded),ix=Math.floor(b[0]),iy=Math.floor(b[1]),iw=Math.ceil(b[2])-ix,ih=Math.ceil(b[3])-iy,pdfQuad=pixelsToPDF(padded,capture);
              const collision=rows.some(other=>other!==row&&overlap(bounds(other.quad),bounds(pdfQuad))>.1);
              if(!collision&&ix>=0&&iy>=0&&ix+iw<=crop.width&&iy+ih<=crop.height&&plainBackground(ctx.getImageData(ix,iy,iw,ih))){row.sourceQuad=row.quad;row.quad=pdfQuad;row.inkMarginPixels=margin;pixels=padded;break;}
            }
          }
          const b=bounds(pixels);
          const ix=Math.max(0,Math.floor(b[0])),iy=Math.max(0,Math.floor(b[1])),iw=Math.min(crop.width,Math.ceil(b[2]))-ix,ih=Math.min(crop.height,Math.ceil(b[3]))-iy;
          const textBounds=['PDF-table','PDF-text-table','PDF-caption'].includes(row.origin)&&row.sourceQuad?bounds(row.sourceQuad.map(p=>{const v=point(capture.transform,p);return [(v[0]-capture.x)*sx-ix,(v[1]-capture.y)*sy-iy];})):null;
          // PDF native glyphs can have chromatic subpixel antialiasing. Permit it
          // only inside the verified table header ink, never on surrounding paper.
          row.background=iw>0&&ih>0?plainBackground(ctx.getImageData(ix,iy,iw,ih),{textBounds}):null;
          // Verify the complete node interior, not sparse word-sized strips.
          if(row.flowNode&&row.flowEvidence?.version===2&&iw>0&&ih>0&&typeof CubeGraphicInk!=='undefined'){
            const m=CubeGraphicInk.mask(ctx.getImageData(ix,iy,iw,ih));if(m?.uniform&&Math.abs(m.background-row.flowEvidence.background)<=3)row.background='rgb('+[m.background,m.background,m.background].join(',')+')';
            // Python inspected the entire closed interior at original capture
            // resolution. JS resampling can reconnect I/l to a faint border;
            // keep the independently verified full-node paper evidence.
            if(!row.background&&row.flowEvidence.unexplainedInk===0&&Number.isInteger(row.flowEvidence.background)&&row.flowEvidence.background>=180&&row.flowEvidence.background<=255)row.background='rgb('+Array(3).fill(row.flowEvidence.background).join(',')+')';
          }
          if(['PDF-table','PDF-text-table','PDF-caption'].includes(row.origin))row.backgroundSample={ix,iy,iw,ih,textBounds,canvasWidth:crop.width,canvasHeight:crop.height};
          if(row.origin==='OCR'&&!row.review&&row.directionVerified===true&&typeof CubeGraphicInk!=='undefined'){
            const p=project(row.quad,Array.from(pv.viewport.transform)),inv=inverse(p.matrix),scale=Math.hypot(p.matrix[0],p.matrix[1])*sx,cv=win.document.createElement('canvas');cv.width=Math.ceil(p.width*scale);cv.height=Math.ceil(p.height*scale);
            try{const cx=cv.getContext('2d');cx.setTransform(cv.width/p.width*inv[0]/sx,cv.height/p.height*inv[1]/sx,cv.width/p.width*inv[2]/sy,cv.height/p.height*inv[3]/sy,cv.width/p.width*inv[4],cv.height/p.height*inv[5]);cx.drawImage(canvas,0,0);const sourcePixels=cx.getImageData(0,0,cv.width,cv.height),m=CubeGraphicInk.mask(sourcePixels)||CubeGraphicInk.mask(sourcePixels,{edgeDashes:true});if(m?.uniform||m?.complete){cx.setTransform(1,0,0,1,0,0);const pixels=cx.createImageData(m.width,m.height);pixels.data.set(typeof Components!=='undefined'&&Components.utils?.cloneInto?Components.utils.cloneInto(m.data,win):m.data);cx.putImageData(pixels,0,0);row.inkPatch={version:5,quad:JSON.stringify(row.quad),uniform:!!m.uniform,background:m.background,url:cv.toDataURL()};}}finally{cv.width=cv.height=0;}
          }
          row.id='g'+(await this.hash(s.fingerprint+'|'+pageIndex+'|'+row.quad.flat().map(x=>x.toFixed(1)).join(',')+'|'+row.text)).slice(0,20);
          Object.assign(row,{pageIndex,target:'',selected:row.selected??translatable(row.text),approved:false});
          if(typeof CubeGraphicEvidence!=='undefined'){
            const merged=row.flowNode||row.origin==='PDF-text-table'?CubeGraphicEvidence.adoptFlowNode(s.rows,row):CubeGraphicEvidence.adoptAxisTitle(s.rows,row);if(merged.blocked)continue;
          }
          if(options.automatic){row.autoDetected=true;row.autoValidated=!row.review&&row.score>=.97&&!!row.background&&row.directionVerified!==false&&(row.origin!=='OCR'||row.directionVerified===true);if(row.autoValidated&&replacementReason({...row,target:'test '+(row.preserveLiterals||[]).join(' ')},rows.filter(r=>r!==row)))row.autoValidated=false;}
          // Reframing never discards an existing translation or manual correction.
          const duplicate=s.rows.find(r=>!r.legacyLayout&&r.pageIndex===pageIndex&&(r.id===row.id||overlap(bounds(r.quad),bounds(row.quad))/Math.max(1,Math.min(area(bounds(r.quad)),area(bounds(row.quad))))>.5));
          if(duplicate&&duplicate.text===row.text&&row.inkPatch)duplicate.inkPatch=row.inkPatch;
          if(duplicate&&duplicate.text===row.text&&duplicate.quad.every((p,i)=>p.every((v,j)=>Math.abs(v-row.quad[i][j])<.5))){duplicate.preserveSource=row.preserveSource;duplicate.preserveLiterals=row.preserveLiterals;if(row.preserveSource)duplicate.selected=false;}
          if(duplicate&&duplicate.text===row.text&&row.autoValidated&&row.directionVerified===true&&duplicate.quad.every((p,i)=>p.every((v,j)=>Math.abs(v-row.quad[i][j])<.5))){
            // Same source on the same anchor: update geometry evidence only, not
            // the user's translation, approval or history. Re-render with gates.
            duplicate.directionVerified=true;duplicate.autoValidated=!duplicate.review;duplicate.background=row.background;
          }
          if(!duplicate)s.rows.push(row);
          else if(duplicate.origin==='OCR'&&!duplicate.edited&&!duplicate.approved&&!duplicate.target){
            // New OCR may improve unreviewed source/direction. Keep old evidence.
            (duplicate.history||=[]).push({source:duplicate.text,target:duplicate.target,quad:duplicate.quad});
            const id=duplicate.id;Object.assign(duplicate,row,{id});
          }else if(duplicate.origin==='OCR'&&(duplicate.text!==row.text||duplicate.directionVerified===false&&row.directionVerified===true)){
            // Never silently relabel a completed/manual translation after re-OCR.
            duplicate.suggestion={text:row.text,quad:row.quad,score:row.score,rotation:row.rotation,directionVerified:row.directionVerified,background:row.background};
          }
        }
        if(typeof CubeGraphicEvidence!=='undefined'){
          const changes=CubeGraphicEvidence.reconcile(s.rows,rows.map(r=>({...r,pageIndex})));
          for(const id of changes.updates)s.nativeBackgrounds?.delete(id);
          for(const {id,next}of changes.suggestions){const old=s.rows.find(r=>r.id===id);old.geometrySuggestion={version:1,text:next.text,quad:next.quad,sourceQuad:next.sourceQuad,origin:next.origin,score:next.score,directionVerified:next.directionVerified,background:next.background};}
        }
        // A manual box selection is an explicit "translate this" request: recognise,
        // translate the selected blocks and paint them without a second click. The
        // automatic page pass keeps its review-first behaviour.
        const manual=!options.automatic,autoTranslate=manual&&this.config.translateGraphics!==false;
        // Recognition may have folded a box into a row the session already owns
        // (same deterministic id). Translate the session's object, otherwise the
        // target lands on a detached copy and nothing is ever painted.
        const owned=rows.map(r=>s.rows.find(x=>x.id===r.id)||r),ids=new Set(owned.map(r=>r.id));
        for(const extra of s.rows)if(ids.has(extra.id)&&!owned.includes(extra))owned.push(extra);
        const selected=owned.filter(r=>r.selected&&!r.target&&!r.preserveSource);
        if(autoTranslate&&selected.length){
          s.message='识别到 '+rows.length+' 个文字块'+warning+'；正在翻译 '+selected.length+' 个…';s.update();
          await this.translateGraphics(s,{control,rows:selected,cfg:this.config,article:options.article,ignorePause:true});
          s.replace=true;s.hidden=false;if(warning)s.message=String(s.message||'')+warning;await this.saveGraphics(s);s.paint();s.update();
          s.lastRegionList=owned.map(r=>({id:r.id,pageIndex:r.pageIndex,text:String(r.text||'').slice(0,200),target:String(r.target||'').slice(0,200)}));
          s.lastRegion={localTargets:selected.filter(r=>r.target).length,sessionTargets:s.rows.filter(r=>r.pageIndex===pageIndex&&r.target).length,identity:selected.every(r=>s.rows.includes(r)),selected:selected.length,pageIndex};
        }else{
          await this.saveGraphics(s);
          s.message='识别到 '+rows.length+' 个文字块'+warning+'。'+(this.config.translateGraphics===false?'图表翻译已关闭，可在设置中开启。':'核对原文后点击“翻译勾选项”；默认保留原图，点选对照。');s.paint();s.update();
        }
      }finally{if(!options.control)s.busy=false;s.update();}
    };
    app.translateGraphics=async function(s,options={}){
      if(s.busy&&!options.control)return;
      const rows=(options.rows||this.graphicPageRows(s)).filter(r=>r.selected&&!r.target&&!r.preserveSource&&!r.legacyLayout);if(!rows.length){s.message='没有待翻译的勾选项；已有译文保持不变。';s.update();return;}
      const cfg=JSON.parse(JSON.stringify(options.cfg||this.config));
      if(cfg.provider==='bridge')throw Error('图内标签需要文本翻译引擎，请在设置中选择文本引擎');
      if(cfg.confirmBeforeSend&&!options.consentGranted&&!this.confirm('翻译图内文字','将 '+rows.length+' 个勾选文字块发送给当前文本引擎；原图像保留本机。继续？'))return;
      s.busy=true;s.control=options.control||{stopped:false,requests:new Set()};const control=s.control;
      const stop=()=>control.stopped||this.stopped||!!options.article&&!options.ignorePause&&(options.article.paused||!options.article.alive());
      // Identical source + prompt share one result; never reuse manual edits from
      // another location. Preserve every source identity, cancellation and warning.
      const groups=new Map();for(const r of rows){const context=r.flowNode?'翻译流程图中的完整节点，使用紧凑中文，不添加原文没有的信息，不解释。普通英文即使全大写或OCR粘连也应翻译，例如ELECTRIC为电力、GAS为天然气、OIL为石油、HURRICANE为飓风、FLOOD为洪水、intra-network为层内、inter-network为层间。保留原文数值、公式变量及真正的缩写（如ML、CLM、GTA）；不要保留普通英文词作括注。':['PDF-text-table','PDF-caption'].includes(r.origin)?'翻译表格单元格或图注的全部文字，不省略。字段名亦须翻译：Context→上下文，Passage→文段，Question或Q:→问题，Answer或A:→答案，Target Completion→目标续写。根据上下文翻译普通词（如台阶step），保持题目字母串、数值、单位、变量与专名，不添加解释。':'图表短标签。保持原有数值、单位、变量与缩写；译文简短，不作解释。';
        const protectedContext=context+(r.preserveLiterals?.length?' 以下题目字符串必须逐字保留：'+JSON.stringify(r.preserveLiterals):'');
        const key=JSON.stringify([r.text,protectedContext]);if(!groups.has(key))groups.set(key,{source:r.text,context:protectedContext,rows:[]});groups.get(key).rows.push(r);
      }
      const jobs=[...groups.values()];let cursor=0,done=0,failed=0,failure;
      s.phase='translate';s.activeLabels=new Map();s.progress={total:rows.length,done:0,unique:jobs.length};s.update();
      try{
        await Promise.all(Array.from({length:Math.min(Math.max(1,cfg.concurrency||3),jobs.length)},async()=>{
          while(!stop()&&!failure){const job=jobs[cursor++];if(!job)return;
            const first=job.rows[0];s.activeLabels.set(job,{pageIndex:first.pageIndex,region:first.graphicRegion||null,text:job.source,rect:bounds(first.quad),copies:job.rows.length});s.activity={pageIndex:first.pageIndex,region:first.graphicRegion||null};s.lastLocation=s.activity;s.update();
            try{const result=await this.translate(job.source,job.rows[0].flowNode?{...cfg,translationRole:'flow-node'}:cfg,job.context,control);if(stop())return;
              if(!result||typeof result.text!=='string'||!result.text.trim())throw Error('图表译文为空');
              for(const r of job.rows)if(r.text===job.source&&!r.target){r.target=result.text;r.warnings=result.warnings||[];delete r.error;}
              done+=job.rows.length;s.progress.done=done;s.message='图表翻译 '+done+'/'+rows.length+' · 相同文字复用';
              // Persist once per unique phrase, render once per short frame rather
              // than rebuilding the complete overlay/panel after every label.
              await this.saveGraphics(s);if(!s.paintTimer)s.paintTimer=setTimeout(()=>{s.paintTimer=null;s.paint();s.update();},60);
            }catch(e){if(stop())return;failed+=job.rows.length;for(const r of job.rows)r.error=e.message;if(/写入|disk|space|ENOSPC/i.test(e.message))failure=e;}finally{s.activeLabels.delete(job);s.update();}
          }
        }));
        if(failure)throw failure;
        s.message=stop()?'图表任务已暂停，完成译文已保留':failed?'图表已译 '+done+' 条，'+failed+' 条待重试':'图表译文已保存';
        s.lastTranslation={total:rows.length,done,failed,unique:jobs.length};
      }finally{clearTimeout(s.paintTimer);s.paintTimer=null;s.activeLabels?.clear();s.paint();if(!options.control){s.busy=false;s.phase='idle';s.activity=null;}s.update();}
    };
    app.reuseGraphicTranslations=async function(article){
      if(article.cfg?.translateGraphics===false)return {reused:0};
      const s=await this.graphicSession(article.reader);await s.ready;let reused=0;const used=new Set(),norm=t=>t.replace(/\s+/g,' ').trim();
      for(const r of article.records.values()){
        if(r.status!=='pending')continue;
        const candidates=s.rows.filter(g=>!g.legacyLayout&&!used.has(g)&&g.pageIndex===r.layout.pageIndex&&g.target&&g.origin==='PDF-caption'&&norm(g.text)===norm(r.text)&&overlap(bounds(g.quad),r.layout.inkRect)>area(r.layout.inkRect)*.8);
        if(candidates.length!==1)continue;const g=candidates[0];used.add(g);r.target=g.target;r.edited=!!g.edited;r.status='done';r.reusedGraphicID=g.id;reused++;
      }
      return {reused};
    };
    app.preserveLayoutTranslations=async function(reader,records){
      // A changed region boundary is not a source-to-target alignment algorithm.
      // Keep unmatched complete translations, including edits, reviewable; never
      // cut their Chinese text by English character counts or repaint old unions.
      const s=await this.graphicSession(reader);await s.ready;let count=0;
      for(const r of records||[]){
        const pageIndex=r.pageIndex??r.layout?.pageIndex,rect=r.inkRect||r.layout?.inkRect||r.rect;
        if(r.status!=='done'||!r.target||!Number.isInteger(pageIndex)||!L.validRect(rect))continue;
        const id='legacy-'+r.id+'-'+(await this.hash(r.text+'|'+r.target)).slice(0,12);
        if(s.rows.some(v=>v.id===id))continue;
        s.rows.push({id,pageIndex,text:r.text,target:r.target,quad:quad(rect),origin:'旧版区域归档',legacyLayout:true,selected:false,approved:false,review:true,score:1,edited:!!r.edited,previousID:r.id});count++;
      }
      if(count)await this.saveGraphics(s);s.panel.hidden=true;return {preserved:count};
    };
    app.mountGraphicPanel=function(s){
      const doc=s.doc,panel=doc.createElement('section');s.panel=panel;panel.className='pl-graphics-panel';panel.hidden=true;panel.setAttribute('aria-label','图表翻译');
      panel.style.cssText='position:fixed;top:52px;right:12px;width:372px;max-width:92vw;max-height:80vh;overflow:hidden;z-index:2147483000;background:Canvas;color:CanvasText;border:1px solid #c9d3e2;border-radius:10px;box-shadow:0 8px 28px #16233f26;font:13px/1.5 system-ui;-moz-window-dragging:no-drag;';
      // Panel chrome lives in one stylesheet so the markup stays declarative and
      // the buttons keep a single, quiet visual language.
      const sheet=doc.createElement('style');sheet.textContent=[
       '.pl-graphics-panel .pl-gp-head{display:flex;align-items:center;gap:8px;padding:9px 10px 7px 12px}',
       '.pl-graphics-panel .pl-gp-head strong{flex:1;font:600 13px system-ui}',
       '.pl-graphics-panel .pl-gp-close{width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;opacity:.5;font:13px/1 system-ui;cursor:pointer}',
       '.pl-graphics-panel .pl-gp-close:hover{opacity:.95;background:#7b9ad624}',
       '.pl-graphics-panel .pl-gp-body{padding:0 12px 12px;overflow:auto;max-height:calc(80vh - 40px);overscroll-behavior:contain}',
       '.pl-graphics-panel .pl-gp-bar{height:3px;border-radius:2px;background:#7b9ad633;overflow:hidden;margin:0 0 8px}',
       '.pl-graphics-panel .pl-gp-bar i{display:block;height:100%;width:0;background:#2f6bff;transition:width .2s}',
       '.pl-graphics-panel .pl-gp-status{margin:0 0 9px;font:12px/1.55 system-ui;color:#61718c;white-space:pre-line}',
       '.pl-graphics-panel .pl-gp-actions,.pl-graphics-panel .pl-gp-minor{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
       '.pl-graphics-panel .pl-gp-actions{margin:0 0 7px}',
       '.pl-graphics-panel button{font:12px system-ui;padding:6px 10px;border:1px solid #c9d3e2;border-radius:6px;background:transparent;color:inherit;cursor:pointer;-moz-window-dragging:no-drag}',
       '.pl-graphics-panel button:hover:not(:disabled){background:#7b9ad620}',
       '.pl-graphics-panel button.primary{border-color:#2f6bff;background:#2f6bff;color:#fff;font-weight:600}',
       '.pl-graphics-panel button.primary:hover:not(:disabled){background:#2a60e6}',
       '.pl-graphics-panel button:disabled{opacity:.45;cursor:default}',
       '.pl-graphics-panel .pl-gp-minor{margin:2px 0 0}',
       '.pl-graphics-panel .pl-gp-minor button{border:0;padding:2px 3px;color:#61718c}',
       '.pl-graphics-panel .pl-gp-minor button:hover:not(:disabled){background:transparent;color:#2f6bff;text-decoration:underline}',
       '.pl-graphics-panel details{margin:9px 0 0;border-top:1px solid #7b9ad633;padding-top:9px}',
       '.pl-graphics-panel summary{cursor:pointer;color:#61718c;font-size:12px;list-style:none;display:flex;align-items:center;gap:4px}',
       '.pl-graphics-panel summary::-moz-list-bullet{list-style:none}',
       '.pl-graphics-panel summary:before{content:"\\25B8";color:#93a3bb}',
       '.pl-graphics-panel details[open]>summary:before{content:"\\25BE"}',
       '.pl-graphics-panel .pl-gp-tip{margin:6px 0 0;font:11px/1.55 system-ui;color:#8496ad}',
       '.pl-graphics-panel .pl-gp-check{display:flex;align-items:center;gap:6px;margin:9px 0 0;font-size:12px;color:#61718c}',
       '.pl-graphics-panel .pl-gp-field{display:block;font-size:12px;color:#61718c;margin:6px 0 0}',
       '.pl-graphics-panel input[type=text],.pl-graphics-panel select,.pl-graphics-panel textarea{font:12px system-ui;box-sizing:border-box;width:100%;margin:4px 0 0}',
       '.pl-graphics-panel .pl-gp-item{border-top:1px solid #7b9ad633;padding:8px 0}',
       '.pl-graphics-panel .pl-gp-footer{margin-top:10px;border-top:1px solid #7b9ad633;padding-top:8px}'
      ].join('');panel.appendChild(sheet);
      const header=doc.createElement('div');header.className='pl-gp-head';panel.appendChild(header);
      const heading=doc.createElement('strong');heading.textContent='图表翻译';header.appendChild(heading);
      const close=doc.createElement('button');close.type='button';close.className='pl-graphics-close pl-gp-close';close.textContent='✕';close.title='收起（Esc）';close.setAttribute('aria-label','收起图表翻译');header.appendChild(close);
      const dismiss=()=>{panel.hidden=true;};s.cleanup.push(this.bindReaderCommand(close,dismiss));
      const body=doc.createElement('div');body.className='pl-gp-body';body.style.cssText='overflow:auto;max-height:calc(80vh - 40px);overscroll-behavior:contain;padding:0 12px 12px;';s.body=body;panel.appendChild(body);
      s.bindPanelDismiss=win=>{if(!win||s.dismissWindows?.has(win))return;(s.dismissWindows||=new Set()).add(win);
        const key=e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopPropagation();s.selection?.();dismiss();}};
        const outside=e=>{if(!panel.hidden&&!s.selection&&!panel.contains(e.target)&&!e.target.closest?.('.pl-auto-graphics,.pl-reader-menu,.pl-graphic-anchor'))dismiss();};
        win.addEventListener('keydown',key,true);win.addEventListener('pointerdown',outside,true);
        s.cleanup.push(()=>{win.removeEventListener('keydown',key,true);win.removeEventListener('pointerdown',outside,true);});
      };s.bindPanelDismiss(doc.defaultView);for(const v of [s.reader?._internalReader?._primaryView,s.reader?._internalReader?._secondaryView])s.bindPanelDismiss(v?._iframeWindow);
      const bar=doc.createElement('div');bar.className='pl-gp-bar';const fill=doc.createElement('i');bar.appendChild(fill);body.appendChild(bar);
      const status=doc.createElement('p');status.className='pl-gp-status';status.setAttribute('role','status');body.appendChild(status);
      const controls=doc.createElement('div');controls.className='pl-gp-actions';body.appendChild(controls);
      const bind=(button,fn,cls,parent)=>{if(cls)button.className=cls;(parent||controls).appendChild(button);s.cleanup.push(this.bindReaderCommand(button,()=>Promise.resolve().then(fn).catch(e=>{s.message=e.message;s.update();})));return button;};
      const button=(label,fn,cls)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;return bind(b,fn,cls);};
      const auto=button('补译当前页',()=>this.autoTranslateGraphics(s.reader),'primary');
      const translate=button('翻译勾选项',()=>this.translateGraphics(s));
      const visible=button('隐藏图内译文',()=>this.toggleGraphics(s.reader));
      const minor=doc.createElement('div');minor.className='pl-gp-minor';body.appendChild(minor);
      const minorButton=(label,fn,title)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;if(title)b.title=title;return bind(b,fn,'',minor);};
      minorButton('暂停',()=>{this.pauseInPlace?.(s.reader,true);s.control.stopped=true;s.control.process?.kill();s.control.renderTask?.cancel();for(const xhr of [...s.control.requests])xhr.abort();s.message='已停止派发，已完成译文保留';s.update();},'停止派发新任务，已完成译文保留');
      minorButton('重试失败页',()=>{const a=this.inplace?.get(s.reader);if(a){a.graphicJob?.retry();this.pauseInPlace(s.reader,false);}},'只重跑失败页');
      minorButton('继续全文',()=>{if(this.inplace?.has(s.reader))this.pauseInPlace(s.reader,false);else this.activateReaderButton(s.reader);},'恢复后台全文处理');
      const modeLabel=doc.createElement('label'),mode=doc.createElement('input');mode.type='checkbox';mode.checked=s.replace;modeLabel.className='pl-gp-check';modeLabel.title='仅显示通过自动检查或人工核对的译文，其余保留原图。';modeLabel.appendChild(mode);modeLabel.appendChild(doc.createTextNode('原位显示译文'));body.appendChild(modeLabel);
      mode.addEventListener('change',()=>{s.replace=mode.checked;s.paint();this.saveGraphics(s).catch(e=>{s.message=e.message;s.update();});});
      const advanced=doc.createElement('details'),advancedTitle=doc.createElement('summary');advancedTitle.textContent='高级选项 · 手动框选与本地 OCR';advanced.appendChild(advancedTitle);
      const advRow=doc.createElement('div');advRow.className='pl-gp-actions';advanced.appendChild(advRow);
      const select=bind((()=>{const b=doc.createElement('button');b.type='button';return b;})(),()=>this.selectGraphicRegion(s.reader),'',advRow);select.textContent='手动框选补漏';
      const recheck=bind((()=>{const b=doc.createElement('button');b.type='button';return b;})(),()=>this.autoTranslateGraphics(s.reader,{force:true,translate:false,background:true}),'',advRow);recheck.textContent='重新识别当前页';recheck.title='保留已有译文和校订，重新识别位置';
      const tip=doc.createElement('p');tip.className='pl-gp-tip';tip.textContent='手动框选：点按钮后在页面左上角按住左键拖到右下角松开，松手即识别并翻译；Esc 取消。';advanced.appendChild(tip);
const scField=doc.createElement('label');scField.className='pl-gp-field';scField.textContent='\u6846\u9009\u5feb\u6377\u952e';
      const scInput=doc.createElement('input');scInput.type='text';scInput.value=this.readerShortcut?.()||'';scInput.placeholder='\u4f8b\u5982 Alt+R\uff1b\u7559\u7a7a\u5173\u95ed';
      scInput.addEventListener('change',()=>{this.setReaderShortcut?.(scInput.value.trim());s.message='\u6846\u9009\u5feb\u6377\u952e\uff1a'+(this.readerShortcut?.()||'\u672a\u8bbe\u7f6e');s.update();});
      scField.appendChild(scInput);advanced.appendChild(scField);
      const pythonDetails=doc.createElement('details'),pythonSummary=doc.createElement('summary');pythonSummary.textContent='本地 Python 高精度（可选）';pythonDetails.appendChild(pythonSummary);
      const runtime=this.graphicRuntime(),inputs={};
      for(const [key,label] of [['python','Python 可执行文件'],['runtime','OCR 依赖目录'],['models','OCR 模型目录']]){const l=doc.createElement('label');l.className='pl-gp-field';l.textContent=label;const input=doc.createElement('input');input.type='text';input.value=runtime[key]||'';l.appendChild(input);pythonDetails.appendChild(l);inputs[key]=input;}
      const save=doc.createElement('button');save.type='button';save.textContent='保存 OCR 路径';bind(save,()=>{Zotero.Prefs.set(runtimePref,JSON.stringify(Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()]))),true);s.message='OCR 路径已保存；识别在本机执行，图像不发送给翻译引擎。';s.update();},'',pythonDetails);
      advanced.appendChild(pythonDetails);body.appendChild(advanced);
      const footer=doc.createElement('div');footer.className='pl-gp-footer';body.appendChild(footer);
      const filter=doc.createElement('label'),all=doc.createElement('input');all.type='checkbox';filter.className='pl-gp-check';filter.style.margin='0';filter.appendChild(all);filter.appendChild(doc.createTextNode('查看全部页记录'));footer.appendChild(filter);
      all.addEventListener('change',()=>{s.allPages=all.checked;s.update();});
      const list=doc.createElement('div');list.className='pl-graphics-list';body.appendChild(list);doc.body.appendChild(panel);
      s.update=()=>{
        this.inplace?.get(s.reader)?.update?.();this.refreshReaderButton?.(s.reader);if(!panel.isConnected||panel.hidden)return;const index=this.graphicPageIndex(s.reader),rows=this.graphicPageRows(s);heading.textContent='图表翻译 · 第 '+(Number.isInteger(index)?index+1:'—')+' 页';status.title=this.articleGraphicsSummary(s.reader);all.checked=!!s.allPages;auto.disabled=s.busy;recheck.disabled=s.busy;select.disabled=s.busy;translate.disabled=s.busy;visible.disabled=s.busy;mode.checked=s.replace;visible.textContent=s.hidden?'显示图内译文':'隐藏图内译文';
        const a=this.inplace?.get(s.reader),j=a?.graphicJob,total=rows.length,done=rows.filter(r=>r.target).length,pages=j?j.completed.size+j.pending.size+j.failed.size:0;
        status.textContent=(j?'已检查 '+j.completed.size+'/'+pages+' 页':'未开始')+' · '+(s.allPages?'全部页':'当前页')+'已译 '+done+'/'+total+' 条'+(j?.failed.size?' · '+j.failed.size+' 页待重试':'')+String.fromCharCode(10)+(s.message||'');
        fill.style.width=(total?Math.round(done/total*100):0)+'%';
        // Do not replace active input during status updates or lose a user's draft.
        if(list.contains(doc.activeElement))return;list.replaceChildren();
        for(const r of rows){
          const entry=doc.createElement('div');entry.dataset.rowId=r.id;entry.style.cssText='border-top:1px solid #aaa5;padding:8px 0';
          const label=doc.createElement('label'),check=doc.createElement('input');check.type='checkbox';check.checked=!!r.selected;check.disabled=s.busy||!!r.legacyLayout||!!r.preserveSource;check.addEventListener('change',()=>{r.selected=check.checked;this.saveGraphics(s).catch(e=>{s.message=e.message;});});
          label.appendChild(check);label.appendChild(doc.createTextNode(' 第 '+(r.pageIndex+1)+' 页 · '+r.origin+(r.rotation?' · '+r.rotation+'°':'')+(r.review?' · 待核对':r.autoValidated?' · 自动定位通过':'')+' · '+Math.round(r.score*100)+'%'));entry.appendChild(label);
          const source=doc.createElement('textarea');source.value=r.text;source.maxLength=2000;source.rows=1;source.disabled=s.busy;source.setAttribute('aria-label','识别原文');source.style.cssText='display:block;box-sizing:border-box;width:100%;margin:5px 0';
          source.addEventListener('change',()=>{const text=source.value.trim().slice(0,2000);if(text&&text!==r.text){(r.history||=[]).push({source:r.text,target:r.target});r.text=text;r.target='';r.approved=false;r.autoValidated=false;this.saveGraphics(s).catch(e=>{s.message=e.message;});s.paint();}});entry.appendChild(source);
          const target=doc.createElement('textarea');target.value=r.target;target.placeholder='译文（可人工校订）';target.rows=2;target.maxLength=4000;target.disabled=s.busy;target.setAttribute('aria-label','图内译文');target.style.cssText='display:block;box-sizing:border-box;width:100%';
          target.addEventListener('change',()=>{(r.history||=[]).push({source:r.text,target:r.target});r.target=target.value.trim().slice(0,4000);r.edited=true;r.warnings=[];this.saveGraphics(s).catch(e=>{s.message=e.message;});s.paint();});entry.appendChild(target);
          const approved=doc.createElement('label'),ok=doc.createElement('input');ok.type='checkbox';ok.checked=!!r.approved;ok.disabled=s.busy||!!r.legacyLayout;ok.addEventListener('change',()=>{r.approved=ok.checked;r.autoValidated=false;if(r.approved)r.review=false;this.saveGraphics(s).catch(e=>{s.message=e.message;});s.paint();});approved.appendChild(ok);approved.appendChild(doc.createTextNode(' 已核对原文及定位框'));entry.appendChild(approved);
          const locate=doc.createElement('button');locate.type='button';locate.textContent='定位核对';locate.addEventListener('click',()=>{
            const win=s.reader._internalReader?._secondaryView?._iframeWindow,pv=win?.PDFViewerApplication?.pdfViewer;if(!pv){s.message='请打开右侧分屏查看图内译文，左侧保留原文。';s.update();return;}pv.currentPageNumber=r.pageIndex+1;
            const page=pv.getPageView(r.pageIndex);if(!page?.div||!page.viewport)return;
            const marker=this.paintGraphicLabel({...s,replace:false},{...r,target:r.target||'核对定位'},page.div,page.viewport);if(!marker)return;marker.style.outline='1px solid #e07800';marker.scrollIntoView({block:'center'});setTimeout(()=>marker.remove(),5000);
          });entry.appendChild(locate);
          const rotate=doc.createElement('button');rotate.type='button';rotate.textContent='方向 ↻90°';rotate.disabled=s.busy;rotate.title='只旋转此文字框的阅读方向，原位置与大小不变';
          rotate.addEventListener('click',()=>{(r.history||=[]).push({source:r.text,target:r.target,quad:r.quad});r.quad=[r.quad[3],r.quad[0],r.quad[1],r.quad[2]];r.rotation=((r.rotation||0)+270)%360;r.directionVerified=true;r.approved=false;r.autoValidated=false;s.paint();this.saveGraphics(s).catch(e=>{s.message=e.message;});});entry.appendChild(rotate);
          if(r.suggestion){const accept=doc.createElement('button');accept.type='button';accept.textContent='采用重识别结果';accept.disabled=s.busy;accept.title=r.suggestion.text;
            accept.addEventListener('click',()=>{const next=r.suggestion;(r.history||=[]).push({source:r.text,target:r.target,quad:r.quad});if(r.text!==next.text)r.target='';Object.assign(r,next);r.approved=false;r.autoValidated=false;r.review=next.score<.94||next.directionVerified===false;delete r.suggestion;s.paint();this.saveGraphics(s).catch(e=>{s.message=e.message;});s.update();});entry.appendChild(accept);}
          if(!r.legacyLayout){const previous=s.rows.filter(x=>x.legacyLayout&&x.pageIndex===r.pageIndex&&overlap(bounds(x.quad),bounds(r.quad))>.1);if(previous.length){const details=doc.createElement('details'),title=doc.createElement('summary');title.textContent='关联旧版译文（'+previous.length+'，供校订参考）';details.appendChild(title);for(const old of previous){const p=doc.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=old.text+'\n'+old.target;details.appendChild(p);}entry.appendChild(details);}}
          const reason=doc.createElement('small');reason.style.cssText='display:block;margin-top:4px';const rendered=s.renderStatus?.get(r.id);reason.textContent=rendered?(rendered.mode==='replace'?'已在当前页面原位显示':'已有译文 · '+rendered.reason):replacementReason(r,s.rows.filter(x=>x.pageIndex===r.pageIndex&&!x.legacyLayout))||'框内替换仍需通过实际文字尺寸检查';entry.appendChild(reason);list.appendChild(entry);
        }
      };s.update();
    };
  }
  PaperLoomGraphics={attach,point,inverse,bounds,quad,project,pixelsToPDF,nativeLabels,textTables,mergeLabels,translatable,replacementReason,plainBackground,readableLabel,normalizedText,redundant,cover};
  if(typeof module==='object'&&module.exports)module.exports=PaperLoomGraphics;else root.PaperLoomGraphics=PaperLoomGraphics;
})(this);
