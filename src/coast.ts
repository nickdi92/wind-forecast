import { angleBetween, windFrom, windTowards } from './wind';
import { inIceland, inSardinia } from './zone';

/**
 * How a stretch of coast sits against the wind:
 * esposta when the wind blows from the sea onto it, laterale when it runs along it,
 * ridossata when it blows from land (calmer sea near the shore, but not a calm place).
 */
export type Exposure = 'esposta' | 'laterale' | 'ridossata';

/** Below this the wind is too light to make any coast exposed. */
export const EXPOSURE_MIN = 12; // km/h

/** @param facing Bearing a coast looks out to sea at, 0 = north. */
export function exposure(windFromDeg: number, facing: number): Exposure {
  const d = angleBetween(windFromDeg, facing);
  if (d <= 50) return 'esposta';
  if (d < 110) return 'laterale';
  return 'ridossata';
}

export interface CoastSegment {
  id: string;
  name: string;
  /** Well-known places along it, to recognise it. */
  places: string;
  facing: number;
  /** Simplified outline, clockwise; each segment starts where the previous one ends. */
  points: readonly [lat: number, lon: number][];
}

/**
 * Sardinia in eight stretches of coast, each with the direction it mostly looks to. A sketch to read
 * the wind at a glance: bays, headlands and islands inside a stretch can face other ways.
 */
export const SARDINIA: readonly CoastSegment[] = [
  {
    id: 'nord',
    name: 'Nord',
    places: 'Golfo dell’Asinara, Castelsardo, Isola Rossa, Santa Teresa',
    facing: 0,
    points: [
      [40.97, 8.2], [40.92, 8.25], [40.84, 8.4], [40.85, 8.55], [40.91, 8.71], [40.96, 8.8], [41.01, 8.87],
      [41.06, 8.95], [41.12, 9.03], [41.24, 9.15], [41.25, 9.23], [41.18, 9.38],
    ],
  },
  {
    id: 'nordest',
    name: 'Nord-est',
    places: 'Costa Smeralda, Golfo Aranci, Olbia, San Teodoro, Budoni',
    facing: 70,
    points: [
      [41.18, 9.38], [41.14, 9.54], [41.08, 9.58], [41.0, 9.63], [40.93, 9.56], [40.87, 9.66], [40.83, 9.72],
      [40.77, 9.68], [40.7, 9.71], [40.62, 9.76], [40.53, 9.83],
    ],
  },
  {
    id: 'est',
    name: 'Est',
    places: 'Golfo di Orosei, Cala Gonone, Arbatax, Ogliastra',
    facing: 90,
    points: [[40.53, 9.83], [40.38, 9.74], [40.28, 9.64], [40.15, 9.7], [40.08, 9.73], [39.94, 9.7], [39.82, 9.68], [39.7, 9.66], [39.53, 9.65]],
  },
  {
    id: 'sudest',
    name: 'Sud-est',
    places: 'Muravera, Costa Rei, Villasimius',
    facing: 120,
    points: [[39.53, 9.65], [39.4, 9.63], [39.29, 9.63], [39.24, 9.58], [39.13, 9.57], [39.09, 9.52]],
  },
  {
    id: 'sud',
    name: 'Sud',
    places: 'Golfo di Cagliari, Poetto, Pula, Chia, Teulada',
    facing: 180,
    points: [
      [39.09, 9.52], [39.14, 9.42], [39.2, 9.3], [39.2, 9.17], [39.21, 9.1], [39.07, 9.03], [38.98, 9.01], [38.89, 8.88],
      [38.87, 8.85], [38.88, 8.75], [38.87, 8.64],
    ],
  },
  {
    id: 'sudovest',
    name: 'Sud-ovest',
    places: 'Porto Pino, Sant’Antioco, Carloforte, Portoscuso',
    facing: 240,
    points: [[38.87, 8.64], [38.96, 8.58], [38.97, 8.42], [39.11, 8.37], [39.2, 8.38], [39.3, 8.44], [39.4, 8.4], [39.45, 8.39]],
  },
  {
    id: 'ovest',
    name: 'Ovest',
    places: 'Costa Verde, Golfo di Oristano, Sinis, Bosa',
    facing: 270,
    points: [
      [39.45, 8.39], [39.54, 8.44], [39.63, 8.47], [39.76, 8.45], [39.84, 8.56], [39.91, 8.53], [39.86, 8.44], [39.96, 8.4],
      [40.04, 8.38], [40.1, 8.48], [40.22, 8.47], [40.29, 8.46],
    ],
  },
  {
    id: 'nordovest',
    name: 'Nord-ovest',
    places: 'Alghero, Capo Caccia, Argentiera, Stintino',
    facing: 295,
    points: [[40.29, 8.46], [40.33, 8.38], [40.47, 8.37], [40.56, 8.31], [40.56, 8.16], [40.68, 8.2], [40.74, 8.13], [40.88, 8.17], [40.97, 8.2]],
  },
];

/** Asinara, San Pietro, La Maddalena: drawn on the map only. */
export const SARDINIA_ISLANDS: readonly (readonly [number, number][])[] = [
  [[41.0, 8.24], [41.1, 8.22], [41.08, 8.32], [41.02, 8.31]],
  [[39.1, 8.23], [39.19, 8.22], [39.19, 8.3], [39.13, 8.33]],
  [[41.2, 9.38], [41.25, 9.37], [41.26, 9.45], [41.21, 9.46]],
];

/**
 * Iceland in eight stretches. Fjords make it far more ragged than this: the stretches give the
 * direction the open coast looks to, not that of each fjord.
 */
export const ICELAND: readonly CoastSegment[] = [
  {
    id: 'faxafloi',
    name: 'Sud-ovest',
    places: 'Reykjanes, Keflavík, Reykjavík, Akranes',
    facing: 280,
    points: [[63.81, -22.7], [64.08, -22.69], [64.04, -22.25], [64.15, -21.94], [64.32, -22.08], [64.54, -21.92]],
  },
  {
    id: 'snaefellsnes',
    name: 'Ovest',
    places: 'Snæfellsnes, Arnarstapi, Stykkishólmur, Breiðafjörður',
    facing: 250,
    points: [
      [64.54, -21.92], [64.72, -22.35], [64.8, -23.1], [64.73, -23.8], [64.89, -24.03], [64.9, -23.7], [65.07, -22.73], [65.15, -21.85],
      [65.45, -22.2], [65.55, -23.2], [65.5, -24.53],
    ],
  },
  {
    id: 'vestfirdir',
    name: 'Fiordi occidentali',
    places: 'Látrabjarg, Patreksfjörður, Ísafjörður, Hornstrandir',
    facing: 315,
    points: [[65.5, -24.53], [65.62, -24.05], [65.87, -23.75], [66.08, -23.55], [66.07, -23.13], [66.16, -23.25], [66.43, -23.1], [66.45, -22.4]],
  },
  {
    id: 'nord',
    name: 'Nord',
    places: 'Húnaflói, Skagafjörður, Siglufjörður, Akureyri, Húsavík',
    facing: 0,
    points: [
      [66.45, -22.4], [66.1, -21.7], [65.7, -21.68], [65.4, -20.95], [65.66, -20.28], [66.12, -20.1], [65.75, -19.64], [66.15, -18.91],
      [65.97, -18.53], [65.68, -18.09], [65.95, -18.18], [66.07, -17.85], [66.04, -17.34], [66.2, -17.15], [66.3, -16.45], [66.54, -16.19],
    ],
  },
  {
    id: 'nordest',
    name: 'Nord-est',
    places: 'Melrakkaslétta, Raufarhöfn, Langanes, Vopnafjörður',
    facing: 45,
    points: [[66.54, -16.19], [66.45, -15.95], [66.2, -15.33], [66.38, -14.53], [66.03, -14.8], [65.76, -14.83]],
  },
  {
    id: 'est',
    name: 'Est',
    places: 'Fiordi orientali, Seyðisfjörður, Neskaupstaður, Djúpivogur',
    facing: 90,
    points: [[65.76, -14.83], [65.55, -14.3], [65.27, -13.57], [65.08, -13.5], [64.93, -14.01], [64.8, -14.05], [64.66, -14.28]],
  },
  {
    id: 'sudest',
    name: 'Sud-est',
    places: 'Höfn, Jökulsárlón, Ingólfshöfði',
    facing: 135,
    points: [[64.66, -14.28], [64.42, -14.55], [64.24, -14.97], [64.12, -15.55], [64.05, -16.18], [63.8, -16.64]],
  },
  {
    id: 'sud',
    name: 'Sud',
    places: 'Vík, Reynisfjara, Þorlákshöfn, Grindavík',
    facing: 180,
    points: [
      [63.8, -16.64], [63.77, -17.3], [63.55, -17.9], [63.45, -18.5], [63.4, -19.13], [63.5, -19.6], [63.53, -20.12], [63.72, -20.75],
      [63.86, -21.15], [63.85, -21.38], [63.82, -21.7], [63.84, -22.43], [63.81, -22.7],
    ],
  },
];

/** A coast the app knows by stretch, with its own local notes. */
export interface CoastRegion {
  id: 'sardegna' | 'islanda';
  name: string;
  segments: readonly CoastSegment[];
  /** Drawn on the map only. */
  islands: readonly (readonly [number, number][])[];
  contains: (lat: number, lon: number) => boolean;
  /** Local effects worth a line, only where they are well known. */
  notes: (windFromDeg: number) => string[];
}

export const SARDINIA_REGION: CoastRegion = {
  id: 'sardegna',
  name: 'Sardegna',
  segments: SARDINIA,
  islands: SARDINIA_ISLANDS,
  contains: inSardinia,
  notes: (deg) =>
    ['O', 'NO', 'E'].includes(windFrom(deg).cardinal)
      ? ['Nelle Bocche di Bonifacio, tra Santa Teresa e la Corsica, il vento da ovest e da est si incanala e rinforza.']
      : [],
};

export const ICELAND_REGION: CoastRegion = {
  id: 'islanda',
  name: 'Islanda',
  segments: ICELAND,
  // Vestmannaeyjar.
  islands: [[[63.4, -20.32], [63.46, -20.3], [63.45, -20.22], [63.41, -20.24]]],
  contains: inIceland,
  notes: () => [
    'Nei fiordi il vento si incanala lungo il fiordo: può arrivare da una direzione diversa e soffiare più forte di quanto previsto per la zona.',
    'Ai piedi delle montagne e sui passi le raffiche possono superare di molto quelle previste: le misure in tempo reale sono su umferdin.is.',
    'Con vento forte le pianure di sabbia della costa sud, come Skeiðarársandur e Mýrdalssandur, possono dare tempeste di sabbia e ghiaia che rovinano vernice e vetri.',
  ],
};

export const REGIONS: readonly CoastRegion[] = [SARDINIA_REGION, ICELAND_REGION];

export function regionAt(lat: number, lon: number): CoastRegion | null {
  return REGIONS.find((r) => r.contains(lat, lon)) ?? null;
}

const KM_PER_DEG = 111.2;

/** Distance in km from a point to the outline of a segment, on a local flat projection. */
export function distanceToSegment(lat: number, lon: number, seg: CoastSegment): number {
  const kx = KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
  const P = (p: readonly [number, number]): [number, number] => [(p[1] - lon) * kx, (p[0] - lat) * KM_PER_DEG];
  let best = Infinity;
  for (let i = 1; i < seg.points.length; i++) {
    const [ax, ay] = P(seg.points[i - 1]);
    const [bx, by] = P(seg.points[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Stretch of the region's coast the place is on, when within `maxKm` of it. */
export function nearestSegment(region: CoastRegion, lat: number, lon: number, maxKm = 12): CoastSegment | null {
  if (!region.contains(lat, lon)) return null;
  let best: CoastSegment | null = null;
  let bestKm = maxKm;
  for (const seg of region.segments) {
    const km = distanceToSegment(lat, lon, seg);
    if (km <= bestKm) {
      best = seg;
      bestKm = km;
    }
  }
  return best;
}

export interface CoastReading {
  segment: CoastSegment;
  exposure: Exposure;
}

export function regionExposure(region: CoastRegion, windFromDeg: number): CoastReading[] {
  return region.segments.map((segment) => ({ segment, exposure: exposure(windFromDeg, segment.facing) }));
}

export const sardiniaExposure = (windFromDeg: number): CoastReading[] => regionExposure(SARDINIA_REGION, windFromDeg);

export const EXPOSURE_COPY: Record<Exposure, { label: string; hint: string }> = {
  esposta: { label: 'Esposta', hint: 'vento dal mare: onde e raffiche arrivano dritte a riva' },
  laterale: { label: 'Laterale', hint: 'vento lungo la costa: più mosso sui tratti aperti e sui promontori' },
  ridossata: {
    label: 'Più riparata',
    hint: 'vento da terra: mare di solito più calmo sotto costa, ma raffiche possibili e gonfiabili spinti al largo',
  },
};

const joinIt = (items: string[]): string => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`);

/** "nord-ovest, ovest e nord" for the stretches with that exposure. */
export function segmentNames(readings: CoastReading[], kind: Exposure): string {
  return joinIt(readings.filter((r) => r.exposure === kind).map((r) => r.segment.name.toLowerCase()));
}

/** Anywhere else: which way a coast should face to be in or out of the wind. */
export function genericExposure(windFromDeg: number): string {
  return `Le coste rivolte a ${windFrom(windFromDeg).direction} ricevono il vento dal mare e sono le più esposte. Quelle rivolte a ${windTowards(windFromDeg)} lo ricevono da terra: mare di solito più calmo sotto costa, ma non per forza meno vento.`;
}
