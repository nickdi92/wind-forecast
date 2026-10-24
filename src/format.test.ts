import { describe, expect, it } from 'vitest';
import { agoLabel, alertCopy, dayLabel, dayWord, hourLabel, localIso, whenLabel } from './format';
import type { GustAlert } from './alerts';

describe('hourLabel', () => {
  it('shows the local hour', () => {
    expect(hourLabel('2026-10-22T07:00')).toBe('07');
  });
});

describe('dayLabel', () => {
  it('names today and tomorrow', () => {
    expect(dayLabel('2026-10-22', '2026-10-22')).toBe('Oggi');
    expect(dayLabel('2026-10-23', '2026-10-22')).toBe('Domani');
  });

  it('uses short weekday and day number further out', () => {
    expect(dayLabel('2026-10-24', '2026-10-22')).toBe('Sab 24');
  });

  it('handles month boundaries', () => {
    expect(dayLabel('2026-11-01', '2026-10-31')).toBe('Domani');
  });
});

describe('agoLabel', () => {
  it.each([
    [20_000, 'aggiornato adesso'],
    [2 * 60_000, 'aggiornato 2 min fa'],
    [3 * 3_600_000, 'aggiornato 3 ore fa'],
    [1 * 3_600_000, "aggiornato un'ora fa"],
    [30 * 3_600_000, 'aggiornato più di un giorno fa'],
  ])('%i ms → %s', (ms, label) => {
    expect(agoLabel(ms)).toBe(label);
  });
});

describe('alertCopy', () => {
  const base: GustAlert = {
    level: 'attenzione',
    maxGust: 52,
    start: '2026-10-22T17:00',
    end: '2026-10-22T21:00',
    ongoing: false,
    dir: 315,
  };

  it('describes an upcoming window', () => {
    expect(alertCopy(base, 'kmh').title).toBe('Raffiche forti dalle 17 alle 22, fino a 52 km/h');
  });

  it('describes gusts already blowing', () => {
    expect(alertCopy({ ...base, ongoing: true }, 'kmh').title).toBe('Raffiche forti adesso e fino alle 22, fino a 52 km/h');
  });

  it('converts the peak to the chosen unit', () => {
    expect(alertCopy(base, 'kn').title).toContain('fino a 28 nodi');
  });

  it('gives camper advice for a warning', () => {
    expect(alertCopy(base, 'kmh').advice).toBe('Chiudi il tendalino e fai attenzione alla guida su strade esposte.');
  });

  it('suggests parking nose into the wind on danger', () => {
    expect(alertCopy({ ...base, level: 'pericolo', maxGust: 70 }, 'kmh').advice).toBe(
      'Ritira tendalino e accessori, evita viadotti e strade esposte. Parcheggia con il muso verso nord-ovest.',
    );
  });
});

describe('localIso', () => {
  it('gives wall-clock time in the place timezone, Open-Meteo style', () => {
    expect(localIso(new Date('2026-10-22T11:30:00Z'), 'Europe/Rome')).toBe('2026-10-22T13:30');
  });

  it('crosses midnight correctly', () => {
    expect(localIso(new Date('2026-10-22T23:30:00Z'), 'Europe/Rome')).toBe('2026-10-23T01:30');
  });
});

describe('whenLabel', () => {
  it.each([
    ['2026-10-24T04:00', 'prima dell’alba'],
    ['2026-10-24T09:00', 'in mattinata'],
    ['2026-10-24T15:00', 'nel pomeriggio'],
    ['2026-10-24T19:00', 'in serata'],
    ['2026-10-24T23:00', 'in nottata'],
    ['2026-10-25T03:00', 'nella notte'],
    ['2026-10-25T08:00', 'domattina'],
    ['2026-10-25T14:00', 'domani pomeriggio'],
    ['2026-10-25T20:00', 'domani sera'],
    ['2026-10-26T10:00', 'lunedì mattina'],
  ])('%s → %s', (time, label) => {
    expect(whenLabel(time, '2026-10-24')).toBe(label);
  });
});

describe('dayWord', () => {
  it('names days the way a sentence does', () => {
    expect(dayWord('2026-10-24', '2026-10-24')).toBe('oggi');
    expect(dayWord('2026-10-25', '2026-10-24')).toBe('domani');
    expect(dayWord('2026-10-27', '2026-10-24')).toBe('martedì');
  });
});
