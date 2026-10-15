const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const P=require('../addon/content/reader-progress'),G=require('../addon/content/graphics'),L=require('../addon/content/layout'),I=require('../addon/content/inplace'),{createHarness}=require('./harness.cjs');
const row=(id,pageIndex=11)=>({id,pageIndex,text:'Update GAS infrastructure',target:'更新天然气基础设施',selected:true,quad:G.quad([10,20,100,35])});
const article=()=>({cfg:{translateGraphics:true},pdf:{numPages:28},stage:'ready',paused:false,graphicJob:{pending:new Set([9,10]),completed:new Set([0,1]),failed:new Map(),busy:true,current:11}});
const region={index:2,total:3,label:'图 8',title:'Fig. 8. Simulation procedure',rect:[1,1,200,300]};
test('progress separates actual background work location from the page being read and measured overlays',()=>{
 const a=article(),g={busy:true,phase:'translate',rows:[row('a'),row('b',7),{...row('c',7),target:''},{...row('old',7),legacyLayout:true}],progress:{done:4,total:8},activeLabels:new Map([['a',{pageIndex:11,region,text:'Update GAS infrastructure',rect:[1,2,3,4]}],['b',{pageIndex:11,region,text:'Calculate performance'}]])};
 const p=P.model({article:a,graphics:g,pageIndex:7,painted:new Map([['b','hotspot']])});assert.match(p.task,/第 12 页.*图 8.*2\/3.*2 组文字并行.*4\/8/);assert.match(p.detail,/Update GAS.*Calculate performance/);assert.equal(p.target.pageIndex,11);assert.match(p.coverage,/右侧第 8 页：已译 1\/2 处 · 已原位显示 0 处 · 未显示 1 处（[^）]+）/);
 const q=P.model({article:a,graphics:{rows:[{...row('q',0),target:'prMF.19',text:'prMF.19'}],busy:true,phase:'translate',progress:{done:1,total:1}},pageIndex:0,painted:new Map()});assert.match(q.coverage,/已译 1\/1 处 · 已原位显示 0 处 · 原文即译文 1 处/);assert.doesNotMatch(q.coverage,/待显示核验/);assert.equal(p.total,3);
});
test('pause, no graph, unmounted page and failed page never claim complete coverage',()=>{
 const a=article();a.paused=true;a.graphicJob.busy=false;const g={rows:[row('a',0)],lastLocation:{pageIndex:11,region},busy:false};
 let p=P.model({article:a,graphics:g,pageIndex:0});assert.match(p.task,/已暂停.*停在第 12 页/);assert.match(p.coverage,/覆盖待页面显示后核验/);assert.doesNotMatch(p.task,/正在翻译/);
 a.graphicJob.failed.set(5,'local failure');assert.match(P.model({article:a,graphics:g}).overall,/失败 1 页/);
 p=P.model({article:a,graphics:g,pageIndex:20,painted:new Map()});assert.match(p.coverage,/图表待检查/);
 a.hidden=true;assert.match(P.model({article:a,graphics:g}).coverage,/译文已收起/);
});
test('reader menu exposes the in-place actions plus the one-click engine installer, and no workbench or popup entry',async t=>{
 const {app,C,Zotero}=await createHarness(t);I.attach(app,C,L);G.attach(app,C,L);const dom=new JSDOM('<div class="toolbar"></div>');t.after(()=>dom.window.close());const reader={itemID:5,_iframeWindow:dom.window},doc=dom.window.document;
 app.buildReaderButton(doc,reader,n=>doc.querySelector('.toolbar').appendChild(n));const menu=doc.querySelector('.pl-reader-menu');assert.equal(menu.querySelectorAll('button').length,7);
 // 清除翻译是二级菜单：父项带 ›，子项挂在 body 上单独定位（菜单本体 overflow:auto 会裁掉嵌套面板）
 assert.match(menu.textContent,/清除翻译/);
 const parent=[...menu.querySelectorAll('[aria-haspopup="true"]')].find(n=>n.textContent.includes('清除翻译'));
 assert.ok(parent,'要有清除翻译父项');
 const sub=doc.querySelector('.pl-reader-submenu');
 assert.ok(sub,'二级菜单面板要挂出来');
 assert.deepEqual([...sub.querySelectorAll('button')].map(n=>n.textContent),['清除当前页面翻译','清除所有页面翻译']);
 assert.deepEqual([...sub.querySelectorAll('button')].map(n=>n.dataset.action),['clear-page','clear-all']);
 assert.equal(sub.style.display,'none','没点之前不该显示');assert.doesNotMatch(menu.textContent,/面板|工作台|选文|导出|图表进度/);assert.ok(menu.textContent.includes('框选翻译（补漏）…  Ctrl+R'));assert.match(menu.textContent,/安装 \/ 修复识别引擎/);assert.equal(doc.querySelector('.pl-auto-graphics'),null);assert.equal(doc.querySelectorAll('.pl-reader-action button').length,2);assert.equal(app.readerPopup,undefined);
 let call=0;app.requestCurrentGraphics=r=>{assert.equal(r,reader);call++;};[...menu.children].find(n=>n.textContent==='补译当前页图表').click();assert.equal(call,1);
 app.selectGraphicRegion=async()=>{};[...menu.children].find(n=>n.textContent.startsWith('框选翻译')).click();await new Promise(r=>setTimeout(r,5));app.addWindow({document:doc});assert.equal(doc.querySelector('[id="paperloom-keyset"]'),null);for(const v of [...app.readerButtons.get(reader)])v.dispose();
});
test('reader shortcut setting matches modifiers exactly and ignores typing',async t=>{
 const {app,C,Zotero}=await createHarness(t);G.attach(app,C,L);
 // The short default uses exact modifiers and does not keep Alt aliases.
 assert.equal(app.readerShortcut(),'Ctrl+R');
 assert.equal(app.matchShortcut(app.readerShortcut(),{altKey:true,key:'r'}),false);
 assert.equal(app.matchShortcut(app.readerShortcut(),{ctrlKey:true,altKey:true,key:'r'}),false);
 assert.equal(app.matchShortcut(app.readerShortcut(),{ctrlKey:true,key:'r'}),true);
 assert.equal(app.matchShortcut(app.readerShortcut(),{altKey:true,shiftKey:true,key:'r'}),false);
 assert.equal(app.matchShortcut(app.readerShortcut(),{altKey:true,shiftKey:true,ctrlKey:true,key:'r'}),false);
 assert.equal(app.matchShortcut(app.readerShortcut(),{key:'r'}),false);
 assert.equal(app.matchShortcut('Alt+R',{altKey:true,key:'r'}),true);
 assert.equal(app.matchShortcut('Alt+R',{altKey:true,key:'R'}),true);
 assert.equal(app.matchShortcut('Alt+R',{altKey:true,shiftKey:true,key:'R'}),false);
 assert.equal(app.matchShortcut('Alt+R',{key:'r'}),false);
 assert.equal(app.matchShortcut('Alt+R',{ctrlKey:true,altKey:true,key:'r'}),false);
 assert.equal(app.matchShortcut('Ctrl+Shift+L',{ctrlKey:true,shiftKey:true,key:'L'}),true);
 assert.equal(app.matchShortcut('Ctrl+Shift+L',{metaKey:true,shiftKey:true,key:'l'}),true);
 assert.equal(app.matchShortcut('Ctrl+Shift+L',{ctrlKey:true,key:'l'}),false);
 assert.equal(app.matchShortcut('F9',{key:'F9'}),true);
 assert.equal(app.matchShortcut('',{key:'r'}),false);
 assert.equal(app.matchShortcut('Alt+R',null),false);
});
test('status strip has no panel actions and locating is explicit, does not auto-follow or send requests',async t=>{
 const {app,C}=await createHarness(t);I.attach(app,C,L);G.attach(app,C,L);const dom=new JSDOM('<div class="toolbar"></div><div id="viewer"></div>');t.after(()=>dom.window.close());const doc=dom.window.document,pv={renderingState:3,div:doc.body,viewport:{transform:[1,0,0,-1,0,800]}};let scrolls=0;
 const v={currentPageNumber:8,getPageView:()=>pv,scrollPageIntoView:()=>scrolls++};dom.window.PDFViewerApplication={pdfViewer:v};const reader={itemID:5,_iframeWindow:dom.window,_internalReader:{_secondaryView:{_iframeWindow:dom.window}}},s={...article(),reader,doc,records:new Map(),queue:[],workers:0,cleanup:[],parsed:28,fontScale:1,rescan(){},graphicJob:{...article().graphicJob,busy:false},paused:true};app.inplace=new Map([[reader,s]]);app.graphicSessions.set(reader,{rows:[],lastLocation:{pageIndex:11,region},paint(){}});
 let saves=0;app.scheduleInPlaceCheckpoint=()=>saves++;app.mountInPlaceControls(s);s.update();const saved=saves;const bar=doc.querySelector('.pl-inplace-controls');assert.deepEqual([...bar.querySelectorAll('button')].map(n=>n.textContent),['A−','A+','定位']);assert.equal(v.currentPageNumber,8);for(let i=0;i<10;i++)s.update(false);assert.equal(saves,saved);assert.equal(v.currentPageNumber,8);assert.equal(scrolls,0);assert.match(bar.querySelector('.pl-task-location').textContent,/第 12 页/);
 await app.locateTranslationTask(reader);assert.equal(v.currentPageNumber,12);assert.equal(scrolls,1);assert.equal(app.allRequests.size,0);for(const f of s.cleanup)f();app.inplace.clear();
});
test('concurrent active text and region metadata are published before requests and cleared after settle',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const reader={},a=article();a.reader=reader;app.inplace=new Map([[reader,a]]);const rows=[{...row('a'),target:'',graphicRegion:region},{...row('b'),text:'Calculate performance',target:'',graphicRegion:region}],snapshots=[];let release;
 const hold=new Promise(r=>release=r),s={reader,rows,update(){snapshots.push(P.model({article:a,graphics:s}));},paint(){}};app.graphicSessions.set(reader,s);app.saveGraphics=async()=>{};app.translate=async text=>{await hold;return {text:'译文 '+text,warnings:[]};};
 const work=app.translateGraphics(s,{rows,cfg:{...app.config,concurrency:2}});await new Promise(r=>setTimeout(r,20));assert.equal(s.activeLabels.size,2);assert.ok(snapshots.some(p=>p.detail.includes('Calculate performance')&&p.detail.includes('Update GAS')));release();await work;assert.equal(s.activeLabels.size,0);assert.equal(s.busy,false);assert.equal(s.lastLocation.pageIndex,11);assert.equal(s.lastLocation.region.label,'图 8');
});
test('actual nearby captions name graphics without borrowing figure numbers for a table caption',()=>{
 const app={};G.attach(app,{},L);const p=require('./layout-kong-table-math.fixture.json').pages[0],plan=app.detectGraphicRegions(p,p.operatorList);const infos=plan.regions.map((r,i)=>app.graphicRegionInfo(plan,r,i,p));assert.ok(infos.some(i=>/表\s*I/.test(i.label)));assert.ok(infos.some(i=>/图\s*5/.test(i.label)));const tableCaption=infos.find(i=>i.title.startsWith('Table I')&&/图注/.test(i.label));assert.ok(tableCaption);assert.doesNotMatch(tableCaption.label,/图\s*5/);
});

test('legacy shipped shortcuts become Ctrl+R while custom and disabled preferences survive',async t=>{
 const {app,C,Zotero,context}=await createHarness(t);
 require('node:vm').runInContext(require('node:fs').readFileSync(require.resolve('../addon/content/graphics.js'),'utf8'),context);
 context.PaperLoomGraphics.attach(app,C,L);
 const key='extensions.zotero.paperloom.reader.shortcut';
 for(const old of ['Alt+R','Alt+R, Ctrl+Alt+R','Alt+R, Ctrl+Alt+R, Alt+Shift+R','Ctrl+Alt+R, Alt+R, Alt+Shift+R']){
  Zotero.Prefs.set(key,old);assert.equal(app.readerShortcut(),'Ctrl+R');
  assert.equal(Zotero.Prefs.get(key),old,'default migration must not rewrite stored preferences');
 }
 for(const custom of ['', 'F9','Ctrl+Shift+L','Alt+R, F9']){app.setReaderShortcut(custom);assert.equal(app.readerShortcut(),custom);}
});
