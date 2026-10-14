# 可选本地 PDF 桥接

`bridge.py` 本身只依赖 Python 3.10+ 标准库。解析器和 PDF 翻译器是单独的外部组件，脚本不会自动下载、安装或启动它们。

## 初始化与启动

在项目目录运行：

```sh
python tools/bridge.py --init
```

这会新建 `tools/.local/bridge.json` 并生成随机 Token，**不会把 Token 打印到终端**。已有文件不会被覆盖。

用本地文本编辑器打开这个文件，将其中的 `token` 填入 PaperLoom 的“新的桥接 Token”。不要上传该文件或在共享日志中展示它。

配置正确后：

```sh
python tools/bridge.py
```

默认绑定 `127.0.0.1:8767`，PaperLoom 的桥接地址填写 `http://127.0.0.1:8767`。服务不监听公网地址，不提供浏览器 CORS 接口。

按 `Ctrl+C` 停止。关闭 Zotero 不会自动停止这个由你手动启动的进程。

## 解析 CLI

默认参数：

```json
{
  "parserBackend": "cli",
  "parseCommand": ["mineru", "-p", "{input}", "-o", "{output}"]
}
```

- 需要自行安装并配置 MinerU、模型与运行环境。
- Windows 下建议把第一个参数换为已安装 `mineru.exe` 的绝对路径。
- `{input}` 是桥接临时生成的 PDF；`{output}` 是此次任务单独的临时输出目录。
- 读取输出目录中最大的 `.md` 文件。图片不会打包回 Zotero，Markdown 图片引用会保留为文本。
- 参数数组直接传给进程，**不经过 shell**；文件名中的空格与特殊符号不会被当成命令。
- 可换成其他可靠的本地 PDF→Markdown CLI，但需遵守相同的输入 / 输出约定。

项目参考：https://github.com/opendatalab/MinerU

## GROBID

在桥接配置中设置：

```json
{
  "parserBackend": "grobid",
  "grobidURL": "http://127.0.0.1:8070"
}
```

先自行启动 GROBID 服务。桥接调用 `/api/processFulltextDocument`，发送 multipart PDF，读取 TEI XML，提取标题、摘要、章节、正文与参考文献。

这里不声明精确的页内坐标、表格结构、图片或公式 OCR。涉及数学内容时，应回到原文检查。回环服务访问不走系统代理；远程 GROBID 地址要求 HTTPS。

项目参考：https://github.com/kermitt2/grobid

## PDF 翻译 CLI

默认针对经典 pdf2zh：

```json
{
  "pdfCommand": ["pdf2zh", "{input}", "-o", "{output}", "-li", "{source}", "-lo", "{target}"]
}
```

- 需要独立安装并先在命令行验证 pdf2zh 可用。
- 引擎、密钥、字体以及对照输出等由 CLI 自己的配置决定；桥接不读取其他 Zotero 插件的设置。
- 若使用 pdf2zh_next / PDFMathTranslate-next，请根据**已安装版本的 `--help`**修改数组；当前版本没有对此 CLI 的具体参数做真实联调。
- 自动把目标语言“简体中文”映射为 `zh`。经典 CLI 的 `auto` 源语言会映射为 `en`；非英文论文请显式填写正确源语言。
- 将输出目录中的 PDF 返回给插件。插件保存为新的副本或链接附件，不覆盖原论文。
- 工作台译文与 CLI 译文是两条流程；术语表、缓存和人工校订不会自动传给 CLI。

项目参考：https://github.com/Byaidu/PDFMathTranslate

## 限额与失败

- 单份输入 PDF 最大80 MB；返回 PDF 的合计体积最大80 MB。
- 同时只处理一份 PDF，忙碌时返回 HTTP429。
- CLI 默认处理上限240秒；插件请求超时300秒。大文件应先按章节处理。
- 临时目录在配置的 `workDir` 内，任务结束后清理；建议保留默认 D 盘项目路径。
- 失败响应只返回概括错误，不回传外部工具可能包含密钥的 stdout/stderr。
- 出错时先在自己的命令行独立验证 CLI。不要将包含服务密钥的完整命令或配置贴到公共反馈中。
- 取消插件请求不一定终止已运行的 CLI 或上游计费；CLI 最多运行到桥接的超时上限。

## 本地 API 契约

所有接口要求：`Authorization: Bearer TOKEN`。此处 `TOKEN` 是占位符，实际值来自本机生成的私有配置。

```text
POST /v1/health
{}
→ {"ok": true, "version": "0.1.0"}

POST /v1/parse
{"pdfBase64": "BASE64_PDF", "sourceLang": "en", "targetLang": "zh"}
→ {"text": "Markdown text", "parser": "local-cli|grobid", "imagesEmbedded": false}

POST /v1/pdf
{"pdfBase64": "BASE64_PDF", "sourceLang": "en", "targetLang": "zh"}
→ {"files": [{"name": "translated.pdf", "base64": "BASE64_PDF"}]}
```

实际服务尚待联调。本项目测试验证的是鉴权、请求格式、TEI 转换与模拟 CLI 的文件往返，不代表 MinerU、GROBID 或 pdf2zh 已安装成功。
