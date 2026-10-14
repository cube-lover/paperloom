/* Host QA: manual translation fixtures only; never calls provider/login manager/cache. */
var PaperLoomLayoutTestPromise=(async()=>{
 const host=Zotero.getMainWindow(),io=host.IOUtils;
 const base='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/validation/layout-v2/';
 const local=name=>(base+name).split('/').join(String.fromCharCode(92));
 const save=async value=>io.writeUTF8(local('host-session.json'),JSON.stringify(value,null,2));
 try{
  const app=Zotero.PaperLoom;for(const r of app.inplace?.keys()||[])if(r.itemID===474)app.clearInPlace(r);
  const reader=await Zotero.Reader.open(474,{pageIndex:0});
  const examples=JSON.parse(await io.readUTF8(local('manual-translations.json')));
  let calls=0,peak=0,running=0;
  await save({stage:'starting',host:Zotero.version});
  const s=await app.translateInPlace(reader,{translateBlock:async text=>{
    const match=examples.find(t=>text.startsWith(t[0]));if(!match)throw new Error('No manual fixture for this paragraph');
    calls++;running++;peak=Math.max(peak,running);
    await new Promise(resolve=>host.setTimeout(resolve,1000));running--;return {text:match[1]};
  }});
  if(!s)return save({stage:'cancelled'});
  s.paused=true;s.update();
  const metrics=[...s.doc.querySelectorAll('.pl-inplace')].map(box=>({id:box.dataset.blockId,state:box.dataset.state,overflow:box.dataset.overflow,matrix:box.style.transform,bg:box.style.background,font:box.firstChild?.style.fontSize,height:box.clientHeight,scroll:box.firstChild?.scrollHeight}));
  const primary=reader._internalReader._primaryView._iframeWindow;
  const report={stage:'done',host:Zotero.version,calls,peak,stats:app.inplaceStats(reader),primaryOverlays:primary.document.querySelectorAll('.pl-inplace').length,metrics,tableRegions:s.layout.pages[2].protectedRegions,graphicsDiagnostics:s.layout.pages.map(p=>p.diagnostics),graphicsErrors:s.graphicsErrors};
  await save(report);
  // Label the source of the displayed Chinese unmistakably; no model claim.
  const bar=reader._iframeWindow.document.querySelector('.pl-inplace-controls');
  if(bar){const label=bar.ownerDocument.createElement('strong');label.textContent='人工译文排版验收（未调用模型）';bar.prepend(label);}
  return {ok:true,calls,peak,report:base+'host-session.json'};
 }catch(e){await save({stage:'error',name:e.name,message:e.message,stack:e.stack});return {ok:false,error:e.message};}
})();
