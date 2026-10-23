import { describe, expect, it } from 'vitest';
import { buildForecast, type OpenMeteoResponse } from './forecast';

const DAYS = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];

function fixture(currentTime = '2026-10-22T13:15'): OpenMeteoResponse {
  const time: string[] = [];
  const speed: number[] = [];
  const gust: number[] = [];
  const dir: number[] = [];
  const rain: number[] = [];
  const chance: number[] = [];
  DAYS.forEach((d, di) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${d}T${String(h).padStart(2, '0')}:00`);
      speed.push(di * 100 + h); // encodes day and hour so tests can tell points apart
      gust.push(di * 100 + h + 0.5);
      dir.push(h < 12 ? 300 : 320);
      // Open-Meteo stamps rain at the end of the hour it fell in: 1.2 mm between 13 and 14, 0.4 mm between 14 and 15.
      rain.push(h === 14 ? 1.2 : h === 15 ? 0.4 : 0);
      chance.push(h * 2);
    }
  });
  return {
    timezone: 'Europe/Rome',
    current: { time: currentTime, wind_speed_10m: 24, wind_gusts_10m: 38, wind_direction_10m: 315 },
    hourly: {
      time,
      wind_speed_10m: speed,
      wind_gusts_10m: gust,
      wind_direction_10m: dir,
      precipitation: rain,
      precipitation_probability: chance,
    },
    daily: {
      time: DAYS,
      wind_speed_10m_max: [28, 18, 9, 14, 20],
      wind_gusts_10m_max: [46, 29, 15, 22, 33],
      wind_direction_10m_dominant: [315, 270, 135, 140, 0],
      precipitation_sum: [1.6, 3.2, 0, 1, 0],
      precipitation_probability_max: [46, 80, 0, 40, 5],
    },
  };
}

describe('buildForecast', () => {
  it('reads current conditions, with the rain expected this hour', () => {
    expect(buildForecast(fixture()).current).toEqual({
      time: '2026-10-22T13:15',
      speed: 24,
      gust: 38,
      dir: 315,
      rain: 1.2,
      rainChance: 28,
    });
  });

  it('lists the next 24 hours starting from the current hour', () => {
    const { next24 } = buildForecast(fixture());
    expect(next24).toHaveLength(24);
    expect(next24[0]).toEqual({ time: '2026-10-22T13:00', speed: 13, gust: 13.5, dir: 320, rain: 1.2, rainChance: 28 });
    expect(next24[23].time).toBe('2026-10-23T12:00');
  });

  it('gives each hour the rain that falls during it, not in the hour before', () => {
    const { next24 } = buildForecast(fixture());
    expect(next24[1]).toMatchObject({ time: '2026-10-22T14:00', rain: 0.4, rainChance: 30 });
    expect(next24[2]).toMatchObject({ time: '2026-10-22T15:00', rain: 0, rainChance: 32 });
  });

  it('treats missing rain values as dry', () => {
    const r = fixture();
    (r.hourly.precipitation_probability as (number | null)[])[14] = null;
    expect(buildForecast(r).next24[0].rainChance).toBe(0);
  });

  it('reads forecasts cached before rain was added as dry', () => {
    const r = fixture();
    delete r.hourly.precipitation;
    delete r.hourly.precipitation_probability;
    delete r.daily.precipitation_sum;
    delete r.daily.precipitation_probability_max;
    const f = buildForecast(r);
    expect(f.current).toMatchObject({ rain: 0, rainChance: 0 });
    expect(f.days[1]).toMatchObject({ rain: 0, rainChance: 0 });
  });

  it('summarises each day with its dominant wind', () => {
    const { days } = buildForecast(fixture());
    expect(days).toHaveLength(5);
    expect(days[2]).toMatchObject({ date: '2026-10-24', maxSpeed: 9, maxGust: 15, dominantDir: 135 });
  });

  it('gives each day its total rain and highest chance of rain', () => {
    expect(buildForecast(fixture()).days[1]).toMatchObject({ rain: 3.2, rainChance: 80 });
  });

  it('gives each day a 3-hourly breakdown', () => {
    const { days } = buildForecast(fixture());
    expect(days[1].slots.map((s) => s.time.slice(11, 13))).toEqual(['00', '03', '06', '09', '12', '15', '18', '21']);
    expect(days[1].slots[4].speed).toBe(112);
  });

  it('sums the rain of the three hours each slot stands for', () => {
    const { days } = buildForecast(fixture());
    // The 12 slot covers 12-15: 1.2 mm between 13 and 14, 0.4 mm between 14 and 15.
    expect(days[1].slots[4].rain).toBeCloseTo(1.6, 5);
    expect(days[1].slots[4].rainChance).toBe(30);
  });

  it('counts no rain past the end of the forecast', () => {
    expect(buildForecast(fixture()).days[4].slots[7]).toMatchObject({ time: '2026-10-26T21:00', rain: 0 });
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

  it('attaches the first rain spell of the next 24 hours', () => {
    // 13:00 has 1.2 mm at 28%: a blip. 14:00 has 0.4 mm at 30%.
    expect(buildForecast(fixture()).rainSpell).toMatchObject({
      start: '2026-10-22T14:00',
      end: '2026-10-22T14:00',
      wet: true,
      ongoing: false,
      spread: { mean: 320 },
    });
  });

  it('keeps the timezone of the place', () => {
    expect(buildForecast(fixture()).timezone).toBe('Europe/Rome');
  });

  it('re-anchors on the present hour when cached data is stale', () => {
    const f = buildForecast(fixture(), '2026-10-24T08:10');
    expect(f.current).toEqual({ time: '2026-10-24T08:00', speed: 208, gust: 208.5, dir: 300, rain: 0, rainChance: 18 });
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
