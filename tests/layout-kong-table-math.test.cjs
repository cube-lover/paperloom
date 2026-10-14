const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../addon/content/layout.js'),G=require('../addon/content/graphics.js');
const fixture=require('./layout-kong-table-math.fixture.json');
const parse=p=>L.parsePage(p,{pageIndex:p.pageIndex,operatorList:p.operatorList});
test('real sparse four-column inventory table exposes eighteen complete text cells and preserves numeric units',()=>{
 const p=fixture.pages[0],table=L.regionModel(p,p.operatorList).tables.find(t=>t.evidence==='sparse-ruled-inventory');assert.ok(table);assert.equal(table.cells.length,18);
 for(const text of ['Electric Transmission Network','Gas Transmission Network','Oil Transmission Network','Power generation','Gas-fired','Pumping stations'])assert.ok(table.cells.some(c=>c.text===text),text);
 for(const c of table.cells){assert.ok(!L.numericCell(c.text));assert.ok(!/^\d+\s*kV$/.test(c.text));assert.ok(L.intersection(c.inkRect,c.rect)>=L.area(c.inkRect)*.99,c.text);}
 const rows=L.physicalCells(p.chars);for(const row of rows)for(const c of row.cells.filter(c=>L.numericCell(c.text)||/^\d+\s*kV$/.test(c.text)))for(const text of table.cells)assert.ok(L.intersection(c.rect,text.rect)<.1,`${c.text} / ${text.text}`);
 const app={};G.attach(app,{},L);const found=app.detectGraphicRegions(p,p.operatorList).regions.find(t=>t.evidence==='sparse-ruled-inventory');assert.equal(found.cells.length,18);
});
test('Roman table caption stays outside the protected table and remains eligible for translation',()=>{
 const p=fixture.pages[0],parsed=parse(p),caption=parsed.blocks.find(b=>b.text.startsWith('Table I.'));assert.equal(caption.role,'caption');assert.equal(caption.eligible,true);for(const t of parsed.protectedRegions)assert.equal(L.intersection(caption.rect,t.rect),0);
});
test('Times-font display branches and optimization operators stay mathematical, not translated words',()=>{
 const a=parse(fixture.pages[1]),b=parse(fixture.pages[2]);
 for(const [page,re]of [[a,/\belse\b/],[a,/\bmin\(/],[a,/\bif Lu/],[b,/^max r/],[b,/^s\.t\.$/]]){const hits=page.blocks.filter(b=>re.test(b.text));assert.ok(hits.length,re);for(const hit of hits){assert.equal(hit.role,'formula',hit.text);assert.equal(hit.eligible,false,hit.text);}}
 for(const p of [a,b])assert.ok(p.blocks.some(b=>b.role==='body'&&b.eligible&&b.text.length>200));
 // Original glyph coordinates and formula text remain immutable on repeated parsing.
 const before=JSON.stringify(fixture);fixture.pages.forEach(parse);assert.equal(JSON.stringify(fixture),before);
});
