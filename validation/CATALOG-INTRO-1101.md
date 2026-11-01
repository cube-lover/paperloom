# 公开功能介绍与数据源收录准备（2026-11-01）

## 范围

用户要求先优化介绍、写明已有功能，再提交商店实际数据源。此次只更新README、当前功能说明和收录材料；不改功能代码、不重建/替换v0.9.6安装包，不操作Zotero或论文译文。

## 文档调整

- README将简短列表展开为九类能力：PDF原位阅读、自动图表、本地OCR、框选排队、选择复制/关联、术语与校订、任务/清除、工作台导出及AI阅读辅助。
- 指明工作台位于设置页，与PDF原位任务独立；不宣传全部图表/校订自动导出。
- 不宣传任意词精准对齐、全部扫描件识别、未执行框选队列跨暂停/重启保存或全平台实测。
- 将旧FEATURE-MATRIX保存在docs/FEATURE-MATRIX-legacy.md；重写当前功能/证据范围，避免0.2–0.6历史状态误导读者。
- 原位翻译、OCR本机执行、用户自配翻译服务、隐私及兼容性说明保持一致。

## 本轮验证

- 已核对当前源码、已有0.9.6/0.9.5记录及独立只读审计结论。
- `node scripts/check.cjs`通过：语法、清单和XML。
- `node --test tests/app.test.cjs tests/ui.test.cjs tests/selection.test.cjs tests/alignment.test.cjs tests/reader-progress.test.cjs`：47通过、0失败、0跳过。
- `git diff --check`通过。
- 未调用真实翻译服务，未重新运行全套291JS/25Python；这些数字保留为既有验证记录，不是本轮新验收。

## 收录提交

目标：syt2/zotero-addons-scraper；拟仅添加addons/cube-lover@paperloom，标签reader/ai。PR正文附完整功能说明、v0.9.6普通XPI/校验地址、兼容范围、OCR运行时区别及原社区Issue #323。PR提交与审核/上架是不同阶段，回执另行核对。
