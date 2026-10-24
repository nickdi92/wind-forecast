import { describe, expect, it } from 'vitest';
import type { HourPoint } from './forecast';
import { rainLabel, rainShort, rainSpell, rainSpellCopy, type RainSpell } from './rain';
import { useWindNaming } from './wind';

const DRY: [number, number] = [0, 0];
const WET: [number, number] = [1, 80];
const MAYBE: [number, number] = [0, 40];

/** Hourly points from 13:00; each entry is [rain mm, chance %, wind from °, speed km/h]. */
const hours = (spec: ([number, number] | [number, number, number] | [number, number, number, number])[]): HourPoint[] =>
  spec.map(([rain, rainChance, dir = 135, speed = 20], i) => ({
    time: `2026-10-22T${String(13 + i).padStart(2, '0')}:00`,
    speed,
    gust: speed * 1.5,
    dir,
    rain,
    rainChance,
  }));

describe('rainLabel', () => {
  it.each([
    [0, 10, 'Niente pioggia'],
    [0.05, 20, 'Niente pioggia'],
    [0, 30, 'Pioggia possibile, 30%'],
    [0, 64.6, 'Pioggia possibile, 65%'],
    [0.1, 20, 'Pioggia debole, 0,1 mm'],
    [0.44, 60, 'Pioggia debole, 0,4 mm'],
    [2.5, 80, 'Pioggia moderata, 2,5 mm'],
    [3, 90, 'Pioggia moderata, 3 mm'],
    [7.6, 90, 'Pioggia forte, 7,6 mm'],
    [12.34, 95, 'Pioggia forte, 12 mm'],
  ])('%f mm, chance %f → %s', (rain, rainChance, label) => {
    expect(rainLabel({ rain, rainChance })).toBe(label);
  });
});

describe('rainShort', () => {
  it('says nothing when it stays dry', () => {
    expect(rainShort({ rain: 0.05, rainChance: 29 })).toBeNull();
  });

  it('gives the chance when rain is only possible', () => {
    expect(rainShort({ rain: 0, rainChance: 40 })).toBe('40%');
  });

  it('gives the amount when rain is expected', () => {
    expect(rainShort({ rain: 1.62, rainChance: 20 })).toBe('1,6 mm');
  });
});

describe('rainSpell', () => {
  it('is null when the next hours stay dry', () => {
    expect(rainSpell(hours([DRY, [0.05, 29], DRY]))).toBeNull();
  });

  it('spans the first stretch of expected rain', () => {
    expect(rainSpell(hours([DRY, DRY, WET, WET, DRY, DRY, DRY]))).toMatchObject({
      start: '2026-10-22T15:00',
      end: '2026-10-22T16:00',
      wet: true,
      ongoing: false,
    });
  });

  it('prefers expected rain over earlier rain that is only possible', () => {
    expect(rainSpell(hours([MAYBE, DRY, WET]))).toMatchObject({ start: '2026-10-22T15:00', wet: true });
  });

  it('falls back to possible rain when none is expected', () => {
    expect(rainSpell(hours([DRY, MAYBE, MAYBE, DRY]))).toMatchObject({
      start: '2026-10-22T14:00',
      end: '2026-10-22T15:00',
      wet: false,
    });
  });

  it('bridges dry lulls of up to two hours', () => {
    expect(rainSpell(hours([WET, DRY, DRY, WET]))?.end).toBe('2026-10-22T16:00');
    expect(rainSpell(hours([WET, DRY, DRY, DRY, WET]))?.end).toBe('2026-10-22T13:00');
  });

  it('knows when it is already raining', () => {
    expect(rainSpell(hours([WET, DRY]))?.ongoing).toBe(true);
  });

  it('takes the wind directions of the rainy hours only', () => {
    const spell = rainSpell(hours([[1, 80, 120], [0, 0, 300], [1, 80, 180]]));
    expect(spell?.spread?.mean).toBeCloseTo(150, 0);
    expect(spell?.spread?.half).toBeCloseTo(30, 0);
  });

  it('skips rain the model expects but the ensemble does not believe', () => {
    // Trieste, 23 October: a 0.2 mm blip at 0% before the real storm.
    expect(rainSpell(hours([[0.2, 0, 270, 1.4], DRY, DRY, DRY, [5.4, 98, 124]]))).toMatchObject({
      start: '2026-10-22T17:00',
      wet: true,
    });
  });

  it('lets the heaviest hours set the direction, not a drizzle from elsewhere', () => {
    const spell = rainSpell(hours([[5.4, 98, 124], [9.1, 95, 136], [0.2, 73, 264]]));
    expect(spell?.spread?.mean).toBeCloseTo(130, 0);
    expect(spell?.spread?.half).toBe(8);
  });

  it('has no direction when it rains without wind', () => {
    expect(rainSpell(hours([[1, 80, 135, 1], [1, 80, 300, 0.5]]))?.spread).toBeNull();
  });
});

describe('rainSpellCopy', () => {
  const spell: RainSpell = {
    start: '2026-10-22T15:00',
    end: '2026-10-22T16:00',
    wet: true,
    ongoing: false,
    spread: { mean: 150, half: 30 },
  };

  it('names the winds bringing the rain and the side to close', () => {
    expect(rainSpellCopy(spell)).toBe('Pioggia da Scirocco e Ostro dalle 15 alle 17: chiudi gli oblò sul lato sud-est');
  });

  it('uses directions away from the Mediterranean', () => {
    useWindNaming('direzioni');
    try {
      expect(rainSpellCopy(spell)).toBe('Pioggia da sud-est e sud dalle 15 alle 17: chiudi gli oblò sul lato sud-est');
    } finally {
      useWindNaming('mediterraneo');
    }
  });

  it('names the wind of the mean direction when the arc holds no named point', () => {
    expect(rainSpellCopy({ ...spell, spread: { mean: 150, half: 8 } })).toBe(
      'Pioggia da Scirocco dalle 15 alle 17: chiudi gli oblò sul lato sud-est',
    );
  });

  it('says until when when it is already raining', () => {
    expect(rainSpellCopy({ ...spell, ongoing: true, start: '2026-10-22T13:00' })).toBe(
      'Pioggia da Scirocco e Ostro fino alle 17: chiudi gli oblò sul lato sud-est',
    );
  });

  it('gives no advice when rain is only possible', () => {
    expect(rainSpellCopy({ ...spell, wet: false })).toBe('Possibile pioggia da Scirocco e Ostro dalle 15 alle 17');
  });

  it('calls the wind variable when it swings across more than three winds', () => {
    expect(rainSpellCopy({ ...spell, spread: { mean: 180, half: 90 } })).toBe('Pioggia con vento variabile dalle 15 alle 17');
  });

  it('leaves out the direction when there is no wind', () => {
    expect(rainSpellCopy({ ...spell, spread: null })).toBe('Pioggia senza vento dalle 15 alle 17');
  });
});
