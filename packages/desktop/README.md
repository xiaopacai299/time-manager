# @time-manger/desktop

桌面端（Electron + React + Vite），从原 `time-manger` 根目录迁入。

## 开发

从仓库根目录：

    pnpm install
    pnpm desktop:dev

或进入本目录：

    pnpm install
    pnpm electron-start

## 打包

    pnpm desktop:build

产物：`packages/desktop/release/`（`.gitignore` 忽略）。

## 目录

- `src/` 前端（React）
- `main/` Electron 主进程业务
- `electron-main.js` 主进程入口
- `preload.cjs` 预加载
- `scripts/` 构建脚本
- `documents/` 桌面端本地技术文档（注：多端架构文档在仓库根 `docs/`）
