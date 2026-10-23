import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchForecast } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchForecast', () => {
  it('asks Open-Meteo for hourly and daily rain next to the wind', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await fetchForecast(45.65, 13.78);
    const q = new URL(fetch.mock.calls[0][0]).searchParams;
    expect(q.get('hourly')).toBe('wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,precipitation_probability');
    expect(q.get('daily')).toBe(
      'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,precipitation_probability_max',
    );
  });
});
