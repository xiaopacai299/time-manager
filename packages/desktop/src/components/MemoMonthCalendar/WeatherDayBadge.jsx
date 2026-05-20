import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react';
import { getTemperatureColor } from './weatherTempColor.js';

/**
 * @param {object} props
 * @param {{ kind?: string, label?: string, tempMax?: number | null, title?: string }} props.weather
 * @param {'sm' | 'md'} [props.size]
 * @param {boolean} [props.iconOnly] 仅图标（用于「今天」按钮）
 * @param {string} [props.className]
 */
export default function WeatherDayBadge({
  weather,
  size = 'sm',
  iconOnly = false,
  className = '',
}) {
  if (!weather || (weather.kind === 'unknown' && weather.tempMax == null && !weather.label)) {
    return null;
  }

  const kind = weather.kind || 'unknown';
  const temp = weather.tempMax;
  const hasTemp = temp != null && Number.isFinite(Number(temp));
  const title = weather.title || [weather.label, hasTemp ? `最高 ${temp}°` : ''].filter(Boolean).join(' ');
  const iconSize = size === 'md' ? 16 : 14;
  const stroke = 2.35;

  const iconEl = renderWeatherIcon(kind, iconSize, stroke);
  if (!iconEl && !hasTemp) return null;

  return (
    <span
      className={['memo-cal__weather', size === 'md' ? 'memo-cal__weather--md' : '', className]
        .filter(Boolean)
        .join(' ')}
      title={title}
    >
      {iconEl ? (
        <span className={`memo-cal__weather-icon memo-cal__weather-icon--${kind}`} aria-hidden="true">
          {iconEl}
        </span>
      ) : null}
      {hasTemp && !iconOnly ? (
        <span
          className="memo-cal__weather-temp"
          style={{ color: getTemperatureColor(temp) }}
        >
          {Math.round(Number(temp))}°
        </span>
      ) : null}
    </span>
  );
}

/**
 * 方案 B：Lucide 单体图标（CloudSun、CloudRain 等）
 * @param {string} kind
 * @param {number} size
 * @param {number} strokeWidth
 */
function renderWeatherIcon(kind, size, strokeWidth) {
  const props = {
    size,
    strokeWidth,
    className: 'memo-cal__weather-glyph',
    'aria-hidden': true,
  };

  switch (kind) {
    case 'clear':
      return <Sun {...props} />;
    case 'partly-cloudy':
      return <CloudSun {...props} />;
    case 'fog':
      return <CloudFog {...props} />;
    case 'drizzle':
      return <CloudDrizzle {...props} />;
    case 'rain':
      return <CloudRain {...props} />;
    case 'snow':
      return <CloudSnow {...props} />;
    case 'thunder':
      return <CloudLightning {...props} />;
    default:
      return <Cloud {...props} />;
  }
}

/**
 * @param {{ kind?: string, label?: string, tempMax?: number | null }} [weather]
 */
export function hasWeatherDisplay(weather) {
  if (!weather) return false;
  if (weather.kind && weather.kind !== 'unknown') return true;
  if (weather.label) return true;
  return weather.tempMax != null && Number.isFinite(Number(weather.tempMax));
}
