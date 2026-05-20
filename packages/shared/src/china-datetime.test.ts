import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChinaStorageIso,
  toChinaStorageIso,
  normalizeChinaStorageIso,
  CHINA_OFFSET_SUFFIX,
} from './china-datetime.js';
import { WorklistItemSchema } from './api-contract/worklist-item.js';

describe('china-datetime', () => {
  it('formats local afternoon as +08:00 wall clock', () => {
    const iso = toChinaStorageIso('2026-05-20T14:00:00+08:00');
    assert.equal(iso, '2026-05-20T14:00:00.000+08:00');
  });

  it('parses legacy Z and naive local datetime', () => {
    const fromZ = parseChinaStorageIso('2026-05-20T06:00:00.000Z');
    const fromNaive = parseChinaStorageIso('2026-05-20T14:00');
    assert.equal(fromZ?.toISOString(), '2026-05-20T06:00:00.000Z');
    assert.equal(fromNaive?.toISOString(), '2026-05-20T06:00:00.000Z');
  });

  it('normalize converts Z to +08:00', () => {
    const out = normalizeChinaStorageIso('2026-05-20T06:00:00.000Z');
    assert.equal(out, `2026-05-20T14:00:00.000${CHINA_OFFSET_SUFFIX}`);
  });

  it('WorklistItemSchema accepts +08:00 timestamps', () => {
    const now = `2026-05-20T14:00:00.000${CHINA_OFFSET_SUFFIX}`;
    const parsed = WorklistItemSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      listDate: '2026-05-20',
      quadrant: 'q2',
      name: '测试',
      icon: '📋',
      note: '',
      reminderAt: null,
      estimateDoneAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      reminderNotified: false,
      completionResult: '',
      confirmSnoozeUntil: null,
      clientDeviceId: '550e8400-e29b-41d4-a716-446655440001',
    });
    assert.equal(parsed.success, true);
  });
});
