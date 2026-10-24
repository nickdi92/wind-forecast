import { describe, expect, it } from 'vitest';
import {
  coastNotes,
  distanceToSegment,
  exposure,
  genericExposure,
  inSardinia,
  nearestSegment,
  SARDINIA,
  sardiniaExposure,
  segmentNames,
} from './coast';
import { WINDS } from './wind';

const exposedTo = (name: string) => {
  const w = WINDS.find((x) => x.name === name)!;
  return sardiniaExposure(w.deg);
};

describe('exposure', () => {
  it('is exposed when the wind blows from the sea onto the coast', () => {
    expect(exposure(315, 295)).toBe('esposta');
    expect(exposure(315, 270)).toBe('esposta');
  });

  it('is lateral when the wind runs along the coast', () => {
    expect(exposure(0, 90)).toBe('laterale');
  });

  it('is sheltered when the wind blows from land', () => {
    expect(exposure(315, 120)).toBe('ridossata');
    expect(exposure(315, 90)).toBe('ridossata');
  });
});

describe('Sardinian coasts by wind', () => {
  // The general guidance: which coasts each wind hits first.
  it.each([
    ['Maestrale', ['nordovest', 'ovest']],
    ['Ponente', ['ovest']],
    ['Libeccio', ['sudovest', 'ovest']],
    ['Scirocco', ['sudest']],
    ['Levante', ['est']],
    ['Grecale', ['nordest']],
    ['Tramontana', ['nord']],
    ['Ostro', ['sud']],
  ])('%s exposes %j', (name, ids) => {
    const exposed = exposedTo(name)
      .filter((r) => r.exposure === 'esposta')
      .map((r) => r.segment.id);
    expect(exposed).toEqual(expect.arrayContaining(ids));
  });

  it('shelters the south-east and east from the maestrale', () => {
    const r = exposedTo('Maestrale');
    expect(segmentNames(r, 'ridossata')).toBe('nord-est, est, sud-est e sud');
  });

  it('never calls a coast both exposed and sheltered', () => {
    for (const w of WINDS) {
      const r = sardiniaExposure(w.deg);
      expect(r).toHaveLength(SARDINIA.length);
      expect(r.filter((x) => x.exposure === 'esposta').length).toBeGreaterThan(0);
    }
  });
});

describe('outline', () => {
  it('joins each stretch to the next, closing the island', () => {
    SARDINIA.forEach((s, i) => {
      const next = SARDINIA[(i + 1) % SARDINIA.length];
      expect(s.points.at(-1)).toEqual(next.points[0]);
    });
  });
});

describe('where the place is', () => {
  it.each([
    [40.92, 9.5, 'nordest'], // Olbia
    [39.2, 9.17, 'sud'], // Poetto
    [40.56, 8.31, 'nordovest'], // Alghero
    [39.25, 9.58, 'sudest'], // Costa Rei
    [41.24, 9.19, 'nord'], // Santa Teresa
    [39.95, 8.4, 'ovest'], // Is Arutas
    [40.28, 9.63, 'est'], // Cala Gonone
    [39.14, 8.31, 'sudovest'], // Carloforte
  ])('%f, %f is on the %s coast', (lat, lon, id) => {
    expect(nearestSegment(lat, lon)?.id).toBe(id);
  });

  it('is inland in Nuoro and nowhere outside Sardinia', () => {
    expect(nearestSegment(40.32, 9.33)).toBeNull();
    expect(nearestSegment(45.46, 9.19)).toBeNull();
    expect(inSardinia(41.39, 9.16)).toBe(false); // Bonifacio, Corsica
  });

  it('measures distance to the outline', () => {
    const nord = SARDINIA.find((s) => s.id === 'nord')!;
    expect(distanceToSegment(40.91, 8.71, nord)).toBeLessThan(1);
  });
});

describe('notes', () => {
  it('mentions the Bocche di Bonifacio only for winds it channels', () => {
    expect(coastNotes(315).join(' ')).toContain('Bocche di Bonifacio');
    expect(coastNotes(135)).toEqual([]);
  });

  it('explains exposure anywhere without inventing places', () => {
    expect(genericExposure(315)).toBe(
      'Le coste rivolte a nord-ovest ricevono il vento dal mare e sono le più esposte. Quelle rivolte a sud-est lo ricevono da terra: mare di solito più calmo sotto costa, ma non per forza meno vento.',
    );
  });
});
