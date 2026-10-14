#!/usr/bin/env node
'use strict';
// Development CLI: local mailbox, no Zotero credentials or network connection.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {ACTIONS,validateRequest}=require('./cube-dev-protocol.cjs');
const dir=path.resolve(__dirname,'../.local/dev-channel'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const action=process.argv[2];if(!ACTIONS.includes(action)){console.log('Usage: node scripts/cube-dev.cjs '+ACTIONS.join('|'));process.exitCode=action?1:0;return;}
 let session;try{session=JSON.parse(await fs.readFile(path.join(dir,'session.json'),'utf8'));}catch{throw Error('No active development build. Install the explicitly built -dev XPI through Zotero; its startup creates the channel automatically');}
 if(Date.now()>=session.expiresAt)throw Error('Development channel expired; reload the development build through Zotero');
 const id='job-'+crypto.randomBytes(16).toString('hex'),req={version:1,sessionId:session.sessionId,id,action,createdAt:Date.now()};
 if(['native-page','inspect-page','refresh-page','translate-page','repair-flow-page'].includes(action)){req.itemID=Number(process.argv[3]);req.pageIndex=Number(process.argv[4])-1;}
 if(['resume-article','open-reader','audit-interaction','inspect-reader-ui'].includes(action))req.itemID=Number(process.argv[3]);
 if(['region-translate','region-shortcut'].includes(action)){req.itemID=Number(process.argv[3]);req.pageIndex=Number(process.argv[4])-1;if(process.argv[5])req.rect=process.argv.slice(5,9).map(Number);}
 if(action==='ocr-install-folder')req.path=process.argv[3]||'';
 if(action==='graphics-rows'){req.itemID=Number(process.argv[3]);req.pageIndex=Number(process.argv[4])-1;}
 if(action==='graphics-forget'){req.itemID=Number(process.argv[3]);req.rect=process.argv.slice(4).join(',');}
 if(action==='graphics-purge-page'){req.itemID=Number(process.argv[3]);req.pageIndex=Number(process.argv[4])-1;req.rect=process.argv[5]||'';}
 if(action==='graphics-preview'){req.itemID=Number(process.argv[3]);req.pageIndex=Number(process.argv[4])-1;req.rect=process.argv[5]||'';}
 if(action==='region-badge'){req.itemID=Number(process.argv[3]);}
 if(action==='region-select'){req.itemID=Number(process.argv[3]);req.pageIndex=Number(process.argv[4])-1;req.rect=process.argv.slice(5).join(' ');}
 if(action==='region-badge-demo'){req.itemID=Number(process.argv[3]);req.pageIndex=Number(process.argv[4])-1;}
 validateRequest(req,session.sessionId);
 const lock=await fs.open(path.join(dir,'cli.lock'),'wx').catch(()=>{throw Error('Another CLI request is active; inspect it before removing cli.lock');});
 const temp=path.join(dir,id+'.request.tmp'),request=path.join(dir,'request.json');
 try{
  for(const f of ['request.json','active.json'])try{await fs.access(path.join(dir,f));throw Error('Host already has an active request');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.writeFile(temp,JSON.stringify(req));await fs.rename(temp,request);
  const deadline=Date.now()+(action==='status'||action==='stop'?10000:180000);
  while(Date.now()<deadline){
   try{const out=JSON.parse(await fs.readFile(path.join(dir,id+'.json'),'utf8'));if(out.id!==id)throw Error('Job ID mismatch');if(out.state==='complete'){console.log(JSON.stringify(out,null,2));if(!out.ok||out.result?.passed===false)process.exitCode=1;return;}}
   catch(e){if(e.code!=='ENOENT')throw e;}
   await sleep(100);
  }
  throw Error('Timed out waiting for host; do not repeat a mutating job until its result is checked: '+id);
 }finally{await lock.close();await fs.unlink(path.join(dir,'cli.lock')).catch(()=>{});await fs.unlink(temp).catch(()=>{});}
}
main().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;});
