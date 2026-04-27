# 上午踩坑复盘：后端服务、数据库与本地环境（新手向）

本文档根据本仓库在 **Windows + pnpm monorepo** 下的真实踩坑整理，帮助你建立「后端服务」和「数据库」在操作上的心智模型，并理解报错背后的原因。

---

## 一、先把概念说清楚

### 1. 后端服务（本项目的 `packages/server`）是什么？

可以把它想成一台**一直运行的程序**，做这些事：

- 监听某个 **端口**（默认 `3000`，由环境变量 `PORT` 控制）
- 收到 HTTP 请求后执行业务逻辑（登录、同步数据等）
- 需要持久化数据时，通过 **Prisma** 去连 **PostgreSQL 数据库** 读写表

**启动 ≠ 一定健康**：进程能起来，只说明「端口监听成功」；第一次访问某个接口时，如果数据库表结构不对，仍会在终端里打出数据库错误。

### 2. 数据库（PostgreSQL）是什么？和后端是什么关系？

数据库是**单独的数据存储服务**。后端代码里的 `schema.prisma` 描述的是「你希望表长什么样」；PostgreSQL 里真实存的表结构，要靠 **迁移（migration）** 同步过去。

关系可以简化为：

```text
你的代码（含 Prisma schema）
        ↓ 迁移 apply
PostgreSQL 里的真实表/列
        ↑ 运行时查询
后端 Node 进程（Express + Prisma Client）
```

如果**代码里已经有 `DiaryEntry.content` 列**，但数据库里还没加这一列，运行时就会报类似：

> `The column DiaryEntry.content does not exist`

这不是「依赖装坏了」，而是**数据库结构落后于代码**。

### 3. 本仓库里和数据库相关的三条常见命令（含义不同）

| 操作 | 作用 | 典型时机 |
|------|------|-----------|
| `pnpm dlx prisma@5.22.0 generate`（或包内 `prisma:generate`） | 根据 `schema.prisma` **生成本地 TypeScript 用的客户端代码**（含查询 API） | 首次拉代码、改了 schema、换了 Prisma 版本 |
| `pnpm … migrate deploy`（包内 `db:migrate:deploy`） | 把 `prisma/migrations` 里的 SQL **应用到当前 DATABASE_URL 指向的那台库** | 拉了新代码、别人加了迁移 |
| 启动 `pnpm run server:dev` | 起 **Node 进程**，读 `.env`，连库，监听端口 | 日常开发 |

**新手易混点**：只 `pnpm i` 不会自动帮你「建好数据库里的表」；表结构要靠迁移（或你自己在库里执行等价 SQL）。

---

## 二、本机开发时推荐的一条龙顺序（换电脑 / 刚 clone 后）

前提：已安装 **Node 20+**、**pnpm**、**Docker Desktop**（用来起本仓库自带的 Postgres）。

1. **安装依赖**（在仓库根目录）  
   `pnpm install`

2. **准备数据库**（根目录已提供脚本）  
   `pnpm run db:up`  
   会按 `packages/server/docker-compose.yml` 起一个 Postgres（用户/库名等与 compose 里一致）。

3. **配置环境变量**  
   复制并编辑 `packages/server/.env`（不要提交到 Git，一般已被 `.gitignore` 忽略）。  
   其中 **`DATABASE_URL`** 必须指向你本机连得上的 Postgres。与当前 compose 一致时，本机开发常用：

   `postgresql://timemanger:timemanger@localhost:5432/timemanger?schema=public`

4. **应用数据库迁移**  
   `pnpm run db:migrate`  
   （实际执行的是 server 包里的 `db:migrate:deploy`）

5. **构建 workspace 包**（本仓库的 `@time-manger/shared` 入口是编译后的 `dist`）  
   `pnpm run shared:build`  
   或启动 server 时，`predev` 会自动先 build shared。

6. **启动后端**  
   `pnpm run server:dev`  
   若经常遇到 **3000 端口被占用**，可用根目录脚本：  
   `pnpm run server:dev:clean`（会先尝试释放端口并选用可用端口启动，详见 `scripts/server-dev-clean.ps1`）。

---

## 三、上午各类问题的「现象 → 原因 → 对策」汇总

### 1. Expo / `expo start` 报找不到模块

- **现象**：`Cannot find module ...\node_modules\expo\bin\cli`
- **原因**：在 Windows 上，pnpm 用 **junction 绝对路径** 链到 `node_modules/.pnpm/...`。若你**移动或重命名了项目文件夹**，旧链接仍指向旧路径，就会「包在目录里但链是断的」。
- **对策**：删掉根目录与各 `packages/*/node_modules` 后，在根目录重新 `pnpm install`。

### 2. 桌面端 Vite 报 `Invalid hook call` / `useState` 为 null

- **现象**：React 报错「多份 React」或 hooks 异常。
- **原因**：同样是 **node_modules 链接/版本不一致**（例如 `react` 与 `react-dom` 来自不同解析路径），或混用 npm/pnpm 导致树不一致。
- **对策**：清 `node_modules` 后根目录 `pnpm install`；日常只用 pnpm，避免在子包单独 `npm install`。

### 3. Server 启动报「`@time-manger/shared` 没有导出 XXX」

- **现象**：ESM 运行时提示 named export 不存在。
- **原因**：`shared` 的 `package.json` 指向 **`dist/`**，若从未执行 `pnpm run shared:build`，`dist` 里没有对应导出，运行时就找不到。
- **对策**：`pnpm run shared:build`；当前 server 的 `predev` 也会在 `dev` 前自动 build shared。

### 4. Prisma：`Cannot find module '.prisma/client/default'`

- **现象**：一 import `@prisma/client` 就炸。
- **原因**：还没对当前 schema 执行 **`prisma generate`**，客户端生成物不存在。
- **对策**：在 `packages/server` 下执行包脚本 `prisma:generate`（使用 `pnpm dlx` 可避免本机 `prisma` CLI 链接损坏）。

### 5. Prisma：`EPERM rename query_engine-windows.dll.node`

- **现象**：`prisma generate` 在 Windows 上报文件重命名权限错误。
- **原因**：**旧的 node 进程**仍占用 Prisma 的引擎 DLL；每次 `dev` 前强制 generate 容易撞上文件锁。
- **对策**：关干净相关终端 / 结束占用进程后再 generate；不必每次启动都 generate（仅 schema 或 Prisma 版本变更时需要）。

### 6. `DATABASE_URL` 未定义 / Prisma P1012

- **现象**：`Environment variable not found: DATABASE_URL`。
- **原因**：Prisma CLI 读的是**进程环境变量**；本机若没有 `packages/server/.env` 或未配置该项，就会失败。  
  **注意**：`.env` 通常**不会**提交到 Git，换电脑 clone 后必须自己补。
- **对策**：从 `packages/server/.env.example` 复制为 `.env`，按上文填好 `DATABASE_URL`（与 `docker-compose.yml` 中 Postgres 账号一致即可）。

### 7. JWT 校验：`String must contain at least 32 character(s)`

- **现象**：`loadServerEnv` 抛 `Invalid server environment`。
- **原因**：`packages/server/src/config/env.ts` 里要求 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` **各至少 32 个字符**；占位符如 `<64-char-random-string>` 太短。
- **对策**：在 `.env` 里换成真实长度足够的字符串（开发可用固定长串，**生产务必用强随机**）。

### 8. 数据库列不存在：`DiaryEntry.content does not exist`（P2022）

- **现象**：服务已监听端口，但一访问同步等接口就报列不存在。
- **原因**：**迁移未应用到当前数据库**（或连错了库），Prisma 以为有 `content` 列，库里还没有。
- **对策**：确认 `DATABASE_URL` 指向的库正确，然后执行 `pnpm run db:migrate`（即 `migrate deploy`）。

### 9. `EADDRINUSE :::3000`

- **现象**：`listen EADDRINUSE`。
- **原因**：**3000 端口已被其它进程占用**（常见：上一次 `tsx watch` 没关、另一个终端也起了 server、或其它软件占用了 3000）。
- **对策**：结束占用进程后再启；或使用根目录 `pnpm run server:dev:clean`。

---

## 四、和「另一台电脑正常、这台不正常」的关系

Git 同步的是**源代码与迁移文件**，不会同步：

- 你本机的 `node_modules`、pnpm 链接状态  
- 你本机的 `.env`、数据库里的数据与表结构  
- 本机是否有 Docker、端口是否被占用  

所以换机器后，按第二节「一条龙」走一遍，能避免大部分「装完依赖仍报错」的错觉。

---

## 五、常用命令速查（根目录）

| 命令 | 用途 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm run db:up` | Docker 启动 Postgres |
| `pnpm run db:migrate` | 将迁移应用到当前库 |
| `pnpm run db:prepare` | `db:up` + 迁移 + `prisma generate`（见 `package.json`） |
| `pnpm run shared:build` | 构建 shared |
| `pnpm run server:dev` | 启动后端开发服务 |
| `pnpm run server:dev:clean` | 尽量清端口后再启（Windows 友好） |

---

## 六、延伸阅读（官方文档）

- [Prisma：连接 URL](https://www.prisma.io/docs/orm/reference/connection-urls)  
- [Prisma Migrate：deploy 与 dev 区别](https://www.prisma.io/docs/orm/prisma-migrate/workflows)  
- [pnpm：为何 symlink 对路径敏感](https://pnpm.io/faq#pnpm-does-not-work-with-your-project)

---

*文档生成自项目内实际踩坑与配置；若你升级了 Prisma / Node 版本，请以官方文档为准。*
