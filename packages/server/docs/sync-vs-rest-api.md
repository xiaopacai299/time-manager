# 同步接口（Sync API）与 REST 接口（Mobile REST）对比说明

本文说明当前服务端并存的两套 HTTP 能力：**增量同步协议**（桌面端等使用）与 **面向资源的 REST API**（移动端当前使用）。二者读写的是**同一套 PostgreSQL 数据**，差别主要在**协议形态、客户端职责与适用场景**。

---

## 1. 一览对比

| 维度 | 同步接口 Sync API | REST 接口 Mobile REST |
|------|-------------------|------------------------|
| **路由前缀** | `/api/v1/sync/:resource` | `/api/v1/diaries`、`/worklist-items`、`/time-records` 等 |
| **设计目标** | 多端离线/增量合并、批量上传下载 | 在线客户端按需 CRUD、列表一次读全 |
| **读（拉取）** | `GET`，按 `since` + `cursor` **分页增量**，只返回 `updatedAt > since` 的变更 | `GET`，返回当前用户下**未删除记录的全量列表**（日记、清单）；时间记录按 `date` 过滤 |
| **写（提交）** | `POST`，body 为 `{ deviceId, records: [...] }`，**批量** upsert，服务端 **LWW（最后写入胜出）** | `POST` / `PATCH` / `DELETE`，**单资源**创建、部分更新、软删除 |
| **删除语义** | 同步 payload 中带 `deletedAt`  tombstone，与其它字段一并 push | `DELETE` 路由将对应行 **软删除**（写 `deletedAt`） |
| **客户端状态** | 需维护本地水位（last sync）、脏数据队列、合并策略（见 `@time-manger/shared` 的 SyncEngine） | 无需同步水位；每次操作后可再 `GET` 刷新列表即可 |
| **鉴权** | 均需 `Authorization: Bearer` + `X-Device-Id`（UUID） | 相同 |
| **限流** | Sync 路由有独立 `RATE_LIMIT_SYNC` | 走全局 `/api` 限流 |
| **当前典型使用者** | **桌面端** Electron 客户端（`SyncEngine` + LocalStore） | **移动端** Expo/React Native（纯 HTTP + 内存状态） |

---

## 2. 同步接口（Sync API）在做什么

### 2.1 资源名（`resource`）

路径中的 `:resource` 为下列之一：

- `time-records`
- `diaries`
- `worklist-items`
- `memo-items`
- `work-year-digests`

每种资源对应 Prisma 中的一张表及共享包里的 **Payload / Zod Schema**（如 `PushDiariesBodySchema`）。

### 2.2 拉取 `GET /api/v1/sync/:resource`

查询参数（见共享包 `SyncPullQuerySchema`）：

- **`since`**（可选）：ISO 时间；服务端只返回 **`updatedAt` 严格大于** 该时间的行（首次可为空，等价从纪元起拉）。
- **`cursor`**（可选）：分页游标；与 `since` 组合翻页，避免一次返回过多行。
- **`limit`**：默认 200，最大 200。

响应包含：`records`、`hasMore`、`nextCursor`、`serverTime` 等，用于客户端做**增量合并**与推进本地水位。

### 2.3 推送 `POST /api/v1/sync/:resource`

Body 形如：

```json
{
  "deviceId": "<与 X-Device-Id 一致>",
  "records": [ { ...完整 Payload... }, ... ]
```

每条记录需带齐 Schema 要求字段（含 `id`、`updatedAt`、`clientDeviceId` 等）。服务端对每条做 **LWW 冲突判断**（`lwwServerPush`），接受则 upsert，拒绝则进入 `rejected`（如 `stale`）。

**特点**：一次可推多条；适合桌面端本地 SQLite 与云端对齐。

---

## 3. REST 接口（Mobile REST）在做什么

实现位置：`src/routes/mobileRest.ts`，在 `createApp` 中与 Sync 路由**同时挂载**。

### 3.1 设计取向

- **无「同步会话」概念**：没有 `since` / `cursor` / 批量 push 信封。
- **读**：日记、工作清单的 `GET` 返回**当前用户、未软删**的全表列表（排序固定）；时间记录用 **`GET /api/v1/time-records?date=YYYY-MM-DD`**。
- **写**：
  - 新建只提交业务字段（如日记 `date` + `content`），`id` / `clientDeviceId` 等由服务端生成或从请求头取。
  - 更新用 `PATCH`，删除用 `DELETE`（软删除），符合常见 **RESTful** 习惯。

### 3.2 与 Sync 的数据一致性

- 底层仍是 **同一 Prisma 模型**（如 `DiaryEntry`、`WorklistItem`、`TimeRecord`）。
- 在桌面端通过 Sync **写入**的数据，移动端用 REST **GET** 能读到；反之亦然。
- 若两端同时改同一行，仍适用数据库内存储的 **`updatedAt` 与业务规则**；REST 路径下 conflict 表达为单次请求失败或覆盖策略由具体 `PATCH` 实现决定（当前为直接更新该行）。

### 3.3 路由清单（节选）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/diaries` | 日记列表 |
| POST | `/api/v1/diaries` | 新建日记 |
| PATCH | `/api/v1/diaries/:id` | 更新日记 |
| DELETE | `/api/v1/diaries/:id` | 软删除 |
| GET | `/api/v1/worklist-items` | 工作清单列表 |
| POST / PATCH / DELETE | `/api/v1/worklist-items` … | 清单 CRUD |
| GET | `/api/v1/time-records?date=` | 某日时间记录 |

详细字段校验见 `mobileRest.ts` 内 Zod Schema。

---

## 4. 为什么要两套并存

- **桌面端**需要长期离线、增量同步、多资源顺序同步，**Sync API** 更合适。
- **移动端**产品路径改为「在线、以服务端为准、每次请求拿最新列表」，用 **REST** 实现简单、调试直观，且避免在手机上维护完整 Sync 状态机。

新增功能时：

- 若只服务 **移动端**，优先在 **REST** 上扩展（新路由 + Prisma）。
- 若 **桌面也要**一致行为，需同时考虑在 **Sync** 里是否新增 resource 或沿用同一表通过两种入口写入。

---

## 5. 小结

| 问 | 答 |
|----|-----|
| REST 是否替代了 Sync？ | **没有**。Sync 仍在，供桌面等客户端使用。 |
| 数据是不是两套库？ | **不是**。同一数据库；区别在 **HTTP 协议与客户端用法**。 |
| 移动端为何不用 Sync？ | 当前架构选择为 **纯 REST**，避免增量同步与本地缓存带来的复杂度与「部分数据」类问题。 |
| 如何选端口 / 调试？ | 后端默认 **HTTP API** 使用环境变量 `PORT`（常见 3000）；勿与 Expo Metro（常见 8081）混淆。 |

---

*文档版本随 `mobileRest.ts` 与 `sync.ts` 实现更新；修改路由时请同步本文。*
