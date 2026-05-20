/** 本地时区 YYYY-MM-DD，用于工作清单按日归档。 */
export function getLocalDateKey(ts: number | Date = Date.now()): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function listDateFromIso(iso: string | null | undefined): string {
  const s = String(iso || '').trim();
  if (!s) return '';
  const t = Date.parse(s);
  if (Number.isNaN(t)) return '';
  return getLocalDateKey(t);
}
