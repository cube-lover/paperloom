# Zotero MCP/CLI 只读连通检查

- 已安装 zotero-mcp-server 0.14.1，Pi skill：`D:/Users/Administrator/Pi-Agent/agent/skills/zotero-cli/SKILL.md`。
- 当前会话的mcp gateway只缓存8个旧server；配置已有zotero-unified，但connect返回not found。未重写MCP配置。
- 经安装环境中的MCP Python SDK，stdio initialize + list_tools成功，41工具，约1.404秒。只发现/列举，没有调用写工具。工具schema保存在mcp-tools.json。
- 当前这套41工具提供条目、附件、页面、图表bbox、注释和文献管理；没有插件eval/DOM截图/任意JS接口。
- 另一个已安装cookjohn/zotero-mcp插件1.6.0：从本机XPI检查源码，并对127.0.0.1:23120/mcp实际ping与tools/list成功；25工具，无宿主JS/插件诊断执行接口。schema保存在cookjohn-tools.json。没有修改该插件。
- 0.8.14已替换手工注入方案：开发版XPI的bootstrap自动启动固定任务CLI邮箱，普通版XPI排除开发模块与标记；`start-cube-dev-channel.js`现已停用。命令为`node scripts/cube-dev.cjs status|pause-archive|prepare-native|native-page|stop`。2小时失效，不开放端口、不接受任意code/路径。bootstrap自动启动、真实邮箱处理器status和退出清理已在模拟宿主通过；开发包尚未安装到当前Zotero，实机连通仍待验收。
- CLI搜索返回论文条目6C2YKNZ7，附件PEYPJQ62。path成功，但报告本地PDF缺失；实际对应storage目录为空。
- layout失败：本地下载路径file:// unsupported；read附件失败no_pdf_attachment。这不是正文翻译数据丢失的证据；尚未核实该CLI条目与当前reader的映射。
- 没有更改Zotero、数据库、凭据、文件同步设置，也没有移动/补造附件。
- 后续先核对当前reader的itemID/key、实际PDF路径及CLI文库范围，再解决本地读取；不要改动文库试图掩盖问题。
- 同一CLI隔离环境已有PyMuPDF1.28.2，可用于本项目外部副本检查。numpy/PIL/paddle/paddleocr/onnxruntime未在该环境找到；不要污染它安装整套视觉模型。
