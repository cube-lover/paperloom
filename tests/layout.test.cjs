const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../addon/content/layout.js');
const fixture=require('./structured-pages.fixture.json');
const pages=()=>fixture.pages.map(p=>L.parsePage(p,{outline:fixture.outline,operatorList:p.operatorList}));
test('structured source preserves title, CO2, ligatures, hyphens and short prose tails',()=>{
 const p=pages(),a=p[0].blocks;
 assert.equal(a.find(b=>b.role==='title').text,'Methodology and applications of city level CO2 emission accounts in China');
 assert.equal(a.find(b=>b.text==='abstract').role,'heading');
 const abstract=a.find(b=>b.text.startsWith('China is'));assert.equal(abstract.lines.length,12);assert.ok(!abstract.text.includes('©'));
 assert.match(a.find(b=>b.text.startsWith('Cities are')).text,/urbanization/);
 assert.match(p[1].blocks.find(b=>b.text.startsWith('The CO2 emission')).text,/2008\)\.$/);
 assert.match(p[2].blocks.find(b=>b.text.startsWith('Energy used')).text,/city boundary\.$/);
 assert.ok(a.find(b=>b.text.startsWith('Yuli Shan')).role==='metadata');
 assert.equal(a.find(b=>b.text==='Journal of Cleaner Production').eligible,false);
});
test('current PDF.js segmented header rules produce distinct table zones, not a giant column',()=>{
 const p=pages();assert.equal(p[2].protectedRegions.filter(b=>b.role==='table').length,2);
 assert.equal(p[3].protectedRegions.filter(b=>b.role==='table').length,3);
 const line=p[2].blocks.find(b=>b.text.startsWith('Primary-industry use'));assert.equal(line.role,'table');
 const middle=p[3].blocks.find(b=>b.text.startsWith('of the total'));assert.equal(middle.role,'body');
 for(const page of p)for(const b of page.blocks.filter(b=>b.eligible))for(const region of page.protectedRegions)assert.equal(L.intersection(b.rect,region.rect),0);
});
test('formula fragments excluded while explanatory paragraphs remain intact',()=>{
 const p=pages();
 for(const b of p[1].blocks.filter(b=>b.sourceRange[0]>=5754&&b.sourceRange[1]<=5809))assert.equal(b.eligible,false,b.text);
 assert.equal(p[2].blocks.find(b=>b.text.startsWith('P ¼')).role,'formula');
 const explain=p[1].blocks.find(b=>b.text.startsWith('The subscript'));assert.match(explain.text,/respectively\.$/);assert.equal(explain.lines.length,8);
});
test('real page 8 numeric emission quantity stays in its six-line paragraph',()=>{
 const p=pages()[3],b=p.blocks.find(b=>b.text.includes('65.67 Mt iron'));
 assert.equal(b.role,'body');assert.equal(b.lines.length,6);assert.ok(b.text.startsWith('In addition,'));
});
test('real pages 4 and 7 protect inset-header table but translate external captions',()=>{
 const audit=require('./layout-audit-pages.fixture.json');
 const p=audit.pages.map(d=>L.parsePage(d,{outline:fixture.outline,operatorList:d.operatorList}));
 assert.equal(p[0].protectedRegions.filter(r=>r.role==='table').length,1);
 assert.equal(p[0].blocks.find(b=>b.text.includes('Raw coal')).role,'table');
 const d=L.finalize([...pages(),...p]),captions=d.pages.find(p=>p.index===6).blocks.filter(b=>!b.skipReason);
 assert.equal(captions.length,2);assert.ok(captions.every(b=>b.role==='caption'));
 for(const b of captions)for(const r of p[1].protectedRegions)assert.equal(L.intersection(b.rect,r.rect),0);
});
test('PDF projection uses all four corners and rotates content, ignores device pixels',()=>{
 const r=[10,20,30,50];
 assert.deepEqual(L.projection(r,{transform:[2,0,0,-2,0,200]}),{width:20,height:30,matrix:[2,0,-0,2,20,100],bounds:[20,100,60,160]});
 const p=L.projection(r,{transform:[0,2,2,0,0,0]});assert.deepEqual(p.bounds,[40,20,100,60]);assert.deepEqual(p.matrix,[0,2,-2,-0,100,20]);
 assert.throws(()=>L.projection(r,{}),/投影/);
});
test('document classification is page-order independent; header repeated and continuation linked',()=>{
 const p=pages(),d=L.finalize([...p].reverse());assert.deepEqual(d.pages.map(p=>p.index),[0,1,2,7]);
 assert.ok(d.blocks.some(b=>b.role==='running-header'));
 const left=d.blocks.find(b=>b.text.startsWith('Cities are')),right=d.blocks.find(b=>b.text==='mitigation actions.');
 assert.equal(right.continuesFrom,left.id);assert.ok(left.rect[2]<right.rect[0]);
});
test('single-line layout frames reserve leading without touching neighbouring ink',()=>{
 const p=pages()[0];
 for(const b of p.blocks.filter(b=>b.eligible&&b.lines.length===1)){
  assert.ok(b.rect[3]-b.rect[1]>=b.typography.fontSize*(b.typography.lineHeight+.44),b.text);
  for(const o of p.blocks)if(o!==b)assert.equal(L.intersection(b.rect,o.inkRect||o.rect),0,b.text+' / '+o.text);
 }
 const d=L.finalize(pages()),a=d.blocks.find(b=>b.text.startsWith('There are some challenges')),b=d.blocks.find(b=>b.text.startsWith('Zhang, 2011'));
 assert.equal(b.continuesFrom,a.id);
});
test('reference boundaries discovered before lazy page rendering and appendix resumes',()=>{
 const block=(text,id)=>({id,text,role:'body',eligible:true,rect:[10,20,50,40],typography:{fontSize:10},evidence:[]});
 const page=(index,texts)=>({index,viewBox:[0,0,100,100],bodyFont:10,blocks:texts.map((t,i)=>({...block(t,index+':'+i),pageIndex:index}))});
 const d=L.finalize([page(3,['Later cited paper.']),page(2,['References','Citation here.']),page(4,['Appendix A','Appendix body.'])]);
 assert.equal(d.blocks.find(b=>b.text==='Later cited paper.').skipReason,'references');assert.equal(d.blocks.at(-1).skipReason,null);
});
test('invalid input fails explicitly and old operator shape with bounds is accepted',()=>{
 assert.throws(()=>L.parsePage({chars:[],viewBox:[0,0,NaN,1]}));
 const o={fnArray:[91],argsArray:[[[13,14],[0,0,100,0],[0,0,100,.5]]]};assert.equal(L.graphics(o,[0,0,600,800]).rules.length,1);
});
