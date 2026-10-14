/* Real-host UI QA. No provider calls, credentials, config edits or test cache writes. */
var PaperLoomButtonQAPromise=(async()=>{
 const host=Zotero.getMainWindow(),io=host.IOUtils,paths=host.PathUtils;
 const base='D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\validation\\layout-v2';
 const scope={Zotero};let app,reader,originalTranslate,originalEnsure;
 const report={kind:'manual-fixture-button-qa',host:Zotero.version,checks:[]};
 const sleep=ms=>new Promise(r=>host.setTimeout(r,ms));
 const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,detail});if(!ok)throw Error(name);};
 try{
  host.Services.scriptloader.loadSubScriptWithOptions('file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/scripts/dev-reload.js',{target:scope,ignoreCache:true});
  const load=await scope.PaperLoomReloadPromise;if(!load.ok)throw Error('reload failed');
  app=Zotero.PaperLoom;reader=(Zotero.Reader._readers||[]).find(r=>r.itemID===474);if(!reader)throw Error('Expected test reader not open');
  const doc=reader._iframeWindow.document,button=doc.querySelector('.pl-reader-action button'),menu=doc.querySelector('.pl-reader-menu'),caret=doc.querySelector('.pl-reader-action button:last-child');
  check('one-main-button',doc.querySelectorAll('.pl-reader-action').length===1);
  originalTranslate=app.translateInPlace;originalEnsure=app.ensureSecondaryPdfWin;
  app.ensureSecondaryPdfWin=()=>new Promise(()=>{});
  let now=host.performance.now();button.click();report.immediateFeedbackMs=host.performance.now()-now;
  check('immediate-start-state',button.dataset.state==='starting');
  await sleep(70);now=host.performance.now();button.click();report.cancelHandlerMs=host.performance.now()-now;
  await sleep(30);check('cancel-releases-start-lock',!app.inplaceStarting.size&&button.dataset.state==='idle');
  for(let i=0;i<20;i++){button.click();button.click();}await sleep(40);
  check('rapid-toggle-no-stuck-state',button.dataset.state==='idle'&&!app.inplaceActions.size&&!app.inplaceStarting.size);
  caret.click();check('menu-portalled-and-open',menu.parentNode===doc.body&&menu.style.display==='block');caret.click();
  app.ensureSecondaryPdfWin=originalEnsure;
  const fixtures=JSON.parse(await io.readUTF8(paths.join(base,'manual-translations.json')));
  let calls=0;app.translateInPlace=function(r,options={}){return originalTranslate.call(app,r,{...options,translateBlock:async text=>{
    const match=fixtures.find(t=>text.startsWith(t[0]));if(!match)throw Error('No manual fixture');calls++;await sleep(120);return {text:match[1]};
  }});};
  const work=app.translateInPlace(reader);const session=await work;report.fixtureCalls=calls;
  check('fixture-session-ready',session?.stage==='ready');
  let fits=0;const originalFit=app.fitInPlaceText;
  app.fitInPlaceText=function(...args){fits++;return originalFit.apply(app,args);};
  try{
    const before=session.renderCount;for(let i=0;i<50;i++)session.rescan();await sleep(150);
    report.unchangedRescans={count:50,extraRenders:session.renderCount-before,fontMeasures:fits};
    check('unchanged-rescans-zero-font-measures',fits===0);
    now=host.performance.now();button.click();report.revealHandlerMs=host.performance.now()-now;
    check('reveal-state',button.dataset.state==='hidden');button.click();check('restore-state',button.dataset.state==='ready');
  }finally{app.fitInPlaceText=originalFit;}
  report.graphicsErrors=session.graphicsErrors;report.stats=app.inplaceStats(reader);report.renderBatches=session.renderBatches;
  const label=doc.createElement('strong');label.textContent='人工译文测试 · 非模型输出';doc.querySelector('.pl-inplace-controls')?.prepend(label);
  report.ok=true;
 }catch(e){report.ok=false;report.error={name:e.name,message:e.message,stack:e.stack};}
 finally{
  if(app&&originalEnsure)app.ensureSecondaryPdfWin=originalEnsure;
  if(app&&originalTranslate)app.translateInPlace=originalTranslate;
  if(app&&reader)app.clearInPlace(reader);
  await io.writeUTF8(paths.join(base,'button-host-qa.json'),JSON.stringify(report,null,2));
 }
 return {ok:report.ok,report:paths.join(base,'button-host-qa.json')};
})();
