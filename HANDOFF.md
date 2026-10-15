> 最新（2026-10-15）：**0.9.5 已安装，Ctrl+R；清除后不再复用旧翻译缓存**。285 JS+25 Python通过，宿主隔离清除/缓存自检通过；110正文/313图表保全，paused=true、requests=0。见 `validation/REVIEW-094.md`、`validation/INSTALL-095.md`。下方旧状态保留作历史。

> 最新（2026-10-15）：**0.9.3 已安装，默认框选 Ctrl+R**。系统按键开启与 Esc 取消已验证；110正文/301图表记录完整保留，paused=true、requests=0。重复开启仍待稳定焦点下验收。见 `validation/INSTALL-093.md`。

> 安装更新（2026-10-15）：**0.9.1 已安装运行，开发通道已恢复**。本地宿主自检通过；110段正文与281图表记录逐项保全、其他插件hash不变、requests=0、暂停。最新见 `validation/INSTALL-091.md`，真实键鼠/复杂视觉仍待验收。

> 最新接续（2026-10-15）：**0.9.1 开发修复包已构建，尚未安装**。快捷键、清除菜单、框选队列与历史持久化回归通过，268 JS + 25 Python。当前宿主验证暂停，最新详见 `validation/DEVELOPMENT-091.md`；下方均为历史状态。

> 当前执行状态（2026-10-14）：宿主 **0.8.35-dev**；最新以 `validation/DEVELOPMENT-0835.md` 为准。第8页表格/表题已显示中文，公式操作符保护已实测；第12页新修复已安装但阅读器隐藏，待最终截图。正文491+248无溢出、保全missing0，合成copy/联动审计尚未通过。以下为历史记录。

# 当前交接：0.8.14 开发构建，未安装

- 当前正式安装仍为0.8.13；此前239/478等旧状态仅历史，不得拿来恢复。最近完整正文基线478/478；本轮没有读取并改变活跃译文。
- 新增原生去字worker、同源PDF.js局部背景、独立几何证据更新、开发包自动启动CLI通道。未用桌面输入。
- 普通/开发包分别构建，正式包无dev模块；开发包首次由Zotero加载即可启动，不需要RunJS注入。宿主实机尚未验收。
- 210 JS+20 Python通过；离线PDF.js最终局部合成框外0差异，原始53差异失败记录保留。
- 详细：validation/DEVELOPMENT-0814.md；问题总表：ISSUES-CONSOLIDATED.md。PP-StructureV3/LaMa/双栏小表新结构仍待做。

---

## 以下为历史交接（不作为最新运行状态）

# 当前交接：0.8.5 通用区域修复（2026-10-13）

- 正式安装0.8.5，SHA256 932c061648b5072c73e123a71e877b2d1c386bd6ccab0811103bb89d3db7ff6b；update-084/085均passed。详细：validation/RELEASE-085.md。
- L.regionModel统一区域，structured-pdf-5；防止局部规则线丢弃完整表、正文跨单元格合并。新增绘制门禁、文字例表单答案、方向验证、题目拼写保护、图注译文复用。
- 187 JS + 15 Python通过；页14/15/56实际视觉截图与页14/15/56/57/47本地识别通过其检查。**并非全篇译文完成**。
- 当前item594正文239/478 done、239 pending、paused=true；1837图表行，823目标包含718原目标+105旧版错分区域归档；19个图注跨链路精确复用，不重复调用provider。
- 105旧版错分中文没有可靠单元格对齐，不按比例切中文，完整留在图表校订按页面板，legacyLayout不绘制、不翻译。
- 本轮所有检查零provider；reading position恢复页14。完整归档路径在update-084/085 report，禁止恢复旧325/447/104快照覆盖当前。
- **待修复图标**：finish-085.json passed=false，img jar URL complete=false/naturalWidth=0；其余名称106×24、hidden面板、job暂停无timer、左0覆盖正确。可检查app.js 127行、阅读器CSP/权限；不要改Zotero本体。
- 新文字表单元格已识别，多数尚无新译文，页56仍保留原文；step可译，sticks/volkswagen题目答案保持拼写；页15下图部分低置信度热点仍在。
- 用户强调修复通用排版，不只当前图；TASKS.md仍保留全部旧待办。未主动恢复翻译。

---

# PaperLoom 译研 —— 完整操作说明 / 交接文档（供其它 AI 接手）

## 当前优先：0.8.3 Cube Translation 已安装，用户追加漏译任务

- 用户最新只要求把截图 G.20–G.23 的短标签/单行答案漏译登记任务；已写入 TASKS.md，尚未修复，勿误报完成。关注 Answer / Target Completion / step / sticks；Anagrams原始字母、数字4、姓名应保护，不盲译。
- 正式0.8.3名称 Cube Translation · Cube 翻译，多尺寸图标来自本轮用户第二张图片，原始保存 assets/cube-user-original.png。内部paperloom ID/prefs/dir/realm不改。
- 静默图表 + 全文后台调度 + 当前页优先 + 共用并发/RPM + 图表重复标签去重 + 会话识别cache已实现。原位会话暂停恢复启动同一图表任务。独立文本工作台导出不是新的版面图表输出链。
- 179 JS+14 Python通过，.local/release-083-tests.log。QA cube-083-host-qa.json仅本地：第53页1285ms、第54页924ms、第47页9601ms；同会话重入47页1ms；阅读页56未改变，面板全隐藏，正文140不变。非provider性能基准。
- update-083.json passed，包285506 bytes SHA256 adccfb1102bba50ad6601305b537996d095d10efe56a0444703e71e03bed25d2。安装归档pre-083-install-1791877624228.json，用户recovery备份及旧XPI在报告。preflight141段但最终归档/恢复143段（用户期间继续），最新状态优先；正式图表目标需重读，初始prepare时82行/75已译。
- 读取最新会话再行动。最后安装后143/557 paused，0排除、preserved=true。旧447/104/140均不是可回滚的新状态。
- scripts/finish-083.js已写未执行；最终名称/icon naturalWidth/按钮24px/graphJob暂停无timer待核验。用户追加时没有再操作桌面。


## 当前优先：0.8.2 已安装（2026-10-13）

- 修复用户报告的图表面板收不回：固定头部“收起 ×”、仅body滚动、Esc/点外部关闭；默认当前页记录，旧第47页不再混入第53页。
- 新 ruled-label-value-rows 检测，第53页6个文字型示例表；原生caption补漏找回 G.10/G.11/G.12。正文已占用区域跳过，保留既有目标。
- 正式包 recognition-only 实测新增47条待译记录（44单元格+3图注），全部定位门禁通过；尚未调用翻译服务，因此别说47条已经翻译。下一次用户点“图表自动译”会按正式配置补译。
- 172 JS+14 Python通过，版本包/hash安装一致，见 validation/RELEASE-082.md 和 update-082.json。真实滚动后关闭按钮可见且鼠标收起成功；Esc实测通过。
- **当前104/557正文，paused=true**。本次开发期间447→104、paused=false，原因尚未查明（在安装前发生）；立即暂停并归档104段，本次安装104条全数保留，0排除。旧447归档仍保留，不自动回滚覆盖当前10条不同/新增译文。任何恢复应先检查最新会话并按原文/页码合并，必须保留冲突版本并经用户确认。
- 原有正文overflow与分段错误没有在本版全面修复，不要宣称全页零漏译/排版完全通过。


> 目标读者：接手继续开发的 AI 或工程师。
> 本文档自包含，读完即可继续工作，无需追问历史对话。
> 全部用中文沟通；代码注释中英皆可。

## 最新状态：0.8.1已正式安装，自动图表入口及双向选择已在宿主通过

以 **`validation/RELEASE-081.md`** 为当前事实，它优先于下方历史。

- 正式0.8.1，jar来源、安装hash与dist一致；工具栏新增“图表自动译”，手动框选收进高级补漏。自动检测当前页图像+数值表，不要求用户画框。
- 新`selection.js`使右侧中文原生左键拖选及Ctrl+C生效；同步开时双向临时高亮，术语/字面量精确词、正常等句数按句映射，复杂情况整段。普通双击选词，Alt+双击校订。别承诺任意词语语义精确对齐。
- 安装后真实鼠标左右拖选、中文Ctrl+C通过，`installed-081-selection-*-evidence.json`；手动拖框也实测通过`manual-drag-host.json`。
- **168 JS+14 Python通过**。自动第47页识别1表+1图；正式产生10条图内译文，其中6表头+90°轴replace，3个标签热点。左侧中文覆盖0，原数值/图形保留。
- **最新447/557正文已完成、paused=true、running=0**，447条升级全部恢复，0未匹配。最新恢复归档`validation/pre-081-install-1791838953214.json`和用户paperloom/recovery副本；别恢复旧453/439/420/231快照。
- 最后真实自动按钮测试的recognition-only arming未生效，正式流程达到了翻译阶段，不能写“全程零provider”。没读取凭据、最终requests0；详情见RELEASE-081。之前独立自动OCR/选择/安装QA是零provider。
- 小字自动OCR仍有`control(1o5seconds)`和缺空格回归，门禁未让它盖字；不能拿旧手工裁剪成功冒充自动识别成功。后续修复要保留已存源/译文历史。
- 0.8.1进程重启、全文视觉/复杂扫描表未验收。最后主窗handle1313696/PID2564、RunJS4459192；每次输入重新查窗口。

## 历史状态：左侧覆盖和密集表格误识别已修正；正式仍0.7.5（新版未发布）

- 最新问题：用户指出左侧也有译文、表格翻译失败/乱序。已清除primary图表覆盖，所有绘制/定位限secondary；左侧保持原文。详见 **`validation/DENSE-TABLE-REPAIR.md`**；旋转轴和OCR部署见`validation/GRAPHICS-DEVELOPMENT.md`。
- 第46页两线表旧版漏识别，17行数据误合正文。新`layout.js`用重复数字列恢复表结构并排除正文覆盖；独立图表流程按列合并表头，仅翻译表头，数字、模型名和指标缩写保留。
- 最新 **158 JS+14 Python通过**，包含左0/右正常/人工校订持久化、两线表、数据保护、原生字形subpixel背景门禁。第45/46页真实宿主原生结构+本地OCR识别12/9个表头，19处人工中文表头全replace；provider未调用。
- 现场修复归档并保护12条错误表格正文记录，没有删除译文。`table-live-repair.json`及`table-headers-host.json`通过；正式正文item594 **420/571**、paused=false、running=0、requests=0前后不变。安装前仍须重新归档最新会话。
- `table-visual-verification.json`是DOM几何证据：左0、表头之间及表头与数据相交0。其drawWindow文件是黑图，不是有效视觉截图。Windows截图已查看第45页左英文/右中文表头；第46页最终人工视觉尚待完成。
- 当前 `_graphicsQA` 是独立开发实例，19个中文表头与旧第47页图标注均为手工测试译文，不是provider输出。源码已变但未构建/安装新包，现场guard不跨进程持久。OCR运行库与模型在workspace `.local`，正式pref未配置。
- 历史`graphics-rotation-host.json`左右8框不符合最终交互要求，不再作为通过标准。新标准固定左原文、右译文。不要重跑旧QA覆盖当前人工记录。

## 0.7.5已安装；图片/图表功能启动时的记录

- 用户确认“点击跟翻译问题解决了”，最新要求解决图片/图表翻译。
- 0.7.5正式安装，单击根因为toolbar的窗口拖动区域缺少no-drag；已修复并看到真实鼠标trusted事件。可见段落优先队列、翻页重排、左右pane取当前阅读位置已实现。139 JS+7 Python通过。
- 更新时item594已完成231段，全部归档并恢复，0未匹配；当时暂停，后续用户继续并新增译文，禁止用231段旧归档覆盖当前状态。`validation/update-075.json`为安装证据。
- 新功能独立开关及独立识别/渲染，不改正文分段；不主动发provider请求进行QA。不读取或输出凭据。用户原PDF与既有译文保留。

## 历史状态：0.7.4 已正式安装并恢复暂停会话（2026-10-12，优先于下方历史）

目录/图注/分段修正已发布到用户 Zotero 9.0.6。完整证据见 `validation/RELEASE-074.md`，规则依据见 `research/SEGMENTATION-TOC-CAPTION-REVIEW.md`。

- **已安装且运行0.7.4**：通过 AddonManager 更新，运行根为 profile 中 XPI 的 `jar:` URI；不是 workspace dev 热加载。Zotero PID2564未变，0.7.4尚未做进程重启验收。其余8个插件的版本与启用状态不变。
- 源码、构建包、安装包一致；`dist/paperloom-0.7.4.xpi` 70,601 bytes，SHA256 `516f05aefb5dd7b3ad6560d7c0da0865351c586df80e1c5796caa983a27cfeeb`。check、129 JS+7 Python通过。
- `scripts/update-074.js` 先暂停/等待在途工作结束，再归档并安装；`translateInPlace(reader,{restoredRecords,startPaused:true})` 按规范化完整原文恢复已完成译文和人工校订，不发送新翻译请求。
- 更新时活跃原位会话为 **item594，75页，内容为GPT-3论文**，不要根据主窗口标题认作文献。37段已完成译文全部归档；29段精确匹配恢复；8段为目录标题/条目，按新策略退出翻译与覆盖，译文仍保存在归档。
- 更新后会话：29/571完成、542 pending、0 running/error、paused=true、hidden=false；工具栏入口1个、目录入队0、caption入队87。overflow=0仅为当时已挂载块统计，非全75页视觉验收。
- 安装版在宿主解析GPT-3真实fixture：目录可翻译块0；Figure 1.1/1.2图注分别完整6行/5行。此前22页离线几何及人工中文图注预览通过；新增图注尚未调用provider翻译。
- 本轮未读取凭据、未主动调用provider，归档/安装未改原PDF、文库与服务配置。最终主窗口焦点未通过核验，停止了桌面输入，未完成0.7.4最终截图/重启验收。
- 下步先核实当前会话，保留暂停及既有译文；用户点击“继续”才运行后续翻译。若需重启，先保存当前最新会话，别直接运行会清除/替换会话的旧QA脚本；不要再次运行 `update-074.js` 覆盖已安装后的证据。Magic全功能等效仍未完成。

## 历史状态（2026-10-11，0.7.2阶段）

见 `validation/layout-source-audit/STATUS-20261011.md`。**0.7.2已正式安装、正常重启，源码/构建包/安装包一致**。两篇12个指定页共103个既有译文块的宿主回放无overflow、无邻块墨迹相交；8项同步/旋转/左屏原文/API显隐检查通过，两篇各1个工具栏按钮。最新119 JS+7 Python通过；本轮未读凭据、未调用provider。固定段落锚定的留白、标题断行和跨栏语言片段仍需改进，尚未完成全部功能验收。原生按钮双向点击证据尚未闭环：新 `qa-native-button.js` 已修正采样但未运行；最后Windows拒绝聚焦执行JS窗口，已停止桌面输入。item474的99/99既有译文及归档保留，最后按钮显示“显示译文”，覆盖可能隐藏。继续前刷新窗口状态，不再引用下方历史版本状态为当前事实。

## 历史状态：第二轮排版源码审计，仍未交付视觉合格版

用户再次指出文章排版不对，要求仔细研究别人插件源码。最新依据：`research/LAYOUT-SOURCE-AUDIT-2.md`；它优先于下文历史记录。

- 源码已从 DOM 分组重写为 `layout.js` + `inplace.js`，按钮响应修复也已在源码；不要继续按旧 DOM 阈值方案改。
- 本轮真实论文定位并修正：第 8 页 `65.67 Mt iron...` 误标题导致一段拆三块；第 7 页 caption-only 页面误当正文；第 4 页表头横线内缩导致漏表。补充了首行缩进、短尾、局部行距的分段辅助及负例。
- 去掉原位文本 `min-height:100%`；旧 scrollHeight=框高并不证明内容正确。新自然文字/Range 测量如实发现首页三个单行块仍待排版，不能以隐藏译文宣称完成。
- 最新 check、105 JS + 7 Python 通过；真实模型与本轮宿主视觉均未验收。
- **只读核实：用户 profile 中已安装 XPI 是 0.6.1，里面无 layout.js/inplace.js，仍是旧实现。** 之前 dev 热加载不持久。当前 Zotero PID 已变，不假定在运行 dev。
- **宿主图形问题未解决**：既有日志 `page.getOperatorList is not a function`；不要据离线表格识别宣称真机保护已通。准备了 `scripts/diag-operator-realm.js`，未执行；先测 direct/wrapped/waive 方法可见性，不能未测就认定 Xray。
- 本轮未打包、未安装、未读凭据、未调用真实 provider。桌面焦点在激活后回到 Pi，已停止键鼠。
- 后续先解决宿主算子、单行文字框/字号/行距和跨栏语言映射；通过逐页视觉后再正式打包安装并重启验收。

## 历史复核：0.6.1 的视觉效果未通过用户验收，先重做解析基础

用户明确否定 0.6.1 的实际效果，要求仔细研究 Magic 源码后再工作。**下文的测试通过只代表行为回归，不代表成品合格。不要继续靠 DOM 分组阈值和缩字循环迭代。**

已只读分析本机 Magic 2.6.3 的 PDF 原位主链路，静态展开 36,481 处字符串调用，并单独运行 Zotero 9.0.6 自带 PDF.js 读取原测试论文验证结构接口。

核心发现：Magic 原位路径基于 GetPageData 的原始字符/字体/换行标记 → 文档级版面分类 → 规范化矩形 → 原位覆盖，并非从 textLayer span 猜段落；其 Markdown 公式保护是另一条路径。Zotero 自带 `pdfDocument.getPageData({pageIndex})` 可直接使用，已经离线实测前三页。Magic 的表格算子处理分支与当前 Zotero PDF.js 格式存在不兼容条件，重写时必须按实测协议处理，不能搬运。

完整调用链、行号、样本指纹、实测数据、差距表和重做顺序：`research/MAGIC-INPLACE-DEEP-REVIEW.md`。

本轮仅研究和取证：未修改 addon、未生成新 XPI、未启动 Zotero、未读取或迁移 API Key。桌面查询显示 Zotero 未打开。下一步按报告建立独立 DocumentLayout / PageLayout / LayoutBlock，而不是继续修改旧 DOM 启发式。

## 接手更新：0.6.1 原位翻译联调（历史记录）

以下更新优先于文末旧进度快照。完整证据见 `validation/INPLACE-REPORT.md`。

- 热重载已通；原位覆盖在真实 Zotero 9.0.6 + 测试论文中完成**无网络中文样本**测试。
- 双栏分组、跨行断词、CO2 间距、固定覆盖范围、字号拟合、统一并发队列、懒加载和缩放补绘、清除/卸载中止请求均已修。
- 真机验证：红框渐进、并发峰值 3、第 5 页补翻、实际缩放无重复调用、主屏覆盖 0、清除后覆盖 0。中文样本不是模型译文；真实引擎尚待验收。
- 新增 12 个测试，总计 77 JS + 7 Python。
- 源码/新包版本 0.6.1；已安装 XPI 仍是 0.6.0，本轮未重装，运行时为源码 dev 实例。
- Magic key **尚未迁移/读取**。现有 magic-scan.js 只扫描 pref 名称/长度，不是完整运行时引擎读取器。
- 当前平台启动程序会继承 Pi APPDATA。若 Zotero 未运行，明确传 `-profile C:/Users/Administrator/AppData/Roaming/Zotero/Zotero/Profiles/t1g6sjqd.default`；不要误入 D: 下无插件 profile。
- 桌面焦点最后被拒绝，已停止键鼠；最后一轮排版测试已自动清除覆盖层。执行 JavaScript 中仍可能是 dev-session 排版测试入口，先替换为下面的新加载器。

### 新热重载入口（替代旧的 loadSubScript）

勾选“作为异步函数执行”，粘贴一次；后续在该窗口 Ctrl+R：

```js
const scope = { Zotero };
Services.scriptloader.loadSubScriptWithOptions(
  'file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/scripts/dev-reload.js',
  { target: scope, ignoreCache: true }
);
return await scope.PaperLoomReloadPromise;
```

必须保留 `ignoreCache:true`，否则同路径可能执行旧代码。新加载器从 Zotero 主窗口取得 globals，并绑定 setTimeout/clearTimeout/fetch。PDF 内容窗口的 MutationObserver 会丢失特权对象选项；用主窗口构造器，不要改回 `new pdfWindow.MutationObserver`。

### 当前接口变化

- `groupInPlaceItems(items)` 为可复用纯几何分段函数；真实矩形夹具在 tests/reader-geometry.fixture.json。
- `translateInPlace(reader, {translateBlock}={})` 可注入离线翻译回调；默认仍使用真实翻译流水线。离线测试不修改 config、不查 login-manager、不写翻译缓存。
- session 使用 records/pages/queue/workers，不再使用 WeakSet done。`session.rescan()` 可用于诊断。
- 长译文在原块内部滚动，禁止靠扩大白底高度盖住下方图表。
- 旋转、复杂公式/表格、跨页参考文献乱序识别仍需验收；不要把本轮无网络测试写成真实译文质量通过。


---

## 0. 一句话任务

在 Zotero 9 里，独立实现一个名为 **PaperLoom 译研** 的翻译插件，
核心要做到 **像 Magic for Zotero 一样：点一下按钮，就在"原文 PDF 上"把文字原位替换成中文**
（左右分屏、右屏逐段把英文盖成中文、翻译中的段落先显示红色虚线框占位），
不是侧栏、不是新建笔记、不是新窗口。

---

## 1. 硬性约束（必须遵守）

1. **独立实现，禁止搬运 Magic 源码**：
   - 可以逆向 Magic 来"理解机制"（分屏、原位盖字等交互逻辑），但不得把 Magic 的
     混淆代码、业务逻辑、激活机制、密钥、服务端整段拷进来。
   - Magic 是付费产品，带激活和它自己的后端；克隆它的代码既有版权问题，也没有它的
     密钥/后端跑不起来。只复刻"交互机制"，用自己的代码写。
2. **不得破坏用户现有环境**：
   - 保留现有 Zotero 文库、设置、其它 8 个插件，一律不动。
   - 测试时不要使用用户已有的任何 API Key（唯一例外：用户授权的 Magic key 迁移，见 §9）。
3. **插件完全独立**：插件 ID = `paperloom@local.research`，无激活门槛，不与其它插件冲突。
4. **安全渲染**：所有来自原文/模型的文本一律用 `textContent` 写入 DOM，禁止 `innerHTML`
   承载不可信内容；`scripts/check.cjs` 会强制校验这一点。
5. **密钥安全**：任何时候不打印/记录密钥明文；迁移时只汇报 endpoint + model + 掩码长度。
6. **方法失败两次就停**：不要在同一条死路上反复打补丁；停下来拿实时数据/根因，再换思路。
7. **就地翻译 = 原位改字**，不是侧栏；逐段渐进显示是硬性 UX 要求。

---

## 2. 环境与关键路径

| 项目 | 路径 / 值 |
|---|---|
| Zotero 版本 | 9.0.6 |
| Zotero 安装目录 | `D:/Zotero` |
| 阅读器 bundle | `D:/Zotero/app/omni.ja` 内 `resource/reader/reader.js`（约 4.7MB） |
| Zotero 数据目录 | `C:/Users/Administrator/Zotero`（= `Zotero.DataDirectory.dir`） |
| 用户 profile | `C:/Users/Administrator/AppData/Roaming/Zotero/Zotero/Profiles/t1g6sjqd.default` |
| 已装插件 xpi | `<profile>/extensions/paperloom@local.research.xpi` |
| 插件源码（开发目录） | `D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/` |
| bash 下项目根 | `/d/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom` |
| 插件运行时数据 | `C:/Users/Administrator/Zotero/paperloom/`（jobs.json、cache/、exports/、诊断 txt） |

环境注意：
- 没有 `python3`，用 `python`，并设 `PYTHONIOENCODING=utf-8`。
- Kiro 写文件工具的 `/tmp` 与 bash 的 `/tmp` 不是同一路径；要 bash 能看到的文件就用
  bash heredoc 直接写。
- 双屏：主屏 `(0,0,1920,1080)`，副屏 `(-1920,0,0,1080)`，截图缩放 2.0。
- Windows 桌面自动化偶尔会被焦点拒绝；用户活跃时暂停抢焦点。

---

## 3. 构建 / 测试 / 校验命令

```bash
cd /d/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom
npm run check        # JS 语法 + manifest + 安全渲染 + XML 校验
node scripts/test.cjs  # 65 个 JS 单测（应全过）
npm run build        # 产出 dist/paperloom-<version>.xpi 并打印 SHA256
```

Python 侧另有 7 个 bridge 测试。改版本号时同步 `addon/manifest.json`、`package.json`、`package-lock.json`；`scripts/install-in-host.js` 和当前 `scripts/qa-installed.js` 动态读取package版本。

---

## 4. 插件结构与已完成功能

### 4.1 文件结构（`addon/`）

```
addon/
  bootstrap.js            # 入口：注册 chrome、按顺序 loadSubScript 各模块、attach、init
  manifest.json           # Zotero 9 需要 applications.zotero.{id, update_url, strict_max_version}
  content/
    core.js               # 纯逻辑：DEFAULTS、validateConfig、分段、术语保护、runPool、noteHTML 等（可被 Node 测试复用）
    providers.js          # 各翻译/LLM provider 适配（chatgpt 风格 /v1、deepl 风格 /v2 等）
    app.js                # 主对象 PaperLoom：init/shutdown、菜单、阅读器按钮、翻译流水线、AI 列、工作台
    ai.js                 # PaperLoomAI.attach：AI 列 / 矩阵相关
    readerview.js         # PaperLoomReader.attach：阅读器内渲染（侧栏面板 + §6 的原文就地翻译）
    preferences.xhtml/.js # 设置面板
    workbench.xhtml/.js/.css # 翻译工作台窗口
    icon.svg
  ...
scripts/                  # build.cjs / check.cjs / test.cjs / install-in-host.js / dev-reload.js / magic-scan.js 等
tests/                    # *.test.cjs + python bridge 测试
research/                 # 逆向笔记：reader-integration-notes.md、reader_xpcom.js（阅读器包装层）
```

### 4.2 bootstrap 加载顺序（重要）

```
core.js → providers.js → app.js → ai.js → readerview.js
→ PaperLoomAI.attach(PaperLoom, Core)
→ PaperLoomReader.attach(PaperLoom, Core)
→ Zotero.PaperLoom = appScope.PaperLoom
→ await Zotero.PaperLoom.init()
→ 每个主窗口 addWindow(win)
```

### 4.3 模块暴露的"坑"（曾导致启动崩溃，务必照抄 ai.js 写法）

每个 content 模块通过 `loadSubScript(url, appScope)` 加载。模块结尾必须把对象同时赋给
**裸变量**（= appScope 上那个）和 root，否则 bootstrap 用 `appScope.X.attach(...)` 会拿到
undefined 直接抛错，导致整个 `Zotero.PaperLoom` 没挂上、插件静默失效。

正确写法（见 ai.js / readerview.js 结尾）：
```js
var PaperLoomReader;
(function (root) {
  'use strict';
  function attach(app, C) { /* ... */ }
  const api = { attach };
  PaperLoomReader = root.PaperLoomReader = api;   // ← 两边都要赋值！
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
```
> 本会话最大的一个 bug 就是 readerview.js 只写了 `root.PaperLoomReader = {attach}`，
> 漏了 `PaperLoomReader =`，导致 0.5.0 一启动就崩。已修复，务必保持这个双赋值模式。

### 4.4 已完成并验证可用的功能

- 完整插件已在 Zotero 9.0.6 实装验证；其它 8 个插件未受影响。
- 翻译工作台（双语笔记、术语表 glossary、分段渐进翻译、导出 CSV/MD/双语笔记）。
- AI 列 / 矩阵（视图分组、单元格重算）。
- 设置面板（provider/endpoint/model/并发/分段大小/目标语/领域等）。
- 阅读器工具栏按钮注册（`renderToolbar` 事件，详见 §5）。
- 已移除"是否确定翻译"确认弹窗：`core.js` DEFAULTS 里 `confirmBeforeSend: false`。
- 修复过的坑：manifest 需 `update_url`/`strict_max_version`；AI 列 `width` 必须是字符串。
- 65 个 JS 单测 + 7 个 Python 测试通过。

---

## 5. Zotero 阅读器工具栏按钮（如何让按钮出现）

- 阅读器工具栏由 reader.js 里的 React `CustomSections` 组件渲染，派发 `renderToolbar`
  事件，把插件节点插入 `<div class="toolbar"><div class="end">` 槽位（在 🔍 放大镜左侧）。
- 注册：`Zotero.Reader.registerEventListener('renderToolbar', handler, pluginID)`。
  handler 收到 `{ doc, reader, append }`，`append(node)` 会把 node 包进一个 `.section` div。
- 合法事件类型：`renderToolbar` / `renderTextSelectionPopup` / `renderSidebarAnnotationHeader`。
- **注意时序**：`renderToolbar` 只在工具栏首次挂载时派发一次。对"已经打开"的阅读器，
  插件热重载后不会再派发——必须手动把按钮补进 `.toolbar .end`（dev-reload.js 已这么做）。
- 卸载监听：`Zotero.Reader._unregisterEventListenerByPluginID(pluginID)`。

---

## 6. 核心任务：原文就地翻译（split-view in-place，复刻 Magic）

这是本会话用户反复强调、也是目前最需要打磨的功能。参考 Magic 的实际行为（用户给过截图）：
**左右分屏，左边原文 PDF 不动；右边是同一篇 PDF，PDF 文本按段落原位盖成中文，排版/图表/位置不变；
正在翻译的段落先显示红色虚线框占位，翻完填入中文。**

### 6.1 已逆向出的 Zotero 阅读器 API（关键）

- 阅读器包装层源码已抽到 `research/reader_xpcom.js`，PDF.js 相关在 `reader.js` bundle。
- 开分屏（右屏 = secondaryView）：
  - 内部 reader：`reader._internalReader`
  - 竖直分屏（左右并排）：`reader._internalReader.toggleVerticalSplit(true)`
  - 水平分屏：`toggleHorizontalSplit(true)`；取消：`disableSplitView()`；
    尺寸：`setSplitViewSize(...)`；类型读取：`_internalReader.splitType`（'vertical'/'horizontal'/null）。
  - 设 splitType 后，内部会 `_secondaryView = this._createView(false)` 创建右屏。
- 两个视图的 PDF.js iframe window：
  - 主屏：`reader._internalReader._primaryView._iframeWindow`
  - 右屏：`reader._internalReader._secondaryView._iframeWindow`
- PDF.js DOM：`win.document` → `#viewer` → 每页 `.page[data-page-number]`，
  每页含 `.textLayer`（内部一堆绝对定位的 `<span>`，带位置和字号）和 `.canvasWrapper`（渲染图）。
- 滚动同步：`PDFViewerApplication.pdfViewer.scrollPageIntoView({pageNumber})`。

### 6.2 当前实现（readerview.js 里，已写第一版，需真机调）

主按钮「译研 · 原文翻译」→ `PaperLoom.translateInPlace(reader)`。已实现的方法（都挂在 app 上）：

- `ensureSecondaryPdfWin(reader)`：若无右屏则 `toggleVerticalSplit(true)`，轮询等右屏
  PDF.js 首页渲染出来，返回右屏 window。
- `collectPageBlocks(pageEl)`：读该页 `.textLayer` 的 span，用 `getBoundingClientRect`
  相对页面算坐标 → 先按 top 聚成行 → 再按行间距把行聚成段落块，返回
  `[{text,left,top,right,bottom,h,lines,...}]`。
- `fitFont(el, maxH)`：循环缩小字号直到塞进高度。
- `paintBlock(doc, pageEl, block, state)`：在页面里插入一个绝对定位的
  `div.pl-inplace`（白底盖住英文、中文、字号自适应）；
  state=`pending` 显示红色虚线框，`done` 填中文，`error` 红边。
- `translateInPlace(reader)`：开右屏 → 收集所有已渲染页的段落块 → 先全部铺红框
  → 用 `C.runPool(blocks, concurrency, ...)` 逐段并发翻译，翻完一段 `paintBlock(...,'done')`
  → 用右屏的 `MutationObserver` 监听懒加载翻页，新页渲染出来就补翻。
- `clearInPlace(reader)`：停止会话、断开 observer、移除所有 `.pl-inplace`。

菜单（按钮右侧 ▾）：原文就地翻译 / 清除就地译文 / 侧栏对照面板 / 侧栏仅译文 /
翻译选中 / 导出双语笔记 / 打开工作台。

### 6.3 已知待调（第一版盲写，必在真机上迭代）

1. **段落分组阈值**：当前按行高 ×0.9 的行间距合并段落、×3 行高的左缩进容差，
   对双栏论文、公式、标题/作者块容易分错，需在真实 PDF 上调阈值。
2. **字号自适应**：`fitFont` 只按高度缩，可能溢出宽度或过小；需兼顾宽度与可读性。
3. **坐标系**：块坐标用 `getBoundingClientRect - 页面rect`，依赖页面 `position:relative`
  （已在收集时强制设）；缩放/旋转/高 DPI 下需验证。
4. **懒加载翻页**：MutationObserver 监听 `#viewer`，可能重复触发或漏页；用 `done` WeakSet
  去重，需真机确认翻页滚动时正确补翻。
5. **双栏/图注/参考文献**：是否跳过参考文献、图注，按 `skipReferences`/`skipHeadings` 配置处理。
6. **性能**：段落多时 runPool 并发 = `config.concurrency`（1–8，默认 3），注意 API 计费与限速
  （`requestsPerMinute`，默认 30）。

---

## 7. 开发热重载工作流（让迭代变快，不再下载/安装 xpi）

**这是本会话最后确立的高效循环，接手后请沿用。**

- 文件：`scripts/dev-reload.js`。它会：卸载旧实例 → 从 D: 源码目录
  `loadSubScript` 最新代码 → 重新 init → 把按钮补进已打开的阅读器 →
  把状态写到 `C:/Users/Administrator/Zotero/paperloom/dev-reload.txt`。
- **用户只需在 Zotero「执行 JavaScript」窗口粘一次下面这段（勾上"作为异步函数执行"），
  以后每轮改完代码按一次 Ctrl+R 即可，秒级生效，无需关 Zotero / 重装 / 下载**：

```js
const scope = { Zotero };
Services.scriptloader.loadSubScriptWithOptions(
  'file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/scripts/dev-reload.js',
  { target: scope, ignoreCache: true }
);
return await scope.PaperLoomReloadPromise;
```

- 迭代循环：**AI 改源码文件 → 让用户按 Ctrl+R → AI 读 `dev-reload.txt` 确认重载结果 →
  在那篇测试论文（Journal of Cleaner Production 的 city-level CO2 那篇）上看右屏效果 →
  继续改**。每轮只花用户一个 Ctrl+R。
- `dev-reload.txt` 里会有分步日志，如 `loaded app.js` / `INIT FAIL: ...` / `FATAL: ...` /
  `DONE reloaded dev; readers=2 injected=1`，据此定位重载是否成功、按钮是否注入。
- `dev-reload.js` 里 `DEV` 常量 = `file:///D:/Users/Administrator/Pi-Agent/home/pi-cwd-20260926/paperloom/addon/`，
  如果源码目录变了要同步改。
- **粘贴那段后若 `dev-reload.txt` 没出现**：说明 IIFE 内部早早抛错（loadSubScript 返回 undefined
  不代表内部成功）。现版本已把全流程包在 try/finally 里并分步 flush 到文件，读文件即可看到卡在哪步。

### 诊断用：直接读运行时状态写文件

当「执行 JavaScript」返回值显示不清（async 包装、`[object Promise]`、undefined）时，
一律让脚本把结果 `await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir,'paperloom','diag.txt'), ...)`，
再由 AI 从磁盘 `C:/Users/Administrator/Zotero/paperloom/diag.txt` 读。
查最近错误：`Zotero.getErrors(true)`。查插件状态：
`AddonManager.getAddonByID('paperloom@local.research')`（`.isActive/.userDisabled/.appDisabled/.version`）。

---

## 8. 配置项（core.js DEFAULTS 摘要）

- 字符串类：`provider, endpoint, model, sourceLang(默认auto), targetLang(默认 简体中文),
  domain(默认 通用学术), bridgeURL, summaryPrompt, outputTag`
- 布尔类：`skipReferences, skipHeadings, context, bilingual, sourceFirst,
  visibleColumnsOnly, confirmBeforeSend(默认 false)`
- 数值类（带范围 clamp）：`concurrency[1,8]=3, chunkSize[400,12000]=2600,
  retries[0,6]=3, timeoutMs[1000,300000]=90000, requestsPerMinute[1,600]=30`
- 枚举类：`layout(columns/rows), clickAction(both/source/target/none),
  attachMode(import/link), columnSource(metadata/fulltext)`
- `reader: { fontSize:16, lineHeight:1.7, serif:true }`（侧栏面板用，已 clamp）
- `columns: [...]`（AI 列定义）、`glossary: [{source,target}...]`（术语表，有长度/重复校验）
- `validateConfig` 会丢弃未知键并 clamp 数值。

翻译 prompt（`core.js: translationMessages`）把原文包进 `<source>…</source>`，
系统提示要求"只输出译文、保留 ⟦PL_xxxx⟧ 保护标记"。
**注意**：有的模型会把 `<source>` 包裹标签原样吐回，`app.js: translateUncached` 已加剥除：
```js
text = String(text).replace(/^\s*<\/?(?:source|context)>\s*/gi,'').replace(/\s*<\/?(?:source|context)>\s*$/gi,'').trim();
```

---

## 9. 待办（按优先级）

1. **（最高）把 §6 的原文就地翻译在真机调到可用**：用 §7 热重载循环，在测试论文右屏上
   逐步修段落分组、字号自适应、翻页补翻，直到效果接近 Magic 截图。
2. **迁移 Magic 的 ChatGPT 引擎 key**（仅此一个 key 用户授权迁移）：
   - 用 `scripts/magic-scan.js` 读 Magic 运行时引擎配置
     （字段 `{api, secretKey, model, maxTokens, temperature}`，活动引擎 pref
     `extensions.zotero.zoteromagic.fulltextTranslate.engine = 'chatgpt'`）。
   - **只**把值写进 PaperLoom 的 login-manager 条目（origin `chrome://paperloom`，realm `PaperLoom`）。
   - 全程不打印密钥明文；只汇报 endpoint + model + 掩码长度。
   - 这些值只在运行时内存里（磁盘上没有），所以必须在 Zotero 运行时执行。
3. **完善**：滚动同步（左右屏联动，Magic 的"双屏关联"= Shift+Q，用
   `scrollPageIntoView({pageNumber})`）、"仅译文/对照/反向对比"模式、字体/字号/行高控制。
4. **扩展引擎**：google / microsoft / 多 key 负载均衡 / 公式保护增强。
5. **PDF 解析后端**：MinerU / Doc2X / pdf2zh（用户已装 pdf2zh 插件；Magic 的"输出为新 PDF"
   就是调 pdf2zh，可作为"保版式整篇翻译"的另一条路，`app.js` 已有调 pdf2zh 的入口函数）。
6. 收尾：改回正式打包（`bootstrap.js` 走 xpi，不再依赖热重载），`npm run build`，
   更新 `FEATURE-MATRIX.md` / 报告。

---

## 10. 关键方法索引（文件 → 方法）

- `app.js`
  - `init()` / `shutdown()` / `addWindow()` / `removeWindow()`
  - `buildReaderButton(doc, reader, append)`：主按钮 + ▾ 菜单；主按钮 click → `translateInPlace`
  - `translateCurrentPaper(reader,{bilingual})`：侧栏面板路径（非就地）
  - `readerSelection(reader)`：取 PDF 选中文字
  - `translate / translateUncached / completion`：翻译流水线（缓存、保护标记还原、质量检查）
  - `registerColumns()`：AI 列注册（width 必须字符串）
  - `secret/setSecret/logins/credentialName`：login-manager 密钥读写
  - `safe(fn)` / `confirm(title,msg)` / `alert(text)`
- `readerview.js`（`PaperLoomReader.attach(app, C)` 里给 app 加方法）
  - 侧栏：`readerDoc / readerPanelState / ensureReaderPanel / styleReaderPanel /
    readerAdjust / renderReaderPanel / closeReaderPanel`（面板 id `paperloom-reader-panel`）
  - 就地：`ensureSecondaryPdfWin / collectPageBlocks / fitFont / paintBlock /
    translateInPlace / clearInPlace`（覆盖块 class `pl-inplace`）
- `core.js`：`validateConfig / segmentText / splitLong / protectText / restoreText /
  qualityCheck / translationMessages / cacheMaterial / noteHTML / runPool / recoverJobs`

---

## 11. 测试论文

Journal of Cleaner Production 161 (2017) 1215–1225，
"Methodology and applications of city level CO2 emission accounts in China"（Yuli Shan 等）。
用户已在 Zotero 里打开。双栏排版、有标题/作者/摘要/正文，适合调段落分组。

---

## 12. 当前进度快照（截至交接）

- 启动崩溃（readerview 双赋值漏写）→ 已修。
- `<source>` 标签漏进译文 → 已修（剥除）。
- 主按钮改为"原文就地翻译"→ 已接 `translateInPlace`。
- 原文就地翻译第一版代码已写入 readerview.js，**尚未在真机验证/调参**。
- 热重载 `dev-reload.js` 已就绪（已加全流程 try/finally + 分步写文件）；
  用户已粘贴过加载器，但首次 `dev-reload.txt` 未生成（旧版未捕获 IIFE 内部错误，
  新版已修，需用户再按一次 Ctrl+R，然后读 `dev-reload.txt` 看卡在哪步）。
- 下一步：确认热重载通 → 在测试论文右屏迭代就地翻译 → 迁移 Magic key。
