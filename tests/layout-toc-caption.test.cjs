const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../addon/content/layout.js'),gpt=require('./layout-gpt3.fixture.json');
const real=()=>L.finalize(gpt.pages.map(p=>L.parsePage(p,{outline:gpt.outline,operatorList:p.operatorList})));
function synthetic(rows,pageIndex=0){
 const chars=rows.flatMap((r,j)=>{const text=r.text,size=r.size||10,x=r.x||30,y=r.y??(740-j*14),width=r.width||300;
 return [...text].map((c,i)=>({c,fontSize:size,fontName:'Body',baseline:y+2,rect:[x+i*width/text.length,y,x+(i+1)*width/text.length,y+size],lineBreakAfter:i===text.length-1,paragraphBreakAfter:i===text.length-1&&r.end!==false}));});
 return L.parsePage({pageIndex,viewBox:[0,0,600,800],chars},{operatorList:{fnArray:[],argsArray:[]}});
}
test('GPT-3 printed contents page is excluded before queue creation, not translated headings',()=>{
 const p=real().pages[1];assert.equal(p.kind,'contents');assert.equal(p.blocks.filter(b=>!b.skipReason).length,0);
 assert.equal(p.blocks.find(b=>b.text==='Contents').role,'contents');assert.ok(p.lines.filter(l=>l.role==='contents').length>=33);
 assert.equal(real().pages[2].blocks.find(b=>b.text==='1 Introduction').skipReason,null);
});
test('GPT-3 Figure 1.1 and Figure 1.2 are complete translatable captions; body reference is not a caption',()=>{
 const m=real();for(const [page,label,n] of [[2,'Figure 1.1:',6],[3,'Figure 1.2:',5]]){
 const b=m.pages[page].blocks.find(b=>b.text.startsWith(label));assert.equal(b.role,'caption');assert.equal(b.skipReason,null);assert.equal(b.lines.length,n);
 }
 assert.equal(m.pages[4].blocks.find(b=>b.text.startsWith('Figure 1.2 illustrates')).role,'body');
});
test('contents does not activate reference-section filtering on subsequent prose',()=>{
 const p=synthetic([{text:'Table of Contents'},{text:'1 Introduction ..... 3'},{text:'2 Methods ..... 6'},{text:'References ..... 20'}]);
 const m=L.finalize([p,synthetic([{text:'The article starts here.'}],1)]);assert.equal(m.pages[0].kind,'contents');assert.equal(m.pages[1].blocks[0].skipReason,null);
});
test('Chinese TOC, roman page labels, and unheaded dotted continuation rows remain native',()=>{
 for(const rows of [[{text:'目 录'},{text:'摘要 ........ i'},{text:'第一章 绪论 ........ 1'},{text:'第二章 方法 ........ 8'}],
 [{text:'3 Findings ........ 10'},{text:'4 Discussion ........ 18'},{text:'References ........ 22'}]]){
 const p=L.finalize([synthetic(rows)]).pages[0];assert.equal(p.kind,'contents');assert.ok(p.blocks.every(b=>b.skipReason));
 }
});
test('a word Contents and isolated numeric prose do not suppress actual body',()=>{
 const p=L.finalize([synthetic([{text:'Contents'},{text:'The contents of the sample were measured in 2010.'},{text:'1. Introduction'},{text:'We sampled 20 sites and compared the results.'}])]).pages[0];
 assert.notEqual(p.kind,'contents');assert.equal(p.blocks.find(b=>b.text.startsWith('The contents')).skipReason,null);
});
test('independent captions are not merged and worker-only breaks within captions are repaired',()=>{
 const p=L.finalize([synthetic([{text:'Figure 1.1: First explanatory caption',end:true},{text:'continues with important details.',end:true},{text:'Figure 1.2: Second caption.',end:true},{text:'The next body paragraph starts here.',y:675}])]).pages[0];
 assert.equal(p.blocks[0].text,'Figure 1.1: First explanatory caption continues with important details.');assert.equal(p.blocks[0].skipReason,null);
 assert.equal(p.blocks[1].role,'caption');assert.ok(p.blocks[1].text.startsWith('Figure 1.2:'));assert.equal(p.blocks[2].role,'body');
});
test('outline promotion never turns table or figure labels into translatable headings',()=>{
 const d=gpt.pages[1],p=L.parsePage(d,{outline:[{title:'Contents'}],operatorList:d.operatorList});assert.equal(p.blocks[0].role,'contents');
});
