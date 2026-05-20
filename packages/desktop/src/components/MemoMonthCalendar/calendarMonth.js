import { getLocalDateKey } from '@time-manger/shared';

/** 周一为一周起始 */
export const CALENDAR_WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * @param {number} year 完整年份
 * @param {number} monthIndex 0–11
 * @returns {{ year: number, monthIndex: number, cells: Array<{ dateKey: string, day: number, inCurrentMonth: boolean }> }}
 */
export function buildMonthCalendarGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const daysInMonth = last.getDate();
  const startPad = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
  const cells = [];

  for (let i = 0; i < totalCells; i += 1) {
    const dayOffset = i - startPad + 1;
    const cellDate = new Date(year, monthIndex, dayOffset);
    const inCurrentMonth = dayOffset >= 1 && dayOffset <= daysInMonth;
    cells.push({
      dateKey: getLocalDateKey(cellDate),
      day: cellDate.getDate(),
      inCurrentMonth,
    });
  }

  return { year, monthIndex, cells };
}

/** 备忘录归档日：优先提醒日，否则创建日 */
export function resolveMemoDateKey(item) {
  const reminder = String(item?.reminderAt || '').trim();
  if (reminder) {
    const fromReminder = getLocalDateKey(Date.parse(reminder));
    if (fromReminder) return fromReminder;
  }
  const created = String(item?.createdAt || '').trim();
  if (created) {
    const fromCreated = getLocalDateKey(Date.parse(created));
    if (fromCreated) return fromCreated;
  }
  return '';
}

/**
 * @param {Array<{ id?: string }>} items
 * @returns {Map<string, Array<object>>}
 */
export function groupItemsByDateKey(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = resolveMemoDateKey(item);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => {
      const ta = Date.parse(String(a?.reminderAt || a?.createdAt || ''));
      const tb = Date.parse(String(b?.reminderAt || b?.createdAt || ''));
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }
  return map;
}

/** datetime-local 默认值（当天 09:00） */
export function dateKeyToDefaultReminderInput(dateKey) {
  const raw = String(dateKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  return `${raw}T09:00`;
}
