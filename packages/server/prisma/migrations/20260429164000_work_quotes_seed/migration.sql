-- 工作时间管理名言（开屏展示）
CREATE TABLE "WorkQuote" (
  "id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "author" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkQuote_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WorkQuote" ("id", "content", "author", "enabled", "createdAt", "updatedAt") VALUES
  ('quote-001', '你管理的不是时间，而是注意力；注意力在哪，成果就在哪。', '时间管理助手', true, NOW(), NOW()),
  ('quote-002', '先完成最重要的 20%，你的焦虑会先下降 80%。', '帕累托启发', true, NOW(), NOW()),
  ('quote-003', '把任务写下来，脑子就能腾出来。', 'GTD 思路', true, NOW(), NOW()),
  ('quote-004', '不要等有空才开始，开始了才会有空。', '行动派', true, NOW(), NOW()),
  ('quote-005', '番茄钟不是枷锁，是给专注一个边界。', '专注法则', true, NOW(), NOW()),
  ('quote-006', '今天的微小推进，是明天底气的来源。', '复利习惯', true, NOW(), NOW()),
  ('quote-007', '计划要写在纸上，执行要落在分钟里。', '执行导向', true, NOW(), NOW()),
  ('quote-008', '先做难而正确的事，简单的事会自己排队。', '优先级原则', true, NOW(), NOW()),
  ('quote-009', '休息不是偷懒，是让专注可持续。', '劳逸平衡', true, NOW(), NOW()),
  ('quote-010', '与其追求完美的一天，不如完成关键的一件。', '极简效率', true, NOW(), NOW());
