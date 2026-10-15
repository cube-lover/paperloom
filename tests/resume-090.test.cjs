const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const {createHarness}=require('./harness.cjs'),G=require('../addon/content/graphics'),L=require('../addon/content/layout');
const tick=()=>new Promise(r=>setTimeout(r,15));
async function setup(t){const h=await createHarness(t);require('node:vm').runInContext(require('node:fs').readFileSync(require.resolve('../addon/content/graphics.js'),'utf8'),h.context);h.context.PaperLoomGraphics.attach(h.app,h.C,L);return h;}
function ui(t,app,Zotero){
 const main=new JSDOM('<body><div id="mainKeyset"></div><input></body>'),one=new JSDOM('<body><div class="toolbar"></div><input></body>'),two=new JSDOM('<body><div class="toolbar"></div></body>');
 t.after(()=>{for(const views of [...app.readerButtons?.values()||[]])for(const v of [...views])v.dispose();app.removeRegionKeyHandler();app.regionKeyset?.remove();main.window.close();one.window.close();two.window.close();});
 const readers=[one,two].map((d,i)=>({itemID:i+1,tabID:'tab'+i,_iframeWindow:d.window}));
 Zotero.getMainWindow=()=>main.window;Zotero.Reader._readers=[...readers];main.window.Zotero_Tabs={selectedID:'tab1'};
 for(const r of readers)app.buildReaderButton(r._iframeWindow.document,r,n=>r._iframeWindow.document.querySelector('.toolbar').append(n));
 return {main,one,two,readers};
}
test('clear submenu activates on release, can be used twice, and ignores right-click',async t=>{
 const {app,Zotero}=await setup(t),{one}=ui(t,app,Zotero),d=one.window.document;let calls=0;
 app.clearTranslations=async()=>{calls++;return {pageIndex:0,graphics:1,prose:1};};app.graphicPageIndex=()=>0;
 const open=()=>{d.querySelector('.pl-menu-button').click();d.querySelector('.pl-reader-menu [aria-haspopup="true"]').dispatchEvent(new one.window.MouseEvent('mouseenter'));};
 const b=d.querySelector('[data-action="clear-page"]');
 open();b.dispatchEvent(new one.window.MouseEvent('pointerdown',{bubbles:true,button:0}));await tick();assert.equal(calls,0,'press/drag-cancel must not clear');
 b.click();await tick();assert.equal(calls,1);
 open();b.click();await tick();assert.equal(calls,2,'second invocation must run');
 open();b.dispatchEvent(new one.window.MouseEvent('pointerdown',{bubbles:true,button:2}));await tick();assert.equal(calls,2);
});
test('main-window shortcut chooses selected tab, ignores inputs/repeats, and honors disabled preference',async t=>{
 const {app,Zotero}=await setup(t),{main,readers}=ui(t,app,Zotero);const fired=[];app.selectGraphicRegion=async r=>fired.push(r.itemID);
 const key=(target,extra={})=>{app.regionShortcutAt=0;target.dispatchEvent(new main.window.KeyboardEvent('keydown',{key:'r',code:'KeyR',ctrlKey:true,bubbles:true,cancelable:true,...extra}));};
 key(main.window.document);await tick();assert.deepEqual(fired,[2]);
 key(main.window.document.querySelector('input'));key(main.window.document,{repeat:true});await tick();assert.deepEqual(fired,[2]);
 main.window.Zotero_Tabs.selectedID='zotero-pane';key(main.window.document);await tick();assert.deepEqual(fired,[2],'library tab must not act on hidden reader');
 main.window.Zotero_Tabs.selectedID='tab1';app.setReaderShortcut('');
 assert.equal(main.window.document.querySelectorAll('#pl-region-keyset key').length,0);key(main.window.document);await tick();assert.deepEqual(fired,[2]);
 app.setReaderShortcut('F9');const k=main.window.document.querySelector('#pl-region-keyset key');assert.equal(k.getAttribute('keycode'),'VK_F9');
});
test('dead reader wrappers do not hide healthy active readers',async t=>{
 const {app,Zotero}=await setup(t),{main,readers}=ui(t,app,Zotero);
 const dead={get _iframeWindow(){throw Error('dead object');}};Zotero.Reader._readers.unshift(dead);
 assert.equal(app.activeReader(),readers[1]);
 main.window.Zotero_Tabs.selectedID='zotero-pane';assert.equal(app.activeReader(),null);
});
test('shutdown removes window shortcut and XUL keyset',async t=>{
 const {app,Zotero}=await setup(t),{main}=ui(t,app,Zotero);let fired=0;app.selectGraphicRegion=async()=>fired++;
 await app.shutdown();assert.equal(main.window.document.getElementById('pl-region-keyset'),null);
 app.regionShortcutAt=0;main.window.document.dispatchEvent(new main.window.KeyboardEvent('keydown',{key:'r',ctrlKey:true,bubbles:true}));await tick();assert.equal(fired,0);
});
function queued(app){const reader={},states=[];const s={reader,busy:true,update(){},paint(){},control:{stopped:false,requests:new Set()}};app.graphicSessions.set(reader,s);app.showRegionBadge=(_s,state,details)=>states.push({state,...details});return {s,states};}
test('region idle timeout keeps background ownership and reports failure',async t=>{
 const {app}=await setup(t),{s,states}=queued(app);let runs=0;const original=s.control;
 app.waitGraphicIdle=async()=>false;app.recognizeGraphicRegion=async()=>runs++;
 s.regionQueue=[{pageIndex:0}];await app.pumpRegionQueue(s);
 assert.equal(runs,0);assert.equal(s.busy,true);assert.equal(s.control,original);assert.equal(states.at(-1).state,'error');
});
test('closing reader while region waits never starts OCR or recreates badge',async t=>{
 const {app}=await setup(t),{s,states}=queued(app);let release,runs=0;app.waitGraphicIdle=()=>new Promise(r=>release=r);app.recognizeGraphicRegion=async()=>runs++;
 s.regionQueue=[{pageIndex:0}];const work=app.pumpRegionQueue(s);const n=states.length;app.graphicSessions.delete(s.reader);release(true);await work;
 assert.equal(runs,0);assert.equal(states.length,n);assert.equal(s.regionRunning,false);
});
test('failed region keeps error badge and stale list never becomes new result',async t=>{
 const {app}=await setup(t),{s,states}=queued(app);s.busy=false;s.lastRegionList=[{pageIndex:0,text:'old',target:'旧译'}];app.waitGraphicIdle=async()=>true;
 app.recognizeGraphicRegion=async()=>{throw Error('OCR failed');};s.regionQueue=[{pageIndex:0}];await app.pumpRegionQueue(s);
 assert.equal(states.at(-1).state,'error');assert.equal(s.regionResults?.length||0,0);assert.equal(s.busy,false);
});
test('queued region rejects changed viewport before capture',async t=>{
 const {app}=await setup(t),{s,states}=queued(app);let runs=0;app.waitGraphicIdle=async()=>true;app.recognizeGraphicRegion=async()=>runs++;
 s.regionQueue=[{pageIndex:0,version:'1,0,0,1,0,0',pv:{viewport:{transform:[2,0,0,2,0,0]}}}];await app.pumpRegionQueue(s);
 assert.equal(runs,0);assert.equal(states.at(-1).state,'error');
});

test('clear pauses and queues prose, archives edits, and propagates disk failure',async t=>{
 const {app}=await setup(t),reader={},r={id:'p',text:'Source',target:'校订',edited:true,alignment:{links:[]},status:'done',layout:{pageIndex:0}},g={reader,rows:[{text:'Label',target:'标签',pageIndex:0,edited:true,approved:true}],paint(){},update(){}},job={completed:new Set([0]),failed:new Map(),pending:new Set(),pause(){}};
 const s={reader,stage:'ready',records:new Map([['p',r]]),queue:[],graphicJob:job,paint(){},update(){},enqueue(r){this.queue.push(r);}};app.inplace=new Map([[reader,s]]);app.graphicSessions.set(reader,g);app.saveGraphics=async()=>{};app.saveInPlaceCheckpoint=async()=>{};
 await app.clearTranslations(reader,{pageIndex:0});assert.equal(s.paused,true);assert.equal(s.queue[0],r);assert.equal(r.history[0].edited,true);assert.ok(r.history[0].alignment);assert.equal(r.alignment,undefined);assert.equal(job.completed.size,0);assert.ok(job.pending.has(0));assert.equal(g.rows[0].history[0].approved,true);
 g.rows[0].target='another';app.saveGraphics=async()=>{throw Error('disk full');};await assert.rejects(app.clearTranslations(reader,{pageIndex:0}),/disk full/);
});
test('clear during in-flight work leaves every target and history untouched',async t=>{
 const {app}=await setup(t),reader={},row={target:'keep',pageIndex:0},g={busy:true,rows:[row]};app.graphicSessions.set(reader,g);
 await assert.rejects(app.clearTranslations(reader,{pageIndex:0}),/暂停/);assert.equal(row.target,'keep');assert.equal(row.history,undefined);
});
