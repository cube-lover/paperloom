const {test}=require('node:test');const assert=require('node:assert/strict');const G=require('../addon/content/graphics.js');
const {createHarness}=require('./harness.cjs');const {JSDOM}=require('jsdom');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const transforms=[[1,0,0,-1,0,792],[2.5,0,0,-2.5,-50,1900],[0,1.75,1.75,0,3,8],[-2,0,0,2,1224,0],[0,-.8,-.8,0,600,500]];
test('PDF anchors roundtrip all page rotations, zoom, crop origins and nonuniform device backing ratios',()=>{
 const q=[[73,580],[200,580],[200,567],[73,567]];
 for(const transform of transforms)for(const ratio of [1,1.25,2,3]){
  const capture={transform,x:38.2,y:40.1,sx:ratio,sy:ratio*1.001};
  const pixels=q.map(p=>{const v=G.point(transform,p);return [(v[0]-capture.x)*capture.sx,(v[1]-capture.y)*capture.sy];});
  const back=G.pixelsToPDF(pixels,capture);back.forEach((p,i)=>p.forEach((v,j)=>close(v,q[i][j])));
  const p=G.project(back,transform);[[0,0],[p.width,0],[p.width,p.height],[0,p.height]].forEach((v,i)=>G.point(p.matrix,v).forEach((n,j)=>close(n,G.point(transform,q[i])[j])));
 }
});
test('rotation-aware frame keeps OCR baseline and preserves immutable polygon through repeated zoom',()=>{
 const q=[[90,540],[90,620],[100,620],[100,540]],before=JSON.stringify(q);
 for(let i=0;i<100;i++)for(const t of transforms){const p=G.project(q,t);close(p.width,80);close(p.height,10);}
 assert.equal(JSON.stringify(q),before);assert.throws(()=>G.inverse([0,0,0,0,0,0]));
});
function chars(text,x,y){return Array.from(text,(c,i)=>({c,u:c,rect:[x+i*5,y,x+i*5+4,y+10],baseline:y+2,rotation:0}));}
test('native labels never merge table cells, separate legend items or rotated characters',()=>{
 const c=[...chars('Model',10,20),...chars('Accuracy',100,20),...chars('Other',10,40),...chars('Outside',600,20),{...chars('R',20,80)[0],rotation:90}];
 const r=G.nativeLabels(c,[0,0,300,100]);assert.deepEqual(r.map(x=>x.text),['Model','Accuracy','Other']);
 assert.deepEqual(r[0].quad,[[10,30],[34,30],[34,20],[10,20]]);
});
test('OCR/native duplicates cannot produce two overlapping replacements; disagreement marks review',()=>{
 const c={transform:[1,0,0,-1,0,100],x:0,y:0,sx:1,sy:1},native=[{text:'Energy',quad:G.quad([10,60,90,80]),score:1,origin:'PDF'}];
 const ocr={width:300,height:100,lines:[{text:'Energy',score:.99,polygon:[[10,20],[90,20],[90,40],[10,40]]},{text:'Baseline',score:.98,polygon:[[120,20],[190,20],[190,40],[120,40]]},{text:'bad',score:1,polygon:[[NaN,2],[0,0],[1,1],[0,1]]}]};
 let r=G.mergeLabels(native,ocr,c);assert.equal(r.length,2);assert.equal(r[0].origin,'PDF');assert.equal(r[0].review,undefined);
 ocr.lines[0].text='Erroneous';r=G.mergeLabels(native,ocr,c);assert.equal(r.length,2);assert.equal(r[0].review,true);
});
test('numeric axis ticks, formula-only labels and URLs are not automatically selected',()=>{
 for(const s of ['95.5','10^3','α + β','x = 2','https://example.com'])assert.equal(G.translatable(s),false);
 for(const s of ['Accuracy (%)','Training examples','Baseline model'])assert.equal(G.translatable(s),true);
});
const row=()=>({id:'g1',pageIndex:0,text:'Accuracy',target:'准确率',quad:G.quad([10,20,70,32]),score:1,origin:'PDF',approved:true,background:'#fff'});
test('stored translations display for reviewed or unapproved rows; only geometry, identity and collision block them',()=>{
 const r=row();assert.equal(G.replacementReason(r,[r]),'');
 // The user-visible rule: an existing translation must not be hidden because a
 // machine confidence flag or a missing approval flag is still set.
 for(const patch of [{approved:false},{review:true},{score:.8},{inkValidated:false},{background:null},{warnings:['数字核对']}])assert.equal(G.replacementReason({...r,...patch},[]),'',JSON.stringify(patch));
 for(const patch of [{target:''},{target:'Accuracy'},{preserveSource:true},{quad:[[10,20],[10,80],[20,80],[20,20]]},{quad:[[10,32],[70,32],[75,20],[10,20]]}])assert.notEqual(G.replacementReason({...r,...patch},[]),'');
 assert.match(G.replacementReason(r,[r,{...row(),id:'g2',text:'Precision recall'}]),/相交/);
 // Two OCR passes over the same rectangle resolve to one deterministic owner,
 // never to two mutually blocking hotspots.
 const dup=[r,{...r,id:'g2'}];assert.equal(G.replacementReason(dup[0],dup),'');assert.match(G.replacementReason(dup[1],dup),/重复识别/);
 const inner={...r,id:'word',text:'Accuracy',quad:G.quad([14,24,40,30])};assert.equal(G.replacementReason(r,[r,inner]),'');assert.match(G.replacementReason(inner,[r,inner]),/重复识别/);
 for(const q of [[[10,20],[10,80],[20,80],[20,20]],[[20,80],[20,20],[10,20],[10,80]]])assert.equal(G.replacementReason({...r,quad:q,directionVerified:true},[]),'');
});
function image(w=80,h=20){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)};}
function ink(im,x,y,color=[0,0,0]){const i=(y*im.width+x)*4;im.data.set(color,i);}
test('plain paper detector rejects gridlines through labels and coloured data strokes',()=>{
 let im=image();for(let y=6;y<14;y++)for(let x=10;x<13;x++)ink(im,x,y);assert.equal(G.plainBackground(im),'#fff');
 for(let x=0;x<80;x++)ink(im,x,10);assert.equal(G.plainBackground(im),null);
 im=image();ink(im,30,10,[0,100,220]);assert.equal(G.plainBackground(im),null);
 im=image();for(let y=0;y<20;y++)ink(im,25,y);assert.equal(G.plainBackground(im),null);
});
test('default hotspots never cover source, overflow falls back and zoom changes only transform',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);
 const dom=new JSDOM('<div class="page"></div><section></section>');t.after(()=>dom.window.close());const doc=dom.window.document,page=doc.querySelector('div');
 const s={rows:[],replace:false,panel:doc.querySelector('section'),update(){}};const r=row();s.rows.push(r);
 let b=app.paintGraphicLabel(s,r,page,{transform:transforms[0]});assert.equal(b.dataset.mode,'hotspot');assert.equal(b.textContent,'');assert.equal(b.style.background,'transparent');
 s.replace=true;app.measureInPlaceText=()=>({fits:false});b=app.paintGraphicLabel(s,r,page,{transform:transforms[0]});assert.equal(b.dataset.mode,'hotspot');assert.match(b.dataset.fallback,/放不下/);assert.equal(b.textContent,'');
 app.measureInPlaceText=()=>({fits:true});b=app.paintGraphicLabel(s,r,page,{transform:transforms[1]});assert.equal(b.dataset.mode,'replace');assert.equal(b.textContent,r.target);assert.equal(b.style.width,'60px');assert.equal(b.style.height,'12px');
 assert.deepEqual(r.quad,G.quad([10,20,70,32]));
});
test('graphic translation binds target to exact source ID, saves partial results, and never touches prose session',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);const prose={paused:false,records:new Map([['p1',{target:'正文原译文'}]])};app.inplace=new Map([[{},prose]]);
 const a={...row(),target:'',selected:true},b={...row(),id:'g2',text:'Baseline',target:'人工译文',selected:true};let calls=0,saves=0;
 app.translate=async(source)=>{calls++;assert.equal(source,'Accuracy');return {text:'准确率',warnings:[]};};app.saveGraphics=async()=>saves++;
 const s={rows:[a,b],busy:false,update(){},paint(){}};await app.translateGraphics(s,{rows:s.rows});
 assert.equal(calls,1);assert.equal(saves,1);assert.equal(a.target,'准确率');assert.equal(b.target,'人工译文');assert.equal(prose.paused,false);assert.equal(prose.records.get('p1').target,'正文原译文');
});
test('stopping an in-flight graphic result prevents stale write without clearing prior targets',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);const r={...row(),target:'',selected:true};let saves=0;
 const s={rows:[r],busy:false,update(){},paint(){}};app.saveGraphics=async()=>saves++;app.translate=async()=>{s.control.stopped=true;return {text:'late'};};await app.translateGraphics(s,{rows:s.rows});assert.equal(r.target,'');assert.equal(saves,0);
});
test('graphic persistence contains only dedicated records, source history and document fingerprint',async t=>{
 const {app,C,IOUtils,dir}=await createHarness(t);G.attach(app,C);const path=require('node:path');await IOUtils.makeDirectory(path.join(app.dir,'graphics'));
 const s={file:'graphics/test.json',fingerprint:'sample',rows:[{...row(),history:[{source:'old',target:'校订前'}]}]};await app.saveGraphics(s);
 const data=JSON.parse(await IOUtils.readUTF8(path.join(app.dir,'graphics/test.json')));assert.equal(data.version,1);assert.equal(data.rows[0].history[0].target,'校订前');assert.equal(data.fingerprint,'sample');assert.equal(data.config,undefined);
});
test('90/270 degree OCR carries oriented reading corners from crop into PDF and renders along baseline',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);app.measureInPlaceText=()=>({fits:true});
 const dom=new JSDOM('<div></div><section></section>');t.after(()=>dom.window.close());const doc=dom.window.document;
 const capture={transform:[2,0,0,-2,0,800],x:0,y:0,sx:1.5,sy:1.5};
 const ocr={width:300,height:300,lines:[{text:'Duration (seconds)',score:.98,rotation:270,directionVerified:true,polygon:[[20,220],[20,40],[50,40],[50,220]]}]};
 const rows=G.mergeLabels([],ocr,capture),r=rows[0];Object.assign(r,{id:'g90',pageIndex:0,approved:true,background:'#fff',target:'时长（秒）'});
 assert.equal(r.rotation,270);assert.equal(r.directionVerified,true);assert.equal(G.replacementReason(r,rows),'');
 const s={rows,replace:true,panel:doc.querySelector('section'),update(){}};
 for(const transform of transforms){const box=app.paintGraphicLabel(s,r,doc.querySelector('div'),{transform});const scale=Math.hypot(transform[0],transform[1]);assert.equal(box.dataset.mode,'replace');assert.equal(box.style.width,'60px');assert.equal(box.style.height,'10px');}
});
test('graphic visibility and approved replacement mode survive close and reopen',async t=>{
 const {app,context,IOUtils}=await createHarness(t),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../addon/content/graphics.js'),'utf8'),context);context.PaperLoomGraphics.attach(app,{});
 const dom=new JSDOM('<div></div>');t.after(()=>dom.window.close());const reader={itemID:40,_iframeWindow:dom.window,_internalReader:{_primaryView:{_iframeWindow:{PDFViewerApplication:{pdfDocument:{fingerprints:['fixture']}}}}}};
 app.mountGraphicPanel=s=>{s.panel=dom.window.document.createElement('section');};app.bindGraphicPages=()=>{};
 let s=await app.graphicSession(reader);s.rows=[row()];s.replace=true;await app.toggleGraphics(reader);assert.equal(s.hidden,true);app.closeGraphics(reader);
 s=await app.graphicSession(reader);assert.equal(s.replace,true);assert.equal(s.hidden,true);assert.equal(s.rows[0].target,'准确率');app.closeGraphics(reader);
});
test('automatic discovery finds figures and complete table regions without selecting page prose',async t=>{
 const {app,C}=await createHarness(t),L=require('../addon/content/layout.js'),f=require('./layout-dense-tables.fixture.json');G.attach(app,C,L);
 for(const i of [44,45]){const p=f.pages.find(p=>p.pageIndex===i),r=app.detectGraphicRegions(p,p.operatorList);assert.equal(r.regions.filter(r=>r.role==='table').length,1);assert.equal(r.regions.filter(r=>!['table','native-caption'].includes(r.role)).length,0);}
 const p=f.pages.find(p=>p.pageIndex===30),r=app.detectGraphicRegions(p,p.operatorList);assert.ok(r.regions.some(r=>r.role==='image'));assert.ok(G.bounds(G.quad(r.regions[0].rect))[3]<=p.viewBox[3]);
});
test('automatic page workflow keeps a single stop token, uses only detected regions and restricts translated rows',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,{mapRect:(m,r)=>r});
 const win={PDFViewerApplication:{pdfDocument:{getPageData:async()=>({}),getPage:async()=>({})},pdfViewer:{currentPageNumber:2,getPageView:()=>({renderingState:3,canvas:{width:500},viewport:{transform:[1,0,0,1,0,0]}})}}};
 const reader={_internalReader:{_secondaryView:{_iframeWindow:win}}},s={reader,rows:[{id:'old',pageIndex:0,selected:true,target:''}],update(){},paint(){}};
 app.graphicSession=async()=>s;app.readOperatorGeometry=async()=>({});app.detectGraphicRegions=()=>({regions:[{role:'table',rect:[0,0,100,100]}],rules:[]});
 let requests=0,token;app.recognizeGraphicRegion=async(state,w,pv,cv,page,rect,opts)=>{token=opts.control;assert.equal(state.busy,true);assert.equal(opts.tableOnly,true);s.rows.push({id:'new',pageIndex:page,selected:true,target:'',quad:G.quad([1,1,10,10])});};
 app.translateGraphics=async(state,opts)=>{assert.equal(opts.control,token);assert.deepEqual(opts.rows.map(r=>r.id),['new']);requests++;};app.saveGraphics=async()=>{};
 await app.autoTranslateGraphics(reader);assert.equal(requests,1);assert.equal(s.busy,false);
 app.recognizeGraphicRegion=async(state,w,pv,cv,page,rect,opts)=>{opts.control.stopped=true;};await app.autoTranslateGraphics(reader,{force:true});assert.equal(requests,1);assert.equal(s.busy,false);
});
test('display never depends on throttled review flags but collision still wins',()=>{
 const r={...row(),approved:false,autoValidated:false,review:true,score:.8,background:null};assert.equal(G.replacementReason(r,[]),'');assert.match(G.replacementReason(r,[{...r,id:'other',text:'Precision recall'}]),/相交/);
 const dup={...r,id:'other'};assert.equal(G.replacementReason(r,[r,dup]),'');assert.match(G.replacementReason(dup,[r,dup]),/重复识别/);
 assert.equal(G.replacementReason({...r,directionVerified:false,origin:'OCR',text:'Unreadable fixture',quad:[[10,20],[20,20],[20,120],[10,120]]},[]),'文字阅读方向待核对');
 assert.equal(G.replacementReason({...r,directionVerified:false,origin:'OCR',text:'Three-layer energy infrastructure network'},[]),'');
});
test('ruled text examples include six independent tables, semantic multiline cells and no captions/numbers',()=>{
 const L=require('../addon/content/layout.js'),p=require('./layout-text-tables.fixture.json').pages[0],r=G.textTables(p.chars,L.graphics(p.operatorList,p.viewBox).rules,L);
 assert.equal(r.length,6);assert.equal(r.reduce((n,t)=>n+t.cells.length,0),56);
 assert.ok(r[1].cells[1].text.includes('They'));assert.ok(r[2].cells[1].text.includes('$43 billion'));
 assert.equal(r[2].cells[1].text.split('Question:').length,2);
 assert.ok(r.flatMap(t=>t.cells).every(c=>!/^Figure/.test(c.text)&&c.rect[1]<c.inkRect[1]&&c.rect[3]>c.inkRect[3]));
 for(const p of require('./layout-dense-tables.fixture.json').pages.filter(p=>[44,45].includes(p.pageIndex)))assert.equal(G.textTables(p.chars,L.graphics(p.operatorList,p.viewBox).rules,L).length,0);
});
test('text table detector rejects absent rules and normal ruled prose even with three-rule geometry',()=>{
 const L=require('../addon/content/layout.js'),p=require('./layout-text-tables.fixture.json').pages[0];assert.deepEqual(G.textTables(p.chars,[],L),[]);
 const c=[...chars('This is a paragraph',20,40),...chars('Normal prose continues',20,20)];assert.deepEqual(G.textTables(c,[[0,60,200,60],[0,35,200,35],[0,0,200,0]],L),[]);
});
test('graphics panel header stays outside scroll body, current page filtering, dismiss and cleanup',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);app.graphicRuntime=()=>({});app.bindReaderCommand=(node,fn)=>{node.addEventListener('click',fn);return()=>node.removeEventListener('click',fn);};
 const dom=new JSDOM('<div id="outside"></div>');t.after(()=>dom.window.close());const doc=dom.window.document,viewer={currentPageNumber:53};const reader={_iframeWindow:dom.window,_internalReader:{_secondaryView:{_iframeWindow:{PDFViewerApplication:{pdfDocument:{},pdfViewer:viewer}}}}};
 // No separate window event target is required by this unit fixture.
 Object.assign(reader._internalReader._secondaryView._iframeWindow,{addEventListener(){},removeEventListener(){}});
 const s={reader,doc,rows:[{...row(),pageIndex:46},{...row(),id:'current',pageIndex:52}],cleanup:[],update(){},paint(){},control:{stopped:false,requests:new Set()}};
 app.mountGraphicPanel(s);assert.equal(s.panel.hidden,true);s.panel.hidden=false;s.update();assert.equal(s.panel.style.overflow,'hidden');assert.equal(s.body.style.overflow,'auto');assert.equal(s.body.contains(doc.querySelector('.pl-graphics-close')),false);
 assert.deepEqual([...doc.querySelectorAll('[data-row-id]')].map(n=>n.dataset.rowId),['current']);
 s.body.scrollTop=900;doc.querySelector('.pl-graphics-close').click();assert.equal(s.panel.hidden,true);s.update();assert.equal(s.panel.hidden,true);
 s.panel.hidden=false;dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(s.panel.hidden,true);
 s.panel.hidden=false;doc.querySelector('#outside').dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));assert.equal(s.panel.hidden,true);
 s.panel.hidden=false;viewer.currentPageNumber=47;s.update();assert.deepEqual([...doc.querySelectorAll('[data-row-id]')].map(n=>n.dataset.rowId),['g1']);
 s.allPages=true;s.update();assert.equal(doc.querySelectorAll('[data-row-id]').length,2);
 for(const clean of s.cleanup)clean();s.panel.hidden=false;dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(s.panel.hidden,false);
});
test('automatic text-table plan recovers skipped figure captions as separate bounded native regions',async t=>{
 const {app,C}=await createHarness(t),L=require('../addon/content/layout.js'),p=require('./layout-text-tables.fixture.json').pages[0];G.attach(app,C,L);
 const plan=app.detectGraphicRegions(p,p.operatorList);assert.equal(plan.regions.filter(r=>r.role==='text-table').length,6);const captions=plan.regions.filter(r=>r.role==='native-caption');assert.equal(captions.length,6);
 for(const r of captions){assert.match(r.cells[0].text,/^Figure G\./);assert.ok(plan.regions.filter(x=>x.role==='text-table').every(x=>L.intersection(r.rect,x.rect)===0));}
});

test('verified native background artifacts persist separately from source and target text',async t=>{const {app,C,IOUtils}=await createHarness(t);G.attach(app,C);const path=require('path');await IOUtils.makeDirectory(path.join(app.dir,'graphics'));const s={file:'graphics/native.json',fingerprint:'pdf',rows:[row()],nativeBackgrounds:new Map([['g1',{verified:true,fingerprint:'pdf',identity:'test',url:'data:image/png;base64,AA=='}]])};await app.saveGraphics(s);const d=JSON.parse(await IOUtils.readUTF8(path.join(app.dir,s.file)));assert.equal(d.nativeBackgrounds[0][0],'g1');assert.equal(d.rows[0].target,'准确率');});

test('fallback is invisible at rest but retains reason, tooltip and keyboard access',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);app.measureInPlaceText=()=>({fits:true});const dom=new JSDOM('<div></div><section></section>');t.after(()=>dom.window.close());const other={...row(),id:'g2',text:'Precision recall'},r={...row(),approved:false,background:null},s={rows:[r,other],replace:true,panel:dom.window.document.querySelector('section'),update(){}};
 const box=app.paintGraphicLabel(s,r,dom.window.document.querySelector('div'),{transform:transforms[0]});assert.equal(box.dataset.mode,'hotspot');assert.ok(box.dataset.fallback);assert.equal(box.style.borderBottom,'0px');assert.equal(box.tabIndex,0);assert.match(box.title,/已有译文/);
 const shown={...other,id:'g3',background:null,quad:G.quad([10,60,70,72])};s.rows.push(shown);const replaced=app.paintGraphicLabel(s,shown,dom.window.document.querySelector('div'),{transform:transforms[0]});assert.equal(replaced.dataset.mode,'replace');assert.equal(replaced.dataset.cover,'paper-fallback');assert.match(replaced.style.background,/^(?:#ffffff|rgb\(255, 255, 255\))$/);
});

test('audited closed node ignores only tiny exterior low-confidence punctuation padding',()=>{
 const r={...row(),flowNode:true,flowEvidence:{version:2,unexplainedInk:0}},noise={origin:'OCR',text:',',score:.6,review:true,target:'',quad:G.quad([40,31,44,38])};
 // A grazing speck of punctuation never owns the interior of a stored label,
 // audited or not: the stored translation must stay displayable.
 assert.equal(G.replacementReason(r,[noise]),'');assert.equal(G.replacementReason({...r,flowNode:false},[noise]),'');
 const word={...noise,text:'word',quad:G.quad([30,25,50,38])};assert.match(G.replacementReason({...r,flowNode:false},[word]),/相交/);
 for(const patch of [{text:'x'},{score:.98},{approved:true,target:'人工'}])assert.match(G.replacementReason(r,[{...word,...patch}]),/相交/);
});
test('graphic font framing stays near source size and hovering leaves no blue outline',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C);app.measureInPlaceText=()=>({fits:true});const dom=new JSDOM('<div class="page"></div><section></section>');t.after(()=>dom.window.close());const doc=dom.window.document,r={...row(),fontSize:8,flowNode:true},s={rows:[r],replace:true,panel:doc.querySelector('section'),update(){}};
 const b=app.paintGraphicLabel(s,r,doc.querySelector('div'),{transform:transforms[0]});assert.equal(b.dataset.mode,'replace');assert.equal(parseFloat(b.firstChild.style.fontSize)/4,8);b.dispatchEvent(new dom.window.Event('pointerenter'));assert.equal(b.style.outline,'none');b.dispatchEvent(new dom.window.Event('pointerleave'));assert.equal(b.style.outline,'none');
});

test('every stored translation on a real chart page is displayable after review gating was removed',()=>{
 const rows=require('./fixtures/page18-display/rows.json'),reasonFor=r=>G.replacementReason(r,rows.filter(x=>x.id!==r.id));
 const blocked=rows.filter(reasonFor),displayable=rows.filter(r=>!reasonFor(r));assert.equal(displayable.length,13);assert.equal(blocked.length,4);
 for(const r of blocked)assert.match(reasonFor(r),/译文与原文相同/,r.text);
 assert.ok(displayable.some(r=>r.rotation===270&&/Resilience/i.test(r.text)));
 const title=rows.find(r=>/^Three-layer energy infrastru/i.test(r.text));assert.ok(title&&title.review===true&&title.directionVerified===false);assert.equal(G.replacementReason(title,rows.filter(x=>x.id!==title.id)),'');
 const vertical=rows.filter(r=>r.rotation===270&&r.text.length>=18).filter(r=>!reasonFor(r));assert.ok(vertical.length>=2);assert.ok(vertical.every(r=>/Resilien/.test(r.text)));
 const identical=rows.filter(r=>r.target.replace(/\s/g,'')===r.text.replace(/\s/g,''));assert.ok(identical.length>=4);for(const r of identical)assert.match(G.replacementReason(r,[]),/译文与原文相同/);
});

// 原位擦除必须永远不透明：0.9 半透明白压在原文上就是"灰影 + 脏"，这是用户明确反馈过的问题。
test('in-place erasure never paints a translucent patch and prefers real background samples',async t=>{
  const {app,C}=await createHarness(t);G.attach(app,C);
  const p={width:60,height:12,matrix:[1,0,0,1,10,20]};
  const maskFill=app.graphicPatchFill({nativePatch:{url:'data:image/png;base64,AAA'},mask:null,row:{},canvas:null,p,cw:60,ch:12});
  assert.equal(maskFill.url,'data:image/png;base64,AAA');assert.equal(maskFill.cover,'native-removal');
  const glyph=app.graphicPatchFill({nativePatch:null,mask:'data:image/png;base64,BBB',row:{},canvas:null,p,cw:60,ch:12});
  assert.equal(glyph.cover,'glyph-mask');assert.equal(glyph.color,undefined);
  const sampled=app.graphicPatchFill({nativePatch:null,mask:null,row:{origin:'OCR'},canvas:null,p,cw:60,ch:12});
  assert.equal(sampled.color,'#ffffff');assert.equal(sampled.cover,'paper-fallback');
  // 存过的"纸面底色"不能压过现场取样：地图上那块白就是脏的来源。
  const stored=app.graphicPatchFill({nativePatch:null,mask:null,row:{background:'#ffffff'},canvas:null,p,cw:60,ch:12});
  assert.equal(stored.cover,'verified-paper');
  for(const fill of [maskFill,glyph,sampled])assert.ok(!/rgba\(/.test(String(fill.color||'')),'不能半透明');
  // 画布可读时按框内出现最多的颜色取样，并给出占比（近似底色要能被状态条报出来）。
  const canvas={width:200,height:120,getContext:()=>({getImageData:(x,y,w,h)=>({data:(()=>{const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d[i*4]=200;d[i*4+1]=50;d[i*4+2]=50;d[i*4+3]=255;}return d;})()})})};
  const real=app.graphicPatchFill({nativePatch:null,mask:null,row:{origin:'OCR'},canvas,p,cw:200,ch:120});
  assert.equal(real.cover,'sampled-flat');assert.equal(real.color,'#c83030');assert.equal(real.confidence,1);
  const half={width:200,height:120,getContext:()=>({getImageData:(x,y,w,h)=>({data:(()=>{const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){const on=(i%2)===0;d[i*4]=on?200:20;d[i*4+1]=on?50:20;d[i*4+2]=20;d[i*4+3]=255;}return d;})()})})};
  const mixed=app.graphicPatchFill({nativePatch:null,mask:null,row:{},canvas:half,p,cw:200,ch:120});
  assert.notEqual(mixed.cover,'translucent-fallback');
  assert.ok(mixed.url===undefined||/^data:image\/png/.test(String(mixed.url)),'渐变补丁要么是图，要么是不透明色');
  assert.equal(app.graphicSampleBackground(null,p,null,60,12),null);
});

// 用户报"小圆点点了就消失"：上一次显示时挂下的监听器会把新圆点当成外部点击删掉。
test('region badge survives hide/show cycles and opens its list on a real click',async t=>{
 const {app,C}=await createHarness(t);const L=require('../addon/content/layout.js');G.attach(app,C,L);
 const dom=new JSDOM('<body><div class="wrap"></div></body>');t.after(()=>dom.window.close());
 const doc=dom.window.document,reader={itemID:9,_iframeWindow:dom.window};
 app.readerButtons=new Map([[reader,new Set([{doc,wrap:doc.querySelector('.wrap')}])]]);
 const s={reader,doc,panel:{hidden:true},update(){},paint(){},lastRegionList:[{id:'a',pageIndex:0,text:'Shenyang',target:'沈阳'}]};
 app.showRegionBadge(s,'armed');app.hideRegionBadge(s);app.showRegionBadge(s,'busy');app.finishRegionBadge(s,0);
 const badge=s.badge;assert.ok(badge.root.isConnected,'圆点要显示出来');
 badge.root.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));
 assert.ok(s.badge&&s.badge.root===badge.root,'点圆点本身不能把它删掉');
 badge.root.dispatchEvent(new dom.window.Event('click',{bubbles:true}));
 assert.equal(badge.popover.style.display,'block','点一下要展开列表');
 assert.match(badge.popover.textContent,/Shenyang/);assert.match(badge.popover.textContent,/沈阳/);
 doc.body.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));
 assert.equal(s.badge,null,'点面板外面才该关闭');
});

// 用户要求：框选一次之后还能马上框第二次，后面的排队处理，不能干等。
test('region selections queue up instead of blocking the next box',async t=>{
 const {app,C}=await createHarness(t);const L=require('../addon/content/layout.js');G.attach(app,C,L);
 const dom=new JSDOM('<body><div class="wrap"></div></body>');t.after(()=>dom.window.close());
 const doc=dom.window.document,reader={itemID:11,_iframeWindow:dom.window};
 app.readerButtons=new Map([[reader,new Set([{doc,wrap:doc.querySelector('.wrap')}])]]);
 const order=[];let release=null;
 app.recognizeGraphicRegion=async(s,win,pv,canvas,pageIndex)=>{order.push('start'+pageIndex);await new Promise(r=>{release=r;});s.lastRegionList=[{id:'x'+pageIndex,pageIndex,text:'Shenyang',target:'沈阳'}];order.push('end'+pageIndex);};
 const s={reader,doc,paint(){},update(){},busy:false};app.graphicSessions.set(reader,s);t.after(()=>{app.hideRegionBadge(s);app.graphicSessions.delete(reader);});
 app.enqueueRegionJob(s,{pageIndex:3,rect:[0,0,10,10]});
 app.enqueueRegionJob(s,{pageIndex:8,rect:[0,0,10,10]});
 await new Promise(r=>setTimeout(r,10));
 assert.deepEqual(order,['start3'],'第二个框选不该等第一个跑完才入队');
 assert.equal(s.regionQueue.length,1);
 assert.equal(s.badge.root.dataset.state,'queued');
 assert.equal(s.badge.count.textContent,'2','圆点要显示排队数量');
 release();await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(order,['start3','end3','start8'],'第一个结束后第二个自动接着跑');
 release();await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(order,['start3','end3','start8','end8']);
 assert.equal(s.regionQueue.length,0);
 assert.equal(s.badge.root.dataset.state,'done');
 assert.equal(s.regionResults.length,2,'两次框选的结果都要留着');
 app.toggleRegionList(s);
 assert.match(s.badge.popover.textContent,/Shenyang/,'列表要点开才有内容');
});

// 菜单「清除翻译」：只清指定页 / 清全部，历史留档，正文退回待译。
test('clear translations restores originals per page and keeps a history record',async t=>{
 const {app,C}=await createHarness(t);const L=require('../addon/content/layout.js');G.attach(app,C,L);
 const rows=[{id:'a',pageIndex:3,text:'Cleaned coal',target:'精煤',quad:[[0,0],[10,0],[10,4],[0,4]]},{id:'b',pageIndex:8,text:'Xi an',target:'西安',quad:[[0,0],[10,0],[10,4],[0,4]]}];
 const painted=[];let saved=0;
 const reader={itemID:1};
 const g={rows,reader,pageIndex:8,paint(){painted.push('paint');},update(){},regionResults:[{pageIndex:3}],lastRegionList:[{pageIndex:3}]};
 const records=new Map([['r1',{target:'译文一',status:'done',edited:true,layout:{pageIndex:3}}],['r2',{target:'译文二',status:'done',layout:{pageIndex:8}}]]);
 const s={stage:'ready',records,update(){},paint(r){painted.push('rec:'+r.layout.pageIndex);}};
 app.graphicSessions.set(reader,g);app.inplace=new Map([[reader,s]]);
 app.graphicPageIndex=()=>3;app.saveGraphics=async()=>{saved++;};app.saveInPlaceCheckpoint=async()=>{saved++;};
 const page=await app.clearTranslations(reader,{pageIndex:3});
 assert.deepEqual({graphics:page.graphics,prose:page.prose},{graphics:1,prose:1});
 assert.equal(rows[0].target,'');assert.equal(rows[1].target,'西安','别的页不能动');
 assert.equal(rows[0].history[0].target,'精煤');assert.equal(rows[0].history[0].reason,'cleared-by-user');
 assert.equal(records.get('r1').target,'');assert.equal(records.get('r1').status,'pending');assert.equal(records.get('r2').target,'译文二');
 assert.equal(g.regionResults.length,0);assert.ok(saved>=2);
 const all=await app.clearTranslations(reader,{all:true});
 assert.equal(all.graphics,1);assert.equal(all.prose,1);
 assert.equal(rows[1].target,'');assert.equal(records.get('r2').target,'');
});
