# 密集数值表与左侧原文保护（开发中，未发布）

## 用户反馈及根因

用户提供了 GPT-3 论文第45页污染子集统计表与第46页训练计算量表，指出失败/错乱，另指出左侧也出现译文。

- 左侧：图表开发版 `bindGraphicPages` 曾对 primary/secondary 同时绘制测试译文。不是原始PDF被改写。已移除左侧图形覆盖并限制所有图表绘制/定位只进入secondary；单窗时仅面板显示。正文原位本来只绑定secondary；实测primary的`.pl-inplace`为0。
- 第46页：只有header separator和bottom两条规则。旧`graphics()`要求三条横线，未识别这张表；17行模型/数值合并成一个正文块，产生用户截图中的连串段落。第45页已有三线表保护，但没有按单元格翻译表头的路径。

## 已改源码

- `layout.js`增加`physicalCells`/`tableStructure`：按物理基线拆单元格；至少3行、至少4列、至少3个数字单元格、重复列对齐，科学计数法/百分比均保持原文。
- 已有规则证明的table区域优先，避免双栏同基线数值误合成跨栏大表。新数字结构补足无顶线的表；原位正文解析之前将这些区域排除。
- `graphics.js`完整原生表格优先：仅返回表头单元格，跳过表内OCR副本与所有数据单元格。表头按列合并多行，每列固定frame，`N`与`Acc/F1/BLEU`默认不选中。模型/数据集名称与数字不进入翻译列表。
- 表头框使用实际列间空隙而非数字墨迹宽度；字体基准取原表格字体，不用多行表头总高度推算字号。
- 普通PDF文本使用彩色subpixel antialias。纸白检查仅在可信原生字形ink范围（2源像素余量）内允许这种彩色像素，周围彩色背景/线条仍拒绝。
- 所有图表绘制有secondary document硬校验；定时重绘、直接绘制及“定位核对”均不进入primary。

## 当前宿主已做的修复（非正式安装）

- `scripts/repair-source-and-probe-tables.js`：清除左侧图表覆盖、加源窗保护、抓取真实PDF结构fixture，无provider请求。
- `scripts/repair-dense-tables.js`：归档最新受影响记录，标记`protectedTable`，阻止相关正文重绘/排队；只隐藏错误覆盖，不删除译文、不改既有420条译文。
- `validation/table-live-repair.json` passed=true：12个受影响正文record受到保护，done=420前后相同、paused=false不变、requests=0。
- `validation/pre-table-guard-*.json`保存错误表格译文与对应原文/布局，后续升级不要静默丢弃。
- `Zotero.PaperLoom._graphicsQA`已换为新模块独立实例。当前预览第45/46页右侧有人工中文表头；旋转图第47页测试记录也在QA保留。都是手工排版fixture，不是provider译文。

## 证据

- check、**158 JS + 14 Python通过**：`.local/dense-tables-tests.log`。
- `tests/layout-dense-tables.fixture.json`：当前论文真实结构与算子（含其它相关页，不是仅人工fixture）。
- 第45页：42行×12列=504数据单元格，12个完整表头，10个选中翻译。
- 第46页：17行×9列=153数据单元格，9个完整表头。
- `validation/table-headers-host.json`最新2026-10-12T15:44:30Z passed=true：**实际宿主原生结构+本地OCR裁剪链**返回12/9个完整表头、原生像素背景验证通过；右侧19个手工中文表头全replace，左侧图表/正文覆盖均0；provider requests=0、done=420不变。
- `validation/table-visual-verification.json`仅证明DOM几何：表头两两相交0、表头与数据相交0、primary覆盖0、正文done不变。其drawWindow截图输出黑图，**不得当成有效视觉截图**。文件`table-45/46-*.png`为失败截图产物。
- 最终Windows MCP真实截图人工检查了当前第45页：左侧完整英文，右侧中文表头，数值网格保持。第46页19框之中的9框经过真实DOM fit与data-overlap检查，但未滚到第46页做最终人工截图，避免触发用户正文队列。

## 后续/限制

- 正式安装仍 **0.7.5**，没有生成或安装新XPI。源码版本号尚未提升，`layout.VERSION`仍structured-pdf-3，正式发布前应调整版本/变更记录。
- 原位live guard只在当前进程；重启旧0.7.5仍会走旧布局。下一步正式更新前重新归档最新用户会话（不是重放420旧快照），并保留被保护表格record的归档。
- 表格结构只覆盖重复数值列的原生表格，复杂跨行跨列表头/扫描大表仍需更多fixture与独立结构识别；不要宣称所有表格都已解决。
- 不再运行旧qa-graphics-host/preview等无条件双侧8框脚本作为当前验收；新标准左0、右有译文。
- 运行JS窗口handle4459192/PID2564曾被用户移动；最新执行按钮为(471,289)，编辑(680,351)。每次输入前重新核对，不用旧(542,223)。
