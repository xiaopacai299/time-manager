/** WMO weather code → 简短展示 */
const WEATHER_CODE_TABLE = [
  { max: 0, icon: '☀', label: '晴' },
  { max: 3, icon: '🌤', label: '多云' },
  { max: 48, icon: '🌫', label: '雾' },
  { max: 55, icon: '🌦', label: '毛毛雨' },
  { max: 65, icon: '🌧', label: '雨' },
  { max: 75, icon: '🌨', label: '雪' },
  { max: 82, icon: '🌧', label: '阵雨' },
  { max: 99, icon: '⛈', label: '雷雨' },
];

/**
 * @param {number | null | undefined} code
 */
export function mapWeatherCode(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) {
    return { icon: '—', label: '' };
  }
  for (const row of WEATHER_CODE_TABLE) {
    if (n <= row.max) return { icon: row.icon, label: row.label };
  }
  return { icon: '—', label: '' };
}

/**
 * @param {number | null | undefined} tempMax
 * @param {number | null | undefined} code
 * @returns {{ icon: string, text: string, title: string } | null}
 */
export function formatWeatherDay(tempMax, code) {
  const mapped = mapWeatherCode(code);
  if (!mapped.label && !Number.isFinite(Number(tempMax))) return null;
  const temp =
    Number.isFinite(Number(tempMax)) && tempMax != null ? `${Math.round(Number(tempMax))}°` : '';
  const text = `${mapped.icon}${temp}`.trim();
  const title = [mapped.label, temp ? `最高 ${temp}` : ''].filter(Boolean).join(' ');
  return { icon: mapped.icon, text, title: title || text };
}

/**
 * @param {object} json Open-Meteo forecast daily payload
 * @returns {Record<string, { icon: string, text: string, title: string }>}
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
