import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;
import { loadServerEnv } from './config/env.js';
import { createApp } from './createApp.js';

function testEnv() {
  return loadServerEnv({
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
    JWT_ACCESS_SECRET: 't'.repeat(64),
    JWT_REFRESH_SECRET: 'r'.repeat(64),
  });
}

const prisma = new PrismaClient();

test('GET /health returns 200 with status ok', async () => {
  const app = createApp(prisma, testEnv());
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /health includes shared VERSION', async () => {
  const app = createApp(prisma, testEnv());
  const res = await request(app).get('/health');
  assert.match(res.body.sharedVersion, /^\d+\.\d+\.\d+$/);
});
