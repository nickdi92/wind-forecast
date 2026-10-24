import { afterEach, describe, expect, it } from 'vitest';
import {
  angleBetween,
  beaufort,
  BEAUFORT_FROM,
  beaufortEffects,
  beaufortLabel,
  beaufortRange,
  convertSpeed,
  directionSpread,
  intensityWord,
  mediterraneanNames,
  speedLabel,
  useWindNaming,
  windFrom,
  windInSentence,
  windRose,
  windTowards,
} from './wind';

describe('windFrom', () => {
  it.each([
    [0, 'Tramontana', 'N'],
    [45, 'Grecale', 'NE'],
    [90, 'Levante', 'E'],
    [135, 'Scirocco', 'SE'],
    [180, 'Ostro', 'S'],
    [225, 'Libeccio', 'SO'],
    [270, 'Ponente', 'O'],
    [315, 'Maestrale', 'NO'],
  ])('names wind coming from %i° as %s', (deg, name, cardinal) => {
    expect(windFrom(deg)).toMatchObject({ name, cardinal });
  });

  it('splits sectors halfway between points', () => {
    expect(windFrom(337).name).toBe('Maestrale');
    expect(windFrom(338).name).toBe('Tramontana');
    expect(windFrom(22).name).toBe('Tramontana');
    expect(windFrom(23).name).toBe('Grecale');
  });

  it('normalizes angles outside 0-360', () => {
    expect(windFrom(360).name).toBe('Tramontana');
    expect(windFrom(-45).name).toBe('Maestrale');
    expect(windFrom(495).name).toBe('Scirocco');
  });

  it('marks southern winds as warm', () => {
    expect(windFrom(135).warm).toBe(true);
    expect(windFrom(180).warm).toBe(true);
    expect(windFrom(225).warm).toBe(true);
    expect(windFrom(315).warm).toBe(false);
    expect(windFrom(0).warm).toBe(false);
  });
});

describe('beaufort', () => {
  it.each([
    [0, 0, 'Calma'],
    [3, 1, 'Bava di vento'],
    [8, 2, 'Brezza leggera'],
    [15, 3, 'Brezza tesa'],
    [24, 4, 'Vento moderato'],
    [33, 5, 'Vento teso'],
    [44, 6, 'Vento fresco'],
    [55, 7, 'Vento forte'],
    [68, 8, 'Burrasca moderata'],
    [80, 9, 'Burrasca forte'],
    [95, 10, 'Tempesta'],
    [110, 11, 'Fortunale'],
    [130, 12, 'Uragano'],
  ])('%i km/h is force %i (%s)', (kmh, force, label) => {
    expect(beaufort(kmh)).toEqual({ force, label });
  });

  it('uses lower bound of each band', () => {
    expect(beaufort(0.9).force).toBe(0);
    expect(beaufort(1).force).toBe(1);
    expect(beaufort(118).force).toBe(12);
  });
});

describe('convertSpeed', () => {
  it('keeps km/h rounded', () => {
    expect(convertSpeed(24.4, 'kmh')).toBe(24);
  });

  it('converts to knots', () => {
    expect(convertSpeed(37.04, 'kn')).toBe(20);
  });

  it('converts to m/s', () => {
    expect(convertSpeed(36, 'ms')).toBe(10);
  });
});

describe('directionSpread', () => {
  it('returns mean and half-width of a tight cluster', () => {
    const s = directionSpread([300, 310, 320]);
    expect(s.mean).toBeCloseTo(310, 0);
    expect(s.half).toBeCloseTo(10, 0);
  });

  it('handles clusters across north', () => {
    const s = directionSpread([350, 10]);
    expect(Math.min(s.mean, 360 - s.mean)).toBeLessThan(0.5);
    expect(s.half).toBeCloseTo(10, 0);
  });

  it('enforces a minimum half-width', () => {
    expect(directionSpread([90, 90, 90]).half).toBe(8);
  });

  it('caps half-width at 90°', () => {
    expect(directionSpread([0, 90, 180, 270]).half).toBe(90);
  });
});

describe('windTowards', () => {
  it.each([
    [315, 'sud-est'],
    [0, 'sud'],
    [135, 'nord-ovest'],
    [270, 'est'],
  ])('wind from %i° blows towards %s', (deg, to) => {
    expect(windTowards(deg)).toBe(to);
  });
});

describe('angleBetween', () => {
  it('measures the short way round', () => {
    expect(angleBetween(350, 10)).toBe(20);
    expect(angleBetween(10, 350)).toBe(20);
    expect(angleBetween(90, 270)).toBe(180);
  });
});

describe('Beaufort scale', () => {
  it('uses the official WMO bands in every unit', () => {
    expect(BEAUFORT_FROM.kmh).toEqual([0, 1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]);
    expect(BEAUFORT_FROM.kn).toEqual([0, 1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64]);
    expect(BEAUFORT_FROM.ms).toEqual([0, 0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]);
  });

  it('keeps the km/h bands consistent with the other units', () => {
    // The WMO tables are rounded separately (force 5 starts at 17 kn but 8.0 m/s, i.e. 15.6 kn): close, not equal.
    BEAUFORT_FROM.ms.forEach((ms, f) => {
      expect(Math.abs(BEAUFORT_FROM.kmh[f] - ms * 3.6)).toBeLessThanOrEqual(1);
      expect(Math.abs(BEAUFORT_FROM.kn[f] - (ms * 3.6) / 1.852)).toBeLessThan(1.5);
    });
  });

  it.each([
    [0, 'kmh', 'meno di 1 km/h'],
    [4, 'kmh', '20–28 km/h'],
    [4, 'kn', '11–16 nodi'],
    [4, 'ms', '5,5–7,9 m/s'],
    [7, 'kmh', '50–61 km/h'],
    [12, 'kmh', 'da 118 km/h'],
    [12, 'ms', 'da 32,7 m/s'],
  ] as const)('force %i in %s spans %s', (force, unit, range) => {
    expect(beaufortRange(force, unit)).toBe(range);
  });

  it('describes what each force looks like on land and at sea', () => {
    for (let f = 0; f <= 12; f++) {
      const e = beaufortEffects(f);
      expect(e.land.length).toBeGreaterThan(5);
      expect(e.sea.length).toBeGreaterThan(5);
    }
    expect(beaufortEffects(0).land).toContain('fumo');
    expect(beaufortLabel(6)).toBe('Vento fresco');
  });
});

describe('intensityWord', () => {
  it.each([
    [10, false, 'debole'],
    [24, false, 'moderato'],
    [24, true, 'moderata'],
    [33, false, 'teso'],
    [33, true, 'tesa'],
    [45, false, 'forte'],
    [70, false, 'di burrasca'],
    [95, false, 'di tempesta'],
  ])('%i km/h (feminine %s) is %s', (kmh, fem, word) => {
    expect(intensityWord(kmh, fem)).toBe(word);
  });
});

describe('speedLabel', () => {
  it('converts and adds the unit', () => {
    expect(speedLabel(37.04, 'kn')).toBe('20 nodi');
    expect(speedLabel(36, 'ms')).toBe('10 m/s');
  });
});

describe('useWindNaming', () => {
  afterEach(() => useWindNaming('mediterraneo'));

  it('uses plain directions away from the Mediterranean', () => {
    useWindNaming('direzioni');
    expect(mediterraneanNames()).toBe(false);
    expect(windFrom(315)).toMatchObject({ name: 'Nord-ovest', direction: 'nord-ovest', cardinal: 'NO' });
    expect(windFrom(0).feminine).toBe(false);
    expect(windRose().map((w) => w.name)).toEqual(['Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-ovest', 'Ovest', 'Nord-ovest']);
    expect(windInSentence(windFrom(135))).toBe('sud-est');
  });

  it('keeps southerlies warm only where asked', () => {
    useWindNaming('direzioni', true);
    expect(windFrom(180).warm).toBe(true);
    useWindNaming('direzioni', false);
    expect(windFrom(180).warm).toBe(false);
  });

  it('goes back to the Mediterranean names', () => {
    useWindNaming('direzioni');
    useWindNaming('mediterraneo');
    expect(windFrom(315).name).toBe('Maestrale');
    expect(windInSentence(windFrom(135))).toBe('Scirocco');
  });
});
