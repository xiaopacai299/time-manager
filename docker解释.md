# Docker 相关说明（Dockerfile 与 docker-compose）

本文整理自项目内对 `packages/server/Dockerfile` 与 `packages/server/docker-compose.yml` 的说明，便于以后查阅。

---

## 一、`Dockerfile` 是干什么的？（通俗版）

把它想成 **「给服务器做一份外卖套餐的说明书」**。Docker 按这份说明书做出一份 **一模一样的运行环境**，别人拿到这份套餐，不用在你电脑上装 Node、配数据库，也能跑起来。

### 一句话

**先把代码「炒熟」（编译），再装进一个「小饭盒」（镜像），最后规定「开盖先做什么、再启动程序」。**

### 为什么要分两段？（`builder` 和 `runner`）

想象做外卖：

1. **厨房阶段（builder）**  
   洗菜、切菜、下锅炒——对应：装依赖、编译 TypeScript、生成 Prisma（连数据库用的工具代码）。  
   这个阶段 **很乱、工具很多**，但顾客不需要看到厨房。

2. **打包阶段（runner）**  
   只把 **炒好的菜** 装进饭盒，厨房里的菜刀、多余调料不带——对应：只复制编译好的 `dist`、必要的 Prisma 文件，依赖也只装「线上运行要用的」。  
   这样 **饭盒更小、更安全、启动也快一点**。

所以：**第一段负责「做」；第二段负责「带出去卖（跑）」。**

### 各块用大白话怎么说

| 内容 | 意思 |
|------|------|
| `FROM node:20-alpine` 等 | 用一台已经装好 Node 20 的 Linux 小系统当底子（Alpine 是比较精简的那种）。 |
| `ARG NODE_IMAGE` | 基础镜像可换；国内拉不动 `docker.io` 时可换镜像源。 |
| `pnpm install` | 按清单（lock）装依赖；先只复制 `package.json` 再装，是为了改业务代码时不必每次都重新下几百 MB 依赖。 |
| `tsc` | 把 TypeScript 编成 JavaScript（`dist`），服务器跑的是编译后的 JS。 |
| `prisma generate` | 根据数据库结构描述生成「怎么连库、怎么查表」的代码。 |
| `COPY --from=builder ...` | 从「厨房」镜像里把做好的产物夹到「饭盒」镜像里，不是整坨厨房搬过去。 |
| `CMD ... migrate deploy && node dist/index.js` | 容器一启动：**先**把数据库结构迁到最新，**再**启动 Node；`&&` 表示迁移失败就不启动服务。 |
| `EXPOSE 3000` | 声明容器内监听 3000；真正映射到宿主机是 compose 里做的。 |

### 和本机开发的关系

- 本机：`pnpm run server:dev` → 直接跑源码、热更新。  
- 服务器：`docker compose up` → Docker 读 Dockerfile，做出「能在线上跑」的环境。

### 三句浓缩

1. Dockerfile = 做镜像的菜谱。  
2. 前两段 = 先在后厨编译好，再只把成品装进小饭盒。  
3. 启动时 = 先给数据库「对表」，再启动 Node 服务。

---

## 二、`Dockerfile` 技术说明（对照代码）

文件路径：`packages/server/Dockerfile`。

### 整体：多阶段构建

- **第一段 `FROM ... AS builder`**：安装依赖、编译 `shared`、执行 `prisma generate`、编译 `server`。  
- **第二段 `FROM ... AS runner`**：只装生产依赖，从 builder **拷贝** `dist`、`prisma` 目录以及生成好的 Prisma Client 相关路径，最终镜像更小。

### `builder` 阶段要点

- `pnpm install --frozen-lockfile --ignore-scripts`：与 lockfile 严格一致；跳过 postinstall 减少容器内意外。  
- 先 COPY 各包 `package.json` 再 install，再 COPY 完整源码，利于 **Docker 层缓存**。  
- `cd packages/shared && tsc` → 产出 `packages/shared/dist`。  
- `pnpm --filter @time-manger/server exec prisma generate` → 生成 Client。  
- `cd packages/server && tsc` → 产出 `packages/server/dist`。

### `runner` 阶段要点

- `pnpm install --prod`：只要运行依赖。  
- `COPY --from=builder`：把编译产物和 Prisma 需要的内容拷进来；其中对 `@prisma/client` / `.prisma` 的长路径拷贝，是为了在 pnpm 结构下 **不必在 runner 里再跑一遍 `prisma generate`**。  
- `WORKDIR /app/packages/server` + `node dist/index.js`：从 server 目录启动编译后的入口。  
- `CMD` 里先 `prisma migrate deploy` 再启动服务：保证数据库结构与代码里的迁移一致。

---

## 三、`docker-compose.yml` 是干什么的？（通俗版）

把它想成 **「一次启动一整套服务」的清单**：要起几个盒子（容器）、每个盒子里跑什么、怎么连、端口怎么开、数据存哪。

当前文件里有两个服务：

### 1. `postgres`（数据库）

- 用镜像 `postgres:16`，相当于装一个现成的 PostgreSQL。  
- `environment`：用户名、密码、库名（演示常用；生产建议强密码）。  
- `ports: "5432:5432"`：把数据库端口映射到宿主机，方便本机工具连库（生产可按安全需求收紧）。  
- `volumes: postgres_data`：数据放在 Docker 卷里，**容器删掉重建，数据还在**。

### 2. `server`（你的 Node 后端）

- `build.context: ../..` + `dockerfile: packages/server/Dockerfile`：用 **整个 monorepo 根目录** 当构建上下文（因为 Dockerfile 要 COPY shared、server 等），菜谱是那份 Dockerfile。  
- `depends_on`：先起 postgres，再起 server（只保证启动顺序，不保证数据库已完全 ready；迁移在容器 CMD 里处理）。  
- `environment`：  
  - `PORT: 3000`  
  - `DATABASE_URL` 里的主机名 **`postgres`** 就是上面数据库服务的名字，在 Docker 内部网络里当「主机名」用。  
  - `JWT_*` 用 `${...}` 从宿主机环境或 `.env` 注入，避免密钥写死在 yml 里。  
- `ports: "3000:3000"`：对外暴露 API 端口。

---

## 四、两者之间的关系（一句话 + 比喻）

- **Dockerfile**：只负责 **「怎么做 server 这一个镜像」**（编译、依赖、启动命令）。  
- **docker-compose.yml**：负责 **「整套怎么一起跑」**（数据库 + 后端 + 网络 + 端口 + 卷 + 环境变量）。

**比喻**

- Dockerfile = 一道菜的 **菜谱**（专门教你怎么做「后端」这道菜）。  
- docker-compose.yml = **一桌套餐的点菜单**（汤 + 主菜谁先上、怎么摆、客人从哪个门进——端口与网络）。

**配合顺序（简化）**

1. 执行 `docker compose up`，读 `docker-compose.yml`。  
2. 发现 `server` 需要 `build`，按 `Dockerfile` **构建 server 镜像**。  
3. 启动 `postgres` 容器。  
4. 启动 `server` 容器，注入 `DATABASE_URL` 等。  
5. server 容器执行 Dockerfile 的 `CMD`：**迁移 → 启动 Node**。  
6. 通过宿主机 **3000** 访问 API；容器之间用服务名 **`postgres`** 连数据库。

---

## 五、和本机开发的对照

| 场景 | 方式 |
|------|------|
| 本机开发 | `pnpm run server:dev`：直接跑源码、热更新。 |
| 线上 / 服务器 | `docker compose`：按 compose + Dockerfile 起 **postgres + server**，环境一致、易部署。 |

部署时注意：`DATABASE_URL` 里的库名、用户、密码要与 `postgres` 服务里 `environment` 配置 **一致**（或按你实际修改后的值一致）。
