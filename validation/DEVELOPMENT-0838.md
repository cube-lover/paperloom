# 0.8.38 开发记录：内置 OCR 引擎（下载即用）

## 结果
XPI 内自带识别引擎，用户装完不需 Python、不需联网、不需填任何路径，`auto` 直接选中内置引擎并跑通识别。

宿主实测（0.8.38，SHA256 `33e927aa15bccdb147d9bd47ebddff59df9c3b43805bf094eb08e3a560ac70de`）：
```
node scripts/host-job.cjs status        → ocr {engine:"builtin", bundled:6, missing:[], builtinReady:true}
node scripts/host-job.cjs ocr-selftest  → ok:true  text:"Figure 8 Power Grid"  lines:1
                                          det {dims:[1,1,160,640], mx:1, above:11077, boxes:1}
node scripts/host-job.cjs inspect-page 428 18 → graphics:13 overflow:0 records:9   （与 0.8.37 基线一致，无回归）
node scripts/test.cjs                   → 247 pass / 0 fail
```
`ocr-selftest` 走的是 `source.lines()`，与 `graphics.js` 调用完全同一条路径：建画布 → 检测 → 逐框识别 → CTC 解码 → 行归组 → 转写成 worker 同构的 `{text,score,quad,rotation,directionVerified}`。

## 随插件分发的文件（`addon/models/`，共 31.5MB 解包）
| 文件 | 大小 | 来源 | 许可 |
| --- | --- | --- | --- |
| `ch_PP-OCRv4_det_infer.onnx` | 4.7MB | PP-OCRv4 检测模型 | Apache-2.0 |
| `ch_PP-OCRv4_rec_infer.onnx` | 10.9MB | PP-OCRv4 识别模型 | Apache-2.0 |
| `ch_ppocr_mobile_v2.0_cls_infer.onnx` | 0.6MB | PP-OCRv2 方向分类 | Apache-2.0 |
| `keys.txt` | 26KB | PaddleOCR `ppocr_keys_v1.txt`（6623 字） | Apache-2.0 |
| `ort.min.js` | 0.55MB | onnxruntime-web 1.14.0 dist | MIT |
| `ort-wasm-simd.wasm` | 10.0MB | onnxruntime-web 1.14.0 dist | MIT |
`addon/models/NOTICE.txt` 记录了出处与许可，构建脚本原样打进 XPI（`ocrHasBundled`/`ocrRuntimeSource` 从 `runtimeRoot+'models/'` 读取）。

## 推理链路关键实现
- 识别前处理按 PP-OCR 官方参数：检测输入最短边 736（上限 2000，边长对齐 32）、mean/std 0.5；识别输入高 48、宽按比例（最小 320、8 的倍数）。
- 检测后处理用自研 `CubeOCR.boxRects`（阈值 0.5 / 0.3、外扩 1.6）+ 连通域；识别用自研 `decodeCTC`。
- 字符表：`dict=['', …6623字, ' ']`（类 0 为 CTC blank，末类为空格）。修掉了 `parseDict` 末尾换行导致的空项错位——这正是先前 "Figure8PowerGrid" 丢空格的原因。
- **ORT 运行环境**（本机调试中最花时间的部分，逐条记录以免回退）：
  1. ORT 需要 `document`/`fetch` 才能定位并实例化 wasm；pure subscript 作用域会报 `No ScriptLoader found for the current context`。
  2. jar: 的 `<script src>` 注入被拒；把主窗口的**空白 iframe** 当全局对象用 `loadSubScript` 求值才成功（`about:blank` 无 AMD/`define` 干扰）。
  3. ORT 用 `instanceof` 校验入参，模型字节与张量必须用**该 iframe realm** 的 `Uint8Array`/`Float32Array` 构造（跨 realm 会报 `must be 'path' or 'buffer'`）。
  4. 画布必须建在真实 Zotero 窗口 document 上（在空白 iframe 里 `drawImage` 得到全透明，检测输入全白 → 输出全 0）。
  5. 每次加载都重新求值、并 `delete win.ort`：阅读器/主窗口跨插件重载存活，旧 ORT 实例会引用已不存在的 wasm 胶水。
  6. 原 `draw()` 参数错位（`draw(src,sw,sh,dw,dh)` 配 4 参调用）导致画布高为 0、整页全透明——这是 `mx:0, boxes:0` 的根因。

## 保留的功能
Python OCR 路线一字未动（`runGraphicOCRPython`），仍是可选高精度引擎；`off` 只关图片文字识别，正文翻译/原生文字层排版/选区/进度条不受影响；`builtin` 失败自动退回 `python`，两者都不可用时状态条给原因、不中断阅读。

## 仍未完成
- 594 页 38 处真实相交（`Context → …` 模板前缀行叠压正文行）。
- 扫描件正文仍走纸色实心块，未自动切字形掩膜。
- 第 18 页纵轴标题在低分辨率面板被拆成两分片。
- GPT-3 虚线/生命周期、`audit-interaction` copy 事件、`g39822d94b92c0a161ee9` 掩膜验收。
- 0.8.35—0.8.38 宿主截图（阅读器窗口可见时补取）。
