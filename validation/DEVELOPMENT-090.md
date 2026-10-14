# 0.9.0 开发记录：删掉内置引擎，改成一键安装本机识别引擎

## 为什么

0.8.38 为了「解包即用」内置了 onnxruntime-web + PP-OCRv4 **mobile** 引擎，实测不合格：

- 图内小字错误率高到不可用（`Administrative territorial emissions` → `dln inistrative territorial emisslons`）；
- 框选时用的是**显示画布**（整页 586×833px），小字根本没有足够像素；
- 内置引擎返回的行只有 `quad` 没有 `polygon`，`mergeLabels` 全丢，表现成「框选后没反应」；
- 内置引擎的角点顺序是 BL→BR→TR→TL，和 `tools/ocr-image.py` 的 TL→TR→BR→BL 相反，画出来的译文旋转 180°（镜像乱码）。

结论：删掉整条内置路线，识别只走**用户已经验收过的本机 Python（rapidocr + PP-OCRv4）**；模型文件（16MB，Apache-2.0）留在 XPI 里当一键安装的载荷。

## 删掉了什么

| 文件 | 处理 |
| --- | --- |
| `addon/content/ocr-wasm.js` | 删除（CTC 解码 / DB 检测框 / 行归组 / 字典） |
| `addon/content/ocr-runtime.js` | 删除（运行时状态机、provider 分发、ORT 宿主窗口） |
| `addon/models/ort.min.js`、`addon/models/ort-wasm-simd.wasm` | 删除（onnxruntime-web 内核） |
| `tests/ocr-runtime.test.cjs` | 删除 |
| `bootstrap.js` 两行 `loadSubScript` + `CubeOCRRuntime.attach` | 删除 |
| `graphics.js` 的 `runGraphicOCRBuiltin`、provider 分发、`ocrPythonReady` | 删除；`runGraphicOCR` 现在直接指向 `runGraphicOCRPython` |
| 设置页 / 图表面板里的「图表识别引擎」下拉 | 删除 |

测试数 248 → 240（删掉的内核测试）→ 现在 247（新增 7 项安装器测试）。

## 一键安装（本机 Python 运行时）

- 整包：`scripts/build-ocr-bundle.py` 产出 `paperloom-ocr-runtime-win-x64-1.0.0.zip`
  （Python 3.12.10 embedded + 21 个 wheel：rapidocr 3.10.0 / onnxruntime 1.31.0 / opencv-headless / numpy / Pillow / shapely / pyclipper / yaml / omegaConf …）
  **105889554 字节，sha256 `56e701d5e0dff7a600076e2112c5443a6ab3c1f2904707d0f35aa4749359ab64`，1297 个条目**，已发布在 GitHub Release 标签 `ocr-runtime-1.0.0`。
  构建脚本对每个 wheel 用 PyPI JSON API 取权威 URL + sha256 并与本地实测 sha256 对照，清单写进整包的 `manifest.json`。
- 清单：`addon/ocr-runtime.json`（版本/平台/字节数/sha256/文件数/下载地址/许可清点）。
- 安装流程（`addon/content/ocr-install.js`，模块 `CubeOCRInstall`）：
  1. 读清单；有本地缓存 `<root>/cache/bundle.zip` 且 sha256 匹配就直接用（重试不再下 101MB）；
  2. 流式下载 + 进度 + 取消；
  3. `crypto.subtle` 校验 sha256，不符就换下一个地址；
  4. **纯 JS 解包**：自己解析 zip 中央目录，`DecompressionStream('deflate-raw')` 手动 write/read 解流
     （特权作用域里没有 `Blob`/`Response`，`DecompressionStream` 也要向主窗口取），写 `staging/`；
  5. 就位：`staging/{python,deps,models}` → `root/`，覆盖前先删旧目录（旧路径记在 `install.json.previousPaths`）；
  6. 写三个路径（`python` / `runtime` / `models`），清掉旧版遗留的 `engine` 键；
  7. 完整性校验（必需文件 + `deps` 文件数对照清单），不达标就用缓存**自动修复一次**；
  8. 自检：合成图 → `runGraphicOCR` → 认不出文字就报失败，并把卡在哪一步写回结果。
- 离线：整包解开的目录、或现成的 `python + deps + models` 目录都可以「从文件夹导入…」，不走网络。
- 卸载：删 `root/`，并把 `install.json.previousPaths` 里仍然存在的路径还回 prefs。

### 安装位置

```
C:\Users\Administrator\Zotero\paperloom\runtime\ocr\
  python\      python.exe + python312.zip + python312._pth + *_pyd/dll
  deps\        rapidocr / cv2 / onnxruntime / numpy / PIL / shapely / pyclipper / yaml …
  models\      det.onnx / rec.onnx / cls.onnx   （从 XPI 的 addon\models 复制并改名）
  cache\bundle.zip
  install.json manifest.json
```

## 宿主实测

| 项目 | 结果 |
| --- | --- |
| 仓库 | `cube-lover/paperloom`（按用户要求由私有改为 **public**，Release 资产才能匿名下载；私有仓库的资产直链对匿名请求返回 404，这正是第一次安装报 `下载失败（HTTP 404）` 的原因） |
| 一键安装（首次，真下载） | `ok:true`，101MB 下载 + 校验 + 解包 1297 个文件，49 秒；`install.json` 记下 `sha256 56e701…ab64`、`files 1297`、`previousPaths`（你原来的 `D:\Backup\...\python.exe` + `.local\ocr-runtime` + `.local\ocr-models`） |
| 一键安装（重试，走缓存） | `source: cache:\...\cache\bundle.zip`，秒级完成，`selftest {ok:true, lines:["Figure 8 Power","r Grid"], ms:7196}` |
| `status.ocr` | `{installed:true, mode:'managed', ready:true, configuredUsable:true, present:{python,deps,models:true}}` |
| `ocr-selftest` | `ok:true`，2 行，4.4 秒（首装） |
| `region-translate 474 6 5 5 590 837` | 识别 **116 行**（engine `RapidOCR-local`），本页 115 行、勾选/已译 104、`overlayCounts [0,98]`；样本 `Administrative territorial emissions → 行政领土排放`、`Inventory of Chinese Cities → 中国城市清单` |

### 过程中的两个安装侧问题（都已处理）

1. `DecompressionStream is not defined`：特权作用域没有这个全局，也没有 `Blob`/`Response`。
   改成向 `Zotero.getMainWindow()` 取 `DecompressionStream`，并用手动 `writer.write` + `readable.getReader()` 解流。
2. 首次安装后 `python/` 目录少了 18 个文件（`python312.zip`、`python312._pth`、`python.cat`、`vcruntime140*.dll`、
   `_sqlite3.pyd`、`pyexpat.pyd` 等），表现为 `本地 OCR 运行失败`。重装（走缓存）后 35 个文件齐全且 45 秒后仍然齐全，
   未能复现。**因此加了安装后完整性校验 + 用缓存自动修复**，把这种静默缺失变成一条明确报错。
3. 面板上「上一次 OCR 失败」会挂在后续成功结果里（`ocrError` 是残留字段）→ 每次识别开始先清掉。

## 已知未完成（不宣称解决）

- **框选时的高分辨率重绘是否真的生效未确认**：`ocrProbe.crop` 仍是显示画布 586×833（但它只是 dev 探针自己的画布）。
  需要一次能截图阅读器的验证，或给行加分辨率标记后再确认。
- 通用 OCR 纠错（词典 + 编辑距离 + 数字/单位/公式模板保护）尚未落地；`refertothe emlsslonsthatoccur` 这类小字仍会错。
- 页 6 上早前错误引擎留下的 87 行残留已用 `graphics-purge-page` 清掉并重跑；同类清理还没有界面入口（只有 dev 动作）。
- item 474 的 8 页失败（根因是我自己插入的调试行造成 TDZ `can't access lexical declaration 'ocr' before initialization`）需要在面板点一次「重试失败页」。
- 594 的 38 处真实相交、扫描件正文掩膜、第 18 页纵轴标题分片等旧问题不受本次影响。


## 续：擦除重做 / 框选小圆点 / Alt+R / 解析缓存

### 1. 擦除回归修复（已用宿主真实渲染核对）
根因链（逐条实测）：
1. 掩膜从屏幕像素抠墨迹，1x 下只剩半个笔画 → 英文擦不掉（用户抱怨"更垃圾"）。
   改为按页 **4 倍重绘**（`app.graphicHiResPage`，按页缓存、最多 2 页、随缩放失效、
   并发共享同一个 render promise）后再抠。
2. `pv.page` 未定义 → 真实属性是 `pv.pdfPage`。
3. 即便拿到页面，`page.render({canvasContext,...})` 仍报 `canvasContext is undefined`：
   pdf.js 只认**页面自己 realm** 里构造的参数（`new win.Object()` + `cloneInto`），
   跨 realm 传对象会丢参数——与仓库里既有的后台渲染写法一致。
4. 掩膜缓存进 `s.paintedMasks` 后 `s.paint()` 被 `paintKeys` 判为"无变化"跳过 →
   页面仍是首次绘制的兜底底色。修法：key 里加入 `s.maskRevision`，并把
   逐块重画合并成 300ms 防抖的一次。
5. 抠不出独立字形（文字压在彩条上）时改铺**框内最亮众数颜色的不透明纯色**
   （`app.graphicFlatPaperColor`），不再用四周环带渐变（色斑来源）。

宿主证据（521 第 8 页表格页，`graphics-preview` 自审 + 3x 裁剪目视）：
- 修复前：`covers {ring-gradient:56}`，City 列中文背后是彩色渐变斑。
- 修复后：`covers {glyph-mask:56}`，City/Location 两列中文背后为干净纸面，
  英文无残影；掩膜保留穿过框内的原生表格细线（这是掩膜的预期行为）。

### 2. 框选后只显示小圆点（不再弹大面板）
- `app.selectGraphicRegion` 改用 `openGraphics(reader,{panel:false})`；
  自动弹面板行为取消。
- `app.regionBadge/showRegionBadge/hideRegionBadge/toggleRegionList/finishRegionBadge`：
  圆点在工具栏按钮旁，`择 → 转圈 → 数字`，点击展开紧凑列表（原文 → 译文、
  已译条数、打开完整面板、再框一次），点别处/✕/2 分钟自动隐藏，**不常驻**。
- 宿主实测（`region-badge-demo` 521 第 8 页）：
  `armed{visible:true,count:"择"} → busy{title:"…正在识别…"} → done{count}`，
  展开后列表 390×67 定位在按钮下方，`hideRegionBadge` 后 DOM 移除。
- 顺带清掉插件重载后遗留的旧 `.pl-graphic-select` 覆盖层，避免框到失效层。

### 3. Alt+R 绑定修复（宿主实测 hits=1）
- 按键不会跨 iframe 冒泡：现在给工具栏文档、主/次 PDF 文档、各子 iframe 的窗口
  都挂 capture keydown，并用递归 `setTimeout` 每 1.5s 补挂新视图。
- 屏蔽条件放宽为"只有真正的输入控件"，工具栏按钮持焦时仍可用。
- 宿主 `region-shortcut 521`：`matched:true`、`hits:1`、`gate:1`、`isPrimary:true`
  → 处理函数确实被触发并进入框选流程（与工具栏按钮同一条代码路径）。

### 4. 版面解析结果落盘复用
- `CubeCheckpoint.layoutCacheFile/readLayoutCache/writeLayoutCache/clearLayoutCache`；
  `inplace.js` 解析循环前先查缓存，命中则跳过 PDF worker 取数据 + `parsePage`；
  只有"本次全部页真解析"才写缓存；`L.VERSION`/`layoutCacheVersion`/指纹/页数
  任一不符即重解。设置页「清理缓存」连带清空 `layout/`。
- 单测覆盖：同指纹复用、指纹变/页数变/版本变失效、清理后失效。

### 仍未完成
- 解析缓存的实际命中要等用户下次重新打开论文才能看到（当前会话是本次构建之前解析的）。
- 合成鼠标事件无法可靠复现真实拖拽后的会话存活，小圆点的"松手→转圈→数字"
  状态链在宿主是用 `region-badge-demo` 逐状态验证的；真实拖拽请用户实按确认。
- 地图页（24 城图例）英文不在本次框选范围内，未做处理。
