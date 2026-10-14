const fs=require('fs');
function file(f,fn){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(f,fn(s));}function replace(s,a,b){if(s.split(a).length!==2)throw Error('not unique '+a.slice(0,100));return s.replace(a,b);}
file('addon/content/app.js',s=>{
 const a=s.indexOf('      this.readerPopup = event => {'),b=s.indexOf('      this.readerToolbar =',a);if(a<0||b<0)throw Error('popup');s=s.slice(0,a)+'      // Selection and workbench popups are not part of the in-place reader UI.\n'+s.slice(b);
 s=replace(s,'左右分屏，正文和图表一起后台翻译；校订面板按需打开','左右分屏原位翻译；下方直接显示处理位置');
 const line=s.split('\n').find(l=>l.includes("const graphic=view.wrap.querySelector('.pl-auto-graphics')"));s=replace(s,line,'        const sync=view.menu?.querySelector(\'[data-action="selection-sync"]\');if(sync){sync.textContent=\'同步选区：\'+(session?.syncEnabled===false?\'关\':\'开\');sync.setAttribute(\'aria-checked\',String(session?.syncEnabled!==false));}');
 s=replace(s,'caret.title=\'更多功能\';',"caret.title='阅读选项';caret.setAttribute('aria-label','阅读选项');");
 s=replace(s,'min-width:230px;','min-width:190px;');
 s=replace(s,"menu.appendChild(node);\n      };","menu.appendChild(node);return node;\n      };");
 const m=s.indexOf("      item('原位翻译 / 暂停 / 继续'"),n=s.indexOf('      commandCleanup.push(this.bindReaderCommand(btn',m);if(m<0||n<0)throw Error('menu');
 s=s.slice(0,m)+`      item('显示原文 / 译文',()=>{if(!this.inplace?.has(reader))throw Error('本篇还没有原位译文');this.toggleInPlace(reader);});
      item('补译当前页图表',()=>this.requestCurrentGraphics(reader));
      item('重试失败项',()=>this.retryInPlace(reader));
      const syncItem=item('同步选区：开',()=>{const s=this.inplace?.get(reader);if(!s)return;s.syncEnabled=!s.syncEnabled;s.selectionSync?.update();s.update();});syncItem.dataset.action='selection-sync';syncItem.setAttribute('role','menuitemcheckbox');
`+s.slice(n);
 s=replace(s,'const view={doc,wrap,button:btn,label:labelNode,notice,dispose:', 'const view={doc,wrap,menu,button:btn,label:labelNode,notice,dispose:');
 const g=s.indexOf("      const graphic=doc.createElement('button');"),h=s.indexOf('    },\n    async translateCurrentPaper',g);if(g<0||h<0)throw Error('graphic button');s=s.slice(0,g)+'      wrap.appendChild(btn);wrap.appendChild(caret);append(wrap);doc.body.appendChild(menu);doc.body.appendChild(notice);this.refreshReaderButton(reader);\n'+s.slice(h);
 const w=s.indexOf('    addWindow(win) {'),z=s.indexOf('    removeWindow(win)',w);s=s.slice(0,w)+`    addWindow(win) {
      // Preferences remain in Zotero Settings. No workbench, batch menu or
      // global shortcut opens another translation surface.
      if(win&&!this.windows.has(win))this.windows.set(win,[]);
    },
`+s.slice(z);return s;
});
file('addon/content/inplace.js',s=>{const a=s.indexOf('    app.mountInPlaceControls=function(s) {'),b=s.indexOf('    app.pauseInPlace=',a);if(a<0||b<0)throw Error('controls');s=s.slice(0,a)+s.slice(b);return replace(s,"s.doc.querySelector('#viewer')?.classList.toggle('pl-hide-translations',s.hidden);s.update();", "s.doc.querySelector('#viewer')?.classList.toggle('pl-hide-translations',s.hidden);const g=this.graphicSessions?.get(reader);if(g){g.hidden=s.hidden;g.paint();this.saveGraphics(g).catch(e=>{g.message=e.message;});}s.update();");});
file('addon/bootstrap.js',s=>{s=replace(s,"  Services.scriptloader.loadSubScript(rootURI + 'content/inplace.js', appScope);", "  Services.scriptloader.loadSubScript(rootURI + 'content/inplace.js', appScope);\n  Services.scriptloader.loadSubScript(rootURI + 'content/reader-progress.js', appScope);");return replace(s,'  appScope.CubeCheckpoint.attach(appScope.PaperLoom);','  appScope.CubeReaderProgress.attach(appScope.PaperLoom);\n  appScope.CubeCheckpoint.attach(appScope.PaperLoom);');});
file('tests/harness.cjs',s=>{s=replace(s,"'app.js', 'ai.js'","'app.js', 'ai.js', 'reader-progress.js'");return replace(s,'  context.PaperLoomAI.attach(app, C);','  context.PaperLoomAI.attach(app, C);\n  context.CubeReaderProgress.attach(app);');});
file('tests/reader-button.test.cjs',s=>replace(s,"assert.equal(doc.querySelector('.pl-auto-graphics').textContent,'图表进度');","assert.equal(doc.querySelector('.pl-auto-graphics'),null);"));
