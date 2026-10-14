/* Capture existing page DOM only; no navigation, queue changes or provider requests. */
var PaperLoomTableCapturePromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/validation/',local=p=>(root+p).replace(/\//g,'\\');
 const reader=Zotero.Reader._readers.find(r=>app.inplace?.has(r)),report={at:new Date().toISOString(),pages:[],passed:false};if(!reader)throw Error('Reader not found');
 report.before=app.inplaceStats(reader);
 for(const pageIndex of [44,45])for(const [name,view] of [['source',reader._internalReader._primaryView],['translated',reader._internalReader._secondaryView]]){
  const win=view._iframeWindow,pv=win.PDFViewerApplication.pdfViewer.getPageView(pageIndex);if(!pv?.div||pv.renderingState!==3)continue;const r=pv.div.getBoundingClientRect();
  const canvas=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');canvas.width=Math.ceil(r.width);canvas.height=Math.ceil(r.height);const ctx=canvas.getContext('2d');
  ctx.drawWindow(win,r.left,r.top,r.width,r.height,'#ffffff');const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));await io.write(local('table-'+(pageIndex+1)+'-'+name+'.png'),new Uint8Array(await blob.arrayBuffer()));
  const entry={page:pageIndex+1,pane:name,graphics:pv.div.querySelectorAll('.pl-graphic-anchor').length,prose:pv.div.querySelectorAll('.pl-inplace').length,dataOverlap:0,headerPairsOverlap:0};
  const source=JSON.parse(await io.readUTF8(local('../tests/layout-dense-tables.fixture.json'))).pages.find(p=>p.pageIndex===pageIndex),scope={};h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'../addon/content/layout.js',{target:scope,ignoreCache:true});const L=scope.PaperLoomLayout,tables=L.tableStructure(source.chars,L.graphics(source.operatorList,source.viewBox).rules);
  const sx=(pv.canvas||pv.div.querySelector('canvas')).clientWidth/pv.viewport.width,sy=(pv.canvas||pv.div.querySelector('canvas')).clientHeight/pv.viewport.height;
  const labels=[...pv.div.querySelectorAll('.pl-graphic-anchor')].map(n=>n.getBoundingClientRect());
  const intersects=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  for(const table of tables)for(const cell of table.bodyCells){const b=L.mapRect(Array.from(pv.viewport.transform),cell.rect),rect={left:r.left+b[0]*sx,top:r.top+b[1]*sy,right:r.left+b[2]*sx,bottom:r.top+b[3]*sy};entry.dataOverlap+=labels.filter(b=>intersects(b,rect)>.01).length;}
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(intersects(labels[i],labels[j])>.01)entry.headerPairsOverlap++;
  report.pages.push(entry);
 }
 report.after=app.inplaceStats(reader);report.requests=app.allRequests.size;
 report.passed=report.pages.length===4&&report.pages.every(p=>p.dataOverlap===0&&p.headerPairsOverlap===0&&(p.pane!=='source'||p.graphics===0&&p.prose===0))&&report.before.done===report.after.done&&report.requests===0;
 await io.writeUTF8(local('table-visual-verification.json'),JSON.stringify(report,null,2));return report;
})();
