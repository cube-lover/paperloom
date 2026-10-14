/* Manual fixture translations to inspect geometry, not provider output; QA dir only. */
var PaperLoomGraphicsPreviewPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,qa=app._graphicsQA,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),fixture:'manual test labels; not provider output',passed:false};
 try{
  if(!qa)throw Error('QA instance not present');const [reader,s]=[...qa.graphicSessions][0];
  report.rows=s.rows.map(r=>({id:r.id,text:r.text,quad:r.quad,score:r.score}));
  const fixtures=[[/Averagetime|Average time/i,'尝试识别模型生成新闻的平均耗时'],[/Duration/i,'时长（秒）'],[/control/i,'对照组（105 秒）'],[/Number\s*of\s*parameters/i,'参数量（对数刻度）']];
  for(const r of s.rows){const f=fixtures.find(([re])=>re.test(r.text));if(f){r.target=f[1];r.approved=true;r.review=false;r.fixture=true;}}
  s.replace=true;s.hidden=false;s.paint();s.panel.hidden=true;
  report.mounted=[];
  for(const [name,v] of [['left',reader._internalReader._primaryView],['right',reader._internalReader._secondaryView]]){
   const win=v._iframeWindow,pv=win.PDFViewerApplication.pdfViewer;
   for(const r of s.rows.filter(r=>r.target)){
    const page=pv.getPageView(r.pageIndex),b=page.div.querySelector('[data-label-id="'+r.id+'"]');if(!b)continue;
    const corners=r.quad.map(p=>page.viewport.convertToViewportPoint(p[0],p[1])),canvas=page.canvas||page.div.querySelector('.canvasWrapper canvas'),cr=canvas.getBoundingClientRect(),br=b.getBoundingClientRect(),sx=cr.width/page.viewport.width,sy=cr.height/page.viewport.height;
    const expected={left:cr.left+Math.min(...corners.map(p=>p[0]))*sx,top:cr.top+Math.min(...corners.map(p=>p[1]))*sy,right:cr.left+Math.max(...corners.map(p=>p[0]))*sx,bottom:cr.top+Math.max(...corners.map(p=>p[1]))*sy};
    const error=Math.max(...['left','top','right','bottom'].map(k=>Math.abs(br[k]-expected[k])));
    report.mounted.push({pane:name,source:r.text,target:r.target,mode:b.dataset.mode,fallback:b.dataset.fallback,error,rect:br.toJSON(),expected});
   }
  }
  report.prose=app.inplaceStats(reader);report.requests=app.allRequests.size;
  report.passed=report.mounted.length>=6&&report.mounted.every(r=>r.error<1)&&report.mounted.some(r=>r.mode==='replace')&&report.mounted.filter(r=>/Duration/i.test(r.source)).every(r=>r.mode==='hotspot');
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/graphics-preview-qa.json'),JSON.stringify(report,null,2));return {passed:report.passed,error:report.error,mounted:report.mounted};
})();
