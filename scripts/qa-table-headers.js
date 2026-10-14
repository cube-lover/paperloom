/* Manual column-header QA, right pane only. No provider use, no body data replacement. */
var PaperLoomTableHeadersPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),fixture:'manual table header translations, not provider output',passed:false};
 try{
  const reader=Zotero.Reader._readers.find(r=>app.inplace?.has(r));if(!reader)throw Error('Reader not found');report.before=app.inplaceStats(reader);
  const scope={Zotero,IOUtils:io,PathUtils:h.PathUtils,Services:h.Services,ChromeUtils:h.ChromeUtils,Components:h.Components,crypto:h.crypto,fetch:h.fetch.bind(h),setTimeout:h.setTimeout.bind(h),clearTimeout:h.clearTimeout.bind(h)};
  for(const name of ['layout.js','graphics.js'])h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/'+name,{target:scope,ignoreCache:true});const L=scope.PaperLoomLayout,G=scope.PaperLoomGraphics;
  const old=app._graphicsQA,oldRows=old?.graphicSessions.get(reader)?.rows||[];
  report.archive='validation/pre-table-qa-'+Date.now()+'.json';await io.writeUTF8(local(report.archive),JSON.stringify(oldRows));
  if(old)for(const r of [...old.graphicSessions.keys()])old.closeGraphics(r);
  const qa={dir:local('validation/table-qa-data'),runtimeRoot:'file:///'+root+'addon/',writeChain:Promise.resolve(),hash:app.hash.bind(app),writeJSON:app.writeJSON,readJSON:app.readJSON,bindReaderCommand:app.bindReaderCommand,bindPdfEvent:app.bindPdfEvent,measureInPlaceText:app.measureInPlaceText,readOperatorGeometry:app.readOperatorGeometry,translate:()=>{throw Error('Provider forbidden in QA');}};
  await io.makeDirectory(qa.dir,{ignoreExisting:true});G.attach(qa,{},L);app._graphicsQA=qa;
  qa.graphicRuntime=()=>({python:'D:\\Backup\\Downloads\\python312\\python.exe',runtime:local('.local/ocr-runtime'),models:local('.local/ocr-models')});
  const ocr=qa.runGraphicOCR;qa.runGraphicOCR=async function(canvas,control){const raw=h.atob(canvas.toDataURL('image/png').split(',')[1]);await io.write(local('validation/table-crop-'+canvas.height+'.png'),Uint8Array.from(raw,c=>c.charCodeAt(0)));return ocr.call(this,canvas,control);};
  const s=await qa.openGraphics(reader);s.rows=oldRows.filter(r=>![44,45].includes(r.pageIndex));
  const translations={'Name':'名称','Split':'数据划分','Metric':'指标','Total Count':'总样本数','Dirty Acc/F1/BLEU':'污染子集 Acc/F1/BLEU','Dirty Count':'污染样本数','Clean Acc/F1/BLEU':'干净子集 Acc/F1/BLEU','Clean Count':'干净样本数','Clean Percentage':'干净样本占比','Relative Difference Clean vs All':'干净子集与全集的相对差异','Model':'模型','Total train compute (PF-days)':'训练总计算量（PF-days）','Total train compute (flops)':'训练总计算量（FLOPs）','Params (M)':'参数量（百万）','Training tokens (billions)':'训练词元数（十亿）','Flops per param per token':'每参数、每词元 FLOPs','Mult for bwd pass':'反向传播倍数','Fwd-pass flops per active param per token':'前向传播每激活参数、每词元 FLOPs','Frac of params active for each token':'每词元激活参数比例'};
  const fixtures=JSON.parse(await io.readUTF8(local('tests/layout-dense-tables.fixture.json')));report.tables=[];
  for(const pageIndex of [44,45]){
   const data=fixtures.pages.find(p=>p.pageIndex===pageIndex&&p.itemID===reader.itemID);if(!data)continue;
   const rules=L.graphics(data.operatorList,data.viewBox).rules,result=qa.graphicTableLabels(data,data.viewBox,rules);report.tables.push({page:pageIndex+1,rows:result.tables[0]?.rowCount,columns:result.tables[0]?.columnCount,headers:result.labels.map(r=>r.text)});
   for(const row of result.labels){Object.assign(row,{pageIndex,id:'table'+pageIndex+'c'+row.tableColumn,target:translations[row.text]||'',approved:true,background:'#fff',fixture:true});s.rows.push(row);}
  }
  // Verify the real native/PDF+OCR path, not just pure header construction.
  const verifyReader=reader._internalReader._secondaryView._iframeWindow,viewer=verifyReader.PDFViewerApplication.pdfViewer;report.recognition=[];
  for(const pageIndex of [44,45]){
   const page=viewer.getPageView(pageIndex),canvas=page?.canvas||page?.div?.querySelector('.canvasWrapper canvas');if(!canvas?.width||page.renderingState!==3)continue;
   const fixture=fixtures.pages.find(p=>p.pageIndex===pageIndex&&p.itemID===reader.itemID),table=L.tableStructure(fixture.chars,L.graphics(fixture.operatorList,fixture.viewBox).rules)[0];
   const bounds=L.mapRect(Array.from(page.viewport.transform),table.rect),state={reader,doc:s.doc,file:'graphics/recognize-'+pageIndex+'.json',fingerprint:s.fingerprint,rows:[],update(){},paint(){},control:{stopped:false,requests:new Set()}};
   await qa.recognizeGraphicRegion(state,verifyReader,page,canvas,pageIndex,bounds);
   report.recognition.push({page:pageIndex+1,message:state.message,rows:state.rows.map(r=>({text:r.text,origin:r.origin,selected:r.selected,background:r.background,quad:r.quad,sourceQuad:r.sourceQuad,backgroundSample:r.backgroundSample}))});
   for(const r of state.rows.filter(r=>r.origin==='PDF-table')){
    const preview=s.rows.find(p=>p.pageIndex===pageIndex&&p.tableColumn===r.tableColumn);if(preview)preview.background=r.background;
   }
  }
  s.replace=true;s.hidden=false;s.paint();s.panel.hidden=true;
  report.primary={graphics:reader._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-graphic-anchor').length,prose:reader._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-inplace').length};
  const secondary=reader._internalReader._secondaryView._iframeWindow;report.mounted=[];
  for(const box of secondary.document.querySelectorAll('.pl-graphic-anchor'))if(box.dataset.labelId.startsWith('table'))report.mounted.push({id:box.dataset.labelId,mode:box.dataset.mode,fallback:box.dataset.fallback,text:box.textContent,fit:box.dataset.fitMetrics,rect:(()=>{const b=box.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};})()});
  report.after=app.inplaceStats(reader);report.requests=app.allRequests.size;report.passed=report.primary.graphics===0&&report.primary.prose===0&&report.mounted.length>=9&&report.mounted.every(r=>r.mode==='replace')&&report.before.done===report.after.done&&report.requests===0;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/table-headers-host.json'),JSON.stringify(report,null,2));return {passed:report.passed,error:report.error,primary:report.primary,mounted:report.mounted};
})();
