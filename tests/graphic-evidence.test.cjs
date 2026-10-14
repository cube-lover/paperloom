const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../addon/content/graphic-evidence.js');
const q=x=>[[x,20],[x+90,20],[x+90,10],[x,10]];
const old=()=>({id:'old',pageIndex:2,text:'Native label',target:'人工校订',edited:true,history:[{target:'旧译文'}],quad:q(10),origin:'OCR',score:.99});
const next=()=>({id:'new',pageIndex:2,text:'Native label',quad:q(10.5),sourceQuad:q(10.5),origin:'PDF',score:1,background:null,directionVerified:true,autoValidated:false});
test('complex background evidence refresh preserves target, edits, source ID and translation history',()=>{
 const a=old(),b=next();const out=E.reconcile([a],[b]);assert.deepEqual(out.updates,['old']);assert.equal(a.origin,'PDF');assert.equal(a.background,null);assert.equal(a.target,'人工校订');assert.equal(a.id,'old');assert.equal(a.edited,true);assert.deepEqual(a.history,[{target:'旧译文'}]);assert.equal(a.geometryHistory[0].evidence.origin,'OCR');assert.equal(a.geometryRevision,1);
});
test('changed text, different page, low confidence and ambiguous split/merge never rebind a translation',()=>{
 for(const patch of [{text:'Other'},{pageIndex:3},{score:.5},{directionVerified:false},{quad:q(200)}]){const a=old();assert.deepEqual(E.reconcile([a],[{...next(),...patch}]).updates,[]);assert.equal(a.origin,'OCR');}
 const a=old();assert.deepEqual(E.reconcile([a,{...a,id:'duplicate'}],[next()]).updates,[]);assert.deepEqual(E.reconcile([a],[next(),{...next(),id:'second'}]).updates,[]);
});
test('approved or review-pending geometry remains untouched with a separate suggestion',()=>{
 for(const flag of ['approved','review']){const a={...old(),[flag]:true},out=E.reconcile([a],[next()]);assert.equal(out.updates.length,0);assert.equal(out.suggestions.length,1);assert.equal(a.origin,'OCR');assert.equal(a.target,'人工校订');}
});

test('flow-node migration archives fragments without concatenating their translations or changing manual records',()=>{const a=old(),b={...next(),id:'node',flowNode:true,text:'Native label second',quad:[[5,25],[110,25],[110,5],[5,5]],target:''};a.edited=false;const out=E.adoptFlowNode([a],b);assert.equal(out.archived,1);assert.equal(a.target,'人工校订');assert.equal(a.legacyLayout,true);assert.equal(b.target,'');const manual=old();assert.equal(E.adoptFlowNode([manual],{...b,id:'node2'}).blocked,true);assert.equal(manual.legacyLayout,undefined);assert.equal(manual.target,'人工校订');});

test('verified axis title replaces split OCR only with geometric containment, never a manual edit',()=>{const a={...old(),edited:false,text:'Score',quad:q(10),score:.99},b={...a,id:'fragment',text:'nent',review:true},n={...next(),id:'axis',origin:'OCR',text:'Sentiment Score',rotation:270};assert.equal(E.adoptAxisTitle([a,b],n).archived,2);assert.equal(a.target,'人工校订');const manual={...a,legacyLayout:false,edited:true};assert.equal(E.adoptAxisTitle([manual,{...b,legacyLayout:false}],n).blocked,true);assert.equal(manual.legacyLayout,false);});

test('node migration uses ink ownership even when old display padding straddles border',()=>{
 const a={...old(),edited:false,quad:[[5,30],[110,30],[110,1],[5,1]],sourceQuad:q(10)},n={id:'node',pageIndex:2,flowNode:true,text:'Complete node',quad:[[5,24],[110,24],[110,6],[5,6]]};
 const out=E.adoptFlowNode([a],n);assert.equal(out.archived,1);assert.equal(a.target,'人工校订');
});

test('strong agreeing upright reading resolves only automatic review while keeping source and target intact',()=>{
 const a={...old(),text:'Native labels',edited:false,review:true},b={...next(),text:'Native labels',orientationAgreement:1,directionMargin:.6,score:.99};
 const out=E.reconcile([a],[b]);assert.equal(out.updates.length,1);assert.equal(a.review,false);assert.equal(a.text,'Native labels');assert.equal(a.target,'人工校订');
 for(const field of ['approved','edited']){const r={...old(),text:'Native labels',review:true,[field]:true};const out=E.reconcile([r],[b]);assert.equal(out.updates.length,0);assert.equal(r.review,true);}
});
