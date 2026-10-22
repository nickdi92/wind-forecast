import { describe, expect, it } from 'vitest';
import { beaufort, convertSpeed, directionSpread, windFrom } from './wind';

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
