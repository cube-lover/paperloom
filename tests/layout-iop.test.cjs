const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../addon/content/layout.js'),d=require('./layout-iop.fixture.json');
const pages=()=>L.finalize(d.pages.map((p,i)=>L.parsePage(p,{outline:d.outline,operatorList:d.operators[i]}))).pages;
test('publisher cover sheet is not confused with article body',()=>{
 const p=pages()[0];assert.equal(p.blocks.filter(b=>!b.skipReason).length,1);assert.equal(p.blocks.find(b=>!b.skipReason).role,'title');
});
test('article beginning after a cover keeps author and affiliation metadata native',()=>{
 const p=pages()[1];assert.equal(p.blocks.find(b=>b.text.startsWith('Mg and native')).role,'title');
 for(const prefix of ['Rafi Ullah','Department of','E-mail:','Received 17'])assert.equal(p.blocks.find(b=>b.text.startsWith(prefix)).role,'metadata');
 assert.equal(p.blocks.find(b=>b.text.startsWith('The diffusion')).skipReason,null);
});
test('multi-line captions retain their type and remain translatable until the actual ending',()=>{
 for(const p of pages().slice(3))for(const b of p.blocks.filter(b=>/^(Figure|Table) \d/.test(b.text))){assert.equal(b.role,'caption');assert.equal(b.skipReason,null);}
 const p=pages()[3];assert.equal(p.blocks.find(b=>b.text.startsWith('Figure 1')).lines.length,3);
 assert.equal(p.blocks.find(b=>b.text.startsWith('the interplay')).skipReason,null);
});
test('display equation identifiers and additive continuation are protected',()=>{
 const p=pages();for(const [index,prefix] of [[2,'Ef [Xq]'],[2,'+ q (EVBM'],[3,'Eb = Ef']])assert.equal(p[index].blocks.find(b=>b.text.startsWith(prefix)).role,'formula');
 assert.equal(p[2].blocks.find(b=>b.text.startsWith('Local and semi-local')).skipReason,null);
});
test('false worker breaks inside scientific prose do not split overlapping frames',()=>{
 const p=pages();
 const caption=p[6].blocks.filter(b=>b.sourceRange[0]>=1980&&b.sourceRange[1]<=2202);
 assert.ok(caption.length);assert.ok(caption.every(b=>b.role==='caption'));
 assert.match(p[6].blocks.find(b=>b.text.startsWith('The calculated')).text,/3\.0 × 10−28/);
 assert.match(p[7].blocks.find(b=>b.text.startsWith('and the measured')).text,/expressed in per unit volume/);
 const conclusion=p[7].blocks.find(b=>b.text.startsWith('The defect formation'));
 assert.match(conclusion.text,/Mg−2 Si \. In the presence of ballistic damage/);
 assert.equal(p[7].blocks.find(b=>b.text==='Si . In the presence'),undefined);
 assert.equal(p[8].blocks.find(b=>b.text==='exp').role,'formula');
});
test('multi-line frames use local leading without overlapping any neighbour ink',()=>{
 for(const p of pages())for(const b of p.blocks.filter(b=>!b.skipReason))for(const o of p.blocks){if(o===b)continue;assert.ok(L.intersection(b.rect,o.inkRect)<.1,b.id+' / '+o.id);}
 const b=pages()[3].blocks.find(b=>b.text.startsWith('the interplay'));
 assert.ok(b.rect[3]-b.rect[1]>b.inkRect[3]-b.inkRect[1]+4);
});
