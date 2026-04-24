FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --filter @time-manger/server... --ignore-scripts

COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/

RUN pnpm --filter @time-manger/shared build
RUN pnpm --filter @time-manger/server exec prisma generate
RUN pnpm --filter @time-manger/server build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm@9

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --prod --filter @time-manger/server... --ignore-scripts

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client

ENV NODE_ENV=production
WORKDIR /app/packages/server

EXPOSE 3000

CMD ["sh", "-c", "node ../../node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]
