(async () => {
  const root = 'D:\\Users\\Administrator\\Pi-Agent\\home\\pi-cwd-20260926\\paperloom';
  const out = { at: new Date().toISOString(), prefs: [] };
  try {
    const base = 'extensions.zotero.zoteromagic.';
    const names = Services.prefs.getBranch(base).getChildList('');
    for (const suffix of names) {
      const full = base + suffix;
      let type = Services.prefs.getPrefType(full), value = null, kind = 'other';
      try {
        if (type === Services.prefs.PREF_STRING) value = Zotero.Prefs.get(full, true);
      } catch {}
      let note = '';
      if (typeof value === 'string') {
        kind = 'string';
        const hasEngine = /secretKey|"api"|apiKey|sk-|Bearer|"model"/.test(value);
        note = hasEngine ? 'ENGINE_OR_SECRET' : '';
        out.prefs.push({ name: suffix, len: value.length, note });
      } else {
        out.prefs.push({ name: suffix, type });
      }
    }
    out.engine = Zotero.Prefs.get(base + 'fulltextTranslate.engine', true);
  } catch (e) { out.error = String(e); out.stack = e.stack; }
  await IOUtils.writeUTF8(root + '\\validation\\magic-pref-scan.json', JSON.stringify(out, null, 2));
  return 'scanned ' + out.prefs.length + ' prefs';
})();
