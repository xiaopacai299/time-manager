import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncEngine, type ApiClient, type LocalStore } from './engine.js';

test('SyncEngine keeps original since while paging', async () => {
  const pulls: Array<{ since: string | null; cursor: string | null }> = [];
  let lastSetSince: string | null = null;
  const store: LocalStore = {
    async getLastSyncAt() {
      return '2026-04-25T00:00:00.000Z';
    },
    async setLastSyncAt(_resource, serverTime) {
      lastSetSince = serverTime;
    },
    async getDirtyRecords() {
      return [];
    },
    async upsertRemote() {},
    async markClean() {},
  };
  const api: ApiClient = {
    async pull(_resource, since, cursor) {
      pulls.push({ since, cursor });
      if (!cursor) {
        return {
          resource: 'diaries',
          serverTime: '2026-04-25T12:00:00.000Z',
          records: [
            { id: '1', updatedAt: '2026-04-25T10:00:00.000Z' },
          ],
          hasMore: true,
          nextCursor: 'next-page',
        };
      }
      return {
        resource: 'diaries',
        serverTime: '2026-04-25T12:00:01.000Z',
        records: [
          { id: '2', updatedAt: '2026-04-25T11:00:00.000Z' },
        ],
        hasMore: false,
        nextCursor: null,
      };
    },
    async push() {
      throw new Error('push should not run without dirty records');
    },
  };

  const engine = new SyncEngine(store, api, 'device');
  const result = await engine.syncResource('diaries');

  assert.deepEqual(pulls, [
    { since: '2026-04-25T00:00:00.000Z', cursor: null },
    { since: '2026-04-25T00:00:00.000Z', cursor: 'next-page' },
  ]);
  assert.equal(result.pulled, 2);
  assert.equal(lastSetSince, '2026-04-25T11:00:00.000Z');
});

test('SyncEngine does not advance since on empty pull', async () => {
  let setCalls = 0;
  const store: LocalStore = {
    async getLastSyncAt() {
      return '2026-04-25T00:00:00.000Z';
    },
    async setLastSyncAt() {
      setCalls += 1;
    },
    async getDirtyRecords() {
      return [];
    },
    async upsertRemote() {
      throw new Error('upsert should not run');
    },
    async markClean() {},
  };
  const api: ApiClient = {
    async pull() {
      return {
        resource: 'worklist-items',
        serverTime: '2026-04-25T23:59:59.999Z',
        records: [],
        hasMore: false,
        nextCursor: null,
      };
    },
    async push() {
      throw new Error('push should not run');
    },
  };

  await new SyncEngine(store, api, 'device').syncResource('worklist-items');
  assert.equal(setCalls, 0);
});
