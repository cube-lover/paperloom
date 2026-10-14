# 0.8.31—0.8.35 图表漏译与公式保护

日期：2026-10-14。宿主已确认运行 **0.8.35-dev**；本轮只使用项目代码、离线测试与现有固定动作邮箱，无桌面点击、RunJS 或额外桥接插件。

## 已完成并有证据

- Kong 第8页稀疏三线描述表：从共享布局模型提取18个完整文字单元格，保留数值与电压单位；修复首尾单元格边界裁字。罗马编号 `Table I.` 独立作为图注。标题已补译，不再留下空白待译框。
- `structured-pdf-6`：Times 字体公式即使 `mathRatio=0`，第9页条件分支 `min / if / else` 与第13页 `max / s.t.` 也保持 formula，不提交翻译。真实PDF字符及坐标 fixture 已加入测试。
- 第12页流程图闭合节点识别、字体来源、4倍局部DOM排版及浅边框背景校验继续生效。普通状态和悬停不画蓝色定位线；有问题的覆盖仍如实报告，不以隐藏线条充当成功。
- 待译正文框保留原文可见，而不是用白框遮掉未完成内容。
- 0.8.34 将第12页22个自动流程节点按更完整的上下文重译；0.8.35 将固定流程翻译策略放入 system 层，并隔离其缓存，而不是把任务要求放进“不作为指令”的资料 context。石油/天然气等大写普通词与OCR混淆不再机械保留为英文。原source未改；前后target进入history；edited/approved记录不参与重译；失败恢复旧target。
- 0.8.35：四个 `No` 用两次一致正向识别及邻近完整流程节点确认方向；独立No/ON歧义仍不自动通过。恢复判断框的同文高一致性方向证据可解除机器review，不覆盖人工核准；其背景掩膜仍待完成。
- 低置信度标点框有少量padding越过已完整审计的闭合节点时，不再阻止该节点替换。限制：OCR标点、score<.8、未译、非字母数字、交叠<20%、中心在节点外、flowEvidence无未解释墨迹；真实符号/文字仍触发碰撞。

## 验证与边界

- JS **232/232**：`.local/0835-tests.log`。
- OCR Python **13/13**：`.local/0835-python-ocr.log`。本轮未重跑全部native/bridge Python套件。
- 0.8.35宿主离屏正文排版：594 **491**、428 **248**，失败0、未测量0。公式保护后若干旧可译块退出正文，标题新增一块；不是丢失译文。
- 保全审计：初始0.8.14目标2289条，及本轮前快照2521条，均在当前/归档/history找到，missing=0。`validation/retention-0835.json`。
- 宿主当前：594正文491/图表目标1134；428正文248/图表目标375。这是目标数量，**不是全页覆盖验收数量**。两篇保持暂停。
- 0.8.34第8页截图确认标题和18单元格中文可见、数值原样。
- 0.8.32第9、13页截图确认上述公式操作符保持原文；0.8.35有对应真实fixture回归。
- 0.8.34第12页：34个有target的图形锚点中27 replace / 7 hotspot。mask-only图显示已覆盖节点内部无残留英文；2倍分辨率图显示中文未发生重复叠绘。1倍整页下细小汉字仍较密。
- **0.8.35第12页最终截图未取得**：宿主 `document.hidden`，两次open-reader后仍被可见性门禁拦住。没有把隐藏页或旧截图作为最新验收。4个No、两石油节点已有新证据/target，最终渲染和字号需要阅读器恢复可见后复核。恢复判断标签 `g39822d94b92c0a161ee9` review已解除，但无inkPatch/background，仍有去字工作。
- 0.8.34 interaction审计未通过：4种缩放下选择文本精确、fit通过、左侧覆盖0；合成copy事件未被接收、linkedMarks=0。真实拖选/剪贴板尚未验收，不能把该审计当作通过。注意Gecko chrome监听器对untrusted事件与页面装载状态，不应直接断言真实复制必坏。
- 0.8.30曾完成全篇后台；0.8.35引擎版本更改后扫描checkpoint重置，本轮只做局部页，不声称重新完成103页扫描。

## 文件索引

- 第8页完整中文（0.8.34）：`.local/dev-channel/inspections/2ff1abd5-60f4-4d88-be48-e1570ff2cddc/page.png`
- 第9页公式（0.8.32）：`inspections/527eed2a-b1a3-4d80-bf7b-fc3b218f6940/page.png`
- 第13页公式（0.8.32）：`inspections/aae59013-19b5-4840-ab46-9213f8c568e7/page.png`
- 第12页0.8.34详细图：`inspections/6499ae3c-b72d-4ac1-9d54-e410c046d53a/{page,detail-default,masks-only}.png`
- 0.8.35排版：`inspections/05608d7c-d0a8-4a8c-8ed9-43b470673e48/layout-audit.json`
- 0.8.35归档路径由 `.local/0835-final-archive.json` 指向。只读对比，禁止旧快照覆盖最新数据。
- 包：`dist/paperloom-0.8.35-dev.xpi`
- SHA256：`d2770df9fb3d4166c16e078c3a623575c51de3af5698af018c5c06668d2ad4ee`

## 邮箱注意事项

- 新增固定 `translate-page ITEM PAGE` 补当前页图形及pending正文；`repair-flow-page ITEM PAGE` 仅重译自动、非人工的完整流程节点，先归档、保留history。
- `host-job.cjs` 每次请求前等待request/active收尾；不自动重试已提交的变更。
- 本轮外层200秒超时发生在 `repair-flow-page`，已等待原receipt完成（22/22），没有重复提交；确认无相关Node进程、无活动请求后，将遗留cli.lock重命名留证。
- 下一步先恢复可见阅读器再用inspect-page核验，勿取消document.hidden门禁；继续修恢复判断框掩膜及交互审计，随后回归Kong7、GPT-3 19/38/48/49和生命周期。
