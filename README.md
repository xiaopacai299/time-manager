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
