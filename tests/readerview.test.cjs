const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const C=require('../addon/content/core.js'),L=require('../addon/content/layout.js'),InPlace=require('../addon/content/inplace.js');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await delay(5);}throw new Error('Timed out');}
function pageData(index,text='This is a paragraph.') {
 let x=10;const chars=[...text].map((c,i)=>{const ch={c,rect:[x,770,x+5,780],fontSize:10,baseline:772};x+=5;if(i===text.length-1){ch.lineBreakAfter=true;ch.paragraphBreakAfter=true;}return ch;});
 return {pageIndex:index,viewBox:[0,0,600,800],chars};
}
function setup(t,config={},count=4){
 const dom=new JSDOM('<div id="viewer"></div>');t.after(()=>dom.window.close());
 const app={config:C.validateConfig({concurrency:2,...config}),active:new Map(),confirm:()=>true,stopped:false};InPlace.attach(app,C,L);require('../addon/content/reader-progress.js').attach(app);
 const win=dom.window,events=new Map(),views=Array.from({length:count},()=>({viewport:{transform:[1,0,0,-1,0,800]}}));
 const pdf={numPages:count,getOutline:async()=>[],getPageData:async({pageIndex})=>pageData(pageIndex),getPage:async i=>({getOperatorList:async()=>({fnArray:[],argsArray:[]})})};
 win.PDFViewerApplication={pdfDocument:pdf,pdfViewer:{getPageView:i=>views[i]},eventBus:{on:(name,fn)=>events.set(name,fn),off:name=>events.delete(name)}};
 const reader={itemID:12,_internalReader:{splitType:'vertical',_secondaryView:{_iframeWindow:win}}};
 t.after(()=>app.clearInPlace(reader));
 function page(number){const el=win.document.createElement('div');el.className='page';el.dataset.pageNumber=number;el.style.position='relative';
 const layer=win.document.createElement('div');layer.className='textLayer';const span=win.document.createElement('span');span.textContent='DOM text deliberately unrelated to PDF source';layer.appendChild(span);el.appendChild(layer);win.document.getElementById('viewer').appendChild(el);return el;}
 return {app,reader,win,page,events,pdf,views};
}
test('printed contents creates no placeholder or translation call while real captions enter the queue',async t=>{
 const gpt=require('./layout-gpt3.fixture.json');
 const {app,page,reader,pdf,win}=setup(t,{},gpt.pages.length);
 pdf.getPageData=async({pageIndex})=>gpt.pages[pageIndex];pdf.getOutline=async()=>gpt.outline;
 pdf.getPage=async n=>({getOperatorList:async()=>gpt.pages[n-1].operatorList});
 const contents=page(2),calls=[];
 const s=await app.translateInPlace(reader,{translateBlock:async text=>{calls.push(text);return {text:'离线队列样本'};}});
 assert.equal(calls.length,s.records.size);assert.equal(contents.querySelectorAll('.pl-inplace').length,0);
 assert.ok([...s.records.values()].every(r=>r.layout.pageIndex!==1));
 const body=page(3);s.rescan();await until(()=>[...s.records.values()].filter(r=>r.layout.pageIndex===2).every(r=>r.status==='done'));
 await until(()=>body.querySelectorAll('.pl-inplace[data-state=done]').length===7);
 const caption=calls.filter(t=>t.startsWith('Figure 1.1:'));assert.equal(caption.length,1);assert.match(caption[0],/within a single sequence\.$/);
 assert.equal(body.querySelectorAll('.pl-inplace').length,7);assert.ok(!win.document.querySelector('.pl-inplace[data-role=contents]'));
});
test('paused update restoration preserves exact-source translations without prompting or sending',async t=>{
 const {app,page,reader,pdf}=setup(t,{confirmBeforeSend:true},2);page(1);page(2);let calls=0;
 pdf.getPageData=async({pageIndex})=>pageData(pageIndex,pageIndex===0?'This is a paragraph.':'Newly eligible text.');
 app.confirm=()=>{throw Error('No send confirmation needed for paused restore');};
 const s=await app.translateInPlace(reader,{startPaused:true,restoredRecords:[{id:'old-id',text:'This is a paragraph.',target:'保留人工校订',status:'done',edited:true},{text:'Unrelated source',target:'不应匹配',status:'done'}],translateBlock:async()=>{calls++;return {text:'新译文'};}});
 assert.equal(calls,0);assert.equal(s.paused,true);const rs=[...s.records.values()];assert.equal(rs[0].target,'保留人工校订');assert.equal(rs[0].edited,true);assert.equal(rs[1].status,'pending');
 app.confirm=()=>true;app.pauseInPlace(reader,false);await until(()=>rs[1].status==='done');assert.equal(calls,1);
});
test('host page wrapper is unwrapped and only geometry is retained',async t=>{
 const {app}=setup(t);const data={fnArray:[10,12,91,85,44,11],argsArray:[[],[2,0,0,2,10,20],[22,[],new Float32Array([0,0,100,1])],['private-image-bytes'],['private-text'],[]]};
 const page={wrappedJSObject:{getOperatorList:async()=>data}};
 const result=await app.readOperatorGeometry(page);
 assert.deepEqual(result.fnArray,[10,12,91,85,11]);assert.deepEqual(result.argsArray[2],[22,[],[0,0,100,1]]);
 assert.ok(!JSON.stringify(result).includes('private'));await assert.rejects(()=>app.readOperatorGeometry({}),/算子/);
});
test('PDF EventBus uses the same exported callback for registration and disposal',async t=>{
 const {app,win}=setup(t);const cleanup=[],fn=()=>{},sentinel=()=>{};let on,off;
 win.PDFViewerApplication.eventBus={on:(n,f)=>on=f,off:(n,f)=>off=f};
 const previous=global.Components;global.Components={utils:{exportFunction:(f,w)=>{assert.equal(f,fn);assert.equal(w,win);return sentinel;}}};
 try{app.bindPdfEvent(win,'test',fn,cleanup);cleanup[0]();assert.equal(on,sentinel);assert.equal(off,sentinel);}finally{if(previous)global.Components=previous;else delete global.Components;}
});
test('source is structured PDF, not DOM; escaped literal output and PDF matrix projection',async t=>{
 const {app,page,reader}=setup(t);const el=page(1);let source;
 const s=await app.translateInPlace(reader,{translateBlock:async text=>{source=text;return {text:'<img src=x onerror=alert(1)>中文'};}});
 assert.equal(source,'This is a paragraph.');const box=el.querySelector('.pl-inplace');assert.equal(box.querySelector('img'),null);assert.match(box.textContent,/<img/);
 assert.match(box.style.transform,/matrix\(1,0,0,1,10,/);assert.equal(s.layout.pages.length,4);
});
test('lazy pages share one queue and progressive pending placeholders',async t=>{
 const {app,page,reader,win}=setup(t);page(1);let running=0,max=0;const releases=[];
 const work=app.translateInPlace(reader,{translateBlock:async()=>{running++;max=Math.max(max,running);await new Promise(r=>releases.push(r));running--;return {text:'逐段完成'};}});
 await until(()=>releases.length===2);page(2);page(3);page(4);
 await until(()=>win.document.querySelectorAll('.pl-inplace').length===4);assert.equal(releases.length,2);
 assert.equal(win.document.querySelectorAll('[data-state=pending]').length,4);releases[0]();
 await until(()=>win.document.querySelectorAll('[data-state=done]').length===1);assert.ok(max<=2);
 app.clearInPlace(reader);for(const r of releases)r();await work;
});
test('redraw, zoom and 90-degree rotation reuse records without reparsing or translating',async t=>{
 const {app,page,reader,events,views,pdf}=setup(t);const el=page(1);let calls=0,parses=0,original=pdf.getPageData;
 pdf.getPageData=async a=>{parses++;return original(a);};
 const s=await app.translateInPlace(reader,{translateBlock:async()=>{calls++;return {text:'翻译完成'};}});
 el.querySelector('.pl-inplace').remove();events.get('textlayerrendered')();await until(()=>el.querySelector('.pl-inplace'));assert.equal(calls,4);
 views[0].viewport.transform=[0,2,2,0,0,0];events.get('rotationchanging')();await until(()=>el.querySelector('.pl-inplace').style.transform.startsWith('matrix(0,2,-2,0,'));
 assert.equal(calls,4);assert.equal(parses,4);const replacement=page(1);el.remove();s.rescan();await until(()=>replacement.querySelector('.pl-inplace'));assert.equal(replacement.querySelector('.pl-inplace').textContent,'翻译完成');
 app.clearInPlace(reader);assert.equal(events.size,0);
});
test('clear aborts requests and rejects late painting',async t=>{
 const {app,page,reader,win}=setup(t,{concurrency:1});page(1);let finish,aborted=0;
 const work=app.translateInPlace(reader,{translateBlock:async(text,cfg,control)=>{control.requests.add({abort(){aborted++;}});await new Promise(r=>finish=r);return {text:'late'};}});
 await until(()=>finish);app.clearInPlace(reader);assert.equal(aborted,1);finish();await work;await delay(5);
 assert.equal(win.document.querySelector('.pl-inplace'),null);assert.equal(app.active.size,0);assert.equal(win.document.querySelector('.pl-inplace-controls'),null);
});
test('cancel during iframe start and parsing never sends a request',async t=>{
 const {app,page,reader,win,pdf}=setup(t);page(1);let resume,calls=0;
 app.ensureSecondaryPdfWin=()=>new Promise(r=>resume=()=>r(win));let work=app.translateInPlace(reader,{translateBlock:async()=>{calls++;return {text:'unexpected'};}});
 app.clearInPlace(reader);resume();await work;assert.equal(calls,0);
 app.ensureSecondaryPdfWin=async()=>win;pdf.getPageData=()=>new Promise(r=>resume=()=>r(pageData(0)));
 work=app.translateInPlace(reader,{translateBlock:async()=>{calls++;return {text:'unexpected'};}});await until(()=>app.inplace?.size===1);await delay(5);
 app.clearInPlace(reader);resume();await work;assert.equal(calls,0);
});
test('missing graphic geometry aborts before translating or covering the original',async t=>{
 const {app,page,reader,win,pdf}=setup(t);page(1);let calls=0;pdf.getPage=async()=>({});
 await assert.rejects(()=>app.translateInPlace(reader,{translateBlock:async()=>{calls++;return {text:'x'};}}),/图形解析/);
 assert.equal(calls,0);assert.equal(app.inplace.size,0);assert.equal(win.document.querySelector('.pl-inplace'),null);
});
test('clear releases all ownership when a PDF document has already died',async t=>{
 const {app,page,reader}=setup(t);page(1);const s=await app.translateInPlace(reader,{translateBlock:async()=>({text:'结果'})});
 s.doc={querySelectorAll(){throw Error('dead object');},querySelector(){throw Error('dead object');}};
 assert.doesNotThrow(()=>app.clearInPlace(reader));assert.equal(app.inplace.size,0);assert.equal(app.inplaceTokens.size,0);assert.equal(app.active.size,0);
});
test('snapshot preserves PDF page mapping, incomplete status and edits without duplicate jobs',async t=>{
 const {app,page,reader}=setup(t);page(1);const s=await app.translateInPlace(reader,{translateBlock:async()=>({text:'结果'})});
 app.jobs=[];let saved=0;app.persist=async()=>saved++;app.emit=()=>{};app.createJob=async(text,metadata)=>{const job={id:'snapshot-1',...metadata};app.jobs.push(job);return job;};
 const r=[...s.records.values()][0];r.edited=true;r.target='<literal>';
 let job=await app.snapshotInPlace(reader);assert.equal(job.status,'done');assert.equal(job.segments.length,4);assert.equal(job.segments[0].manual,true);assert.equal(job.segments[0].target,'<literal>');assert.equal(job.segments[1].page,2);assert.equal(job.segments[1].status,'done');
 r.target='再校订';assert.equal(await app.snapshotInPlace(reader),job);assert.equal(job.segments[0].target,'再校订');assert.equal(app.jobs.length,1);assert.equal(saved,2);
});
test('declined consent creates no split, session or requests',async t=>{
 const {app,reader}=setup(t,{confirmBeforeSend:true});app.confirm=()=>false;app.ensureSecondaryPdfWin=()=>{throw Error('Unexpected split');};await app.translateInPlace(reader);assert.equal(app.inplace?.size||0,0);
});
test('failure keeps original; retry targets only failed records',async t=>{
 const {app,page,reader}=setup(t);const el=page(1);let calls=0;
 const s=await app.translateInPlace(reader,{translateBlock:async()=>{if(++calls===1)throw Error('fake-secret');return {text:'成功'};}});
 const box=el.querySelector('.pl-inplace');assert.equal(box.dataset.state,'error');assert.equal(box.style.background,'transparent');assert.ok(!box.title.includes('secret'));
 app.retryInPlace(reader);await until(()=>s.records.values().next().value.status==='done');assert.equal(calls,5);assert.equal(box.textContent,'成功');
});
test('pause stops dispatch, resume completes queue, original toggle keeps results',async t=>{
 const {app,page,reader,win}=setup(t,{concurrency:1});page(1);page(2);const releases=[];
 const work=app.translateInPlace(reader,{translateBlock:async()=>{await new Promise(r=>releases.push(r));return {text:'结果'};}});
 await until(()=>releases.length===1);app.pauseInPlace(reader);releases[0]();await work;assert.equal(releases.length,1);
 app.toggleInPlace(reader);assert.equal(win.getComputedStyle(win.document.querySelector('.pl-inplace')).display,'none');app.toggleInPlace(reader);
 app.pauseInPlace(reader,false);await until(()=>releases.length===2);releases[1]();await until(()=>app.inplaceStats(reader).done===2);
});
test('overflow shrinks then still shows the translation (never leaves the original), no scrollbar or growing panel',async t=>{
 const {app,page,reader}=setup(t);const el=page(1);await app.translateInPlace(reader,{translateBlock:async()=>({text:'过长译文'})});
 const box=el.querySelector('.pl-inplace'),body=box.firstChild,h=box.style.height;
 box.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:12,width:100,height:12});body.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:300,width:100,height:300});
 Object.defineProperty(body,'scrollHeight',{get:()=>300});Object.defineProperty(box,'clientHeight',{get:()=>12});
 assert.equal(app.fitInPlaceText(box,body,10),false);assert.equal(box.dataset.overflow,'true');
 // Translation stays visible and opaque — the original English must never be left showing.
 assert.equal(body.style.visibility,'visible');assert.notEqual(box.style.background,'transparent');assert.notEqual(body.style.background,'transparent');assert.ok(box.style.background);
 // An unresolved fit is explicit; no opaque spill across neighbours and no scrollbar.
 assert.equal(box.style.overflow,'hidden');assert.equal(box.style.height,h);assert.match(box.title,/框外部分未显示/);
 // Font shrinks within a bounded floor (0.6×base), not an unbounded loop.
 assert.equal(body.style.fontSize,'7px');
});
test('fractional or CJK glyph clipping is not accepted by a one-pixel tolerance',async t=>{
 const {app,page,reader}=setup(t);const el=page(1);await app.translateInPlace(reader,{translateBlock:async()=>({text:'摘要'})});
 const box=el.querySelector('.pl-inplace'),body=box.firstChild;
 const rect=(bottom)=>({left:0,top:0,right:100,bottom,width:100,height:bottom});
 box.getBoundingClientRect=()=>rect(12);body.getBoundingClientRect=()=>rect(12);
 body.ownerDocument.createRange=()=>({selectNodeContents(){},getBoundingClientRect:()=>rect(13.4),detach(){}});
 Object.defineProperty(body,'scrollHeight',{get:()=>12});Object.defineProperty(box,'clientHeight',{get:()=>12});
 assert.equal(body.style.minHeight,'');assert.equal(app.measureInPlaceText(box,body).fits,false);
 assert.equal(app.fitInPlaceText(box,body,10),false);assert.equal(box.dataset.overflow,'true');
});
test('sync includes page, XY and percentage scale with feedback suppression',async t=>{
 const {app,reader,win}=setup(t),events=new Map(),calls=[];
 const primary={PDFViewerApplication:{eventBus:{on:(k,f)=>events.set(k,f),off:k=>events.delete(k)},pdfViewer:{scrollPageIntoView:a=>calls.push(['primary',a])}},addEventListener(){},removeEventListener(){}};
 reader._internalReader._primaryView={_iframeWindow:primary};win.PDFViewerApplication.pdfViewer.scrollPageIntoView=a=>calls.push(['secondary',a]);
 const s={reader,win,alive:()=>true,syncEnabled:true,cleanup:[]};app.bindInPlaceSync(s);
 events.get('updateviewarea')({location:{pageNumber:2,left:12,top:234,scale:150}});
 await until(()=>calls.length===1);assert.equal(win.PDFViewerApplication.pdfViewer.currentScaleValue,1.5);assert.deepEqual(calls[0][1].destArray,[null,{name:'XYZ'},12,234,null]);
 win.PDFViewerApplication.eventBus && assert.equal(calls.length,1);for(const f of s.cleanup)f();assert.equal(events.size,0);
});
test('observer setup failure cleans session and tokens',async t=>{
 const {app,page,reader,win}=setup(t);page(1);win.MutationObserver=class{observe(){throw Error('observer failed');}disconnect(){}};
 await assert.rejects(()=>app.translateInPlace(reader),/observer failed/);assert.equal(app.inplace.size,0);assert.equal(app.inplaceStarting.size,0);
});
test('reentering a hidden session reveals it without translating again',async t=>{
 const {app,page,reader,win}=setup(t);page(1);let calls=0;
 const s=await app.translateInPlace(reader,{translateBlock:async()=>{calls++;return {text:'结果'};}});
 app.toggleInPlace(reader);assert.equal(win.document.querySelector('#viewer').classList.contains('pl-hide-translations'),true);
 assert.equal(await app.translateInPlace(reader),s);assert.equal(calls,4);assert.equal(win.document.querySelector('#viewer').classList.contains('pl-hide-translations'),false);
});
test('closing an already destroyed reader panel does not break shutdown',async t=>{
 const {createHarness}=require('./harness.cjs'),{app}=await createHarness(t);
 const Reader=require('../addon/content/readerview.js');Reader.attach(app,C);const r={get _iframeWindow(){throw Error('dead object');}};
 app.readerPanels=new Map([[r,{open:true}]]);assert.doesNotThrow(()=>app.closeReaderPanel(r));assert.equal(app.readerPanels.size,0);
});
test('app shutdown invokes in-place and panel cleanup',async t=>{
 const {createHarness}=require('./harness.cjs');const {app}=await createHarness(t);const reader={};let cleared=0,closed=0;
 app.inplace=new Map([[reader,{}]]);app.readerPanels=new Map([[reader,{}]]);app.clearInPlace=r=>{cleared++;app.inplace.delete(r);};app.closeReaderPanel=()=>{closed++;};
 await app.shutdown();assert.equal(cleared,1);assert.equal(closed,1);
});
test('unchanged event storms and visibility toggles never remeasure completed paragraphs',async t=>{
 const {app,page,reader,win,views}=setup(t);const el=page(1);let fits=0;const fit=app.fitInPlaceText;app.measureInPlaceText=()=>({fits:true,measurable:true});
 app.fitInPlaceText=function(...args){fits++;return fit.apply(this,args);};
 const s=await app.translateInPlace(reader,{translateBlock:async()=>({text:'译文'})});const before=fits,rendered=s.renderCount;
 for(let i=0;i<100;i++)s.rescan();await delay(30);assert.equal(fits,before);assert.equal(s.renderCount,rendered);
 for(let i=0;i<50;i++)app.toggleInPlace(reader);assert.equal(fits,before);assert.equal(win.getComputedStyle(el.querySelector('.pl-inplace')).display,'block');
 views[0].viewport.transform=[2,0,0,-2,0,1600];s.rescan();await until(()=>el.querySelector('.pl-inplace').style.transform.startsWith('matrix(2,'));assert.equal(fits,before);
});
test('paint work yields in batches and controls live outside the clipped toolbar',async t=>{
 const {app,page,reader,win,pdf}=setup(t,{},1);const toolbar=win.document.createElement('div');toolbar.className='toolbar';toolbar.style.overflow='hidden';win.document.body.prepend(toolbar);reader._iframeWindow=win;
 pdf.getPageData=async()=>({pageIndex:0,viewBox:[0,0,600,800],chars:Array.from({length:30},(_,i)=>pageData(0,'Paragraph number '+i+'.').chars.map(c=>({...c,rect:[c.rect[0],c.rect[1]-i*20,c.rect[2],c.rect[3]-i*20],baseline:c.baseline-i*20}))).flat()});page(1);
 const work=app.translateInPlace(reader,{translateBlock:()=>new Promise(()=>{})});
 await until(()=>app.inplace?.get(reader)?.renderCount>=30);const s=app.inplace.get(reader);assert.ok(s.renderBatches>=8);assert.equal(win.document.querySelector('.pl-inplace-controls').parentNode,win.document.body);
 app.clearInPlace(reader);await work;
});

test('queue prioritizes visible paragraphs over offscreen paragraphs on same page and nearby pages',async t=>{
 const {app,win,views}=setup(t,{},4),v=win.PDFViewerApplication.pdfViewer;
 v.currentPageNumber=3;v.container={getBoundingClientRect:()=>({left:0,top:0,right:600,bottom:300,width:600,height:300})};
 const rect=top=>({left:0,top,right:600,bottom:top+800,width:600,height:800});
 for(let i=0;i<4;i++){views[i].div={getBoundingClientRect:()=>rect((i-2)*820-400)};views[i].viewport.width=600;views[i].viewport.height=800;}
 const record=(id,p,y)=>({id,layout:{pageIndex:p,rect:[10,y,200,y+12],sourceRange:[y,y+1]}});
 const old=record('old',0,700),sameAbove=record('same-above',2,700),visible=record('visible',2,200),near=record('near',3,700);
 const s={win,queue:[old,sameAbove,near,visible]};app.prioritizeInPlace(s);
 assert.deepEqual(s.queue.map(r=>r.id),['visible','same-above','near','old']);
});
test('visible-page priority responds to navigation before next dispatch and reuses completed records',async t=>{
 const {app,page,reader,pdf,win,events}=setup(t,{concurrency:1},3);page(1);page(2);page(3);
 pdf.getPageData=async({pageIndex})=>pageData(pageIndex,'Paragraph '+(pageIndex+1)+'.');
 const v=win.PDFViewerApplication.pdfViewer;v.currentPageNumber=3;const calls=[],releases=[];
 const work=app.translateInPlace(reader,{translateBlock:async text=>{calls.push(text);await new Promise(r=>releases.push(r));return {text:'译文'};}});
 await until(()=>calls.length===1);assert.equal(calls[0],'Paragraph 3.');
 v.currentPageNumber=1;events.get('updateviewarea')();releases[0]();await until(()=>calls.length===2);assert.equal(calls[1],'Paragraph 1.');
 app.pauseInPlace(reader,true);releases[1]();await work;
 v.currentPageNumber=3;events.get('updateviewarea')();await delay(50);assert.equal(calls.length,2);
 const s=app.inplace.get(reader);assert.equal(s.queue.length,1);assert.equal(s.queue[0].text,'Paragraph 2.');
 app.pauseInPlace(reader,false);await until(()=>calls.length===3);releases[2]();await until(()=>app.inplaceStats(reader).done===3);
 assert.equal(new Set(calls).size,3);
});
test('left-pane reading position can rank waiting translations independently of right pane',async t=>{
 const {app,win}=setup(t);win.PDFViewerApplication.pdfViewer.currentPageNumber=1;
 const primary={PDFViewerApplication:{pdfViewer:{currentPageNumber:4}}};
 const s={win,priorityWin:primary,queue:[0,3,1,2].map(p=>({layout:{pageIndex:p,rect:[0,0,10,10]}}))};
 app.prioritizeInPlace(s);assert.deepEqual(s.queue.map(r=>r.layout.pageIndex),[3,2,1,0]);
});

test('unsynchronized left-pane navigation queues its page even when right pane has no DOM for it',async t=>{
 const {app,win,reader,page,pdf}=setup(t,{concurrency:1},4);page(1);const listeners=new Map(),primaryEvents=new Map();
 const primary={PDFViewerApplication:{pdfViewer:{currentPageNumber:1},eventBus:{on:(n,f)=>primaryEvents.set(n,f),off:n=>primaryEvents.delete(n)}},
  addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 reader._internalReader._primaryView={_iframeWindow:primary};
 pdf.getPageData=async({pageIndex})=>pageData(pageIndex,'Page '+(pageIndex+1)+'.');let calls=[];
 const releases=[];const work=app.translateInPlace(reader,{translateBlock:async text=>{calls.push(text);await new Promise(r=>releases.push(r));return {text:'译文'};}});
 await until(()=>calls.length===1);const s=app.inplace.get(reader);s.syncEnabled=false;primary.PDFViewerApplication.pdfViewer.currentPageNumber=4;listeners.get('wheel')();primaryEvents.get('updateviewarea')();
 await delay(45);releases[0]();await until(()=>calls.length===2);assert.equal(calls[1],'Page 4.');assert.equal(s.priorityWin,primary);
 assert.equal(win.document.querySelector('.page[data-page-number="4"]'),null);app.pauseInPlace(reader,true);releases[1]();await work;
});
test('restoration preserves different page corrections for identical source and never clones a legacy result',async t=>{
 const {app,page,reader,pdf}=setup(t,{},3);page(1);page(2);page(3);let calls=0;
 const s=await app.translateInPlace(reader,{startPaused:true,restoredRecords:[
  {text:'This is a paragraph.',target:'第一页校订',status:'done',pageIndex:0,edited:true},
  {text:'This is a paragraph.',target:'第二页校订',status:'done',pageIndex:1,edited:true},
  {text:'Removed table',target:'旧表格译文',status:'done',pageIndex:2}
 ],translateBlock:async()=>{calls++;return {text:'test'};}});
 assert.deepEqual([...s.records.values()].map(r=>r.target),['第一页校订','第二页校订','']);assert.equal(calls,0);assert.equal(s.unmatchedRestoredRecords.length,1);
 app.clearInPlace(reader);
 const legacy=await app.translateInPlace(reader,{startPaused:true,restoredRecords:[{text:'This is a paragraph.',target:'旧版本归档',status:'done'}]});
 assert.equal([...legacy.records.values()].filter(r=>r.target).length,1);
});
