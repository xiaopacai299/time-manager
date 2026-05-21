# 桌面端：开发态 vs 打包态 — 常见问题与最佳实践

## 1. 为什么「本地正常、打包又坏」？

| 维度 | 开发态 (`pnpm desktop:dev`) | 打包态 (`pnpm desktop:build`) |
|------|-----------------------------|-------------------------------|
| 进程 | `electron.exe` + 源码目录 | `橘子ING.exe` + `app.asar` |
| 前端 | `http://localhost:4567`（Vite 热更新） | `dist/index.html`（须先 `vite build`） |
| 路径 | `__dirname` 指向 `packages/desktop` | `__dirname` 常在 asar 内，资源路径要兼容 |
| 应用名/任务栏 | 易显示 **Electron**（除非正确设置 AppUserModelID） | 以 `package.json` → `build.productName` 为准 |
| 图标 | 读 `build/icon.ico`（须先 `pnpm desktop:ico`） | 同左，且 NSIS 用同一套 `build/icon.ico` |
| 共享包 | 须先 `pnpm shared:build`（入口是 `dist/`） | 打包前同样要先 build shared |

**结论**：开发和打包是两套运行环境，改主进程/图标/品牌时两边都要验证，不能只看其中一种。

---

## 2. 主进程语法错误（本次 `missing ) after argument list`）

**原因**：编辑 `electron-main.js` 时删掉了外层 `try {`，却保留了 `} catch (err)`，Node 在 **加载主进程时** 就抛错，与打包无关。

**预防**（已接入脚本）：

```bash
cd packages/desktop
pnpm run main:check   # node --check 主进程相关入口
```

`pnpm electron-start` / `electron-main-only` 前会自动跑 `main:check`（`pre*` 钩子）。

**原则**：改完 `electron-main.js` 或 `main/**/*.js` 后，先 `pnpm run main:check` 再启动 Electron。

---

## 3. 品牌与任务栏（橘子ING + 橘子图标）

统一常量：`@time-manger/shared` → `APP_DISPLAY_NAME`、`APP_USER_MODEL_ID`。

| 时机 | 做什么 |
|------|--------|
| 模块加载时（`whenReady` 之前） | `init-app-branding.js`：`setAppUserModelId` + `setName`；`windows-taskbar.js` 写注册表 `FriendlyAppName` |
| 每个 `BrowserWindow` | `icon` + `applyWindowTaskbarIcon(win, image, iconPath)`：`setIcon` + `setAppDetails`（橘子 `.ico`） |
| 开发启动（Windows） | `prepare:dev-electron` 用 **rcedit** 给 `.dev-electron/electron.exe` 写入橘子图标与应用名；`pnpm desktop:dev` 自动使用，勿直接 `electron .` |

**禁止**：开发态使用 `app.setAppUserModelId(process.execPath)`（会把窗口归到 Electron）。

**开发态任务栏仍不对时**：

1. 完全退出托盘 → `pnpm desktop:ico` → `pnpm desktop:dev`（内部会跑 `prepare:dev-electron`）
2. 任务栏若仍缓存旧图标：取消固定 Electron/旧项 → 重新固定当前窗口
3. 开始菜单「橘子ING (开发)」指向的已是品牌化后的 `.dev-electron/electron.exe`
4. 安装包以 `pnpm desktop:build` 安装后验证最准确

**图标单一来源**：

1. 替换 `packages/desktop/build/icon.png`（或与官网同步 `packages/website/public/icon-source.png`）
2. 执行 `pnpm desktop:ico`（生成 `icon.ico`、同步托盘与移动端图标）
3. 再 `pnpm desktop:build`

---

## 4. 推荐日常流程

### 只改前端（React）

```bash
pnpm desktop:dev
```

### 改主进程 / preload / 图标 / 品牌

```bash
pnpm shared:build          # 若动了 @time-manger/shared
cd packages/desktop
pnpm run main:check        # 语法检查（electron-start 也会自动跑）
pnpm electron-start        # 或根目录 pnpm desktop:dev
```

### 发安装包前（必做）

```bash
pnpm shared:build
pnpm desktop:ico           # 图标有改过时
pnpm desktop:build         # icon:ico + vite build + electron-builder
# 安装 release 目录安装包，看任务栏名、图标、子窗口
```

---

## 5. 路径与 asar（打包专属坑）

- 读文件用 **多候选路径**（见 `getPetIndexHtmlPath()`），不要只写 `__dirname + '/dist'`。
- 大资源放 `build/`、`assets/`，并在 `package.json` → `build.files` 里包含。
- 改 preload 后需重新打包；开发态改完要重启 Electron 主进程（不只刷新渲染页）。

---

## 6. 建议的 CI / 提交前检查

```bash
pnpm shared:build
pnpm --filter @time-manger/desktop run main:check
pnpm --filter @time-manger/desktop run build
# 有时间再跑完整 electron-build（耗时长）
```

---

## 7. 相关文件速查

| 文件 | 作用 |
|------|------|
| `electron-main.js` | 主进程入口；`whenReady` 启动逻辑 |
| `main/init-app-branding.js` | 最早设置应用名与 AppUserModelID |
| `main/app-icons.js` | 解析 `.ico` / `nativeImage`、任务栏 `setIcon` |
| `main/electron/menu-module.js` | 托盘图标与 tooltip |
| `scripts/generate-icon-ico.mjs` | `icon.png` → `icon.ico` + 多端同步 |
| `package.json` → `build` | `productName`、`icon`、asar 文件列表 |
