# 原位翻译联调报告（0.6.1 开发版）

## 状态纠正

以下是旧 0.6.1 行为测试的历史记录，**排版效果已被用户否定，不是视觉验收通过**。段内滚动/DOM 分组方案已从开发源码淘汰。

当前审计与修复见 `research/LAYOUT-SOURCE-AUDIT-2.md`、`validation/layout-source-audit/`。结构化 dev 的旧“0 溢出”也不足以证明排版：文字层 min-height 掩盖自然高度，单行框存在空间风险；宿主 getOperatorList 尚未成功。最新 105 JS + 7 Python 只是回归结果。只读核实已安装包为 0.6.1 旧实现，未包含新模块；本轮未安装新版。

## 历史测试结果

在 Zotero 9.0.6、用户指定 profile `t1g6sjqd.default` 中完成原位覆盖层的无网络真机测试。论文为附件 474：*Methodology and applications of city level CO2 emission accounts in China*。中文内容明确标为“【排版测试】”，不是模型译文。没有读取任何 API Key，也没有调用翻译服务。

`dev-session.json` 最后一次记录：
- 初始 136 个红色虚线占位块；完成块逐段填充。
- 最大并发 3，未超过当前配置。
- 第 5 页实际跳转成功，新页补翻成功。
- 实际比例从 0.7773704970 变为 0.8939760716；这次缩放前后调用计数均为 139。
- 主屏覆盖节点为 0；测试清除后副屏覆盖节点为 0。
- 该轮统计中 3 个长文本块进入块内滚动，不扩大白底矩形覆盖下方内容。
- 6 项行为检查全部为 true。屏幕观察确认左右 PDF 分屏、右屏中文样本原位覆盖、双栏未串行。

## 修复

1. 热重载：`loadSubScriptWithOptions` + `ignoreCache:true`；显式暴露 Promise；先创建日志目录；Window 函数绑定宿主。
2. 等待内部阅读器和文本层，而非仅等待 canvas。
3. 先按水平空隙分开双栏，再组合行和段落；缩进识别新段；修复连字、跨行断词与 CO2 间距。
4. 坐标采用 CSS px，处理页面 border 与外层 CSS scale，不乘 devicePixelRatio。
5. 固定覆盖框宽高；高度/宽度同时拟合字号；长译文保留可读字号并局部滚动。
6. 同一会话共享一个队列；页渲染/缩放事件与过滤后的 MutationObserver 共同补绘。
7. 页面重建可复用已完成结果；清除时断开监听、中止请求并丢弃迟到响应；shutdown 清理覆盖层和面板。
8. 真实 Firefox 中须用 chrome 主窗口的 MutationObserver 构造器。PDF iframe 构造器会丢掉来自特权对象的 observe 选项；`observer-probe.json` 保留了对照证据。
9. 安全渲染检查覆盖 addon 下所有 JS，而非只检查 workbench.js。

## 环境处理

首次通过当前进程启动时，Zotero 继承了 Pi 的 APPDATA，打开了 `D:/Users/Administrator/Pi-Agent/home/AppData/.../igr45nac.default`，而不是用户 profile。发现后正常退出，使用显式 `-profile C:/Users/Administrator/AppData/Roaming/Zotero/Zotero/Profiles/t1g6sjqd.default` 启动。没有迁移/删除任一 profile 或数据库。

`runtime-inventory.json` 在指定 profile 中确认全部 9 个插件启用（PaperLoom + 原有 8 个）。本轮未安装或卸载任何 XPI。运行时加载的是源码开发实例，磁盘已装 XPI 仍为 0.6.0。

末尾一次焦点验证被 Windows 拒绝，键鼠输入已停止。测试脚本此前已自动清除所有测试覆盖层；`dev-cleanup.js` 已准备，但未执行。执行 JavaScript 窗口可能仍保留排版测试入口，按 Ctrl+R 会重新跑测试；继续正常开发前按 HANDOFF 的新加载器替换。

## 尚未验收

- Magic ChatGPT key 迁移：未读取、未写入；`magic-scan.js` 实际只扫描 pref 元数据，不能视为已完成的运行时引擎提取器。
- 真实模型输出的准确性、术语、长度与实际费用。
- 页面旋转、多重变换、扫描件 OCR、深色 PDF 背景。
- 复杂表格/公式的完整保护，以及跨页参考文献边界的乱序加载；当前启发式不是完整版面解析。
- 连续滚动与反向对照模式、字体/字号控制、翻译中失败块的单独重试。
- 0.6.1 XPI 的正式安装及安装后验收。

## 文件

- `tests/reader-geometry.fixture.json`：前三页真实文本矩形，不含凭据。
- `tests/readerview.test.cjs`：12 项新增测试。
- `validation/dev-session.json`：真机测试摘要。
- `validation/observer-probe.json`：跨 realm 根因验证。
- `validation/redraw-new-records.json`：最后一次返回原页后新增记录为空。
- `.local/backups/inplace/`：修改前 readerview/app 源码备份。
