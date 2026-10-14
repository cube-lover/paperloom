/* Restore archived translations on the installed runtime. No provider; combined paragraphs concatenate unchanged archived targets. */
var PaperLoomRestorePromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/';
 const local=p=>(root+p).replace(/\//g,'\\'),report={at:new Date().toISOString(),version:app?.version,pid:h.Services.appinfo.processID,root:app?.runtimeRoot,items:[],passed:false};
 const sleep=ms=>new Promise(res=>h.setTimeout(res,ms));
 try{
  if(app?.version!=='0.7.3'||!app.runtimeRoot.startsWith('jar:')||app.stopped)throw Error('Expected installed 0.7.3');
  app.inplace ||= new Map();
  if(app.allRequests.size||[...app.inplace.values()].some(s=>s.workers||s.stage==='parsing'))throw Error('Active session');
  const saved=JSON.parse(await io.readUTF8(local('validation/layout-source-audit/pre-073-install-sessions.json'))).sessions;
  const previous=JSON.parse(await io.readUTF8(local('validation/layout-source-audit/pre-release-sessions-1791721791313.json')));
  const current=[...app.inplace].map(([r,s])=>({itemID:r.itemID,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited}))}));
  if(current.length)await io.writeUTF8(local('validation/layout-source-audit/pre-073-restore-'+Date.now()+'.json'),JSON.stringify(current,null,2));
  for(const itemID of [474,381]){
   const archive=saved.find(s=>s.itemID===itemID)||previous.find(s=>s.itemID===itemID);if(!archive)throw Error('Missing archive '+itemID);
   const records=archive.records,canon=t=>String(t).replace(/\s+/g,'');
   const candidates=new Map();for(let i=0;i<records.length;i++){let text='',target='',ids=[];for(let j=i;j<Math.min(records.length,i+5);j++){
    const a=records[j];if(a.status!=='done')break;text+=canon(a.text);target+=(target?'\n':'')+a.target;ids.push(a.id);if(!candidates.has(text))candidates.set(text,{target,ids:[...ids],edited:records.slice(i,j+1).some(r=>r.edited)});
   }}
   const r=await Zotero.Reader.open(itemID,{pageIndex:0});await Promise.race([r._initPromise,sleep(30000).then(()=>{throw Error('Reader init timeout');})]);
   if(app.inplace.has(r))app.clearInPlace(r);
   const entry={itemID,archiveRecords:records.length,calls:0,unmatched:[],merged:[],preserved:[]};report.items.push(entry);
   const s=await app.translateInPlace(r,{translateBlock:async text=>{entry.calls++;const match=candidates.get(canon(text));if(!match){entry.unmatched.push(text.slice(0,120));throw Error('No archived translation match');}return {text:match.target};}});
   s.enqueueAll();for(let i=0;i<600&&(s.workers||s.queue.length||s.dirty.size||s.renderTimer);i++)await sleep(50);
   for(const v of s.records.values()){const m=candidates.get(canon(v.text));if(m){v.edited=m.edited;entry.preserved.push({id:v.id,from:m.ids});if(m.ids.length>1)entry.merged.push({id:v.id,from:m.ids});}}
   entry.stats=app.inplaceStats(r);entry.toolbar=r._iframeWindow.document.querySelectorAll('.pl-main-button').length;
   if(entry.stats.pending||entry.stats.error||entry.stats.running)throw Error('Archive replay incomplete '+itemID);
   const bar=r._iframeWindow.document.querySelector('.pl-inplace-controls');if(bar){const tag=bar.ownerDocument.createElement('strong');tag.textContent='既有译文恢复 · 排版修复版 '+app.version;bar.prepend(tag);}
  }
  report.passed=report.items.every(x=>!x.unmatched.length&&x.toolbar===1&&x.stats.done===x.stats.total)&&app.allRequests.size===0;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/layout-source-audit/restore-073.json'),JSON.stringify(report,null,2));return {passed:report.passed,error:report.error};
})();
