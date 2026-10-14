# 分段、目录误译与图注漏译复核

## 本次复现

用户指出 Figure 1.1/1.2 图注未翻译，随后指出目录被翻译、段落切分不合理。本轮不再用“未溢出”作为分段正确的依据。

取得与截图对应的公开论文 `Language Models are Few-Shot Learners`（arXiv:2005.14165），用本机 Zotero PDF.js 提取前6页原始字符和几何，保存 `tests/layout-gpt3.fixture.json`。未读取用户凭据或调用模型；这份下载样本用于离线回归，不是用户宿主文档状态。

0.7.3 规则的实际结果：

- PDF第2页 Contents 和32个目录条目被聚成多个 body 块，全部进入翻译范围。
- 第3页 Figure 1.1 为6行完整图注，第4页 Figure 1.2 为5行完整图注；都已被识别为 caption，但 `eligible` 把整类caption排除了。
- 第5页正文 `Figure 1.2 illustrates ...` 被错判caption：旧正则只消费 `1`，将编号中的 `.2` 当成标点与说明。
- 因此问题至少有三层：区域分类缺失、编号语法错误、翻译策略错误；单改字号解决不了。

## 实际参考的实现

### Magic 2.6.3（本地只读分析副本）

`.local/magic-analysis/magic.readable.js:32230–32469`：

- 综合同栏上下行、首行/悬挂缩进、字体集合、局部行距、短尾行和纵向回跳决定段界。
- 类型化后才筛选title/body，并保留分段reason。
- 其 `figure/table` 是按块宽、位置等判断的类别，并非“凡以Figure开头的说明段都跳过”。
- 有跨栏语义补偿，但会修改行文字；本项目不照搬这一做法。
- 本轮读到的这段没有足以作为我们目录排除规则的实现依据，不宣称它已解决所有目录情况。

### PDFMathTranslate / pdf2zh（公开main分支，只读下载）

源文件：
- https://github.com/Byaidu/PDFMathTranslate/blob/main/pdf2zh/high_level.py （182–225行）
- https://github.com/Byaidu/PDFMathTranslate/blob/main/pdf2zh/converter.py （175–322行）

主要机制：

1. 标准路径先做页面版面区域检测，为字符分配区域编号，而非把PDF行末直接当段末。
2. `high_level.py` 的保留区域包括 `abandon / figure / table / isolate_formula / formula_caption`。这里的 formula_caption 与普通图注不是同一类；figure/table区域本体和周围解释文字分开处理。
3. `converter.py` 依区域编号聚合字符，另存公式组及占位，不把角标符号一律变成独立正文段。
4. 对纯公式与行内公式分别处理，保护范围和可翻译文字范围分离。

本轮没有运行其模型，没有引入其代码、依赖或商业后端到插件；源码只存在 `.local/segmentation-review/`，文件哈希见 `source-manifest.json`。对照的是设计机制，不是性能/正确率的实测比较。

## 本项目实现调整

### 目录在聚段前识别

- 引入 `contents` 行/块类别，独立于heading。
- 联合目录标题、至少3个对齐页码条目、点引导线/编号判断，不用单独一个Contents关键词跳过整页。
- 支持本次真实英文目录、中文目录、罗马页码、无标题的点引导线续页。
- 目录行单独保留sourceRange，不聚成正文；不进入翻译队列、不生成红色占位。
- 目录里的References/Appendix条目不触发正文参考文献区间。
- 后续正文里的同名标题继续翻译；outline匹配不覆盖contents/table/image等保护类别。
- 这是有明确证据的规则识别；没有点引导线且页码被拆为完全独立乱序文本的复杂目录仍需独立样本。

### 图注翻译，与图形保护分离

- caption进入翻译范围；图形、表格单元格、公式等仍保留。
- 图号完整消费多级编号，如 `Figure 1.2:`；`Figure 1.2 illustrates ...` 保持正文身份。
- 独立新图号强制新块；已确认图注续行不因worker伪段末被截断。
- 不跨图表、不跨栏合成大矩形；既有邻块/图形边界约束继续生效。

## 验收证据与范围

- `tests/layout-toc-caption.test.cjs`：真实GPT-3目录/图注、正文引用负例、中文/罗马页码/续页、独立图注、正文Contents负例。
- `tests/readerview.test.cjs` 新增完整队列回归：仅挂载真实目录页时翻译回调0次、覆盖0个；挂载第3页后Figure 1.1只调用一次且包含完整6行文本。
- 已改掉早期把“caption一概不翻译”作为成功标准的两项测试。
- `toc-caption-structure.json`：4组真实结构fixture，共22个页样本，受测覆盖框对邻块墨迹/保护图形相交均为0。
- `caption-preview.json`、`caption-preview-page-2/3/4.png`：真实PDF底图+当前覆盖代码的Chromium离线预览。目录覆盖0；两段人工中文图注在原字号10px下完整显示、无overflow。逐图查看图形与上下正文未被盖住。
- **128 JS + 7 Python**通过，静态检查通过；日志 `.local/segmentation-review/tests.log`。

以上为研究阶段的源码与离线回归结论。后续发布状态如下。

## 0.7.4 安装补记（2026-10-12）

- 已通过AddonManager安装0.7.4，运行根为用户profile中的XPI；源码/构建/安装包一致，129 JS+7 Python通过。
- 安装版在Zotero宿主内重跑上述fixture：目录可翻译块0，Figure 1.1/1.2仍各6行/5行。该检查验证安装版分类，不是新译文视觉验收。
- 活跃item594会话重新解析后：目录入队0，caption入队87；37段既有译文全部归档，29段按完整原文匹配恢复，8段目录译文仅归档。当前保持暂停且没有运行中的请求。
- 未主动请求provider，未读取凭据。0.7.4进程重启及最终界面截图尚未完成，详细发布证据见 `../validation/RELEASE-074.md`。
