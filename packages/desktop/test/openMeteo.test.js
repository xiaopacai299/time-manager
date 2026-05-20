import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWeatherDay,
  getForecastableDateRange,
  getMonthDateRange,
  getMonthGridDateRange,
  mapWeatherCode,
  parseForecastDailyByDate,
} from '../main/weather/openMeteoCore.js';

describe('openMeteoCore', () => {
  it('maps clear weather code', () => {
    assert.equal(mapWeatherCode(0).label, '晴');
  });

  it('formats weather day payload', () => {
    const row = formatWeatherDay(26.4, 0);
    assert.equal(row?.kind, 'clear');
    assert.equal(row?.tempMax, 26);
    assert.ok(row?.title.includes('晴'));
  });

  it('parses daily forecast json', () => {
    const byDate = parseForecastDailyByDate({
      daily: {
        time: ['2026-05-01', '2026-05-02'],
        weather_code: [0, 61],
        temperature_2m_max: [28, 19],
      },
    });
    assert.equal(byDate['2026-05-01']?.tempMax, 28);
    assert.equal(byDate['2026-05-02']?.tempMax, 19);
    assert.equal(byDate['2026-05-02']?.kind, 'rain');
    assert.ok(byDate['2026-05-02']?.title.includes('雨'));
  });

  it('computes month-only range for weather API', () => {
    const range = getMonthDateRange(2026, 4);
    assert.equal(range.startDate, '2026-05-01');
    assert.equal(range.endDate, '2026-05-31');
  });

  it('returns null forecast range when month has no forecastable days', () => {
    assert.equal(getForecastableDateRange(2020, 0, '2026-05-20'), null);
  });

  it('clips forecast range to today through horizon within month', () => {
    const range = getForecastableDateRange(2026, 4, '2026-05-20');
    assert.equal(range?.startDate, '2026-05-20');
    assert.equal(range?.endDate, '2026-05-31');
  });

  it('extends forecast range across month boundary when needed', () => {
    const range = getForecastableDateRange(2026, 5, '2026-05-20');
    assert.equal(range?.startDate, '2026-06-01');
    assert.equal(range?.endDate, '2026-06-04');
  });

  it('computes padded month grid range', () => {
    const range = getMonthGridDateRange(2026, 4);
    assert.ok(range.startDate < '2026-05-01');
    assert.ok(range.endDate >= '2026-05-31');
  });
});
