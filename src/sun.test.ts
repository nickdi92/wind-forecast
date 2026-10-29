import { describe, expect, it } from 'vitest';
import type { Sun } from './forecast';
import { durationLabel, notableDay, sunCopy } from './sun';

const alta: Sun = { rise: '2026-10-29T07:42', set: '2026-10-29T14:37', daylight: 24_932 };
const altaTomorrow: Sun = { rise: '2026-10-30T07:46', set: '2026-10-30T14:33', daylight: 24_357 };
const polar: Sun = { rise: '2026-12-10T00:00', set: '2026-12-10T00:00', daylight: 0 };

describe('durationLabel', () => {
  it.each([
    [24_932, '6 h 56 min'],
    [3600, '1 h'],
    [45 * 60, '45 min'],
  ])('%i s → %s', (s, label) => {
    expect(durationLabel(s)).toBe(label);
  });
});

describe('notableDay', () => {
  it('flags short and long days only', () => {
    expect(notableDay(alta)).toBe(true);
    expect(notableDay({ ...alta, daylight: 12 * 3600 })).toBe(false);
    expect(notableDay({ ...alta, daylight: 20 * 3600 })).toBe(true);
    expect(notableDay(polar)).toBe(true);
  });
});

describe('sunCopy', () => {
  it('follows the day', () => {
    expect(sunCopy(alta, '2026-10-29T06:10', altaTomorrow)).toBe('Il sole sorge alle 07:42 e tramonta alle 14:37, 6 h 56 min di luce');
    expect(sunCopy(alta, '2026-10-29T11:00', altaTomorrow)).toBe('Luce fino alle 14:37, sole dalle 07:42: 6 h 56 min di luce');
    expect(sunCopy(alta, '2026-10-29T18:00', altaTomorrow)).toBe('Il sole è tramontato alle 14:37, domani sorge alle 07:46');
  });

  it('names the polar night and the midnight sun', () => {
    expect(sunCopy(polar, '2026-12-10T12:00')).toContain('Notte polare');
    expect(sunCopy({ rise: '2026-06-21T00:00', set: '2026-06-22T00:00', daylight: 86_400 }, '2026-06-21T12:00')).toContain('Sole di mezzanotte');
  });
});
