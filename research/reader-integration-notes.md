# 阅读器内联翻译机制（逆向 Magic + Zotero 阅读器源码确认）

目的：搞清楚“在原文 PDF 上逐段显示译文”的技术路径，供 PaperLoom **独立实现**参考。
不复制 Magic 的业务代码、激活逻辑或凭据，仅参考其对 Zotero 阅读器公共/内部对象的调用方式；
关键结构已用 Zotero 9.0.6 自带源码（reader.js、pdf/web/viewer.mjs）交叉确认。

## 关键结论
Magic 的“原文上翻译”不是在 canvas 上画 overlay，而是利用 **Zotero 阅读器的分屏（split view）**：
- 把阅读器分屏（纵/横），主屏保留原文，**副屏渲染译文**。
- 译文以 `.translate-box` 文本块的形式，按页注入到副屏 PDF.js 的 `.page` 里，
  并注入 `<style>`（`--font-size-factor`、`--line-height-factor` 等变量）控制字号/行距/字体。
- 主副屏滚动联动，通过 `PDFViewerApplication.pdfViewer.scrollPageIntoView({pageNumber})` 实现（对应“双屏关联 Shift+Q”）。
- 逐段可见：翻译完一段就填一段对应的 `.translate-box`。

对应 Magic 菜单：全文翻译 / 字号 / 行间距 / 字体 / 引擎 / 解析 / 模式(逐段) / 输出(阅读界面) / 双屏关联。

## Zotero 阅读器内部 API（已在 reader.js 确认）
- `reader._internalReader._primaryView` / `._secondaryView`，各有 `._iframeWindow`。
- `reader._internalReader.splitType`（'vertical' | 'horizontal'），菜单项 `view-menuitem-split-vertically/horizontally`。
- Magic 的 `getTranslatedView(reader)`：读取 view 设置→取 `_<view>View`；若副屏不存在，按 `splitOrientation`
  调用 `reader.toggle<Orientation>SplitView(true)`，`await Zotero.Promise.delay(1000)` 后重试拿到副屏。
- 事件：`renderToolbar`、`renderTextSelectionPopup`（官方文档化）用于加按钮。

## PDF.js 视图 DOM（pdf/web/viewer.mjs 确认，标准 PDF.js 结构）
- `#viewer` 容器，内含每页 `div.page[data-page-number]`。
- 每页有 `.canvasWrapper`（渲染位图）、`.textLayer`（按坐标排布的文本 span）。
- `textLayerMode`、`scrollPageIntoView({pageNumber, destArray, ...})`。

## PaperLoom 独立实现方案（待联调）
1. 阅读器工具栏按钮「译研·翻译本篇」→ `translateInReader(reader)`。
2. 取 `reader._internalReader._primaryView._iframeWindow`，从 `.textLayer` 按几何聚合段落得到原文分段
   （与现有 segmentText 对齐；也可直接用 PDFWorker 全文 + 页码映射）。
3. 开副屏：若无 `_secondaryView`，按设置纵/横分屏，等待副屏 iframe ready。
4. 向副屏注入 `<style id="paperloom-style">`（字号/行距/字体 CSS 变量）与每页 `.paperloom-tbox` 容器。
5. 逐段翻译，完成一段即把译文写入对应页/段的 `.paperloom-tbox`（textContent，安全渲染）。
6. 滚动联动：监听主屏 `#viewer` 滚动→副屏 `scrollPageIntoView`；反之可选。
7. 控件：字号/行距/字体/逐段开关，写回配置并实时改 CSS 变量。

## 待联调验证点（必须对着运行中的 9.0.6 阅读器确认，不能盲写）
- `_secondaryView` 的实际分屏调用名与就绪时机。
- 副屏是否渲染为同一文档；如何让副屏“只显示译文块、隐藏/弱化原 canvas”。
- 文本层 span→段落的聚合阈值（行距/缩进/字号）。
- 翻页懒加载：`.page` 是按需渲染的，需在页渲染事件后补注入。

---

## Magic 完整功能清单（已通过解混淆字符串表确认，共 8940 条字符串）
解混淆方法：提取 obfuscator.io 的字符串数组 `_0x53ac` + 解码器 `_0x2af3` + 顶部旋转 IIFE，
在隔离 Node 环境还原索引→字符串映射（`/tmp/magic/magic_strings.json`）。仅用于理解功能边界，不复制其代码。

### A. 全文翻译 / 阅读
- 全文翻译、全文对照翻译、全文无对照翻译（`#全文对照翻译`/`#全文无对照翻译`）。
- 输出去向：输出到阅读界面 / 输出为笔记 / 输出为新的 PDF 文件 / 转为网页快照。
- 阅读界面：双屏关联(Shift+Q)、反向对比、显示原文、切换到该视图。
- 排版控件：字体(衬线/非衬线)、字体大小(A+/A-)、行间距。
- 分屏：`toogleSplit`、`splitOrientation`、`splitType`、`splitPixels`、`_primaryView`/`_secondaryView`/`_createView`、`translatedHTMLString`、`getTranslatedView`。
- 快捷键：`fulltextTranslate.shortcut`(Shift+T)、`fulltextTranslate.split.shortcut`(Shift+Q)。
- 缓存：`fulltextTranslateCache-<hash>`。

### B. 引擎 / 翻译后端
- chatgpt(OpenAI 兼容: `getGPTResponseByOpenAI`)、google(`translateByGoogle`)、microsoft(`translateByMicrosoft`)、zoterogpt(`translateByZoteroGPT`)。
- 负载均衡（多 key 轮询）、当前模式无需配置引擎、公式保护(`translateProtectFormula`)。
- 引擎字段：`{api, secretKey, model, maxTokens, temperature}`。

### C. PDF 解析 / 转换
- 解析 PDF、解析为笔记(不翻译)、解析完成。
- 后端：MinerU(本地,`minerU`)、Doc2X(`doc2x`)、pdf2zh(`pdf2zh.*`: enable/path/httpUrl/service/args/titleFormat/useGPT)。
- 批量：Magic 批量翻译、批量 PDF 翻译(pdf2zh)、PDF2zh 批量翻译。
- 解析范围：PDF 文本的第一页/前三页/所有页。

### D. AI 列 / 文献矩阵（AIColumns）
- AI列、管理列、列名称、自定义列、我创建的 AI 列。
- 单元格操作：重新生成此单元格、重新生成所有、彻底删除该列、生成未生成(仅本列)。
- 视图系统：视图组、新视图、切换/删除/重命名视图、保存当前视图、`.AIColumnsView`(fontSize/hiddenCols/items/panel/reviewPrompt/showPreview/showReview)。
- 分享/导入：⭐️ AI Column 分享、⭐️ AI Column 导入(云端预设)。
- 文献操作：添加文献/添加选中文献/添加当前分类所有文献、清空表格、在文库中显示/选择。
- 预览：发送给 AI 的最终内容预览、`note-preview`、review-tab/preview-tab。

### E. 文献综述 / 总结 / 对话
- AI 文献综述、AI 文献矩阵、AI 对比阅读视图、文献总结、文献标题。
- 基于上下文进行对话（RAG 式）、生成提示词、默认提示词、新增提示词。

### F. 笔记 / 导出
- 翻译为笔记、写入笔记、保存笔记、导出为笔记(不同列为不同文献)。
- 导出格式：CSV / Markdown。
- 引用样式：作者年份等。
- 稍后阅读、条目下的所有笔记、条目笔记(展开条目显示)。

### G. 账户 / 商业（**不复刻**）
- 体验剩余 N 天、点击正式购买、邀请用户、分享成功 —— 激活/计费体系，PaperLoom 不实现。

## PaperLoom 复刻优先级（独立实现，不抄代码）
1. [进行中] 阅读器内联译文面板：逐段可见、字号/行距/字体/对照开关、导出笔记。（0.5.0）
2. 真·分屏(阅读界面)：用 Zotero split view 把译文铺进副屏，双屏滚动联动。
3. 引擎扩展：google/microsoft 免费引擎 + OpenAI 兼容多 key 负载均衡。
4. 解析后端：pdf2zh / MinerU 桥接（已有 bridge 雏形）。
5. AI 列视图/视图组/分享导入强化（已有 AI 列基础）。
6. 输出为译文 PDF / 网页快照。
7. 文献综述 / 矩阵 / 基于上下文对话。
