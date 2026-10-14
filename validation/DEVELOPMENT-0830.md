# 0.8.15—0.8.30 持续修复与实机验收

日期：2026-10-14。当前开发版 0.8.30；未宣称所有图表覆盖合格。

## 实际完成

- 正文解析后全量入队，当前页只排序；不是按PDF.js页面DOM入队。两篇真实正文 491/491、252/252。
- 图表后台原先依赖隐藏tab的requestAnimationFrame，实测卡住，切回才继续。现离屏渲染用print intent（仅渲染调度，不打印），45秒超时并支持取消。0.8.28实测连续跑完75/75、28/28页，失败0；用户没有逐页翻动。
- 图表进度显示阶段、已检查页数、已译条数、失败；进度按钮只打开面板。重识别不调用provider。蓝线悬浮显示目标译文及fallback原因，面板可查实际渲染状态。
- 公式分数线误成巨大窄表已修：Kong页6恢复完整正文；旧碎片及译文归档。
- GPT-3页48两行六列表保留全部表头、数据；页38完整14个文字表单元，忽略连字符恢复；页49重复空栏间隙在段落合并前识别。
- 小字DOM使用更大的局部排版坐标再缩放，仍是可选择文字。0.8.28宿主检查252+491段，0失败、0未测量（不等于全部字号美观）。
- 流程图闭合矩形识别+完整OCR成员验证，按节点翻译；旧词条存为legacy，没有拼接中文。Kong页7原38条变19条，保留所有旧target。Oil方向仍不确定。
- 重识别不再用高置信度短残片覆盖完整源文；完整纵轴标题可归档相互重叠的旧碎片，但人工编辑不自动替代。
- mask的Gecko跨realm typed-array权限、模糊缩放后英文残留已定位。0.8.30使用完整局部背景补片，保留非字像素；图表复杂交叉仍需逐例审计。
- 数值表描述性行标签按相邻行中线限高，避免原先padding相交导致所有autoValidated为false；页19 six行标签已实际覆盖，数字未改。
- 原生去字已接后台的可选runtime；独立页19宿主操作17 requested/11 prepared/6 skipped，框外像素变化0。覆盖缓存按身份+指纹保存；自动路径实际命中数仍待记录。
- 开发通道死reader选择修复、Windows路径标准化、写receipt短暂占用重试；隐藏tab截图直接报错，不输出空白成功证据。
- 图表扫描完成/失败页checkpoint同版本保存恢复，跨引擎版本重扫，已有target不重译。

## 数据保全

基线 `.local/pre-0815-data-1791918422999`。每次安装前宿主暂停/排空/归档。
`validation/retention-0827.json`：初始正文478+281、图表1195+335条target，在当前活动记录或legacy/history中全部找到，missing=0。人工target/edited/history不盲覆写。

## 可追溯证据

- 0.8.30 JS：`.local/0830-tests.log`，219/219通过。
- Python：`.local/0828-python-tests.log`，22/22通过。
- 完整宿主排版：`.local/dev-channel/inspections/817704b9-2350-4789-8e3f-fb5d73ea5887/layout-audit.json`。
- 0.8.28全文后台结束：`.local/0828-progress3.json`，两个job pending0/failed0。
- 0.8.30页38：`inspections/6e25faa3-5941-4fdb-9aff-b1b7c883c1a7`。
- 0.8.30页19：`inspections/9d0927b1-fee0-4631-987b-1d29f7b9e09d`（六行描述标签已覆盖）。
- 页49实机：`inspections/5f79e626-95db-4dcc-a466-e928fa185147`（有极短诗句字号偏小，仍须优化统一节框）。
- 页48：`inspections/70877eed-a19e-4832-b38c-685481e9aded`。

## 未关闭

1. 小字/复杂背景仍有热点；页19 Fine-tuned SOTA/Human（OCR）靠近虚线，保留原图；Kong页7 Oil未核实方向。不能拿目标条数当覆盖条数。
2. 页38图例 Middleeastern紧邻/跨过数据曲线，0.8.30完整补片修复残留但需要放大保真核查；掩膜内曲线不是仅靠框外0变化能证明。
3. 诗歌极短段小字号、不自然机器译文及节结构；分栏正确不等于诗意译法和整节排版完成。
4. 缩放/旋转、拖选/双向高亮、关闭reader和完整进程重启需针对最终版复验。
5. 原生自动路径要检查lastNative失败原因；普通包不自带PyMuPDF runtime。
6. PP-StructureV3、LaMa未安装/实跑，尚无相关性能或效果承诺。

0.8.30已安装，已恢复两篇全文任务；完成后再次暂停归档/审计。源PDF始终未改。

## 0.8.30最终检查补记

- validation/full-background-0830.json：75/75与28/28，图表选中目标1134/1134与373/373，pending0/failed0；这是调度/译文完成，不是全部覆盖。
- validation/layout-audit-0830.json：743正文全部可测量，0溢出。
- validation/retention-0827.json在0.8.30重新执行：missing仍为0；旧目标都在活动记录/legacy/history中。
- Kong页7截图：inspections/a4687464-1fd6-4325-a5ad-0ee6a2a2bc31，完整节点中文已出现，Oil待核对。
- 已暂停归档：D:\Users\Administrator\Pi-Agent\home\pi-cwd-20260926\paperloom\.local\dev-channel\archives\3f3e7703-6b8d-4b04-ac4b-c550c7d0f527\snapshot.json
- 原生自动路径：GPT-3页13 native-worker-rejected-source，native缓存0；独立页19成功不代表自动路径全部成功。
