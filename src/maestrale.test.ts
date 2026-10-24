import { describe, expect, it } from 'vitest';
import type { HourPoint } from './forecast';
import { maestraleOutlook, maestralePersistence, maestraleStatus, maestraleTrend, windowCopy } from './maestrale';

const TODAY = '2026-10-24';

/** Hourly from 11:00 today; `at(i)` gives [speed, from °] for hour i. */
const hours = (n: number, at: (i: number) => [number, number]): HourPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const [speed, dir] = at(i);
    return { time: new Date(Date.UTC(2026, 9, 24, 11 + i)).toISOString().slice(0, 16), speed, gust: speed * 1.5, dir, rain: 0, rainChance: 0 };
  });

describe('maestraleOutlook', () => {
  it('splits the next three days into 24-hour windows', () => {
    // Maestrale for 30 hours, peaking at 45 km/h, then a light Libeccio.
    const h = hours(100, (i) => (i < 30 ? [i < 12 ? 45 : 25, 315] : [8, 225]));
    const o = maestraleOutlook(h[0], h);
    expect(o.now).toBe(true);
    expect(o.windows.map((w) => w.hours)).toEqual([24, 6, 0]);
    expect(o.windows[0]).toMatchObject({ maxSpeed: 45, maxGust: 67.5 });
    expect(o.last?.time).toBe('2026-10-25T16:00');
    expect(o.after?.time).toBe('2026-10-25T17:00');
    expect(maestraleTrend(o)).toBe('calo');
    expect(maestraleStatus(o, h[0], TODAY)).toBe('Soffia adesso, forte');
  });

  it('dates the end from the forecast and names what follows', () => {
    const h = hours(100, (i) => (i < 30 ? [30, 315] : [8, 225]));
    expect(maestralePersistence(maestraleOutlook(h[0], h), TODAY)).toBe('Secondo le previsioni si attenua domani pomeriggio e lascia il posto a Libeccio.');
  });

  it('does not guess past the forecast horizon', () => {
    const h = hours(100, () => [35, 320]);
    const o = maestraleOutlook(h[0], h);
    expect(o.windows.map((w) => w.hours)).toEqual([24, 24, 24]);
    expect(maestralePersistence(o, TODAY)).toBe('Le previsioni lo danno ancora attivo fra 72 ore: oltre questo orizzonte non si può dire quando finirà.');
  });

  it('says when it is coming', () => {
    const h = hours(100, (i) => (i >= 30 && i < 50 ? [28, 310] : [10, 135]));
    const o = maestraleOutlook(h[0], h);
    expect(o.now).toBe(false);
    expect(maestraleStatus(o, h[0], TODAY)).toBe('Previsto domani pomeriggio');
  });

  it('says when there is none, and ignores light north-westerly breezes', () => {
    const h = hours(100, () => [8, 315]);
    const o = maestraleOutlook(h[0], h);
    expect(o.first).toBeNull();
    expect(maestraleStatus(o, h[0], TODAY)).toBe('Non previsto nelle prossime 72 ore');
    expect(maestralePersistence(o, TODAY)).toBeNull();
  });

  it('flags windows the forecast does not reach', () => {
    const h = hours(40, () => [8, 135]);
    const o = maestraleOutlook(h[0], h);
    expect(o.horizon).toBe(40);
    expect(windowCopy(o.windows[2], 'kmh')).toBe('Fuori dalle previsioni');
    expect(windowCopy({ from: 0, to: 24, hours: 5, maxSpeed: 40, maxGust: 60, complete: true }, 'kn')).toBe('5 ore, fino a 22 nodi, raffiche 32 nodi');
  });
});
