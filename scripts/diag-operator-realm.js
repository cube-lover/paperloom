/* Read-only host probe. No hot reload, provider, configuration or credential access.
   Run with loadSubScriptWithOptions and await PaperLoomOperatorProbePromise.
   Explicit page requests only; does not change reader position. */
var PaperLoomOperatorProbePromise=(async()=>{
 const host=Zotero.getMainWindow(),Cu=host.Components.utils;
 const base='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/validation/layout-source-audit/';
 const path=base.split('/').join(String.fromCharCode(92));
 const reader=Zotero.Reader._readers.find(r=>r.itemID===474);
 if(!reader)return {ok:false,reason:'test-reader-not-open'};
 const report={host:Zotero.version,at:new Date().toISOString(),views:[]};
 for(const name of ['_primaryView','_secondaryView']){
  const win=reader._internalReader?.[name]?._iframeWindow;if(!win)continue;
  const pdf=win.PDFViewerApplication?.pdfDocument;if(!pdf)continue;
  const result={name,pages:[]};report.views.push(result);
  for(const number of [3,4,8]){
   const entry={number,variants:[]};result.pages.push(entry);
   let page;
   try{page=await pdf.getPage(number);}catch(e){entry.error={name:e.name,message:e.message};continue;}
   const variants=[['direct',()=>page],['wrappedJSObject',()=>page.wrappedJSObject],['waiveXrays',()=>Cu.waiveXrays(page)]];
   for(const [variant,get] of variants){
    const status={variant};entry.variants.push(status);
    try{
     const value=get();status.present=!!value;status.getOperatorList=typeof value?.getOperatorList;
     status.getViewport=typeof value?.getViewport;status.getTextContent=typeof value?.getTextContent;
     if(typeof value?.getOperatorList==='function'){
      const ops=await value.getOperatorList();status.operators=ops.fnArray.length;
      status.paths=ops.fnArray.map((n,i)=>[n,i]).filter(([n])=>n===91).slice(0,3).map(([,i])=>{
       const a=ops.argsArray[i];return {firstType:typeof a[0],bounds:a[2]?.length===4?Array.from(a[2]):null};
      });
     }
    }catch(e){status.error={name:e.name,message:e.message};}
   }
  }
 }
 await host.IOUtils.makeDirectory(path,{ignoreExisting:true});
 await host.IOUtils.writeUTF8(path+'operator-realm.json',JSON.stringify(report,null,2));
 return {ok:true,file:base+'operator-realm.json'};
})();
