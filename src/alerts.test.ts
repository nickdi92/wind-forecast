import { describe, expect, it } from 'vitest';
import { gustAlert } from './alerts';
import type { HourPoint } from './forecast';

const hours = (gusts: number[], dir = 315): HourPoint[] =>
  gusts.map((gust, i) => ({
    time: `2026-10-22T${String(13 + i).padStart(2, '0')}:00`,
    speed: gust * 0.6,
    gust,
    dir,
    rain: 0,
    rainChance: 0,
  }));

describe('gustAlert', () => {
  it('stays quiet below 40 km/h', () => {
    expect(gustAlert(hours([20, 30, 39.9]))).toBeNull();
  });

  it('warns from 40 km/h', () => {
    expect(gustAlert(hours([20, 41, 30]))?.level).toBe('attenzione');
  });

  it('flags danger from 60 km/h', () => {
    expect(gustAlert(hours([20, 45, 62, 50]))?.level).toBe('pericolo');
  });

  it('reports the window of strong gusts and the peak', () => {
    const a = gustAlert(hours([20, 42, 55, 48, 30, 41, 20]));
    expect(a).toMatchObject({
      maxGust: 55,
      start: '2026-10-22T14:00',
      end: '2026-10-22T18:00',
      ongoing: false,
    });
  });

  it('reports only the first spell when a long lull separates two', () => {
    // Strong now, calm for three hours, strong again later (Olbia, 22 Oct: today 15-19, tomorrow 13-17).
    const a = gustAlert(hours([68, 63, 20, 20, 20, 75, 41]));
    expect(a).toMatchObject({ maxGust: 68, start: '2026-10-22T13:00', end: '2026-10-22T14:00', ongoing: true });
  });

  it('takes the level from the first spell only', () => {
    expect(gustAlert(hours([45, 20, 20, 20, 70]))?.level).toBe('attenzione');
  });

  it('says when strong gusts are already blowing', () => {
    expect(gustAlert(hours([44, 50, 20]))?.ongoing).toBe(true);
  });

  it('keeps the direction of the peak gust for parking advice', () => {
    const h = hours([20, 50, 30]);
    h[1].dir = 135;
    expect(gustAlert(h)?.dir).toBe(135);
  });
});
