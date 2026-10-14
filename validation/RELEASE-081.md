# 0.8.1 正式安装：自动图表入口、译文选择与双向临时高亮

## 已安装

- 当前 Zotero 正式包 **0.8.1**，profile jar 来源；非开发路径。安装时 PID2564未变，未做进程重启。
- `dist/paperloom-0.8.1.xpi` 97,568 bytes；SHA256 `e50e41e4445d09e0fbc77fcb671cd360252c1ba2361de72bff09db1f7f6853fe`，安装文件hash相同。
- `validation/update-081.json` passed=true；其它插件版本与active状态不变（`install-host-report.json`）。
- 168 JS＋14 Python通过，`.local/release-081-tests.log`。源码与包一致（发布后仅文档/QA脚本调整）。
- 当前最新已完成 **447/557**，剩余110，paused=true、running=0。安装前447条按原文+页码全部恢复，0排除、0未匹配。不要用420/439/453旧快照覆盖。
- 最新安装归档：`validation/pre-081-install-1791838953214.json`；数据目录 recovery 同步副本；旧0.8.0 XPI回滚副本在report。

## 用户需求与实现

1. 工具栏常驻 **图表自动译**，菜单/面板 **自动翻译当前页图表**。自动读取原生图像变换边界及重复数字列表，逐图识别后翻译；表格只处理表头，不发数字行。
2. 原生表头与高置信度OCR通过独立背景/几何/方向门禁后自动原位显示，不要求用户逐框确认；不通过的保留原图、热点看译文。框选移到“高级选项 · 补充漏识别区域”，内有清楚拖动说明。
3. 右侧正文支持浏览器原生左键拖选，普通双击保持选词；校订改为 **Alt+双击**，避免与选词冲突。
4. Ctrl+C仅复制插件译文DOM里当前选中文字，避免Zotero复制被盖住的英文。
5. 同步开时，左侧英文选择→右侧中文临时高亮；右侧中文选择→左侧英文临时高亮。对侧用pointer-events:none高亮节点，不抢焦点、不创建永久批注、不替换正文、不改变队列。
6. 匹配粒度：术语表明确的一对一词/不变字面量→精确词；同句数段落→句子序号对应；不同句数→整段。**这不是任意词语语义对齐**，英文hello/中文你好只在整句或有术语映射时精确对应，未硬编码用户例子。等句数不证明语义始终同序，复杂重排待后续。

## 输入根因

Zotero PDF view在window capture mousedown里把点击投到原PDF并自己完成选区、mouseup将DOM selection重置到英文。插件覆盖层只是DOM盖字，未退出其原生选区算法。`selection.js`按reader实例包装`pointerEventToPosition`，**仅插件覆盖层/框选层**返回null，其它原PDF点击保留；拖选全程不取消浏览器默认选区。shutdown/reader unload恢复原函数并移除CSS/事件。没有改Zotero二进制、Magic或其它插件。

## 已执行真实宿主验证

- `selection-right-evidence.json`：开发阶段真实鼠标右拖，Ctrl+C trusted=true，复制的是中文；左侧临时句子高亮。
- `selection-left-evidence.json`：开发阶段真实左拖，右侧临时高亮；对侧原生selection为空。
- **`installed-081-selection-right-evidence.json`、`installed-081-selection-left-evidence.json`**：安装后第47页真实鼠标双向拖选再次通过；右侧Ctrl+C复制中文，左侧0中文覆盖。
- **`manual-drag-host.json`**：真实鼠标从右表左上拖到右下，得到非空矩形；coverRemaining=0，未调用OCR/provider。修复后拖框可用，默认仍自动。
- **`auto-graphics-host.json`**：独立实例自动识别第47页1表+1图，无框选；第45/46页结构fixture均自动检测表区；仅本地OCR、无provider。
- **`finish-081.json`**：正式包工具栏单击后检测1表+1图，产生10个非人工填入译文，6个表头和90°轴为replace，另外3个标签为热点；左原文覆盖0。正文447条与paused状态不变。

### 必须如实区分的QA偏差

`arm-installed-081-qa.js`原计划将一次真实按钮改为仅识别，但未产出arming报告，最终真实按钮走了正式翻译阶段（是否来自cache/网络请求未逐次记录）。因此**最后按钮测试不算provider-free QA**。没有读取凭据，最终requests=0，别将它描述为全程零provider请求。后续不要再用该arming脚本；QA函数应直接传`translate:false`或独立实例。

## 未完成/下一步

- 自动边界下小字OCR仍有回归：`control(1o5seconds)`识别不准；虽target已保存但没有原位盖字，门禁降级热点。标题/横轴有缺空格，未自动放行。之前手动固定裁剪的0.99453不能作为本次自动识别成绩。应研究自动边界与局部复识别，保留原源/译文建议历史，避免静默改写。
- 当前只自动找原生图像和密集数值表，纯矢量复杂图/扫描大表/跨行跨列合并表头未完整支持。
- 任意词语双语精确对应未做，需要显式词对齐而非长度比例猜测；句数不等时仅段落级。
- 进程重启、跨页多选、缩放后选区、复杂全文视觉未全验收。仅当前相关页实测。
- 正文会话重启持久化仍依靠最新恢复归档，别在未保存最新会话时重启。
- 最终源/包版本0.8.1；图表正式数据在用户paperloom/graphics目录，QA资料仍在validation；旧手工图表preview已归档且未混入正式译文。
