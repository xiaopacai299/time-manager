import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { loadServerEnv } from '../src/config/env.js';
import { createApp } from '../src/createApp.js';

const hasDb = !!process.env.DATABASE_URL;

const prisma = new PrismaClient();

function env() {
  return loadServerEnv({
    JWT_ACCESS_SECRET: 'a'.repeat(64),
    JWT_REFRESH_SECRET: 'b'.repeat(64),
  });
}

before(async () => {
  if (!hasDb) return;
  await prisma.$connect();
});

after(async () => {
  await prisma.$disconnect();
});

test(
  'auth + time-records pull/push',
  { skip: !hasDb },
  async () => {
    const app = createApp(prisma, env());
    const deviceId = '10000000-0000-4000-8000-000000000001';
    const email = `it-${Date.now()}@example.com`;

    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Device-Id', deviceId)
      .send({ email, password: 'password-ok-1' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const { accessToken, refreshToken } = reg.body as {
      accessToken: string;
      refreshToken: string;
    };

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId);
    assert.equal(me.status, 200);

    const trId = '20000000-0000-4000-8000-000000000002';
    const push = await request(app)
      .post('/api/v1/sync/time-records')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .send({
        deviceId,
        records: [
          {
            id: trId,
            date: '2026-04-24',
            appKey: 'vscode',
            appName: 'VS Code',
            durationMs: 3600_000,
            updatedAt: '2026-04-24T12:00:00.000Z',
            deletedAt: null,
            clientDeviceId: deviceId,
          },
        ],
      });
    assert.equal(push.status, 200, JSON.stringify(push.body));
    assert.equal(push.body.accepted.length, 1);

    const pull = await request(app)
      .get('/api/v1/sync/time-records')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .query({ since: '2026-04-24T11:59:59.999Z' });
    assert.equal(pull.status, 200);
    assert.ok(Array.isArray(pull.body.records));
    assert.ok(
      pull.body.records.some((r: { id: string }) => r.id === trId),
      'pulled record',
    );

    const stale = await request(app)
      .post('/api/v1/sync/time-records')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .send({
        deviceId,
        records: [
          {
            id: trId,
            date: '2026-04-24',
            appKey: 'vscode',
            appName: 'VS Code',
            durationMs: 100,
            updatedAt: '2026-04-24T11:00:00.000Z',
            deletedAt: null,
            clientDeviceId: deviceId,
          },
        ],
      });
    assert.equal(stale.status, 200);
    assert.equal(stale.body.rejected.length, 1);
    assert.equal(stale.body.rejected[0].reason, 'stale');

    const trId2 = '20000000-0000-4000-8000-000000000014';
    const sameKeyNewer = await request(app)
      .post('/api/v1/sync/time-records')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .send({
        deviceId,
        records: [
          {
            id: trId2,
            date: '2026-04-24',
            appKey: 'vscode',
            appName: 'VS Code',
            durationMs: 7200_000,
            updatedAt: '2026-04-24T13:00:00.000Z',
            deletedAt: null,
            clientDeviceId: deviceId,
          },
        ],
      });
    assert.equal(sameKeyNewer.status, 200, JSON.stringify(sameKeyNewer.body));
    assert.equal(sameKeyNewer.body.accepted.length, 1);
    assert.equal(sameKeyNewer.body.accepted[0].id, trId2);

    await prisma.user.deleteMany({ where: { email: email.toLowerCase() } });
  },
);

test(
  'auth + diaries and worklist-items pull/push',
  { skip: !hasDb },
  async () => {
    const app = createApp(prisma, env());
    const deviceId = '10000000-0000-4000-8000-000000000011';
    const email = `it-sync-extra-${Date.now()}@example.com`;

    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Device-Id', deviceId)
      .send({ email, password: 'password-ok-1' });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const { accessToken } = reg.body as { accessToken: string };

    const diaryId = '20000000-0000-4000-8000-000000000012';
    const diaryPush = await request(app)
      .post('/api/v1/sync/diaries')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .send({
        deviceId,
        records: [
          {
            id: diaryId,
            date: '2026-04-25',
            content: '今天完成了移动端同步。',
            createdAt: '2026-04-25T08:00:00.000Z',
            updatedAt: '2026-04-25T08:30:00.000Z',
            deletedAt: null,
            clientDeviceId: deviceId,
          },
        ],
      });
    assert.equal(diaryPush.status, 200, JSON.stringify(diaryPush.body));
    assert.equal(diaryPush.body.accepted.length, 1);

    const worklistId = '20000000-0000-4000-8000-000000000013';
    const worklistPush = await request(app)
      .post('/api/v1/sync/worklist-items')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .send({
        deviceId,
        records: [
          {
            id: worklistId,
            name: '整理同步需求',
            icon: '📝',
            note: '只同步工作清单，不同步备忘录',
            reminderAt: '2026-04-25T10:00:00.000Z',
            estimateDoneAt: '2026-04-25T11:00:00.000Z',
            createdAt: '2026-04-25T08:00:00.000Z',
            updatedAt: '2026-04-25T08:30:00.000Z',
            deletedAt: null,
            reminderNotified: false,
            completionResult: '',
            confirmSnoozeUntil: null,
            clientDeviceId: deviceId,
          },
        ],
      });
    assert.equal(worklistPush.status, 200, JSON.stringify(worklistPush.body));
    assert.equal(worklistPush.body.accepted.length, 1);

    const diaryPull = await request(app)
      .get('/api/v1/sync/diaries')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .query({ since: '2026-04-25T07:59:59.999Z' });
    assert.equal(diaryPull.status, 200, JSON.stringify(diaryPull.body));
    assert.ok(
      diaryPull.body.records.some((r: { id: string }) => r.id === diaryId),
      'pulled diary',
    );

    const worklistPull = await request(app)
      .get('/api/v1/sync/worklist-items')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .query({ since: '2026-04-25T07:59:59.999Z' });
    assert.equal(worklistPull.status, 200, JSON.stringify(worklistPull.body));
    assert.ok(
      worklistPull.body.records.some((r: { id: string }) => r.id === worklistId),
      'pulled worklist item',
    );

    const staleDiary = await request(app)
      .post('/api/v1/sync/diaries')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Device-Id', deviceId)
      .send({
        deviceId,
        records: [
          {
            id: diaryId,
            date: '2026-04-25',
            content: '旧内容',
            createdAt: '2026-04-25T08:00:00.000Z',
            updatedAt: '2026-04-25T08:10:00.000Z',
            deletedAt: null,
            clientDeviceId: deviceId,
          },
        ],
      });
    assert.equal(staleDiary.status, 200, JSON.stringify(staleDiary.body));
    assert.equal(staleDiary.body.rejected[0].reason, 'stale');

    await prisma.user.deleteMany({ where: { email: email.toLowerCase() } });
  },
);
