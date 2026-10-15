const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../scripts/cube-dev-protocol.cjs'),{createHarness}=require('./harness.cjs');
const request=()=>({version:1,sessionId:'session-fixture',id:'job-'+'a'.repeat(32),action:'status',createdAt:100000});
test('dev channel only accepts explicit actions and fresh session-bound requests',()=>{
 for(const action of P.ACTIONS){const r={...request(),action};if(['native-page','inspect-page','refresh-page','translate-page','repair-flow-page'].includes(action))Object.assign(r,{itemID:594,pageIndex:18});if(['resume-article','open-reader','audit-interaction','inspect-reader-ui','region-translate','region-shortcut'].includes(action))r.itemID=594;if(action==='ocr-install-folder')r.path='D:/tmp/ocr-runtime';if(action==='graphics-rows')Object.assign(r,{itemID:594,pageIndex:18});if(action==='graphics-forget')Object.assign(r,{itemID:594,rect:'abc,def'});if(action==='graphics-purge-page')Object.assign(r,{itemID:594,pageIndex:18,rect:'OCR'});if(action==='graphics-preview')Object.assign(r,{itemID:594,pageIndex:18,rect:'2'});if(action==='region-badge')Object.assign(r,{itemID:594});if(action==='region-select')Object.assign(r,{itemID:594,pageIndex:18,rect:'10 10 200 200'});if(action==='region-badge-demo')Object.assign(r,{itemID:594,pageIndex:18});if(action==='clear-translations')Object.assign(r,{itemID:594,rect:'page'});
if(action==='menu-click')Object.assign(r,{itemID:594,rect:'clear-page'});
if(action==='keyset-fire')Object.assign(r,{itemID:594});
if(action==='region-key-audit')Object.assign(r,{itemID:594});
if(action==='key-watch')Object.assign(r,{itemID:594,rect:'report'});
if(action==='selftest-interaction')Object.assign(r,{itemID:594});
if(action==='region-key-probe')Object.assign(r,{itemID:594});
assert.equal(P.validateRequest(r,'session-fixture',100010).action,action);}
 for(const patch of [{action:'eval'},{script:'arbitrary.js'},{code:'1+1'},{action:'translate'},{createdAt:1},{sessionId:'old'},{id:'../file'},{version:2},{itemID:1},{action:'native-page'},{action:'native-page',itemID:1,pageIndex:-1}])assert.throws(()=>P.validateRequest({...request(),...patch},'session-fixture',100010));
});
test('development channel is build-gated and has no generic evaluator or listener',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../addon/content/dev-channel.js'),'utf8');
 assert.doesNotMatch(code,/\beval\s*\(|new Function\s*\(|nsIServerSocket|loadSubScript/);assert.match(code,/2\*60\*60\*1000/);assert.match(code,/seen\.has\(r.id\)/);
 const bootstrap=fs.readFileSync(path.join(__dirname,'../addon/bootstrap.js'),'utf8');assert.match(bootstrap,/CubeDevelopmentBuild\?\.enabled === true/);
 const build=fs.readFileSync(path.join(__dirname,'../scripts/build.cjs'),'utf8');assert.match(build,/--dev/);assert.match(build,/dev-channel.js/);
});
test('development mailbox auto-starts, handles status and shutdown without UI',async t=>{
 const {app,context,dir,IOUtils,Zotero}=await createHarness(t);Zotero.Reader._readers=[];
 // Deterministic timers: drive the real host handler explicitly in this unit test.
 context.setTimeout=()=>1;context.clearTimeout=()=>{};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../addon/content/dev-channel.js'),'utf8'),context);context.CubeDevChannel.attach(app);
 const folder=path.join(dir,'mailbox');await app.startDevChannel({directory:folder});const session=JSON.parse(await IOUtils.readUTF8(path.join(folder,'session.json')));
 const id='job-'+'a'.repeat(32);await IOUtils.writeUTF8(path.join(folder,'request.json'),JSON.stringify({version:1,sessionId:session.sessionId,id,createdAt:Date.now(),action:'status'}));
 await app.devChannel.tick();const result=JSON.parse(await IOUtils.readUTF8(path.join(folder,id+'.json')));assert.equal(result.ok,true);assert.equal(result.state,'complete');assert.equal(result.result.requests,0);assert.deepEqual(result.result.readers,[]);
 await app.stopDevChannel();assert.equal(await IOUtils.exists(path.join(folder,'session.json')),false);assert.equal(app.devChannel.stopped,true);
});

test('key watch is observation only and validates explicit modes',()=>{
 for(const rect of ['start','report','stop'])assert.equal(P.validateRequest({...request(),action:'key-watch',itemID:521,rect},'session-fixture',100010).rect,rect);
 for(const rect of ['activate','eval','',{},['start']])assert.throws(()=>P.validateRequest({...request(),action:'key-watch',itemID:521,rect},'session-fixture',100010));
 const code=fs.readFileSync(path.join(__dirname,'../addon/content/dev-channel.js'),'utf8');
 assert.doesNotMatch(code,/addSystemEventListener|setAttribute\('oncommand'/);
});
