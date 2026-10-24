// Mediterranean wind rose: named by the direction the wind comes FROM.
export interface Wind {
  name: string;
  cardinal: string;
  /** Spelled out, as in "da nord-ovest". */
  direction: string;
  /** Points on the rose, 0 = N, clockwise. */
  deg: number;
  /** Southern winds (Scirocco, Ostro, Libeccio) bring warm air. */
  warm: boolean;
  /** Only Tramontana: adjectives agree with it ("Tramontana tesa", "Maestrale teso"). */
  feminine?: boolean;
  /** What it is usually like, Sardinia first. Climate, not forecast. */
  about: string;
}

export const WINDS: readonly Wind[] = [
  {
    name: 'Tramontana',
    cardinal: 'N',
    direction: 'nord',
    deg: 0,
    warm: false,
    feminine: true,
    about: 'Fredda e secca, scende da nord: di solito cielo limpido e temperature in calo. In Sardegna batte soprattutto le coste settentrionali.',
  },
  {
    name: 'Grecale',
    cardinal: 'NE',
    direction: 'nord-est',
    deg: 45,
    warm: false,
    about: 'Fresco, a volte umido, arriva da nord-est: alza il mare sulle coste rivolte a nord-est, in Sardegna la Gallura e la costa nord-orientale.',
  },
  {
    name: 'Levante',
    cardinal: 'E',
    direction: 'est',
    deg: 90,
    warm: false,
    about: 'Spesso umido, porta nuvole e piogge sui versanti orientali. Nelle Bocche di Bonifacio si incanala e rinforza.',
  },
  {
    name: 'Scirocco',
    cardinal: 'SE',
    direction: 'sud-est',
    deg: 135,
    warm: true,
    about: 'Caldo e umido, arriva dal Nord Africa: afa, foschia, a volte sabbia del Sahara. Alza il mare sulle coste rivolte a sud-est.',
  },
  {
    name: 'Ostro',
    cardinal: 'S',
    direction: 'sud',
    deg: 180,
    warm: true,
    about: 'Caldo e umido, spesso con nuvole e piogge. Alza il mare sulle coste meridionali, in Sardegna dal Golfo di Cagliari a Chia.',
  },
  {
    name: 'Libeccio',
    cardinal: 'SO',
    direction: 'sud-ovest',
    deg: 225,
    warm: true,
    about: 'Può essere forte e tempestoso, con mareggiate sulle coste esposte. In Sardegna batte il Sulcis e la costa occidentale.',
  },
  {
    name: 'Ponente',
    cardinal: 'O',
    direction: 'ovest',
    deg: 270,
    warm: false,
    about: 'Arriva da ovest, spesso con il passaggio delle perturbazioni atlantiche. Nelle Bocche di Bonifacio si incanala e rinforza.',
  },
  {
    name: 'Maestrale',
    cardinal: 'NO',
    direction: 'nord-ovest',
    deg: 315,
    warm: false,
    about: 'Fresco e secco, arriva da nord-ovest: cielo terso, ottima visibilità, spesso forte. In Sardegna è il vento dominante e il più intenso.',
  },
];

/** Below this the app shows "Calma" instead of a wind name. */
export const CALM_BELOW = 2; // km/h

export const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * The Mediterranean names mean nothing in Iceland or Patagonia: there the app says where the wind
 * comes from instead ("Nord-ovest"). One setting for the whole page, chosen from the place.
 */
export type WindNaming = 'mediterraneo' | 'direzioni';

let naming: WindNaming = 'mediterraneo';
let directions: readonly Wind[] = directionRose(true);

function directionRose(warmSouth: boolean): readonly Wind[] {
  return WINDS.map((w) => ({
    ...w,
    name: w.direction.charAt(0).toUpperCase() + w.direction.slice(1),
    feminine: false,
    warm: warmSouth && w.warm,
    about: '',
  }));
}

/**
 * @param warmSouth Colour southern winds as warm: true in the northern mid-latitudes, false where
 * the app cannot tell (south of the equator a southerly is cold).
 */
export function useWindNaming(n: WindNaming, warmSouth = true): void {
  naming = n;
  directions = directionRose(warmSouth);
}

export const mediterraneanNames = (): boolean => naming === 'mediterraneo';

/** The eight winds as the page names them now. */
export const windRose = (): readonly Wind[] => (naming === 'mediterraneo' ? WINDS : directions);

export function windFrom(deg: number): Wind {
  // Half-way points round towards the previous sector (22.5° is still Tramontana).
  const sector = Math.ceil(normalizeDeg(deg) / 45 - 0.5) % 8;
  return windRose()[sector];
}

/** After "da" in a sentence: "da Maestrale" in the Mediterranean, "da nord-ovest" elsewhere. */
export const windInSentence = (w: Wind): string => (naming === 'mediterraneo' ? w.name : w.direction);

/** Where the air goes: the opposite point, spelled out ("sud-est" for a wind from 315°). */
export const windTowards = (deg: number): string => windFrom(deg + 180).direction;

/** Shortest angle between two bearings, 0–180°. */
export const angleBetween = (a: number, b: number): number => Math.abs(((normalizeDeg(a - b) + 180) % 360) - 180);

/** WMO Beaufort scale: lower bound in km/h, Italian name, what you see on land and at sea. */
const BEAUFORT: readonly [min: number, label: string, land: string, sea: string][] = [
  [0, 'Calma', 'Il fumo sale dritto.', 'Mare piatto, a specchio.'],
  [1, 'Bava di vento', 'Il fumo si piega, le banderuole restano ferme.', 'Piccole increspature, senza creste.'],
  [6, 'Brezza leggera', 'Il vento si sente sul viso, le foglie frusciano.', 'Onde corte, creste lisce che non si rompono.'],
  [12, 'Brezza tesa', 'Foglie e rametti sempre in movimento, le bandiere leggere si distendono.', 'Le prime creste si rompono, qualche pecorella.'],
  [20, 'Vento moderato', 'Si alzano polvere e carta, si muovono i rami piccoli.', 'Onde più lunghe, pecorelle frequenti.'],
  [29, 'Vento teso', 'Oscillano gli alberelli, increspature sugli specchi d’acqua interni.', 'Onde moderate e allungate, molte pecorelle, qualche spruzzo.'],
  [39, 'Vento fresco', 'Si muovono i rami grossi, i fili fischiano, l’ombrello si usa a fatica.', 'Onde grandi, creste bianche estese, spruzzi.'],
  [50, 'Vento forte', 'Alberi interi in movimento, si cammina a fatica controvento.', 'Il mare si ingrossa, la schiuma si allinea in strisce.'],
  [62, 'Burrasca moderata', 'Si spezzano i rami, camminare è molto difficile.', 'Onde alte e lunghe, le creste si rompono in spruzzi.'],
  [75, 'Burrasca forte', 'Danni leggeri: tegole, comignoli, insegne.', 'Onde alte, dense strisce di schiuma, spruzzi che tolgono visibilità.'],
  [89, 'Tempesta', 'Alberi sradicati, danni seri alle costruzioni.', 'Onde molto alte, mare bianco di schiuma.'],
  [103, 'Fortunale', 'Danni estesi. Molto raro.', 'Onde eccezionali, mare coperto di schiuma.'],
  [118, 'Uragano', 'Devastazione.', 'Aria piena di schiuma e spruzzi, visibilità quasi nulla.'],
];

export function beaufort(kmh: number): { force: number; label: string } {
  let force = 0;
  for (let i = 0; i < BEAUFORT.length; i++) {
    if (kmh >= BEAUFORT[i][0]) force = i;
  }
  return { force, label: BEAUFORT[force][1] };
}

export const beaufortLabel = (force: number): string => BEAUFORT[Math.max(0, Math.min(12, force))][1];

/** Observable effects of a Beaufort force. The scale describes the mean wind, not the gusts. */
export function beaufortEffects(force: number): { land: string; sea: string } {
  const [, , land, sea] = BEAUFORT[Math.max(0, Math.min(12, force))];
  return { land, sea };
}

export type SpeedUnit = 'kmh' | 'kn' | 'ms';

export const UNIT_LABEL: Record<SpeedUnit, string> = { kmh: 'km/h', kn: 'nodi', ms: 'm/s' };

const UNIT_FACTOR: Record<SpeedUnit, number> = { kmh: 1, kn: 1 / 1.852, ms: 1 / 3.6 };

export function convertSpeed(kmh: number, unit: SpeedUnit): number {
  return Math.round(kmh * UNIT_FACTOR[unit]);
}

/** "24 km/h", "13 nodi". */
export const speedLabel = (kmh: number, unit: SpeedUnit): string => `${convertSpeed(kmh, unit)} ${UNIT_LABEL[unit]}`;

/**
 * Lower bound of each Beaufort force from the WMO table of each unit, not converted from km/h,
 * so the ranges keep their official round numbers.
 */
export const BEAUFORT_FROM: Record<SpeedUnit, readonly number[]> = {
  kmh: [0, 1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118],
  kn: [0, 1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64],
  ms: [0, 0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7],
};

/** "20–28 km/h", "5,5–7,9 m/s", "da 118 km/h". */
export function beaufortRange(force: number, unit: SpeedUnit): string {
  const from = BEAUFORT_FROM[unit];
  const step = unit === 'ms' ? 0.1 : 1;
  const num = (v: number) => (unit === 'ms' ? v.toFixed(1).replace('.', ',') : String(v));
  if (force >= 12) return `da ${num(from[12])} ${UNIT_LABEL[unit]}`;
  if (force <= 0) return `meno di ${num(from[1])} ${UNIT_LABEL[unit]}`;
  return `${num(from[force])}–${num(+(from[force + 1] - step).toFixed(1))} ${UNIT_LABEL[unit]}`;
}

/** How Italian bulletins grade the wind: deboli, moderati, tesi, forti, di burrasca, di tempesta. */
export function intensityWord(kmh: number, feminine = false): string {
  const { force } = beaufort(kmh);
  if (force <= 3) return 'debole';
  if (force === 4) return feminine ? 'moderata' : 'moderato';
  if (force === 5) return feminine ? 'tesa' : 'teso';
  if (force <= 7) return 'forte';
  if (force <= 9) return 'di burrasca';
  return 'di tempesta';
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Circular mean of directions and the widest deviation from it, clamped to 8°–90°. */
export function directionSpread(dirs: number[]): { mean: number; half: number } {
  const x = dirs.reduce((s, d) => s + Math.cos(rad(d)), 0);
  const y = dirs.reduce((s, d) => s + Math.sin(rad(d)), 0);
  if (Math.hypot(x, y) < 1e-9) return { mean: normalizeDeg(dirs[0] ?? 0), half: 90 };
  const mean = normalizeDeg((Math.atan2(y, x) * 180) / Math.PI);
  const widest = Math.max(...dirs.map((d) => Math.abs(((normalizeDeg(d - mean) + 180) % 360) - 180)));
  return { mean, half: Math.min(90, Math.max(8, widest)) };
}
