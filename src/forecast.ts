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
    /** mm in the hour ending at `time`. Rain fields are missing from forecasts cached before rain was added. */
    precipitation?: (number | null)[];
    /** % chance of at least 0.1 mm in the hour ending at `time`. */
    precipitation_probability?: (number | null)[];
  };
  daily: {
    time: string[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
    precipitation_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

export interface HourPoint {
  time: string;
  speed: number;
  gust: number;
  dir: number;
  /** mm expected from `time` to the next point. */
  rain: number;
  /** % chance of rain in the same span. */
  rainChance: number;
}

export interface DaySummary {
  date: string;
  maxSpeed: number;
  maxGust: number;
  dominantDir: number;
  /** mm over the whole day. */
  rain: number;
  rainChance: number;
  /** Every third hour; rain covers the three hours each slot stands for. */
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
 * Wind is a reading at `time`, while Open-Meteo stamps rain at the end of the hour it fell in:
 * shift rain back one hour so each point says what to expect from its own hour on.
 */
export function hourPoints(h: OpenMeteoResponse['hourly']): HourPoint[] {
  return h.time.map((time, i) => ({
    time,
    speed: h.wind_speed_10m[i],
    gust: h.wind_gusts_10m[i],
    dir: h.wind_direction_10m[i],
    rain: h.precipitation?.[i + 1] ?? 0,
    rainChance: h.precipitation_probability?.[i + 1] ?? 0,
  }));
}

function threeHourSlot(hours: HourPoint[], i: number): HourPoint {
  const span = hours.slice(i, i + 3);
  return {
    ...hours[i],
    rain: span.reduce((sum, p) => sum + p.rain, 0),
    rainChance: Math.max(...span.map((p) => p.rainChance)),
  };
}

/**
 * @param now Wall-clock time at the place ("2026-10-22T13:40"). When cached data is older than
 * the current hour, conditions are read from the hourly forecast instead of the stale `current`.
 */
export function buildForecast(r: OpenMeteoResponse, now?: string): Forecast {
  const hours = hourPoints(r.hourly);

  const liveHour = `${r.current.time.slice(0, 13)}:00`;
  const nowHour = now ? `${now.slice(0, 13)}:00` : liveHour;
  const stale = nowHour > liveHour;
  const startHour = stale ? nowHour : liveHour;
  const startIdx = Math.max(0, hours.findIndex((p) => p.time >= startHour));
  const next24 = hours.slice(startIdx, startIdx + 24);
  const today = startHour.slice(0, 10);

  // Rain is not asked for the 15-minute reading: take the forecast for its hour.
  const liveRain = hours.find((p) => p.time === liveHour);
  const live: HourPoint = {
    time: r.current.time,
    speed: r.current.wind_speed_10m,
    gust: r.current.wind_gusts_10m,
    dir: r.current.wind_direction_10m,
    rain: liveRain?.rain ?? 0,
    rainChance: liveRain?.rainChance ?? 0,
  };

  const days: DaySummary[] = r.daily.time.map((date, i) => ({
    date,
    maxSpeed: r.daily.wind_speed_10m_max[i],
    maxGust: r.daily.wind_gusts_10m_max[i],
    dominantDir: r.daily.wind_direction_10m_dominant[i],
    rain: r.daily.precipitation_sum?.[i] ?? 0,
    rainChance: r.daily.precipitation_probability_max?.[i] ?? 0,
    slots: hours.flatMap((p, j) => (p.time.startsWith(date) && Number(p.time.slice(11, 13)) % 3 === 0 ? [threeHourSlot(hours, j)] : [])),
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
