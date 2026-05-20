import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getChineseCalendarDayMeta } from '../src/components/MemoMonthCalendar/chineseCalendarMeta.js';

describe('chineseCalendarMeta', () => {
  it('does not show jieqi as label', () => {
    const meta = getChineseCalendarDayMeta('2026-05-05');
    assert.notEqual(meta.festivalLabel, '立夏');
    assert.equal(meta.restBadge, '休');
  });

  it('shows festival and rest badge on Labor Day', () => {
    const meta = getChineseCalendarDayMeta('2026-05-01');
    assert.equal(meta.restBadge, '休');
    assert.equal(meta.isRestDay, true);
    assert.ok(meta.festivalLabel.includes('劳动'));
  });

  it('shows no lunar label on ordinary day', () => {
    const meta = getChineseCalendarDayMeta('2026-05-20');
    assert.equal(meta.festivalLabel, '');
    assert.equal(meta.restBadge, null);
  });

  it('marks weekend as rest without holiday record', () => {
    const meta = getChineseCalendarDayMeta('2026-05-10');
    assert.equal(meta.restBadge, '休');
    assert.equal(meta.isRestDay, true);
    assert.ok(meta.festivalLabel.includes('母亲'));
  });

  it('marks adjusted workday on weekend as 班', () => {
    const meta = getChineseCalendarDayMeta('2026-05-09');
    assert.equal(meta.restBadge, '班');
    assert.equal(meta.isRestDay, false);
    assert.equal(meta.festivalLabel, '');
  });
});
