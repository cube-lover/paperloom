# Magic 2.6.3 原位翻译调用链复核与 PaperLoom 重做依据

## 结论

0.6.1 的核心缺陷不是几个间距阈值，而是没有独立的文档版面模型：它从已经渲染的 DOM 推断段落，把显示状态当成文档结构，再以缩字号和块内滚动补救。这个基础不足以达到用户要求的阅读效果。

本轮先研究、取证，**没有继续修改 addon 源码，也没有生成新的安装包**。77 个单元测试只能证明旧实现的部分行为没有回归，不代表排版或译文合格。

## 1. 样本与方法

读取本机安装的 `zoteromagic@zoterocn.com.xpi`，版本 2.6.3。只读分析，未执行 Magic bundle、未触发其商业服务、未修改原插件。

- XPI SHA256：`3994504ca1f10bd73f37c21f7652a96c8d0703202c16bc928557180030bb69e2`
- 入口脚本：`chrome/content/scripts/zoteromagic.js`，3,483,364 bytes。
- 脚本 SHA256：`bd6af077ea928f8a60961d13ec64385dbf84b835897778efce3337df0c1ef52c`
- 沿用的字符串表已与旧提取包进行字节一致性核对。
- AST 静态展开 36,481 个字符串调用，保留业务控制流；可读文件 72,069 行。不是原作者源码，不宣称完整恢复全部符号。
- 本地分析副本、依赖与原始材料全部在 `.local/magic-analysis/`，不进入 addon 或 XPI。技术报告只记机制与接口，不搬运业务代码。
- 本轮未读取用户配置凭据或 login-manager，未迁移 key。

### 可复查定位

以下行号均对应 `.local/magic-analysis/magic.readable.js`。

| 对象 | 可读副本行号 | 原始脚本 JS 字符位置（start/end） |
|---|---:|---:|
| PDFParser 类 `_0x18ee33` | 31844–32514 附近 | 1386364–1418278 |
| 原位翻译控制类 `_0x3b01f4` | 68010–71190 附近 | 3149183–3297648 |
| `toogleTranslate` | 68202–68252 | 位于控制类内 |
| `toogleSplit` | 68253–68281 | 位于控制类内 |
| `fulltextTranslatePDF` | 68958–68991 | 位于控制类内 |
| `renderToPage` | 69217–69387 | 位于控制类内 |
| `getTranslatedView` | 70926–70935 | 位于控制类内 |
| 定位页面 helper `_0x27a5f6` | 71228–71235 | 3299791–3300125 |

## 2. 真正的 PDF 原位翻译链路

```text
阅读器翻译按钮
  └─ toogleTranslate(reader)
      ├─ 按 outputType 分流：笔记 / 新 PDF / Magic Markdown / PDF 原位
      └─ PDF 原位分支
          ├─ updateStyle：字体、字号因子、行高因子
          ├─ getTranslatedView：取得指定主/次视图，必要时分屏
          ├─ 每阅读器状态与文献翻译缓存
          ├─ fulltextTranslatePDF
          │   ├─ 按页批次调用 PDFParser.process
          │   ├─ PDFParser.parse：完整 PDF 字符数据 → 行 → 类型化段落
          │   └─ 对当前可挂载的 PDF 页调用 renderToPage
          └─ updateviewarea 事件防抖后再次渲染可见区域
```

### 解析层，而非 textLayer 抓取

PDFParser 读取附件字节，导入 Zotero 自带的 `pdf.mjs` 和 worker；以 `GetPageData` 获得 `viewBox`、结构化 chars。

字符数据带：
- `c/u`、`rect/inlineRect`、`fontSize/fontName`、`bold/italic`；
- `spaceAfter`、`lineBreakAfter`、`paragraphBreakAfter`；
- `rotation`、`baseline`、`ignorable` 等。

Magic 按字符换行标记构造行，利用字体统计值，而不是 span 的屏幕包围框高度。之后继续处理：
1. 读取绘图算子，尝试识别表格横线区域并排除内部文本。
2. 保留解析器字符顺序，对行分配栏位及栏边界。
3. 多页比较外围相似文本与位置，标注页眉/页脚。
4. 读取 PDF outline，结合标题匹配和字体/文本特征识别标题层级。
5. 综合首行缩进、悬挂缩进、字号变化、局部行距异常、栏切换、纵向位置回跳、短尾行等决定段落边界。
6. 类型化为 title/body/figure-table/formula/small-width；原位翻译主要接收 title/body。
7. 参考文献识别结合文档后部位置，但实现也有局限，不应直接照搬。

注意：底层提供段落标记不等于最终段落已经正确。首页摘要可能与版权行一起返回，跨栏段落也需要拆成视觉片段而保留语言连续性。

## 3. 渲染、排版与阅读交互

### 坐标与字号

`renderToPage` 接收归一化矩形，输出百分比 left/top/width/height，并加小范围覆盖余量。字号来自 PDF 字体统计，再乘阅读器缩放因子和用户字号因子。

我们重新实现时采用的契约：

```text
PDF 坐标 [x0,y0,x1,y1] + 页框 [vx0,vy0,vx1,vy1]
  → 规范化矩形 / 或 PageViewport 转换
  → 当前视图的覆盖层
```

无旋转时通用关系：
- left = (x0 - vx0) / (vx1 - vx0)
- top = (vy1 - y1) / (vy1 - vy0)
- width = (x1 - x0) / (vx1 - vx0)
- height = (y1 - y0) / (vy1 - vy0)

旋转不能只套上述无旋转公式，应用宿主 PageViewport 投影。字号单位要与实测 scale 匹配，尤其 Zotero 9 的 `--total-scale-factor` 和旧的 `--scale-factor`，避免把 PDF point 与屏幕 CSS px 混为一谈。

### 不是“缩到能塞下就算成功”

读到的 Magic 实现包含：
- 标题粗体、首行缩进、两端对齐；
- 从 PDF 的背景样式/滤镜取得覆盖底色；
- 红色虚线占位，结果写入后移除边框；
- 段落内部按 sentence 组织，可选择逐句翻译；
- 点击复制、原/译文句子高亮、临时透出原文；
- 双屏关联使用 `updateviewarea.location` 的页码、left、top、scale，不是只对齐页号。

本次检查的 `renderToPage` 没有 PaperLoom 那种反复缩字号直至容纳全文的循环，也没有给每段加滚动条。它使用固定区域和全局字号因子，并以结果面积/语言比例启发式隐藏异常覆盖块。这些异常判断本身也不完备，但说明“译文挤满小框就交付”不符合参考交互。

### 页面生命周期

原位层以页面索引 + 规范化位置识别；页面 helper 从 Zotero 视图 `_pages` 中找到 `originalPage.div`。页面重建后根据状态重新挂载，翻译缓存避免重复费用。

Magic 同时使用 `updateviewarea` 和逐块定时检查；后者带来性能/清理风险。PaperLoom 应保持自己的统一调度与取消机制，不复制一段一个 interval 的结构。

## 4. 两条容易混淆的路径

### `translateProtectFormula` 不是 PDF 原位保护器

该方法在 66863 行附近，属于另一套 Markdown/块内容阅读流程，处理 `$...$` 文本。PDF 原位主链路在 68958 行之后，主要靠解析器分类排除公式/图表。

上一份概览把搜到的同名机制并列，缺少调用者验证；本轮以调用关系纠正。不能据此声称 PDF 原位已具备完整公式语义保护。

### 笔记/新 PDF/Markdown 不等于原位阅读

GROBID、MinerU、Doc2X 和 pdf2zh 出现在不同输出路径。用户要的 PDF 右屏覆盖，有本地 PDFParser 路径，并非一定依赖这些云解析或生成新 PDF。

## 5. Zotero 9.0.6 实测：结构接口已经可用

没有启动或修改用户 Zotero，未运行 Magic。只从本机 omni.ja 提取 Zotero 自带 PDF.js，在 Node 中以原始测试 PDF 执行解析。没有加载远端 URL。

`pdf.mjs:12842` 已暴露 `pdfDocument.getPageData({pageIndex})`，其内部才调用 GetPageData。自研实现应优先用该方法，而非手伸到 `_transport.messageHandler`。

宿主 reader.js 自己也使用同一接口：68356–68408 行附近。worker 在 58550 行返回 `{partial, chars, overlays, viewBox}`。

| 测试论文页 | chars | 行末标记 | 段末标记 | ignorable |
|---|---:|---:|---:|---:|
| 1 | 4134 | 76 | 23 | 5 |
| 2 | 6352 | 128 | 25 | 15 |
| 3 | 5615 | 132 | 34 | 12 |

三个页框均为 `[0,0,595.276,793.701]`。结构中真实存在字体、粗斜体、旋转、基线和忽略字符标记。

直接读出的标题为：`Methodology and applications of city level CO2 emission accounts in China`；CO2 的字间关系不需要靠 DOM 字号差猜测。断行连字符被标成 ignorable，清理时要保留词的连续性，不能在忽略该字符后仍添加行间空格。

底层字符段落也不应直接全拿来翻译，例如首页版权行、作者单位、期刊页眉仍须分类。新模型需要保留全部块及排除原因，不能一过滤就丢失诊断信息。

## 6. 实测发现：Magic 表格算子分支与当前 PDF.js 不一致

Magic 表格解析分支把 `constructPath.args[0]` 当作操作数组，把 `args[1]` 当作扁平坐标数组。

本机 Zotero 9.0.6 实际样本却为：

```text
constructPath args = [绘制操作数值, [Float32Array(编码路径)], Float32Array(边界框)]
```

首页 23 个 constructPath，第三页 10 个；当前数据中没有独立 rectangle 操作。旧分支访问数值的 length 不会遍历任何路径，存在静默失效的明确条件。

因此，“仔细读源码”不等于照搬：新的图表排除必须按**本机实测算子协议**重写，并结合图片操作和矩形覆盖。该项的端到端 Magic UI 效果本轮未测试；这里结论限定于静态分支与实际返回协议的差异。

## 7. 与 0.6.1 的具体差距

| 环节 | Magic 本次读到的机制 | PaperLoom 0.6.1 | 下一步 |
|---|---|---|---|
| 文本来源 | PDF 原始结构化字符 | 屏幕 textLayer span | 改为宿主 getPageData |
| 文档模型 | 字符→行→类型化段落→章节 | 单页几何块 | 新建独立 layout 模块 |
| 读序/续段 | 栏顺序、补偿与层级 | 几何递归排序 | 保留字符读序、关联跨栏/跨页片段 |
| 图表保护 | 算子区域 + 类型过滤 | 单词数量粗筛 | 当前算子协议 + 几何保护区 |
| 标题 | outline + 字号/文本分类 | 编号正则 | 元数据/outline/字体多证据 |
| 页眉页脚 | 多页复现检测 | 没有文档级检测 | 跨页模板检测 |
| 坐标 | 页面归一化 + PDF 字号 | 渲染后的 CSS 矩形 | PDF 规范坐标为主键 |
| 字体排版 | 标题粗体、缩进、对齐、全局因子 | 统一字体+缩字+块内滚动 | 语义样式 + 实际译文长度验收 |
| 句子对照 | 句子级源/译映射与高亮 | 仅整个覆盖块 | 单独 sentence model |
| 视口关联 | 页+XY+scale | 未完成 | 防回环的双向位置同步 |
| 验收 | 本轮只完成代码分析 | 旧假译文通过被过度解释 | 人工核对真实段落与真实中文排版 |

## 8. 重做顺序与验收门槛

1. **独立解析层**：建立 PDF 坐标、字符范围、行范围、块类型、排除原因；首先在测试论文固定 1/2/3 页输出诊断，而不是先连 API。
2. **保护区域**：表格、图片、公式、页眉页脚必须有可视化证据；分类不确定的块保留原文。
3. **渲染层**：规范坐标投影、语义字体、非滚动条式正文；使用人工核对的中文段落测试，不再重复“排版测试”句子模拟真实长度。
4. **生命周期**：模型不依赖 DOM；视图仅挂载/卸载覆盖层。缩放与换页不重分段、不重发翻译。
5. **交互**：双屏坐标关联、原文临时显隐、句子选中对照。
6. **翻译接入**：用现有独立 provider、保护标记、缓存、限流；按此前约定处理指定 key，不读取其它凭据。
7. **交付门槛**：同一篇论文的标题、摘要、双栏正文、含表格页、含公式页，逐页检查中文可读性与图表完整性，再发安装包。

核心 schema（独立设计，不是原产品对象复制）：

```text
DocumentLayout { fingerprint, pages, outline, readingOrder }
PageLayout { index, viewBox, rotation, lines, blocks, protectedRegions }
LayoutBlock { id, role, sourceRange, text, fragments, typography, evidence }
TranslationRecord { blockID, configDigest, sourceText, translatedText, sentences, status }
ViewProjection { pageIndex, viewport, mountedBlockIDs }
```

## 9. 复查材料

`.local/magic-analysis/`：
- input.json / evidence-ranges.json：样本指纹与原始位置。
- analyze.cjs / magic.readable.js：静态展开脚本与分析副本。
- probe-zotero.mjs：执行 Zotero PDF.js 的无网络取证入口。
- page-data-summary.json：页结构计数。
- operator-summary.json：真实绘图算子形状。
- zotero-page-data.json / zotero-outline.json：测试论文原始结构。
- zotero/：本机 omni.ja 提取副本，仅供研究。

运行 probe 前先检查源版本；本轮没有把这些宿主/vendor 实现打进 PaperLoom。报告是重做依据，不是“已完成重做”声明。
