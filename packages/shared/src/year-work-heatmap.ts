/**
 * 与桌面端「年度工作总鉴」一致的热力图聚合逻辑（纯函数，供主进程同步前序列化）。
 */
export type YearHeatmapCell = {
  key: string;
  weekIndex: number;
  day: number;
  dateKey: string;
  count: number;
  level: number;
  inCurrentYear: boolean;
};

export type YearHeatmapMonthMarker = { month: number; weekIndex: number };

export type YearWorkHeatmapPayload = {
  year: number;
  cells: YearHeatmapCell[];
  monthMarkers: YearHeatmapMonthMarker[];
  weekColumns: number;
  totalPlans: number;
  activeDays: number;
};

export function computeYearWorkHeatmap(
  items: Array<{ reminderAt?: string | null; estimateDoneAt?: string | null }>,
  year: number,
): YearWorkHeatmapPayload {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const start = new Date(yearStart);
  start.setDate(start.getDate() - start.getDay());

  const dayCountMap = new Map<string, number>();
  for (const item of items) {
    const rawTime = item?.reminderAt || item?.estimateDoneAt;
    const date = new Date(String(rawTime || ''));
    if (Number.isNaN(date.getTime())) continue;
    if (date.getFullYear() !== year) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    dayCountMap.set(key, (dayCountMap.get(key) || 0) + 1);
  }

  const cells: YearHeatmapCell[] = [];
  const monthMarkers: YearHeatmapMonthMarker[] = [];
  let cur = new Date(start);
  while (cur <= yearEnd) {
    const weekIndex = Math.floor((cur.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const day = cur.getDay();
    const dateKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(
      cur.getDate(),
    ).padStart(2, '0')}`;
    const count = dayCountMap.get(dateKey) || 0;
    const inCurrentYear = cur >= yearStart && cur <= yearEnd;
    const level = !inCurrentYear ? -1 : count === 0 ? 1 : count <= 2 ? 2 : count <= 5 ? 3 : 4;
    cells.push({
      key: `${weekIndex}-${day}`,
      weekIndex,
      day,
      dateKey,
      count,
      level,
      inCurrentYear,
    });

    if (cur.getDate() === 1 && cur >= yearStart && cur <= yearEnd) {
      monthMarkers.push({
        month: cur.getMonth(),
        weekIndex,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  return {
    year,
    cells,
    monthMarkers,
    weekColumns:
      Math.floor((yearEnd.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
    totalPlans: Array.from(dayCountMap.values()).reduce((sum, n) => sum + n, 0),
    activeDays: dayCountMap.size,
  };
}
