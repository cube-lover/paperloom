/* Developer-only runner: no credentials and no network calls. */
var PaperLoomSessionPromise = (async () => {
  const h = Zotero.getMainWindow(), io = h.IOUtils, paths = h.PathUtils;
  const base = paths.join('D:', 'Users', 'Administrator', 'Pi-Agent', 'home', 'pi-cwd-20260926', 'paperloom');
  const url = 'file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/scripts/';
  const scope = {Zotero, IOUtils:io, ChromeUtils:h.ChromeUtils};
  const load = f => h.Services.scriptloader.loadSubScriptWithOptions(url + f,{target:scope,ignoreCache:true});
  const save = (f, value) => io.writeUTF8(paths.join(base,'validation',f),JSON.stringify(value,null,2));
  try {
    load('runtime-inspect.js');
    const inventory = await scope.PaperLoomInspectPromise;
    await save('runtime-inventory.json',inventory);
    if (!inventory.profile.endsWith('t1g6sjqd.default')) throw new Error('Unexpected profile; stopped');
    load('dev-reload.js');
    const reload = await scope.PaperLoomReloadPromise;
    if (!reload.ok) throw new Error('Reload failed; see dev-reload.txt');
    const reader = Zotero.Reader._readers.find(r => inventory.attachments.some(a => a.id === r.itemID)) || await Zotero.Reader.open(inventory.attachments[0].id);
    const win = await Zotero.PaperLoom.ensureSecondaryPdfWin(reader);
    const pages = [...win.document.querySelectorAll('#viewer .page')].filter(p => p.querySelector('.textLayer span'));
    const geometry = pages.map(p => {
      const rect = p.getBoundingClientRect();
      return {number:p.dataset.pageNumber, width:rect.width, height:rect.height, clientLeft:p.clientLeft, clientTop:p.clientTop, offsetWidth:p.offsetWidth, offsetHeight:p.offsetHeight,
        items:[...p.querySelectorAll('.textLayer span')].filter(s => s.textContent.trim()).map(s => {
          const r=s.getBoundingClientRect();return {text:s.textContent,left:r.left-rect.left,top:r.top-rect.top,right:r.right-rect.left,bottom:r.bottom-rect.top,h:r.height,style:s.getAttribute('style')};
        })};
    });
    await save('reader-geometry.json',{itemID:reader.itemID,split:reader._internalReader.splitType,pages:geometry});
    const app=Zotero.PaperLoom, doc=win.document;
    const observerProbe={};
    for(const [name,realm] of [['chrome',h],['pdf',win]]) {
      try {const obs=new realm.MutationObserver(()=>{});obs.observe(doc.querySelector('#viewer'),{childList:true,subtree:true});obs.disconnect();observerProbe[name]='ok';}
      catch(e){observerProbe[name]=e.name+': '+e.message;}
    }
    await save('observer-probe.json',observerProbe);
    let calls=0, running=0, peak=0;
    const start=Date.now();
    const wait=ms=>new Promise(r=>h.setTimeout(r,ms));
    const work=app.translateInPlace(reader,{translateBlock:async text=>{
      calls++;running++;peak=Math.max(peak,running);
      await wait(160);
      running--;
      return {text:'【排版测试】'+ '城市碳排放核算需要结合能源平衡表，统一统计边界并核对数据来源。'.repeat(Math.max(1,Math.ceil(text.length/125)))};
    }});
    await wait(60);
    const pending=doc.querySelectorAll('.pl-inplace[data-state=pending]').length;
    const session=await work;
    const beforeLazy=calls;
    const viewer=win.PDFViewerApplication.pdfViewer;
    const originalPage=viewer.currentPageNumber;
    viewer.currentPageNumber=5;
    await wait(2000);
    session.rescan();
    for(let i=0;i<100 && (session.workers || session.queue.length);i++)await wait(100);
    const afterLazy=calls;
    const actualLazyPage=viewer.currentPageNumber;
    const renderedPages=[...doc.querySelectorAll('#viewer .page')].filter(p=>p.querySelector('.textLayer span')).map(p=>p.dataset.pageNumber);
    const lazyPageDone=!!doc.querySelector('.page[data-page-number="5"] .pl-inplace[data-state="done"]');
    const beforeZoom=calls;
    const beforeRecords=new Set(session.records.keys());
    const originalScale=viewer.currentScaleValue;
    const scaleBefore=viewer.currentScale;
    viewer.currentScale=viewer.currentScale*1.15;
    await wait(2000);
    session.rescan();
    const afterZoom=calls;
    const scaleAfter=viewer.currentScale;
    const boxes=[...doc.querySelectorAll('.pl-inplace')];
    const overflow=boxes.filter(b=>b.dataset.overflow==='true').length;
    const primary=reader._internalReader._primaryView._iframeWindow.document.querySelectorAll('.pl-inplace').length;
    viewer.currentScaleValue=originalScale;
    await wait(1200);
    const boxCount=doc.querySelectorAll('.pl-inplace').length;
    viewer.currentPageNumber=originalPage;
    await wait(1000);
    if(Zotero.PaperLoomDevHoldPreview)await wait(15000);
    const newRecords=[...session.records].filter(([id])=>!beforeRecords.has(id)).map(([id,r])=>({page:id.split(':')[0],source:r.text}));
    await save('redraw-new-records.json',newRecords);
    app.clearInPlace(reader);
    await wait(250);
    const remaining=doc.querySelectorAll('.pl-inplace').length;
    await save('dev-session.json',{ok:true,stage:'offline-inplace',pages:geometry.length,pending,boxCount,primary,remaining,peak,calls,beforeLazy,afterLazy,actualLazyPage,renderedPages,lazyPageDone,scaleBefore,scaleAfter,beforeZoom,afterZoom,overflow,elapsedMs:Date.now()-start,
      checks:{pendingBeforeCompletion:pending>0,boundedConcurrency:peak<=app.config.concurrency,primaryUntouched:primary===0,clearComplete:remaining===0,zoomNoRepeat:afterZoom===beforeZoom && scaleAfter!==scaleBefore,lazyPage:lazyPageDone && afterLazy>beforeLazy}});
  } catch(e) {await save('dev-session.json',{ok:false,error:e.name+': '+e.message,stack:e.stack});}
})();
