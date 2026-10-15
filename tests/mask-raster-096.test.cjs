const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('../addon/content/graphics');
test('hires mask raster dimensions include viewport scale and preserve affine mapping',()=>{
 const quad=G.quad([10,20,66,26]);
 for(const transform of [[4,0,0,-4,0,400],[0,4,4,0,0,0],[1.5,0,0,-1.5,0,300]]){
  const f=G.maskRasterFrame(quad,transform);const p=G.project(quad,transform);
  assert.equal(f.width,Math.ceil(56*Math.hypot(p.matrix[0],p.matrix[1])));
  assert.equal(f.height,Math.ceil(6*Math.hypot(p.matrix[2],p.matrix[3])));
  const topLeft=G.point(f.transform,G.point(transform,quad[0]));assert.ok(Math.abs(topLeft[0])<1e-8&&Math.abs(topLeft[1])<1e-8);
  const bottomRight=G.point(f.transform,G.point(transform,quad[2]));assert.ok(Math.abs(bottomRight[0]-f.width)<1e-8&&Math.abs(bottomRight[1]-f.height)<1e-8);
 }
});
test('hires mask extracts all glyphs, not PDF-unit-sized corner of enlarged raster',async t=>{
 const {createHarness}=require('./harness.cjs'),{app,C}=await createHarness(t);G.attach(app,C);
 const calls=[],ctx={fillRect(){},setTransform(...a){calls.push(['transform',...a]);},drawImage(...a){calls.push(['draw',...a]);},getImageData(x,y,w,h){calls.push(['pixels',w,h]);return {width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)};}};
 const cv={getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,fixture'},s={doc:{createElement:()=>cv},reader:{},paint(){}};
 app.graphicHiResPage=async()=>({canvas:{width:1000,height:1000},viewport:{transform:[4,0,0,-4,0,1000]}});app.graphicFlatPaperColor=()=> '#fff';
 const old=global.CubeGraphicInk;global.CubeGraphicInk={mask:()=>null};t.after(()=>{global.CubeGraphicInk=old;clearTimeout(s.maskPaintTimer);});
 await app.buildGraphicMaskHiRes(s,{quad:G.quad([10,20,66,26]),origin:'PDF'}, {page:{render(){}}},0,'test');
 assert.deepEqual(calls.filter(c=>c[0]==='pixels').at(-1),['pixels',224,24]);
 assert.equal(calls.find(c=>c[0]==='draw').length,4,'draw full canvas through inverse affine transform');
});

test('glyph margin is display-only and respects native math neighbours',()=>{
 const row={origin:'PDF',quad:G.quad([10,20,66,26])},original=JSON.stringify(row);
 const expanded=G.bounds(G.paddedGlyphQuad(row));assert.deepEqual(expanded,[9.1,19.1,66.9,26.9]);
 const neighbour={quad:G.quad([66.4,20,69,25])},limited=G.bounds(G.paddedGlyphQuad(row,[neighbour]));
 assert.ok(limited[2]<=66.25+1e-8);assert.equal(JSON.stringify(row),original);
 const overlapping={quad:G.quad([65.8,20,69,25])};assert.equal(G.paddedGlyphQuad(row,[overlapping]),row.quad);
});
test('rotated glyph margin follows local axes; existing table and flow frames stay unchanged',()=>{
 const row={origin:'OCR',quad:[[10,20],[10,76],[16,76],[16,20]]};
 assert.deepEqual(G.bounds(G.paddedGlyphQuad(row)),[9.1,19.1,16.9,76.9]);
 for(const origin of ['PDF-table','PDF-text-table','PDF-caption']){const r={...row,origin};assert.equal(G.paddedGlyphQuad(r),r.quad);}
 const flow={...row,flowNode:true};assert.equal(G.paddedGlyphQuad(flow),flow.quad);
});
test('hires cache uses fixed PDF scale across reader zoom and honours rotation',async t=>{
 const {createHarness}=require('./harness.cjs'),{app,C}=await createHarness(t);G.attach(app,C);
 const params=[],canvases=[],win={Object,document:{createElement(){const c={getContext:()=>({})};canvases.push(c);return c;}}};
 const page={getViewport(a){params.push(a);return {width:600*a.scale,height:800*a.scale,transform:[a.scale,0,0,-a.scale,0,800*a.scale]};},render(){return {promise:Promise.resolve()};}};
 const pv=(scale,rotation=0)=>({pdfPage:page,viewport:{width:600*scale,height:800*scale,scale,rotation},div:{ownerDocument:{defaultView:win}}});
 const s={doc:{defaultView:win}},a=await app.graphicHiResPage(s,pv(1),0),b=await app.graphicHiResPage(s,pv(2),0);
 assert.equal(a,b);assert.equal(params.length,1);assert.equal(params[0].scale,4);assert.equal(a.canvas.width,2400);
 const c=await app.graphicHiResPage(s,pv(2,90),0);assert.notEqual(c,a);assert.equal(params[1].rotation,90);
});
test('padded erasure requires verified mask, otherwise keeps the unexpanded frame',async t=>{
 const {createHarness}=require('./harness.cjs'),{app,C}=await createHarness(t);G.attach(app,C);
 const ctx={fillRect(){},setTransform(){},drawImage(){},getImageData(x,y,w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)};},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};
 const cv={getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,fixture'},s={doc:{createElement:()=>cv},reader:{},paint(){}};
 app.graphicHiResPage=async()=>({canvas:{width:1000,height:1000},viewport:{transform:[4,0,0,-4,0,1000]}});app.graphicFlatPaperColor=()=> '#fff';
 const row={quad:G.quad([10,20,66,26]),origin:'PDF'},old=global.CubeGraphicInk;
 t.after(()=>{global.CubeGraphicInk=old;clearTimeout(s.maskPaintTimer);});
 global.CubeGraphicInk={mask:im=>({...im,uniform:true})};
 await app.buildGraphicMaskHiRes(s,row,{page:{render(){}}},0,'verified');assert.deepEqual(s.paintedMasks.get('verified').quad,G.paddedGlyphQuad(row));
 global.CubeGraphicInk={mask:()=>null};
 await app.buildGraphicMaskHiRes(s,row,{page:{render(){}}},0,'fallback');assert.equal(s.paintedMasks.get('fallback').quad,row.quad);
 assert.equal(s.paintedMasks.get('fallback').kind,'glyph-fill');
});
