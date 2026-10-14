# 图表翻译开发验收（未发布）

## 最新补充：左侧原文保护与密集表格

最新状态与证据以 **`DENSE-TABLE-REPAIR.md`** 为准。左侧译文已撤下，新绘制与定位仅在secondary。两线表采用重复数字列识别，表头按列合并；第45/46页19处人工中文表头在真实宿主通过识别/背景/fit/数据不相交检查。最新158 JS+14 Python通过。正式安装仍0.7.5，当前效果为热加载QA和现场guard。

## 状态（下述为旋转专项历史记录）

- 正式安装仍为 **0.7.5**。新增 `graphics.js`、OCR worker、菜单入口已写入源码，但没有构建/安装新版 XPI。
- 当前宿主 `Zotero.PaperLoom._graphicsQA` 是独立图表 QA 实例。手工填入四个中文标签供视觉确认，不是 provider 输出。临时记录位于 workspace `validation/graphics-rotation-qa-data`，没有写入正式图表数据目录。
- 当前原位正文 item594 GPT-3 75页，最新 QA 前后 420/571 已完成、paused=false、running=0、requests=0。禁止用旧的231段归档恢复。安装或重启前重新暂停、等待并归档最新会话。

## 功能实现

1. 菜单“图表翻译 · 框选 / 核对”“显示 / 隐藏图内译文”，独立于正文翻译。
2. 原生 PDF 字符优先，像素字由本地 RapidOCR + ONNX CPU 识别。只裁剪 PDF 原生 canvas，不截桌面/UI/已有译文；图像不发送到翻译服务。
3. 识别结果可编辑、勾选；只有用户点击“翻译勾选项”才调用现有文本引擎。每次请求绑定源文字块，不按模型返回数组顺序配对。
4. PDF 指纹+itemID独立持久化，人工校订历史保留。重框选对已有译文只给出识别建议，点击“采用重识别结果”才更新；原结果留在history。
5. 默认原图热点对照。用户核对后可启用框内替换；未核对、置信度低、文字相交、背景复杂、尺寸不足时继续保留原图，完整译文留在面板。
6. 所有坐标从裁剪像素逆映射至 PDF 坐标；渲染时使用真实 viewport，再补偿 PDF.js canvas CSS 整数尺寸。保留原始 sourceQuad，纸白区域最多对称增加1/2个源像素的墨迹余量，增加前重新检查相邻文字和背景，数字刻度不扩框。
7. 90°/270°竖轴不再一律回退。OCR局部裁剪分别旋转正反方向识别，通过置信度差确认方向，再以阅读顺序的四角映回原像素。译文局部基线沿原标签旋转；另有“方向 ↻90°”逐块纠正控件。
8. 小字/漏字：重叠高清局部分块补检 + 标签裁剪放大复识别；比较0/180或90/270方向。推理模型必须预先下载，不在用户识别时动态下载。

## 用户指出的缺陷及修正

- 横向 `control (105 seconds)` 原先识别成 `control(1o5 seconds)`（0.93214），导致保护检查不显示中文。新宿主实测正确识别0.99453，显示“对照组（105 秒）”。
- 纵向 `Duration (seconds)` 原先识别到文字但丢失基线方向，且替换逻辑拒绝所有竖直标签。现在识别旋转270°使原图文字转正（对应原标签逆时针90°），正确识别0.97543，方向验证true，显示旋转的“时长（秒）”。
- 仅解除旋转限制并不足够：必须重排四角，使逻辑宽度沿阅读方向，而不是将横排译文挤进细长竖框。
- 字框下缘的中文字体逻辑包围盒比拉丁字更高；自适应1/2px纸白余量解决短图例回退，仍保留邻块/网格/线条检查。

## 已执行验证

- `npm run check`通过。
- **151 JS + 14 Python**通过：`.local/graphics-rotation-all-tests.log`。
- Python包含真实本地OCR冒烟、反向90°标签fixture、方向四角顺序、原输入坐标范围、非法输入、打包worker逐字节一致性。
- 真实鼠标点击“框选图表”及拖框成功（上一轮独立QA）；不是UIA invoke或直接DOM click。
- `validation/graphics-host-diag.json`：只读宿主几何/会话。
- `validation/graphics-host-qa.json`：当前实际页PDF/图像混合识别及16组scale/rotation几何计算（不是16次真实鼠标旋转）。
- `validation/graphics-rotation-ocr.json`：独立PNG裁剪识别结果。
- **`validation/graphics-rotation-host.json`**：历史四个手工中文label的几何结果，曾左右共8框，偏差约0.0167 CSS像素。用户随后指出左侧覆盖错误，现已修正为只画右侧；此历史报告不符合最终交互标准，不作为最终验收。原图墨迹余量本身不计作定位误差。
- 真实截图人工查看：标题、旋转纵轴、图内对照组标签、横轴中文正常，折线/散点/置信区间未重画。
- 以上均零provider测试请求；正文完成数与暂停状态不变。

## 本地OCR部署

- Python `D:\Backup\Downloads\python312\python.exe`。
- 依赖隔离至 workspace `.local/ocr-runtime`（`pip --target`，没有修改全局依赖）。rapidocr 3.10.0、onnxruntime 1.31.0。
- 模型目录 `.local/ocr-models`，det/rec/cls PP-OCRv4 ONNX，来源与SHA256记录在该目录manifest.json；从RapidOCR官方manifest取值并验证哈希。
- 正式偏好 `extensions.zotero.paperloom.graphics.runtime` 尚未配置。QA实例通过独立graphicRuntime方法给路径，不读取凭据。
- `tools/ocr-image.py` 必须与 `addon/content/ocr-image.py`同步。

## 下一步

1. 更多真实PDF/扫描图/复杂底色/旋转页面覆盖测试；复杂背景仍仅热点，未实现科学图形擦除或自动修复。
2. 调整分块OCR重复合并、原生字符特殊字形/基线等边界情况，继续保证不串表格单元格。
3. 关闭并清理独立QA前先确认其手工label无需保留；仅清理`_graphicsQA`，不动正文。
4. 完成版本号/CHANGELOG/安装前备份，基于最新420段或之后的快照保全会话；安装后配置OCR路径，检查jar来源，重新验证真实入口与持久化。
5. 尚未做新版正式安装、进程重启、真实provider完整链或全75页视觉验收。
