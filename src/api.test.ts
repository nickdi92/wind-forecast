import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchForecast, fetchMarine } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchForecast', () => {
  it('asks Open-Meteo for hourly and daily rain, snow, sky and daylight next to the wind', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await fetchForecast(45.65, 13.78);
    const q = new URL(fetch.mock.calls[0][0]).searchParams;
    expect(q.get('hourly')).toBe(
      'wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,precipitation_probability,snowfall,temperature_2m,apparent_temperature,cloud_cover,is_day',
    );
    expect(q.get('current')).toBe('wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,apparent_temperature');
    expect(q.get('daily')).toBe(
      'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,precipitation_probability_max,snowfall_sum,sunrise,sunset,daylight_duration',
    );
  });
});

describe('fetchMarine', () => {
  it('asks Open-Meteo Marine for waves, wind sea and swell from the nearest sea cell', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await fetchMarine(40.92, 9.5);
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.hostname).toBe('marine-api.open-meteo.com');
    expect(url.searchParams.get('hourly')).toBe(
      'wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,swell_wave_height,swell_wave_direction,swell_wave_period',
    );
    expect(url.searchParams.get('cell_selection')).toBe('sea');
    expect(url.searchParams.has('apikey')).toBe(false);
  });

  it('rejects on HTTP errors so the app can say the sea is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(fetchMarine(40.92, 9.5)).rejects.toThrow('HTTP 503');
  });
});
