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

    await prisma.user.deleteMany({ where: { email: email.toLowerCase() } });
  },
);
