/** WMO weather code → 展示类型（与日历 UI 图标 kind 对应） */
const WEATHER_CODE_TABLE = [
  { max: 0, kind: 'clear', label: '晴' },
  { max: 3, kind: 'partly-cloudy', label: '多云' },
  { max: 48, kind: 'fog', label: '雾' },
  { max: 55, kind: 'drizzle', label: '毛毛雨' },
  { max: 65, kind: 'rain', label: '雨' },
  { max: 75, kind: 'snow', label: '雪' },
  { max: 82, kind: 'rain', label: '阵雨' },
  { max: 99, kind: 'thunder', label: '雷雨' },
];

/**
 * @param {number | null | undefined} code
 */
export function mapWeatherCode(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) {
    return { kind: 'unknown', label: '' };
  }
  for (const row of WEATHER_CODE_TABLE) {
    if (n <= row.max) return { kind: row.kind, label: row.label };
  }
  return { kind: 'unknown', label: '' };
}

/**
 * @param {number | null | undefined} tempMax
 * @param {number | null | undefined} code
 * @returns {{ kind: string, label: string, tempMax: number | null, title: string } | null}
 */
export function formatWeatherDay(tempMax, code) {
  const mapped = mapWeatherCode(code);
  const tempNum = Number(tempMax);
  const hasTemp = Number.isFinite(tempNum) && tempMax != null;
  if (!mapped.label && !hasTemp) return null;
  const rounded = hasTemp ? Math.round(tempNum) : null;
  const tempStr = rounded != null ? `${rounded}°` : '';
  const title = [mapped.label, tempStr ? `最高 ${tempStr}` : ''].filter(Boolean).join(' ');
  return {
    kind: mapped.kind,
    label: mapped.label,
    tempMax: rounded,
    title: title || mapped.label || tempStr,
  };
}

/**
 * @param {object} json Open-Meteo forecast daily payload
 * @returns {Record<string, { kind: string, label: string, tempMax: number | null, title: string }>}
 */
export function parseForecastDailyByDate(json) {
  const daily = json?.daily;
  if (!daily || !Array.isArray(daily.time)) return {};
  const out = {};
  for (let i = 0; i < daily.time.length; i += 1) {
    const dateKey = String(daily.time[i] || '').trim();
    if (!dateKey) continue;
    const formatted = formatWeatherDay(daily.temperature_2m_max?.[i], daily.weather_code?.[i]);
    if (formatted) out[dateKey] = formatted;
  }
  return out;
}

/**
 * 当月 1 日～月末（仅用于天气 API，不含日历格前后补位日期）
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @returns {{ startDate: string, endDate: string }}
 */
export function getMonthDateRange(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const toKey = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: toKey(first), endDate: toKey(last) };
}

/** Open-Meteo forecast 默认可预报天数（含今天） */
export const FORECAST_HORIZON_DAYS = 16;

/**
 * @param {Date} d
 * @returns {string} YYYY-MM-DD
 */
export function dateToKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * @param {string} dateKey
 * @returns {Date}
 */
export function parseDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 与当月交集的「可预报」日期段（今天起最多 FORECAST_HORIZON_DAYS 天）；无交集则返回 null
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @param {string} [todayKey] YYYY-MM-DD，默认本机当天
 * @returns {{ startDate: string, endDate: string } | null}
 */
export function getForecastableDateRange(year, monthIndex, todayKey) {
  const today = todayKey ? parseDateKey(todayKey) : new Date();
  const todayStart = parseDateKey(dateToKey(today));
  const month = getMonthDateRange(year, monthIndex);
  const monthStart = parseDateKey(month.startDate);
  const monthEnd = parseDateKey(month.endDate);

  const lastForecast = new Date(todayStart);
  lastForecast.setDate(lastForecast.getDate() + FORECAST_HORIZON_DAYS - 1);

  const rangeStart = monthStart > todayStart ? monthStart : todayStart;
  const rangeEnd = monthEnd < lastForecast ? monthEnd : lastForecast;

  if (rangeStart > rangeEnd) return null;

  return {
    startDate: dateToKey(rangeStart),
    endDate: dateToKey(rangeEnd),
  };
}

/**
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @returns {{ startDate: string, endDate: string }}
 */
export function getMonthGridDateRange(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const daysInMonth = last.getDate();
  const startPad = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
  const startDate = new Date(year, monthIndex, 1 - startPad);
  const endDate = new Date(year, monthIndex, totalCells - startPad);
  const pad = (n) => String(n).padStart(2, '0');
  const toKey = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: toKey(startDate), endDate: toKey(endDate) };
}
