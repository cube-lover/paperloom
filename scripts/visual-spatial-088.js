/* Navigation + actual rendering capture, translation blocked. Restore reading position. */
var CubeVisual088Promise=(async()=>{
 const h=Zotero.getMainWindow(),a=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\'),report={at:new Date().toISOString(),pages:[],passed:false},sleep=ms=>new Promise(r=>h.setTimeout(r,ms));let restore,reader,s,views,positions,sync,translate;
 try{if(a.version!=='0.8.8')throw Error('Version mismatch');reader=Zotero.Reader._readers.find(r=>a.inplace.has(r));s=a.inplace.get(reader);const g=await a.graphicSession(reader);if(!s.paused||s.workers||g.busy||a.allRequests.size)throw Error('Pause first');
 views=[reader._internalReader._primaryView,reader._internalReader._secondaryView].map(v=>v._iframeWindow);positions=views.map(w=>({page:w.PDFViewerApplication.pdfViewer.currentPageNumber,top:w.document.querySelector('#viewerContainer').scrollTop,left:w.document.querySelector('#viewerContainer').scrollLeft}));sync=s.syncEnabled;s.syncEnabled=false;translate=a.translate;a.translate=()=>{throw Error('Provider blocked in visual QA');};report.before=a.inplaceStats(reader);
 for(const index of [13,14,55]){
  for(const w of views)w.PDFViewerApplication.pdfViewer.currentPageNumber=index+1;
  for(let i=0;i<120&&!views.every(w=>w.PDFViewerApplication.pdfViewer.getPageView(index)?.renderingState===3);i++)await sleep(100);
  if(!views.every(w=>w.PDFViewerApplication.pdfViewer.getPageView(index)?.renderingState===3))throw Error('Render timeout');
  
  s.rescan();s.repaint();g.paint();await sleep(350);
  for(const [j,w]of views.entries()){const pv=w.PDFViewerApplication.pdfViewer.getPageView(index),r=pv.div.getBoundingClientRect(),cv=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');cv.width=Math.ceil(r.width);cv.height=Math.ceil(r.height);cv.getContext('2d').drawWindow(w,r.left,r.top,r.width,r.height,'#fff');const blob=await new Promise(resolve=>cv.toBlob(resolve,'image/png'));const file='validation/spatial-088-page-'+(index+1)+'-'+(j?'right':'left')+'.png';await h.IOUtils.write(local(file),new Uint8Array(await blob.arrayBuffer()));
   const anchors=[...pv.div.querySelectorAll('.pl-graphic-anchor')].map(n=>({id:n.dataset.labelId,mode:n.dataset.mode,fallback:n.dataset.fallback,text:g.rows.find(x=>x.id===n.dataset.labelId)?.text}));report.pages.push({page:index+1,pane:j?'right':'left',file,prose:pv.div.querySelectorAll('.pl-inplace').length,anchors});
  }
 }
 report.after=a.inplaceStats(reader);report.passed=report.before.done===report.after.done&&a.allRequests.size===0&&report.pages.filter(p=>p.pane==='left').every(p=>p.prose===0&&p.anchors.length===0)&&report.pages.find(p=>p.page===14&&p.pane==='right').anchors.every(x=>x.mode==='replace');
 }catch(e){report.error=e.message;report.stack=e.stack;}finally{if(translate)a.translate=translate;if(views&&positions){for(const [i,w]of views.entries()){w.PDFViewerApplication.pdfViewer.currentPageNumber=positions[i].page;const c=w.document.querySelector('#viewerContainer');c.scrollTop=positions[i].top;c.scrollLeft=positions[i].left;}s.syncEnabled=sync;s.rescan();}}
 await h.IOUtils.writeUTF8(local('validation/visual-spatial-088.json'),JSON.stringify(report,null,2));return {passed:report.passed,error:report.error,pages:report.pages.map(p=>({page:p.page,pane:p.pane,prose:p.prose,anchors:p.anchors.length}))};
})();
