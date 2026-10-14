/* PaperLoom: 一键安装本机 OCR 识别引擎。
 *
 * 安装内容 = 一个离线整包（Python 嵌入式运行时 + rapidocr/onnxruntime 依赖 +
 * PP-OCRv4 模型），由 GitHub Release 提供，装到 Zotero 数据目录下的
 * runtime/ocr/。整包里没有安装程序：解包完全在插件内完成，不调用 pip、
 * 不需要管理员权限、不依赖系统解压工具，装完立刻用一张合成图自检。
 */
var CubeOCRInstall;
(() => {
  'use strict';
  const MANIFEST_FILE = 'ocr-runtime.json';

  function attach(app, C, L) {
    const IOUtils = C?.IOUtils || globalThis.IOUtils, PathUtils = C?.PathUtils || globalThis.PathUtils;
    const hex = buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    const mb = bytes => (Number(bytes || 0) / 1048576).toFixed(1) + ' MB';

    app.ocrInstallRoot = function () { return PathUtils.join(this.dir, 'runtime', 'ocr'); };
    app.ocrInstallPaths = function () {
      const root = this.ocrInstallRoot();
      return {
        root,
        cache: PathUtils.join(root, 'cache', 'bundle.zip'),
        python: PathUtils.join(root, 'python', 'python.exe'),
        deps: PathUtils.join(root, 'deps'),
        models: PathUtils.join(root, 'models'),
        det: PathUtils.join(root, 'models', 'det.onnx'),
        record: PathUtils.join(root, 'install.json'),
        staging: PathUtils.join(root, 'staging'),
      };
    };
    // 清单随插件分发（不含任何密钥），里面是整包的下载地址、体积与 sha256。
    app.ocrInstallConfig = async function () {
      const res = await fetch((this.runtimeRoot || '') + MANIFEST_FILE);
      if (!res.ok) throw Error('安装清单缺失（HTTP ' + res.status + '）');
      const cfg = await res.json();
      if (!cfg || !Array.isArray(cfg.urls) || !cfg.urls.length) throw Error('安装清单里没有下载地址');
      return cfg;
    };
    app.ocrInstallState = async function () {
      const paths = this.ocrInstallPaths(), cfg = this.graphicRuntime();
      const has = async file => { try { return await IOUtils.exists(file); } catch { return false; } };
      const present = { python: await has(paths.python), deps: await has(paths.deps), models: await has(paths.det) };
      const installed = present.python && present.deps && present.models;
      let record = null;
      try { record = JSON.parse(await IOUtils.readUTF8(paths.record)); } catch { record = null; }
      const configured = !!(cfg.python && cfg.runtime && cfg.models);
      // 用户可以继续用自己配置好的 Python 路线（比如以前就装好的那套），
      // 那也算“就绪”，只是模式不同：插件装的叫 managed，自己填路径的叫 external。
      const configuredUsable = configured && await has(cfg.python) && await has(cfg.runtime) && await has(cfg.models);
      const pointingAtManaged = installed && cfg.python === paths.python && cfg.runtime === paths.deps && cfg.models === paths.models;
      const mode = pointingAtManaged ? 'managed' : configuredUsable ? 'external' : 'none';
      const ready = mode !== 'none';
      this._ocrReadyState = ready;
      this._ocrReadyMode = mode;
      return {
        installed, configured, configuredUsable, ready, mode, present, paths,
        version: record?.version || '', bytes: record?.bytes || 0, installedAt: record?.installedAt || '',
        configuredPaths: { python: cfg.python || '', runtime: cfg.runtime || '', models: cfg.models || '' },
      };
    };

    // ---- 下载 / 解包 ------------------------------------------------------
    app.ocrDownload = async function (url, { onProgress, control } = {}) {
      const res = await fetch(url);
      if (!res.ok) throw Error('下载失败（HTTP ' + res.status + '）');
      const total = Number(res.headers.get('content-length') || 0);
      if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
      const reader = res.body.getReader(), chunks = [];
      let got = 0, lastPercent = -1, lastAt = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (control?.stopped) { try { await reader.cancel(); } catch { /* already closed */ } throw Error('安装已取消'); }
        chunks.push(value); got += value.length;
        const percent = total ? Math.floor(got / total * 100) : 0;
        if (onProgress && (percent !== lastPercent || Date.now() - lastAt > 400)) {
          lastPercent = percent; lastAt = Date.now();
          onProgress({ phase: 'download', got, total, percent });
        }
      }
      const out = new Uint8Array(got);
      let offset = 0;
      for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
      return out;
    };
    // zip 中央目录解析：整包是普通 deflate zip，不需要任何外部工具。
    app.ocrParseZip = function (bytes) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let eocd = -1;
      for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw Error('不是有效的 zip 压缩包');
      const count = view.getUint16(eocd + 10, true);
      let cursor = view.getUint32(eocd + 16, true);
      const entries = [];
      for (let i = 0; i < count; i++) {
        if (view.getUint32(cursor, true) !== 0x02014b50) throw Error('zip 中央目录损坏');
        const method = view.getUint16(cursor + 10, true);
        const csize = view.getUint32(cursor + 20, true);
        const usize = view.getUint32(cursor + 24, true);
        const nameLen = view.getUint16(cursor + 28, true);
        const extraLen = view.getUint16(cursor + 30, true);
        const commentLen = view.getUint16(cursor + 32, true);
        const lho = view.getUint32(cursor + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
        if (name && !name.endsWith('/')) entries.push({ name, method, csize, usize, lho });
        cursor += 46 + nameLen + extraLen + commentLen;
      }
      return entries;
    };
    app.ocrZipEntry = async function (bytes, entry) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (view.getUint32(entry.lho, true) !== 0x04034b50) throw Error('zip 条目损坏：' + entry.name);
      const nameLen = view.getUint16(entry.lho + 26, true), extraLen = view.getUint16(entry.lho + 28, true);
      const start = entry.lho + 30 + nameLen + extraLen;
      const raw = bytes.subarray(start, start + entry.csize);
      if (entry.method === 0) return raw;
      if (entry.method !== 8) throw Error('不支持的压缩方式（' + entry.method + '）：' + entry.name);
      const ctor = this.ocrDecompressionStream();
      // 只用 DecompressionStream 本身：Blob/Response 在特权作用域里同样不一定存在，
      // 手动 write/read 两步就能把 deflate-raw 流解出来。
      const stream = new ctor('deflate-raw');
      const writer = stream.writable.getWriter();
      writer.write(raw).then(() => writer.close()).catch(() => { /* read side reports it */ });
      const reader = stream.readable.getReader(), parts = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); size += value.length;
      }
      const out = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) { out.set(part, offset); offset += part.length; }
      return out;
    };
    app.ocrDecompressionStream = function () {
      const local = typeof DecompressionStream === 'undefined' ? null : DecompressionStream;
      const win = typeof Zotero === 'undefined' ? null : Zotero.getMainWindow?.();
      const ctor = local || win?.DecompressionStream;
      if (!ctor) throw Error('这个版本的宿主没有解压能力（DecompressionStream 不可用）；请改用“从文件夹导入”安装');
      return ctor;
    };
    app.ocrExtractZip = async function (bytes, dir, { onProgress, control } = {}) {
      const entries = this.ocrParseZip(bytes);
      let done = 0;
      for (const entry of entries) {
        if (control?.stopped) throw Error('安装已取消');
        const parts = entry.name.split('/').filter(Boolean);
        if (!parts.length || parts.some(part => part === '..')) throw Error('zip 含非法路径：' + entry.name);
        await IOUtils.makeDirectory(parts.length > 1 ? PathUtils.join(dir, ...parts.slice(0, -1)) : dir, { ignoreExisting: true });
        await IOUtils.write(PathUtils.join(dir, ...parts), await this.ocrZipEntry(bytes, entry));
        done++;
        if (onProgress && (done % 50 === 0 || done === entries.length)) onProgress({ phase: 'extract', done, total: entries.length });
      }
      return done;
    };

    // ---- 安装 ------------------------------------------------------------
    app.installOCREngine = async function ({ onProgress, control } = {}) {
      const report = state => { if (onProgress) { try { onProgress(state); } catch { /* UI gone */ } } };
      const paths = this.ocrInstallPaths();
      const control2 = control || {};
      try {
        const cfg = await this.ocrInstallConfig();
        report({ phase: 'prepare', bytes: cfg.bytes, version: cfg.version });
        await IOUtils.makeDirectory(paths.root, { ignoreExisting: true });
        if (await IOUtils.exists(paths.staging)) await IOUtils.remove(paths.staging, { recursive: true });
        await IOUtils.makeDirectory(paths.staging, { recursive: true });
        let bytes = null, digest = '', usedUrl = '', failure = null;
        // 上次下载过的整包如果校验仍然匹配，就直接用它：安装失败重试不再重复下 101MB。
        if (await IOUtils.exists(paths.cache)) {
          try {
            const cached = new Uint8Array(await IOUtils.read(paths.cache));
            const cachedDigest = hex(await crypto.subtle.digest('SHA-256', cached));
            if (!cfg.sha256 || cachedDigest === cfg.sha256) {
              bytes = cached; digest = cachedDigest; usedUrl = 'cache:' + paths.cache;
              report({ phase: 'download', got: cached.length, total: cached.length, percent: 100, cached: true });
            }
          } catch { /* 缓存坏了就走下载 */ }
        }
        for (const url of (bytes ? [] : cfg.urls)) {
          report({ phase: 'download', url, got: 0, total: Number(cfg.bytes) || 0, percent: 0 });
          let candidate;
          try { candidate = await this.ocrDownload(url, { onProgress, control: control2 }); }
          catch (e) { failure = e; report({ phase: 'download-failed', url, message: String(e.message || e) }); continue; }
          const candidateDigest = hex(await crypto.subtle.digest('SHA-256', candidate));
          if (cfg.sha256 && candidateDigest !== cfg.sha256) {
            failure = Error('下载校验失败：sha256 与清单不一致');
            report({ phase: 'verify-failed', url, sha256: candidateDigest });
            continue;
          }
          bytes = candidate; digest = candidateDigest; usedUrl = url; break;
        }
        if (!bytes) throw failure || Error('所有下载地址都失败了');
        if (!String(usedUrl).startsWith('cache:')) {
          try {
            await IOUtils.makeDirectory(PathUtils.join(paths.root, 'cache'), { ignoreExisting: true });
            await IOUtils.write(paths.cache, bytes);
          } catch { /* 缓存写不进去不影响安装 */ }
        }
        report({ phase: 'extract', done: 0, total: 0 });
        const files = await this.ocrExtractZip(bytes, paths.staging, { onProgress, control: control2 });
        bytes = null; // 释放整包内存，之后只动磁盘
        report({ phase: 'activate', files });
        const leftovers = [];
        for (const name of ['python', 'deps', 'models']) {
          const from = PathUtils.join(paths.staging, name), to = PathUtils.join(paths.root, name);
          if (!await IOUtils.exists(from)) throw Error('整包缺少目录：' + name);
          const leftover = await this.ocrClearTarget(to, paths.root);
          if (leftover) leftovers.push(leftover);
          await IOUtils.move(from, to);
        }
        const manifestFrom = PathUtils.join(paths.staging, 'manifest.json');
        if (await IOUtils.exists(manifestFrom)) await IOUtils.copy(manifestFrom, PathUtils.join(paths.root, 'manifest.json'));
        await IOUtils.remove(paths.staging, { recursive: true });
        // 记住装之前的路径：用户原来那套（比如自己装好的 Python）要能恢复。
        const runtime = this.graphicRuntime();
        const previousPaths = { python: runtime.python || '', runtime: runtime.runtime || '', models: runtime.models || '' };
        const record = { version: cfg.version || '', sha256: digest, files, bytes: Number(cfg.bytes) || 0, source: usedUrl, installedAt: new Date().toISOString(), platform: cfg.platform || 'win-x64', previousPaths, leftovers };
        await IOUtils.writeUTF8(paths.record, JSON.stringify(record, null, 1));
        this.setGraphicRuntimeValue('python', paths.python);
        this.setGraphicRuntimeValue('runtime', paths.deps);
        this.setGraphicRuntimeValue('models', paths.models);
        this.setGraphicRuntimeValue('engine', undefined); // 旧版遗留键，清掉
        report({ phase: 'verify' });
        let integrity = await this.ocrVerifyInstall(paths, { deep: true });
        if (!integrity.ok) {
          report({ phase: 'repair', missing: integrity.missing });
          try { await this.ocrRepairInstall({ control: control2 }); integrity = await this.ocrVerifyInstall(paths, { deep: true }); }
          catch (e) { integrity = { ok: false, missing: [...integrity.missing, String(e.message || e)] }; }
        }
        const selftest = await this.ocrInstallSelfTest();
        const state = await this.ocrInstallState();
        report({ phase: 'done', files, sha256: digest, selftest, integrity, leftovers, state });
        if (!integrity.ok) throw Error('安装后校验未通过：缺少 ' + integrity.missing.slice(0, 5).join('、'));
        return { ok: selftest.ok !== false, files, sha256: digest, source: usedUrl, selftest, integrity, leftovers, state };
      } catch (e) {
        try { if (await IOUtils.exists(paths.staging)) await IOUtils.remove(paths.staging, { recursive: true }); } catch { /* keep going */ }
        const message = String(e.message || e);
        report({ phase: 'error', message });
        return { ok: false, error: message };
      }
    };
    // 菜单入口：安装过程用 Zotero 自带进度窗口显示，不看面板也知道在干什么。
    app.ocrInstallInteractive = async function () {
      const progress = this._ocrProgressWindow?.();
      const result = await this.installOCREngine({
        onProgress: update => {
          if (update.phase === 'download') progress('正在下载识别运行时… ' + mb(update.got) + ' / ' + mb(update.total) + '（' + (update.percent || 0) + '%）', update.percent || 0);
          else if (update.phase === 'extract') progress('正在解包… ' + update.done + ' / ' + (update.total || '?'), update.total ? update.done / update.total * 100 : 100);
          else if (update.phase === 'activate') progress('正在就位…', 100);
          else if (update.phase === 'verify') progress('正在自检…', 100);
          else if (update.phase === 'error') progress('安装失败：' + update.message, 0, true);
        },
      });
      const test = result.selftest || {};
      if (result.ok) progress('识别引擎已就绪：自检认出「' + (test.lines || []).join(' ') + '」', 100);
      else progress('安装失败：' + result.error, 0, true);
      return result;
    };
    app._ocrProgressWindow = function () {
      let window_ = null, line = null;
      const make = () => {
        try {
          const pw = new Zotero.ProgressWindow({ closeOnClick: false });
          pw.changeHeadline('PaperLoom · 识别引擎');
          line = new pw.ItemProgress('', '准备安装…');
          pw.show();
          window_ = pw;
        } catch { window_ = null; line = null; }
      };
      make();
      let lastAt = 0;
      return (text, percent, error) => {
        try {
          if (!window_) return;
          if (!line) make();
          line.setText ? line.setText(text) : (line.text = text);
          if (error) line.setError && line.setError();
          else if (typeof percent === 'number') line.setProgress(Math.max(0, Math.min(100, percent)));
          const now = Date.now();
          if (now - lastAt > 150) { lastAt = now; window_.show?.(); }
          if (error) window_.startCloseTimer && window_.startCloseTimer(30000);
          else if (percent === 100) window_.startCloseTimer && window_.startCloseTimer(6000);
        } catch { /* 进度窗口只是提示，失败不影响安装 */ }
      };
    };
    // 装完必须能真的认出一行字，才算安装成功。
    app.ocrInstallSelfTest = async function () {
      const win = Zotero.getMainWindow(), doc = win.document, canvas = doc.createElement('canvas');
      canvas.width = 720; canvas.height = 160;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000'; ctx.font = '44px Times New Roman';
      ctx.fillText('Figure 8 Power Grid', 20, 100);
      const started = Date.now();
      try {
        const parsed = await this.runGraphicOCR(canvas, { stopped: false, requests: new Set() });
        const lines = (parsed?.lines || []).map(line => line.text);
        return { ok: lines.length > 0, lines, ms: Date.now() - started };
      } catch (e) {
        return { ok: false, error: String(e.message || e), ms: Date.now() - started };
      }
    };
    app.uninstallOCREngine = async function () {
      const paths = this.ocrInstallPaths(), runtime = this.graphicRuntime();
      let record = null;
      try { record = JSON.parse(await IOUtils.readUTF8(paths.record)); } catch { record = null; }
      if (await IOUtils.exists(paths.root)) {
        const ok = await this.ocrRemoveTree(paths.root);
        if (!ok) throw Error('运行时目录被占用，删不掉：' + paths.root);
      }
      for (const key of ['python', 'runtime', 'models']) {
        const value = runtime[key];
        if (value && String(value).startsWith(paths.root)) this.setGraphicRuntimeValue(key, undefined);
      }
      // 把安装前的路径还回去（如果那些文件还在）。
      const previous = record?.previousPaths || {}, restore = {};
      const has = async file => { try { return !!file && await IOUtils.exists(file); } catch { return false; } };
      if (await has(previous.python) && await has(previous.runtime) && await has(previous.models)) {
        restore.python = previous.python; restore.runtime = previous.runtime; restore.models = previous.models;
        this.setGraphicRuntimeValue('python', previous.python);
        this.setGraphicRuntimeValue('runtime', previous.runtime);
        this.setGraphicRuntimeValue('models', previous.models);
      }
      return Object.assign(await this.ocrInstallState(), { restored: restore });
    };
    // 离线路线：整包已经解开、或者手上就有现成的 python + 依赖 + 模型目录。
    app.ocrInstallFromFolder = async function (dir) {
      const clean = String(dir || '').replace(/[\\/]+$/, '');
      if (!clean) throw Error('没有选择文件夹');
      const has = async file => { try { return await IOUtils.exists(file); } catch { return false; } };
      const bundled = {
        python: PathUtils.join(clean, 'python', 'python.exe'),
        deps: PathUtils.join(clean, 'deps'),
        models: PathUtils.join(clean, 'models', 'det.onnx'),
      };
      const flat = {
        python: PathUtils.join(clean, 'python.exe'),
        deps: PathUtils.join(clean, 'deps'),
        models: PathUtils.join(clean, 'models', 'det.onnx'),
      };
      const found = (await has(bundled.python)) ? bundled : flat;
      if (!await has(found.python)) throw Error('这个文件夹里没有 python.exe（整包解开的目录或现成的 python 目录都行）');
      if (!await has(found.deps)) throw Error('这个文件夹里没有 deps 目录（OCR 依赖）');
      if (!await has(found.models)) throw Error('这个文件夹里没有 models/det.onnx（识别模型）');
      this.setGraphicRuntimeValue('python', found.python);
      this.setGraphicRuntimeValue('runtime', found.deps);
      this.setGraphicRuntimeValue('models', PathUtils.join(clean, 'models'));
      const selftest = await this.ocrInstallSelfTest();
      return { ok: selftest.ok !== false, selftest, state: await this.ocrInstallState() };
    };

    // 删除目录：Zotero 的 IOUtils.remove 偶尔报「目录非空」（文件刚被别的进程打开过），
    // 所以重试 + 逐个删 + 实在不行改名让开，绝不让一次重装卡死在这。
    app.ocrRemoveTree = async function (path, { attempts = 4 } = {}) {
      for (let i = 0; i < attempts; i++) {
        try { await IOUtils.remove(path, { recursive: true }); return true; }
        catch (e) {
          for (const child of await IOUtils.getChildren(path).catch(() => [])) {
            await this.ocrRemoveTree(child, { attempts: 2 }).catch(() => {});
          }
          await new Promise(resolve => setTimeout(resolve, 150 * (i + 1)));
        }
      }
      return !(await IOUtils.exists(path));
    };
    app.ocrClearTarget = async function (to, root) {
      if (!await IOUtils.exists(to)) return null;
      if (await this.ocrRemoveTree(to)) return null;
      const aside = PathUtils.join(root, 'leftover-' + Date.now() + '-' + PathUtils.filename(to));
      try { await IOUtils.move(to, aside); return aside; } catch { return to; }
    };

    // ---- 完整性校验与修复 -------------------------------------------------
    // 必需文件（缺一个就跑不起来/认不出）：嵌入 python 的解释器与标准库、三个模型、
    // 依赖包里各库的入口文件。
    app.ocrRequiredFiles = function () {
      return [
        'python/python.exe', 'python/python312.dll', 'python/python312.zip', 'python/python312._pth',
        'models/det.onnx', 'models/rec.onnx', 'models/cls.onnx',
        'deps/numpy/__init__.py', 'deps/cv2/__init__.py', 'deps/onnxruntime/__init__.py', 'deps/rapidocr/__init__.py',
        'deps/shapely/__init__.py', 'deps/pyclipper/__init__.py', 'deps/PIL/__init__.py', 'deps/yaml/__init__.py',
      ];
    };
    app.ocrVerifyInstall = async function (paths, { deep } = {}) {
      const root = paths?.root || this.ocrInstallPaths().root;
      const missing = [];
      for (const rel of this.ocrRequiredFiles()) {
        const file = PathUtils.join(root, ...rel.split('/'));
        let ok = false, empty = false;
        try {
          if (await IOUtils.exists(file)) {
            const stat = await IOUtils.stat(file).catch(() => null);
            empty = !!stat && typeof stat.size === 'number' && stat.size === 0;
            ok = !empty;
          }
        } catch { ok = false; }
        if (!ok) missing.push(empty ? rel + '（空文件）' : rel);
      }
      let counts = null;
      if (deep) {
        // 文件数对照清单：整包解出来是 1200+ 个文件，明显少说明有东西被删掉了。
        const cfg = await this.ocrInstallConfig().catch(() => null);
        const expected = Number(cfg?.files) || 0;
        const walk = async dir => {
          let n = 0;
          for (const child of await IOUtils.getChildren(dir).catch(() => [])) {
            let type = '';
            try { type = (await IOUtils.stat(child)).type; } catch { continue; }
            n += type === 'directory' ? await walk(child) : 1;
          }
          return n;
        };
        const actual = await walk(PathUtils.join(root, 'deps'));
        counts = { expected: expected || 0, actual };
        if (expected && actual < expected) missing.push('deps 文件数不足：' + actual + ' / ' + expected);
      }
      return { ok: !missing.length, missing, counts, root };
    };
    // 修复：用本地整包缓存直接覆盖解到安装目录，再校验一次（不需要重新下载）。
    app.ocrRepairInstall = async function ({ onProgress, control } = {}) {
      const paths = this.ocrInstallPaths();
      const before = await this.ocrVerifyInstall(paths, { deep: true });
      if (before.ok) return { ok: true, repaired: false, state: await this.ocrInstallState() };
      let bytes = null;
      if (await IOUtils.exists(paths.cache)) {
        try { bytes = new Uint8Array(await IOUtils.read(paths.cache)); } catch { bytes = null; }
      }
      if (!bytes) throw Error('本地没有整包缓存，请点“安装识别引擎（一键）”重新下载');
      for (const name of ['python', 'deps', 'models']) await this.ocrClearTarget(PathUtils.join(paths.root, name), paths.root);
      await this.ocrExtractZip(bytes, paths.root, { onProgress, control });
      bytes = null;
      const after = await this.ocrVerifyInstall(paths, { deep: true });
      if (!after.ok) throw Error('修复后仍缺少：' + after.missing.slice(0, 5).join('、'));
      return { ok: true, repaired: true, state: await this.ocrInstallState() };
    };

    // ---- 界面 ------------------------------------------------------------
    app.ocrPickFolder = function (title) {
      try {
        const nsIFilePicker = Components.interfaces.nsIFilePicker;
        const picker = Components.classes['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
        picker.init(Zotero.getMainWindow(), title || '选择文件夹', nsIFilePicker.modeGetFolder);
        const result = picker.show();
        if (result !== nsIFilePicker.returnOK || !picker.file) return '';
        return picker.file.path;
      } catch (e) { throw Error('打开文件夹选择器失败：' + (e.message || e)); }
    };
    app.mountOCRInstallControls = function (doc, host, { compact, onStatus } = {}) {
      if (!host) return null;
      host.replaceChildren();
      const wrap = doc.createElement('div'); wrap.className = 'pl-ocr-install';
      const status = doc.createElement('p'); status.className = 'pl-ocr-status';
      status.style.cssText = 'margin:0 0 6px;font:12px/1.5 system-ui;opacity:.85'; status.textContent = '识别引擎：读取状态…';
      const bar = doc.createElement('div');
      bar.style.cssText = 'height:4px;border-radius:2px;background:#8883;overflow:hidden;margin:0 0 8px';
      const fill = doc.createElement('i'); fill.style.cssText = 'display:block;height:100%;width:0;background:#7b9ad6;transition:width .2s';
      bar.appendChild(fill);
      const row = doc.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
      const primary = doc.createElement('button'); primary.type = 'button'; primary.style.cssText = 'font:13px system-ui;padding:5px 12px;cursor:pointer';
      const importBtn = doc.createElement('button'); importBtn.type = 'button'; importBtn.textContent = '从文件夹导入…';
      const checkBtn = doc.createElement('button'); checkBtn.type = 'button'; checkBtn.textContent = '重新检测';
      const removeBtn = doc.createElement('button'); removeBtn.type = 'button'; removeBtn.textContent = '卸载';
      for (const node of [importBtn, checkBtn, removeBtn]) node.style.cssText = 'font:12px system-ui;padding:4px 9px;cursor:pointer;opacity:.85';
      const note = doc.createElement('p'); note.className = 'pl-ocr-note';
      note.style.cssText = 'margin:6px 0 0;font:11px/1.5 system-ui;opacity:.7';
      if (!compact) note.textContent = '识别全程在本机运行：插件只下载运行时与模型，页面图像不会发往任何服务器。';
      wrap.append(status, bar, row, note); row.append(primary, importBtn, checkBtn, removeBtn); host.appendChild(wrap);
      const say = (text, error) => { status.textContent = text; status.style.color = error ? '#c0392b' : ''; if (onStatus) onStatus(text, error); };
      let state = null;

      const refresh = async () => {
        state = await app.ocrInstallState();
        primary.textContent = state.mode === 'none'
          ? '一键安装识别引擎（' + mb((await app.ocrInstallConfig().catch(() => ({}))).bytes || 105889554) + '）'
          : '重新安装 / 修复（' + mb(state.bytes || 105889554) + '）';
        primary.disabled = false;
        removeBtn.hidden = !state.installed;
        if (state.mode === 'managed') say('识别引擎：已就绪（插件安装的本机 Python' + (state.version ? '，整包 ' + state.version : '') + '）');
        else if (state.mode === 'external') say('识别引擎：已就绪（使用你已配置的 Python 路径：' + state.configuredPaths.python + '）');
        else if (state.installed) say('识别引擎：运行时已装好但路径没指向它，点“重新安装 / 修复”。', true);
        else say('识别引擎：未安装。图表与扫描件里的文字暂时无法识别，正文翻译不受影响。');
        return state;
      };
      const busy = value => { primary.disabled = value; importBtn.disabled = value; checkBtn.disabled = value; removeBtn.disabled = value; };
      const progress = update => {
        if (update.phase === 'download') fill.style.width = (update.percent || 0) + '%';
        else if (update.phase === 'extract') fill.style.width = update.total ? Math.round(update.done / update.total * 100) + '%' : '100%';
        else if (update.phase === 'activate' || update.phase === 'verify') fill.style.width = '100%';
      };
      primary.addEventListener('click', async () => {
        busy(true); fill.style.width = '0';
        const result = await app.installOCREngine({
          onProgress: update => {
            progress(update);
            if (update.phase === 'download') say('正在下载识别运行时… ' + mb(update.got) + ' / ' + mb(update.total) + '（' + (update.percent || 0) + '%）');
            else if (update.phase === 'extract') say('正在解包… ' + update.done + ' / ' + (update.total || '?') + ' 个文件');
            else if (update.phase === 'activate') say('正在就位…（' + update.files + ' 个文件）');
            else if (update.phase === 'verify') say('正在自检：识别一张样例图…');
            else if (update.phase === 'error') say('安装失败：' + update.message, true);
          },
        });
        busy(false); fill.style.width = result.ok ? '100%' : '0';
        if (!result.ok) { say('安装失败：' + result.error, true); return; }
        const test = result.selftest || {};
        if (test.ok === false) {
          say('运行时已装好，但自检没认出文字：' + (test.error || '识别结果为空'), true);
        } else {
          say('识别引擎已就绪：自检认出「' + (test.lines || []).join(' ') + '」（' + test.ms + ' ms）');
        }
        await refresh();
      });
      importBtn.addEventListener('click', async () => {
        try {
          const dir = app.ocrPickFolder('选择 OCR 运行时文件夹（整包解开的目录，或现成的 python 目录）');
          if (!dir) return;
          busy(true); say('正在用文件夹里的运行时自检…');
          const result = await app.ocrInstallFromFolder(dir);
          busy(false);
          say(result.ok ? '已使用该文件夹的识别引擎，自检通过。' : '自检失败：' + ((result.selftest || {}).error || '识别结果为空'), !result.ok);
          await refresh();
        } catch (e) { busy(false); say(String(e.message || e), true); }
      });
      checkBtn.addEventListener('click', async () => { busy(true); await refresh(); busy(false); });
      removeBtn.addEventListener('click', async () => {
        const win = Zotero.getMainWindow();
        if (typeof win.confirm === 'function' && !win.confirm('删除已安装的识别运行时？正文译文不受影响。')) return;
        busy(true); await app.uninstallOCREngine(); busy(false);
        fill.style.width = '0'; await refresh();
      });
      refresh().catch(e => say('读取识别引擎状态失败：' + (e.message || e), true));
      return { refresh, say };
    };
  }

  CubeOCRInstall = { attach };
})();
