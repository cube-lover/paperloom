# 0.8.13 后续核心重构：对外部方案的独立复核

## 结论

采纳“结构识别与原生文字分工、原生/位图去字分流、保留 DOM 中文”的方向。这是核心能力改造，不是安装 OCR 即完成。不采纳“真正只剩位图擦字待验证”的简化：结构模型质量、PDF.js 同源渲染、坐标/裁剪变换、记录迁移和选择层都要验证。

此文为研究和开发优先级更新，**未安装新版插件、未改变已有译文、未运行 PP-StructureV3/LaMa、未调用翻译 API**。

## 已读取的外部证据

用户给出的两个 HTTP 链接当前返回404；工作区中存在同名完整文件，因此从本地读取：
- `../../paperloom-review/fit-study/项目适配结论.md`
- `../../paperloom-review/fit-study/probe_pdf.py`
- `../../paperloom-review/fit-study/pdf-probe-results.json`
- 对应源码中的 PaddleX PP-StructureV3 配置、表格结果导出、Comic Translate LaMa 与 inpainting base。

外部报告明确写明：PP-StructureV3、LaMa 仅源码筛选，尚未运行模型；不能把能力字段当成当前样本识别正确率。

## 独立复核

脚本：`scripts/verify-native-background.py`。结果：`validation/native-background-proof/report.json`。

使用新装 Zotero CLI 的隔离 Python 环境内已有 PyMuPDF 1.28.2（外部报告使用1.27.1），不安装依赖。输入是外部研究目录的公开75页论文，原文件SHA256始终一致。

### 原生去字

对公开第19页的两处 `Fine-tuned SOTA` 使用文字专用 redaction：
- `fill=False`, `cross_out=False`
- `images=PDF_REDACT_IMAGE_NONE`
- `graphics=PDF_REDACT_LINE_ART_NONE`
- `text=PDF_REDACT_TEXT_REMOVE`

结果：
- 删除目标数2，无目标英文残留；
- 含数字的token序列一致；
- drawing几何、颜色、线宽、虚线和填充样式一致（忽略删除文本后可变的seqno，不只比数量）；
- 嵌入图片字节哈希一致；
- 目标框含2px边缘容差之外像素变化0；
- 灰底+虚线+蓝色曲线+90度文本合成真值测试：全部背景像素完全一致。

这些指标验证 MuPDF→MuPDF 的去字背景，不证明 MuPDF 位图可以无缝贴进 PDF.js 页面。

### 载体分流

第20页图表是一张2513×1153图片，区域中无原生PDF文字。scale=2等效约936×429。应提取原嵌入图与方向/尺度候选，保留可见裁剪/遮罩/变换，而非一律放大或一律信最高分。

### 当前区域模型失败复现

使用已有 `validation/layout-084-594.json`、当前 `layout.js`：
- 页38返回两个局部规则线table，没有完整的宗教文字表cells；
- 页48仅返回规则线table，无6列表头结构；
- 页49只有顶部2-cell上下文表，诗歌两栏仍被worker合并为 `I must have shadows on the way The sun was all we had. Now, in the shade`。

## 与现状的区别及接入原则

### 1. 结构模型提供边界，原生PDF提供字符

PP-StructureV3的region、阅读序、cell框可补当前几何规则。但原生PDF已有字符、精确坐标、字体和数字，应将它们归入模型候选cell，避免整页OCR替代原生内容造成数字/专名回归。

规则路径保留为快速路径和交叉检查；模型仅在歧义、覆盖缺口或用户重识别时启用。两栏诗歌需要栏→诗篇→节/行结构，不是仅把整页标成table或image。表格HTML与cell_box_list须明确匹配，非默认同序。

### 2. 原生去字不再依赖白背景

优先实现副本/内存页去字。首选验证去字后单页PDF交给相同PDF.js离屏渲染背景，以减少MuPDF与PDF.js抗锯齿、缩放、颜色的差异。若直接使用MuPDF patch，先比较边界像素/颜色/比例；不能继承本次MuPDF自比较的“框外0差异”作为宿主验收。

删除框基于精确源glyph/quad，而不是扩大后的译文排版框。必须核验邻近数字、混合原生/位图、CropBox、90/180/270页面旋转、文字方向、裁剪和注释。

### 3. 位图背景修复按需且可撤销

LaMa负责image+mask→修复像素，不负责中文排字。掩膜外最终强制取回原像素；曲线穿字区域另验线段连续性、颜色/宽度和刻度，未知原始线形不能靠生成模型输出认定科学真值。

不是每个蓝线都走LaMa：还有识别待审、方向、警告、邻框相交、译文放不下等原因。应输出可统计的reasonCode与下一步任务，而非在paint-time吞掉异常。`graphic-ink.js`只作为已证实简单背景快速路径。

### 4. 更新状态机与缓存

现有 `recognizeGraphicRegion` 的旧记录证据更新依赖：文字相同、quad差值<0.5、row.autoValidated、方向确认；autoValidated又依赖白底。文字已有target时多数新OCR建议仅存suggestion。因此新版并不自然解决旧fallback。

至少拆分：
- semantic identity + source text version；
- translation + manual revisions；
- structure/geometry evidence + engine versions；
- background artifact + input checksum；
- render status + precise fallback reason。

同语义新定位可以保留译文并重做背景/排版；真正跨栏跨格的错源保留归档，重新建立语义单元，不强行拆旧中文。失败任务允许按原因重试，模型升级失效的是定位证据而不是人工译文。

## 实施顺序

1. 锁定样本页18/19/20/38/48/49/56/57、最新数据归档、逐字段覆盖基线。
2. 结构化交换契约（PDF单位、矩阵、source type、区域/单元格所有权、证据、模型版本）。
3. 原生去字worker与PDF.js同源背景显示的宿主最小闭环；中文仍DOM；不同缩放/旋转验收。
4. PP-StructureV3候选对照：以上问题页及既有多栏/稠密表/文本例表；先证明比现有模型改善，再启用迁移。
5. 原图多尺度OCR与LaMa/非生成修复对照；先跑科学图真值样本再接入实际图。冷/热耗时分开。
6. 将旧记录迁移、逐字段翻译完整性、选择/高亮、取消/重启统一验收。

图表和正文的新框都服从同一空间所有权。完成翻译不等于完成识别，也不等于显示完整；三个统计单独报告。

## 分发及依赖

PyMuPDF为AGPL/商业许可；独立worker不自动消除分发义务。公开打包前明确整体组合、许可证说明和可再分发依赖；现阶段未把依赖塞进MIT XPI。PaddleOCR/PaddleX和Comic Translate代码、具体模型权重分别核验。不要默认启用公式重写、chart-to-table或文档展平。
