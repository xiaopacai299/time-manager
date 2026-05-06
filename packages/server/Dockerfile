# 国内构建若拉不动 docker.io，可用：--build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:20-alpine

# 多阶段构建，第一阶段是builder，第二阶段是runner。
# 第一阶段完整构建环境，第二阶段重新构建

# ARG 是构建参数，可以在构建时指定，比如：
ARG NODE_IMAGE=node:20-alpine
# FROM 是构建镜像的源，AS 是构建镜像的别名，builder 是别名
FROM ${NODE_IMAGE} AS builder
# WORKDIR 是工作目录，/app 是容器内的工作目录
WORKDIR /app
# 安装 openssl，Prisma 在 Alpine 上经常依赖 OpenSSL
RUN apk add --no-cache openssl
# 安装 pnpm@9 typescript@5.7.3
RUN npm install -g pnpm@9 typescript@5.7.3
# 将配置文件和server以及shared两个项目复制到容器的/app目录下，保持一致。
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# 安装依赖，--frozen-lockfile 是冻结依赖，--ignore-scripts 是忽略脚本
RUN pnpm install --frozen-lockfile --ignore-scripts
# 将shared和server的源码复制到容器的/app/packages目录下，保持一致。

COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
# 执行package.json中的scripts，编译shared和server,生成dist目录，为后续runner阶段复制使用。
RUN cd packages/shared && tsc -p .
RUN pnpm --filter @time-manger/server exec prisma generate
RUN cd packages/server && tsc -p .

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts
# 从builder阶段拷贝产物到runner阶段（runner不产生这些内容）
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma

ENV NODE_ENV=production
# 切换到server目录
WORKDIR /app/packages/server

# 暴露3000端口
EXPOSE 3000
# 启动命令，先执行prisma migrate deploy，再执行node dist/index.js

CMD ["sh", "-c", "node ../../node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]
