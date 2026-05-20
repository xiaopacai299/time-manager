import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCalendarGrid,
  groupItemsByDateKey,
  resolveMemoDateKey,
} from '../src/components/MemoMonthCalendar/calendarMonth.js';

describe('calendarMonth', () => {
  it('buildMonthCalendarGrid returns 7-column weeks', () => {
    const { cells } = buildMonthCalendarGrid(2026, 4);
    assert.equal(cells.length % 7, 0);
    assert.ok(cells.some((c) => c.inCurrentMonth && c.day === 1));
  });

  it('resolveMemoDateKey prefers reminderAt', () => {
    const key = resolveMemoDateKey({
      reminderAt: '2026-05-20T14:00:00.000+08:00',
      createdAt: '2026-04-01T10:00:00.000+08:00',
    });
    assert.equal(key, '2026-05-20');
  });

  it('groupItemsByDateKey buckets items', () => {
    const map = groupItemsByDateKey([
      { id: 'a', name: 'A', reminderAt: '2026-05-20T09:00:00.000+08:00' },
      { id: 'b', name: 'B', createdAt: '2026-05-21T09:00:00.000+08:00' },
    ]);
    assert.equal(map.get('2026-05-20')?.length, 1);
    assert.equal(map.get('2026-05-21')?.length, 1);
  });
});
