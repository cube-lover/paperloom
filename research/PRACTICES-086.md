# 0.8.6–0.8.7 公开做法研究与采用

抓取日期：2026-10-13。研究与实现独立，不复制其他插件或更改Zotero本体。

## 公开资料

1. Zotero官方文件/Reader接口：Context7解析 `/zotero/zotero`；保存 `.local/docs-086-zotero-result.txt`。Reader代理及文件API实际以本机9.0.6行为核验。https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/reader.js
2. BabelDOC 排版： https://github.com/funstory-ai/BabelDOC/blob/main/babeldoc/format/pdf/document_il/midend/typesetting.py 。抓取到 `research/upstream-086/typesetting.txt`。953–1075行：尝试字号、下方/右方空间扩展、重试排版。采用“使用邻近空白”思路，独立实现受中线与保护区约束的垂直扩展；不采用缩到10%字号的策略，不引入PDF改写。
3. BabelDOC段落分组： https://github.com/funstory-ai/BabelDOC/blob/main/babeldoc/format/pdf/document_il/midend/paragraph_finder.py 。存 `paragraphs.txt`；维持语义段落与布局角色分离。
4. PDFMathTranslate： https://github.com/PDFMathTranslate/PDFMathTranslate 。README存 `pdf2zh.txt`。参考保留公式/图形、双语输出的产品边界；未安装其整套依赖。
5. SimAlign： https://github.com/cisnlp/simalign 。README存 `simalign.txt`。其词语对应基于多语言嵌入，说明可靠词对齐需要模型，单纯同句数不等于词对齐。本轮提供可选的现有引擎token对齐，验证返回索引、文本版本及非连续范围，标记model-token；**不是SimAlign推理或已证明任意词准确**。

## 采用与边界

- 图标：宿主data URI探针32×32通过；正式使用打包时由用户图片生成的data URI，避免内容iframe直接加载jar图片；不放宽CSP。
- 会话：每个item+PDF fingerprint独立文件、原子tmp替换、上一版本bak、关闭/升级前flush、自动恢复默认暂停、明确清除写active=false。
- 计数：正文、图表目标、旧版归档分开，原归档不算新翻译。
- 无可靠原译文分段对应时不切割中文。新单元格显示关联旧版内容供校订。
- 复杂向量图：对非平凡path bounds做受限聚类，稀疏线段/规则线/页面背景不独自认成图片；需要更多真实矢量/扫描语料评测，当前文档无新增vector cluster。

## 网络事实

Node直接fetch raw.githubusercontent.com失败；改用系统curl抓取成功。BabelDOC旧路径404，已通过GitHub tree API确认format/pdf路径。不存在“所有网上方案已充分评测”的结论。
