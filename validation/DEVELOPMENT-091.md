> 安装更新（2026-10-15）：**0.9.1 已安装运行，开发通道已恢复**。本地宿主自检通过；110段正文与281图表记录逐项保全、其他插件hash不变、requests=0、暂停。最新见 `validation/INSTALL-091.md`，真实键鼠/复杂视觉仍待验收。

# 0.9.1 开发修复：快捷键、清除菜单和连续框选

日期：2026-10-15。**源码与开发 XPI 已完成，尚未安装到当前 Zotero。**

## 本轮接续依据

本地 HEAD 是 `486598f`（0.9.0），并有 10 个未提交文件；先前 HANDOFF/TASKS 的 0.8.x 头部已经过时。本轮保留既有修改，针对可复现的交互/生命周期缺陷补修，不把旧视觉问题算作解决。

首次 dev status 读取成功：运行版本 0.9.0，item521 正文 110/110、图表 121/281 行有 target、requests=0；item474 的 reader wrapper 报 dead object。随后请求 pause-archive 时 session.json 已消失，请求未提交给宿主，未生成本轮实时归档。桌面仍有 Zotero，但 FocusWindow 后 Snapshot 显示它已最小化、焦点回到 Pi；停止桌面输入，没有强制重启或离线覆盖安装包。

## 已修复（离线回归通过）

1. **清除菜单只执行一次**：移除生命周期永久 `done` 锁；使用执行期间锁，结束后释放。统一 pointer release/click 触发，右键、按下后取消不清除。补全子菜单 no-drag CSS。
2. **快捷键串到其他论文**：主窗口只注册一个 dispatcher，按 `Zotero_Tabs.selectedID` 找当前 reader；reader 局部监听不再重复挂主窗口。文库页不回退到最后打开的隐藏论文；失效 reader 不影响健康 reader。
3. **禁用/卸载快捷键仍生效**：空偏好确实生成零 XUL key；修改偏好同步更新 keyset；F9 使用 VK_F9；输入框、组合输入与 repeat 不触发；shutdown 移除监听和 keyset。启动注册移到 graphics.attach 后，避免以未加载的默认参数注册。移除普通按键日志。
4. **框选队列状态错误**：等待超时不覆盖后台 control 或 busy；等待期间关闭 reader 不启动 OCR；页面缩放/旋转后拒绝沿用旧像素矩形；失败保留 error，不在 finally 改成 done；每次识别清空旧结果引用，已有译文无需重译时仍填充列表。
5. **清除后状态与历史丢失**：在途/解析中先阻止清除；空闲时暂停会话再修改，正文重新入队但不主动请求，图表页面重置为待处理；历史包含原译文、人工校订、approval 和对齐。checkpoint/恢复支持 clearedAt 和 history，清除后重启仍为 pending。存盘失败向上传递，不显示假成功。
6. **设置页加载失败**：手动 OCR 路径区域 `</div>` 改为匹配的 `</html:div>`。
7. **版本一致性**：package-lock 还停在 0.8.14，现与 package/manifest 同步为 0.9.1；check 增加三者版本一致门禁。
8. **测试基础设施**：UI 错误提示测试原先把 12 秒定时器压成 1ms、断言每 5ms 轮询，存在假失败；保留该测试的长提示定时器。队列测试释放 badge 的 120 秒定时器，JS 全套不再空等两分钟。

## 验证

- `npm run check`：通过，JS / XML / manifest / textContent 检查。
- `npm test`：**268 JS + 25 Python 全通过**。其中本轮新加 12 个回归；已有改动的测试也保留。
- 日志：`.local/resume-tests-final.log`、`.local/resume-check-final.log`、`.local/resume-targeted-final.log`。
- 第一轮失败记录保留：`.local/resume-check-baseline.log`（XML）、`.local/resume-regression-before.log`、`.local/resume-full-tests.log`（提示定时器）。
- 开发包：`dist/paperloom-0.9.1-dev.xpi`，15,275,776 bytes。
- SHA256：`61de886c0bf02c9d0e806af8c21a804fcd8cd27e5b1c1f12c5e1b04b6ded6e7e`。
- 尚无本轮宿主安装、真实按键/拖框或截图验收。没有发布 GitHub Release，没有调用翻译 provider，没有更改原 PDF/文库/凭据。

## 下次优先

1. 在宿主通道可用时重新读取**最新**状态并 pause-archive。禁止拿本页 110/110 当成下一轮实时数据，也不回滚旧译文。
2. 用已归档且空闲会话安装 0.9.1-dev，校验安装 hash、当前版本和旧译文/人工校订保留；开发包的 XPI manifest 为 0.9.1，文件名 dev 表明带本地开发通道。
3. 实机测试：两篇论文切换后 Alt+R / Ctrl+Alt+R；输入框和文库页不触发；同一清除子项重复使用；连续两次框选；缩放后队列明确提示；失败不变成功；关闭 reader 后无圆点和进程残留。
4. 清除测试先使用专用 fixture，不对用户当前论文执行 `menu-click clear-page` 或 `clear-translations` 作为无损 QA。
5. 前轮未提交的掩膜 flatFill/彩色抗锯齿清理虽过单测，**复杂曲线、数据点、地图和彩色背景的视觉保真仍待验收**。原有 item594 的相交、纵轴分片、小字 OCR 等未由本轮解决。
6. 跨分离阅读器窗口快捷键、全文正文/图表/手动队列统一暂停恢复、排队期间反复框选的真实宿主压力测试仍需收口。
