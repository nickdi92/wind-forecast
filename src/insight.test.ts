import { afterEach, describe, expect, it } from 'vitest';
import type { DaySummary, Forecast, HourPoint } from './forecast';
import { daysSentence, gustSentence, headline, windShift, windSummary, windTrend } from './insight';
import { useWindNaming } from './wind';

const TODAY = '2026-10-24'; // a Saturday

/** Hourly points from 11:00 today; each entry is [speed km/h, gust km/h, from °]. */
const hours = (spec: [number, number?, number?][], start = 11): HourPoint[] =>
  spec.map(([speed, gust = speed * 1.4, dir = 315], i) => {
    const t = new Date(Date.UTC(2026, 9, 24, start + i));
    return { time: t.toISOString().slice(0, 16), speed, gust, dir, rain: 0, rainChance: 0 };
  });

const flat = (n: number, speed: number, gust?: number, dir?: number) => Array.from({ length: n }, () => [speed, gust, dir] as [number, number?, number?]);

describe('windTrend', () => {
  it('sees the wind rising to an afternoon peak', () => {
    const h = hours([[24], [26], [29], [32], [36], [38], [33], [28], [24], [22], [21], [20], [20]]);
    expect(windTrend(h[0], h)).toMatchObject({ kind: 'rinforzo', at: '2026-10-24T16:00', speed: 38 });
  });

  it('notes when a rise eases again', () => {
    const h = hours([[24], [30], [38], [36], [30], [24], [20], ...flat(8, 20)]);
    expect(windTrend(h[0], h)).toMatchObject({ kind: 'rinforzo', at: '2026-10-24T13:00', easesAt: '2026-10-24T16:00' });
  });

  it('sees the wind easing', () => {
    const h = hours([[35], [34], [33], [30], [26], [22], [18], [15], ...flat(6, 14)]);
    expect(windTrend(h[0], h)).toMatchObject({ kind: 'calo', at: '2026-10-24T16:00' });
  });

  it('calls small wobbles steady, even across a Beaufort boundary', () => {
    expect(windTrend(...pair(hours([[19], [21], [22], [20], [18], ...flat(8, 21)])))).toMatchObject({ kind: 'stabile' });
    expect(windTrend(...pair(hours(flat(13, 30))))).toMatchObject({ kind: 'stabile' });
  });
});

function pair(h: HourPoint[]): [HourPoint, HourPoint[]] {
  return [h[0], h];
}

describe('headline', () => {
  it('names wind, strength and trend', () => {
    const h = hours([[24], [26], [29], [32], [36], [38], [33], [30], [29], [28], [27], [27], [27]]);
    expect(headline(h[0], h, TODAY, 'kmh')).toBe('Maestrale moderato, in rinforzo nel pomeriggio fino a 38 km/h.');
  });

  it('adds when a rise eases', () => {
    const h = hours([[24], [26], [29], [32], [36], [38], [33], [28], [24], [20], ...flat(5, 20)]);
    expect(headline(h[0], h, TODAY, 'kmh')).toBe('Maestrale moderato, in rinforzo nel pomeriggio fino a 38 km/h, poi in calo in serata.');
  });

  it('agrees with Tramontana', () => {
    const h = hours(flat(13, 33, 45, 0));
    expect(headline(h[0], h, TODAY, 'kmh')).toBe('Tramontana tesa, senza grandi variazioni nelle prossime ore.');
  });

  it('speaks the chosen unit', () => {
    const h = hours([[24], [26], [29], [32], [36], [38], [33], [30], [29], [28], [27], [27], [27]]);
    expect(headline(h[0], h, TODAY, 'kn')).toContain('fino a 21 nodi');
  });

  it('handles calm, and calm turning into wind', () => {
    expect(headline(...pair(hours(flat(13, 1))), TODAY, 'kmh')).toBe('Vento quasi assente nelle prossime ore.');
    const h = hours([[1], [1], [3], [8], [14], [20], [25, 32, 225], ...flat(6, 18, 25, 225)]);
    expect(headline(h[0], h, TODAY, 'kmh')).toBe('Vento quasi assente, in aumento nel pomeriggio: Libeccio fino a 25 km/h.');
  });

  it('easing wind', () => {
    const h = hours([[35], [34], [33], [30], [26], [22], [18], [15], ...flat(6, 14)]);
    expect(headline(h[0], h, TODAY, 'kmh')).toBe('Maestrale teso, in calo nel pomeriggio.');
  });
});

describe('windShift', () => {
  it('finds a lasting turn to another wind', () => {
    const h = hours([[20], [20], [18], [16], [15, 22, 225], [15, 22, 225], [16, 22, 225], [16, 22, 225], ...flat(5, 15, 22, 225)]);
    expect(windShift(h[0], h)).toMatchObject({ wind: { name: 'Libeccio' }, at: '2026-10-24T15:00' });
  });

  it('ignores wobbling across a sector line', () => {
    const h = hours([[20, 28, 300], ...Array.from({ length: 12 }, (_, i) => [20, 28, i % 2 ? 300 : 288] as [number, number, number])]);
    expect(windShift(h[0], h)).toBeNull();
  });
});

describe('gustSentence', () => {
  it('warns of dangerous gusts', () => {
    const h = hours([[30, 45], [35, 55], [40, 66], ...flat(10, 30, 45)]);
    expect(gustSentence(h[0], h, TODAY, 'kmh')).toMatch(/^Raffiche fino a 66 km\/h nelle prossime ore: pericolose/);
  });

  it('turns strong gusts into what they mean at the beach', () => {
    const h = hours([[20, 30], [20, 30], [22, 32], [24, 36], [26, 40], [28, 45], ...flat(7, 20, 30)]);
    expect(gustSentence(h[0], h, TODAY, 'kmh')).toBe(
      'Raffiche forti fino a 45 km/h nel pomeriggio: potrebbero rendere meno piacevole la permanenza sulle spiagge esposte e impegnativa la guida su strade aperte.',
    );
  });

  it('flags gusty wind', () => {
    const h = hours([[14, 30], ...flat(12, 12, 22)]);
    expect(gustSentence(h[0], h, TODAY, 'kmh')).toMatch(/^Vento a raffiche, fino a 30 km\/h adesso/);
  });

  it('stays calm about light gusts', () => {
    expect(gustSentence(...pair(hours(flat(13, 8, 14))), TODAY, 'kmh')).toBe('Raffiche deboli: nessun fastidio per stare all’aperto.');
  });
});

const day = (date: string, maxSpeed: number, dominantDir: number): DaySummary => ({
  date,
  maxSpeed,
  maxGust: maxSpeed * 1.5,
  dominantDir,
  rain: 0,
  rainChance: 0,
  slots: [],
});

function forecast(ahead: HourPoint[], days: DaySummary[]): Forecast {
  return {
    timezone: 'Europe/Rome',
    current: ahead[0],
    next24: ahead.slice(0, 24),
    ahead,
    days,
    spread: { mean: 315, half: 10 },
    alert: null,
    rainSpell: null,
  };
}

describe('daysSentence', () => {
  const ahead = hours([[24], [28], [30], ...flat(10, 26)]);

  it('compares tomorrow with the rest of today, then names the next change', () => {
    const f = forecast(ahead, [day(TODAY, 32, 315), day('2026-10-25', 15, 315), day('2026-10-26', 16, 320), day('2026-10-27', 35, 135)]);
    expect(daysSentence(f, 'kmh')).toBe('Domani è previsto un calo del vento: Maestrale fino a 15 km/h. Martedì Scirocco in rinforzo, fino a 35 km/h.');
  });

  it('says when tomorrow brings more wind', () => {
    const f = forecast(ahead, [day(TODAY, 30, 315), day('2026-10-25', 48, 315)]);
    expect(daysSentence(f, 'kmh')).toBe('Domani vento in rinforzo: Maestrale forte fino a 48 km/h.');
  });

  it('says when tomorrow is much the same, from another direction', () => {
    const f = forecast(ahead, [day(TODAY, 30, 315), day('2026-10-25', 28, 225)]);
    expect(daysSentence(f, 'kmh')).toBe('Domani vento simile, ma da Libeccio, fino a 28 km/h.');
  });

  it('says when tomorrow is weak', () => {
    const f = forecast(ahead, [day(TODAY, 30, 315), day('2026-10-25', 9, 90)]);
    expect(daysSentence(f, 'kmh')).toBe('Domani vento in calo, debole tutto il giorno (massimo 9 km/h).');
  });

  it('has nothing to say without tomorrow', () => {
    expect(daysSentence(forecast(ahead, [day(TODAY, 30, 315)]), 'kmh')).toBeNull();
  });
});

describe('windSummary', () => {
  it('builds the story from the data, so different forecasts read differently', () => {
    const windy = forecast(hours([[24, 30], [26, 34], [29, 38], [32, 42], [36, 48], [38, 52], ...flat(7, 30, 40)]), [
      day(TODAY, 38, 315),
      day('2026-10-25', 20, 315),
    ]);
    const quiet = forecast(hours(flat(13, 8, 12, 135)), [day(TODAY, 9, 135), day('2026-10-25', 10, 135)]);
    const a = windSummary(windy, 'kmh');
    const b = windSummary(quiet, 'kmh');
    expect(a[0]).toBe('Maestrale moderato, in rinforzo nel pomeriggio fino a 38 km/h.');
    expect(a.join(' ')).toContain('Raffiche forti fino a 52 km/h');
    expect(a.at(-1)).toBe('Domani è previsto un calo del vento: Maestrale fino a 20 km/h.');
    expect(b[0]).toBe('Scirocco debole, senza grandi variazioni nelle prossime ore.');
    expect(b.join(' ')).toContain('Raffiche deboli');
  });

  it('mentions a change of wind', () => {
    const f = forecast(hours([[20], [20], [18], [16], ...flat(9, 15, 22, 225)]), [day(TODAY, 20, 315), day('2026-10-25', 18, 225)]);
    expect(windSummary(f, 'kmh')).toContain('Nel pomeriggio gira a Libeccio.');
  });
});

describe('summary details', () => {
  it('does not call a turning wind steady', () => {
    const f = forecast(hours([[10, 14, 270], [10, 14, 275], ...flat(11, 10, 14, 330)]), [day(TODAY, 12, 270), day('2026-10-25', 12, 330)]);
    const s = windSummary(f, 'kmh');
    expect(s[0]).toBe('Ponente debole, di intensità stabile.');
    expect(s[1]).toBe('A breve gira a Maestrale.');
  });

  it('leaves the beach out far from the sea', () => {
    const h = hours([[14, 30], ...flat(12, 12, 22)]);
    expect(gustSentence(h[0], h, TODAY, 'kmh', false)).toBe('Vento a raffiche, fino a 30 km/h adesso: fissa bene tendalino, ombrelloni e oggetti leggeri.');
  });

  it('does not report a light day getting lighter', () => {
    const f = forecast(hours(flat(13, 16)), [day(TODAY, 16, 270), day('2026-10-25', 11, 135), day('2026-10-26', 4, 225)]);
    expect(daysSentence(f, 'kmh')).toBe('Domani vento in calo, debole tutto il giorno (massimo 11 km/h).');
  });
});

describe('away from the Mediterranean', () => {
  afterEach(() => useWindNaming('mediterraneo'));

  it('speaks of directions instead of Mediterranean names', () => {
    useWindNaming('direzioni');
    const h = hours([[24], [26], [29], [32], [36], [38], [33], [30], [29], [28], [27], [27], [27]]);
    expect(headline(h[0], h, TODAY, 'kmh')).toBe('Vento moderato da nord-ovest, in rinforzo nel pomeriggio fino a 38 km/h.');
    const f = forecast(hours([[24], [28], [30], ...flat(10, 26)]), [
      day(TODAY, 30, 315),
      day('2026-10-25', 48, 315),
      day('2026-10-26', 20, 135),
    ]);
    expect(daysSentence(f, 'kmh')).toBe('Domani vento in rinforzo: forte da nord-ovest fino a 48 km/h. Lunedì vento da sud-est in calo, fino a 20 km/h.');
  });

  it('says where a turning wind comes from', () => {
    useWindNaming('direzioni');
    const f = forecast(hours([[20], [20], [18], [16], ...flat(9, 15, 22, 225)]), [day(TODAY, 20, 315), day('2026-10-25', 18, 225)]);
    expect(windSummary(f, 'kmh')).toContain('Nel pomeriggio gira da sud-ovest.');
  });
});
