const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../addon/content/layout.js'),G=require('../addon/content/graphics.js'),f=require('./layout-dense-tables.fixture.json');
const {createHarness}=require('./harness.cjs'),{JSDOM}=require('jsdom');
const page=i=>f.pages.find(p=>p.pageIndex===i);
const table=i=>{const d=page(i);return L.tableStructure(d.chars,L.graphics(d.operatorList,d.viewBox).rules)[0];};
test('two-rule compute table is protected before prose merge; captions stay outside',()=>{
 const d=page(45),p=L.parsePage(d,{operatorList:d.operatorList}),t=table(45);assert.equal(t.rowCount,17);assert.equal(t.columnCount,9);
 assert.equal(t.headerCells.length,9);assert.equal(t.headerCells[4].text,'Training tokens (billions)');assert.equal(t.headerCells[7].text,'Fwd-pass flops per active param per token');
 for(const b of p.blocks)if(/T5-Small|Total train|Training tokens/.test(b.text))assert.equal(b.eligible,false,b.text);
 assert.ok(p.blocks.some(b=>/^Table D\.1/.test(b.text)&&b.eligible));
 for(const c of t.headerCells){assert.ok(c.rect[1]>t.separator[3]);for(const data of t.bodyCells)assert.equal(L.intersection(c.rect,data.rect),0);}
});
test('dense contamination table keeps all 42 by 12 data cells and reconstructs 12 independent headers',()=>{
 const t=table(44);assert.equal(t.rowCount,42);assert.equal(t.columnCount,12);assert.equal(t.headerCells.length,12);
 assert.equal(t.headerCells[6].text,'Dirty Acc/F1/BLEU');assert.equal(t.headerCells[11].text,'Relative Difference Clean vs All');
 assert.equal(t.bodyCells[0].text,'Quac');assert.equal(t.bodyCells[4].text,'44.3');assert.equal(t.bodyCells.length,504);
 for(let i=0;i<t.headerCells.length;i++)for(let j=i+1;j<t.headerCells.length;j++)assert.equal(L.intersection(t.headerCells[i].rect,t.headerCells[j].rect),0);
});
test('numeric columns are recoverable without rules but do not classify ordinary quantity prose',()=>{
 const t=L.tableStructure(page(45).chars,[]);assert.equal(t[0].columnCount,9);
 for(const i of [4,30,31])assert.equal(L.tableStructure(page(i).chars,[]).length,0,'page '+(i+1));
});
test('table translation selects only complete header cells, never numeric data/model names/metric acronyms',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);
 for(const i of [44,45]){const d=page(i),drawing=L.graphics(d.operatorList,d.viewBox),r=app.graphicTableLabels(d,d.viewBox,drawing.rules);
  assert.equal(r.labels.length,i===44?12:9);assert.ok(r.labels.every(r=>r.origin==='PDF-table'));assert.ok(r.labels.every(r=>!/^T5|^GPT|^Quac/.test(r.text)));
  if(i===44){assert.equal(r.labels.find(r=>r.text==='N').selected,false);assert.equal(r.labels.find(r=>r.text==='Acc/F1/BLEU').selected,false);}
 }
});
test('source-pane guard rejects direct label painting, including locate and single-pane reader',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const left=new JSDOM('<div></div>'),right=new JSDOM('<div></div>');t.after(()=>{left.window.close();right.window.close();});
 const reader={_internalReader:{_primaryView:{_iframeWindow:left.window},_secondaryView:{_iframeWindow:right.window}}},s={reader,rows:[],replace:false,panel:{hidden:true},update(){}};
 const row={id:'g1',pageIndex:0,text:'Model',target:'模型',quad:G.quad([1,1,20,10])};s.rows.push(row);
 assert.equal(app.paintGraphicLabel(s,row,left.window.document.querySelector('div'),{transform:[1,0,0,-1,0,100]}),null);
 assert.equal(left.window.document.querySelectorAll('.pl-graphic-anchor').length,0);
 assert.ok(app.paintGraphicLabel(s,row,right.window.document.querySelector('div'),{transform:[1,0,0,-1,0,100]}));
 delete reader._internalReader._secondaryView;assert.equal(app.paintGraphicLabel(s,row,left.window.document.querySelector('div'),{transform:[1,0,0,-1,0,100]}),null);
});
test('table glyph subpixel colour allowance is restricted to verified ink, not arbitrary background',()=>{
 const image={width:80,height:40,data:new Uint8ClampedArray(80*40*4).fill(255)};
 image.data.set([239,120,60,255],(20*80+21)*4);
 assert.equal(G.plainBackground(image),null);
 assert.equal(G.plainBackground(image,{textBounds:[20,15,35,25]}),'#fff');
 image.data.set([0,80,220,255],(4*80+4)*4);
 assert.equal(G.plainBackground(image,{textBounds:[20,15,35,25]}),null);
});
test('page binding clears old left overlays, redraws only the right, and preserves edited records',async t=>{
 const {app,C,IOUtils}=await createHarness(t);G.attach(app,C,L);
 const left=new JSDOM('<div class="page" data-page-number="1"><button class="pl-graphic-anchor">旧测试覆盖</button></div>'),right=new JSDOM('<div class="page" data-page-number="1"></div><section></section>');
 const events=[];app.bindPdfEvent=(win,event,fn)=>events.push({win,event,fn});app.measureInPlaceText=()=>({fits:true});
 for(const win of [left.window,right.window])win.PDFViewerApplication={pdfViewer:{getPageView:()=>({renderingState:3,viewport:{transform:[1,0,0,-1,0,100]}})}};
 const reader={_internalReader:{_primaryView:{_iframeWindow:left.window},_secondaryView:{_iframeWindow:right.window}}};
 const s={reader,doc:right.window.document,rows:[{id:'edited',pageIndex:0,text:'Model',target:'人工校订模型',quad:G.quad([1,1,80,20]),score:1,approved:true,background:'#fff',edited:true,history:[{target:'旧译文'}]}],replace:true,hidden:false,cleanup:[],control:{stopped:false,requests:new Set()},panel:right.window.document.querySelector('section'),file:'graphics/pane-test.json',fingerprint:'fixture',update(){}};
 t.after(()=>{app.closeGraphics(reader);left.window.close();right.window.close();});app.graphicSessions.set(reader,s);
 const before=JSON.stringify(s.rows);app.bindGraphicPages(s);
 assert.equal(left.window.document.querySelectorAll('.pl-graphic-anchor').length,0);assert.equal(right.window.document.querySelectorAll('.pl-graphic-anchor').length,1);
 assert.ok(events.length);assert.ok(events.every(e=>e.win===right.window));for(const e of events)e.fn();
 assert.equal(right.window.document.querySelectorAll('.pl-graphic-anchor').length,1);
 s.hidden=true;s.paint();assert.equal(right.window.document.querySelectorAll('.pl-graphic-anchor').length,0);s.hidden=false;s.paint();
 assert.equal(left.window.document.querySelectorAll('.pl-graphic-anchor').length,0);assert.equal(right.window.document.querySelector('.pl-graphic-anchor').textContent,'人工校订模型');assert.equal(JSON.stringify(s.rows),before);
 const path=require('node:path');await IOUtils.makeDirectory(path.join(app.dir,'graphics'));await app.saveGraphics(s);const saved=JSON.parse(await IOUtils.readUTF8(path.join(app.dir,s.file)));assert.equal(JSON.stringify(saved.rows),before);
});
