import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncEngine, type ApiClient, type LocalStore } from './engine.js';

test('SyncEngine keeps original since while paging', async () => {
  const pulls: Array<{ since: string | null; cursor: string | null }> = [];
  const store: LocalStore = {
    async getLastSyncAt() {
      return '2026-04-25T00:00:00.000Z';
    },
    async setLastSyncAt() {},
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
          records: [{ id: '1' }],
          hasMore: true,
          nextCursor: 'next-page',
        };
      }
      return {
        resource: 'diaries',
        serverTime: '2026-04-25T12:00:01.000Z',
        records: [{ id: '2' }],
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
});
