import { Solar, HolidayUtil } from 'lunar-javascript';

/**
 * @typedef {object} ChineseCalendarDayMeta
 * @property {string} festivalLabel 节日名（显示在休/班 徽章右侧）
 * @property {'休' | '班' | null} restBadge 法定休或调休上班
 * @property {boolean} isRestDay
 */

const EMPTY_META = {
  festivalLabel: '',
  restBadge: null,
  isRestDay: false,
};

/**
 * @param {string} dateKey YYYY-MM-DD
 * @returns {ChineseCalendarDayMeta}
 */
export function getChineseCalendarDayMeta(dateKey) {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  if (!matched) return { ...EMPTY_META };

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  const lunarFestivals = lunar.getFestivals() || [];
  const solarFestivals = solar.getFestivals() || [];
  const holiday = HolidayUtil.getHoliday(year, month, day);
  const week = solar.getWeek();
  const isWeekend = week === 0 || week === 6;

  /** @type {'休' | '班' | null} */
  let restBadge = null;
  if (holiday) {
    restBadge = holiday.isWork() ? '班' : '休';
  } else if (isWeekend) {
    restBadge = '休';
  }

  const festivalCandidates = [];
  if (holiday && !holiday.isWork()) {
    festivalCandidates.push(holiday.getName());
  }
  for (const name of lunarFestivals) festivalCandidates.push(name);
  for (const name of solarFestivals) festivalCandidates.push(name);

  const festivalLabel = festivalCandidates.find((name) => String(name || '').trim()) || '';

  return {
    festivalLabel: String(festivalLabel).trim(),
    restBadge,
    isRestDay: restBadge === '休',
  };
}

/**
 * @param {Iterable<string>} dateKeys
 * @returns {Map<string, ChineseCalendarDayMeta>}
 */
export function buildChineseCalendarMetaMap(dateKeys) {
  const map = new Map();
  for (const dateKey of dateKeys) {
    map.set(dateKey, getChineseCalendarDayMeta(dateKey));
  }
  return map;
}
