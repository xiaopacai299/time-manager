import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWeatherDay,
  getMonthGridDateRange,
  mapWeatherCode,
  parseForecastDailyByDate,
} from '../main/weather/openMeteoCore.js';

describe('openMeteoCore', () => {
  it('maps clear weather code', () => {
    assert.equal(mapWeatherCode(0).label, '晴');
  });

  it('formats weather day text', () => {
    const row = formatWeatherDay(26.4, 0);
    assert.ok(row?.text.includes('26°'));
    assert.ok(row?.text.includes('☀'));
  });

  it('parses daily forecast json', () => {
    const byDate = parseForecastDailyByDate({
      daily: {
        time: ['2026-05-01', '2026-05-02'],
        weather_code: [0, 61],
        temperature_2m_max: [28, 19],
      },
    });
    assert.ok(byDate['2026-05-01']?.text.includes('28°'));
    assert.ok(byDate['2026-05-02']?.text.includes('19°'));
    assert.ok(byDate['2026-05-02']?.title.includes('雨'));
  });

  it('computes padded month grid range', () => {
    const range = getMonthGridDateRange(2026, 4);
    assert.ok(range.startDate < '2026-05-01');
    assert.ok(range.endDate >= '2026-05-31');
  });
});
