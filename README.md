# Cube 翻译 · PaperLoom

[![Release](https://img.shields.io/github/v/release/cube-lover/paperloom?filter=v*)](https://github.com/cube-lover/paperloom/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

面向论文阅读的 Zotero 翻译插件：在阅读器中对照原文与译文，处理正文、图表文字和框选补漏。仓库名为 **PaperLoom**，Zotero 中显示为 **Cube 翻译**。

当前版本：**0.9.6**。下载 [普通版 XPI](https://github.com/cube-lover/paperloom/releases/download/v0.9.6/paperloom-0.9.6.xpi)，或查看 [发布记录](https://github.com/cube-lover/paperloom/releases)。

## 主要功能

- **PDF 原位翻译与双语对照**：左侧保留原文，右侧显示译文；正文和图表文字使用各自的处理流程。
- **框选补漏**：默认 **Ctrl+R** 开启框选，**Esc** 取消。松手后任务进入串行队列，小圆点显示处理进度；点击小圆点查看结果，不自动弹出大面板。
- **图表文字识别**：支持本地 Python OCR；Windows x64 可在插件中一键下载、校验和安装独立运行时。
- **暂停、恢复与解析缓存**：保存任务状态，按 PDF 指纹及解析器版本复用版面解析结果。
- **清除当前页或全部译文**：保留原文与校订历史；清除后的重新翻译使用新缓存代次，不直接回填清除前的缓存。
- **术语与人工校订**：术语表、保护标记、译文编辑及质量提示。
- **翻译工作台**：逐段对照、文献总结、AI 文献列和双语笔记等辅助功能。

## 安装

1. 从 [v0.9.6 Release](https://github.com/cube-lover/paperloom/releases/tag/v0.9.6) 下载 `paperloom-0.9.6.xpi`。`Source code.zip` 是源码，不是安装包；OCR 运行时也不是插件安装包。
2. 打开 Zotero 的 **工具 → 插件**。
3. 将 XPI 拖入插件窗口，或在插件管理页的设置菜单中选择 **从文件安装插件**。
4. 按 Zotero 提示确认安装；如提示重启，重启后打开 PDF。
5. 在插件设置中配置翻译服务，使用阅读器工具栏的 **Cube 翻译** 按钮启动任务。

插件 ID：`paperloom@local.research`。从开发包切换到普通包时，使用同一 ID 更新；普通版不包含开发诊断通道。

**当前发布采用手动更新**：后续从 Releases 下载新 XPI 后安装。此版本移除了未启用的自动更新占位地址，没有配置自动更新源。

### 兼容性

| 项目 | 当前范围 |
| --- | --- |
| 清单声明 | Zotero 7.0–9.* |
| 已有实际安装记录 | Windows 上的 Zotero 9.0.6 |
| 一键 OCR 运行时 | Windows x64 |
| Zotero 7/8、macOS、Linux | 尚未完成实际兼容性矩阵验证；OCR 可选外部 Python 路线需自行配置 |

安装记录见 [0.9.6](validation/INSTALL-096.md)、[0.9.5](validation/INSTALL-095.md) 和 [快捷键验证](validation/INSTALL-093.md)。

## 快速使用

### 正文与图表翻译

1. 配置目标语言、模型和翻译接口。
2. 打开 PDF，点击阅读器工具栏的 **Cube 翻译**。
3. 使用同一按钮暂停或恢复；工具栏下拉菜单提供图表补译和 OCR 安装入口。
4. 未识别的区域可用 **Ctrl+R** 开启框选，拖动选取文字区域，松手入队；**Esc** 取消当前框选。输入框中不触发快捷键，自定义组合以设置为准。
5. 点击小圆点查看框选结果。复杂图形、公式和低质量扫描件需要人工核对。

### 清除译文并重新翻译

工具栏下拉菜单 → **清除翻译** → **清除当前页面翻译** 或 **清除所有页面翻译**。

清除只作用于插件译文，保留原 PDF 和历史。重新启动翻译会使用新缓存代次；服务调用可能再次计费，新译文的措辞也可能与之前相同。

### 本地 OCR

阅读器菜单 → **安装识别引擎（一键）**，或使用设置中的文件夹导入与外部 Python 配置。

Windows x64 独立运行时约 101 MiB，包含 Python、RapidOCR、ONNX Runtime 及模型。下载后校验 SHA256 再解包；识别在本机执行。下载与许可信息见 [OCR runtime Release](https://github.com/cube-lover/paperloom/releases/tag/ocr-runtime-1.0.0) 和 [依赖说明](THIRD-PARTY-NATIVE.md)。

OCR 的本地识别与后续翻译是两个步骤：识别后的文字会按用户配置发送给翻译服务。

### 翻译服务

| 接口 | 示例 | 说明 |
| --- | --- | --- |
| OpenAI 兼容 | `https://api.openai.com/v1` | 使用服务实际支持的模型与自己的 API Key |
| 本地 OpenAI 兼容 | `http://127.0.0.1:1234/v1` | 需自行启动本地服务；无认证服务可留空密钥 |
| DeepL Free / Pro | `https://api-free.deepl.com` / `https://api.deepl.com` | 仅翻译，不提供 AI 总结 |

密钥按服务地址保存在 Zotero/Firefox 登录管理器。远程服务要求 HTTPS，本机回环地址可用 HTTP。翻译服务由用户配置，费用和数据处理规则以对应服务为准。

## 数据与隐私

- 任务、译文、历史和缓存保存于 **当前 Zotero 数据目录 / `paperloom`**；插件不更改 Zotero 的数据目录。
- 原 PDF 保持不变；清除译文不删除原 PDF。
- 使用远程翻译或 AI 服务时，相应原文、提示词及必要上下文会发送到用户配置的服务。
- OCR 在本机识别；运行时首次下载需要网络。
- 缓存和任务含论文原文，未加密。不要将整个数据目录、论文或个人配置上传到公开仓库。
- 导出的 Zotero 笔记与附件遵循 Zotero 自身的同步规则。
- 暂停或关闭插件会请求中止网络任务，但服务端已开始的处理与费用取决于服务本身。

## 当前限制

- 复杂图形、文字与曲线重叠、扫描件、多栏顺序和公式保护仍需人工核对；0.9.6 改善了目标表格的字形黑点和短线残留，不代表所有版面已完成视觉验收。
- 可选原生去字后台仍有已记录的源文件拒绝问题，当前已验证显示路径为浏览器掩膜。
- 外部解析器和原生后台需要独立安装配置，不随普通 XPI 提供完整运行环境。
- 不内置翻译服务账户、API 额度或商业服务承诺。

问题反馈请使用 [GitHub Issues](https://github.com/cube-lover/paperloom/issues)，附 Zotero/操作系统版本、插件版本、复现步骤和脱敏截图。不要提交服务密钥或私人论文。

## 开发

需要 Node.js 20+ 与 Python 3.10+。

```sh
npm ci
npm run check
npm test
npm run build
```

普通包输出至 `dist/paperloom-0.9.6.xpi`，同时生成 `.sha256`。构建不启动 Zotero，产物不提交到 Git。开发诊断通道仅在显式使用 `node scripts/build.cjs --dev` 时打包。

代码分工：`addon/bootstrap.js` 管理生命周期；`addon/content/` 包含阅读器、布局、翻译、OCR、持久化与界面；`tools/` 为可选 Python 集成；`tests/` 为离线回归测试。

0.9.6 的既有功能验证为 291 个 JavaScript 测试与 25 个 Python 测试通过。此次发布整理的检查范围见 [发布记录](validation/RELEASE-096.md)。

## 许可证

PaperLoom 原创源码与文档采用 [MIT](LICENSE)。随 XPI 分发的 PaddleOCR 模型和字典采用 Apache-2.0，许可与来源见 [模型目录](addon/models/NOTICE.txt)。外部软件保留各自许可证，详见 [依赖说明](THIRD-PARTY-NATIVE.md)。

[变更日志](CHANGELOG.md) · [早期工作台文档（历史归档）](docs/README-legacy.md)
