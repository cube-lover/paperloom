const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const S=require('../addon/content/selection.js');
test('bilingual range maps explicit terms both ways and sentence ranges without proportional word guessing',()=>{
 assert.deepEqual(S.mappedRange('hello world','你好，世界',0,5,[{source:'hello',target:'你好'}]),{start:0,end:2,level:'term'});
 assert.deepEqual(S.mappedRange('你好，世界','hello world',0,2,[{source:'你好',target:'hello'}]),{start:0,end:5,level:'term'});
 const a='First statement. Second result.',b='第一句。第二句。';assert.deepEqual(S.mappedRange(a,b,17,23),{start:4,end:8,level:'sentence'});
 assert.equal(S.mappedRange(a,'中文合并成一句。',0,5).level,'paragraph');
 assert.equal(S.mappedRange('Model 125M improves.','125M 模型改进了。',6,10).level,'literal');
});
test('source character map handles PDF whitespace, ligatures and ignored hyphens, rejects different source',()=>{
 const chars=[{c:'ﬁ'},{c:'n'},{c:'e'},{c:'-',ignorable:true},{c:' '},{c:'t'}],record={text:'fine t',layout:{sourceRange:[0,6]}};
 assert.deepEqual(S.sourceMap(record,chars).indices,[0,0,1,2,5]);assert.equal(S.sourceMap({...record,text:'other'},chars),null);
});
test('translated DOM range spans inline nodes without changing text',()=>{
 const d=new JSDOM('<div>你好<span>，世界</span></div>'),body=d.window.document.querySelector('div');
 assert.equal(S.domRange(body,1,4).toString(),'好，世');assert.equal(body.textContent,'你好，世界');d.window.close();
});
test('input routing isolates only plugin overlays, leaves PDF clicks intact and restores wrapper on close',()=>{
 const d=new JSDOM('<div class="page"><div class="pl-inplace"><div class="pl-inplace-text">中文</div></div><div class="pl-graphic-select"></div><span class="original">English</span></div>');
 const win=d.window,original=()=>({pageIndex:0}),view={_iframeWindow:win,pointerEventToPosition:original},reader={_internalReader:{_secondaryView:view}},app={};S.attach(app);app.bindNativeOverlayInput(reader);
 const event=selector=>({target:win.document.querySelector(selector)});
 assert.equal(view.pointerEventToPosition(event('.pl-inplace-text')),null);assert.equal(view.pointerEventToPosition(event('.pl-graphic-select')),null);assert.deepEqual(view.pointerEventToPosition(event('.original')),{pageIndex:0});
 app.closeNativeOverlayInput(reader);assert.equal(view.pointerEventToPosition,original);assert.equal(win.document.querySelectorAll('style').length,0);d.window.close();
});
test('selection sync is bidirectional, cleared when disabled, and never replaces passive native selection',()=>{
 const left=new JSDOM('<div class="page"></div>'),right=new JSDOM('<div class="page"><div class="pl-inplace"><div class="pl-inplace-text">你好，世界。</div></div></div>');
 const text='hello world.',chars=Array.from(text,(c,i)=>({c,rect:[10+i*5,10,15+i*5,20]}));
 const viewport={transform:[1,0,0,-1,0,100],width:200,height:100};
 const lview={_iframeWindow:left.window,_pdfPages:[{chars}],_selectionRanges:[{pageIndex:0,anchorOffset:0,headOffset:5}]},rview={_iframeWindow:right.window};
 for(const [d,v] of [[left,lview],[right,rview]])d.window.PDFViewerApplication={pdfViewer:{getPageView:()=>({div:d.window.document.querySelector('.page'),viewport})},eventBus:{on(){},off(){}}};
 right.window.Range.prototype.getClientRects=()=>[{left:10,top:10,width:20,height:10}];
 const page=right.window.document.querySelector('.page'),record={id:'p1',status:'done',text,target:'你好，世界。',layout:{pageIndex:0,sourceRange:[0,chars.length]},block:{pageEl:page,el:page.firstChild}};
 const reader={_internalReader:{_primaryView:lview,_secondaryView:rview}},s={reader,win:right.window,records:new Map([['p1',record]]),cfg:{glossary:[{source:'hello',target:'你好'}]},syncEnabled:true,cleanup:[],alive:()=>true},events={},app={bindPdfEvent(win,name,fn){if(win===right.window)events[name]=fn;}};S.attach(app);app.bindSelectionSync(s);
 s.selectionSync.origin='left';s.selectionSync.update();assert.equal(s.selectionSync.details[0].level,'term');assert.equal(right.window.document.querySelectorAll('.pl-linked-selection').length,1);assert.equal(right.window.getSelection().toString(),'');
 const range=S.domRange(page.querySelector('.pl-inplace-text'),0,2);right.window.getSelection().addRange(range);s.selectionSync.origin='right';s.selectionSync.update();assert.equal(s.selectionSync.details[0].level,'term');assert.ok(left.window.document.querySelector('.pl-linked-selection'));assert.equal(left.window.getSelection().toString(),'');
 // PDF.js may replace overlay nodes while zooming. Restore only during reflow.
 events.scalechanging();const old=record.block.el,newBox=old.cloneNode(true);old.replaceWith(newBox);record.block.el=newBox;right.window.getSelection().removeAllRanges();s.selectionSync.update();assert.equal(right.window.getSelection().toString(),'你好');assert.equal(s.selectionSync.details[0].level,'term');
 right.window.getSelection().removeAllRanges();s.selectionSync.reflowUntil=0;s.selectionSync.update();assert.equal(right.window.getSelection().toString(),'');assert.equal(s.selectionSync.bookmark,null);
 right.window.getSelection().addRange(S.domRange(newBox.querySelector('.pl-inplace-text'),0,2));s.selectionSync.update();
 s.syncEnabled=false;s.selectionSync.update();assert.equal(left.window.document.querySelectorAll('.pl-linked-selection').length,0);s.syncEnabled=true;s.selectionSync.update();assert.ok(left.window.document.querySelector('.pl-linked-selection'));
 for(const f of s.cleanup)f();app.closeNativeOverlayInput(reader);assert.equal(s.selectionSync,undefined);left.window.close();right.window.close();
});

test('interleaved poem source mapping excludes the other column after geometric split',()=>{const S=require('../addon/content/selection.js'),L=require('../addon/content/layout.js'),f=require('./layout-user-issues.fixture.json');const p=f.pages.find(p=>p.pageIndex===48),parsed=L.parsePage(p,{pageIndex:48,operatorList:p.operatorList});const blocks=parsed.blocks.filter(b=>b.eligible&&b.lines.some(l=>Number.isFinite(l.columnGutter)));assert.ok(blocks.length>10);for(const b of blocks)assert.ok(S.sourceMap({text:b.text,layout:b},p.chars),b.text);});
