/** 低温 → 高温：蓝 → 青 → 绿 → 橙 → 红 */
const TEMP_COLOR_STOPS = [
  { t: -10, color: [58, 140, 255] },
  { t: 5, color: [72, 184, 212] },
  { t: 15, color: [59, 182, 143] },
  { t: 25, color: [232, 162, 59] },
  { t: 38, color: [224, 124, 109] },
];

/**
 * @param {number} t
 * @param {number} t0
 * @param {number[]} c0
 * @param {number} t1
 * @param {number[]} c1
 */
function lerpChannel(t, t0, c0, t1, c1) {
  if (t1 === t0) return c0;
  const ratio = (t - t0) / (t1 - t0);
  return Math.round(c0 + (c1 - c0) * ratio);
}

/**
 * 气温越高颜色越暖（用于日历格与「今天」按钮）
 * @param {number | null | undefined} tempC
 * @returns {string}
 */
export function getTemperatureColor(tempC) {
  const t = Number(tempC);
  if (!Number.isFinite(t)) return '#5a7ab0';

  const clamped = Math.max(TEMP_COLOR_STOPS[0].t, Math.min(TEMP_COLOR_STOPS.at(-1).t, t));
  for (let i = 0; i < TEMP_COLOR_STOPS.length - 1; i += 1) {
    const a = TEMP_COLOR_STOPS[i];
    const b = TEMP_COLOR_STOPS[i + 1];
    if (clamped <= b.t) {
      const r = lerpChannel(clamped, a.t, a.color[0], b.t, b.color[0]);
      const g = lerpChannel(clamped, a.t, a.color[1], b.t, b.color[1]);
      const bl = lerpChannel(clamped, a.t, a.color[2], b.t, b.color[2]);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  const last = TEMP_COLOR_STOPS.at(-1).color;
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}
