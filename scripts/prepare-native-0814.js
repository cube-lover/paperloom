var CubePrepareNative0814Promise=(async()=>{
 const h=Zotero.getMainWindow(),a=Zotero.PaperLoom,io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),sleep=ms=>new Promise(r=>h.setTimeout(r,ms));
 const report={at:new Date().toISOString(),version:a?.version,passed:false,readers:[]};
 try{
  for(const [r] of a.inplace||[])a.pauseInPlace(r,true);
  for(const [,g] of a.graphicSessions||[]){g.control.stopped=true;g.control.process?.kill();g.control.renderTask?.cancel();for(const req of g.control.requests||[])req.abort();}
  for(let i=0;i<1200&&(a.allRequests.size||[...a.inplace.values()].some(s=>s.workers)||[...a.graphicSessions.values()].some(g=>g.busy));i++)await sleep(100);
  if(a.allRequests.size||[...a.inplace.values()].some(s=>s.workers)||[...a.graphicSessions.values()].some(g=>g.busy))throw Error('Active work remains');
  await a.flushCheckpoints();for(const [,g]of a.graphicSessions)await a.saveGraphics(g);await a.writeChain;
  const archive={at:report.at,version:a.version,sessions:[...a.inplace].map(([r,s])=>({itemID:r.itemID,paused:s.paused,records:[...s.records.values()].map(v=>({id:v.id,text:v.text,target:v.target,status:v.status,edited:!!v.edited,pageIndex:v.layout.pageIndex,layout:v.layout,alignment:v.alignment||null}))})),graphics:[...a.graphicSessions].map(([r,g])=>({itemID:r.itemID,file:g.file,fingerprint:g.fingerprint,replace:g.replace,hidden:g.hidden,rows:g.rows.map(({element,...v})=>v)}))};
  const dir=local('validation/native-0814');await io.makeDirectory(dir,{ignoreExisting:true});
  report.archive='validation/native-0814/pre-'+Date.now()+'.json';await io.writeUTF8(local(report.archive),JSON.stringify(archive));
  for(const r of Zotero.Reader._readers){const s=a.inplace?.get(r),w=r._internalReader?._primaryView?._iframeWindow,pdf=w?.PDFViewerApplication?.pdfDocument,item=Zotero.Items.get(r.itemID),path=await item?.getFilePathAsync?.();report.readers.push({itemID:r.itemID,key:item?.key,pathExists:!!path&&await io.exists(path),hasSession:!!s,pages:pdf?.numPages,stats:s?a.inplaceStats(r):null,pdfjs:typeof w?.pdfjsLib?.getDocument});
   if(r.itemID===594&&pdf){const bytes=await pdf.getData();report.sourceFile='validation/native-0814/source-594.pdf';await io.write(local(report.sourceFile),new Uint8Array(bytes));report.sourceBytes=bytes.length;report.fingerprint=pdf.fingerprints?.[0];report.sourceSHA256=Array.from(new Uint8Array(await h.crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),v=>v.toString(16).padStart(2,'0')).join('');}
  }
  report.providerRequests=a.allRequests.size;report.passed=!!report.sourceFile&&report.providerRequests===0;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/prepare-native-0814.json'),JSON.stringify(report,null,2));return report;
})();
