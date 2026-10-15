# 0.9.3 · Ctrl+R 安装验收

日期：2026-10-15。按用户要求将默认框选快捷键改为 **Ctrl+R**，菜单与高级设置提示同步更新。已安装运行，不是仅修改源码。

## 原因与变更

- 前一轮 Windows RegisterHotKey 临时探测：Alt+R、Alt+Shift+R 返回1409（已注册）；Ctrl+Alt+R 当时可用。成功探测后立即注销，未长期占用。
- NVIDIA Overlay ShareSettings.json 的 shortcuts：PMOCOverlay=[18,82]，PMOCOverlayCycle=[18,16,82]，对应 Alt+R / Alt+Shift+R；没有改 NVIDIA 配置或结束其进程。
- 0.9.2 已通过一次 Ctrl+Alt+R 系统按键开启与 Esc 取消；用户认为三键组合难按，进一步改为0.9.3 Ctrl+R。
- 旧默认串在读取时映射到新默认；自定义配置和空值禁用保持原样。默认不再同时启用 Alt 别名。
- 仍复用选中阅读器的统一 dispatcher；输入框、组合输入、重复按键和文献库无活动 reader 时不触发。相关单测覆盖。
- 开发 key-watch 仅短时观察修饰键+R，不记录普通输入；已去掉不存在的 system listener API 和修改 oncommand 的实验入口，最后停止观察。

## 安装及系统按键证据

- `dist/paperloom-0.9.3-dev.xpi`：15,278,946 bytes。
- SHA256：`46b6dcf91873f55e9c88d44b8a56075f0e2dfb8059976d5283ac01c66ebd3d6f`。
- 安装文件与 dist 字节一致；运行 version=0.9.3，spec=Ctrl+R。
- `.local/093-real-first.json`：Windows 输入 Ctrl+R，宿主 trusted=true、ctrl=true、alt=false、matched=true；匹配次数0→1，左右PDF各2个可见页框选层，badge=armed。
- `.local/093-real-cancel.json`：Windows Esc 后左右框选层均为0，badge=null。
- 第二次开启尝试未捕获新的事件；观察已超时且报告时窗口不持焦点，因此 **重复开启尚未完成可靠宿主验收**，不记为通过。
- 此次未实际拖框运行 OCR，也未发起翻译请求。

## 保全与测试

- 升级前取 `.local/093-before.json` 的实时归档，update-build 自带安装前归档；未恢复旧快照。
- 最终归档 `.local/093-final.json`。
- `validation/retention-093.json`：110正文、301图表记录的 text/target/edited/history/quad 等语义字段完整保留。图表中原已有重复ID `g05a0cdcf2ed8e43b163d`，比较改用多重集而非Map，确认不是丢失/变更；本轮未去重用户数据。
- 最终110/110正文、125图表译文，paused=true、requests=0、busy=false。
- check、git diff --check、**270 JS +25 Python**通过。日志 `.local/093-tests.log`。
- 本次前置恢复通道正常关闭后超过60秒才完全退出；确认全部进程退出后备份并启动，没有强杀。备份 `.local/restart-channel-20261015-143536/`。

## 使用

点击 PDF 阅读区域后按 **Ctrl+R** 进入框选，按 **Esc** 取消。输入框内不触发。NVIDIA 原快捷键不变。

## 后续事项

- 无焦点干扰条件下完成重复开启、真实拖框验收。
- 重复图表ID的来源另行调查，禁止在快捷键修复中顺手删除记录。
- 复杂背景图表保真仍沿用既有未验收状态。
