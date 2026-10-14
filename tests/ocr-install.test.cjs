/* 一键安装识别引擎的纯逻辑测试：zip 解析/解包、安装激活、路径写入、卸载。
 * 不联网：下载函数被替换成内存里的测试压缩包。 */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'),
  path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto'), vm = require('node:vm'),
  { createHarness } = require('./harness.cjs');

function zipBytes(entries) {
  const chunks = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8'), raw = Buffer.from(entry.data);
    const stored = !!entry.store, data = stored ? raw : zlib.deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(0, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(stored ? 0 : 8, 10);
    cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += local.length + name.length + data.length;
  }
  const dir = Buffer.concat(central), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(dir.length, 12); eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, dir, eocd]));
}

const BUNDLE = zipBytes([
  { name: 'python/python.exe', data: 'MZ-fake', store: true },
  { name: 'python/python312._pth', data: 'python312.zip\nimport site\n' },
  { name: 'python/python312.dll', data: 'MZ-fake-dll', store: true },
  { name: 'python/python312.zip', data: 'PK-fake-stdlib', store: true },
  { name: 'deps/rapidocr/__init__.py', data: '# rapidocr stub\n' },
  { name: 'deps/numpy/__init__.py', data: '# numpy stub\n' },
  { name: 'deps/cv2/__init__.py', data: '# cv2 stub\n' },
  { name: 'deps/onnxruntime/__init__.py', data: '# ort stub\n' },
  { name: 'deps/shapely/__init__.py', data: '# shapely stub\n' },
  { name: 'deps/pyclipper/__init__.py', data: '# pyclipper stub\n' },
  { name: 'deps/PIL/__init__.py', data: '# pillow stub\n' },
  { name: 'deps/yaml/__init__.py', data: '# yaml stub\n' },
  { name: 'models/det.onnx', data: 'det-model-bytes', store: true },
  { name: 'models/rec.onnx', data: 'rec-model-bytes' },
  { name: 'models/cls.onnx', data: 'cls-model-bytes' },
  { name: 'manifest.json', data: '{"kind":"paperloom-ocr-runtime"}\n' },
]);
const BUNDLE_SHA = crypto.createHash('sha256').update(Buffer.from(BUNDLE)).digest('hex');

async function harnessWithInstaller(t) {
  const box = await createHarness(t);
  Object.assign(box.context, { Blob, Response, DecompressionStream });
  // 真实实现：graphicRuntime/setGraphicRuntimeValue 来自 graphics.js，识别引擎的
  // 路径、状态与卸载逻辑都依它写 prefs。
  for (const file of ['graphics.js', 'ocr-install.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../addon/content', file), 'utf8'),
      box.context, { filename: file });
  }
  box.context.PaperLoomGraphics.attach(box.app, box.C);
  box.context.CubeOCRInstall.attach(box.app, box.C, null);
  const { app } = box;
  box.realInstallConfig = app.ocrInstallConfig.bind(app);
  app.ocrInstallConfig = async () => ({ version: 'test-1.0.0', platform: 'win-x64', bytes: BUNDLE.length, sha256: BUNDLE_SHA, urls: ['https://example.invalid/bundle.zip'] });
  app.ocrInstallSelfTest = async () => ({ ok: true, lines: ['Figure 8 Power Grid'], ms: 12 });
  return box;
}

test('zip 解析与解包按原样写盘，store 与 deflate 都支持', async t => {
  const { app, dir, IOUtils } = await harnessWithInstaller(t);
  const entries = app.ocrParseZip(BUNDLE);
  assert.equal(entries.length, 16);
  const target = path.join(dir, 'unzip');
  const files = await app.ocrExtractZip(BUNDLE, target, {});
  assert.equal(files, 16);
  assert.equal(await IOUtils.readUTF8(path.join(target, 'deps', 'rapidocr', '__init__.py')), '# rapidocr stub\n');
  assert.equal(Buffer.from(await IOUtils.read(path.join(target, 'models', 'det.onnx'))).toString(), 'det-model-bytes');
  assert.equal(await IOUtils.readUTF8(path.join(target, 'python', 'python312._pth')), 'python312.zip\nimport site\n');
  await assert.rejects(() => app.ocrExtractZip(new Uint8Array([1, 2, 3, 4]), target, {}), /不是有效的 zip/);
});

test('一键安装：下载→校验→解包→就位→写配置→自检', async t => {
  const { app, dir, IOUtils } = await harnessWithInstaller(t);
  const steps = [];
  let selftestCalls = 0;
  app.ocrInstallSelfTest = async () => { selftestCalls++; return { ok: true, lines: ['Figure 8 Power Grid'], ms: 9 }; };
  app.ocrDownload = async () => BUNDLE;
  const result = await app.installOCREngine({ onProgress: s => steps.push(s.phase) });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.files, 16);
  assert.equal(result.sha256, BUNDLE_SHA);
  assert.equal(selftestCalls, 1);
  assert.ok(steps.includes('download') && steps.includes('extract') && steps.includes('activate') && steps.includes('verify') && steps.includes('done'));
  const root = app.ocrInstallRoot();
  assert.equal(await IOUtils.exists(path.join(root, 'python', 'python.exe')), true);
  assert.equal(await IOUtils.exists(path.join(root, 'deps', 'numpy', '__init__.py')), true);
  assert.equal(await IOUtils.exists(path.join(root, 'models', 'det.onnx')), true);
  assert.equal(await IOUtils.exists(path.join(root, 'staging')), false);
  const record = JSON.parse(await IOUtils.readUTF8(path.join(root, 'install.json')));
  assert.equal(record.sha256, BUNDLE_SHA);
  assert.equal(record.source, 'https://example.invalid/bundle.zip');
  const runtime = app.graphicRuntime();
  assert.equal(runtime.python, path.join(root, 'python', 'python.exe'));
  assert.equal(runtime.runtime, path.join(root, 'deps'));
  assert.equal(runtime.models, path.join(root, 'models'));
  assert.equal(runtime.engine, undefined);
  const state = await app.ocrInstallState();
  assert.equal(state.installed, true);
  assert.equal(state.ready, true);
});

test('sha256 不符就不安装、不写配置，并保留最后一次错误', async t => {
  const { app, dir, IOUtils } = await harnessWithInstaller(t);
  app.ocrInstallConfig = async () => ({ version: 'test-1.0.0', bytes: BUNDLE.length, sha256: 'f'.repeat(64), urls: ['https://example.invalid/a.zip', 'https://example.invalid/b.zip'] });
  let downloads = 0;
  app.ocrDownload = async () => { downloads++; return BUNDLE; };
  const result = await app.installOCREngine({});
  assert.equal(result.ok, false);
  assert.match(result.error, /sha256|校验/);
  assert.equal(downloads, 2, '清单里的备选地址都会尝试');
  assert.equal(app.graphicRuntime().python, undefined);
  assert.equal(await IOUtils.exists(path.join(app.ocrInstallRoot(), 'python', 'python.exe')), false);
  assert.equal(await IOUtils.exists(path.join(app.ocrInstallRoot(), 'staging')), false);
});

test('识别引擎状态区分「已安装」与「已就绪」，卸载会清掉指向它的路径', async t => {
  const { app, dir, IOUtils } = await harnessWithInstaller(t);
  app.ocrDownload = async () => BUNDLE;
  const first = await app.ocrInstallState();
  assert.equal(first.installed, false);
  assert.equal(first.ready, false);
  await app.installOCREngine({});
  app.setGraphicRuntimeValue('python', '');
  const partial = await app.ocrInstallState();
  assert.equal(partial.installed, true);
  assert.equal(partial.ready, false, '文件在但路径没指向它时不算就绪');
  assert.equal(partial.mode, 'none');
  assert.equal(partial.installed, true, '运行时本身还在，所以能给“重新安装 / 修复”');
  await app.installOCREngine({});
  const after = await app.uninstallOCREngine();
  assert.equal(after.installed, false);
  assert.equal(app.graphicRuntime().python, undefined);
  assert.equal(app.graphicRuntime().runtime, undefined);
  assert.equal(app.graphicRuntime().models, undefined);
  assert.equal(await IOUtils.exists(app.ocrInstallRoot()), false);
});

test('卸载会把安装前的路径还回去，文件不在了就不还', async t => {
  const { app, IOUtils } = await harnessWithInstaller(t);
  const older = { python: path.join(app.dir, 'old', 'python.exe'), runtime: path.join(app.dir, 'old', 'deps'), models: path.join(app.dir, 'old', 'models') };
  for (const dir of [path.dirname(older.python), older.runtime, older.models]) {
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
  }
  await IOUtils.write(older.python, new Uint8Array([1]));
  app.setGraphicRuntimeValue('python', older.python);
  app.setGraphicRuntimeValue('runtime', older.runtime);
  app.setGraphicRuntimeValue('models', older.models);
  app.ocrDownload = async () => BUNDLE;
  await app.installOCREngine({});
  assert.equal(app.graphicRuntime().python, path.join(app.ocrInstallRoot(), 'python', 'python.exe'));
  const record = JSON.parse(await IOUtils.readUTF8(path.join(app.ocrInstallRoot(), 'install.json')));
  assert.deepEqual(JSON.parse(JSON.stringify(record.previousPaths)), older);
  const after = await app.uninstallOCREngine();
  assert.deepEqual(JSON.parse(JSON.stringify(after.restored)), older);
  assert.equal(app.graphicRuntime().python, older.python, '卸载后回到用户原来的路径');
});

test('从文件夹导入接受整包目录与扁平目录，缺件时明确报缺什么', async t => {
  const { app, dir, IOUtils } = await harnessWithInstaller(t);
  const bundleDir = path.join(dir, 'extracted');
  await IOUtils.makeDirectory(path.join(bundleDir, 'deps'), { ignoreExisting: true });
  await IOUtils.makeDirectory(path.join(bundleDir, 'models'), { ignoreExisting: true });
  await IOUtils.makeDirectory(path.join(bundleDir, 'python'), { ignoreExisting: true });
  await IOUtils.write(path.join(bundleDir, 'python', 'python.exe'), new Uint8Array([1]));
  await IOUtils.write(path.join(bundleDir, 'models', 'det.onnx'), new Uint8Array([1]));
  const bundle = await app.ocrInstallFromFolder(bundleDir);
  assert.equal(bundle.ok, true);
  assert.equal(app.graphicRuntime().python, path.join(bundleDir, 'python', 'python.exe'));
  assert.equal(app.graphicRuntime().models, path.join(bundleDir, 'models'));
  const flatDir = path.join(dir, 'flat');
  await IOUtils.makeDirectory(path.join(flatDir, 'deps'), { ignoreExisting: true });
  await IOUtils.makeDirectory(path.join(flatDir, 'models'), { ignoreExisting: true });
  await IOUtils.write(path.join(flatDir, 'python.exe'), new Uint8Array([1]));
  await IOUtils.write(path.join(flatDir, 'models', 'det.onnx'), new Uint8Array([1]));
  const flat = await app.ocrInstallFromFolder(flatDir);
  assert.equal(flat.ok, true);
  assert.equal(app.graphicRuntime().python, path.join(flatDir, 'python.exe'));
  const emptyDir = path.join(dir, 'empty');
  await IOUtils.makeDirectory(emptyDir, { ignoreExisting: true });
  await assert.rejects(() => app.ocrInstallFromFolder(emptyDir), /python\.exe/);
  const noModels = path.join(dir, 'no-models');
  await IOUtils.makeDirectory(path.join(noModels, 'deps'), { ignoreExisting: true });
  await IOUtils.write(path.join(noModels, 'python.exe'), new Uint8Array([1]));
  await assert.rejects(() => app.ocrInstallFromFolder(noModels), /det\.onnx/);
});

test('安装清单来自插件内部且必须带下载地址', async t => {
  const box = await harnessWithInstaller(t);
  const { app } = box;
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'addon', 'ocr-runtime.json'), 'utf8'));
  assert.match(manifest.urls[0], /^https:\/\/github\.com\//);
  assert.equal(manifest.platform, 'win-x64');
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
  assert.ok(manifest.bytes > 50 * 1024 * 1024, '整包体积应与离线运行时相符');
  // 清单里没有下载地址时必须明确报错，而不是静默装了个空的
  box.context.fetch = async () => ({ ok: true, json: async () => ({ version: 'x' }) });
  await assert.rejects(() => box.realInstallConfig(), /下载地址/);
  box.context.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => box.realInstallConfig(), /清单缺失/);
});
