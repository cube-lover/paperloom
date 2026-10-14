const {test}=require('node:test'),assert=require('node:assert/strict'),{createHarness}=require('./harness.cjs'),G=require('../addon/content/graphics.js'),L=require('../addon/content/layout.js');
const delay=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<300;i++){if(fn())return;await delay(5);}throw Error('timeout');}
function row(id,text='Accuracy'){return {id,text,origin:'PDF',selected:true,target:'',pageIndex:0,quad:G.quad([1,1,60,14])};}
test('graphics requests overlap up to configured concurrency, repeated labels share one result and edits stay local',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const s={rows:[row('1'),row('2'),row('3','Baseline'),row('4','Training'),{...row('5'),target:'人工校订',edited:true}],update(){},paint(){}};let running=0,peak=0,calls=0,saves=0;
 app.translate=async source=>{calls++;peak=Math.max(peak,++running);await delay(30);running--;return {text:'译文 '+source,warnings:[]};};app.saveGraphics=async()=>saves++;
 await app.translateGraphics(s,{rows:s.rows});assert.equal(calls,3);assert.equal(peak,3);assert.equal(saves,3);assert.equal(s.rows[4].target,'人工校订');assert.equal(s.rows[0].target,s.rows[1].target);assert.equal(s.lastTranslation.done,4);
});
test('global network semaphore caps combined callers and cancels waiters without leaking slots',async t=>{
 const {app}=await createHarness(t);const cfg={...app.config,concurrency:2},control={requests:new Set()};const a=await app.acquireTranslationSlot(cfg,control),b=await app.acquireTranslationSlot(cfg,control);let acquired=false;
 const c=app.acquireTranslationSlot(cfg,control).then(release=>{acquired=true;return release;});await delay(10);assert.equal(acquired,false);a();const release=await c;assert.equal(app.networkSlots.used,2);b();release();assert.equal(app.networkSlots.used,0);
 const x=await app.acquireTranslationSlot({...cfg,concurrency:1},control),cancel={stopped:false};const p=app.acquireTranslationSlot({...cfg,concurrency:1},cancel);cancel.stopped=true;await assert.rejects(p,/暂停/);x();assert.equal(app.networkSlots.used,0);assert.equal(app.networkSlots.waiters.length,0);
});
test('graphics pause discards late concurrent results and does not start the tail of the queue',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const s={rows:Array.from({length:8},(_,i)=>row(String(i),'Label '+i)),update(){},paint(){}};let calls=0;app.saveGraphics=async()=>{};
 app.translate=async()=>{calls++;await delay(15);s.control.stopped=true;return {text:'late'};};await app.translateGraphics(s,{rows:s.rows});assert.equal(calls,3);assert.ok(s.rows.every(r=>!r.target));assert.equal(s.busy,false);
});
test('article graphics runs full document current page first, without opening the panel, and respects pause/disposal',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);let living=true;const article={reader:{},pdf:{numPages:3},cfg:{translateGraphics:true,confirmBeforeSend:false},graphicsConsent:true,paused:true,cleanup:[],alive:()=>living};
 app.graphicPageIndex=()=>1;const pages=[];app.autoTranslateGraphics=async(r,opts)=>{pages.push(opts.pageIndex);assert.equal(opts.article,article);await delay(10);};
 const job=app.bindArticleGraphics(article);job.schedule();await delay(150);assert.deepEqual(pages,[]);article.paused=false;job.schedule();await until(()=>job.completed.size===3);assert.deepEqual(pages,[1,0,2]);assert.equal(app.graphicSessions.size,0);
 living=false;for(const f of article.cleanup)f();assert.equal(job.disposed,true);assert.equal(job.timer,null);
});
test('recognition cache avoids repeated native/OCR work but explicit recheck remains available; automatic panel stays hidden',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const panel={hidden:true},s={rows:[],panel,update(){},paint(){}};
 const win={PDFViewerApplication:{pdfDocument:{numPages:1,getPageData:async()=>({chars:[],viewBox:[0,0,100,100]}),getPage:async()=>({})},pdfViewer:{currentPageNumber:1,getPageView:()=>({renderingState:3,viewport:{transform:[1,0,0,1,0,0]},canvas:{width:100}})}}};const reader={_internalReader:{_secondaryView:{_iframeWindow:win}}};s.reader=reader;
 app.graphicSession=async()=>s;app.readOperatorGeometry=async()=>({});app.detectGraphicRegions=()=>({regions:[{role:'table',rect:[0,0,80,80]}],rules:[]});let recognized=0;
 app.recognizeGraphicRegion=async()=>recognized++;app.saveGraphics=async()=>{};
 await app.autoTranslateGraphics(reader,{translate:false});await app.autoTranslateGraphics(reader,{translate:false});assert.equal(recognized,1);assert.equal(panel.hidden,true);
 await app.autoTranslateGraphics(reader,{translate:false,force:true});assert.equal(recognized,2);
});
test('article consent is required once, not separately for every figure, and restored paused sessions send nothing',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const article={reader:{},pdf:{numPages:1},cfg:{translateGraphics:true,confirmBeforeSend:true},graphicsConsent:false,paused:false,cleanup:[],alive:()=>true};app.graphicPageIndex=()=>0;let calls=0;app.autoTranslateGraphics=async()=>calls++;
 const job=app.bindArticleGraphics(article);job.schedule();await delay(180);assert.equal(calls,0);article.graphicsConsent=true;job.schedule();await until(()=>calls===1);for(const f of article.cleanup)f();
});

test('offscreen graphics use non-animation-frame rendering so hidden reader tabs make progress',async t=>{const {app,C}=await createHarness(t);G.attach(app,C,L);let renders=0;const canvas={width:0,height:0,getContext:()=>({})};const page={getViewport:()=>({width:100,height:100,transform:[1,0,0,1,0,0]}),render:args=>{assert.equal(args.intent,'print');renders++;return {promise:Promise.resolve(),cancel(){}}}};const win={Object,document:{createElement:()=>canvas},PDFViewerApplication:{pdfDocument:{numPages:2,getPageData:async()=>({chars:[],viewBox:[0,0,100,100]}),getPage:async()=>page},pdfViewer:{currentPageNumber:1,getPageView:()=>null}}};const reader={_internalReader:{_secondaryView:{_iframeWindow:win}}},s={rows:[],update(){},paint(){}};app.graphicSession=async()=>s;app.readOperatorGeometry=async()=>({});app.detectGraphicRegions=()=>({regions:[{role:'table',rect:[0,0,80,80]}],rules:[]});app.recognizeGraphicRegion=async()=>{};await app.autoTranslateGraphics(reader,{translate:false,pageIndex:1,background:true});assert.equal(renders,1);assert.equal(s.busy,false);assert.equal(canvas.width,0);});
