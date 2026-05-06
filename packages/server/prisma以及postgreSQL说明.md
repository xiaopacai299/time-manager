# Prisma

## 一、功能

画图纸上柜子该怎么摆
你在 schema.prisma 里用 model 描述「用户」「设备」「时间记录」这些抽屉长什么样（字段、类型、谁和谁有关联）。

按规定改装柜子
改图纸后，用 迁移（migration） 生成 SQL，让真实的 PostgreSQL 里的表结构跟图纸一致。

给程序发「遥控器」
运行 prisma generate 后，Node 里会出现 PrismaClient：你在代码里写 prisma.user.create(...) 这类 TypeScript 方法，它在背后翻译成 SQL 去操作数据库。

所以：Prisma = 数据模型说明书 + 表结构变更流水线 + 带类型的数据库访问客户端。

操作：1.在schema.prisma写数据库的表结构 2.migration命令，让schema.prisma中新写的表同步到PostgreSQL 中（会比对两个的差异，然后同步），然后在migrations中生成一条记录 3.这时在后端服务用Prisma 写的对应的sql语句并没有生效，然后执行generate ，才能翻译成sql语句真实操作数据库。

（所以当涉及到数据库的改动了，就要migration，generate 才能生效，如果不涉及，就不需要这些命令）

启动项目：1.在docker-desktop运行情况下，通过

```json
"db:up": "docker compose -f packages/server/docker-compose.yml up -d postgres",命令（或者prepare命令，将docker启动prisma 迁移和产生的事情都做了）
```

完成prisma 和数据库的准备工作,

在生产环境下：docker compose -f packages/server/docker-compose.yml up -d --build

## 二、使用

### 1.日常开发：模型 → 迁移 → 生成客户端

编辑 packages/server/prisma/schema.prisma
例如声明 User、TimeRecord、DiaryEntry 等，并指定：
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
表示：连的是 PostgreSQL，具体地址从环境变量 DATABASE_URL 读。

改模型后做迁移（开发机）
一般会执行类似 prisma migrate dev（名称以你们文档为准），会在 prisma/migrations/ 下生成带时间戳的 SQL，把「图纸变更」落实到数据库。

prisma generate
根据 schema.prisma 生成 @prisma/client（类型 + 查询引擎）。你们的 Dockerfile builder 里和 CI 里都有这一步。

### 2. 运行时：谁连库、谁改库？

进程启动
packages/server/src/index.ts 里 new PrismaClient()，再用 createApp(prisma, env) 把同一个客户端传给各路由。

HTTP 请求进来
各路由里直接用 prisma：例如 auth.ts 里 prisma.user.create / findUnique，mobileRest.ts、sync.ts 里对 timeRecord、diaryEntry、worklistItem 等的 findMany、create、update。
这些方法 不会魔法生效：底层仍是 发到 PostgreSQL 的 SQL，只是由 Prisma 替你拼好。

容器启动时先对齐表结构
Dockerfile 的 CMD 里先跑 prisma migrate deploy：在生产环境 只执行已有迁移，把数据库升到当前版本，再 node dist/index.js 启动 API。
这样 「改表」和「跑业务代码」 的顺序是：先迁移，再提供服务。

### 3.Docker Compose 里数据库怎么接上？

```
environment:
  NODE_ENV: production
  PORT: 3000
  DATABASE_URL: postgresql://timemanger:timemanger@postgres:5432/timemanger
```

postgres 是 compose 里数据库服务的名字，在 Docker 网络里可当主机名。
DATABASE_URL 告诉 Prisma：连到哪台 Postgres、哪个库、用什么账号。
PrismaClient 读的就是这个环境变量。

## 总结

你在 schema.prisma 定义数据形状 → 迁移把 PostgreSQL 里的表改成一致 → generate 放出带类型的客户端 → 服务启动时 migrate deploy 确保库结构最新 → new PrismaClient() 用 DATABASE_URL 连上 Postgres → 路由里的 prisma.xxx.yyy() 转成 SQL 读写真实数据。

# PostgreSQL

PostgreSQL（常简称 Postgres）是一种 关系型数据库

用 SQL 查询和修改数据；应用通过 连接串（你们 compose 里的 DATABASE_URL）连上去。
和你们 compose 里对应关系可以理解为：

起一个 postgres:16 容器 → 里面跑数据库服务。
POSTGRES_USER/PASSWORD/DB → 用户名、密码、默认数据库名。
postgres_data 卷 → 数据文件持久化在磁盘上，容器删掉数据还在。