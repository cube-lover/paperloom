const fs=require('fs');
function patch(file,edits){let s=fs.readFileSync(file,'utf8');for(const [a,b]of edits){if(s.split(a).length!==2)throw Error(file+' nonunique '+a.slice(0,80));s=s.replace(a,b);}fs.writeFileSync(file,s);}
patch('addon/content/graphics.js',[
 ['const screenTransform=box.style.transform,unit=p.height<16?4:1;', 'const screenTransform=box.style.transform,unit=4;'],
 ["body.style.lineHeight='1.35';body.style.padding='.05em 0 0';", "body.style.lineHeight='1.35';body.style.padding='.05em 0 0';body.style.fontWeight='400';body.style.fontStyle='normal';"],
 ["const context=['PDF-text-table','PDF-caption'].includes(r.origin)?", "const context=r.flowNode?'翻译流程图中的完整节点，使用紧凑中文，不添加原文没有的信息，不解释。普通英文即使全大写或OCR粘连也应翻译，例如ELECTRIC为电力、GAS为天然气、OIL为石油、HURRICANE为飓风、FLOOD为洪水、intra-network为层内、inter-network为层间。保留原文数值、公式变量及真正的缩写（如ML、CLM、GTA）；不要保留普通英文词作括注。':['PDF-text-table','PDF-caption'].includes(r.origin)?"],
]);
patch('addon/content/inplace.js',[
 ["body.textContent='';box.dataset.overflow='false';", "body.textContent='';box.style.background='transparent';box.dataset.overflow='false';"]
]);
patch('addon/content/dev-channel.js',[
 ["'refresh-page','translate-page','audit-interaction'", "'refresh-page','translate-page','repair-flow-page','audit-interaction'"],
 ["['native-page','inspect-page','refresh-page','translate-page'].includes(r.action)","['native-page','inspect-page','refresh-page','translate-page','repair-flow-page'].includes(r.action)"],
 ["    if(r.action==='translate-page'){", "    if(r.action==='translate-page'||r.action==='repair-flow-page'){"],
 ["const g=await this.graphicSession(reader);g.replace=true;g.hidden=false;await this.translateGraphics(g,{rows:g.rows.filter(x=>x.pageIndex===r.pageIndex),cfg:s.cfg,consentGranted:!!s.graphicsConsent});await this.saveGraphics(g);g.paint();return {page:r.pageIndex+1,translation:g.lastTranslation,rows:",
 `const g=await this.graphicSession(reader);g.replace=true;g.hidden=false;const repaired=[];
     if(r.action==='repair-flow-page'){for(const x of g.rows.filter(x=>x.pageIndex===r.pageIndex&&x.flowNode&&!x.legacyLayout&&x.target&&!x.edited&&!x.approved)){repaired.push({row:x,target:x.target,warnings:x.warnings});(x.history||=[]).push({source:x.text,target:x.target,quad:x.quad,reason:'flow-context-retranslation',at:new Date().toISOString()});x.target='';}}
     let proseDone=0;try{await this.translateGraphics(g,{rows:g.rows.filter(x=>x.pageIndex===r.pageIndex&&(r.action!=='repair-flow-page'||x.flowNode)),cfg:s.cfg,consentGranted:!!s.graphicsConsent});
      if(r.action==='translate-page')for(const rec of s.records.values()){if(rec.layout.pageIndex!==r.pageIndex||!['pending','error'].includes(rec.status))continue;const out=await this.translate(rec.text,s.cfg,'翻译完整图注或正文；保留数值、公式变量与专名。',s.control);if(!out?.text?.trim())throw Error('Empty page translation');rec.target=out.text;rec.status='done';s.paint(rec);proseDone++;}
     }finally{for(const old of repaired)if(!old.row.target){old.row.target=old.target;old.row.warnings=old.warnings;}await this.saveGraphics(g);await this.flushCheckpoints?.();g.paint();}return {page:r.pageIndex+1,proseDone,retranslated:repaired.length,translation:g.lastTranslation,rows:`],
 ["    await IOUtils.writeUTF8(PathUtils.join(dir,'report.json'),JSON.stringify(report));return {directory:dir,records:",
 `    const originals=[...pv.div.querySelectorAll('.pl-graphic-anchor > span')].map(n=>({n,css:n.style.cssText}));
    const captureVariant=async(name)=>{await new Promise(resolve=>setTimeout(resolve,80));const c=h.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=Math.ceil(rect.width*2);c.height=Math.ceil(rect.height*2);const ctx=c.getContext('2d');ctx.scale(2,2);ctx.drawWindow(w,rect.left,rect.top,rect.width,rect.height,'#fff');const raw=h.atob(c.toDataURL('image/png').split(',')[1]);await IOUtils.write(PathUtils.join(dir,name+'.png'),Uint8Array.from(raw,ch=>ch.charCodeAt(0)));c.width=c.height=0;};
    try{await captureVariant('detail-default');for(const {n}of originals)n.style.fontFamily='"SimSun",serif';await captureVariant('detail-serif');}finally{for(const {n,css}of originals)n.style.cssText=css;}
    await IOUtils.writeUTF8(PathUtils.join(dir,'report.json'),JSON.stringify(report));return {directory:dir,records:`]
]);
for(const f of ['scripts/cube-dev.cjs','tests/dev-channel.test.cjs'])patch(f,[["['native-page','inspect-page','refresh-page','translate-page']","['native-page','inspect-page','refresh-page','translate-page','repair-flow-page']"]]);
for(const f of ['package.json','addon/manifest.json']){let d=JSON.parse(fs.readFileSync(f));d.version='0.8.34';fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n');}
