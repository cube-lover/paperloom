# 0.9.6 首次公开插件发布

## 基线与变更范围

功能基线为 GitHub `5a58071`（0.9.6）。本次不修改阅读器、翻译、框选队列、清除缓存或图表擦除的 JavaScript/Python 功能代码，不安装或重启 Zotero，不读取或改写用户论文与翻译数据。

仅处理发布材料：

- 重写 README，统一 Cube 翻译 / PaperLoom 名称、0.9.6 安装方式、Ctrl+R / Esc、OCR 和隐私说明；原 README 保存在 `docs/README-legacy.md`。
- 从插件清单移除 `https://paperloom.invalid/updates.json` 占位项。本版采用手动下载 XPI 更新，不宣称具有自动更新。
- 更新模型来源说明，移除已经删除的 ONNX Web/WASM 运行时描述；随模型附 Apache-2.0 正文，随插件附原创代码 MIT 许可文本。
- 发布普通包与 SHA256 校验文件，开发包和运行数据不上传。

## 本次定向验证

- `node scripts/check.cjs`：JavaScript 语法、XML、清单/包版本一致性检查通过。
- `node --test tests/bootstrap.test.cjs tests/clear-cache-095.test.cjs tests/region-shortcut-091.test.cjs tests/ocr-install.test.cjs`：15 项通过，无失败。
- `git diff --check` 通过。
- 重新构建普通 XPI，核对版本 0.9.6、插件 ID 与 Zotero 兼容范围；不含 `content/dev-channel.js`、`content/dev-build.js`。
- 包内 JavaScript/Python 功能文件与 Git 基线一致（比较时忽略 Windows 检出产生的 CRLF 差异）；本次不重复运行全套测试，也不把离线测试作为新增真实键鼠验收。

0.9.6 基线已有 291 项 JavaScript 与 25 项 Python 测试记录，以及目标表格视觉/数据保留验证，见 [INSTALL-096.md](INSTALL-096.md)。旧安装包的 SHA256 不等于本次发布包，因为本次清单及许可材料发生变化。

## 发布方式

- GitHub Release：`v0.9.6`。
- 安装包：`paperloom-0.9.6.xpi`。
- 校验文件：`paperloom-0.9.6.xpi.sha256`。
- 普通包：15,264,476 bytes，SHA256 `637967182003c92ca5beafd69d6daa329133aae6eeece6ea042a3c5cd988c59c`；22 个随包功能文件与基线一致。
- 使用 GitHub 自动生成的源码归档；不制作包含整目录诊断材料的额外源码包。
- 本地详细检查与发布回执保存在 `.local/catalog-review/`，不提交用户数据或凭据。

## 社区目录

申请目标为 Zotero 中文社区插件商店：<https://zotero-chinese.com/plugins>；收录仓库：<https://github.com/zotero-chinese/zotero-plugins>。

提交 Issue 或 PR 只是申请，维护者审核、合并与网站发布后才是实际收录。官方 Zotero 文档目前说明官方目录仍在计划中，中文社区目录不代表官方认证。
