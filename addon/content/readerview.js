/* In-reader bilingual reading panel. Renders translation on top of the open paper,
   filled paragraph-by-paragraph as the job progresses. No new window, no separate file.
   All source/model text is written with textContent (safe rendering). */
var PaperLoomReader;
(function (root) {
  'use strict';

  const PANEL_ID = 'paperloom-reader-panel';

  function attach(app, C) {
    // Per-reader UI state kept off the DOM so React re-renders cannot lose it.
    app.readerPanels = app.readerPanels || new Map();

    app.readerDoc = function (reader) {
      // Outermost reader iframe document; the panel overlays the whole reader area.
      return reader?._iframeWindow?.document || null;
    };

    app.readerPanelState = function (reader) {
      let state = this.readerPanels.get(reader);
      if (!state) {
        const cfg = this.config.reader || {};
        state = { fontSize: cfg.fontSize || 16, lineHeight: cfg.lineHeight || 1.7,
          serif: cfg.serif !== false, bilingual: true, jobID: null };
        this.readerPanels.set(reader, state);
      }
      return state;
    };

    app.ensureReaderPanel = function (reader, job, { bilingual = true } = {}) {
      const doc = this.readerDoc(reader);
      if (!doc || !doc.body) throw new Error('\u9605\u8bfb\u5668\u5c1a\u672a\u5c31\u7eea\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
      const state = this.readerPanelState(reader);
      state.bilingual = bilingual; state.jobID = job.id;
      let panel = doc.getElementById(PANEL_ID);
      if (panel) { this.styleReaderPanel(reader); return panel; }

      panel = doc.createElement('div');
      panel.id = PANEL_ID;
      panel.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:42%;min-width:320px;max-width:70%;'
        + 'z-index:2147483000;display:flex;flex-direction:column;background:var(--pl-bg,#fff);'
        + 'border-left:1px solid #c4d0e6;box-shadow:-6px 0 24px rgba(20,40,90,.12);'
        + 'font-family:var(--pl-font,"Noto Serif SC",Georgia,serif);color:#17223b;';

      // Resize handle on the left edge.
      const grip = doc.createElement('div');
      grip.style.cssText = 'position:absolute;left:-4px;top:0;width:8px;height:100%;cursor:col-resize;z-index:1;';
      let dragging = false;
      grip.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
      doc.addEventListener('mousemove', e => {
        if (!dragging) return;
        const w = Math.min(doc.documentElement.clientWidth * 0.7,
          Math.max(320, doc.documentElement.clientWidth - e.clientX));
        panel.style.width = w + 'px';
      });
      doc.addEventListener('mouseup', () => { dragging = false; });

      // Header toolbar.
      const bar = doc.createElement('div');
      bar.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:8px 10px;'
        + 'border-bottom:1px solid #e3e9f5;background:#f6f9ff;font-family:system-ui;';
      const title = doc.createElement('div');
      title.textContent = '\u8bd1\u7814 \u00b7 \u9605\u8bfb\u9762\u677f';
      title.style.cssText = 'font:700 13px system-ui;color:#2f6bff;margin-right:auto;';
      bar.appendChild(title);

      const mkBtn = (label, tip, fn) => {
        const b = doc.createElement('button');
        b.textContent = label; b.title = tip || label;
        b.style.cssText = 'height:26px;min-width:28px;padding:0 8px;border:1px solid #c4d0e6;border-radius:6px;'
          + 'background:#fff;color:#1b2742;font:600 12px system-ui;cursor:pointer;';
        b.addEventListener('click', e => { e.stopPropagation(); this.safe(fn); });
        bar.appendChild(b); return b;
      };
      mkBtn('A-', '\u7f29\u5c0f\u5b57\u53f7', () => this.readerAdjust(reader, { fontSize: -1 }));
      mkBtn('A+', '\u653e\u5927\u5b57\u53f7', () => this.readerAdjust(reader, { fontSize: +1 }));
      mkBtn('\u884c\u8ddd', '\u5207\u6362\u884c\u95f4\u8ddd', () => this.readerAdjust(reader, { lineHeight: true }));
      mkBtn('\u5b57\u4f53', '\u8861\u7ebf / \u975e\u8861\u7ebf', () => this.readerAdjust(reader, { serif: true }));
      const cmpBtn = mkBtn('\u5bf9\u7167', '\u663e\u793a/\u9690\u85cf\u539f\u6587', () => this.readerAdjust(reader, { bilingual: true }));
      cmpBtn.dataset.role = 'compare';
      mkBtn('\u5bfc\u51fa\u7b14\u8bb0', '\u5bfc\u51fa\u53cc\u8bed\u7b14\u8bb0', async () => {
        const j = this.jobs.find(x => x.id === this.readerPanelState(reader).jobID);
        if (j) { await this.exportNote(j.id); this.alert('\u53cc\u8bed\u7b14\u8bb0\u5df2\u66f4\u65b0'); }
      });
      mkBtn('\u2715', '\u5173\u95ed', () => this.closeReaderPanel(reader));

      const body = doc.createElement('div');
      body.dataset.role = 'body';
      body.style.cssText = 'flex:1 1 auto;overflow:auto;padding:14px 18px;';

      const foot = doc.createElement('div');
      foot.dataset.role = 'foot';
      foot.style.cssText = 'flex:0 0 auto;padding:6px 12px;border-top:1px solid #e3e9f5;'
        + 'font:12px system-ui;color:#5b6b8c;background:#f6f9ff;';

      panel.appendChild(grip); panel.appendChild(bar); panel.appendChild(body); panel.appendChild(foot);
      doc.body.appendChild(panel);

      // Re-attach if React tears the body down and rebuilds it.
      const Observer = typeof Zotero !== 'undefined' ? Zotero.getMainWindow().MutationObserver : doc.defaultView.MutationObserver;
      const observer = new Observer(() => {
        if (!doc.getElementById(PANEL_ID) && this.readerPanels.get(reader)?.open) {
          doc.body.appendChild(panel);
        }
      });
      observer.observe(doc.body, { childList: true });
      state.observer = observer; state.open = true;
      this.styleReaderPanel(reader);
      return panel;
    };

    app.styleReaderPanel = function (reader) {
      const doc = this.readerDoc(reader); if (!doc) return;
      const panel = doc.getElementById(PANEL_ID); if (!panel) return;
      const s = this.readerPanelState(reader);
      panel.style.setProperty('--pl-font', s.serif ? '"Noto Serif SC",Georgia,serif' : 'system-ui,"Noto Sans SC",sans-serif');
      const cmp = panel.querySelector('[data-role=compare]');
      if (cmp) cmp.style.background = s.bilingual ? '#2f6bff' : '#fff', cmp.style.color = s.bilingual ? '#fff' : '#1b2742';
    };

    app.readerAdjust = function (reader, change) {
      const s = this.readerPanelState(reader);
      if (change.fontSize) s.fontSize = Math.max(11, Math.min(28, s.fontSize + change.fontSize));
      if (change.lineHeight) s.lineHeight = s.lineHeight >= 2.1 ? 1.4 : Math.round((s.lineHeight + 0.2) * 10) / 10;
      if (change.serif) s.serif = !s.serif;
      if (change.bilingual) s.bilingual = !s.bilingual;
      this.config.reader = { fontSize: s.fontSize, lineHeight: s.lineHeight, serif: s.serif };
      this.persist();
      const job = this.jobs.find(x => x.id === s.jobID);
      if (job) this.renderReaderPanel(reader, job, { bilingual: s.bilingual });
      this.styleReaderPanel(reader);
    };

    app.renderReaderPanel = function (reader, job, { bilingual } = {}) {
      const doc = this.readerDoc(reader); if (!doc) return;
      const panel = doc.getElementById(PANEL_ID); if (!panel) return;
      const s = this.readerPanelState(reader);
      if (typeof bilingual === 'boolean') s.bilingual = bilingual;
      const body = panel.querySelector('[data-role=body]');
      const foot = panel.querySelector('[data-role=foot]');
      while (body.firstChild) body.removeChild(body.firstChild);

      for (const seg of job.segments) {
        const block = doc.createElement('div');
        block.style.cssText = 'margin:0 0 14px;';
        if (s.bilingual) {
          const src = doc.createElement('p');
          src.textContent = seg.source;
          src.style.cssText = 'margin:0 0 4px;color:#8a97b1;font-size:' + Math.max(11, s.fontSize - 3)
            + 'px;line-height:' + s.lineHeight + ';font-family:system-ui;';
          block.appendChild(src);
        }
        const tgt = doc.createElement('p');
        tgt.style.cssText = 'margin:0;font-size:' + s.fontSize + 'px;line-height:' + s.lineHeight
          + ';font-family:var(--pl-font);';
        if (seg.status === 'done') { tgt.textContent = seg.target; }
        else if (seg.status === 'running') { tgt.textContent = '\u2026 \u7ffb\u8bd1\u4e2d'; tgt.style.color = '#2f6bff'; }
        else if (seg.status === 'error') { tgt.textContent = '[\u7ffb\u8bd1\u5931\u8d25] ' + (seg.error || ''); tgt.style.color = '#c0392b'; }
        else if (seg.status === 'skipped') { tgt.textContent = seg.source; tgt.style.color = '#8a97b1'; }
        else { tgt.textContent = '\u5f85\u7ffb\u8bd1'; tgt.style.color = '#b4bfd6'; }
        block.appendChild(tgt);
        body.appendChild(block);
      }
      const done = job.segments.filter(x => ['done', 'skipped'].includes(x.status)).length;
      foot.textContent = `${job.title} \u00b7 \u5df2\u8bd1 ${done}/${job.segments.length} \u6bb5`
        + (job.status === 'running' ? ' \u00b7 \u7ffb\u8bd1\u4e2d\u2026' : job.status === 'done' ? ' \u00b7 \u5b8c\u6210' : '');
    };

    app.closeReaderPanel = function (reader) {
      const s = this.readerPanels.get(reader);
      if (s?.observer) try { s.observer.disconnect(); } catch (e) {}
      if (s) s.open = false;
      try {const doc = this.readerDoc(reader);doc?.getElementById(PANEL_ID)?.remove();} catch (_) { /* Closed iframe is a dead wrapper. */ }
      this.readerPanels.delete(reader);
    };


  }

  const api = { attach }; PaperLoomReader = root.PaperLoomReader = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
