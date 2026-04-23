import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './index.ts';

test('GET /health returns 200 with status ok', async () => {
  const app = createApp();
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /health includes shared VERSION', async () => {
  const app = createApp();
  const res = await request(app).get('/health');
  assert.match(res.body.sharedVersion, /^\d+\.\d+\.\d+$/);
});
