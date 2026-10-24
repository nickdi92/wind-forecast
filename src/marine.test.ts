import { describe, expect, it } from 'vitest';
import type { HourPoint } from './forecast';
import {
  buildSea,
  distanceKm,
  mLabel,
  seaDays,
  seaDaysCopy,
  seaHeadline,
  seaOrigin,
  seaOriginCopy,
  seaState,
  seaTrend,
  seaTrendCopy,
  type MarineResponse,
  type SeaPoint,
} from './marine';

const OLBIA = { lat: 40.92, lon: 9.5 };

/** 72 hours from midnight on 24 Oct; `height(i)` gives the wave height of hour i. */
function response(height: (i: number) => number | null, extra: Partial<MarineResponse['hourly']> = {}): MarineResponse {
  const time = Array.from({ length: 72 }, (_, i) => new Date(Date.UTC(2026, 9, 24, i)).toISOString().slice(0, 16));
  const hs = time.map((_, i) => height(i));
  return {
    latitude: 41.041664,
    longitude: 9.625015,
    hourly: {
      time,
      wave_height: hs,
      wave_direction: hs.map((h) => (h == null ? null : 300)),
      wave_period: hs.map((h) => (h == null ? null : 4)),
      wind_wave_height: hs,
      wind_wave_direction: hs.map((h) => (h == null ? null : 300)),
      swell_wave_height: hs.map((h) => (h == null ? null : 0.1)),
      swell_wave_direction: hs.map((h) => (h == null ? null : 330)),
      swell_wave_period: hs.map((h) => (h == null ? null : 6)),
      ...extra,
    },
  };
}

const point = (p: Partial<SeaPoint>): SeaPoint => ({
  time: '2026-10-24T11:00',
  height: 1,
  dir: 300,
  period: 4,
  windWave: 1,
  windWaveDir: 300,
  swell: 0.1,
  swellDir: 330,
  swellPeriod: 6,
  ...p,
});

const wind = (speed: number): HourPoint => ({ time: '2026-10-24T11:00', speed, gust: speed * 1.4, dir: 315, rain: 0, rainChance: 0 });

describe('seaState (Douglas scale)', () => {
  it.each([
    [0, 0, 'calmo'],
    [0.05, 1, 'quasi calmo'],
    [0.3, 2, 'poco mosso'],
    [0.5, 2, 'poco mosso'],
    [0.8, 3, 'mosso'],
    [1.25, 3, 'mosso'],
    [2, 4, 'molto mosso'],
    [3, 5, 'agitato'],
    [5, 6, 'molto agitato'],
    [7, 7, 'grosso'],
    [10, 8, 'molto grosso'],
    [15, 9, 'tempestoso'],
  ])('%f m is degree %i, %s', (m, degree, label) => {
    expect(seaState(m)).toEqual({ degree, label });
  });
});

describe('buildSea', () => {
  it('starts from the current hour and says how far the sea cell is', () => {
    const sea = buildSea(response((i) => 0.4 + i * 0.01), OLBIA, '2026-10-24T11:40')!;
    expect(sea.now.time).toBe('2026-10-24T11:00');
    expect(sea.now.height).toBeCloseTo(0.51);
    expect(sea.ahead).toHaveLength(61);
    expect(sea.distance).toBeGreaterThan(14);
    expect(sea.distance).toBeLessThan(19);
  });

  it('has no sea inland, where every value is null', () => {
    expect(buildSea(response(() => null), { lat: 40.32, lon: 9.33 }, '2026-10-24T11:40')).toBeNull();
  });

  it('tolerates missing data and old caches', () => {
    expect(buildSea(undefined, OLBIA, '2026-10-24T11:40')).toBeNull();
    expect(buildSea(null, OLBIA, '2026-10-24T11:40')).toBeNull();
    expect(buildSea(response((i) => (i % 2 ? null : 0.5)), OLBIA, '2026-10-24T11:40')!.now.time).toBe('2026-10-24T12:00');
  });

  it('keeps missing parts as null rather than zero', () => {
    const r = response(() => 0.5, { swell_wave_height: Array(72).fill(null) });
    expect(buildSea(r, OLBIA, '2026-10-24T11:40')!.now.swell).toBeNull();
  });
});

describe('distanceKm', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm(39.2, 9.11, 40.92, 9.5)).toBeCloseTo(194, -1); // Cagliari to Olbia
  });
});

describe('seaTrend', () => {
  it('sees the sea building', () => {
    const sea = buildSea(response((i) => (i < 12 ? 0.6 : 0.6 + (i - 12) * 0.08)), OLBIA, '2026-10-24T11:00')!;
    const t = seaTrend(sea);
    expect(t.kind).toBe('aumento');
    expect(seaTrendCopy(t, '2026-10-24')).toMatch(/^in aumento fino a 2,4 m domattina$/);
  });

  it('sees the sea going down', () => {
    const sea = buildSea(response((i) => Math.max(0.2, 2 - i * 0.05)), OLBIA, '2026-10-24T00:00')!;
    expect(seaTrend(sea).kind).toBe('calo');
  });

  it('ignores changes inside the same degree', () => {
    const sea = buildSea(response((i) => 0.6 + (i % 3) * 0.1), OLBIA, '2026-10-24T00:00')!;
    expect(seaTrend(sea).kind).toBe('stabile');
  });
});

describe('seaOrigin', () => {
  it('tells wind sea from leftover swell', () => {
    expect(seaOrigin(point({ height: 0.1 }))).toBe('calmo');
    expect(seaOrigin(point({ height: 0.9, windWave: 0.85, swell: 0.1 }))).toBe('vivo');
    expect(seaOrigin(point({ height: 0.9, windWave: 0.2, swell: 0.8 }))).toBe('residuo');
    expect(seaOrigin(point({ height: 0.9, windWave: 0.5, swell: 0.45 }))).toBe('misto');
  });

  it('calls swell under a light wind leftover sea', () => {
    expect(seaOriginCopy(point({ height: 0.9, windWave: 0.2, swell: 0.8, swellDir: 270 }), wind(8))).toBe(
      'Prevale l’onda lunga da ovest (0,8 m, periodo 6 s), arrivata da lontano e non alzata dal vento locale. Il vento qui è debole: è mare residuo, che può restare anche quando il vento è calato.',
    );
  });

  it('flags crossed seas', () => {
    expect(seaOriginCopy(point({ height: 0.9, windWave: 0.5, windWaveDir: 300, swell: 0.45, swellDir: 200 }), wind(20))).toContain('mare incrociato');
  });

  it('explains strong wind over low waves without inventing a height', () => {
    expect(seaOriginCopy(point({ height: 0.3, windWave: 0.3, swell: 0 }), wind(40))).toContain('soffia da terra');
  });
});

describe('copy', () => {
  it('formats metres the Italian way', () => {
    expect(mLabel(0.8)).toBe('0,8 m');
    expect(mLabel(1.24)).toBe('1,2 m');
    expect(mLabel(2)).toBe('2 m');
    expect(mLabel(0.02)).toBe('meno di 0,1 m');
  });

  it('describes the sea now', () => {
    expect(seaHeadline(point({ height: 0.8, dir: 300 }))).toBe('Mosso, onde di 0,8 m da nord-ovest');
    expect(seaHeadline(point({ height: 0.3, dir: null }))).toBe('Poco mosso, onde di 0,3 m');
  });

  it('gives the highest waves of the next three days', () => {
    const sea = buildSea(response((i) => (i < 24 ? 1.4 : i < 48 ? 0.8 : 0.3)), OLBIA, '2026-10-24T11:00')!;
    expect(seaDays(sea).map((p) => p.height)).toEqual([1.4, 0.8, 0.3]);
    expect(seaDaysCopy(sea, '2026-10-24')).toBe('Oggi fino a 1,4 m, domani 0,8 m, lunedì 0,3 m.');
  });
});
