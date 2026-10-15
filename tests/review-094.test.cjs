const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHarness}=require('./harness.cjs'),L=require('../addon/content/layout'),Ink=require('../addon/content/graphic-ink');
async function setup(t){const h=await createHarness(t);for(const f of ['graphics','inplace','dev-channel'])vm.runInContext(fs.readFileSync(require.resolve('../addon/content/'+f+'.js'),'utf8'),h.context);h.context.PaperLoomGraphics.attach(h.app,h.C,L);h.context.PaperLoomInPlace.attach(h.app,h.C,L);h.context.CubeDevChannel.attach(h.app);h.app.inplace=new Map();return h;}
test('clear retry persists already-cleared targets and history after a transient disk failure',async t=>{
 const {app}=await setup(t),reader={},row={id:'g',text:'Label',target:'manual',pageIndex:0,history:[]};
 const g={reader,rows:[row],paint(){},update(){}};app.graphicSessions.set(reader,g);
 let attempts=0,saved;app.saveGraphics=async s=>{if(++attempts===1)throw Error('disk full');saved=JSON.parse(JSON.stringify(s.rows));};
 await assert.rejects(app.clearTranslations(reader,{pageIndex:0}),/disk full/);
 await app.clearTranslations(reader,{pageIndex:0});assert.equal(attempts,2);assert.equal(saved[0].target,'');assert.equal(saved[0].history.length,1);assert.equal(saved[0].history[0].target,'manual');
});
test('clear refuses a background page job that has not acquired the graphic session yet',async t=>{
 const {app}=await setup(t),reader={},r={target:'keep',layout:{pageIndex:0}};
 app.inplace.set(reader,{stage:'ready',records:new Map([['p',r]]),graphicJob:{busy:true,pause(){}},paint(){},update(){}});
 await assert.rejects(app.clearTranslations(reader,{pageIndex:0}),/暂停/);assert.equal(r.target,'keep');
});
test('pause cancels queued manual regions and aborts their owned work',async t=>{
 const {app}=await setup(t),reader={},control={stopped:false,requests:new Set()},g={reader,rows:[],regionQueue:[{pageIndex:1}],regionRunning:true,regionControl:control,control,update(){}};
 let aborted=0;control.requests.add({abort(){aborted++;}});app.graphicSessions.set(reader,g);app.inplace.set(reader,{paused:false,update(){},graphicJob:{pause(){}},settle(){}});
 app.pauseInPlace(reader,true);assert.equal(g.regionPaused,true);assert.equal(g.regionQueue.length,0);assert.equal(control.stopped,true);assert.equal(aborted,1);
});
test('queue rechecks ownership if background work starts while idle promise resolves',async t=>{
 const {app}=await setup(t),reader={},g={reader,rows:[],busy:false,regionQueue:[{pageIndex:0}],update(){},paint(){}};app.graphicSessions.set(reader,g);app.showRegionBadge=()=>{};
 let waits=0,runs=0;app.waitGraphicIdle=async()=>{if(++waits===1){g.busy=true;return true;}return false;};app.recognizeGraphicRegion=async()=>runs++;
 await app.pumpRegionQueue(g);assert.equal(runs,0);assert.equal(g.busy,true,'must not release another job ownership');
});
test('explicitly selecting an old shortcut is honored and menu labels refresh',async t=>{
 const {app}=await setup(t);const label={textContent:''},reader={};app.readerButtons=new Map([[reader,new Set([{regionShortcutItem:label}] )]]);
 for(const spec of ['Alt+R','Alt+R, Ctrl+Alt+R','F9','']){assert.equal(app.setReaderShortcut(spec),spec);assert.equal(app.readerShortcut(),spec);assert.equal(label.textContent,'框选翻译（补漏）…'+(spec?'  '+spec.split(',')[0]:''));}
});
test('clear diagnostic never falls back to a different open paper',async t=>{
 const {app,Zotero}=await setup(t);Zotero.Reader._readers=[{itemID:1}];let cleared=false;app.clearTranslations=async()=>{cleared=true;return {};};
 await assert.rejects(app.devClearTranslations(999,'all'),/reader|Reader/);assert.equal(cleared,false);
});
test('glyph mask preserves adjacent coloured curve and distant tiny data marker',()=>{
 const w=80,h=28,data=new Uint8ClampedArray(w*h*4).fill(255),put=(x,y,c)=>data.set([...c,255],(y*w+x)*4);
 for(let y=8;y<19;y++)for(let x=20;x<24;x++)put(x,y,[20,20,20]);
 for(let x=5;x<70;x++)put(x,6,[230,40,60]);
 put(65,20,[10,100,220]);put(66,20,[10,100,220]);put(65,21,[10,100,220]);
 for(const opts of [{},{flatFill:true}]){const m=Ink.mask({width:w,height:h,data},opts);if(!m)continue;
  for(const [x,y]of [[21,6],[65,20],[66,20],[65,21]])assert.deepEqual(Array.from(m.data.slice((y*w+x)*4,(y*w+x)*4+4)),Array.from(data.slice((y*w+x)*4,(y*w+x)*4+4)),'non-text colour must remain unchanged');
 }
});

test('destructive development actions reject invalid scopes and unexpected page parameters',()=>{
 const P=require('../scripts/cube-dev-protocol.cjs'),r={version:1,sessionId:'test',id:'job-'+'b'.repeat(32),createdAt:100,action:'clear-translations',itemID:1};
 for(const rect of ['page','all'])assert.equal(P.validateRequest({...r,rect},'test',100).rect,rect);
 for(const patch of [{},{rect:'ALL'},{rect:'unknown'},{rect:'all',pageIndex:2},{action:'menu-click',rect:'anything'},{action:'region-key-install'}])assert.throws(()=>P.validateRequest({...r,...patch},'test',100));
});
