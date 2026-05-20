import { z } from 'zod';

/** 业务数据统一使用中国标准时间（Asia/Shanghai，UTC+8）的 ISO 字符串存储与传输。 */
export const CHINA_TIMEZONE = 'Asia/Shanghai';
export const CHINA_OFFSET_SUFFIX = '+08:00';

/** Sync/REST 用：接受 `+08:00` 或 `Z` 的 ISO 8601（Zod 默认 datetime 仅允许 Z）。 */
export const chinaStorageIsoSchema = z.string().datetime({ offset: true });
export const chinaStorageIsoNullableSchema = chinaStorageIsoSchema.nullable();

type ChinaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/** 将时刻格式化为东八区 ISO 字符串，例如 `2026-05-20T14:00:00.000+08:00`。 */
export function getChinaParts(instant: Date): ChinaParts {
  const t = instant.getTime() + 8 * 60 * 60 * 1000;
  const c = new Date(t);
  return {
    year: c.getUTCFullYear(),
    month: c.getUTCMonth() + 1,
    day: c.getUTCDate(),
    hour: c.getUTCHours(),
    minute: c.getUTCMinutes(),
    second: c.getUTCSeconds(),
    ms: c.getUTCMilliseconds(),
  };
}

export function formatChinaParts(parts: ChinaParts): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}.${pad3(parts.ms)}${CHINA_OFFSET_SUFFIX}`;
}

export function toChinaStorageIso(
  input: Date | string | number | null | undefined,
): string | null {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return formatChinaParts(getChinaParts(d));
}

/** 解析业务时间字符串为 UTC 时刻（支持 `Z`、任意偏移、无偏移视为东八区）。 */
export function parseChinaStorageIso(value: string | null | undefined): Date | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized = s.includes('T') ? `${s}${CHINA_OFFSET_SUFFIX}` : `${s}T00:00:00${CHINA_OFFSET_SUFFIX}`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 将任意可解析时间规范为东八区 ISO 字符串。 */
export function normalizeChinaStorageIso(value: string | null | undefined): string | null {
  const d = parseChinaStorageIso(value);
  if (!d) return null;
  return toChinaStorageIso(d);
}

export function chinaStorageIsoNow(): string {
  return toChinaStorageIso(new Date())!;
}

/** Prisma `DateTime` → 东八区 ISO（按真实时刻换算，兼容库内 UTC 存法）。 */
export function prismaDateToChinaStorageIso(row: Date | null | undefined): string | null {
  if (!row) return null;
  return toChinaStorageIso(row);
}

/** 东八区 ISO → Prisma `DateTime`（写入真实 UTC 时刻）。 */
export function chinaStorageIsoToPrismaDate(value: string | null | undefined): Date | null {
  return parseChinaStorageIso(value);
}
