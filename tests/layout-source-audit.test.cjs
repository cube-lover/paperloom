const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../addon/content/layout.js');
function data(lines){
 const chars=lines.flatMap((l,j)=>{const size=l.size||10,y=l.y??(760-j*13),x=l.x??30,w=l.w??230;
  return [...l.text].map((c,i,a)=>({c,fontSize:size,fontName:'Body',baseline:y+2,rect:[x+i*w/a.length,y,x+(i+1)*w/a.length,y+size],
   lineBreakAfter:i===a.length-1&&!l.paragraphOnly,paragraphBreakAfter:i===a.length-1&&!!(l.end||l.paragraphOnly)}));});
 return {viewBox:[0,0,600,800],chars};
}
const parse=lines=>L.parsePage(data(lines),{operatorList:{fnArray:[],argsArray:[]}});
test('paragraph-only break is also a line boundary',()=>{
 const p=parse([{text:'First paragraph.',paragraphOnly:true},{text:'Second paragraph.',paragraphOnly:true}]);
 assert.equal(p.lines.length,2);assert.equal(p.blocks.length,2);
});
test('decimal quantity inside prose is not a numbered heading',()=>{
 const p=parse([{text:'Tangshan produced'},
  {text:'65.67 Mt iron and 68.32 million m3 steel, while Handan produced'},
  {text:'33.22 Mt iron and 36.84 Mt steel in 2010.',end:true}]);
 assert.equal(p.blocks.length,1);assert.equal(p.blocks[0].role,'body');assert.match(p.blocks[0].text,/65\.67 Mt/);
});
test('same-sized real numbered headings after a paragraph remain headings',()=>{
 const p=parse([{text:'Previous paragraph ends here.',end:true},{text:'3.1. Methods',end:true},{text:'We describe the method.',end:true}]);
 assert.equal(p.blocks[1].role,'heading');
});
test('caption-only pages translate explanations as captions even when font mode changes',()=>{
 const p=parse([{text:'Table 5',size:6.4,end:true},
  {text:'Validation of fossil fuel-related CO2 emission estimations.',size:6.4,end:true,y:751.4},
  {text:'Fig. 2. CO2 emissions of the 24 case cities, 2010, million tonnes.',size:6.4,end:true,y:80}]);
 assert.equal(p.blocks.length,2);assert.ok(p.blocks.every(b=>b.role==='caption'&&b.eligible));
 assert.match(p.blocks[0].text,/Table 5 Validation/);assert.equal(p.blocks[0].lines.length,2);
});
test('dates, table rows, run-in headings and citation tails are not isolated headings/captions',()=>{
 const p=parse([{text:'10 March 2017',end:true},{text:'1 Raw coal 0.21 96.51',end:true},
 {text:'3.3.2.1. Case A: city with industry consumption by'},
 {text:'types. The available data are used directly.',end:true},
 {text:'All sectors are listed in'}, {text:'Table 3.',w:60,end:true}]);
 assert.ok(p.blocks.every(b=>b.role==='body'));assert.match(p.blocks.at(-1).text,/listed in Table 3\./);
});
test('prose referring to a figure remains translatable',()=>{
 const p=parse([{text:'Fig. 1 shows the framework designed for this study.'},
 {text:'The framework includes data collection and processing.',end:true}]);
 assert.ok(p.blocks.every(b=>b.eligible));
});
test('missing paragraph flags: first-line indent separates paragraphs, not wrapped lines',()=>{
 const p=parse([{text:'The first paragraph begins',x:42},
 {text:'and continues across this full line.',x:30},
 {text:'The second paragraph starts',x:42},
 {text:'and continues across this line.',x:30}]);
 assert.equal(p.blocks.length,2);assert.equal(p.blocks[0].lines.length,2);assert.equal(p.blocks[1].lines.length,2);
 assert.ok(p.blocks[1].evidence.includes('boundary:first-line-indent'));
});
test('missing paragraph flags: short terminal line ends a paragraph',()=>{
 const p=parse([{text:'A long line begins the paragraph.'},
 {text:'It ends here.',w:85},
 {text:'The next paragraph begins at the same margin.'},
 {text:'It has a full second line of explanatory prose.'}]);
 assert.equal(p.blocks.length,2);assert.equal(p.blocks[0].lines.length,2);
 assert.ok(p.blocks[1].evidence.includes('boundary:short-terminal-line'));
});
test('inset table header rule still forms one protected table',()=>{
 const rects=[[30,700,280,700.5],[54,676,280,676.5],[30,520,280,520.5]];
 const ops={fnArray:rects.map(()=>91),argsArray:rects.map(r=>[22,[],r])};
 const g=L.graphics(ops,[0,0,600,800]);assert.equal(g.regions.filter(r=>r.role==='table').length,1);
 assert.deepEqual(g.regions.find(r=>r.role==='table').rect,[30,520,280,700.5]);
 const pair={fnArray:[91,91],argsArray:[ops.argsArray[0],ops.argsArray[2]]};assert.equal(L.graphics(pair,[0,0,600,800]).regions.length,0);
});
test('missing paragraph flags: local baseline spacing detects a new paragraph',()=>{
 const p=parse([{text:'First full line of prose.',y:760},{text:'Second full line of prose.',y:748},
 {text:'Third full line of prose.',y:736},{text:'Next paragraph after space.',y:717},
 {text:'Its second full line of prose.',y:705},{text:'Its third full line of prose.',y:693}]);
 assert.equal(p.blocks.length,2);assert.equal(p.blocks[0].lines.length,3);
 assert.ok(p.blocks[1].evidence.includes('boundary:local-line-gap'));
});
