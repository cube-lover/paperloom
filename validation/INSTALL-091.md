# 0.9.1 安装与本地宿主自检

日期：2026-10-15。**已安装运行，开发通道已开启**。优先级高于 DEVELOPMENT-091.md 的“尚未安装”历史记录。

## 恢复与安装

- 用户要求本地命令操作，不开“执行 JavaScript”代码框；未使用该窗口。
- 原通道两小时有效期已过，`session.json` 不存在。正常关闭 Zotero PID21696，等待退出并备份，使用原 profile 重新启动 PID7792；未强制终止进程，未新增桥接插件。
- 旧版本重启后自动恢复通道、110/110 正文、281 图表行/121 已译；先 pause-archive 再用 `node scripts/cube-dev.cjs update-build` 安装。
- 独立备份：`.local/restart-channel-20261015-112107/`，含退出后 sessions/graphics/recovery、旧 XPI 和其他插件 hash 清单。
- 当前开发包：`dist/paperloom-0.9.1-dev.xpi`，15,278,110 bytes。
- 当前安装 SHA256：`4a0dbf3516d1328bc3ccf309bf7d78449fbdca7d5f7746b69dfebe3f6889bef5`，安装 XPI 与 dist 字节一致。
- 同版本开发包增加了固定 `selftest-interaction` 动作和绑定诊断；不是通用 eval。保留原开发包 nativePython override，没有迁移服务配置。

## 自检结果与边界

1. OCR：真实本地 Python 自检识别 `Figure 8 Power` / `Grid`，约4.67秒，两个置信度0.98964 / 0.99997；没有发送翻译 provider 请求。
2. 菜单：宿主 DOM 使用独立 fixture reader/session/file，真实菜单 callback 连续清除两轮；正文回 pending 并重新入队；两版人工目标与校订历史写入 checkpoint。测试临时文件删除，用户论文没有执行 clear。
3. 队列：宿主排队两个独立 fixture 工作，首个等待时第二个留队；结束后自动顺序运行，保留两批结果。识别回调使用 fixture，所以这证明调度，不代表两次实际 OCR/翻译已经完成。
4. 快捷键：toolbar、primary PDF、secondary PDF、main 四个入口均调用正常快捷键处理函数，每次仅触发一次，左右 PDF 各产生一个框选层；之后移除框选层及临时测试监听。
5. **快捷键测试是合成输入，不是物理按键验收**。Gecko chrome callback 默认不接收 PDF 子文档 untrusted event，且跨 realm KeyboardEvent 初始化字典需要 cloneInto。测试在 PDF 子文档临时注册 wantUntrusted forwarding，生产监听配置不变。初始探针漏触发是这两处探针偏差，不作为真实键盘故障结论。
6. 原 keyset-fire 只查外层 reader 文档，`overlay:false` 不表示 PDF iframe 无覆盖；最终自检按两个 PDF 子文档检查。
7. 圆点：合成 pointerdown/click 展开，外部 pointerdown 关闭通过。未完成真实鼠标拖框与复杂图表像素保真验收。

最终报告 `.local/091-selftest-final2.json`，passed=true；早期失败记录保留在 `.local/091-selftest-first/second/third/final.json`，分别含路径组装、fixture页号/文档缺失、跨 realm/合成事件投递问题，不覆写为通过。

## 保全与回归

- `.local/091-final-archive.json` 指向最终归档。
- `validation/retention-091-final.json`：原110段正文 text/target/edited/alignment无变动；原281条图表 text/target/edited/approved/history/quad无变动。
- 其他 XPI 文件 hash 全部不变。
- 最终状态：0.9.1、110/110正文、图表121已译/281行（192可译）、11/11页已检查、paused=true、requests=0、busy=false。
- 本轮最终再次运行 check + **268 JS +25 Python 全过**；日志 `.local/091-host-check-final.log`、`.local/091-host-tests-final.log`。
- 开发通道有效期仍为启动起两小时；过期时按正常重启或插件生命周期重新启动，不写入假 session.json。

## 本地命令

```text
node scripts/cube-dev.cjs status
node scripts/cube-dev.cjs pause-archive
node scripts/cube-dev.cjs ocr-selftest
node scripts/cube-dev.cjs selftest-interaction 521
node scripts/cube-dev.cjs update-build
```

selftest-interaction要求论文会话已暂停且空闲。update-build前必须重新构建，并保留实时归档。

## 仍待完成

- 真实键盘 Alt+R / Ctrl+Alt+R、真实连续拖框、分离阅读器窗口。
- 图内小字 OCR、复杂彩色/曲线背景掩膜保真、历史相交与纵轴分片。
- 自检期间重启恢复阅读位置曾回到第一页，旧版本的阅读位置恢复另行追踪。
- 本轮启动过正常进程重启以恢复0.9.0通道，但0.9.1本身只有插件更新生命周期验收，尚未再做进程重启验收。
