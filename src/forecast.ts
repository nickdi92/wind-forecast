import { gustAlert, type GustAlert } from './alerts';
import { directionSpread } from './wind';

/** Subset of the Open-Meteo /v1/forecast response we request. Times are local to the place. */
export interface OpenMeteoResponse {
  timezone: string;
  current: {
    time: string;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
  };
  hourly: {
    time: string[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
  };
  daily: {
    time: string[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
  };
}

export interface HourPoint {
  time: string;
  speed: number;
  gust: number;
  dir: number;
}

export interface DaySummary {
  date: string;
  maxSpeed: number;
  maxGust: number;
  dominantDir: number;
  slots: HourPoint[];
}

export interface Forecast {
  timezone: string;
  current: HourPoint;
  next24: HourPoint[];
  days: DaySummary[];
  /** Direction swing over the next 6 hours, drawn as a sector on the rose. */
  spread: { mean: number; half: number };
  alert: GustAlert | null;
}

/**
 * @param now Wall-clock time at the place ("2026-10-22T13:40"). When cached data is older than
 * the current hour, conditions are read from the hourly forecast instead of the stale `current`.
 */
export function buildForecast(r: OpenMeteoResponse, now?: string): Forecast {
  const h = r.hourly;
  const hours: HourPoint[] = h.time.map((time, i) => ({
    time,
    speed: h.wind_speed_10m[i],
    gust: h.wind_gusts_10m[i],
    dir: h.wind_direction_10m[i],
  }));

  const liveHour = `${r.current.time.slice(0, 13)}:00`;
  const nowHour = now ? `${now.slice(0, 13)}:00` : liveHour;
  const stale = nowHour > liveHour;
  const startHour = stale ? nowHour : liveHour;
  const startIdx = Math.max(0, hours.findIndex((p) => p.time >= startHour));
  const next24 = hours.slice(startIdx, startIdx + 24);
  const today = startHour.slice(0, 10);

  const live: HourPoint = {
    time: r.current.time,
    speed: r.current.wind_speed_10m,
    gust: r.current.wind_gusts_10m,
    dir: r.current.wind_direction_10m,
  };

  const days: DaySummary[] = r.daily.time.map((date, i) => ({
    date,
    maxSpeed: r.daily.wind_speed_10m_max[i],
    maxGust: r.daily.wind_gusts_10m_max[i],
    dominantDir: r.daily.wind_direction_10m_dominant[i],
    slots: hours.filter((p) => p.time.startsWith(date) && Number(p.time.slice(11, 13)) % 3 === 0),
  })).filter((d) => d.date >= today);

  return {
    timezone: r.timezone,
    current: stale && next24[0] ? next24[0] : live,
    next24,
    days,
    spread: directionSpread(next24.slice(0, 6).map((p) => p.dir)),
    alert: gustAlert(next24),
  };
}
