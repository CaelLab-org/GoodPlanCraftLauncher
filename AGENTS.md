# GoodPlanCraftLauncher (GPCL)

Minecraft 启动器 + 官网。桌面端是 **Electron + TypeScript**，官网是 `webpage/` 下的纯静态页。
通用约定（视觉风格、服务器、SSH、语言）看全局 `~/.zcode/AGENTS.md`，这里只写本项目特有的。

## 结构

| 路径 | 是什么 |
|---|---|
| `src/main.ts` | Electron 主进程（约 4000 行）：IPC、版本下载、Java 运行时、Forge/Fabric/OptiFine、自动更新、正版登录 |
| `src/preload.ts` | contextBridge，向界面暴露 `window.gpcl` |
| `src/renderer/renderer.ts` | 启动器界面逻辑（esbuild 打成单文件 IIFE） |
| `renderer/` | 界面静态资源：`index.html`、`splash.html`、`style.css`、`logo.png`、`skin/`、`js/chart.umd.js` |
| `static/icon`、`static/more` | 品牌图标与头像 |
| `webpage/` | **官网**（纯静态，线上在 `gamets.caellab.com/gpcl/`） |
| `installer/gpcl.iss` + `scripts/build-installer.mjs` | Inno Setup 安装包 |
| `build.js` | esbuild 编译 TS → `dist/`，复制静态资源，写精简 `dist/package.json` |

## 命令

```bash
npm run build-ts     # 只编译 TS + 复制静态资源到 dist/（几秒）
npm start            # build-ts 之后起 Electron（开发态）
npm run pack         # build-ts + electron-builder --win --dir → release/win-unpacked
npm run installer    # 用已有载荷打 Inno 安装包（约 100 秒）
npm run build-prod   # = pack + installer → release/GPCL-<版本>-Setup.exe + GPCL.sha1
npm run dist:nsis    # 旧的 electron-builder NSIS 包，留作对照，不再是发布路径
```

发版只走 `npm run build-prod`。

## 改版本号要改这几处

`package.json`、`package-lock.json`（2 处）、`version.txt`、`webpage/index.html`（导航按钮、hero 元信息、下载卡片的文件名与 href、更新日期、版本历史里**新增**一条）、`webpage/data.json`（新增一条在最前）。

版本号在程序里是从 `dist/package.json` 读的（`APP_VERSION = require('./package.json').version`），**不要在 TS 里写死**。

## 发版流程

1. `npm run build-prod` → 得到 `release/GPCL-<版本>-Setup.exe` 和 `release/GPCL.sha1`。
2. 传这些文件（缺一个就出事）：

   | 远端路径 | 文件 |
   |---|---|
   | `/www/wwwroot/dl.caellab.com/file/games/gpcl/` | `GPCL-<版本>-Setup.exe`、`GPCL.sha1` |
   | `/www/wwwroot/gamets.caellab.com/gpcl/` | `index.html`、`style.css`、`data.json` |

3. **顺序**：先传安装包和 sha1，**最后**传 `data.json`。反过来的话，正在跑的旧版会检测到新版本、点更新却下载 404。
4. 官网文件按「先资源后模板」：`style.css` 先落地，引用它的 `index.html` 最后传。
5. 传完报「远端 sha256 与本地一致 + `curl -skI <地址>` 回 200」。

### 命名契约

`GPCL-<版本>-Setup.exe` 这个格式**写在程序里**（`main.ts` 里拼下载地址、本地缓存文件名、清理旧包共 3 处），服务器上、官网上、`data.json` 里必须逐字一致。要改名就得同步改这几处。

## Inno Setup

- 版本号由 `scripts/build-installer.mjs` 从 `package.json` 用 `/DAppVersion=` 注入，`.iss` 里**没写死**，别手工同步两处。
- 载荷是 `release/win-unpacked`（`electron-builder --dir` 的产物），Inno 用 `lzma2/max` 整块压缩。
- 本机需装 Inno Setup 6.5+：认标准安装路径，也可以用 `ISCC` 环境变量给路径（本机在 `C:\Program Files (x86)\Inno Setup 6\`）。
- `[Code]` 里有一段**从旧 NSIS 安装就地接管**的逻辑，靠 electron-builder 由 appId 推出的 GUID：
  `3ba2ea27-c03b-5187-9f73-05821ec8353b` = `UUID.v5("com.caellab.gamets.gpcl", "50e065bc-3134-11e6-9bab-38c9862bdaf3")`。
  **改 `appId` 会让接管失效**（老用户会多出一份并存安装）。
- 用户的游戏和设置都在 `%APPDATA%\gpcl`；配置里 `deleteAppDataOnUninstall: false`，所以 `.iss` 里**故意没有** `[UninstallDelete]` —— 升级和卸载都不碰那份数据。
- 中文界面用仓库自带的 `installer/lang/ChineseSimplified.isl`（来自 kira-96 的 Inno 简中翻译），不依赖本机装了哪些语言文件。
- 编译时 Inno 会打一行 `Non-commercial use only`：虚舟是非营利项目，那是提示不是错误。

## 硬规则 / 踩过的坑

- **别在代码里写死外部资源的具体版本号**。2026-10-16 之前 Java 运行时下载整体失效，就是因为写死了清华镜像的四个文件名，镜像同步后全部 404。现在改成从 Adoptium API 取当前文件名再拼镜像地址，并以清华为主源、GitHub 兜底。
- **引用 CSS 变量前确认它真有定义**。`--button-secondary-bg`、`--border-color`、`--accent-color` 都曾被引用但从未定义，浏览器会把整条声明丢掉（表现为按钮没边框、hover 无效），不报错、极难发现。改完扫一遍 `var(--x)` 是否都有 `--x:` 定义。
- **浅色模式的类名是 `body.light-mode`**（`renderer.ts` 里加的）。历史上有一批 `body.light-theme` 的死规则（启动界面因此一直不跟随主题），写新规则别跟着抄错。
- `renderer/` 里的路径是相对 `dist/renderer/` 的：引用 `static/` 下的东西要写 `../static/...`。`build.js` 只把 `renderer/*` 和 `static/{icon,more}` 复制进 `dist/`，**根目录的 `icon.ico` 不会**被复制。
- `webpage/` 在 `.gitignore` 里，但文件已被 git 跟踪 —— 改动照常能提交，**新增**文件会被静默忽略。
- 官网头尾引用的 `/logo.png`、`/index/gpcl.first.png` 不在仓库里，由 `gamets.caellab.com` 站点根目录提供，别删也别改路径。
- 「删除版本」这类红色是语义色（危险操作），换主题配色时别一起改掉。
- 改 `renderer/style.css` 的 `:root` 就能整体换色（3000 多行里已有 400 处 `var()`），不用逐条改。
