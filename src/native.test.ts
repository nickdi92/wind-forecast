import { describe, expect, it } from 'vitest';
import type { OpenMeteoResponse } from './forecast';
import { isNative, positionError, syncPayload } from './native';

const data: OpenMeteoResponse = {
  timezone: 'Europe/Rome',
  current: { time: '2026-10-22T13:15', wind_speed_10m: 24, wind_gusts_10m: 38, wind_direction_10m: 315 },
  hourly: {
    time: ['2026-10-22T13:00', '2026-10-22T14:00', '2026-10-22T15:00'],
    wind_speed_10m: [22, 25, 27],
    wind_gusts_10m: [35, 41, 44],
    wind_direction_10m: [310, 315, 320],
  },
  daily: { time: [], wind_speed_10m_max: [], wind_gusts_10m_max: [], wind_direction_10m_dominant: [] },
};

const shown = { place: { lat: 40.92, lon: 9.5, name: 'Olbia', detail: 'Sardegna' }, source: 'gps' as const, data, fetchedAt: 1_700 };

describe('syncPayload', () => {
  it('hands the widget the place, unit, live reading and hourly points', () => {
    expect(syncPayload(shown, 'kn')).toEqual({
      place: { lat: 40.92, lon: 9.5, name: 'Olbia' },
      source: 'gps',
      unit: 'kn',
      timezone: 'Europe/Rome',
      current: { time: '2026-10-22T13:15', speed: 24, gust: 38, dir: 315 },
      hours: [
        { time: '2026-10-22T13:00', speed: 22, gust: 35, dir: 310 },
        { time: '2026-10-22T14:00', speed: 25, gust: 41, dir: 315 },
        { time: '2026-10-22T15:00', speed: 27, gust: 44, dir: 320 },
      ],
      fetchedAt: 1_700,
    });
  });

  it('skips hours with missing values instead of sending nulls', () => {
    const gappy = structuredClone(data);
    (gappy.hourly.wind_gusts_10m as (number | null)[])[1] = null;
    expect(syncPayload({ ...shown, data: gappy }, 'kmh').hours.map((h) => h.time)).toEqual(['2026-10-22T13:00', '2026-10-22T15:00']);
  });
});

describe('positionError', () => {
  it('maps denied, disabled and restricted location to code 1 like the browser API', () => {
    expect(positionError({ code: 'OS-PLUG-GLOC-0003' }).code).toBe(1);
    expect(positionError({ code: 'OS-PLUG-GLOC-0007' }).code).toBe(1);
    expect(positionError({ code: 'OS-PLUG-GLOC-0008' }).code).toBe(1);
  });

  it('treats everything else as position unavailable', () => {
    expect(positionError({ code: 'OS-PLUG-GLOC-0010' }).code).toBe(2);
    expect(positionError(new Error('boom')).code).toBe(2);
  });
});

it('is not native in tests', () => {
  expect(isNative).toBe(false);
});
