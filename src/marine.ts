import type { HourPoint } from './forecast';
import { cap, dayWord, whenLabel } from './format';
import { angleBetween, windFrom } from './wind';

type Series = (number | null)[];

/** Subset of the Open-Meteo Marine response we request. Times are local to the place; all values are null on land. */
export interface MarineResponse {
  /** Centre of the sea grid cell the values belong to: it can be several km off the place. */
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    wave_height: Series;
    wave_direction: Series;
    wave_period: Series;
    wind_wave_height: Series;
    wind_wave_direction: Series;
    swell_wave_height: Series;
    swell_wave_direction: Series;
    swell_wave_period: Series;
  };
}

/** One hour of sea. Directions are where the waves come from, like the wind. */
export interface SeaPoint {
  time: string;
  /** Significant wave height, m: the mean of the highest third of the waves. */
  height: number;
  dir: number | null;
  /** Mean period, s. */
  period: number | null;
  /** Part raised by the wind blowing there now. */
  windWave: number | null;
  windWaveDir: number | null;
  /** Part arriving from far away: what is left of wind that blew elsewhere or earlier. */
  swell: number | null;
  swellDir: number | null;
  swellPeriod: number | null;
}

export interface Sea {
  /** km from the place to the centre of the sea cell. */
  distance: number;
  now: SeaPoint;
  /** Hourly, from the current hour on. */
  ahead: SeaPoint[];
}

const rad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * Sea conditions from the current hour on, or null when the response has no sea values (inland,
 * or a response cached before the sea was added).
 * @param now Wall-clock time at the place, as for buildForecast.
 */
export function buildSea(r: MarineResponse | null | undefined, place: { lat: number; lon: number }, now: string): Sea | null {
  const h = r?.hourly;
  if (!r || !h?.time?.length) return null;
  const points: SeaPoint[] = h.time.flatMap((time, i) => {
    const height = h.wave_height?.[i];
    if (height == null) return [];
    return [
      {
        time,
        height,
        dir: h.wave_direction?.[i] ?? null,
        period: h.wave_period?.[i] ?? null,
        windWave: h.wind_wave_height?.[i] ?? null,
        windWaveDir: h.wind_wave_direction?.[i] ?? null,
        swell: h.swell_wave_height?.[i] ?? null,
        swellDir: h.swell_wave_direction?.[i] ?? null,
        swellPeriod: h.swell_wave_period?.[i] ?? null,
      },
    ];
  });
  const hour = `${now.slice(0, 13)}:00`;
  const ahead = points.filter((p) => p.time >= hour);
  if (!ahead.length) return null;
  return { distance: distanceKm(place.lat, place.lon, r.latitude, r.longitude), now: ahead[0], ahead };
}

/** Douglas sea scale (WMO code 3700): upper bound of each degree in metres of significant wave height. */
const DOUGLAS: readonly [max: number, label: string][] = [
  [0, 'calmo'],
  [0.1, 'quasi calmo'],
  [0.5, 'poco mosso'],
  [1.25, 'mosso'],
  [2.5, 'molto mosso'],
  [4, 'agitato'],
  [6, 'molto agitato'],
  [9, 'grosso'],
  [14, 'molto grosso'],
  [Infinity, 'tempestoso'],
];

export function seaState(m: number): { degree: number; label: string } {
  const degree = DOUGLAS.findIndex(([max]) => m <= max);
  return { degree, label: DOUGLAS[degree][1] };
}

/** "0,8 m", "2 m": a decimal is all the models can tell apart. */
export const mLabel = (m: number): string => (m < 0.05 ? 'meno di 0,1 m' : `${String(Math.round(m * 10) / 10).replace('.', ',')} m`);
const sLabel = (s: number): string => `${Math.round(s)} s`;
const from = (dir: number | null): string => (dir == null ? '' : ` da ${windFrom(dir).direction}`);

export interface SeaTrend {
  kind: 'aumento' | 'calo' | 'stabile';
  /** Highest or lowest point in the next 24 hours. */
  point: SeaPoint;
}

/** Where the waves go in the next 24 hours; a change counts when it moves the sea to another Douglas degree. */
export function seaTrend(sea: Sea): SeaTrend {
  const next = sea.ahead.slice(1, 25);
  const base = sea.now.height;
  if (!next.length) return { kind: 'stabile', point: sea.now };
  const peak = next.reduce((a, b) => (b.height > a.height ? b : a));
  const low = next.reduce((a, b) => (b.height < a.height ? b : a));
  const step = Math.max(0.2, base * 0.25);
  const degree = seaState(base).degree;
  const up = peak.height - base >= step && seaState(peak.height).degree > degree;
  const down = base - low.height >= step && seaState(low.height).degree < degree;
  if (up && (!down || peak.time <= low.time)) return { kind: 'aumento', point: peak };
  if (down) return { kind: 'calo', point: low };
  return { kind: 'stabile', point: peak };
}

export type SeaOrigin = 'calmo' | 'vivo' | 'residuo' | 'misto';

/**
 * Local wind sea against swell, from the model's own split of the waves; the wind speed only says
 * whether the swell is left over from wind that is no longer blowing here.
 */
export function seaOrigin(p: SeaPoint): SeaOrigin {
  if (p.height < 0.2) return 'calmo';
  const ww = p.windWave ?? 0;
  const sw = p.swell ?? 0;
  if (sw >= 0.2 && sw >= ww) return 'residuo';
  if (ww >= Math.max(sw * 1.5, 0.1)) return 'vivo';
  return 'misto';
}

/** Highest waves of each day, up to three days. */
export function seaDays(sea: Sea, days = 3): SeaPoint[] {
  const out: SeaPoint[] = [];
  for (const p of sea.ahead) {
    const last = out.at(-1);
    if (last && last.time.slice(0, 10) === p.time.slice(0, 10)) {
      if (p.height > last.height) out[out.length - 1] = p;
    } else if (out.length < days) out.push(p);
    else break;
  }
  return out;
}

/** Sea now in a few words: "Mosso, onde di 0,8 m da nord-ovest". */
export function seaHeadline(p: SeaPoint): string {
  return `${cap(seaState(p.height).label)}, onde di ${mLabel(p.height)}${from(p.dir)}`;
}

/** "in aumento fino a 1,4 m in serata". */
export function seaTrendCopy(t: SeaTrend, today: string): string {
  if (t.kind === 'aumento') return `in aumento fino a ${mLabel(t.point.height)} ${whenLabel(t.point.time, today)}`;
  if (t.kind === 'calo') return `in calo, ${mLabel(t.point.height)} ${whenLabel(t.point.time, today)}`;
  return 'senza grandi variazioni nelle prossime 24 ore';
}

/** Local wind sea or leftover swell, and how it sits with the wind blowing now. */
export function seaOriginCopy(p: SeaPoint, wind: HourPoint): string {
  const origin = seaOrigin(p);
  const ww = p.windWave ?? 0;
  const sw = p.swell ?? 0;
  if (origin === 'calmo') return 'Onda quasi assente.';
  if (origin === 'residuo') {
    const period = p.swellPeriod ? `, periodo ${sLabel(p.swellPeriod)}` : '';
    const local = wind.speed < 20 ? ' Il vento qui è debole: è mare residuo, che può restare anche quando il vento è calato.' : '';
    return `Prevale l’onda lunga${from(p.swellDir)} (${mLabel(sw)}${period}), arrivata da lontano e non alzata dal vento locale.${local}`;
  }
  if (origin === 'vivo') {
    const weak = wind.speed >= 25 && p.height < 0.5 ? ' Il vento è sostenuto ma l’onda resta bassa: succede quando soffia da terra o ha poco mare davanti.' : '';
    return `Mare vivo, alzato dal vento che soffia adesso: cresce e cala con il vento.${weak}`;
  }
  const crossed =
    p.windWaveDir != null && p.swellDir != null && angleBetween(p.windWaveDir, p.swellDir) >= 45
      ? ' Arrivano da direzioni diverse: mare incrociato, più fastidioso in acqua e in barca.'
      : '';
  return `Mare misto: onda del vento locale${from(p.windWaveDir)} (${mLabel(ww)}) e onda lunga${from(p.swellDir)} (${mLabel(sw)}).${crossed}`;
}

/** "Oggi fino a 1,4 m, domani 0,8 m, lunedì 0,3 m." */
export function seaDaysCopy(sea: Sea, today: string): string {
  const days = seaDays(sea);
  return `${days.map((d, i) => `${i ? dayWord(d.time, today) : cap(dayWord(d.time, today))} ${i ? '' : 'fino a '}${mLabel(d.height)}`).join(', ')}.`;
}
