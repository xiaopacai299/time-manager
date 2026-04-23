# Phase 0 — Monorepo 重组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有单包 Electron 桌面项目安全地重组为 pnpm workspace monorepo，为后续添加 `server`、`mobile`、`shared` 三个新包打好地基，且**桌面端功能零回归**。

**Architecture:** 根仓库升级为 pnpm workspace，现有 `src/`、`main/`、`electron-main.js` 等整体 `git mv` 进 `packages/desktop/`，保留 git 历史；新增三个空骨架包 `shared`（TS 库）、`server`（Node+Express 占位）、`mobile`（Expo 占位）；`shared` 能被其他包以 workspace 依赖解析；CI 跑通 install + lint + typecheck 即视为完成。

**Tech Stack:** pnpm workspaces、TypeScript 5、Express（server 最小占位）、Expo（mobile 最小占位）、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-04-23-multi-platform-sync-architecture-design.md` 第 2 节与第 8 节 Phase 0。

---

## 文件结构（Phase 0 结束后的快照）

```
time-manger/
├── .github/workflows/ci.yml                   # NEW
├── .gitignore                                 # MODIFY（补 pnpm 相关）
├── package.json                               # MODIFY（工作区根 manifest）
├── pnpm-workspace.yaml                        # NEW
├── pnpm-lock.yaml                             # NEW（pnpm install 生成）
├── tsconfig.base.json                         # NEW
├── README.md                                  # MODIFY（monorepo 总览）
├── docs/superpowers/
│   ├── specs/2026-04-23-multi-platform-sync-architecture-design.md   # 已存在
│   └── plans/2026-04-23-phase-0-monorepo-restructure.md              # 本文件
└── packages/
    ├── desktop/                               # 现有内容整体迁入
    │   ├── assets/ build/ documents/ main/ public/ scripts/ skill/ src/   # 从根 git mv 而来
    │   ├── electron-main.js                   # git mv
    │   ├── eslint.config.js                   # git mv
    │   ├── index.html                         # git mv
    │   ├── preload.cjs                        # git mv
    │   ├── vite.config.js                     # git mv
    │   ├── package.json                       # MODIFY（原 package.json，改 name）
    │   └── README.md                          # NEW（桌面端说明）
    ├── shared/                                # NEW
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                       # export { VERSION }
    │       └── index.test.ts
    ├── server/                                # NEW
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts                       # 最小 Express hello
    │       └── index.test.ts
    └── mobile/                                # NEW（Expo 最小骨架，不执行 expo init）
        ├── package.json
        ├── tsconfig.json
        ├── app.json
        └── App.tsx
```

**显式删除**：
- `client/`（空目录，现有 `client/src` `client/main` `client/assets` 等全部为 0 文件，确认是死文件夹）
- `node_modules/`（切换到 pnpm 需重建）
- `package-lock.json`（切换到 pnpm 后由 `pnpm-lock.yaml` 取代）

---

## 关键前置

- **包名**：`@time-manger/desktop`、`@time-manger/shared`、`@time-manger/server`、`@time-manger/mobile`。
- **Node 版本**：**20 LTS**（与 Electron 41 + Expo SDK 匹配）。
- **pnpm 版本**：**9.x**。
- **操作系统**：用户机器 Windows + PowerShell；命令示例使用 PowerShell 可执行的写法（多命令用 `;` 分隔，不用 `&&`）。
- **Windows 注意**：`git mv` 在 Windows 上偶尔会因文件占用失败，执行前请确认**关闭正在运行的 Electron 进程**（任务管理器 `work master.exe`）、**关闭 VS Code 里打开的相关文件**。

---

## Task 1：预检 & 清理死文件夹 `client/`

**Files:**
- Delete: `client/`（空目录）

- [ ] **Step 1：确认工作区干净**

Run:
```powershell
git status
```
Expected：`working tree clean`（若有未提交改动，**停**，先提交或 stash）。

- [ ] **Step 2：确认 `client/` 确实为空**

Run:
```powershell
Get-ChildItem client -Recurse -File | Measure-Object | Select-Object -ExpandProperty Count
```
Expected：`0`（输出数字 0）。若非 0，**停**，先备份其中文件再决定是否删除。

- [ ] **Step 3：删除 `client/` 目录**

Run:
```powershell
Remove-Item -Recurse -Force client
```

- [ ] **Step 4：验证 Node 与 pnpm 版本**

Run:
```powershell
node --version
pnpm --version
```
Expected：Node ≥ 20.0.0，pnpm ≥ 9.0.0。

- [ ] **Step 4a（若 pnpm 未安装）：安装 pnpm**

Run:
```powershell
npm install -g pnpm@9
pnpm --version
```
Expected：输出 9.x 版本号。

- [ ] **Step 5：创建并切到 Phase 0 分支**

Run:
```powershell
git checkout -b refactor/monorepo-phase-0
git status
```
Expected：`On branch refactor/monorepo-phase-0`，`working tree clean`。

- [ ] **Step 6：尝试 commit 死文件夹清理（条件执行）**

Run:
```powershell
git status
```

- 若 `git status` 显示 `deleted: client/...`：`client/` 曾被 git 追踪，执行 `git add -A; git commit -m "-删除死文件夹 client/"`
- 若 `git status` 显示 `nothing to commit, working tree clean`：说明 `client/` 在被删前就是 git 未追踪的空目录，**跳过 commit**（Task 1 在文件系统层面已完成，Task 1 的 commit 改为由计划修正自身产出）

Expected：二者之一成立即可。

---

## Task 2：移除旧依赖（切换到 pnpm）

**Files:**
- Delete（磁盘，不入 git）：`node_modules/`
- Delete（入 git）：`package-lock.json`

- [ ] **Step 1：删除旧 node_modules**

Run:
```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Test-Path node_modules
```
Expected：最后一行输出 `False`。

- [ ] **Step 2：删除 package-lock.json**

Run:
```powershell
Remove-Item -Force package-lock.json
Test-Path package-lock.json
```
Expected：最后一行输出 `False`。

- [ ] **Step 3：Commit 切换依赖管理器**

Run:
```powershell
git add -A
git commit -m "-package-lock.json 切换 pnpm"
```

---

## Task 3：创建 pnpm workspace 顶层文件

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `package.json`（重写为 workspace 根 manifest）

- [ ] **Step 1：创建 `pnpm-workspace.yaml`**

Create file `pnpm-workspace.yaml`：
```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 2：创建 `tsconfig.base.json`**

Create file `tsconfig.base.json`：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3：重写根 `package.json`**

Replace the entire content of `package.json` with：
```json
{
  "name": "time-manger-monorepo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "desktop:dev": "pnpm --filter @time-manger/desktop electron-start",
    "desktop:build": "pnpm --filter @time-manger/desktop electron-build",
    "server:dev": "pnpm --filter @time-manger/server dev",
    "shared:build": "pnpm --filter @time-manger/shared build",
    "mobile:start": "pnpm --filter @time-manger/mobile start",
    "lint": "pnpm -r --if-present run lint",
    "typecheck": "pnpm -r --if-present run typecheck",
    "test": "pnpm -r --if-present run test"
  },
  "devDependencies": {
    "typescript": "5.7.3"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.15.0"
}
```

注意：原 `package.json` 里的 `dependencies`、`devDependencies`（electron/vite/react 等）、以及 `build`（electron-builder 配置）和所有 electron 相关 `scripts` 都**不在这里**了 —— 它们将被搬到 `packages/desktop/package.json`（Task 5）。

- [ ] **Step 4：验证 yaml/json 文件可解析**

Run:
```powershell
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"
node -e "JSON.parse(require('fs').readFileSync('tsconfig.base.json','utf8')); console.log('tsconfig.base.json OK')"
```
Expected：两行 `OK`。

- [ ] **Step 5：Commit 工作区骨架**

Run:
```powershell
git add pnpm-workspace.yaml tsconfig.base.json package.json
git commit -m "+pnpm workspace 根骨架(pnpm-workspace.yaml,tsconfig.base.json,root package.json)"
```

---

## Task 4：用 `git mv` 迁移桌面端文件到 `packages/desktop/`

这一步**最危险**（Windows 上文件可能被占用），开工前再次确认：
- Electron 进程已退出（任务管理器无 `work master.exe`）
- VS Code 中没有固定打开要被移动的文件
- 资源管理器没打开被移动的目录

**Files:**
- Move（git mv）: 13 项源码/资源 → `packages/desktop/`

- [ ] **Step 1：创建 `packages/desktop/` 目录**

Run:
```powershell
New-Item -ItemType Directory -Path packages\desktop -Force | Out-Null
Test-Path packages\desktop
```
Expected：`True`。

- [ ] **Step 2：`git mv` 所有目录**

Run:
```powershell
git mv src packages/desktop/src
git mv main packages/desktop/main
git mv assets packages/desktop/assets
git mv public packages/desktop/public
git mv scripts packages/desktop/scripts
git mv skill packages/desktop/skill
git mv documents packages/desktop/documents
```

Windows 若报 "cannot move" 错误，说明文件被占用。**停**，关闭占用进程后重试当前步骤。

- [ ] **Step 3：`git mv` 所有顶层文件**

Run:
```powershell
git mv electron-main.js packages/desktop/electron-main.js
git mv preload.cjs packages/desktop/preload.cjs
git mv index.html packages/desktop/index.html
git mv vite.config.js packages/desktop/vite.config.js
git mv eslint.config.js packages/desktop/eslint.config.js
```

- [ ] **Step 4：迁移 `build/`（若存在）**

Run:
```powershell
if (Test-Path build) { git mv build packages/desktop/build }
```
注：`build/` 在 `.gitignore` 里但仓库可能保留了某些资源文件（如 icon.ico）。若 `git mv` 没报错就成功。

- [ ] **Step 5：清理根目录下已被 gitignore 的生成物（如有残留）**

Run:
```powershell
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force release -ErrorAction SilentlyContinue
```

- [ ] **Step 6：验证根目录只剩这些**

Run:
```powershell
Get-ChildItem -Name | Sort-Object
```
Expected（与下列完全一致，仅这些，不多也不少 —— `.git` 被默认隐藏所以可能不显示）：
```
.github            # 若之前创建过
.gitignore
docs
package.json
packages
pnpm-workspace.yaml
README.md
tsconfig.base.json
```

如果多出 `src`、`main`、`electron-main.js`、`dist`、`build`、`release` 等，**停**，回头完成迁移。

- [ ] **Step 7：验证 packages/desktop/ 内容**

Run:
```powershell
Get-ChildItem packages\desktop -Name | Sort-Object
```
Expected 包含：`assets`, `documents`, `electron-main.js`, `eslint.config.js`, `index.html`, `main`, `preload.cjs`, `public`, `scripts`, `skill`, `src`, `vite.config.js`（`build/` 视是否原本存在）。

- [ ] **Step 8：Commit 迁移**

Run:
```powershell
git status
git commit -m "*桌面端文件整体迁移到 packages/desktop/"
```
注意 `git mv` 已自动 stage 变更，`git commit` 直接提交即可。若 `git status` 里还有未 stage 的，运行 `git add -A` 再 commit。

---

## Task 5：创建 `packages/desktop/package.json`

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/desktop/README.md`
- Create: `packages/desktop/.gitignore`

- [ ] **Step 1：创建 `packages/desktop/package.json`**

此 JSON 是**将原根 package.json 的桌面端相关内容迁入**，再加上 typecheck/lint 脚本。

Create file `packages/desktop/package.json`：
```json
{
  "name": "@time-manger/desktop",
  "private": true,
  "version": "0.0.0",
  "main": "electron-main.js",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "test": "node --test",
    "typecheck": "echo \"(desktop is JS; no tsc typecheck)\"",
    "preview": "vite preview",
    "react-start": "vite --port 4567 --strictPort",
    "electron-start": "concurrently \"npm run react-start\" \"wait-on http://localhost:4567 && electron .\"",
    "electron-main-only": "electron .",
    "electron-start-debug": "concurrently -n WEB,ELECTRON -c blue,green \"npm run react-start\" \"wait-on http://localhost:4567 && npm run electron-main-only\"",
    "electron-start-debug-log": "concurrently \"npm run react-start\" \"wait-on http://localhost:4567 && set DEBUG_LOG=true&& electron .\"",
    "electron-build": "npm run icon:ico && vite build && node scripts/electron-build.mjs",
    "icon:ico": "node scripts/generate-icon-ico.mjs",
    "assets:run-cat": "node scripts/build-run-cat.mjs"
  },
  "dependencies": {
    "epubjs": "^0.3.93",
    "lottie-web": "^5.13.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "recharts": "^3.8.1",
    "uiohook-napi": "^1.5.5",
    "@time-manger/shared": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "concurrently": "^9.2.1",
    "electron": "^41.2.0",
    "electron-builder": "^26.8.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "png-to-ico": "^3.0.1",
    "vite": "^8.0.4",
    "wait-on": "^9.0.4"
  },
  "build": {
    "appId": "com.timemanager.pet",
    "productName": "work master",
    "directories": {
      "output": "release",
      "buildResources": "build"
    },
    "files": [
      "dist/**/*",
      "electron-main.js",
      "preload.cjs",
      "preload-favorites.cjs",
      "favorites.html",
      "main/**/*",
      "assets/**/*"
    ],
    "npmRebuild": false,
    "electronDownload": {
      "mirror": "https://npmmirror.com/mirrors/electron/"
    },
    "win": {
      "icon": "build/icon.ico",
      "signAndEditExecutable": false
    }
  }
}
```

关键改动与原根 `package.json` 对照：
- `name` 改为 `@time-manger/desktop`
- 新增 `@time-manger/shared` workspace 依赖（此时 shared 包还没建，install 会报错，所以**本任务只写 manifest 不 install**；全部 3 个新包建完后在 Task 10 统一 `pnpm install`）
- 新增 `typecheck` 脚本（占位，desktop 是纯 JS 不走 tsc）
- 其余脚本、依赖、build 配置原封照抄

- [ ] **Step 2：创建 `packages/desktop/README.md`**

Create file `packages/desktop/README.md`：
```markdown
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
```

- [ ] **Step 3：创建 `packages/desktop/.gitignore`**

Create file `packages/desktop/.gitignore`：
```
node_modules
dist
dist-ssr
release
*.local
```

- [ ] **Step 4：Commit 桌面包 manifest**

Run:
```powershell
git add packages/desktop/package.json packages/desktop/README.md packages/desktop/.gitignore
git commit -m "+packages/desktop/{package.json,README.md,.gitignore}"
```

---

## Task 6：创建 `packages/shared` 骨架

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/index.test.ts`

- [ ] **Step 1：创建 `packages/shared/package.json`**

Create file `packages/shared/package.json`：
```json
{
  "name": "@time-manger/shared",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p .",
    "build:watch": "tsc -p . --watch",
    "typecheck": "tsc -p . --noEmit",
    "lint": "echo \"(shared uses tsc for lint)\"",
    "test": "node --test --experimental-strip-types src/**/*.test.ts"
  },
  "devDependencies": {
    "typescript": "5.7.3"
  }
}
```

说明：`test` 脚本用 Node 22+ 原生的 `--experimental-strip-types` 运行 `.test.ts`。若你的 Node 版本是 20 且不支持该 flag，改用 `tsx` 运行（后续 server 包会引入 `tsx`，这里先用 Node 原生；若报错，在 Task 8 之后把 `tsx` 加到 shared 作为 dev 依赖并改脚本为 `tsx --test src/**/*.test.ts`）。

- [ ] **Step 2：创建 `packages/shared/tsconfig.json`**

Create file `packages/shared/tsconfig.json`：
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

- [ ] **Step 3：写 shared 的失败测试（先）**

Create file `packages/shared/src/index.test.ts`：
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from './index.ts';

test('shared: VERSION is a semver-like string', () => {
  assert.ok(typeof VERSION === 'string', 'VERSION should be a string');
  assert.match(VERSION, /^\d+\.\d+\.\d+$/, 'VERSION should be semver-like');
});
```

- [ ] **Step 4：确认 shared 源文件不存在**

Run:
```powershell
Test-Path packages\shared\src\index.ts
```
Expected：`False`。

- [ ] **Step 5：创建 `packages/shared/src/index.ts`**

Create file `packages/shared/src/index.ts`：
```typescript
export const VERSION = '0.0.0';
```

- [ ] **Step 6：Commit shared 骨架**

Run:
```powershell
git add packages/shared
git commit -m "+packages/shared 骨架(VERSION 导出 + 单测)"
```

---

## Task 7：创建 `packages/server` 骨架

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/.env.example`
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/index.test.ts`

- [ ] **Step 1：创建 `packages/server/package.json`**

Create file `packages/server/package.json`：
```json
{
  "name": "@time-manger/server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p .",
    "start": "node dist/index.js",
    "typecheck": "tsc -p . --noEmit",
    "lint": "echo \"(server uses tsc for lint)\"",
    "test": "tsx --test src/**/*.test.ts"
  },
  "dependencies": {
    "express": "^4.21.2",
    "@time-manger/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^20.17.10",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "5.7.3"
  }
}
```

- [ ] **Step 2：创建 `packages/server/tsconfig.json`**

Create file `packages/server/tsconfig.json`：
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

- [ ] **Step 3：创建 `packages/server/.env.example`**

Create file `packages/server/.env.example`：
```bash
NODE_ENV=development
PORT=3000
```

注：完整的环境变量清单（DATABASE_URL、JWT_* 等）在 Phase 1 再加，这里只占位最小项。

- [ ] **Step 4：写 server 的失败测试（先）**

Create file `packages/server/src/index.test.ts`：
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './index.ts';

test('GET /health returns 200 with status ok', async () => {
  const app = createApp();
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /health includes shared VERSION', async () => {
  const app = createApp();
  const res = await request(app).get('/health');
  assert.match(res.body.sharedVersion, /^\d+\.\d+\.\d+$/);
});
```

- [ ] **Step 5：创建 `packages/server/src/index.ts`**

Create file `packages/server/src/index.ts`：
```typescript
import express from 'express';
import type { Express } from 'express';
import { VERSION } from '@time-manger/shared';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sharedVersion: VERSION });
  });

  return app;
}

function main() {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp();
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port} (shared v${VERSION})`);
  });
}

const isEntry = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;
if (isEntry) {
  main();
}
```

注：`isEntry` 检查让这个文件**既能作为入口运行（`tsx src/index.ts`）又能被测试 import**（测试只拿 `createApp`，不自动监听端口）。Windows 路径反斜杠需替换。

- [ ] **Step 6：Commit server 骨架**

Run:
```powershell
git add packages/server
git commit -m "+packages/server 骨架(Express hello + /health 端点 + 测试)"
```

---

## Task 8：创建 `packages/mobile` 骨架

Phase 0 **不执行 `expo init`**（会拉大量依赖且改变 lockfile 形态）。只做最小骨架让 workspace 能识别；Phase 1 初始化 Expo 工程时再把骨架替换成真 Expo 生成的内容。

**Files:**
- Create: `packages/mobile/package.json`
- Create: `packages/mobile/tsconfig.json`
- Create: `packages/mobile/app.json`
- Create: `packages/mobile/App.tsx`
- Create: `packages/mobile/README.md`

- [ ] **Step 1：创建 `packages/mobile/package.json`**

Create file `packages/mobile/package.json`：
```json
{
  "name": "@time-manger/mobile",
  "private": true,
  "version": "0.0.0",
  "main": "App.tsx",
  "scripts": {
    "start": "echo \"(Phase 1 将执行 expo init 填充真实内容)\"",
    "typecheck": "tsc -p . --noEmit",
    "lint": "echo \"(mobile uses tsc for lint)\"",
    "test": "echo \"(Phase 1 加 jest)\""
  },
  "dependencies": {
    "@time-manger/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "5.7.3",
    "@types/react": "^19.2.14"
  }
}
```

- [ ] **Step 2：创建 `packages/mobile/tsconfig.json`**

Create file `packages/mobile/tsconfig.json`：
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["App.tsx", "src/**/*"]
}
```

- [ ] **Step 3：创建 `packages/mobile/app.json` 占位**

Create file `packages/mobile/app.json`：
```json
{
  "expo": {
    "name": "time-manger-mobile",
    "slug": "time-manger-mobile",
    "version": "0.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic"
  }
}
```

- [ ] **Step 4：创建 `packages/mobile/App.tsx` 占位**

Create file `packages/mobile/App.tsx`：
```tsx
import { VERSION } from '@time-manger/shared';

export default function App() {
  const msg = `time-manger mobile placeholder (shared v${VERSION})`;
  console.log(msg);
  return null;
}
```

注：这里没有 `react-native` 依赖，`typecheck` 能通过是因为 `return null` 不需要 JSX 运行时类型。Phase 1 执行 `npx create-expo-app` 时会**完整替换**本目录内容。

- [ ] **Step 5：创建 `packages/mobile/README.md`**

Create file `packages/mobile/README.md`：
```markdown
# @time-manger/mobile

占位骨架。Phase 1 开始时执行：

    cd packages/mobile
    npx create-expo-app@latest . --template blank-typescript

会替换本目录内容为真正的 Expo 工程。
```

- [ ] **Step 6：Commit mobile 骨架**

Run:
```powershell
git add packages/mobile
git commit -m "+packages/mobile 骨架占位(Phase 1 expo init 前)"
```

---

## Task 9：更新 `.gitignore` 与创建根 `.env.example`

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1：更新根 `.gitignore`**

Replace the entire content of `.gitignore` with：
```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Deps
node_modules/
**/node_modules/

# Build outputs
dist/
**/dist/
dist-ssr/
build/
**/build/
release/
**/release/

# TS
*.tsbuildinfo

# Env
.env
.env.local
.env.*.local
**/.env
**/.env.local
!.env.example
!**/.env.example

# Editor / OS
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Misc
*.local
```

**注意**：`build/` 被 gitignore 但原仓库 `packages/desktop/build/icon.ico` 可能需要保留。若 Task 4 Step 4 执行了 `git mv build packages/desktop/build` 并成功 commit，说明历史里已经有了，不会丢。若后续发现 `icon.ico` 被这条规则误忽略，在 `packages/desktop/.gitignore` 里加例外：
```
!build/icon.ico
```

- [ ] **Step 2：创建根 `.env.example`**

Create file `.env.example`：
```bash
# 根级 .env 用于跨包共享的默认值。各包自己的 .env 在 packages/<pkg>/.env。
# 示例：
# VITE_API_BASE=http://localhost:3000
```

- [ ] **Step 3：验证 `.gitignore` 不会把要跟踪的文件也忽略掉**

Run:
```powershell
git check-ignore packages/desktop/src/App.jsx packages/shared/src/index.ts packages/server/src/index.ts
```
Expected：**空输出**（三条路径都不被忽略）。若有任何一条被列出，**停**，修正 `.gitignore` 规则。

- [ ] **Step 4：Commit**

Run:
```powershell
git add .gitignore .env.example
git commit -m "*.gitignore 适配 monorepo + 根 .env.example"
```

---

## Task 10：Install & 首次冒烟测试

**Files:** 无新建，仅运行命令

- [ ] **Step 1：根目录 `pnpm install`**

Run：
```powershell
pnpm install
```
Expected：
- 无致命错误
- 生成 `pnpm-lock.yaml`
- 生成 `node_modules/`（pnpm 硬链接结构）
- 末尾显示 workspace 包数量 ≥ 4（desktop、shared、server、mobile）

若报错 "ELIFECYCLE" 或原生依赖（如 `uiohook-napi`）编译失败，**通常可忽略**，因为 Phase 0 不运行 Electron 原生模块实际功能，只要 install 退出码为 0 即可。若退出码非 0，查看报错。

- [ ] **Step 2：先 build shared（因为 server/desktop/mobile 都依赖它的 dist/）**

Run：
```powershell
pnpm --filter @time-manger/shared build
Test-Path packages\shared\dist\index.js
Test-Path packages\shared\dist\index.d.ts
```
Expected：两行 `True`。

- [ ] **Step 3：跑 shared 单测**

Run：
```powershell
pnpm --filter @time-manger/shared test
```
Expected：
```
# tests 1
# pass 1
# fail 0
```
（或 2 个测试视 Node 版本而定）

若失败原因是 `--experimental-strip-types` 不支持（Node 20 下会报错），编辑 `packages/shared/package.json` 的 `test` 脚本改为：
```json
"test": "tsx --test src/**/*.test.ts"
```
然后：
```powershell
pnpm --filter @time-manger/shared add -D tsx
pnpm --filter @time-manger/shared test
```

- [ ] **Step 4：跑 server 单测**

Run：
```powershell
pnpm --filter @time-manger/server test
```
Expected：2 个测试通过。若报 `Cannot find module '@time-manger/shared'`，先回到 Step 2 确认 shared dist 存在。

- [ ] **Step 5：启动 server 手工验证**

Run（开一个新终端，不阻塞后续步骤）：
```powershell
pnpm --filter @time-manger/server dev
```
Expected 控制台：`[server] listening on http://localhost:3000 (shared v0.0.0)`

另一个终端：
```powershell
Invoke-RestMethod http://localhost:3000/health
```
Expected：`status=ok`, `sharedVersion=0.0.0`。

验证完成后 `Ctrl+C` 停止 server。

- [ ] **Step 6：桌面端冒烟测试（关键回归点）**

Run：
```powershell
pnpm --filter @time-manger/desktop electron-start
```

Expected（必须全部满足才算通过 Phase 0 回归）：
1. Vite dev server 起在 `localhost:4567`
2. Electron 宠物窗口出现
3. 宠物统计/AI 对话/日记/设置等界面能点开（不用全功能测，只验证主要窗口能打开）
4. 控制台无 `Cannot find module`、`ENOENT`、`path not found` 类致命报错

若失败，**停**，检查 `electron-main.js` / `vite.config.js` / `preload.cjs` 中的相对路径；重新确认 Task 4 所有文件已迁到 `packages/desktop/` 且层级正确。

验证完成后关闭窗口退出。

- [ ] **Step 7：Commit lockfile**

Run：
```powershell
git add pnpm-lock.yaml
git status
git commit -m "+pnpm-lock.yaml"
```

若 Step 3 替换了 shared 的 test 脚本，把 `packages/shared/package.json` 也 add 进来。

---

## Task 11：GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1：创建 CI 工作流**

Create file `.github/workflows/ci.yml`：
```yaml
name: CI

on:
  push:
    branches: [main, 'refactor/**', 'feat/**']
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared package
        run: pnpm --filter @time-manger/shared build

      - name: Typecheck all packages
        run: pnpm typecheck

      - name: Lint all packages
        run: pnpm lint

      - name: Test all packages
        run: pnpm test
```

- [ ] **Step 2：本地模拟 CI 的 4 条核心命令**

Run（按 CI 顺序）：
```powershell
pnpm install --frozen-lockfile
pnpm --filter @time-manger/shared build
pnpm typecheck
pnpm lint
pnpm test
```

Expected：每条命令退出码 0。

常见问题：
- `pnpm typecheck` 失败：通常是 shared dist 还没 build 或 tsconfig 配置问题，回到 Task 6。
- `pnpm lint` 失败：可能是 desktop 的 ESLint 扫到新目录的文件。编辑 `packages/desktop/eslint.config.js`，把 `files: ['src/**/*.{js,jsx}']` 确认只作用于 desktop 内部（相对路径是相对 `packages/desktop/` 的，应该已经正确）。
- `pnpm test` 失败：Task 10 已处理过 shared/server 测试；再跑一次应该绿。

- [ ] **Step 3：Commit CI 配置**

Run：
```powershell
git add .github/workflows/ci.yml
git commit -m "+GitHub Actions CI(install+build shared+typecheck+lint+test)"
```

- [ ] **Step 4：推分支触发 CI**

Run：
```powershell
git push -u origin refactor/monorepo-phase-0
```

去 GitHub Actions 页面观察 workflow 是否通过。若失败，根据报错修正并补 commit。

---

## Task 12：更新根 `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1：重写根 `README.md`**

Replace the entire content of `README.md` with：
```markdown
# time-manger

pnpm workspace monorepo，包含桌面端、移动端、后端与共享包。

## 包清单

| 包 | 路径 | 技术栈 | 说明 |
|----|------|--------|------|
| `@time-manger/desktop` | `packages/desktop/` | Electron + React + Vite (JS) | 时间追踪桌面宠物（原 `time-manger`） |
| `@time-manger/mobile`  | `packages/mobile/`  | React Native (Expo, TS)      | 移动端（Phase 1 初始化） |
| `@time-manger/server`  | `packages/server/`  | Node + Express + Prisma (TS) | 多端数据同步后端 |
| `@time-manger/shared`  | `packages/shared/`  | TypeScript                    | 三端共享的类型、API 契约、同步算法、加密工具 |

## 前置

- Node 20+
- pnpm 9+（`npm i -g pnpm@9`）

## 快速开始

    pnpm install
    pnpm --filter @time-manger/shared build

### 桌面端开发

    pnpm desktop:dev

### 后端开发

    pnpm server:dev
    # http://localhost:3000/health

### 全仓校验

    pnpm typecheck
    pnpm lint
    pnpm test

## 文档

- 多端同步顶层架构规范：`docs/superpowers/specs/2026-04-23-multi-platform-sync-architecture-design.md`
- 实施计划：`docs/superpowers/plans/`
- 桌面端本地技术文档：`packages/desktop/documents/`

## 版本演进

- Phase 0（本次）：monorepo 重组，桌面端无回归
- Phase 1：核心同步闭环（时间追踪同步跑通）
- Phase 2：日记同步（含端到端加密）
- Phase 3：AI 对话与技能同步

各 Phase 的完成标准见架构规范第 8 节。
```

- [ ] **Step 2：Commit README**

Run：
```powershell
git add README.md
git commit -m "*README 更新为 monorepo 说明"
```

---

## Task 13：Phase 0 完成标准自检 & 最终推送

**Files:** 无改动，仅验证

- [ ] **Step 1：对照规范第 8 节 Phase 0 checklist**

对照以下 5 项完成标准逐条勾选（规范原文）：

- [ ] 根目录 `pnpm-workspace.yaml` 建立 → Task 3 Step 1
- [ ] `src/`、`main/`、`electron-main.js` 等通过 `git mv` 移入 `packages/desktop/` → Task 4
- [ ] `pnpm --filter desktop electron-start` 正常起，功能无回归 → Task 10 Step 6
- [ ] `packages/server/`、`packages/mobile/`、`packages/shared/` 空骨架建立 → Task 6/7/8
- [ ] CI `ci.yml` 跑通：install + lint + typecheck → Task 11 Step 4（GitHub Actions 绿）

5 项全绿 → Phase 0 完成。

- [ ] **Step 2：最终 `git log` 回顾**

Run：
```powershell
git log --oneline refactor/monorepo-phase-0 ^main
```

Expected 约 10-12 条 commit，每条都是小步提交。

- [ ] **Step 3：准备进入 Phase 1**

Phase 0 至此完成。接下来的建议：

1. 把 `refactor/monorepo-phase-0` 分支合并回 `main`（或提 PR 审核后合并）。
2. 开始为 Phase 1 写实施计划：用 `writing-plans` 技能，基于规范第 8 节 Phase 1，产出 `docs/superpowers/plans/2026-04-XX-phase-1-*.md`。Phase 1 可能需要**拆成 4 张子计划并行执行**（shared 类型 / server 认证 / server 同步 / desktop 接入 / mobile 初始化），由 `subagent-driven-development` 调度。

---

## 附录 A：常见失败模式 & 处理

| 症状 | 可能原因 | 处理 |
|------|----------|------|
| `git mv` 报 "Invalid path" | 路径有中文或尾部空格 | 用 quote：`git mv "src" "packages/desktop/src"` |
| `pnpm install` 卡在 uiohook-napi 编译 | Windows 需 VS Build Tools | 跳过：`pnpm install --ignore-scripts`；Phase 0 不需要该模块工作 |
| `pnpm --filter desktop electron-start` 报 `Cannot find module` | 迁移后 import 路径没失效（相对路径不变）但 node_modules 结构变了 | 删 `packages/desktop/node_modules`，根目录重 `pnpm install` |
| CI typecheck 失败 on `@time-manger/shared` | CI 没先 build shared 就 typecheck | 确认 CI yml 里 `Build shared` 步骤在 typecheck 之前 |
| ESLint 找不到 JSX 文件 | desktop 的 eslint.config.js `files` glob 相对路径变了 | 相对 `packages/desktop/` 的 `src/**/*.{js,jsx}` 本就正确，无需改 |
| Windows 下 `Remove-Item node_modules` 卡死 | 路径过长或 readonly 文件 | `Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue`；或关掉所有 node 进程后重试 |

## 附录 B：本计划严格不做

- 不引入 Turborepo / Nx（规范里是候选项，按需在后续 Phase 加入）
- 不接入 Prisma（Phase 1 做）
- 不真实初始化 Expo 工程（Phase 1 做，需要单独大任务）
- 不做 Husky / lint-staged / commitlint（按需后续加）
- 不迁移 `packages/desktop/documents/` 到根 `docs/`（按规范保留在 desktop 内部）
- 不改 `electron-main.js` 任何逻辑（只搬家不改代码）
