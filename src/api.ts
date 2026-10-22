import type { OpenMeteoResponse } from './forecast';

export interface Place {
  lat: number;
  lon: number;
  name: string;
  /** Region and country, shown under the name in search results. */
  detail?: string;
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const WIND_VARS = 'wind_speed_10m,wind_gusts_10m,wind_direction_10m';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

export function fetchForecast(lat: number, lon: number): Promise<OpenMeteoResponse> {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: WIND_VARS,
    hourly: WIND_VARS,
    daily: 'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
    timezone: 'auto',
    forecast_days: '5',
    wind_speed_unit: 'kmh',
  });
  return getJson<OpenMeteoResponse>(`${FORECAST_URL}?${q}`);
}

interface GeocodeResult {
  results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[];
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = new URLSearchParams({ name: query, count: '8', language: 'it', format: 'json' });
  const data = await getJson<GeocodeResult>(`${GEOCODE_URL}?${q}`, signal);
  return (data.results ?? []).map((r) => ({
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

interface ReverseResult {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
}

export async function placeName(lat: number, lon: number): Promise<string | null> {
  const q = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: 'it' });
  try {
    const r = await getJson<ReverseResult>(`${REVERSE_URL}?${q}`, AbortSignal.timeout(4_000));
    return r.city || r.locality || r.principalSubdivision || null;
  } catch {
    return null;
  }
}

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocalizzazione non supportata'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 10 * 60_000,
    });
  });
}
