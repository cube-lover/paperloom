/* Durable reader checkpoints. No credentials/configuration or PDF changes. */
var CubeCheckpoint;
(function(root){
 'use strict';
 function attach(app){
  app.checkpointTimers=new Map();app.restoreTimers=new Map();app.restorePending=new Set();
  app.checkpointIdentity=async function(reader,pdf){const fingerprint=pdf?.fingerprints?.[0]||pdf?.fingerprint;if(!fingerprint)return null;return {fingerprint:String(fingerprint),file:'sessions/'+await this.hash(String(reader.itemID)+'|'+fingerprint)+'.json'};};
  app.saveInPlaceCheckpoint=async function(s,{active=true}={}){
   if(!s||s.stage!=='ready'||s.checkpointDisabled)return null;
   const records=[...s.records.values()].map(r=>({id:r.id,text:r.text,target:r.target,status:r.status==='running'?'pending':r.status,edited:!!r.edited,pageIndex:r.layout.pageIndex,inkRect:r.layout.inkRect,rect:r.layout.rect,alignment:r.alignment||null}));
   // Snapshot before await: teardown may empty the Map while IO is queued.
   const snapshot={version:1,at:new Date().toISOString(),active,itemID:s.reader.itemID,paused:true,fontScale:s.fontScale,hidden:s.hidden,syncEnabled:s.syncEnabled,records,legacy:s.unmatchedRestoredRecords||[],pages:[s.reader._internalReader?._primaryView,s.reader._internalReader?._secondaryView].map(v=>{const w=v?._iframeWindow,c=w?.document?.querySelector('#viewerContainer');return {page:w?.PDFViewerApplication?.pdfViewer?.currentPageNumber||1,top:c?.scrollTop||0,left:c?.scrollLeft||0};})};
   const j=s.graphicJob;if(j)snapshot.graphicJob={version:1,engine:this.graphicEngineVersion||this.version,pages:s.pdf.numPages,completed:[...j.completed],failed:[...j.failed]};
   const identity=await this.checkpointIdentity(s.reader,s.pdf);if(!identity)return null;snapshot.fingerprint=identity.fingerprint;
   await IOUtils.makeDirectory(PathUtils.join(this.dir,'sessions'),{ignoreExisting:true});await this.writeJSON(identity.file,snapshot);s.checkpointSavedAt=snapshot.at;return snapshot;
  };
  app.scheduleInPlaceCheckpoint=function(s){if(!s||s.stage!=='ready'||s.checkpointDisabled||this.checkpointTimers.has(s))return;const timer=setTimeout(()=>{this.checkpointTimers.delete(s);this.saveInPlaceCheckpoint(s).catch(e=>{s.checkpointError=e.message;});},750);this.checkpointTimers.set(s,timer);};
  app.discardInPlace=function(reader){const s=this.inplace?.get(reader);if(!s)return;clearTimeout(this.checkpointTimers.get(s));this.checkpointTimers.delete(s);const save=this.saveInPlaceCheckpoint(s,{active:false});s.checkpointDisabled=true;this.clearInPlace(reader);save.catch(e=>Zotero.logError(e));};
  app.scheduleReaderRestore=function(reader){if(this.stopped||this.restoreTimers.has(reader)||this.restorePending.has(reader))return;let attempts=0;
   const run=async()=>{this.restoreTimers.delete(reader);if(this.stopped||this.inplace?.has(reader)||this.inplaceStarting?.has(reader))return;
    const pdf=reader._internalReader?._primaryView?._iframeWindow?.PDFViewerApplication?.pdfDocument;
    if(!pdf?.getPageData){if(++attempts<40)this.restoreTimers.set(reader,setTimeout(run,500));return;}
    this.restorePending.add(reader);
    try{const id=await this.checkpointIdentity(reader,pdf);if(!id)return;const saved=await this.readJSON(id.file,null);if(this.stopped||this.inplace?.has(reader)||this.inplaceStarting?.has(reader)||!saved?.active||saved.version!==1||saved.fingerprint!==id.fingerprint)return;
     const s=await this.translateInPlace(reader,{restoredRecords:saved.records,startPaused:true});if(!s||this.stopped)return;s.fontScale=saved.fontScale||1;s.syncEnabled=saved.syncEnabled!==false;if(saved.hidden&&!s.hidden)this.toggleInPlace(reader);
     const job=s.graphicJob,progress=saved.graphicJob;if(job&&progress?.version===1&&(progress.engine===(this.graphicEngineVersion||this.version)||this.compatibleGraphicEngines?.includes(progress.engine))&&progress.pages===s.pdf.numPages){for(const p of progress.completed||[])if(Number.isInteger(p)&&p>=0&&p<s.pdf.numPages){job.completed.add(p);job.pending.delete(p);}for(const [p,e]of progress.failed||[])if(Number.isInteger(p)&&p>=0&&p<s.pdf.numPages){job.failed.set(p,String(e));job.pending.delete(p);}}
     const legacy=[...(saved.legacy||[]),...(s.unmatchedRestoredRecords||[])];if(legacy.length)await this.preserveLayoutTranslations?.(reader,legacy);
     for(const [i,v]of [reader._internalReader?._primaryView,reader._internalReader?._secondaryView].entries()){const w=v?._iframeWindow,p=saved.pages?.[i];if(w&&p){w.PDFViewerApplication.pdfViewer.currentPageNumber=p.page;const c=w.document.querySelector('#viewerContainer');if(c){c.scrollTop=p.top;c.scrollLeft=p.left;}}}
     s.restoredFromCheckpoint={at:saved.at,previousDone:saved.records.filter(r=>r.status==='done').length,unmatched:s.unmatchedRestoredRecords?.length||0};s.repaint();s.rescan();await this.saveInPlaceCheckpoint(s);
    }catch(e){this.restoreError=e.message;Zotero.logError(e);}finally{this.restorePending.delete(reader);}
   };this.restoreTimers.set(reader,setTimeout(run,1200));
  };
  app.flushCheckpoints=async function(){for(const timer of this.restoreTimers.values())clearTimeout(timer);this.restoreTimers.clear();for(const timer of this.checkpointTimers.values())clearTimeout(timer);this.checkpointTimers.clear();for(const s of this.inplace?.values()||[])await this.saveInPlaceCheckpoint(s);for(const s of this.graphicSessions?.values()||[])await this.saveGraphics(s);await this.writeChain;};
 }
 CubeCheckpoint={attach};root.CubeCheckpoint=CubeCheckpoint;if(typeof module==='object'&&module.exports)module.exports=CubeCheckpoint;
})(globalThis);
