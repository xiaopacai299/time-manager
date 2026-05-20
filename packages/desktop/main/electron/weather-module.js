import { getLocalDateKey } from '@time-manger/shared';
import {
  getForecastableDateRange,
  parseForecastDailyByDate,
} from '../weather/openMeteoCore.js';

const FETCH_TIMEOUT_MS = 12_000;
const IP_CACHE_MS = 6 * 60 * 60 * 1000;
const MONTH_CACHE_MS = 30 * 60 * 1000;

const DEFAULT_WEATHER_SETTINGS = {
  locationMode: 'ip',
  cityName: '',
  latitude: null,
  longitude: null,
  locationLabel: '',
};

/** @type {{ at: number, lat: number, lon: number, label: string } | null} */
let ipLocationCache = null;
/** @type {Map<string, { at: number, byDate: Record<string, object> }>} */
const monthForecastCache = new Map();

function clampCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildLocationLabel(...parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' ') || '';
}

export function normalizeWeatherSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const mode = String(input.locationMode || '').trim() === 'manual' ? 'manual' : 'ip';
  const lat = clampCoord(input.latitude);
  const lon = clampCoord(input.longitude);
  return {
    locationMode: mode,
    cityName: String(input.cityName || '').trim().slice(0, 80),
    latitude: lat,
    longitude: lon,
    locationLabel: String(input.locationLabel || '').trim().slice(0, 80),
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchIpLocation() {
  if (ipLocationCache && Date.now() - ipLocationCache.at < IP_CACHE_MS) {
    return ipLocationCache;
  }

  const providers = [
    async () => {
      const json = await fetchJson('https://api.ip.sb/geoip');
      const lat = clampCoord(json.latitude);
      const lon = clampCoord(json.longitude);
      if (lat == null || lon == null) throw new Error('ip.sb 无坐标');
      const label = buildLocationLabel(json.city, json.region, json.country);
      return { lat, lon, label: label || '当前位置' };
    },
    async () => {
      const json = await fetchJson('https://freeipapi.com/api/json');
      const lat = clampCoord(json.latitude);
      const lon = clampCoord(json.longitude);
      if (lat == null || lon == null) throw new Error('freeipapi 无坐标');
      const label = buildLocationLabel(
        json.cityName,
        json.regionName,
        json.countryName,
      );
      return { lat, lon, label: label || String(json.capital || '').trim() || '当前位置' };
    },
    async () => {
      const json = await fetchJson('https://ipapi.co/json/');
      const lat = clampCoord(json.latitude);
      const lon = clampCoord(json.longitude);
      if (lat == null || lon == null) throw new Error('ipapi 无坐标');
      const label = buildLocationLabel(json.city, json.region, json.country_name);
      return { lat, lon, label: label || '当前位置' };
    },
  ];

  let lastError = null;
  for (const provider of providers) {
    try {
      const hit = await provider();
      ipLocationCache = { at: Date.now(), ...hit };
      return ipLocationCache;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('IP 定位失败，请检查网络或改用手动指定城市');
}

/**
 * @param {string} cityName
 */
export async function geocodeCityName(cityName) {
  const name = String(cityName || '').trim();
  if (!name) throw new Error('请输入城市名');
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', name);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'zh');
  url.searchParams.set('format', 'json');
  const json = await fetchJson(url.toString());
  const hit = Array.isArray(json?.results) ? json.results[0] : null;
  if (!hit) throw new Error(`未找到城市：${name}`);
  const lat = clampCoord(hit.latitude);
  const lon = clampCoord(hit.longitude);
  if (lat == null || lon == null) throw new Error('城市坐标无效');
  const label = String(hit.name || name).trim();
  const admin = String(hit.admin1 || '').trim();
  const country = String(hit.country || '').trim();
  const locationLabel = [label, admin, country].filter(Boolean).join(' · ') || label;
  return { latitude: lat, longitude: lon, locationLabel, cityName: label };
}

/**
 * @param {ReturnType<typeof normalizeWeatherSettings>} settings
 */
async function resolveCoordinates(settings) {
  if (settings.locationMode === 'manual') {
    let lat = settings.latitude;
    let lon = settings.longitude;
    let label = settings.locationLabel || settings.cityName;
    if ((lat == null || lon == null) && settings.cityName) {
      const geo = await geocodeCityName(settings.cityName);
      lat = geo.latitude;
      lon = geo.longitude;
      label = geo.locationLabel;
    }
    if (lat == null || lon == null) {
      throw new Error('请先设置城市并保存');
    }
    return { lat, lon, label: label || settings.cityName || '自定义' };
  }
  const ip = await fetchIpLocation();
  return { lat: ip.lat, lon: ip.lon, label: ip.label };
}

/**
 * @param {number} lat
 * @param {number} lon
 * @param {string} startDate
 * @param {string} endDate
 */
async function fetchForecastRange(lat, lon, startDate, endDate) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min',
  );
  url.searchParams.set('timezone', 'Asia/Shanghai');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  const json = await fetchJson(url.toString());
  return parseForecastDailyByDate(json);
}

export function createWeatherModule({ petState, persistPetState }) {
  if (!petState.weatherSettings) {
    petState.weatherSettings = { ...DEFAULT_WEATHER_SETTINGS };
  }

  function getSettings() {
    return normalizeWeatherSettings(petState.weatherSettings);
  }

  function invalidateWeatherCache() {
    ipLocationCache = null;
    monthForecastCache.clear();
  }

  async function resolveAndPersistLocation() {
    const prev = getSettings();
    const { lat, lon, label } = await resolveCoordinates(prev);
    const next = normalizeWeatherSettings({
      ...prev,
      latitude: lat,
      longitude: lon,
      locationLabel: label,
      ...(prev.locationMode === 'ip'
        ? { cityName: '', latitude: lat, longitude: lon }
        : {}),
    });
    const changed =
      prev.locationLabel !== next.locationLabel ||
      prev.latitude !== next.latitude ||
      prev.longitude !== next.longitude;
    petState.weatherSettings = next;
    if (changed) persistPetState();
    return { lat, lon, label, weatherSettings: next };
  }

  async function updateSettings(payload) {
    const prev = getSettings();
    const input = payload && typeof payload === 'object' ? payload : {};
    const next = normalizeWeatherSettings({
      ...prev,
      ...input,
      locationMode:
        input.locationMode === 'manual' || input.locationMode === 'ip'
          ? input.locationMode
          : prev.locationMode,
    });

    if (next.locationMode === 'ip') {
      next.cityName = '';
    }

    if (next.locationMode === 'manual' && input.cityName != null) {
      const typed = String(input.cityName || '').trim();
      if (typed && (input.latitude == null || input.longitude == null)) {
        const geo = await geocodeCityName(typed);
        next.cityName = geo.cityName;
        next.latitude = geo.latitude;
        next.longitude = geo.longitude;
        next.locationLabel = geo.locationLabel;
      } else if (typed) {
        next.locationLabel = next.locationLabel || typed;
      }
    }

    const locationChanged =
      prev.locationMode !== next.locationMode ||
      prev.cityName !== next.cityName ||
      prev.latitude !== next.latitude ||
      prev.longitude !== next.longitude;

    petState.weatherSettings = next;
    persistPetState();
    if (locationChanged) invalidateWeatherCache();

    if (next.locationMode === 'ip') {
      const resolved = await resolveAndPersistLocation();
      return { ok: true, weatherSettings: resolved.weatherSettings, locationLabel: resolved.label };
    }

    return { ok: true, weatherSettings: getSettings(), locationLabel: getSettings().locationLabel };
  }

  async function fetchMonthForecast(year, monthIndex) {
    const y = Number(year);
    const m = Number(monthIndex);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) {
      throw new Error('无效的年月');
    }

    const { lat, lon, label, weatherSettings } = await resolveAndPersistLocation();
    const forecastRange = getForecastableDateRange(y, m, getLocalDateKey());
    if (!forecastRange) {
      return {
        ok: true,
        byDate: {},
        locationLabel: label,
        weatherSettings,
      };
    }
    const { startDate, endDate } = forecastRange;
    const cacheKey = `v4:${lat.toFixed(3)},${lon.toFixed(3)},${startDate},${endDate}`;
    const cached = monthForecastCache.get(cacheKey);
    if (cached && Date.now() - cached.at < MONTH_CACHE_MS) {
      return {
        ok: true,
        byDate: cached.byDate,
        locationLabel: label,
        weatherSettings,
      };
    }
    const byDate = await fetchForecastRange(lat, lon, startDate, endDate);
    monthForecastCache.set(cacheKey, { at: Date.now(), byDate });
    return {
      ok: true,
      byDate,
      locationLabel: label,
      weatherSettings: getSettings(),
    };
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('weather-settings:get', () => getSettings());
    ipcMain.handle('weather:resolve-location', async () => {
      try {
        const resolved = await resolveAndPersistLocation();
        return {
          ok: true,
          locationLabel: resolved.label,
          weatherSettings: resolved.weatherSettings,
        };
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    });
    ipcMain.handle('weather-settings:update', async (_event, payload) => {
      try {
        return await updateSettings(payload);
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    });
    ipcMain.handle('weather:fetch-month', async (_event, payload) => {
      try {
        const input = payload && typeof payload === 'object' ? payload : {};
        return await fetchMonthForecast(input.year, input.monthIndex);
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    });
  }

  return {
    registerIpc,
    normalizeWeatherSettings,
    invalidateWeatherCache,
    DEFAULT_WEATHER_SETTINGS,
  };
}
