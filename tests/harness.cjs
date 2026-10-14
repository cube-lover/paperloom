const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;

async function createHarness(t, options = {}) {
  const base = path.resolve(__dirname, '../.local/tests'); await fs.mkdir(base, { recursive: true });
  const dir = await fs.mkdtemp(path.join(base, 'case-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const prefs = new Map(), items = new Map(), logins = [], requests = [], columns = new Map();
  let nextID = 1;
  const state = { confirm: true, aborted: 0, requests, notes: [], logins, items, columns, response: null, pickerPath: null, pickerResult: 0 };
  class Item {
    constructor(type) { this.itemType = type; this.libraryID = 1; this.fields = {}; }
    setField(key, value) { this.fields[key] = value; }
    getField(key) { return this.fields[key] || ''; }
    setNote(text) { this.note = text; }
    getNote() { return this.note || ''; }
    addTag(tag) { this.tag = tag; }
    async saveTx() { if (!this.id) { this.id = nextID++; this.key = 'KEY' + this.id; } items.set(this.id, this); if (this.itemType === 'note') state.notes.push(this); return this.id; }
  }
  const main = { ZoteroPane: { itemsView: { _getColumns: () => [...columns].map(([dataKey]) => ({ dataKey, hidden: false })) } }, btoa: str => Buffer.from(str, 'binary').toString('base64'), atob: str => Buffer.from(str, 'base64').toString('binary') };
  const Zotero = {
    version: 'mock-host-not-zotero', Item, DataDirectory: { dir },
    Prefs: { get: k => prefs.get(k), set: (k, v) => prefs.set(k, v) },
    Items: { get: id => items.get(id), getAsync: async id => items.get(id) },
    Libraries: { userLibraryID: 1, get: () => ({ libraryType: 'user' }) },
    Groups: { getGroupIDFromLibraryID: () => 123 },
    PreferencePanes: { register: async () => 'paperloom-preferences' },
    ItemTreeManager: { registerColumn: c => { columns.set(c.dataKey, c); return c.dataKey; }, unregisterColumn: key => columns.delete(key) },
    Reader: { registerEventListener() {}, open: async (...args) => { state.lastOpen = args; } },
    Notifier: { trigger: async () => {} }, getMainWindow: () => main, logError: () => {},
    File: { reveal: () => {} }
  };
  const IOUtils = {
    exists: async p => { try { await fs.access(p); return true; } catch { return false; } },
    makeDirectory: (p, opts = {}) => fs.mkdir(p, { recursive: true, ...opts }),
    readUTF8: p => fs.readFile(p, 'utf8'), read: p => fs.readFile(p), stat: p => fs.stat(p),
    writeUTF8: async (p, text, opts = {}) => { await fs.mkdir(path.dirname(p), { recursive: true }); if (opts.tmpPath) { await fs.writeFile(opts.tmpPath, text, 'utf8'); await fs.rename(opts.tmpPath, p); } else await fs.writeFile(p, text, 'utf8'); },
    write: (p, bytes) => fs.writeFile(p, bytes), copy: (a, b) => fs.copyFile(a, b), move: (a, b) => fs.rename(a, b),
    remove: (p, opts = {}) => fs.rm(p, { force: !!opts.ignoreAbsent, recursive: !!opts.recursive }),
    getChildren: async p => (await fs.readdir(p)).map(x => path.join(p, x))
  };
  class FakeXHR {
    constructor() { this.headers = {}; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    getResponseHeader(k) { return this.replyHeaders?.[k] || null; }
    abort() { if (this.finished) return; this.finished = true; state.aborted++; this.onabort?.(); }
    send(raw) {
      if (state.throwSend) throw new Error('synthetic');
      const entry = { url: this.url, headers: this.headers, body: JSON.parse(raw), xhr: this }; requests.push(entry);
      const reply = state.response ? state.response(entry) : { status: 200, body: { choices: [{ message: { content: '模拟译文：' + entry.body.messages.at(-1).content.replace(/^<source>\n|\n<\/source>$/g, '') }, finish_reason: 'stop' }] } };
      if (reply?.pending) return;
      setTimeout(() => {
        if (this.finished) return; this.finished = true;
        if (reply.error) return this.onerror?.();
        if (reply.timeout) return this.ontimeout?.();
        this.status = reply.status || 200; this.replyHeaders = reply.headers;
        this.responseURL = reply.url || this.url;
        this.responseText = reply.raw ?? JSON.stringify(reply.body);
        this.onload?.();
      }, reply.delay || 0);
    }
  }
  class FilePicker {
    modeOpen = 0; modeSave = 1; returnOK = 0; returnCancel = 1; returnReplace = 2;
    init() {} appendFilter() {} async show() { this.file = state.pickerPath; return state.pickerResult; }
  }
  const Components = { classes: { '@mozilla.org/login-manager/loginInfo;1': { createInstance: () => ({ init(hostname, formSubmitURL, httpRealm, username, password) { Object.assign(this, { hostname, formSubmitURL, httpRealm, username, password }); } }) } }, interfaces: { nsILoginInfo: {} } };
  const Services = { prompt: { confirm: () => state.confirm, alert: () => {} }, logins: { findLogins: () => logins,
    removeLogin: entry => logins.splice(logins.indexOf(entry), 1), addLoginAsync: async entry => logins.push(entry),
    modifyLogin: (old, value) => { if (state.failCredentialUpdate) throw new Error('storage failed'); logins.splice(logins.indexOf(old), 1, value); } } };
  const context = vm.createContext({ Zotero, IOUtils, PathUtils: { join: path.join, filename: path.basename }, Services, Components,
    ChromeUtils: { importESModule: () => ({ FilePicker }) }, XMLHttpRequest: FakeXHR, crypto, URL, TextEncoder, TextDecoder,
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 1)), clearTimeout, setInterval: (f, ms) => setInterval(f, Math.min(ms, 1)), clearInterval, rootURI: 'file:///mock-addon/', pluginID: 'paperloom@local.research' });
  for (const file of ['core.js', 'providers.js', 'app.js', 'ai.js', 'reader-progress.js']) vm.runInContext(await fs.readFile(path.resolve(__dirname, '../addon/content', file), 'utf8'), context, { filename: file });
  const app = context.PaperLoom, C = context.PaperLoomCore;
  context.PaperLoomAI.attach(app, C);
  context.CubeReaderProgress.attach(app);
  await app.init();
  await app.saveConfig({ ...app.config, endpoint: 'http://127.0.0.1:18000/v1', model: 'test-model', requestsPerMinute: 600, retries: 1, ...options.config });
  app.throttle = async (cfg, control) => { if (control?.stopped || app.stopped) throw new Error('任务已暂停'); };
  return { app, C, state, dir, IOUtils, Zotero, prefs, context };
}
module.exports = { createHarness };
