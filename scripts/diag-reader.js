(async () => {
  const out = [];
  const win = Zotero.getMainWindow();
  const R = Zotero.Reader;
  out.push('PaperLoom loaded: ' + !!Zotero.PaperLoom);
  out.push('reader listeners: ' + JSON.stringify((R._registeredListeners||[]).map(l=>l.type)));
  let reader = null;
  try { reader = R.getByTabID(win.Zotero_Tabs.selectedID); } catch(e) {}
  if (!reader) reader = (R._readers||[]).find(r=>r._iframeWindow);
  out.push('active reader: ' + !!reader);
  if (reader) {
    const doc = reader._iframeWindow && reader._iframeWindow.document;
    out.push('iframe doc: ' + !!doc);
    if (doc) {
      const end = doc.querySelector('.toolbar .end');
      out.push('.toolbar .end: ' + !!end + ' | existing .section: ' + doc.querySelectorAll('.toolbar .end .section').length);
      out.push('译研 already in reader: ' + /译研/.test(doc.body.textContent||''));
      if (end && Zotero.PaperLoom && Zotero.PaperLoom.buildReaderButton) {
        try {
          const host = doc.createElement('span');
          host.style.display = 'inline-flex';
          end.insertBefore(host, end.firstChild);
          Zotero.PaperLoom.buildReaderButton(doc, reader, (...a)=>host.append(...a));
          out.push('MANUAL INJECT ok -> 看放大镜左侧是否出现蓝色「译研·翻译本篇」');
        } catch(e) { out.push('INJECT ERROR: ' + e.message); }
      }
    }
  }
  const msg = out.join('\n');
  Zotero.debug('PLDIAG\n' + msg);
  try { win.alert(msg); } catch(e) {}
  return msg;
})();
