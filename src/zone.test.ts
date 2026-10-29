import { describe, expect, it } from 'vitest';
import { icelandAbout, isMediterranean, nordicAbout, nordicCoastNotes, officialSources, zoneOf } from './zone';

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
    [59.91, 10.75, 'nordici'], // Oslo
    [71.17, 25.78, 'nordici'], // Capo Nord
    [69.65, 18.96, 'nordici'], // Tromsø
    [69.73, 30.05, 'nordici'], // Kirkenes
    [67.85, 20.22, 'nordici'], // Kiruna
    [59.33, 18.07, 'nordici'], // Stoccolma
    [55.6, 13.0, 'nordici'], // Malmö
    [57.71, 11.97, 'nordici'], // Göteborg
    [60.17, 24.94, 'nordici'], // Helsinki
    [66.5, 25.73, 'nordici'], // Rovaniemi
    [61.17, 28.77, 'nordici'], // Imatra
    [55.68, 12.57, 'altrove'], // Copenaghen
    [57.05, 9.92, 'altrove'], // Aalborg
    [59.44, 24.75, 'altrove'], // Tallinn
    [56.95, 24.11, 'altrove'], // Riga
    [59.94, 30.31, 'altrove'], // San Pietroburgo
    [60.71, 28.75, 'altrove'], // Vyborg
    [69.41, 30.22, 'altrove'], // Nikel
    [68.97, 33.08, 'altrove'], // Murmansk
    [78.22, 15.65, 'altrove'], // Longyearbyen, Svalbard
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

  it('points to weather and road services in Sweden, Norway and Finland', () => {
    const s = officialSources('nordici');
    for (const site of ['smhi.se', 'trafikverket.se', 'yr.no', 'vegvesen.no', 'ilmatieteenlaitos.fi', 'fintraffic.fi']) expect(s).toContain(site);
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

describe('nordicAbout', () => {
  it('tells Arctic northerlies from wet westerlies', () => {
    expect(nordicAbout('N')).toContain('Artico');
    expect(nordicAbout('O')).toContain('atlantica');
    expect(nordicAbout('E')).toContain('continentale');
  });
});

describe('nordicCoastNotes', () => {
  it('names the convoy driving to the North Cape and where to check it', () => {
    const notes = nordicCoastNotes().join(' ');
    expect(notes).toContain('kolonnekjøring');
    expect(notes).toContain('vegvesen.no/trafikk');
  });
});
