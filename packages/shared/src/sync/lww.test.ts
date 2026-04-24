import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lwwClientMerge,
  lwwServerPush,
  parseIsoMs,
} from './lww.js';
import type { TimeRecord } from '../types/sync.js';

function tr(partial: Partial<TimeRecord> & Pick<TimeRecord, 'id'>): TimeRecord {
  return {
    id: partial.id,
    date: partial.date ?? '2026-04-24',
    appKey: partial.appKey ?? 'app',
    appName: partial.appName ?? 'App',
    durationMs: partial.durationMs ?? 0,
    updatedAt: partial.updatedAt ?? '2026-04-24T10:00:00.000Z',
    deletedAt: partial.deletedAt ?? null,
    clientDeviceId: partial.clientDeviceId ?? '00000000-0000-4000-8000-000000000001',
  };
}

test('lwwServerPush: no existing → accept', () => {
  assert.equal(lwwServerPush(tr({ id: 'a' }), null), 'accept');
});

test('lwwServerPush: incoming newer → accept', () => {
  const incoming = tr({
    id: 'a',
    updatedAt: '2026-04-24T11:00:00.000Z',
  });
  const existing = tr({
    id: 'a',
    updatedAt: '2026-04-24T10:00:00.000Z',
  });
  assert.equal(lwwServerPush(incoming, existing), 'accept');
});

test('lwwServerPush: same time → stale', () => {
  const t = '2026-04-24T10:00:00.000Z';
  assert.equal(lwwServerPush(tr({ id: 'a', updatedAt: t }), tr({ id: 'a', updatedAt: t })), 'stale');
});

test('lwwServerPush: older → stale', () => {
  assert.equal(
    lwwServerPush(
      tr({ id: 'a', updatedAt: '2026-04-24T09:00:00.000Z' }),
      tr({ id: 'a', updatedAt: '2026-04-24T10:00:00.000Z' }),
    ),
    'stale',
  );
});

test('lwwClientMerge: remote newer → true', () => {
  assert.equal(
    lwwClientMerge(
      tr({ id: 'a', updatedAt: '2026-04-24T11:00:00.000Z' }),
      tr({ id: 'a', updatedAt: '2026-04-24T10:00:00.000Z' }),
    ),
    true,
  );
});

test('parseIsoMs rejects invalid', () => {
  assert.throws(() => parseIsoMs('not-a-date'), /invalid datetime/);
});
