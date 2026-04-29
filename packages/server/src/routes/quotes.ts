import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

// 进程内“近期不重复”缓存：避免用户连续几次启动看到同一句。
const recentQuoteIds: string[] = [];

function rememberQuoteId(id: string, enabledCount: number) {
  recentQuoteIds.push(id);
  // 最多记住 5 条；如果总条数更少，则留出至少 1 条可选空间。
  const maxRemembered = Math.max(1, Math.min(5, enabledCount - 1));
  while (recentQuoteIds.length > maxRemembered) {
    recentQuoteIds.shift();
  }
}

export function mountQuoteRoutes(app: Express, prisma: PrismaClient): void {
  app.get('/api/v1/quotes/featured', async (_req, res, next) => {
    try {
      const enabledWhere = { enabled: true };
      const total = await prisma.workQuote.count({ where: enabledWhere });
      if (total <= 0) {
        res.json({ quote: null });
        return;
      }
      // 先尝试“非近期”池；如果池太小/为空，再回退到全量池。
      let pool = await prisma.workQuote.findMany({
        where: {
          ...enabledWhere,
          id: { notIn: recentQuoteIds },
        },
        select: { id: true, content: true, author: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      if (pool.length <= 0) {
        pool = await prisma.workQuote.findMany({
          where: enabledWhere,
          select: { id: true, content: true, author: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        });
      }
      if (pool.length <= 0) {
        res.json({ quote: null });
        return;
      }
      const row = pool[Math.floor(Math.random() * pool.length)];
      if (!row) {
        res.json({ quote: null });
        return;
      }
      rememberQuoteId(row.id, total);
      res.json({
        quote: {
          id: row.id,
          content: row.content,
          author: row.author || '',
        },
      });
    } catch (error) {
      next(error);
    }
  });
}
