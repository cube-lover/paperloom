# 0.8.14 开发构建：原生背景与程序化验收

## 当前状态

**已完成源码、离线验证与构建，未安装进用户当前 Zotero。** 现有正式安装仍以0.8.13安装报告为准。本轮没有桌面截图/键盘输入、没有挂载临时脚本、没有修改原PDF/译文/配置、没有provider请求。

## 实现

1. `tools/native-background.py` / 同步打包worker：校验输入SHA256，严格匹配源文本与源quad，字形中心精确去字，输出原始单页+去字单页+manifest。整页剩余非空字符数量/内容一致；位置容差0.01 PDF pt，绘图样式和图片哈希不变。输出目录必须新建，源文件始终只读。处理0/90/180/270及CropBox。
2. `native-background.js`：外部Python子进程，超时/取消/资源回收；同一PDF.js加载原始与clean单页，做坐标和像素比较；只把干净背景接入现有DOM中文，不生成中文图片。源文本/位置/文档指纹变化即失效。新接口`prepareNativeBackgrounds`当前是显式开发操作，**没有挂入全文自动调度**。
3. `graphic-evidence.js`：同页、同文本、几何匹配双向唯一时更新定位证据，独立记录geometryHistory；保留target、edited、id和翻译history。已人工确认定位、待核对记录只生成建议。错分/合并文本不迁移。白底不再是更新证据的必要条件。
4. `dev-channel.js`：开发包启动时自动创建本机文件邮箱，CLI固定任务，不接受任意JS/code/文件路径，不开网络端口，2小时失效，卸载/退出清理。普通包不含开发模块及标记。旧手工注入脚本已停用。

## 离线渲染的重要失败与修正

使用检查过的Zotero PDF.js 5.4.0模块，在Node+独立测试canvas环境运行第19页：
- 未修改单页与完整原文对应页：0像素差异；投影一致。
- 原始redaction结果：1833变化像素，其中53在目标框外；**失败记录保留**于 `native-pdfjs-1791913088165/report.json`。
- 原因是去字重写content stream导致非目标区域极小渲染变化；未放宽像素检查。
- 局部合成后，仅目标字形bounds含2px边缘取clean像素，其余强制原页：1780变化像素，框外0；`native-pdfjs-1791913297502/report.json` passed。
- 原始去字差异和合成差异分别记录。该测试不是Zotero宿主Gecko canvas/DOM验收；同区域内线条精度仍需宿主样本检查。
- 源字形框不足以含完整擦字边缘、或者一条译文框覆盖另一条擦除区时不生成patch，并返回skipped原因。

## 测试

- 210 JavaScript测试通过（包括bootstrap普通包无通道、开发标记自动启动、邮箱status、shutdown清理、背景失效、碰撞/放不下不覆盖、像素合成、定位证据迁移）。
- `npm test` 的20 Python测试通过；包含新worker测试。
- 新装CLI隔离Python/PyMuPDF 1.28.2环境单独跑5项worker测试通过（含8种旋转/CropBox组合、公开第19页、错误源/宽框/重复框/输出不覆盖）。
- 日志 `.local/native-0814-full-tests.log`、`.local/native-0814-worker-tests.log`。

## 开发包使用（程序入口）

构建：

```sh
node scripts/build.cjs --dev --native-python=ABSOLUTE_PYTHON_PATH
```

本地开发包中只有运行环境路径，不包含凭据、不修改Zotero偏好。由Zotero正常加载开发包后自动建立会话；无需“执行JavaScript”窗口。

```sh
node scripts/cube-dev.cjs status
node scripts/cube-dev.cjs pause-archive
node scripts/cube-dev.cjs prepare-native
node scripts/cube-dev.cjs native-page 594 19
node scripts/cube-dev.cjs stop
```

native-page的页码为1起算，要求该reader已打开、暂停、空闲且有可用原生记录；先归档再尝试生成背景。它不会修复旧表格的空间划分、自动把OCR误分类改成PDF，也不会请求新翻译。退出码、prepared/requested/skipped分别检查，准备0条不是视觉成功。

## 下一步（尚未完成）

- 安装开发包前，走可程序核验的最新归档与保留流程；本轮没有替换活跃插件XPI。
- 在真实宿主确认通道启动、获取真实reader/PDF而非错误库路径；测试native-page数据与视觉、缩放/旋转、选择。
- 把当前表头/行标签的陈旧重叠框修正纳入统一结构模型；否则背景正确也仍会被碰撞/排版门禁挡住。
- PP-StructureV3模型对照、双栏诗歌、小型/文字表字段覆盖尚未实施；LaMa尚未运行。
- 新native背景当前为会话内缓存；落盘缓存、批次失效和全文调度未完成。
- 开发邮箱通道模拟测试通过，宿主实机连通待验收；不要重称已可直接控制当前安装。

## 许可证

worker为本项目代码；PyMuPDF本体未打包。其AGPL/商业许可及组合分发义务应在公开发布前审查，不因为外部进程就认定免除。开发测试canvas单独置于`.local/native-render-runtime`，不进入XPI。
