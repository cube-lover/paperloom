const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../addon/content/layout.js'),G=require('../addon/content/graphics.js'),{createHarness}=require('./harness.cjs'),{JSDOM}=require('jsdom');
const f=require('./layout-spatial-regressions.fixture.json');
test('full numeric grid outranks partial rule triple regardless of table content and page number',()=>{
 const d=f.pages.find(p=>p.pageIndex===14),m=L.regionModel(d,d.operatorList),t=m.tables.find(t=>t.rowCount===7);assert.equal(t.columnCount,7);assert.equal(m.tables.length,1);
 const p=L.parsePage(d,{operatorList:d.operatorList});for(const b of p.blocks.filter(b=>/^(?:XLM|MASS|mBART|GPT-3)/.test(b.text)))assert.equal(b.eligible,false,b.text);
 assert.ok(p.blocks.some(b=>/^Table 3.4:/.test(b.text)&&b.eligible));
 // Same geometry on a different page with changed letters/values still works.
 const other={...d,pageIndex:71,chars:d.chars.map(c=>({...c,u:(c.u||c.c).replace(/[XMG]/g,'R')}))};assert.equal(L.regionModel(other,other.operatorList).tables.find(t=>t.rowCount===7).columnCount,7);
});
test('single-answer and repeated-field text tables use the shared model before prose grouping',()=>{
 const d=f.pages.find(p=>p.pageIndex===55),m=L.regionModel(d,d.operatorList),p=L.parsePage(d,{operatorList:d.operatorList});
 assert.ok(m.tables.some(t=>t.role==='text-table'&&t.cells.some(c=>/Target Completion/.test(c.text))));
 for(const b of p.blocks.filter(b=>/Target Completion/.test(b.text)))assert.equal(b.eligible,false);
 for(const name of ['G.20','G.21','G.22','G.23'])assert.ok(p.blocks.some(b=>b.eligible&&b.text.includes(name)),name);
});
test('all regression documents preserve non-overlap and captions outside protected regions',()=>{
 const fixtures=[f,require('./structured-pages.fixture.json'),require('./layout-dense-tables.fixture.json'),require('./layout-iop.fixture.json'),require('./layout-gpt3.fixture.json')];
 for(const doc of fixtures)for(const d of doc.pages){const op=d.operatorList||doc.operators?.[d.pageIndex],p=L.parsePage(d,{operatorList:op,outline:doc.outline||[]});
 for(const b of p.blocks.filter(b=>b.eligible))assert.equal(L.frameConflicts(b.rect,p.protectedRegions).length,0,'page '+d.pageIndex+' '+b.text.slice(0,80));}
});
test('prose and graphics consume identical numeric and text-table boundaries',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);for(const d of f.pages){const a=L.regionModel(d,d.operatorList).tables,b=app.detectGraphicRegions(d,d.operatorList).regions.filter(r=>['table','text-table'].includes(r.role));assert.deepEqual(b.map(r=>r.rect).sort(),a.map(r=>r.rect).sort());}
});
test('paint-time region guard retains source/target but prevents a stale prose record covering a table',async t=>{
 const {app,C}=await createHarness(t);require('../addon/content/inplace.js').attach(app,C,L);const dom=new JSDOM('<div class="page"></div>');t.after(()=>dom.window.close());const page=dom.window.document.querySelector('div'),old=dom.window.document.createElement('div');page.appendChild(old);
 const record={text:'Old merged table row',target:'原译文保留',layout:{pageIndex:0,rect:[20,20,80,40]},block:{el:old}},s={doc:dom.window.document,layout:{pages:[{protectedRegions:[{role:'table',rect:[0,0,100,100]}]}]}};
 assert.equal(app.paintStructuredBlock(s,record,page,{transform:[1,0,0,-1,0,100]}),null);assert.equal(page.children.length,0);assert.equal(record.target,'原译文保留');assert.equal(record.layoutConflict,true);
});
test('word task literals and answer spelling are protected while ordinary cloze answers remain translatable',()=>{
 const d=f.pages.find(p=>p.pageIndex===55),cells=L.regionModel(d,d.operatorList).tables.flatMap(t=>t.cells||[]);assert.equal(cells.find(c=>c.text==='sticks').preserveSource,true);assert.notEqual(cells.find(c=>c.text==='step').preserveSource,true);assert.ok(cells.find(c=>c.text.includes('skicts')).preserveLiterals.includes('skicts'));
 assert.match(G.replacementReason({preserveSource:true},[]),/拼写/);
 assert.match(G.replacementReason({preserveLiterals:['skicts'],target:'省略了数据'},[]),/字符/);
 assert.ok(cells.some(c=>c.text.includes('She held the torch')&&c.text.includes('there’s more than')));
});
test('changed-layout translations stay reviewable and never draw or dispatch as active labels',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const dom=new JSDOM('<div class="page"></div>');t.after(()=>dom.window.close());const s={rows:[],ready:Promise.resolve(),panel:{hidden:false}};app.graphicSession=async()=>s;let saves=0;app.saveGraphics=async()=>saves++;const r={id:'old',pageIndex:3,text:'Combined cells',target:'用户校订',edited:true,status:'done',inkRect:[1,1,20,8]};
 assert.equal((await app.preserveLayoutTranslations({},[r])).preserved,1);assert.equal((await app.preserveLayoutTranslations({},[r])).preserved,0);assert.equal(s.rows[0].target,r.target);assert.equal(s.rows[0].edited,true);assert.equal(s.panel.hidden,true);assert.equal(saves,1);assert.equal(app.paintGraphicLabel(s,s.rows[0],dom.window.document.querySelector('div'),{transform:[1,0,0,-1,0,100]}),null);
});
test('newly restored prose captions reuse exact page-local graphic translations without requests',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);const r={status:'pending',text:'Figure 1: Some result',layout:{pageIndex:4,inkRect:[0,0,100,10]}},g={id:'cap',text:r.text,pageIndex:4,target:'用户图注译文',edited:true,origin:'PDF-caption',quad:G.quad([0,0,100,10])};app.graphicSession=async()=>({ready:Promise.resolve(),rows:[g]});const a={cfg:{},reader:{},records:new Map([['x',r]])};assert.equal((await app.reuseGraphicTranslations(a)).reused,1);assert.equal(r.target,g.target);assert.equal(r.edited,true);r.status='pending';g.pageIndex=3;assert.equal((await app.reuseGraphicTranslations(a)).reused,0);
});
