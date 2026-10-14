/* Observe two real desktop clicks on an idle, complete installed session. No synthetic clicks/network. */
var PaperLoomNativePromise=(async()=>{
 const h=Zotero.getMainWindow(),app=Zotero.PaperLoom,r=Zotero.Reader._readers.find(r=>r.itemID===474),s=app.inplace.get(r);
 const path='D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom\\validation\\layout-source-audit\\native-button.json';
 const stats=app.inplaceStats(r);if(!s||s.paused||stats.done!==stats.total||s.workers||s.queue.length||app.allRequests.size)throw Error('Expected idle complete session');
 if(s.hidden)app.toggleInPlace(r);
 const btn=r._iframeWindow.document.querySelector('.pl-main-button');if(!btn)throw Error('Toolbar absent');
 app._nativeQA?.cleanup();
 const report={at:new Date().toISOString(),pid:h.Services.appinfo.processID,version:app.version,initial:stats,clicks:[],passed:false};
 let previous=s.hidden;
 const listener=e=>{const before=previous,after=s.hidden;previous=after;report.clicks.push({at:new Date().toISOString(),trusted:e.isTrusted,before,after,state:btn.dataset.state,requests:app.allRequests.size});report.passed=report.clicks.length===2&&report.clicks.every(v=>v.trusted&&v.before!==v.after&&v.requests===0)&&!s.hidden;h.IOUtils.writeUTF8(path,JSON.stringify(report,null,2)).catch(Zotero.logError);if(report.clicks.length>=2)app._nativeQA.cleanup();};
 btn.addEventListener('click',listener);app._nativeQA={cleanup:()=>btn.removeEventListener('click',listener)};
 await h.IOUtils.writeUTF8(path,JSON.stringify(report,null,2));return {armed:true};
})();
