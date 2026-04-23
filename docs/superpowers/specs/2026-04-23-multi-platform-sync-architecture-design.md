# 多端数据同步顶层架构设计

- 日期：2026-04-23
- 范围：仅产出**顶层架构规范**（目录结构 + 数据模型 + 同步协议 + 认证 + API 契约 + 部署 + 测试策略 + 路线图）。后端、移动端、桌面端改造三个子系统各自的实施细节在后续单独立规范。
- 状态：待实施（Phase 0 起）

---

## 0. 背景与目标

现有 `time-manger` 是 Electron + React + Vite 的桌面宠物/时间管理应用，用户数据本地落盘。需要：

1. 新增 **Node.js 后端** 用于桌面端与移动端之间同步用户数据。
2. 新增 **React Native 移动端** 作为第二客户端。
3. 将三端**集成在同一仓库**（monorepo），目录清晰、便于管理。

面向场景：**普通用户发布**（需要完整账号体系、安全性、限流）。

## 1. 已锁定的关键决策

| # | 决策 | 选项 |
|---|------|------|
| 1 | brainstorming 范围 | 仅顶层架构（单一 spec，后续子系统各自 spec） |
| 2 | 用户规模 | 面向普通用户发布（C） |
| 3 | 移动端技术栈 | React Native（A），用 Expo 开发、保留 prebuild |
| 4 | Phase 1 同步数据 | 时间追踪 + 日记 + AI 对话 + AI 技能，分阶段推进 |
| 5 | 同步策略 | 离线优先 + 定期拉取/推送（A） |
| 6 | 后端技术栈 | Node.js + Express + Prisma + PostgreSQL |
| 7 | 组织方式 | pnpm workspaces 单仓 monorepo |
| 8 | TypeScript 策略 | 新增的 server/mobile/shared 用 TS，桌面端保持 JS |
| 9 | 同步冲突策略 | Last-Write-Wins + 增量同步 |

---

## 2. Monorepo 目录结构

将现有 `time-manger` 仓库升级为 pnpm workspace monorepo，结构如下：

```
time-manger/                               # 仓库根（保持现有 git 仓库，不新建）
├── package.json                           # workspace 根，只声明 workspaces + devDeps (eslint/prettier/tsc)
├── pnpm-workspace.yaml                    # workspaces 清单
├── tsconfig.base.json                     # TS 共享配置（供 server/mobile/shared 继承）
├── .gitignore / .env.example / README.md
│
├── packages/
│   ├── desktop/                           # 现有 Electron 桌面端（从根目录整体移入）
│   │   ├── src/                           # ← 原 src/
│   │   ├── main/                          # ← 原 main/
│   │   ├── electron-main.js               # ← 原文件
│   │   ├── preload.cjs                    # ← 原文件
│   │   ├── scripts/                       # ← 原 scripts/
│   │   ├── assets/ public/ documents/ skill/
│   │   ├── vite.config.js
│   │   └── package.json                   # 保留 desktop 自己的依赖与 electron-start/build 脚本
│   │
│   ├── mobile/                            # 新建：React Native 移动端（Expo）
│   │   ├── src/
│   │   │   ├── screens/                   # 页面（日记、AI 对话、时间统计等）
│   │   │   ├── components/                # 原生 UI 组件
│   │   │   ├── navigation/                # React Navigation 配置
│   │   │   ├── hooks/                     # RN 特定 hooks
│   │   │   ├── storage/                   # LocalStore.mobile.ts（expo-sqlite）+ secureStorage
│   │   │   ├── sync/                      # SyncProvider.tsx
│   │   │   └── App.tsx
│   │   ├── ios/ android/                  # 原生工程（prebuild 后生成）
│   │   ├── app.json                       # Expo 配置
│   │   ├── eas.json                       # EAS Build profile
│   │   ├── metro.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── server/                            # 新建：Node + Express 后端
│   │   ├── src/
│   │   │   ├── routes/                    # /auth, /sync/:resource
│   │   │   ├── middleware/                # auth(JWT)、rateLimit、errorHandler、requestLogger
│   │   │   ├── services/                  # 业务逻辑（与路由解耦）
│   │   │   ├── db/
│   │   │   ├── lib/                       # hashPassword、token、validator 等纯工具
│   │   │   ├── config/                    # 环境变量读取与 zod 校验
│   │   │   └── index.ts                   # 入口
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── tests/                         # 集成测试
│   │   ├── deploy/                        # docker-compose.prod、nginx、backup.sh
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml             # 仅本地开发
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── shared/                            # 新建：三端共享的纯逻辑 + 类型
│       ├── src/
│       │   ├── types/                     # User / DiaryEntry / TimeRecord / AiMessage / SyncEnvelope
│       │   ├── api-contract/              # 各资源的 zod schema
│       │   ├── crypto/                    # 日记端到端加密工具（桌面/移动共用）
│       │   ├── sync/                      # LWW 合并算法、SyncEngine（纯函数）
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json                   # name: "@time-manger/shared"
│
├── docs/
│   └── superpowers/specs/                 # 本规范及后续规范
│
└── tools/                                 # 可选：代码生成、部署脚本等
```

### 2.1 关键约定

1. **现有仓库不拆仓**，原有 `src/`、`main/`、`electron-main.js` 等整体 `git mv` 到 `packages/desktop/`，保留 git 历史。
2. **shared 包是 TS 源码**，通过 pnpm workspace 软链被 desktop（JS）消费；shared 预构建输出 `dist/` + `.d.ts`，桌面端运行时直接消费 JS，编译期可选消费类型。
3. **只有一个根 `node_modules`**（pnpm 符号链接），不会产生旧的 `client/` 那样看似重复的目录。
4. **现有 `documents/` 保留在 `packages/desktop/documents/`**（属于桌面端本地资料），新的架构/同步文档统一放根 `docs/`。

---

## 3. 数据模型 & 数据库 Schema

### 3.1 核心原则

1. 所有业务表必带 4 个公共字段：`id`（UUID）、`userId`、`updatedAt`、`deletedAt`（软删），是 LWW 的基础。
2. **`updatedAt` 由客户端生成并写入**，服务端**不使用 Prisma `@updatedAt` 自动覆盖**（否则会破坏 LWW 语义：客户端的时间戳不能被服务端改写）。
3. 日记内容服务端**只存密文**（端到端加密）。
4. 时间追踪是**单向流**：桌面端产生，移动端只读；不需要双向合并。
5. AI 对话按"会话"粒度同步，不按单条消息同步。
6. **LWW 的时间戳比较精度**：毫秒级；若两端 `updatedAt` 完全相等则保留服务端已有记录（`>` 才接受，`=` rejected），避免两端时钟一致时产生抖动。

### 3.2 Prisma Schema（`packages/server/prisma/schema.prisma`）

```prisma
// ========== 账号体系 ==========
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  emailVerifiedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  devices         Device[]
  timeRecords     TimeRecord[]
  diaries         DiaryEntry[]
  aiConversations AiConversation[]
  aiSkills        AiSkill[]
}

model Device {
  id          String   @id                         // 客户端生成的 UUID，不用 @default
  userId      String
  platform    String                               // "desktop" | "ios" | "android"
  name        String
  lastSyncAt  DateTime?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// ========== 业务表（遵循公共字段约定） ==========

// 注：以下所有业务表的 updatedAt 都是 **普通 DateTime**，不加 @updatedAt，
// 由客户端写入、服务端 upsert 时照抄，这是 LWW 必须。

model TimeRecord {
  id             String    @id                     // 客户端生成 UUID
  userId         String
  date           String                             // "2026-04-23"
  appKey         String
  appName        String
  durationMs     Int
  updatedAt      DateTime                           // 客户端时间戳
  deletedAt      DateTime?
  clientDeviceId String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, appKey])
  @@index([userId, updatedAt])
}

model DiaryEntry {
  id             String    @id                     // 客户端生成 UUID
  userId         String
  date           String
  titleCipher    String
  contentCipher  String    @db.Text
  nonce          String
  schemaVersion  Int       @default(1)
  updatedAt      DateTime                           // 客户端时间戳
  deletedAt      DateTime?
  clientDeviceId String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, updatedAt])
}

model AiConversation {
  id             String    @id                     // 客户端生成 UUID
  userId         String
  title          String
  pet            String?
  skillId        String?
  messagesJson   String    @db.Text
  updatedAt      DateTime                           // 客户端时间戳
  deletedAt      DateTime?
  clientDeviceId String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, updatedAt])
}

model AiSkill {
  id             String    @id                     // 客户端生成 UUID
  userId         String
  name           String
  promptTemplate String    @db.Text
  configJson     String    @db.Text
  updatedAt      DateTime                           // 客户端时间戳
  deletedAt      DateTime?
  clientDeviceId String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, updatedAt])
}
```

### 3.3 公共类型（`packages/shared/src/types/sync.ts`）

```typescript
export interface SyncableRecord {
  id: string;
  updatedAt: string;      // ISO string
  deletedAt: string | null;
  clientDeviceId: string;
}

export type TimeRecord = SyncableRecord & {
  date: string;
  appKey: string;
  appName: string;
  durationMs: number;
};

export type DiaryEntry = SyncableRecord & {
  date: string;
  titleCipher: string;
  contentCipher: string;
  nonce: string;
  schemaVersion: number;
};
// AiConversation / AiSkill 同理
```

### 3.4 本地库（端侧）

- **桌面端**：继续用现有本地存储（JSON 文件落盘），新增一张"待同步变更队列"（离线时的变更缓冲）。
- **移动端**：`expo-sqlite`，表结构对齐服务端。
- 两端都维护 `lastSyncAt`（按资源），同步时作为增量起点。

### 3.5 设计权衡

| 决策 | 理由 |
|------|------|
| 时间记录按"日×应用"聚合上传，不传明细 | 明细数据量大且无实际价值 |
| AI 对话整包同步，不拆单条消息 | 单用户场景简单可靠 |
| 日记服务端只存密文 | 服务器被攻破日记也不泄露 |
| 只用 `updatedAt`，不加 `version` | LWW 用时间戳即可 |
| 软删 `deletedAt` | 否则下次同步会把删除的记录"复活" |

---

## 4. 同步协议 & API 契约

### 4.1 同步端点（统一形态）

所有业务资源只有两个端点，内部用泛型 handler 实现。

| 端点 | 方法 | 作用 |
|------|------|------|
| `GET  /api/v1/sync/:resource?since=<ISO>&limit=200&cursor=<id>` | 拉取 | 返回 `updatedAt > since` 的记录（**严格大于**，避免重复拉取边界记录），支持游标分页。不传 `since` 等价于首次全量拉取 |
| `POST /api/v1/sync/:resource` | 推送 | 上传本地变更，服务端做 LWW 合并并返回确认结果 |

`:resource ∈ { time-records, diaries, ai-conversations, ai-skills }`

**Pull 响应**：

```json
{
  "resource": "diaries",
  "serverTime": "2026-04-23T10:00:00.123Z",
  "records": [ /* ... */ ],
  "hasMore": false,
  "nextCursor": null
}
```

客户端**使用 `serverTime` 作为下次 `since`**，避免客户端时钟漂移。

**Push 请求**：

```json
{
  "resource": "diaries",
  "deviceId": "uuid-of-this-device",
  "records": [ /* 本地变更过、未同步的记录 */ ]
}
```

**Push 响应**：

```json
{
  "resource": "diaries",
  "serverTime": "2026-04-23T10:00:01.456Z",
  "accepted": [ { "id": "...", "updatedAt": "..." } ],
  "rejected": [ { "id": "...", "reason": "stale" } ]
}
```

Rejected 的记录，客户端下次 pull 时强制重读用服务端版本覆盖本地。

### 4.2 LWW 合并算法（`shared/src/sync/lww.ts`，三端共用）

**服务端（处理每条 push）**：

```
对每条 incoming:
  existing = db.findById(incoming.id)
  if not existing:
    insert(incoming) → accepted
  elif incoming.updatedAt > existing.updatedAt:
    update(incoming)  → accepted
  else:
    → rejected { reason: "stale" }
```

**客户端（pull 合并到本地库）**：

```
对每条 remote:
  local = localDb.findById(remote.id)
  if not local or remote.updatedAt > local.updatedAt:
    upsert(remote)
```

### 4.3 认证 API

基于 **JWT access + refresh 双 token** 方案。

| 端点 | 说明 |
|------|------|
| `POST /api/v1/auth/register` | 邮箱 + 密码；密码用 argon2 哈希 |
| `POST /api/v1/auth/login` | 返回 `{ accessToken (15min), refreshToken (30d), user }`；响应不返回 deviceId（由客户端自持） |
| `POST /api/v1/auth/refresh` | 用 refreshToken 换新 accessToken |
| `POST /api/v1/auth/logout` | 作废当前 refreshToken |
| `GET  /api/v1/auth/me` | 当前用户信息 |

**设备标识约定**：
- 客户端**本地首次运行**时生成一个 UUID 作为 `deviceId`，持久化（桌面 safeStorage / 移动 SecureStore）。同一设备永远复用这个 ID。
- 每次请求（含登录、同步）带 `X-Device-Id: <uuid>` 头。
- 服务端在登录成功后 `upsert` 到 `Device` 表：**`Device.id = 客户端提供的 deviceId`**（因此 `Device.id` 不用 `@default(uuid())` 自动生成；移除 Prisma schema 中的 `@default(uuid())`）。
- 业务表的 `clientDeviceId` 字段始终等于当时请求的 `X-Device-Id`，用于 LWW 审计与"这条记录来自哪台设备"展示。

### 4.4 API 契约：zod 作为唯一事实来源

`packages/shared/src/api-contract/` 下每资源一个文件：

```typescript
// shared/src/api-contract/diary.ts
import { z } from 'zod';

export const DiaryEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  titleCipher: z.string(),
  contentCipher: z.string(),
  nonce: z.string(),
  schemaVersion: z.number().int().default(1),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  clientDeviceId: z.string().uuid(),
});

export const PushDiariesBody = z.object({
  deviceId: z.string().uuid(),
  records: z.array(DiaryEntrySchema).max(500),
});

export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;
```

### 4.5 错误响应规范

```json
{
  "error": {
    "code": "VALIDATION_FAILED" | "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL",
    "message": "human readable",
    "details": { /* ... */ }
  }
}
```

错误码与 HTTP 状态码对应：

| code | HTTP | 用途 |
|------|------|------|
| `VALIDATION_FAILED` | 400 | zod 校验失败 |
| `UNAUTHORIZED`      | 401 | 未登录 / token 无效或过期 |
| `FORBIDDEN`         | 403 | 已登录但无权操作 |
| `CONFLICT`          | 409 | 邮箱已注册等唯一性冲突 |
| `RATE_LIMITED`      | 429 | 超过限流阈值 |
| `INTERNAL`          | 500 | 未预期错误（日志里带完整栈） |

### 4.6 限流（`express-rate-limit`）

- 认证端点：登录/注册 **5 次 / IP / 分钟**
- 同步端点：**60 次 / user / 分钟**（pull + push 合计）
- 全局 fallback：**600 次 / IP / 分钟**

### 4.7 协议设计权衡

| 决策 | 理由 |
|------|------|
| REST + zod，不用 GraphQL / tRPC | 调试直观；tRPC 在 JS 桌面端体验欠佳 |
| 时间追踪走同一组 `/sync/time-records`，无专用端点 | 协议统一、服务端代码更少 |
| Phase 1 不做 OAuth | YAGNI |
| Phase 1 不做邮箱强验证、不做找回密码 | 跑通核心闭环优先 |
| 不做 WebSocket 实时推送 | 第 5 题已定离线优先 |

---

## 5. 端侧集成策略

### 5.1 通用同步引擎（`shared/src/sync/`，两端共用）

不依赖平台 API，通过注入适配器工作：

```typescript
interface LocalStore {
  getLastSyncAt(resource: string): Promise<string | null>;
  setLastSyncAt(resource: string, serverTime: string): Promise<void>;
  getDirtyRecords<T>(resource: string): Promise<T[]>;
  upsertRemote<T>(resource: string, records: T[]): Promise<void>;
  markClean(resource: string, ids: string[]): Promise<void>;
}

interface ApiClient {
  pull(resource: string, since: string | null, cursor: string | null): Promise<PullResponse>;
  push(resource: string, records: unknown[]): Promise<PushResponse>;
}

export class SyncEngine {
  constructor(private store: LocalStore, private api: ApiClient, private deviceId: string) {}

  async syncResource(resource: string): Promise<SyncResult>;
  async syncAll(): Promise<void>;
}
```

两端各自实现 `LocalStore`（桌面 JSON、移动 SQLite），`SyncEngine` 100% 共享。

### 5.2 同步触发时机

| 时机 | 桌面端 | 移动端 |
|------|--------|--------|
| 应用启动完成后 | ✅ 立即 `syncAll()` | ✅ 立即 `syncAll()` |
| 前台 ↔ 后台切换（切到前台） | ✅ 距上次 > 2 分钟则触发 | ✅ 同左 |
| 定时 | ✅ 每 5 分钟（应用活跃时） | ✅ 每 5 分钟（前台时） |
| 数据写入后（防抖） | ✅ 30s 内合并一次 push | ✅ 同左 |
| 手动"立即同步" | ✅ 设置页按钮 | ✅ 同左 |
| 退出应用前 | ✅ best-effort push | — |

失败处理：只更新 UI 状态（"上次同步于 / 同步失败"），本地数据不受影响，下次触发时重试。不做指数退避循环。

### 5.3 日记端到端加密

**密钥体系**：

```
用户日记密码（只在客户端内存）
        ↓ Argon2id KDF（deterministic salt = hash("diary-v1" || userEmail)）
masterKey（32 字节，不存储任何地方）
        ↓ HKDF（info = "diary-encryption-key")
diaryKey（AES-256-GCM 用）
```

> 盐说明：这里用的是**可复现盐**（deterministic salt），目的是让用户在任何设备输入同一个日记密码都能派生出同样的 masterKey。可复现盐比真随机盐弱于"防彩虹表"，故此 **Argon2id 参数必须调高**（推荐 memoryCost ≥ 64 MiB、timeCost ≥ 3、parallelism ≥ 1）。这块细节**留到 Phase 2 前单独的"日记加密 spec"进一步审阅与锁定参数**。

关键点：
1. `masterKey` 只在用户输入日记密码后临时派生，**任何地方都不落盘**。
2. 用户换设备登录后，首次打开日记页要求输入日记密码。
3. 服务器连日记密码的哈希都不存——它完全独立于账号密码。

**每条日记的加密结构**：

```typescript
{
  id: "...",
  titleCipher: base64(AES-GCM(plainTitle, diaryKey, nonce)),
  contentCipher: base64(AES-GCM(plainContent, diaryKey, nonce)),
  nonce: base64(randomBytes(12)),
  schemaVersion: 1,
}
```

**忘记日记密码**：无法恢复（端到端加密的必然代价）。UI 必须明确提示，设置中提供"清空云端日记"退路。Phase 1 接受此痛点；recovery phrase 方案延后。

**实现位置**：`packages/shared/src/crypto/diary.ts`，两端 import 同一份实现。依赖 **Web Crypto API**（桌面原生支持；React Native 用 `react-native-quick-crypto` polyfill）。

### 5.4 桌面端接入（尽量最小侵入）

**新增层（不动现有代码）**：

```
packages/desktop/src/
├── ...（原有文件不变）
└── sync/                              ← 新增
    ├── LocalStore.desktop.js
    ├── ApiClient.js
    ├── authStore.js
    ├── SyncProvider.jsx
    └── useSyncStatus.js
```

**已知改动点清单**：

| 文件 | 改动 | 理由 |
|------|------|------|
| `src/App.jsx` / `main.jsx` | 包 `<SyncProvider>` | 全局同步状态 |
| `src/SettingsWindowApp.jsx` | 新增"账号 / 同步"分区 | 登录 / 登出 / 手动同步 / 日记密码 |
| `src/DiaryWindowApp.jsx` | 接入 masterKey 加解密 | 日记变加密流 |
| 本地存储层 | 写入时打 dirty 标记 | 触发后续 push |
| `electron-main.js` | token 存 `safeStorage`（DPAPI/Keychain） | 避免明文 token |

**明确不动**：现有 UI 交互、宠物逻辑、时间追踪采集。

**老用户升级**：
- 未登录：应用照常工作，所有功能本地运行（现状）
- 首次登录：本地所有现有数据打 deviceId + 当前时间戳，一次性 push 作为"初始快照"
- 多设备对接：后登录的设备 pull 下来

### 5.5 移动端（Expo）

用 Expo 开发、保留 `expo prebuild` 能力（可完全掌控原生工程）。

**目录骨架**：

```
packages/mobile/src/
├── App.tsx
├── navigation/RootNavigator.tsx
├── screens/
│   ├── LoginScreen.tsx
│   ├── HomeScreen.tsx                 # 今日时间统计（只读）
│   ├── DiaryListScreen.tsx / DiaryEditorScreen.tsx
│   ├── AiChatListScreen.tsx / AiChatScreen.tsx
│   └── SettingsScreen.tsx
├── components/
├── hooks/
├── storage/
│   ├── LocalStore.mobile.ts           # expo-sqlite
│   └── secureStorage.ts               # expo-secure-store
├── api/
└── sync/SyncProvider.tsx
```

### 5.6 端侧集成权衡

| 决策 | 理由 |
|------|------|
| SyncEngine 在 shared，LocalStore 端侧各自实现 | 核心逻辑只写一次，不会走样 |
| 桌面端不大改，新增 sync 层旁挂 | 保留现有功能稳定性 |
| 登录非强制 | 不破坏现有体验 |
| 日记密码与账号密码分离 | 端到端加密的正确做法 |
| 移动端用 Expo | 起步快、保留 prebuild 扩展性 |
| 移动端 Phase 1 不做后台同步 | 省电、简化权限 |
| 不实现"忘记日记密码" | 端到端加密不可恢复，后续可加 recovery phrase |

---

## 6. 部署、环境与 CI/CD

### 6.1 后端部署：单机 VPS + Docker Compose

```
VPS（2c4g）
  ├── Nginx（HTTPS 终止，certbot 自动续证；80 → 443；HSTS）
  ├── Node 后端容器
  ├── PostgreSQL 容器（数据卷挂到宿主）
  └── 自动备份脚本（pg_dump 每天 → 对象存储）
```

**不用 Serverless**：Prisma 冷启动慢、计费模型不匹配、长连接/上传麻烦、调试复杂度高。

**升级路径**：后续若用户量增大，再切托管 Postgres / K8s。

**目录**：

```
packages/server/
├── Dockerfile                     # 多阶段构建：Node 20 alpine
├── docker-compose.yml             # 本地开发
├── deploy/
│   ├── docker-compose.prod.yml
│   ├── nginx/time-manger.conf
│   └── backup.sh
└── .env.example
```

### 6.2 桌面端打包

沿用现有 `electron-builder`，保留你当前的 `electron-build` 脚本。Phase 1 **不做 auto-update**，手动发版。

### 6.3 移动端打包（Expo EAS Build）

```
packages/mobile/
├── eas.json                       # development / preview / production
└── app.json
```

Phase 1 仅出 **preview** 版（Android APK + iOS TestFlight 内测），上架延到 Phase 2。

### 6.4 环境变量规范

所有敏感/环境相关配置走 `.env`，启动时用 zod 硬校验，缺失即拒绝启动。

**后端 `.env`**：

```bash
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://user:pass@localhost:5432/timemanger

JWT_ACCESS_SECRET=<64 位随机>
JWT_REFRESH_SECRET=<64 位随机，与 access 不同>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

SMTP_HOST= / SMTP_PORT= / SMTP_USER= / SMTP_PASS=
MAIL_FROM=no-reply@yourdomain.com

RATE_LIMIT_AUTH=5
RATE_LIMIT_SYNC=60

ALLOWED_ORIGINS=https://yourdomain.com
# 注：Electron 与 React Native 客户端不走浏览器的 CORS 校验（它们用的是 HTTP 客户端直连），
# 所以 ALLOWED_ORIGINS 只需要列 Web 场景的源。未来若加 Web 版再扩展。
```

**桌面端**：打包时注入 `VITE_API_BASE`，开发读 `.env.development`。
**移动端**：`eas.json` 每 profile 注入 `API_BASE`。

### 6.5 CI/CD（GitHub Actions）

根目录 `.github/workflows/`：

| 工作流 | 触发 | 作用 |
|--------|------|------|
| `ci.yml` | push / PR | pnpm install → lint → typecheck → 所有包的测试 |
| `release-server.yml` | tag `server-v*` | 构建 Docker → 推 GHCR → SSH 到 VPS 拉镜像重启 |
| `release-desktop.yml` | tag `desktop-v*` | electron-builder 打 Win/Mac 包 → GitHub Releases |

移动端用 **EAS Build**，不走 GitHub Actions。

### 6.6 本地开发工作流

```bash
pnpm dev
# 相当于 concurrently 起：
#   pnpm --filter server dev   (tsx watch + prisma)
#   pnpm --filter shared build:watch
#   pnpm --filter desktop electron-start
# 移动端需物理机/模拟器，单独起：
#   pnpm --filter mobile start
```

本地 Postgres 用 `packages/server/docker-compose.yml` 起；迁移 `pnpm --filter server prisma migrate dev`。

### 6.7 密钥管理 & 安全基线

| 项 | 做法 |
|----|------|
| 生产环境密钥 | VPS 的 `.env`（chmod 600 + 用户隔离），**绝不入 git** |
| GitHub Actions 密钥 | Repository Secrets（部署 SSH key、EAS token） |
| 客户端 token | 桌面 Electron `safeStorage`；移动 `expo-secure-store` |
| 日记 masterKey | **永不持久化**，每次从密码派生 |
| Postgres 备份 | 每日 pg_dump + gzip + 上传对象存储，保留 30 天 |
| HTTPS | Nginx 80 → 443 强制跳转；启用 HSTS |
| 依赖安全 | CI 跑 `pnpm audit --prod`，关键漏洞阻断 |

### 6.8 域名（先规划，Phase 1 不全做）

- `api.yourdomain.com` → 后端 API
- `www.yourdomain.com` / 落地页（Phase 2+）
- 邮件域名配 SPF/DKIM/DMARC（否则进垃圾箱）

Phase 1 用 VPS IP + 自购域名即可，邮件配置延到准备"找回密码"前再搞。

---

## 7. 测试策略

### 7.1 分层责任

| 层 | 工具 | 覆盖对象 | 目标 |
|----|------|----------|------|
| 单元测试 | `node --test` + `tsx` | `shared/` 纯函数（LWW、加密、schema） | 90%+ 覆盖 |
| 集成测试 | `node --test` + supertest + 测试库 Postgres | `server/` 路由与 services | 覆盖鉴权、push/pull、限流、错误码 |
| 端到端测试 | Playwright（桌面）/ Detox（移动，Phase 2+） | 关键用户流程 | Phase 1 仅登录 + 同步主链路 |
| 手动回归 | — | 桌面现有功能 | 每次发版前走清单 |

### 7.2 必须写的测试用例

**LWW 算法**：
- 新增记录 → accepted
- 相同 id + 时间更晚 → accepted 并覆盖
- 相同 id + 时间更早或相等 → rejected with `stale`
- `deletedAt` 已设置的记录仍参与 LWW

**同步协议**：
- pull 未认证返回 401
- pull 以 `since` 过滤，只返回之后更新的记录
- pull 分页：`limit=2`，第三条在第二页
- push 批量 500+ 条拒绝（校验上限）
- push 一半成功一半 stale，返回分段结果

**认证**：
- 同邮箱注册第二次返回 409
- 密码错登录返回 401，不暴露用户是否存在
- refresh token 过期返回 401
- 登录速率超限返回 429

**日记加密（shared）**：
- encrypt → decrypt 往返一致
- 不同 nonce 同明文生成不同密文
- 错误 key 解密返回 `null`
- 空字符串/超长文本边界

### 7.3 Phase 1 明确不做

- 性能基准测试
- 移动端 E2E（Detox）
- 视觉回归测试

---

## 8. 分阶段路线图

每个 Phase 有明确的完成标准——达到就能交付、不达到不推进。

### Phase 0：重组 monorepo（约 0.5 天）

- [ ] 根目录 `pnpm-workspace.yaml` 建立
- [ ] `src/`、`main/`、`electron-main.js` 等通过 `git mv` 移入 `packages/desktop/`
- [ ] `pnpm --filter desktop electron-start` 正常起，功能无回归
- [ ] `packages/server/`、`packages/mobile/`、`packages/shared/` 空骨架建立
- [ ] CI `ci.yml` 跑通：install + lint + typecheck

**意义**：最低风险地"搬家"，不加新功能。

### Phase 1：核心同步闭环（约 1.5–2 周）

**范围**：桌面端的**时间追踪**能同步到后端，移动端能登录查看今日统计。

- [ ] `shared`：类型、API schema、LWW 算法、SyncEngine 骨架，单测通过
- [ ] `server`：
  - [ ] Prisma schema + migrations，本地 Postgres 跑通
  - [ ] `/auth/register /login /refresh /me` 全通
  - [ ] `/sync/time-records` pull + push 全通
  - [ ] 集成测试覆盖
  - [ ] Docker 镜像能构建
- [ ] `desktop`：
  - [ ] 设置页"账号"分区：注册 / 登录 / 登出
  - [ ] 时间追踪数据产生后自动 push，启动时 pull
  - [ ] "同步状态指示" UI
- [ ] `mobile`：
  - [ ] Expo 工程启动，**Android 模拟器能跑**（开发机为 Windows，iOS 端在有 Mac 或 EAS Build 时再验证；最迟 Phase 1 发版前在 EAS Build 上出一个 iOS preview）
  - [ ] 登录 → 首页显示今日统计（只读）
  - [ ] 手动"立即同步"按钮
- [ ] VPS 实际部署一套（HTTPS），三端连它跑通一次端到端

**交付**：在桌面端累积的使用时间能在手机上看到。

### Phase 2：日记同步（含 E2E 加密）（约 1 周）

- [ ] `shared/crypto/diary.ts` + 完整单测
- [ ] `/sync/diaries` 端点（服务端只存密文）
- [ ] 桌面端日记加密接入（打开日记前要求日记密码）
- [ ] 移动端日记列表 + 编辑器 + 同样的派生与加解密
- [ ] 设置页"清空云端日记"

### Phase 3：AI 对话 & 技能同步（约 1 周）

- [ ] `/sync/ai-conversations` + `/sync/ai-skills`
- [ ] 桌面端 dirty 标记接入
- [ ] 移动端 AI 对话列表 + 对话页面
- [ ] 集成测试

### Phase 4+（候选，不在本次范围）

- 设置 / 收藏同步
- 邮箱验证 & 找回密码
- OAuth 登录
- 桌面端 auto-update
- 移动端推送通知
- WebSocket 实时同步（如有强需求）
- 应用商店上架

每个未来阶段启动前要**重新 brainstorm 自己的 spec**。

---

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 桌面端"搬家"导致现有功能回归 | 中 | 高 | Phase 0 只做 `git mv` + 路径修正，搬完手工回归 |
| shared 包被 JS 桌面端消费类型不生效 | 中 | 中 | shared 产出 `.d.ts`；desktop `jsconfig.json` 可选开启 checkJs |
| 日记加密方案误设计导致数据永久丢失 | 低 | 极高 | Phase 2 前先单独写加密 spec + 审阅；用 Web Crypto 不自造 |
| 后端上线没用户 / 被刷 | 中 | 中 | 限流 + 邀请制（Phase 1 先不开放自由注册） |
| Monorepo 本地开发变慢 | 低 | 低 | 必要时引入 Turborepo 缓存 |
| 未来想拆仓库发现耦合太深 | 低 | 中 | shared 严格只暴露类型和纯函数，随时可拆 |
| 客户端时钟漂移导致 LWW 判错 | 低 | 中 | 单用户多设备场景漂移通常 ≤ 秒级；推送失败（stale）时客户端用服务端返回的 `serverTime` 做一次 `clockSkew` 校准并重试；**不解决**真的被用户调时钟回拨的恶意/极端情况（Phase 1 接受） |

## 10. 成功指标

本架构落地后应能回答"是"：

1. 新加一个资源（例如"收藏"）只需：shared 加 schema → server 加 route → 两端接入 → 完整能同步。**无任何 SyncEngine / Auth / CI 改动**。
2. 桌面端登录新设备后，能在 30 秒内看到另一端的最新数据。
3. 服务器数据库泄露，日记明文不会泄露。
4. 所有三端共用的业务规则（同步合并、加密、校验）**只有一份实现**（在 shared）。

---

## 11. 下一步

本规范是**顶层架构 spec**。实施按路线图推进，每个 Phase 各自立"实施计划"（plan）。

- 紧接下来：为 **Phase 0（monorepo 重组）** 用 `writing-plans` 技能写一份实施计划。
- Phase 1 前：再写 Phase 1 的实施计划（可能拆分为 shared / server / desktop / mobile 四张子计划并行执行）。
- Phase 2 前：单独写一份"日记端到端加密方案"的子 spec（加密细节独立审阅），再出实施计划。
