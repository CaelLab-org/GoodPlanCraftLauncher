# GoodPlanCraftLauncher

轻量、开源的 Minecraft 启动器，Windows 桌面端，基于 Electron + TypeScript。

[![Version](https://img.shields.io/badge/version-1.5.1-blue.svg)](https://github.com/CaelLab-org/GoodPlanCraftLauncher/releases)
[![License](https://img.shields.io/badge/license-CaelLab%20BY--SA%203-green.svg)](LICENSE)

官网：<https://gamets.caellab.com/gpcl/>

## 功能

- **版本管理**：下载、安装、切换各版本的正式版 / 快照 / Beta / Alpha，依赖库与资源文件自动处理
- **模组加载器**：Forge、Fabric、OptiFine 一键安装，支持 `inheritsFrom` 版本继承
- **登录**：离线登录与微软正版登录，可随时切换
- **崩溃处理**：游戏异常退出时说明原因，一键导出错误报告（崩溃报告 + 日志 + 系统信息，token 已打码）
- **运行中面板**：游戏启动后右侧显示版本、PID、时长、内存与实时日志，可随时结束游戏
- **自定义窗口标题**：支持 `{mc_version}`、`{time}` 等魔术字，详见[说明页](https://gamets.caellab.com/gpcl/docs/magic-words/)
- 深色 / 浅色主题、启动动画、最多 128 线程并发下载

## 下载

到 [Releases](https://github.com/CaelLab-org/GoodPlanCraftLauncher/releases) 下载 `GPCL-<版本>-Setup.exe`，或从官网下载。

- 最新版本：**v1.5.1**（2026-10-16）
- 系统要求：Windows 10 64 位及以上
- 磁盘占用：安装后约 360 MB（不含 Minecraft 游戏本体与各版本文件）
- Java 运行时：启动器会按游戏版本自动补齐对应版本，无需手动装

安装包可直接覆盖旧版升级，游戏与设置在 `%APPDATA%\gpcl`，升级和卸载都不会动它。

## 从源码构建

需要 Node.js 18+；打安装包还需要 [Inno Setup 6.5+](https://jrsoftware.org/isdl.php)。

```bash
npm install
npm run build-ts     # 编译 TS + 复制静态资源到 dist/
npm start            # 开发态启动
npm run build-prod   # 出安装包 → release/GPCL-<版本>-Setup.exe 与 GPCL.sha1
```

发版时 `package.json`、`package-lock.json`、`version.txt`、`webpage/index.html`、`webpage/data.json` 都要同步版本号。

## 文档

- [游戏崩溃了怎么办](https://gamets.caellab.com/gpcl/docs/mc-game/)：导出错误报告、看日志、常见崩溃原因
- [魔术字（替换标记）](https://gamets.caellab.com/gpcl/docs/magic-words/)：窗口标题里能用的占位符

## 反馈

- 论坛：<https://forum.xmuer.online/>
- 邮箱：[gamets@caellab.com](mailto:gamets@caellab.com)
- 代码问题：[提交 Issue](https://github.com/CaelLab-org/GoodPlanCraftLauncher/issues)

改代码前建议先开 Issue 讨论一下，避免重复劳动；提交 PR 前请确保本地能跑通 `npm run build-ts`。

## 开源许可证

本项目采用 **CaelLab BY-SA Code License, Version 3**（或任何更新版本）授权。这是一份面向代码、网站与数字作品的简短 Copyleft 许可，强调署名（BY）与衍生作品持续开源（ShareAlike）：

- **自由使用**：允许复制、修改、分发，个人、商业、非商业均可
- **署名（BY）**：分发时必须保留原始版权声明与许可全文，标注作者与作品名称；通过网络分发还需链接许可原文
- **相同方式共享（SA）**：修改版必须以本许可证（或更新版本）发布，不得附加额外限制或技术保护措施
- **提供源码**：分发编译产物（安装包等）时，必须同时以本许可证提供该版本对应的完整源码
- **专利授权**：贡献者授予使用者专利许可，并附带专利报复条款
- **商标保留**：不得用 "CaelLab" 名称为本项目的修改版背书或推广

完整条款见 [LICENSE](LICENSE)，权威原文在 [caellab.com/license/cbs-v3.txt](https://www.caellab.com/license/cbs-v3.txt)。

Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
项目主页：<https://gamets.caellab.com/gpcl/>

> **版本说明**：本项目在 v1.4.4 及更早版本发布时采用的是该许可证的 Version 1.0，此后至本次更新前采用 Version 2.0。按当时版本获得副本的使用者，其权利仍适用获得时对应的版本；自此之后发布的版本适用 Version 3 或任何更新版本。

## 常见问题

**Q：提示 Java 未找到怎么办？**
A：启动器会按版本自动补全。若失败，检查网络或在「设置 → 下载」里换个 Java 镜像源。

**Q：支持非 Windows 平台吗？**
A：目前只有 Windows 10 / 11 64 位。是否支持 macOS 或 Linux 要看后续需求和精力。

**Q：怎么切换离线模式和正版模式？**
A：在启动界面直接切换，不用重启启动器。

**Q：游戏崩溃了，怎么让别人帮我？**
A：用崩溃弹窗里的「导出错误报告」，把生成的压缩包发出去。**别只发截图** —— 截图里没有日志。细节见[帮助页](https://gamets.caellab.com/gpcl/docs/mc-game/)。

## 作者

- Yunyun（云云）
- 虚舟实验室（CaelLab）/ CaelLabGameTS
- 以及所有提 Issue、提 PR 的社区开发者与玩家

## 免责声明

GoodPlanCraftLauncher 是第三方开源工具，与 Mojang Studios、Microsoft、Xbox 无任何官方关联。Minecraft 为 Mojang Studios 注册商标，使用本启动器需持有有效的 Minecraft 正版授权。
