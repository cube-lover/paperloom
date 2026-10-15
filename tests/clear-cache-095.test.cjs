const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHarness}=require('./harness.cjs'),L=require('../addon/content/layout'),Evidence=require('../addon/content/graphic-evidence');
async function setup(t){const h=await createHarness(t);for(const f of ['graphics','checkpoint'])vm.runInContext(fs.readFileSync(require.resolve('../addon/content/'+f+'.js'),'utf8'),h.context);h.context.PaperLoomGraphics.attach(h.app,h.C,L);h.context.CubeCheckpoint.attach(h.app);return h;}
test('cleared translation scope ignores old disk cache without deleting another page cache',async t=>{
 const {app}=await setup(t);let calls=0;app.completion=async()=>++calls===1?'旧缓存译文':'重新翻译的结果';const text='A complete source paragraph.';
 const old=await app.translate(text,app.config);assert.equal(old.text,'旧缓存译文');
 const fresh=await app.translate(text,app.config,'',undefined,{cacheScope:'clear-fixture'});assert.equal(fresh.text,'重新翻译的结果');assert.equal(calls,2);
 const untouched=await app.translate(text,app.config);assert.equal(untouched.text,'旧缓存译文');assert.equal(calls,2);
 const retry=await app.translate(text,app.config,'',undefined,{cacheScope:'clear-fixture'});assert.equal(retry.cached,true);assert.equal(calls,2);
});
test('fresh scope never coalesces with an older in-flight result',async t=>{
 const {app}=await setup(t);let release,entered;const ready=new Promise(r=>entered=r);let calls=0;
 app.completion=async()=>{if(++calls===1){entered();await new Promise(r=>release=r);return '旧请求';}return '新请求';};
 const old=app.translate('Same text',app.config);await ready;const fresh=app.translate('Same text',app.config,'',undefined,{cacheScope:'new-clear'});release();
 assert.equal((await old).text,'旧请求');assert.equal((await fresh).text,'新请求');assert.equal(calls,2);
});
test('clear current page assigns fresh durable scope and does not touch another page',async t=>{
 const {app}=await setup(t),reader={itemID:1},a={id:'a',pageIndex:0,text:'Label',target:'旧标签',selected:true,quad:[[0,0],[10,0],[10,10],[0,10]]},b={...a,id:'b',pageIndex:1,target:'保留'};
 const g={reader,rows:[a,b],paint(){},update(){}},r={id:'p',text:'Prose',target:'旧正文',status:'done',layout:{pageIndex:0}},other={...r,id:'q',target:'另一页',layout:{pageIndex:1}};
 app.graphicSessions.set(reader,g);app.inplace=new Map([[reader,{stage:'ready',records:new Map([['p',r],['q',other]]),paint(){},update(){},enqueue(){}}]]);app.saveGraphics=async()=>{};app.saveInPlaceCheckpoint=async()=>{};
 await app.clearTranslations(reader,{pageIndex:0});assert.ok(r.translationEpoch);assert.equal(a.translationEpoch,r.translationEpoch);assert.equal(r.target,'');assert.equal(a.target,'');assert.equal(b.target,'保留');assert.equal(other.target,'另一页');assert.equal(b.translationEpoch,undefined);
 const first=r.translationEpoch;await app.clearTranslations(reader,{all:true});assert.ok(b.translationEpoch);assert.notEqual(r.translationEpoch,first);assert.equal(r.history.length,1);
});
test('chart retranslation uses cleared scope rather than old cached label',async t=>{
 const {app}=await setup(t),reader={itemID:1},r={id:'g',pageIndex:0,text:'Power grid',target:'',selected:true,quad:[[0,0],[50,0],[50,10],[0,10]],translationEpoch:'clear-chart'};
 const g={reader,rows:[r],paint(){},update(){}};app.graphicSessions.set(reader,g);app.saveGraphics=async()=>{};
 let received;app.translate=async(...args)=>{received=args[4];return {text:'新标签',warnings:[]};};await app.translateGraphics(g,{rows:[r],cfg:{...app.config,confirmBeforeSend:false}});
 assert.equal(received?.cacheScope,'clear-chart');assert.equal(r.target,'新标签');
});
test('cleared pending prose never reuses a caption stored by a separate graphic path',async t=>{
 const {app}=await setup(t),r={status:'pending',text:'Caption',target:'',clearedAt:'old-clear',translationEpoch:'clear',layout:{pageIndex:0,inkRect:[0,0,100,20]}};
 app.graphicSession=async()=>({rows:[{id:'g',pageIndex:0,text:'Caption',target:'旧图注',origin:'PDF-caption',quad:[[0,0],[100,0],[100,20],[0,20]]}]});
 await app.reuseGraphicTranslations({reader:{},cfg:{},records:new Map([['p',r]])});assert.equal(r.target,'');assert.equal(r.status,'pending');
});
test('flow regrouping carries the pending clear scope to new geometry',()=>{
 const old={id:'old',pageIndex:0,text:'Power grid',target:'',translationEpoch:'clear-node',quad:[[10,10],[60,10],[60,20],[10,20]]},next={id:'new',pageIndex:0,text:'Power grid',quad:[[5,5],[65,5],[65,25],[5,25]]};
 Evidence.adoptFlowNode([old],next);assert.equal(next.translationEpoch,'clear-node');assert.equal(old.translationEpoch,'clear-node');
});
