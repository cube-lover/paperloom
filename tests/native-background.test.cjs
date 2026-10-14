const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../addon/content/native-background.js'),G=require('../addon/content/graphics.js'),L=require('../addon/content/layout.js');
const {createHarness}=require('./harness.cjs'),{JSDOM}=require('jsdom');
const row=()=>({id:'g1',pageIndex:0,origin:'PDF-table',text:'Native label',target:'中文标签',score:1,quad:G.quad([10,20,110,40]),sourceQuad:G.quad([12,24,100,35]),directionVerified:true});
test('native artifacts only apply to the same source identity and current fingerprint',async t=>{
 const {app,C}=await createHarness(t);N.attach(app,C,L);const r=row(),s={fingerprint:'pdf',nativeBackgrounds:new Map()};
 const a={identity:N.identity(r),fingerprint:'pdf',verified:true,url:'data:image/png;base64,AA=='};s.nativeBackgrounds.set(r.id,a);assert.equal(app.nativeBackgroundFor(s,r),a);
 for(const patch of [{text:'different'},{quad:G.quad([10,20,111,40])},{sourceQuad:G.quad([11,24,100,35])},{review:true},{legacyLayout:true},{origin:'OCR'},{warnings:['number']},{preserveSource:true}])assert.equal(app.nativeBackgroundFor(s,{...r,...patch}),null);
 r.target='人工修订保留';assert.equal(app.nativeBackgroundFor(s,r),a);s.fingerprint='other';assert.equal(app.nativeBackgroundFor(s,r),null);
});
test('same-renderer pixel gate rejects changes outside erase region and size mismatch',()=>{
 const im=()=>({width:30,height:20,data:new Uint8ClampedArray(30*20*4).fill(255)}),a=im(),b=im();
 b.data[(5*30+6)*4]=0;assert.equal(N.pixelAudit(a,b,[[5,4,10,8]],{margin:0}).passed,true);
 assert.equal(N.pixelAudit(a,b,[]).passed,false);b.data[0]=0;assert.equal(N.pixelAudit(a,b,[[5,4,10,8]],{margin:0}).outsidePixels,1);
 assert.throws(()=>N.pixelAudit(a,{...b,width:1},[]));
 const composed=N.composeLocal(a,b,[[5,4,10,8]],{margin:0});assert.equal(composed.data[0],a.data[0]);assert.equal(composed.data[(5*30+6)*4],0);assert.equal(N.pixelAudit(a,composed,[[5,4,10,8]],{margin:0}).outsidePixels,0);
});
test('manifest evidence is bound to exact source, page, labels and all preservation checks',()=>{
 const r=row(),req={sourceSHA256:'a'.repeat(64),pageIndex:0,labels:[{id:r.id,text:r.text,sourceQuad:r.sourceQuad}]},m={version:1,engine:N.VERSION,sourceSHA256:req.sourceSHA256,pageIndex:0,coordinateSpace:'pdf-user-space',labels:[{...req.labels[0],eraseRect:[12,24,100,35]}],checks:{remainingCharactersUnchanged:true,drawingGeometryAndStyleUnchanged:true,imageHashesUnchanged:true,sourceUnchanged:true}};
 assert.equal(N.validateManifest(m,req),m);
 for(const patch of [{sourceSHA256:'b'.repeat(64)},{pageIndex:1},{labels:[]},{checks:{...m.checks,sourceUnchanged:false}}])assert.throws(()=>N.validateManifest({...m,...patch},req));
});
test('verified native background bypasses only white-paper gate; not collision or text fit',async t=>{
 const {app,C}=await createHarness(t);G.attach(app,C,L);N.attach(app,C,L);const dom=new JSDOM('<div></div>');t.after(()=>dom.window.close());const page=dom.window.document.querySelector('div'),r=row(),s={rows:[r],replace:true,fingerprint:'pdf',nativeBackgrounds:new Map()};
 s.nativeBackgrounds.set(r.id,{identity:N.identity(r),fingerprint:'pdf',verified:true,url:'data:image/png;base64,AA=='});app.measureInPlaceText=()=>({fits:true});
 let box=app.paintGraphicLabel(s,r,page,{transform:[1,0,0,-1,0,792]});assert.equal(box.dataset.mode,'replace');assert.equal(box.dataset.mask,'native-text-removed');assert.equal(box.textContent,r.target);assert.equal(box.querySelector('span').textContent,r.target);
 app.measureInPlaceText=()=>({fits:false});box=app.paintGraphicLabel(s,r,page,{transform:[1,0,0,-1,0,792]});assert.equal(box.dataset.mode,'hotspot');assert.equal(box.style.backgroundImage,'');
 assert.match(G.replacementReason({...r,nativeValidated:true},[{...r,id:'other',text:'Precision recall'}]),/相交/);
});
test('native job disposal stops pending rendering, invalidates artifacts and preserves translations',async t=>{
 const {app,C}=await createHarness(t);N.attach(app,C,L);let cancelled=0,killed=0;const r=row(),s={rows:[r],nativeBackgrounds:new Map([['x',{}]]),nativeControl:{process:{kill(){killed++;}},renderTasks:new Set([{cancel(){cancelled++;}}])}};app.closeNativeBackgrounds(s);assert.equal(cancelled,1);assert.equal(killed,1);assert.equal(s.nativeControl.stopped,true);assert.equal(s.nativeBackgrounds.size,0);assert.equal(r.target,'中文标签');
});
