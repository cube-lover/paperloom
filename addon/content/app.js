/* Independently implemented Zotero integration; no Magic code or credentials. */
var PaperLoom = (() => {
  'use strict';
  const C = PaperLoomCore;
  const pref = 'extensions.zotero.paperloom.config';
  const realm = 'PaperLoom';
  const origin = 'chrome://paperloom';
  const app = {
    version: typeof pluginVersion === 'string' ? pluginVersion : 'dev',
    runtimeRoot: rootURI,
    readerIconURI: typeof CubeIconData==='string'?CubeIconData:null,
    jobs: [], active: new Map(), windows: new Map(), listeners: new Set(), columnKeys: [], columnKeyMap: new Map(),
    allRequests: new Set(), translations: new Map(), notices: [], aiControl: null,
    columnValues: {}, writeChain: Promise.resolve(), rateChain: Promise.resolve(), stopped: false,
    async init() {
      this.dir = PathUtils.join(Zotero.DataDirectory.dir, 'paperloom');
      await IOUtils.makeDirectory(this.dir, { ignoreExisting: true });
      await IOUtils.makeDirectory(PathUtils.join(this.dir, 'cache'), { ignoreExisting: true });
      await IOUtils.makeDirectory(PathUtils.join(this.dir, 'exports'), { ignoreExisting: true });
      this.jobs = await this.readJSON('jobs.json', [], C.recoverJobs);
      this.columnValues = await this.readJSON('columns.json', {});
      this.config = C.validateConfig(JSON.parse(Zotero.Prefs.get(pref, true) || '{}'));
      await this.persist();
      this.pane = await Zotero.PreferencePanes.register({ pluginID, id: 'paperloom-preferences', label: 'Cube 翻译',
        src: rootURI + 'content/preferences.xhtml', scripts: [rootURI + 'content/preferences.js'], image: rootURI + 'content/icon-48.png' });
      await this.registerColumns();
      // Selection and workbench popups are not part of the in-place reader UI.
      this.readerToolbar = ({ doc, reader, append }) => {this.buildReaderButton(doc, reader, append);this.scheduleReaderRestore?.(reader);};
      Zotero.Reader.registerEventListener('renderToolbar', this.readerToolbar, pluginID);
      // Updating an addon does not recreate toolbars of already open readers.
      for(const reader of Zotero.Reader._readers||[]){this.ensureReaderButton(reader);this.scheduleReaderRestore?.(reader);}
    },
    ensureReaderButton(reader) {
      try{
        const doc=reader._iframeWindow?.document,end=doc?.querySelector('.toolbar .end');
        if(!end||doc.querySelector('.pl-main-button'))return;
        this.buildReaderButton(doc,reader,node=>{const section=doc.createElement('div');section.className='section';section.appendChild(node);end.appendChild(section);});
      }catch(e){ /* A reader can close while an addon is starting. */ }
    },
    refreshReaderButton(reader, error = '') {
      const views=this.readerButtons?.get(reader);if(!views)return;
      const session=this.inplace?.get(reader), action=this.inplaceActions?.get(reader);
      let state='idle', label='Cube 翻译', hint='左右分屏原位翻译；下方直接显示处理位置';
      if(error){state='error';label='Cube · 重试';hint=error;}
      else if(session?.stage==='parsing'){state='parsing';label='解析 '+session.parsed+'/'+session.pdf.numPages;hint='正在解析版面，再次点击取消';}
      else if(!session&&(action||this.inplaceStarting?.has(reader))){state='starting';label='准备中';hint='正在准备阅读器，再次点击取消';}
      else if(session){
        if(session.hidden){state='hidden';label='Cube · 显示译文';hint='立即显示已有译文，不改变暂停状态或重新请求翻译';}
        else if(session.paused){state='paused';label='Cube · 继续';hint='继续处理待翻译段落';}
        else if(session.workers||session.queue.length||session.graphicJob?.busy||!session.paused&&session.graphicJob?.pending.size){state='running';label='翻译中 · 暂停';hint='暂停派发新段落，已发出的请求继续收尾';}
        else {state=session.hidden?'hidden':'ready';label=session.hidden?'Cube · 显示译文':'Cube · 显示原文';hint='切换原文与译文，不重新解析或请求翻译';}
      }
      for(const view of [...views]){
        if(!view.wrap.isConnected){view.dispose();continue;}
        const graphicHint=this.articleGraphicsSummary?.(reader);if(graphicHint)hint+=' · '+graphicHint;
        const sync=view.menu?.querySelector('[data-action="selection-sync"]');if(sync){sync.textContent='同步选区：'+(session?.syncEnabled===false?'关':'开');sync.setAttribute('aria-checked',String(session?.syncEnabled!==false));}
        if(view.label.textContent!==label)view.label.textContent=label;
        view.button.dataset.state=state;view.button.title='Cube Translation · '+hint+(this.graphicSessions?.get(reader)?.message?'\n'+this.graphicSessions.get(reader).message:'');view.button.setAttribute('aria-label',label);
        view.button.setAttribute('aria-busy',String(['starting','parsing','running'].includes(state)));
        view.notice.textContent=error;view.notice.hidden=!error;
      }
    },
    activateReaderButton(reader) {
      this.inplaceActions ||= new Map();
      const session=this.inplace?.get(reader), previous=this.inplaceActions.get(reader);
      if(session?.stage==='parsing'||(!session&&(previous||this.inplaceStarting?.has(reader)))){
        if(previous){previous.cancelled=true;clearTimeout(previous.timer);this.inplaceActions.delete(reader);}
        this.clearInPlace(reader);this.refreshReaderButton(reader);return;
      }
      if(session){
        if(session.hidden)this.toggleInPlace(reader);
        else if(session.paused)this.pauseInPlace(reader,false);
        else if(session.workers||session.queue.length||session.graphicJob?.busy||!session.paused&&session.graphicJob?.pending.size)this.pauseInPlace(reader,true);
        else this.toggleInPlace(reader);
        this.refreshReaderButton(reader);return;
      }
      const action={cancelled:false};this.inplaceActions.set(reader,action);this.refreshReaderButton(reader);
      // Give the native button a paint/input turn before starting PDF work.
      action.timer=setTimeout(async()=>{
        if(action.cancelled||this.stopped)return;
        let error='';
        try{await this.translateInPlace(reader);}
        catch(e){if(!action.cancelled)error=e.message||'启动失败，请重试';}
        finally{
          if(this.inplaceActions.get(reader)===action){this.inplaceActions.delete(reader);this.refreshReaderButton(reader,error);}
        }
      },32);
    },
    bindReaderCommand(button, command) {
      // Zotero's window-level pointer handler suppresses Firefox :active. Own the
      // press feedback locally; dispatch only on click (release), never on down/up
      // as well. Keep native keyboard/UIA clicks and touch-scroll cancellation.
      const doc=button.ownerDocument,win=doc.defaultView;let watching=false;
      const reset=()=>{button.classList.remove('pl-pressed');if(!watching)return;watching=false;
        doc.removeEventListener('pointerup',reset,true);doc.removeEventListener('pointercancel',reset,true);win.removeEventListener('blur',reset);};
      const down=e=>{if(e.button!==0||e.isPrimary===false||button.disabled)return;
        e.stopPropagation();if(!e.pointerType||e.pointerType==='mouse')e.preventDefault();
        button.classList.add('pl-pressed');if(!watching){watching=true;doc.addEventListener('pointerup',reset,true);doc.addEventListener('pointercancel',reset,true);win.addEventListener('blur',reset);}};
      const mouse=e=>{if(e.button===0){e.stopPropagation();e.preventDefault();}};
      const click=e=>{e.stopPropagation();reset();if(button.disabled||e.button>0)return;
        // A physical double-click must not immediately undo its first activation.
        // Separate clicks and keyboard/UIA activations (detail=0) remain immediate.
        if(e.detail>1){e.preventDefault();return;}command(e);};
      button.addEventListener('pointerdown',down);button.addEventListener('mousedown',mouse);
      button.addEventListener('pointerleave',reset);button.addEventListener('click',click);
      return ()=>{reset();button.removeEventListener('pointerdown',down);button.removeEventListener('mousedown',mouse);
        button.removeEventListener('pointerleave',reset);button.removeEventListener('click',click);};
    },
    buildReaderButton(doc, reader, append) {
      this.readerButtons ||= new Map();
      // Reader toolbar recreation must not accumulate detached menus or click listeners.
      for(const view of [...this.readerButtons.get(reader)||[]])if(view.doc===doc)view.dispose();
      const commandCleanup=[];
      const wrap=doc.createElement('div');wrap.className='pl-reader-action';
      wrap.style.cssText='display:inline-flex;align-items:center;flex-shrink:0;margin:0 4px;';
      const btn=doc.createElement('button');btn.type='button';btn.className='pl-main-button';btn.textContent='Cube 翻译';
      btn.style.cssText='display:inline-flex;align-items:center;justify-content:center;height:24px;width:106px;flex:0 0 106px;gap:5px;white-space:nowrap;padding:0 5px;border:1px solid #2f6bff;border-radius:6px 0 0 6px;background:#2f6bff;color:white;font:600 12px system-ui;cursor:pointer;touch-action:manipulation;';
      const icon=doc.createElement('img');icon.src=this.readerIconURI||this.runtimeRoot+'content/icon-32.png';icon.alt='';icon.width=18;icon.height=18;icon.style.cssText='border-radius:4px;flex:none;';const labelNode=doc.createElement('span');labelNode.textContent=btn.textContent;btn.replaceChildren(icon,labelNode);
      const caret=doc.createElement('button');caret.type='button';caret.className='pl-menu-button';caret.textContent='▾';caret.title='阅读选项';caret.setAttribute('aria-label','阅读选项');
      caret.setAttribute('aria-haspopup','menu');caret.setAttribute('aria-expanded','false');
      caret.style.cssText='height:24px;min-width:22px;padding:0 4px;border:1px solid #2f6bff;border-left:1px solid #82a1ff;border-radius:0 6px 6px 0;background:#2f6bff;color:white;cursor:pointer;';
      const menu=doc.createElement('div');menu.className='pl-reader-menu';menu.setAttribute('role','menu');
      menu.style.cssText='position:fixed;z-index:2147483646;min-width:190px;max-width:90vw;max-height:70vh;overflow:auto;padding:6px;background:Canvas;color:CanvasText;border:1px solid #b8c3d6;border-radius:8px;box-shadow:0 6px 20px #14285a30;display:none;';
      const notice=doc.createElement('div');notice.className='pl-reader-notice';notice.hidden=true;notice.setAttribute('role','status');
      notice.style.cssText='position:fixed;top:48px;right:12px;max-width:420px;padding:8px 12px;background:Canvas;color:CanvasText;z-index:2147483646;border:1px solid #c77;border-radius:6px;font:13px system-ui;';
      // The host toolbar is a native window-drag region. Custom buttons are not
      // covered by its .toolbar-button no-drag rule: explicitly exclude our UI.
      const feedback=doc.createElement('style');feedback.textContent='.pl-reader-action,.pl-reader-action *,.pl-reader-menu,.pl-reader-menu *,.pl-inplace-controls,.pl-inplace-controls *{-moz-window-dragging:no-drag}.pl-reader-action button:hover{filter:brightness(1.12)}.pl-reader-action button.pl-pressed,.pl-reader-menu button.pl-pressed,.pl-inplace-controls button.pl-pressed{filter:brightness(.86);box-shadow:inset 0 1px 3px #0005}.pl-reader-action button:focus-visible{outline:2px solid #e6a700;outline-offset:2px}';wrap.appendChild(feedback);
      const position=()=>{const r=caret.getBoundingClientRect(),w=doc.defaultView;
        menu.style.left=Math.max(8,Math.min(r.right-260,w.innerWidth-280))+'px';menu.style.top=Math.max(4,Math.min(r.bottom+5,w.innerHeight-100))+'px';};
      const outside=e=>{if(!wrap.contains(e.target)&&!menu.contains(e.target))close();};
      const escape=e=>{if(e.key==='Escape'){close();caret.focus();}};
      const close=()=>{menu.style.display='none';caret.setAttribute('aria-expanded','false');doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);doc.defaultView.removeEventListener('resize',position);};
      const toggle=()=>{if(menu.style.display!=='none'){close();return;}position();menu.style.display='block';caret.setAttribute('aria-expanded','true');doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);doc.defaultView.addEventListener('resize',position);};
      const item=(text,fn)=>{const node=doc.createElement('button');node.type='button';node.textContent=text;node.setAttribute('role','menuitem');
        node.style.cssText='display:block;width:100%;text-align:left;padding:8px 10px;border:0;background:transparent;color:inherit;font:13px system-ui;cursor:pointer;';
        node.addEventListener('mouseenter',()=>{node.style.background='#7b9ad622';});node.addEventListener('mouseleave',()=>{node.style.background='transparent';});
        commandCleanup.push(this.bindReaderCommand(node,async()=>{close();try{await fn();}catch(error){this.refreshReaderButton(reader,error.message||'操作失败');}}));menu.appendChild(node);return node;
      };
      item('显示原文 / 译文',()=>{if(!this.inplace?.has(reader))throw Error('本篇还没有原位译文');this.toggleInPlace(reader);});
      item('补译当前页图表',()=>this.requestCurrentGraphics(reader));
      item('框选翻译（补漏）…'+(this.readerShortcut?.()?'  '+this.readerShortcut():''),async()=>{
        // Same region pipeline as the figure panel's advanced entry, surfaced here
        // because that one is easy to miss.
        await this.selectGraphicRegion(reader);
        const hint='在左侧或右侧页面上按住鼠标左键拖出要翻译的区域，松开即识别；Esc 取消。';
        notice.textContent=hint;notice.hidden=false;
        clearTimeout(view.noticeTimer);view.noticeTimer=setTimeout(()=>{if(notice.textContent===hint)notice.hidden=true;},20000);
      });
      item('重试失败项',()=>this.retryInPlace(reader));
      const syncItem=item('同步选区：开',()=>{const s=this.inplace?.get(reader);if(!s)return;s.syncEnabled=!s.syncEnabled;s.selectionSync?.update();s.update();});syncItem.dataset.action='selection-sync';syncItem.setAttribute('role','menuitemcheckbox');
      // Reader-level shortcut for the region workflow; ignored while typing.
      const shortcutKey=e=>{
        if(e.defaultPrevented||e.repeat||e.isComposing)return;const t=e.target;
        if(t&&(t.closest?.('input,textarea,select,button,[contenteditable]')||t.isContentEditable))return;
        if(!this.matchShortcut?.(this.readerShortcut?.(),e))return;
        e.preventDefault();e.stopPropagation();
        Promise.resolve().then(()=>this.selectGraphicRegion(reader)).catch(error=>this.refreshReaderButton(reader,error.message||'\u6846\u9009\u5931\u8d25'));
      };
      doc.addEventListener('keydown',shortcutKey,true);commandCleanup.push(()=>doc.removeEventListener('keydown',shortcutKey,true));
      commandCleanup.push(this.bindReaderCommand(btn,()=>{close();this.activateReaderButton(reader);}));
      commandCleanup.push(this.bindReaderCommand(caret,toggle));
      caret.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();if(menu.style.display==='none')toggle();menu.firstChild?.focus();}});
      const view={doc,wrap,menu,button:btn,label:labelNode,notice,noticeTimer:null,dispose:()=>{close();clearTimeout(view.noticeTimer);for(const clean of commandCleanup.splice(0))clean();wrap.remove();menu.remove();notice.remove();doc.defaultView.removeEventListener('unload',view.dispose);const views=this.readerButtons.get(reader);views?.delete(view);if(!views?.size)this.readerButtons.delete(reader);}};
      if(!this.readerButtons.has(reader))this.readerButtons.set(reader,new Set());this.readerButtons.get(reader).add(view);
      doc.defaultView.addEventListener('unload',view.dispose,{once:true});
      wrap.appendChild(btn);wrap.appendChild(caret);append(wrap);doc.body.appendChild(menu);doc.body.appendChild(notice);this.refreshReaderButton(reader);
    },
    async translateCurrentPaper(reader, { bilingual = true } = {}) {
      const attachmentID = reader.itemID;
      const existing = this.jobs.find(j => j.attachmentID === attachmentID && j.segments.length);
      const job = existing || await this.loadAttachment(attachmentID);
      if (!job) return;
      // Show the in-reader panel immediately so the user sees progress on the paper itself.
      const panel = this.ensureReaderPanel(reader, job, { bilingual });
      const pending = job.segments.filter(s => !['done', 'skipped'].includes(s.status));
      this.renderReaderPanel(reader, job, { bilingual });
      if (!pending.length) { await this.exportNote(job.id); return; }
      if (this.active.size) throw new Error('已有翻译任务在运行，请稍候');
      if (this.config.confirmBeforeSend && !this.consent([job])) return;
      const update = () => this.renderReaderPanel(reader, job, { bilingual });
      this.listeners.add(update);
      try { await this.start(job.id, { consent: false }); }
      finally { this.listeners.delete(update); update(); }
      if (job.segments.some(s => s.status === 'done')) await this.exportNote(job.id);
      else throw new Error('本次未完成翻译；请检查引擎设置和密钥');
    },
    readerSelection(reader) {
      try {
        for (const win of [reader?._internalReader?._primaryView?._iframeWindow,
          reader?._internalReader?._secondaryView?._iframeWindow, reader?._iframeWindow]) {
          const sel = win?.getSelection?.()?.toString?.().trim();
          if (sel) return sel;
        }
      } catch (e) { Zotero.logError(e); }
      return '';
    },
    async readJSON(name, fallback, validate = value => value) {
      const path = PathUtils.join(this.dir, ...name.split(/[\\/]+/)), backup = path + '.bak';
      if (!await IOUtils.exists(path) && !await IOUtils.exists(backup)) return fallback;
      try { return validate(JSON.parse(await IOUtils.readUTF8(path))); }
      catch {
        try {
          const value = validate(JSON.parse(await IOUtils.readUTF8(backup)));
          if (await IOUtils.exists(path)) await IOUtils.move(path, path + '.corrupt-' + Date.now());
          this.notices.push(`已从备份恢复 ${name}；异常原文件已保留在数据目录。`);
          return value;
        } catch { throw new Error(`Cube 翻译数据文件 ${name} 读取失败；原文件保持不变，请检查备份。`); }
      }
    },
    writeJSON(name, data) {
      const path = PathUtils.join(this.dir, ...name.split(/[\\/]+/)), text = JSON.stringify(data);
      const write = this.writeChain.catch(() => {}).then(async () => {
        if ((['jobs.json', 'columns.json'].includes(name)||name.startsWith('sessions/')||name.startsWith('graphics/')) && await IOUtils.exists(path)) await IOUtils.copy(path, path + '.bak');
        return IOUtils.writeUTF8(path, text, { tmpPath: path + '.tmp' });
      });
      this.writeChain = write;
      return write;
    },
    persist() { return this.writeJSON('jobs.json', this.jobs); },
    emit() { for (const listener of this.listeners) { try { listener(); } catch (e) { Zotero.logError(e); } } },
    async saveConfig(value) {
      const config = C.validateConfig(value);
      const columnsChanged = JSON.stringify(config.columns) !== JSON.stringify(this.config?.columns);
      Zotero.Prefs.set(pref, JSON.stringify(config), true);
      this.config = config;
      if (columnsChanged) await this.registerColumns(); this.emit();
    },
    async logins() { return await Services.logins.findLogins(origin, null, realm); },
    credentialName(name, cfg = this.config) {
      return name + ':' + (name === 'bridge' ? cfg.bridgeURL : cfg.endpoint).replace(/\/+$/, '');
    },
    async secret(name = 'provider', cfg = this.config) {
      const username = this.credentialName(name, cfg);
      return (await this.logins()).find(entry => entry.username === username)?.password || '';
    },
    async setSecret(name, value, cfg = this.config) {
      name = this.credentialName(name, cfg);
      const existing = (await this.logins()).filter(entry => entry.username === name);
      if (!value) { for (const entry of existing) Services.logins.removeLogin(entry); return; }
      const login = Components.classes['@mozilla.org/login-manager/loginInfo;1'].createInstance(Components.interfaces.nsILoginInfo);
      login.init(origin, null, realm, name, value, '', '');
      if (existing.length) await Services.logins.modifyLogin(existing[0], login);
      else await Services.logins.addLoginAsync(login);
      for (const duplicate of existing.slice(1)) Services.logins.removeLogin(duplicate);
    },
    async hash(value) {
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return Array.from(new Uint8Array(buffer), x => x.toString(16).padStart(2, '0')).join('');
    },
    async safe(fn) {
      try { return await fn(); }
      catch (error) { this.alert(error.message || '操作失败'); return null; }
    },
    alert(text) { Services.prompt.alert(Zotero.getMainWindow(), 'Cube 翻译', String(text)); },
    addWindow(win) {
      // Preferences remain in Zotero Settings. No workbench, batch menu or
      // global shortcut opens another translation surface.
      if(win&&!this.windows.has(win))this.windows.set(win,[]);
    },
    removeWindow(win) { for (const node of this.windows.get(win) || []) node.remove(); this.windows.delete(win); },
    open(options = {}) {
      if (this.workbench && !this.workbench.closed) {
        this.workbench.focus(); this.workbench.PaperLoomUI?.receive(options); return this.workbench;
      }
      this.workbench = Zotero.getMainWindow().openDialog('chrome://paperloom/content/workbench.xhtml', 'paperloom-workbench',
        'chrome,centerscreen,resizable,dialog=no,width=1280,height=850', { app: this, core: C, options });
      return this.workbench;
    },
    async registerColumns() {
      for (const key of this.columnKeys) (Zotero.ItemTreeManager.unregisterColumn || Zotero.ItemTreeManager.unregisterColumns).call(Zotero.ItemTreeManager, key);
      this.columnKeys = []; this.columnKeyMap.clear();
      for (const col of this.config.columns.filter(x => x.enabled)) {
        const options = { dataKey: `paperloom-${col.id}`, label: col.name, pluginID, width: '190',
          dataProvider: item => this.columnValues[`${item.libraryID}/${item.key}/${col.id}`]?.text || '' };
        const key = await (Zotero.ItemTreeManager.registerColumn || Zotero.ItemTreeManager.registerColumns).call(Zotero.ItemTreeManager, options);
        const keys = (Array.isArray(key) ? key : [key]).filter(Boolean);
        if (!keys.length) throw new Error(`AI 列注册失败：${col.name}；请检查 Zotero API 兼容性`);
        this.columnKeys.push(...keys); this.columnKeyMap.set(col.id, keys[0]);
      }
    },
    async attachmentFor(item) {
      if (item?.isPDFAttachment?.()) return item;
      if (item?.isRegularItem?.()) {
        const best = await item.getBestAttachment();
        if (best?.isPDFAttachment()) return best;
        for (const id of item.getAttachments()) { const a = Zotero.Items.get(id); if (a.isPDFAttachment()) return a; }
      }
      return null;
    },
    selected(win = Zotero.getMainWindow()) {
      const reader = Zotero.Reader.getByTabID(win.Zotero_Tabs?.selectedID);
      if (reader?.itemID) return [Zotero.Items.get(reader.itemID)];
      return win.ZoteroPane.getSelectedItems();
    },
    async loadSelected(win = Zotero.getMainWindow()) {
      const items = this.selected(win);
      if (!items.length) throw new Error('请先选中论文条目，或打开一个 PDF');
      this.open();
      const seen = new Set(); let count = 0;
      for (const item of items) {
        const attachment = await this.attachmentFor(item);
        if (!attachment || seen.has(attachment.id)) continue;
        seen.add(attachment.id); if (await this.loadAttachment(attachment.id)) count++;
      }
      if (!count) throw new Error('选中条目没有本地 PDF 附件。也可以在工作台粘贴文本或导入 Markdown。');
    },
    async loadAttachment(id) {
      const attachment = await Zotero.Items.getAsync(id);
      if (!attachment?.isPDFAttachment()) throw new Error('请选中 PDF 附件');
      const path = await attachment.getFilePathAsync();
      if (!path || !await IOUtils.exists(path)) throw new Error('PDF 尚未下载到本地，请先打开或同步附件');
      let text, parser = this.config.parser;
      if (parser === 'bridge') {
        if (!this.confirm('本地解析确认', '将所选 PDF 发送至你配置的本机解析桥接。解析程序可能按其自身配置访问网络。是否继续？')) return;
        const response = await this.bridge('parse', attachment);
        text = response.text;
      } else {
        const result = await Zotero.PDFWorker.getFullText(attachment.id, null);
        text = result.text;
      }
      if (!text || text.trim().length < 30) throw new Error('此 PDF 文本层不足，可能是扫描件。请配置本地 MinerU 解析桥接，或导入 OCR 后的 Markdown。');
      const parent = attachment.parentID ? Zotero.Items.get(attachment.parentID) : null;
      return this.createJob(text, { title: parent?.getField('title') || attachment.getField('title'), attachmentID: attachment.id,
        parentID: parent?.id, libraryID: attachment.libraryID, sourceURI: this.sourceURI(attachment), parser });
    },
    sourceURI(item, page) {
      const library = Zotero.Libraries.get(item.libraryID);
      const libraryPath = library.libraryType === 'group' ? `groups/${Zotero.Groups.getGroupIDFromLibraryID(item.libraryID)}` : 'library';
      return `zotero://open-pdf/${libraryPath}/items/${item.key}${page ? `?page=${page}` : ''}`;
    },
    async createJob(text, metadata = {}) {
      if (!String(text).trim()) throw new Error('请先输入论文正文');
      if (String(text).length > 3000000) throw new Error('文本超过 300 万字符，请分卷处理');
      const job = { id: crypto.randomUUID(), title: metadata.title || '粘贴文本', created: new Date().toISOString(),
        status: 'queued', ...metadata, config: JSON.parse(JSON.stringify(this.config)),
        segments: C.segmentText(text, this.config) };
      if (metadata.attachmentID && !metadata.parentID) {
        const a = Zotero.Items.get(metadata.attachmentID);
        if (a) { job.parentID = a.parentID || null; job.libraryID = a.libraryID; job.sourceURI = this.sourceURI(a); }
      }
      this.jobs.unshift(job); this.currentID = job.id;
      await this.persist(); this.emit(); return job;
    },
    confirm(title, message) { return Services.prompt.confirm(this.workbench || Zotero.getMainWindow(), title, message); },
    consent(jobs) {
      const size = jobs.reduce((n, job) => n + C.estimate(job.segments).chars, 0);
      const hosts = [...new Set(jobs.map(j => new URL(j.config.endpoint).host))].join('、');
      return this.confirm('确认发送论文内容', `服务：${hosts}\n待处理原文约 ${size.toLocaleString()} 字符（含缓存段，实际请求可能更少）。\n仅在点击确认后发送；API 可能收费。API 密钥不随笔记或配置导出。\n是否继续？`);
    },
    async start(id, { consent = true } = {}) {
      if (this.aiBusy) throw new Error('请等待 AI 总结或 AI 列任务完成');
      const job = this.jobs.find(j => j.id === id);
      if (!job || this.active.has(id) || this.stopped) return;
      if (!job.segments.some(s => !['done', 'skipped'].includes(s.status))) return;
      if (consent && !this.consent([job])) return;
      // One document at a time; paragraph concurrency is bounded globally for predictable API usage.
      if (this.active.size) throw new Error('已有任务正在运行。请等待完成，或使用“继续全部”依次处理。');
      const control = { stopped: false, requests: new Set() };
      this.active.set(id, control); job.status = 'running';
      try {
        await this.persist(); this.emit();
        const pending = job.segments.filter(s => !['done', 'skipped'].includes(s.status));
        await C.runPool(pending, job.config.concurrency, async segment => {
          segment.status = 'running'; segment.error = ''; this.emit();
          try {
            const index = job.segments.indexOf(segment);
            const context = index > 0 ? job.segments[index - 1].source : '';
            const result = await this.translate(segment.source, job.config, context, control);
            if (control.stopped) { segment.status = 'pending'; return; }
            segment.target = result.text; segment.warnings = result.warnings; segment.cached = !!result.cached; segment.status = 'done';
          } catch (error) {
            segment.status = control.stopped ? 'pending' : 'error';
            segment.error = control.stopped ? '' : error.message;
          } finally { await this.persist(); this.emit(); }
        }, () => control.stopped || this.stopped);
        job.status = control.stopped ? 'paused' : job.segments.some(s => s.status === 'error') ? 'partial' : 'done';
      } catch (error) { job.status = 'paused'; throw error; }
      finally { this.active.delete(id); await this.persist(); this.emit(); }
    },
    async startAll() {
      if (this.active.size || this.batchActive || this.aiBusy) throw new Error('已有批量任务、翻译或 AI 任务正在运行');
      const jobs = this.jobs.filter(j => j.segments.some(s => !['done', 'skipped'].includes(s.status)));
      if (!jobs.length || !this.consent(jobs)) return;
      this.batchActive = true; this.batchStop = false;
      try { for (const job of [...jobs].reverse()) { if (this.batchStop || this.stopped) break; await this.start(job.id, { consent: false }); } }
      finally { this.batchActive = false; this.emit(); }
    },
    pause(id) {
      this.batchStop = true;
      const control = this.active.get(id);
      if (control) { control.stopped = true; for (const xhr of [...control.requests]) xhr.abort(); }
      if (this.aiControl) { this.aiControl.stopped = true; for (const xhr of [...this.aiControl.requests]) xhr.abort(); }
    },
    async removeJob(id) {
      if (this.active.has(id) || this.batchActive) throw new Error('请先暂停任务，再删除记录');
      if (!this.confirm('删除任务', '只删除 Cube 翻译中的此任务记录；原始 PDF、已导出的笔记和附件保持不变。')) return;
      this.jobs = this.jobs.filter(j => j.id !== id);
      if (this.currentID === id) this.currentID = this.jobs[0]?.id;
      await this.persist(); this.emit();
    },
    async throttle(cfg, control) {
      const current = this.rateChain.catch(() => {}).then(async () => {
        if (control?.stopped || this.stopped) throw new Error('任务已暂停');
        const delay = Math.max(0, (this.nextRequestAt || 0) - Date.now());
        // Small waits permit prompt cancellation without leaking a long timer on shutdown.
        for (let left = delay; left > 0; left -= 100) {
          if (control?.stopped || this.stopped) throw new Error('任务已暂停');
          await new Promise(r => setTimeout(r, Math.min(100, left)));
        }
        this.nextRequestAt = Date.now() + 60000 / cfg.requestsPerMinute;
      });
      this.rateChain = current; return current;
    },
    request(url, { body, headers = {}, timeoutMs = 90000, control } = {}) {
      return new Promise((resolve, reject) => {
        if (control?.stopped || this.stopped) return reject(new Error('任务已暂停'));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true); xhr.timeout = timeoutMs;
        xhr.setRequestHeader('Content-Type', 'application/json');
        for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
        control?.requests.add(xhr); this.allRequests.add(xhr);
        const cleanup = () => { control?.requests.delete(xhr); this.allRequests.delete(xhr); };
        xhr.onload = () => {
          cleanup();
          if (control?.stopped || this.stopped) { reject(new Error('任务已暂停')); return; }
          if (xhr.responseURL && new URL(xhr.responseURL).origin !== new URL(url).origin) { reject(new Error('服务发生跨站跳转，请填写最终服务地址')); return; }
          if (xhr.status < 200 || xhr.status >= 300) {
            const e = new Error(`服务返回 HTTP ${xhr.status}${xhr.status === 401 ? '：请检查密钥' : xhr.status === 429 ? '：请求限流' : ''}`);
            e.status = xhr.status; e.retryAfter = Math.min(60, Number(xhr.getResponseHeader('Retry-After')) || 0); reject(e); return;
          }
          try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('服务响应不是有效 JSON')); }
        };
        xhr.onerror = () => { cleanup(); const e = new Error('网络连接失败，请检查服务地址'); e.status = 0; reject(e); };
        xhr.ontimeout = () => { cleanup(); const e = new Error('请求超时'); e.status = 408; reject(e); };
        xhr.onabort = () => { cleanup(); reject(new Error('任务已暂停')); };
        try { xhr.send(JSON.stringify(body)); } catch { cleanup(); reject(new Error('请求发送失败，请检查服务地址和请求格式')); }
      });
    },
    async acquireTranslationSlot(cfg,control){
      this.networkSlots||={used:0,waiters:[]};const slots=this.networkSlots,limit=Math.max(1,Number(cfg.concurrency)||1);
      while(slots.used>=limit){if(control?.stopped||this.stopped)throw Error('任务已暂停');await new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);const i=slots.waiters.indexOf(done);if(i>=0)slots.waiters.splice(i,1);resolve();};slots.waiters.push(done);timer=setTimeout(done,100);});}
      if(control?.stopped||this.stopped)throw Error('任务已暂停');slots.used++;let released=false;
      return()=>{if(released)return;released=true;slots.used--;for(const wake of [...slots.waiters])wake();};
    },
    async completion(messages, cfg, control, task = 'translation') {
      control ||= this.aiControl;
      const key = await this.secret('provider', cfg);
      const endpoint = cfg.endpoint.replace(/\/+$/, '');
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname);
      if (!key && !local) throw new Error('请在设置中保存 API 密钥');
      const { url, body, headers } = PaperLoomProviders.buildRequest(messages, cfg, key, task);
      for (let attempt = 0; ; attempt++) {
        try {
          const release=await this.acquireTranslationSlot(cfg,control);
          try{await this.throttle(cfg,control);const response = await this.request(url, { body, headers, timeoutMs: cfg.timeoutMs, control });return PaperLoomProviders.parseResponse(response, cfg);}finally{release();}
        } catch (error) {
          if (control?.stopped || this.stopped || attempt >= cfg.retries || ![0, 408, 429, 500, 502, 503, 504].includes(error.status)) throw error;
          const wait = Math.max((error.retryAfter || 0) * 1000, Math.min(20000, 1000 * 2 ** attempt));
          for (let left = wait; left > 0; left -= 100) {
            if (control?.stopped || this.stopped) throw new Error('任务已暂停');
            await new Promise(r => setTimeout(r, Math.min(left, 100)));
          }
        }
      }
    },
    async translate(source, cfg, context = '', control = { requests: new Set() }) {
      const hash = await this.hash(C.cacheMaterial(source, cfg, context));
      if (this.translations.has(hash)) return this.translations.get(hash);
      const work = this.translateUncached(source, cfg, context, control, hash);
      this.translations.set(hash, work);
      try { return await work; } finally { this.translations.delete(hash); }
    },
    async translateUncached(source, cfg, context, control, hash) {
      if (control?.stopped || this.stopped) throw new Error('任务已暂停');
      const cacheFile = PathUtils.join(this.dir, 'cache', hash + '.json');
      if (await IOUtils.exists(cacheFile)) {
        try { const data = JSON.parse(await IOUtils.readUTF8(cacheFile)); if (typeof data.text === 'string') return { ...data, cached: true }; } catch { /* Recompute an invalid cache entry. */ }
      }
      const prompt = C.translationMessages(source, cfg, context);
      let text = await this.completion(prompt.messages, cfg, control);
      // Some models echo the <source>/<context> wrapper tags; strip them before restoring markers.
      text = String(text).replace(/^\s*<\/?(?:source|context)>\s*/gi, '').replace(/\s*<\/?(?:source|context)>\s*$/gi, '').trim();
      const restored = C.restoreText(text, prompt.literals);
      if (restored.warnings.some(w => /保护标记|未知保护标记/.test(w))) throw new Error('模型改变了公式/术语保护标记，此段待重试；没有静默写入破损译文');
      const result = { text: restored.text, warnings: C.qualityCheck(source, restored.text, restored.warnings) };
      await this.writeJSON('cache/' + hash + '.json', result);
      return result;
    },
    async retrySegment(jobID, segmentID) {
      const job = this.jobs.find(x => x.id === jobID), segment = job?.segments.find(s => s.id === segmentID);
      if (!segment || this.active.has(jobID) || this.batchActive) return false;
      const index = job.segments.indexOf(segment), context = index ? job.segments[index - 1].source : '';
      const hash = await this.hash(C.cacheMaterial(segment.source, job.config, context));
      await IOUtils.remove(PathUtils.join(this.dir, 'cache', hash + '.json'), { ignoreAbsent: true });
      segment.history = [...(segment.history || []), { target: segment.target, at: new Date().toISOString(), reason: 'retry' }].slice(-5);
      segment.status = 'pending'; segment.reviewed = false; segment.manual = false; segment.target = ''; segment.warnings = []; job.status = 'paused';
      await this.persist(); this.emit(); return true;
    },
    async editTranslation(jobID, segmentID, target, reviewed = false) {
      const job = this.jobs.find(j => j.id === jobID), segment = job?.segments.find(s => s.id === segmentID);
      if (!segment) throw new Error('段落不存在');
      if (this.active.has(jobID) || this.batchActive) throw new Error('请先暂停当前任务');
      if (typeof target !== 'string' || !target.trim()) throw new Error('译文内容需非空');
      segment.history = [...(segment.history || []), { target: segment.target, at: new Date().toISOString(), reason: 'edit' }].slice(-5);
      segment.target = target.trim(); segment.manual = true; segment.reviewed = reviewed;
      segment.status = 'done'; segment.error = ''; segment.warnings = C.qualityCheck(segment.source, segment.target);
      job.status = job.segments.every(s => ['done', 'skipped'].includes(s.status)) ? 'done' : 'paused';
      await this.persist(); this.emit(); return segment;
    },
    async cloneWithCurrentConfig(id) {
      const job = this.jobs.find(j => j.id === id); if (!job) return null;
      const text = job.segments.map((s, i) => (i && s.page && s.page !== job.segments[i - 1].page ? '\f' : i ? '\n\n' : '') + s.source).join('');
      return this.createJob(text, { title: job.title + ' · 新配置', parentID: job.parentID, libraryID: job.libraryID,
        attachmentID: job.attachmentID, sourceURI: job.sourceURI, parser: job.parser });
    },
    async exportNote(jobID) {
      const job = this.jobs.find(x => x.id === jobID); if (!job) return;
      const note = new Zotero.Item('note');
      note.libraryID = job.libraryID || Zotero.Libraries.userLibraryID;
      if (job.parentID && Zotero.Items.get(job.parentID)) note.parentID = job.parentID;
      note.setNote(C.noteHTML(job, job.config));
      note.addTag('PaperLoom/AI译文'); await note.saveTx();
      return note;
    },
    async saveFile(defaultName, text, filter = '*.md') {
      const module = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
      const FilePicker = module.FilePicker || module.default;
      const picker = new FilePicker(); picker.init(this.workbench || Zotero.getMainWindow(), '保存 Cube 翻译文件', picker.modeSave);
      picker.defaultString = defaultName; picker.appendFilter('Cube 翻译文件', filter);
      const status = await picker.show();
      if (status !== picker.returnOK && status !== picker.returnReplace) return null;
      await IOUtils.writeUTF8(picker.file, text); return picker.file;
    },
    async readFile(filter = '*.md; *.txt; *.json') {
      const module = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
      const FilePicker = module.FilePicker || module.default;
      const picker = new FilePicker(); picker.init(this.workbench || Zotero.getMainWindow(), '导入文件', picker.modeOpen);
      picker.appendFilter('文本文件', filter);
      if (await picker.show() !== picker.returnOK) return null;
      return { name: PathUtils.filename(picker.file), text: await IOUtils.readUTF8(picker.file) };
    },
    copy(text) { Components.classes['@mozilla.org/widget/clipboardhelper;1'].getService(Components.interfaces.nsIClipboardHelper).copyString(String(text)); return true; },
    async openSource(job, segment) {
      if (!job.attachmentID) return;
      await Zotero.Reader.open(job.attachmentID, segment?.page ? { pageIndex: segment.page - 1 } : undefined);
    },
    async bridge(action, attachment, cfg = this.config) {
      const url = cfg.bridgeURL.replace(/\/+$/, ''); C.validateURL(url, true);
      const key = await this.secret('bridge', cfg); if (!key) throw new Error('请先配置本地桥接 Token');
      const path = await attachment.getFilePathAsync();
      const stat = await IOUtils.stat(path); if (stat.size > 80 * 1024 * 1024) throw new Error('桥接单文件上限为 80 MB');
      const bytes = await IOUtils.read(path);
      // Binary string encoding in bounded chunks avoids argument-stack overflow.
      const chunks = []; for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
      const b64 = Zotero.getMainWindow().btoa(chunks.join(''));
      const result = await this.request(url + '/v1/' + action, { body: { pdfBase64: b64, sourceLang: cfg.sourceLang, targetLang: cfg.targetLang },
        headers: { Authorization: `Bearer ${key}` }, timeoutMs: 300000 });
      if (result.error) throw new Error('桥接处理失败：' + String(result.error).slice(0, 200));
      return result;
    },
    async exportPDF(jobID) {
      const job = this.jobs.find(x => x.id === jobID);
      if (!job?.attachmentID) throw new Error('保版式 PDF 输出需要原始 PDF 附件');
      if (!this.confirm('保版式 PDF 翻译', '本地 pdf2zh 会重新翻译整篇 PDF，使用桥接服务自身的引擎配置；不复用工作台译文/术语缓存，也不保证全部版式保留。可能调用外部 API。是否继续？')) return;
      const attachment = Zotero.Items.get(job.attachmentID), result = await this.bridge('pdf', attachment, job.config);
      if (!Array.isArray(result.files) || !result.files.length) throw new Error('桥接未返回 PDF 文件');
      const outputs = [];
      for (const [index, file] of result.files.entries()) {
        const binary = Zotero.getMainWindow().atob(file.base64 || '');
        if (!binary.startsWith('%PDF-')) throw new Error('桥接返回的文件不是有效 PDF');
        const path = PathUtils.join(this.dir, 'exports', job.id + '-' + crypto.randomUUID() + '-' + index + '.pdf');
        await IOUtils.write(path, Uint8Array.from(binary, ch => ch.charCodeAt(0)));
        const method = this.config.attachMode === 'link' ? 'linkFromFile' : 'importFromFile';
        const item = await Zotero.Attachments[method]({ file: path, parentItemID: job.parentID || undefined, libraryID: job.libraryID,
          title: `Cube · ${file.name || '译文'} · ${job.title}`, contentType: 'application/pdf' });
        if (this.config.outputTag) { item.addTag(this.config.outputTag); await item.saveTx(); } outputs.push(item);
      }
      return outputs;
    },
    openDataDirectory() { Zotero.File.reveal(this.dir); },
    async clearCache() {
      if (this.active.size || this.aiBusy) throw new Error('请先等待所有任务结束');
      if (!this.confirm('清理缓存', '只清理 Cube 翻译与总结缓存；任务记录、原始 PDF、笔记保持不变。之后重译可能重新计费。')) return;
      const dir = PathUtils.join(this.dir, 'cache');
      for (const path of await IOUtils.getChildren(dir)) await IOUtils.remove(path);
      return true;
    },
    async shutdown() {
      this.stopped = true; this.batchStop = true;
      await this.stopDevChannel?.();
      for(const process of this.nativeJobs||[])try{process.kill();}catch{}
      await this.flushCheckpoints?.();
      for(const reader of [...this.nativeOverlayBindings?.keys()||[]])this.closeNativeOverlayInput(reader);
      for(const reader of [...this.graphicSessions?.keys()||[]])this.closeGraphics(reader);
      for(const process of this.graphicProcesses||[])try{process.kill();}catch{}
      for(const action of this.inplaceActions?.values()||[]){action.cancelled=true;clearTimeout(action.timer);}
      this.inplaceActions?.clear();
      for(const reader of [...this.inplaceTokens?.keys()||[]])this.clearInPlace(reader);
      for(const views of [...this.readerButtons?.values()||[]])for(const view of [...views])view.dispose();
      for (const reader of this.inplace?.keys() || []) this.clearInPlace(reader);
      for (const reader of this.readerPanels?.keys() || []) this.closeReaderPanel(reader);
      for (const id of this.active.keys()) this.pause(id);
      this.pause();
      for (const xhr of [...this.allRequests]) xhr.abort();
      for (const win of [...this.windows.keys()]) this.removeWindow(win);
      if (this.workbench && !this.workbench.closed) this.workbench.close();
      // Reader listeners and preference panes are removed by Zotero's plugin lifecycle using pluginID.
      for (const key of this.columnKeys) (Zotero.ItemTreeManager.unregisterColumn || Zotero.ItemTreeManager.unregisterColumns).call(Zotero.ItemTreeManager, key);
      for (const job of this.jobs) if (job.status === 'running') job.status = 'paused';
      await this.persist(); this.listeners.clear();
    }
  };
  return app;
})();
