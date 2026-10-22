import { describe, expect, it } from 'vitest';
import { buildForecast, type OpenMeteoResponse } from './forecast';

const DAYS = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];

function fixture(currentTime = '2026-10-22T13:15'): OpenMeteoResponse {
  const time: string[] = [];
  const speed: number[] = [];
  const gust: number[] = [];
  const dir: number[] = [];
  DAYS.forEach((d, di) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${d}T${String(h).padStart(2, '0')}:00`);
      speed.push(di * 100 + h); // encodes day and hour so tests can tell points apart
      gust.push(di * 100 + h + 0.5);
      dir.push(h < 12 ? 300 : 320);
    }
  });
  return {
    timezone: 'Europe/Rome',
    current: { time: currentTime, wind_speed_10m: 24, wind_gusts_10m: 38, wind_direction_10m: 315 },
    hourly: { time, wind_speed_10m: speed, wind_gusts_10m: gust, wind_direction_10m: dir },
    daily: {
      time: DAYS,
      wind_speed_10m_max: [28, 18, 9, 14, 20],
      wind_gusts_10m_max: [46, 29, 15, 22, 33],
      wind_direction_10m_dominant: [315, 270, 135, 140, 0],
    },
  };
}

describe('buildForecast', () => {
  it('reads current conditions', () => {
    expect(buildForecast(fixture()).current).toEqual({
      time: '2026-10-22T13:15',
      speed: 24,
      gust: 38,
      dir: 315,
    });
  });

  it('lists the next 24 hours starting from the current hour', () => {
    const { next24 } = buildForecast(fixture());
    expect(next24).toHaveLength(24);
    expect(next24[0]).toEqual({ time: '2026-10-22T13:00', speed: 13, gust: 13.5, dir: 320 });
    expect(next24[23].time).toBe('2026-10-23T12:00');
  });

  it('summarises each day with its dominant wind', () => {
    const { days } = buildForecast(fixture());
    expect(days).toHaveLength(5);
    expect(days[2]).toMatchObject({ date: '2026-10-24', maxSpeed: 9, maxGust: 15, dominantDir: 135 });
  });

  it('gives each day a 3-hourly breakdown', () => {
    const { days } = buildForecast(fixture());
    expect(days[1].slots.map((s) => s.time.slice(11, 13))).toEqual(['00', '03', '06', '09', '12', '15', '18', '21']);
    expect(days[1].slots[4].speed).toBe(112);
  });

  it('measures how much the direction swings over the next 6 hours', () => {
    const { spread } = buildForecast(fixture('2026-10-22T09:00'));
    // 09-11 at 300°, 12-14 at 320°
    expect(spread.mean).toBeCloseTo(310, 0);
    expect(spread.half).toBeCloseTo(10, 0);
  });

  it('attaches the gust alert for the next 24 hours', () => {
    expect(buildForecast(fixture()).alert?.level).toBe('pericolo');
  });

  it('keeps the timezone of the place', () => {
    expect(buildForecast(fixture()).timezone).toBe('Europe/Rome');
  });

  it('re-anchors on the present hour when cached data is stale', () => {
    const f = buildForecast(fixture(), '2026-10-24T08:10');
    expect(f.current).toEqual({ time: '2026-10-24T08:00', speed: 208, gust: 208.5, dir: 300 });
    expect(f.next24[0].time).toBe('2026-10-24T08:00');
  });

  it('drops past days from stale data', () => {
    const f = buildForecast(fixture(), '2026-10-24T08:10');
    expect(f.days.map((d) => d.date)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('keeps live current conditions when data is fresh', () => {
    expect(buildForecast(fixture(), '2026-10-22T13:40').current.speed).toBe(24);
  });
});
