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
}

export const WINDS: readonly Wind[] = [
  { name: 'Tramontana', cardinal: 'N', direction: 'nord', deg: 0, warm: false },
  { name: 'Grecale', cardinal: 'NE', direction: 'nord-est', deg: 45, warm: false },
  { name: 'Levante', cardinal: 'E', direction: 'est', deg: 90, warm: false },
  { name: 'Scirocco', cardinal: 'SE', direction: 'sud-est', deg: 135, warm: true },
  { name: 'Ostro', cardinal: 'S', direction: 'sud', deg: 180, warm: true },
  { name: 'Libeccio', cardinal: 'SO', direction: 'sud-ovest', deg: 225, warm: true },
  { name: 'Ponente', cardinal: 'O', direction: 'ovest', deg: 270, warm: false },
  { name: 'Maestrale', cardinal: 'NO', direction: 'nord-ovest', deg: 315, warm: false },
];

export const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;

export function windFrom(deg: number): Wind {
  // Half-way points round towards the previous sector (22.5° is still Tramontana).
  const sector = Math.ceil(normalizeDeg(deg) / 45 - 0.5) % 8;
  return WINDS[sector];
}

const BEAUFORT: readonly [min: number, label: string][] = [
  [0, 'Calma'],
  [1, 'Bava di vento'],
  [6, 'Brezza leggera'],
  [12, 'Brezza tesa'],
  [20, 'Vento moderato'],
  [29, 'Vento teso'],
  [39, 'Vento fresco'],
  [50, 'Vento forte'],
  [62, 'Burrasca moderata'],
  [75, 'Burrasca forte'],
  [89, 'Tempesta'],
  [103, 'Fortunale'],
  [118, 'Uragano'],
];

export function beaufort(kmh: number): { force: number; label: string } {
  let force = 0;
  for (let i = 0; i < BEAUFORT.length; i++) {
    if (kmh >= BEAUFORT[i][0]) force = i;
  }
  return { force, label: BEAUFORT[force][1] };
}

export type SpeedUnit = 'kmh' | 'kn' | 'ms';

export const UNIT_LABEL: Record<SpeedUnit, string> = { kmh: 'km/h', kn: 'nodi', ms: 'm/s' };

const UNIT_FACTOR: Record<SpeedUnit, number> = { kmh: 1, kn: 1 / 1.852, ms: 1 / 3.6 };

export function convertSpeed(kmh: number, unit: SpeedUnit): number {
  return Math.round(kmh * UNIT_FACTOR[unit]);
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
