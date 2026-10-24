import { describe, expect, it } from 'vitest';
import { icelandAbout, isMediterranean, officialSources, zoneOf } from './zone';

describe('zoneOf', () => {
  it.each([
    [40.92, 9.5, 'sardegna'], // Olbia
    [44.41, 8.93, 'mediterraneo'], // Genova
    [45.46, 9.19, 'mediterraneo'], // Milano
    [37.98, 23.73, 'mediterraneo'], // Atene
    [36.72, -4.42, 'mediterraneo'], // Malaga
    [64.15, -21.94, 'islanda'], // Reykjavík
    [65.68, -18.09, 'islanda'], // Akureyri
    [38.72, -9.14, 'altrove'], // Lisbona
    [46.48, 30.73, 'altrove'], // Odessa, Black Sea
    [59.91, 10.75, 'altrove'], // Oslo
    [-41.29, 174.78, 'altrove'], // Wellington
  ])('%f, %f is %s', (lat, lon, zone) => {
    expect(zoneOf(lat, lon)).toBe(zone);
  });

  it('groups Sardinia with the Mediterranean', () => {
    expect(isMediterranean('sardegna')).toBe(true);
    expect(isMediterranean('mediterraneo')).toBe(true);
    expect(isMediterranean('islanda')).toBe(false);
  });
});

describe('officialSources', () => {
  it('points to the Icelandic services in Iceland', () => {
    const s = officialSources('islanda');
    expect(s).toContain('vedur.is');
    expect(s).toContain('umferdin.is');
    expect(s).toContain('safetravel.is');
  });

  it('does not send people abroad to Italian services', () => {
    expect(officialSources('altrove')).not.toContain('Protezione Civile');
    expect(officialSources('sardegna')).toContain('Protezione Civile');
  });
});

describe('icelandAbout', () => {
  it('tells cold northerlies from mild southerlies', () => {
    expect(icelandAbout('N')).toContain('Artico');
    expect(icelandAbout('S')).toContain('mite');
  });
});
