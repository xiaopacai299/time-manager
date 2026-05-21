import { useEffect, useMemo, useRef, useState } from 'react';
import { getLocalDateKey } from '@time-manger/shared';
import {
  CALENDAR_WEEKDAY_LABELS,
  buildMonthCalendarGrid,
  groupItemsByDateKey,
} from './calendarMonth.js';
import { buildChineseCalendarMetaMap } from './chineseCalendarMeta.js';
import WeatherDayBadge, { hasWeatherDisplay } from './WeatherDayBadge.jsx';
import './MemoMonthCalendar.css';

const MEMO_ACCENT_COLORS = ['#5f87ff', '#3bb68f', '#e07c6d', '#9b7ee8', '#e8a23b', '#4db6d8'];

function memoAccentColor(id) {
  let hash = 0;
  for (const ch of String(id || '')) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return MEMO_ACCENT_COLORS[hash % MEMO_ACCENT_COLORS.length];
}

/** @param {string} hex */
function memoEntrySurfaceStyle(hex) {
  const raw = String(hex || '#5f87ff').replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return {
    '--memo-entry-accent': hex,
    background: `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.34) 0%, rgba(${r}, ${g}, ${b}, 0.16) 100%)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.52)`,
    boxShadow: `0 1px 4px rgba(${r}, ${g}, ${b}, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.45)`,
  };
}

function weekNumberInMonth(year, monthIndex, day) {
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  return Math.floor((day - 1 + firstWeekday) / 7) + 1;
}

/**
 * @param {object} props
 * @param {Array<object>} props.items 备忘录列表
 * @param {number} props.viewYear
 * @param {number} props.viewMonthIndex 0–11
 * @param {string | null} props.selectedDate YYYY-MM-DD
 * @param {number} [props.maxPreviewPerDay]
 * @param {(year: number, monthIndex: number) => void} props.onViewMonthChange
 * @param {(dateKey: string) => void} props.onSelectDate
 * @param {(dateKey: string) => void} props.onAddForDate 点击空白日期格
 * @param {(item: object) => void} props.onEditItem 点击格内条目
 * @param {(item: object) => void} [props.onDeleteItem] 删除格内条目
 * @param {Record<string, { kind?: string, label?: string, tempMax?: number | null, title?: string }>} [props.weatherByDate]
 * @param {string} [props.weatherLocationLabel]
 * @param {boolean} [props.weatherLoading]
 * @param {{ locationMode?: string, cityName?: string, locationLabel?: string }} [props.weatherSettings]
 * @param {(payload: object) => Promise<{ ok?: boolean, error?: string }>} [props.onWeatherSettingsSave]
 */
export default function MemoMonthCalendar({
  items = [],
  viewYear,
  viewMonthIndex,
  selectedDate = null,
  maxPreviewPerDay = 3,
  weatherByDate = {},
  weatherLocationLabel = '',
  weatherLoading = false,
  weatherSettings = null,
  onWeatherSettingsSave,
  onViewMonthChange,
  onSelectDate,
  onAddForDate,
  onEditItem,
  onDeleteItem,
}) {
  const [weatherPanelOpen, setWeatherPanelOpen] = useState(false);
  const [draftMode, setDraftMode] = useState('ip');
  const [draftCity, setDraftCity] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const weatherPanelRef = useRef(null);
  const todayKey = getLocalDateKey();
  const grid = useMemo(
    () => buildMonthCalendarGrid(viewYear, viewMonthIndex),
    [viewYear, viewMonthIndex],
  );
  const itemsByDate = useMemo(() => groupItemsByDateKey(items), [items]);
  const calendarMetaByDate = useMemo(
    () => buildChineseCalendarMetaMap(grid.cells.map((cell) => cell.dateKey)),
    [grid.cells],
  );

  const focusWeek = useMemo(() => {
    const anchorKey = selectedDate || todayKey;
    const anchor = grid.cells.find((c) => c.dateKey === anchorKey && c.inCurrentMonth);
    if (anchor) return weekNumberInMonth(viewYear, viewMonthIndex, anchor.day);
    const todayInMonth = grid.cells.find((c) => c.dateKey === todayKey && c.inCurrentMonth);
    if (todayInMonth) return weekNumberInMonth(viewYear, viewMonthIndex, todayInMonth.day);
    return 1;
  }, [grid.cells, selectedDate, todayKey, viewYear, viewMonthIndex]);

  function shiftMonth(delta) {
    const d = new Date(viewYear, viewMonthIndex + delta, 1);
    onViewMonthChange?.(d.getFullYear(), d.getMonth());
  }

  function goToday() {
    const now = new Date();
    onViewMonthChange?.(now.getFullYear(), now.getMonth());
    onSelectDate?.(getLocalDateKey(now));
  }

  useEffect(() => {
    if (!weatherPanelOpen) return undefined;
    const mode = weatherSettings?.locationMode === 'manual' ? 'manual' : 'ip';
    setDraftMode(mode);
    setDraftCity(String(weatherSettings?.cityName || ''));
    setSettingsError('');
  }, [weatherPanelOpen, weatherSettings]);

  useEffect(() => {
    if (!weatherPanelOpen) return undefined;
    function onDocPointerDown(event) {
      if (weatherPanelRef.current?.contains(event.target)) return;
      setWeatherPanelOpen(false);
    }
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [weatherPanelOpen]);

  async function saveWeatherSettings() {
    if (!onWeatherSettingsSave) return;
    setSettingsBusy(true);
    setSettingsError('');
    const res = await onWeatherSettingsSave({
      locationMode: draftMode === 'manual' ? 'manual' : 'ip',
      cityName: draftMode === 'manual' ? draftCity : '',
    });
    setSettingsBusy(false);
    if (res?.ok) {
      setWeatherPanelOpen(false);
      return;
    }
    setSettingsError(String(res?.error || '保存失败'));
  }

  const displayCity =
    weatherLocationLabel ||
    weatherSettings?.locationLabel ||
    (weatherSettings?.locationMode === 'manual' ? weatherSettings?.cityName : '') ||
    '';
  const todayWeather = weatherByDate?.[todayKey];

  const locationBtnLabel = weatherLoading
    ? displayCity
      ? `${displayCity}…`
      : '定位中…'
    : displayCity || '定位中…';
  return (
    <div className="memo-cal">
      <div className="memo-cal__panel">
        <header className="memo-cal__toolbar">
          <div className="memo-cal__nav">
            <button
              type="button"
              className="memo-cal__nav-btn"
              aria-label="上一月"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <div className="memo-cal__title-wrap">
              <h2 className="memo-cal__title">
                {viewYear}年{viewMonthIndex + 1}月
              </h2>
              <span className="memo-cal__week-hint">第 {focusWeek} 周</span>
            </div>
            <button
              type="button"
              className="memo-cal__nav-btn"
              aria-label="下一月"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="memo-cal__toolbar-actions">
            <div className="memo-cal__location-wrap" ref={weatherPanelRef}>
              <button
                type="button"
                className="memo-cal__location-btn"
                aria-expanded={weatherPanelOpen}
                onClick={() => setWeatherPanelOpen((v) => !v)}
              >
                <span className="memo-cal__location-pin" aria-hidden="true">
                  📍
                </span>
                {locationBtnLabel}
              </button>
              {weatherPanelOpen ? (
                <div className="memo-cal__location-panel" role="dialog" aria-label="天气城市设置">
                  <p className="memo-cal__location-panel-title">天气位置</p>
                  <label className="memo-cal__location-option">
                    <input
                      type="radio"
                      name="weather-location-mode"
                      checked={draftMode === 'ip'}
                      onChange={() => setDraftMode('ip')}
                    />
                    自动定位（默认）
                  </label>
                  <label className="memo-cal__location-option">
                    <input
                      type="radio"
                      name="weather-location-mode"
                      checked={draftMode === 'manual'}
                      onChange={() => setDraftMode('manual')}
                    />
                    指定城市
                  </label>
                  {draftMode === 'manual' ? (
                    <input
                      type="text"
                      className="memo-cal__location-input"
                      placeholder="例如：上海、北京"
                      value={draftCity}
                      onChange={(e) => setDraftCity(e.target.value)}
                    />
                  ) : null}
                  {settingsError ? (
                    <p className="memo-cal__location-error">{settingsError}</p>
                  ) : null}
                  <div className="memo-cal__location-actions">
                    <button
                      type="button"
                      className="memo-cal__location-save"
                      disabled={settingsBusy}
                      onClick={saveWeatherSettings}
                    >
                      {settingsBusy ? '保存中…' : '保存'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <button type="button" className="memo-cal__today-btn" onClick={goToday}>
              {hasWeatherDisplay(todayWeather) ? (
                <WeatherDayBadge weather={todayWeather} size="md" iconOnly />
              ) : null}
              今天
            </button>
          </div>
        </header>

        <div className="memo-cal__weekdays" aria-hidden="true">
          {CALENDAR_WEEKDAY_LABELS.map((label, index) => (
            <span
              key={label}
              className={[
                'memo-cal__weekday',
                index >= 5 ? 'memo-cal__weekday--weekend' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
            </span>
          ))}
        </div>

        <div
          className="memo-cal__grid"
          role="grid"
          aria-label={`${viewYear}年${viewMonthIndex + 1}月`}
        >
          {grid.cells.map((cell) => {
            const dayItems = itemsByDate.get(cell.dateKey) || [];
            const meta = calendarMetaByDate.get(cell.dateKey);
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selectedDate;
            const visible = dayItems.slice(0, maxPreviewPerDay);
            const more = dayItems.length - visible.length;
            const [cellYear, cellMonth, cellDay] = cell.dateKey.split('-').map(Number);
            const weekdayIndex =
              (new Date(cellYear, cellMonth - 1, cellDay).getDay() + 6) % 7;
            const isWeekend = weekdayIndex >= 5;
            const weather = cell.inCurrentMonth ? weatherByDate?.[cell.dateKey] : null;

            return (
              <button
                key={cell.dateKey}
                type="button"
                role="gridcell"
                className={[
                  'memo-cal__cell',
                  !cell.inCurrentMonth ? 'memo-cal__cell--outside' : '',
                  isWeekend ? 'memo-cal__cell--weekend' : '',
                  meta?.isRestDay ? 'memo-cal__cell--rest' : '',
                  meta?.restBadge === '班' ? 'memo-cal__cell--workday' : '',
                  isToday ? 'memo-cal__cell--today' : '',
                  isSelected ? 'memo-cal__cell--selected' : '',
                  dayItems.length ? 'memo-cal__cell--has-items' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  onSelectDate?.(cell.dateKey);
                  onAddForDate?.(cell.dateKey);
                }}
              >
                <div className="memo-cal__cell-head">
                  <div className="memo-cal__day-row">
                    <span className="memo-cal__day">{cell.day}</span>
                    {hasWeatherDisplay(weather) || meta?.restBadge || meta?.festivalLabel ? (
                      <span className="memo-cal__mark-group">
                        <WeatherDayBadge weather={weather} />
                        {meta?.restBadge ? (
                          <span
                            className={[
                              'memo-cal__rest-badge',
                              meta.restBadge === '班'
                                ? 'memo-cal__rest-badge--work'
                                : 'memo-cal__rest-badge--rest',
                            ].join(' ')}
                          >
                            {meta.restBadge}
                          </span>
                        ) : null}
                        {meta?.festivalLabel ? (
                          <span className="memo-cal__festival" title={meta.festivalLabel}>
                            {meta.festivalLabel}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {isToday ? (
                      <span className="memo-cal__today-tag" aria-label="今天">
                        今
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="memo-cal__cell-body">
                  {visible.map((item) => {
                    const accent = memoAccentColor(item.id);
                    return (
                      <div
                        key={item.id}
                        className="memo-cal__entry"
                        style={memoEntrySurfaceStyle(accent)}
                        title={String(item.name || '')}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditItem?.(item);
                        }}
                      >
                        <span
                          className="memo-cal__entry-bar"
                          style={{ backgroundColor: accent }}
                          aria-hidden="true"
                        />
                        <span className="memo-cal__entry-name">
                          {String(item.name || '备忘录').trim()}
                        </span>
                        {onDeleteItem ? (
                          <button
                            type="button"
                            className="memo-cal__entry-delete"
                            aria-label={`删除 ${String(item.name || '备忘录').trim()}`}
                            title="删除"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(item);
                            }}
                          >
                            <span className="memo-cal__entry-delete-icon" aria-hidden="true">
                              ×
                            </span>
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  {more > 0 ? (
                    <span className="memo-cal__more">还有 {more} 条</span>
                  ) : null}
                </div>
                {isToday ? (
                  <span className="memo-cal__add-hint" aria-hidden="true">
                    +
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
