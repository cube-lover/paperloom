/* Test automatic page discovery and local OCR, no provider requests or replacement of formal rows. */
var PaperLoomAutoGraphicsQAPromise=(async()=>{
 const h=Zotero.getMainWindow(),io=h.IOUtils,app=Zotero.PaperLoom,root='D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/',local=p=>(root+p).replace(/\//g,'\\');
 const report={at:new Date().toISOString(),passed:false};try{
 const reader=Zotero.Reader._readers.find(r=>app.inplace?.has(r)),session=app.inplace.get(reader);report.before=app.inplaceStats(reader);if(!session.paused||session.workers)throw Error('Pause prose before QA');
 const scope={Zotero,IOUtils:io,PathUtils:h.PathUtils,Services:h.Services,ChromeUtils:h.ChromeUtils,Components:h.Components,crypto:h.crypto,fetch:h.fetch.bind(h),setTimeout:h.setTimeout.bind(h),clearTimeout:h.clearTimeout.bind(h)};
 for(const name of ['layout.js','graphics.js'])h.Services.scriptloader.loadSubScriptWithOptions('file:///'+root+'addon/content/'+name,{target:scope,ignoreCache:true});
 if(app._graphicsQA){for(const [r,s] of app._graphicsQA.graphicSessions){await app._graphicsQA.saveGraphics(s);app._graphicsQA.closeGraphics(r);}}
 for(const s of app.graphicSessions.values())s.panel.hidden=true;
 const qa={dir:local('validation/auto-graphics-qa-'+Date.now()),runtimeRoot:app.runtimeRoot,writeChain:Promise.resolve(),hash:app.hash.bind(app),writeJSON:app.writeJSON,readJSON:app.readJSON,bindReaderCommand:app.bindReaderCommand,bindPdfEvent:app.bindPdfEvent,measureInPlaceText:app.measureInPlaceText,readOperatorGeometry:app.readOperatorGeometry,bindNativeOverlayInput:app.bindNativeOverlayInput.bind(app),inplace:app.inplace,translate:()=>{throw Error('Provider disabled in QA');}};
 await io.makeDirectory(qa.dir,{ignoreExisting:true});scope.PaperLoomGraphics.attach(qa,{},scope.PaperLoomLayout);app._graphicsQA=qa;
 const s=await qa.autoTranslateGraphics(reader,{translate:false});
 report.page=s.lastAuto?.pageIndex+1;report.regions=s.lastAuto?.regions;report.rows=s.rows.map(r=>({text:r.text,origin:r.origin,selected:r.selected,background:r.background,autoValidated:r.autoValidated,rotation:r.rotation}));
 report.fixturePages=[];const f=JSON.parse(await io.readUTF8(local('tests/layout-dense-tables.fixture.json')));for(const pageIndex of [44,45]){const d=f.pages.find(p=>p.pageIndex===pageIndex);report.fixturePages.push({page:pageIndex+1,regions:qa.detectGraphicRegions(d,d.operatorList).regions});}
 s.panel.hidden=true;report.after=app.inplaceStats(reader);report.requests=app.allRequests.size;report.passed=!!report.regions?.length&&report.rows.some(r=>r.selected)&&report.fixturePages.every(p=>p.regions.some(r=>r.role==='table'))&&report.before.done===report.after.done&&report.requests===0;
 }catch(e){report.error=e.message;report.stack=e.stack;}
 await io.writeUTF8(local('validation/auto-graphics-host.json'),JSON.stringify(report,null,2));return report;
})();
