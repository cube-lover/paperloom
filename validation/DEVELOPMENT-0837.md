# 0.8.37 开发记录：已有译文直接原位显示

## 问题
用户报告“已有译文但不显示”：428 第 18 页 17 处已有译文，实际只画出 8 处，其余以“已有译文 · 识别或原生文字匹配待核对”热点呈现。原因是 `replacementReason` 把机器核对标记当作显示拦截：
`row.review||row.score<.94`、`!approved&&!autoValidated&&…`、`!background`。

## 显示规则（0.8.37）
只保留三类拦截，其余一律原位画出译文：
1. 定位不可用：空框、斜切（`>6%` 正交偏离或对边不闭合）、竖排/90°/270° 且无方向证据且文本不可读。
2. 同文重复：同一矩形被两次识别（含 i/l/1 混淆的前缀/分词行）时归并为一处，保留更完整的一行；面积比 ≥2 且重叠 ≥60% 的小行让位给大行。
3. 明确相交：两处译文框在**两轴**上都覆盖较小框 ≥55%，且交集面积占较小框 >20%，才判定互相占用。

被忽略的旧原因：review/score/approved/autoValidated/background 缺失（`background:null` 时以 `rgba(255,255,255,.9)` 作半透明底色兜底，`data-cover=translucent-fallback`）。
`target` 与原文相同（如 `prMF.19`）不再生成任何覆盖层，状态条记为“原文即译文”。

## 效果（离线审计 `validation/display-audit-0837.txt`）
| 读数 | 0.8.36 | 0.8.37 |
| --- | --- | --- |
| 428 可绘制 375 处 | 253 显示 / 57 相交 | **310 显示 / 0 相交** |
| 428 未显示构成 | 相交 57、同文重复未处理 | 原文即译文 48、斜切 13、竖排方向 4 |
| 594 可绘制 1134 处 | 相交 127 | 相交 38、同文重复 42 |

## 回归
- 测试 `tests/graphics.test.cjs`、`tests/graphic-ink.test.cjs`、`tests/native-background.test.cjs`、`tests/reader-progress.test.cjs` 更新为新契约：审阅/置信度/背景不再隐藏译文；几何、同文重复、真实相交、竖排无方向仍拦截。
- 新增第 18 页真实 fixture `tests/fixtures/page18-display/rows.json`：13 处可画、4 处原文即译文；纵轴标题 270° 实例可画。
- JS **239 项通过**（`node scripts/test.cjs`）。
- 宿主：0.8.37 已安装（SHA256 `aec8b9a047901026da60877f424bd129be9a388f6e5b7b58e85cd9d6ea310e09`）。
  - `inspect-reader-ui 428` → 第 22 页 `已译 37/37 处 · 已原位显示 30 处 · 未显示 6 处（斜切标签定位待核对） · 原文即译文 1 处`。
  - `inspect-page 428 18` → `graphics:13`、`overflow:0`、`records:9`，与“13 处原位显示”一致。

## 未完成
- 第 18 页与 0.8.35/0.8.36 一样未取得可见截图（阅读器窗口被遮挡时 canvas 截图全白），`page.png`/`detail-serif.png` 为空，需窗口可见后重取。
- 428 仍有 13 处斜切定位、4 处竖排方向待核对；594 有 38 处真实相交（多为 “Context → …” 模板前缀行与正文行叠压）、10 处斜切。
- 第 18 页纵轴标题在低分辨率面板被拆成 “Physieal”/“1 Resilience” 两个分片，两片各自原位显示，尚未合并为一行。
- 恢复判断框掩膜、交互审计 copy 事件、GPT-3 虚线/生命周期验收仍未完成。
