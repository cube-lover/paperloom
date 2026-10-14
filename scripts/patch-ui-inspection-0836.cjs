const fs=require('fs');function patch(f,edits){let s=fs.readFileSync(f,'utf8');for(const[a,b]of edits){if(s.split(a).length!==2)throw Error(f+' nonunique '+a);s=s.replace(a,b);}fs.writeFileSync(f,s);}
patch('addon/content/dev-channel.js',[
 ["'repair-flow-page','audit-interaction'","'repair-flow-page','inspect-reader-ui','audit-interaction'"],
 ["['resume-article','open-reader','audit-interaction'].includes(r.action)","['resume-article','open-reader','audit-interaction','inspect-reader-ui'].includes(r.action)"],
 ["    if(r.action==='inspect-page')return this.devInspectPage(r);",`    if(r.action==='inspect-reader-ui'){
     const reader=(Zotero.Reader._readers||[]).find(x=>x.itemID===r.itemID),w=reader?._iframeWindow,d=w?.document;if(!d)throw Error('Reader UI not loaded');const dir=PathUtils.join(directory,'inspections',crypto.randomUUID());await IOUtils.makeDirectory(dir,{ignoreExisting:true});
     this.inplace?.get(reader)?.update();const bar=d.querySelector('.pl-inplace-controls'),menu=d.querySelector('.pl-reader-menu');
     const report={version:this.version,itemID:r.itemID,hidden:d.hidden,toolbarButtons:[...d.querySelectorAll('.pl-reader-action button')].map(n=>({label:n.textContent,aria:n.getAttribute('aria-label')})),menu:[...menu?.querySelectorAll('[role^="menuitem"]')||[]].map(n=>n.textContent),progress:this.readerProgress(reader),statusText:bar?.innerText||bar?.textContent,progressButtons:d.querySelectorAll('.pl-auto-graphics').length,visibleTranslationPanels:[...d.querySelectorAll('.pl-graphics-panel,.pl-reader-panel')].filter(n=>!n.hidden&&n.getBoundingClientRect().height>0).length,images:[]};
     if(!d.hidden)for(const [name,node]of [['toolbar',d.querySelector('.toolbar')],['status',bar]]){const b=node?.getBoundingClientRect();if(!b?.width||!b.height)continue;const h=Zotero.getMainWindow(),c=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=Math.ceil(b.width*2);c.height=Math.ceil(b.height*2);const cx=c.getContext('2d');cx.scale(2,2);cx.drawWindow(w,b.left,b.top,b.width,b.height,'#fff');const raw=h.atob(c.toDataURL('image/png').split(',')[1]);await IOUtils.write(PathUtils.join(dir,name+'.png'),Uint8Array.from(raw,ch=>ch.charCodeAt(0)));report.images.push(name+'.png');c.width=c.height=0;}
     await IOUtils.writeUTF8(PathUtils.join(dir,'reader-ui.json'),JSON.stringify(report));return {directory:dir,...report};
    }
    if(r.action==='inspect-page')return this.devInspectPage(r);`]
]);
for(const f of ['scripts/cube-dev.cjs','tests/dev-channel.test.cjs'])patch(f,[["['resume-article','open-reader','audit-interaction']","['resume-article','open-reader','audit-interaction','inspect-reader-ui']"]]);
for(const f of ['package.json','addon/manifest.json']){const p=JSON.parse(fs.readFileSync(f));p.version='0.8.36';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n');}
