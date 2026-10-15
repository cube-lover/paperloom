const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),{createHarness}=require('./harness.cjs');
async function setup(t){const h=await createHarness(t);vm.runInContext(await fs.readFile(path.resolve(__dirname,'../addon/content/checkpoint.js'),'utf8'),h.context);h.context.CubeCheckpoint.attach(h.app);return h;}
function session(){const reader={itemID:123,_internalReader:{}},pdf={fingerprints:['doc-test']};return {reader,pdf,stage:'ready',fontScale:1,records:new Map([['a',{id:'a',text:'Same source',target:'用户校订',status:'done',edited:true,layout:{pageIndex:4,inkRect:[1,2,3,4],rect:[1,2,3,4]}}]])};}
test('checkpoint snapshots before async teardown, excludes credentials/config and writes prior backup',async t=>{const {app,dir}=await setup(t),s=session();s.cfg={token:'not-a-real-secret'};const saving=app.saveInPlaceCheckpoint(s);s.records.clear();await saving;const id=await app.checkpointIdentity(s.reader,s.pdf),file=path.join(app.dir,id.file),data=JSON.parse(await fs.readFile(file));assert.equal(data.records[0].target,'用户校订');assert.equal(data.records[0].edited,true);assert.equal(data.paused,true);assert.equal('cfg' in data,false);assert.equal('token' in data,false);s.records=session().records;await app.saveInPlaceCheckpoint(s);assert.ok(await fs.stat(file+'.bak'));});
test('explicit clear tombstones checkpoint rather than restoring a cleared session',async t=>{const {app,dir}=await setup(t),s=session();app.inplace=new Map([[s.reader,s]]);app.clearInPlace=()=>{s.records.clear();app.inplace.delete(s.reader);};app.discardInPlace(s.reader);await new Promise(r=>setTimeout(r,20));const id=await app.checkpointIdentity(s.reader,s.pdf),data=JSON.parse(await fs.readFile(path.join(app.dir,id.file)));assert.equal(data.active,false);assert.equal(data.records.length,1);assert.equal(s.checkpointDisabled,true);});
test('fingerprint identity distinguishes replacement PDFs for the same item',async t=>{const {app}=await setup(t),s=session();assert.notEqual((await app.checkpointIdentity(s.reader,s.pdf)).file,(await app.checkpointIdentity(s.reader,{fingerprints:['replacement']})).file);assert.equal(await app.checkpointIdentity(s.reader,{}),null);});
test('automatic restore uses exact checkpoint, pauses, and never dispatches translation',async t=>{const {app}=await setup(t),s=session();s.reader._internalReader._primaryView={_iframeWindow:{PDFViewerApplication:{pdfDocument:s.pdf,pdfViewer:{currentPageNumber:1}},document:{querySelector:()=>null}}};s.pdf.getPageData=()=>{};await app.saveInPlaceCheckpoint(s);let calls=0,restored;app.inplace=new Map();app.translateInPlace=async(r,o)=>{calls++;assert.equal(o.startPaused,true);assert.equal(o.restoredRecords[0].target,'用户校订');restored={...s,repaint(){},rescan(){}};app.inplace.set(r,restored);return restored;};app.scheduleReaderRestore(s.reader);await new Promise(r=>setTimeout(r,1350));assert.equal(calls,1);assert.equal(restored.restoredFromCheckpoint.previousDone,1);await app.flushCheckpoints();});

test('graphics checkpoint persists completed/failed pages and restores only same-engine progress',async t=>{const {app}=await setup(t),s=session();app.version='fixture-engine';s.pdf.numPages=3;s.pdf.getPageData=()=>{};s.graphicJob={completed:new Set([0]),failed:new Map([[1,'retry']]),pending:new Set([2])};s.reader._internalReader._primaryView={_iframeWindow:{PDFViewerApplication:{pdfDocument:s.pdf,pdfViewer:{currentPageNumber:1}},document:{querySelector:()=>null}}};await app.saveInPlaceCheckpoint(s);app.inplace=new Map();let restored;app.translateInPlace=async(r)=>{restored={...s,repaint(){},rescan(){},graphicJob:{completed:new Set(),failed:new Map(),pending:new Set([0,1,2])}};app.inplace.set(r,restored);return restored;};app.scheduleReaderRestore(s.reader);await new Promise(r=>setTimeout(r,1350));assert.deepEqual([...restored.graphicJob.completed],[0]);assert.deepEqual([...restored.graphicJob.pending],[2]);assert.equal(restored.graphicJob.failed.get(1),'retry');await app.flushCheckpoints();});

// 版面解析缓存：指纹/页数/解析器版本都对得上才复用，否则必须重新解析。
test('layout cache is reused only for the same fingerprint, page count and parser version',async t=>{
  const {app}=await setup(t);
  const identity={fingerprint:'FP1',pages:3,file:'layout/abc.json'};
  assert.equal(await app.readLayoutCache(identity,3),null);
  const layouts=[1,2,3].map(i=>({index:i-1,lines:[],blocks:[]}));
  await app.writeLayoutCache(identity,3,layouts);
  const back=await app.readLayoutCache(identity,3);
  assert.equal(back.length,3);assert.equal(back[2].index,2);
  assert.equal(await app.readLayoutCache({...identity,fingerprint:'FP2'},3),null);
  assert.equal(await app.readLayoutCache(identity,4),null);
  const previous=app.layoutCacheVersion;app.layoutCacheVersion='pl-layout-cache-2';
  assert.equal(await app.readLayoutCache(identity,3),null);app.layoutCacheVersion=previous;
  await app.clearLayoutCache();
  assert.equal(await app.readLayoutCache(identity,3),null);
});

test('cleared prose history survives disk checkpoint without resurrecting target',async t=>{
 const {app}=await setup(t),s=session(),r=s.records.get('a');
 r.history=[{target:r.target,edited:true,alignment:{word:'retained'},reason:'cleared-by-user'}];r.target='';r.status='pending';r.edited=false;r.clearedAt='2026-10-15T00:00:00Z';r.translationEpoch='clear-checkpoint';
 await app.saveInPlaceCheckpoint(s);const id=await app.checkpointIdentity(s.reader,s.pdf),data=JSON.parse(await fs.readFile(path.join(app.dir,id.file)));
 assert.equal(data.records[0].target,'');assert.equal(data.records[0].clearedAt,r.clearedAt);assert.deepEqual(data.records[0].history,r.history);assert.equal(data.records[0].translationEpoch,r.translationEpoch);
});
