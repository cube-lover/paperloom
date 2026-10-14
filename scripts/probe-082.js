/* Read-only current-state/fixture capture; hide obstructing plugin panels only. No requests. */
var PaperLoomProbe082Promise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,io=h.IOUtils,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),version:app.version,readers:[],requests:app.allRequests.size};
 const unwrap=x=>h.Components.utils.waiveXrays(x);
 for(const r of Zotero.Reader._readers){
  const gs=app.graphicSessions.get(r),is=app.inplace?.get(r);report.readers.push({itemID:r.itemID,stats:app.inplaceStats(r),pages:[r._internalReader?._primaryView,r._internalReader?._secondaryView].map(v=>v?._iframeWindow?.PDFViewerApplication?.pdfViewer?.currentPageNumber),graphics:gs&&{busy:gs.busy,rows:gs.rows.length,targets:gs.rows.filter(x=>x.target).length,lastAuto:gs.lastAuto,panelHidden:gs.panel?.hidden,scrollTop:gs.panel?.scrollTop}});
  if(gs?.panel)gs.panel.hidden=true;
  if(r.itemID!==594)continue;
  const w=r._internalReader._primaryView._iframeWindow,pdf=w.PDFViewerApplication.pdfDocument;
  const picks=new Set([44,45,46]);
  for(const v of is?.records.values()||[])if(/(?:Figure G\.(?:8|9|10|11|12)|OpenBookQA|HellaSwag)/.test(v.text))picks.add(v.layout.pageIndex);
  for(let i=0;i<pdf.numPages;i++)if(i>45&&picks.size<6){const d=unwrap(await pdf.getPageData(h.Components.utils.cloneInto({pageIndex:i},w)));const text=Array.from(d.chars,c=>c.u||c.c||'').join('');if(text.includes('Formatted dataset example for SAT')||text.includes('OpenBookQA')&&text.includes('HellaSwag'))picks.add(i);}
  const pages=[];for(const pageIndex of picks){const d=unwrap(await pdf.getPageData(h.Components.utils.cloneInto({pageIndex},w))),op=await app.readOperatorGeometry(await pdf.getPage(pageIndex+1));pages.push({pageIndex,viewBox:Array.from(d.viewBox),chars:Array.from(d.chars,c=>({u:c.u,c:c.c,rect:Array.from(c.rect),rotation:c.rotation,fontSize:c.fontSize,baseline:c.baseline,spaceAfter:c.spaceAfter,ignorable:c.ignorable})),operatorList:op});}
  await io.writeUTF8(local('validation/omissions-082-fixture.json'),JSON.stringify({pages}));report.fixturePages=pages.map(p=>p.pageIndex+1);
 }
 await io.writeUTF8(local('validation/probe-082.json'),JSON.stringify(report,null,2));return report;
})();
