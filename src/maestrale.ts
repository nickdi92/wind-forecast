import type { HourPoint } from './forecast';
import { whenLabel } from './format';
import { CALM_BELOW, intensityWord, speedLabel, windFrom, type SpeedUnit } from './wind';

/** From this mean speed a north-westerly counts as maestrale rather than a breeze. */
export const MAESTRALE_MIN = 12; // km/h
/** Maestrale is talked about in days: 24, 48 and 72 hours. */
const WINDOWS = 3;

export const isMaestrale = (h: HourPoint): boolean => h.speed >= MAESTRALE_MIN && windFrom(h.dir).name === 'Maestrale';

export interface MaestraleWindow {
  /** Hours from now: 0–24, 24–48, 48–72. */
  from: number;
  to: number;
  /** Hours of maestrale in the window; 0 when it does not blow. */
  hours: number;
  maxSpeed: number;
  maxGust: number;
  /** False when the forecast does not cover the whole window. */
  complete: boolean;
}

export interface MaestraleOutlook {
  now: boolean;
  windows: MaestraleWindow[];
  first: HourPoint | null;
  last: HourPoint | null;
  /** Hour right after the last maestrale hour, when the forecast covers it. */
  after: HourPoint | null;
  /** Hours of forecast looked at, at most 72. */
  horizon: number;
}

/** @param hours Hourly forecast starting with the current hour. */
export function maestraleOutlook(now: HourPoint, hours: HourPoint[]): MaestraleOutlook {
  const span = hours.slice(0, WINDOWS * 24);
  const windows = Array.from({ length: WINDOWS }, (_, i) => {
    const slice = span.slice(i * 24, i * 24 + 24);
    const on = slice.filter(isMaestrale);
    return {
      from: i * 24,
      to: i * 24 + 24,
      hours: on.length,
      maxSpeed: Math.max(0, ...on.map((h) => h.speed)),
      maxGust: Math.max(0, ...on.map((h) => h.gust)),
      complete: slice.length === 24,
    };
  });
  const firstIdx = span.findIndex(isMaestrale);
  const lastIdx = span.findLastIndex(isMaestrale);
  return {
    now: isMaestrale(now),
    windows,
    first: firstIdx >= 0 ? span[firstIdx] : null,
    last: lastIdx >= 0 ? span[lastIdx] : null,
    after: lastIdx >= 0 ? (span[lastIdx + 1] ?? null) : null,
    horizon: span.length,
  };
}

/** One line for the collapsed panel. */
export function maestraleStatus(o: MaestraleOutlook, now: HourPoint, today: string): string {
  if (o.now) return `Soffia adesso, ${intensityWord(now.speed)}`;
  if (o.first) return `Previsto ${whenLabel(o.first.time, today)}`;
  return `Non previsto nelle prossime ${o.horizon >= 72 ? 72 : o.horizon} ore`;
}

/**
 * How long it lasts, from the forecast only: past the forecast horizon the app does not guess.
 */
export function maestralePersistence(o: MaestraleOutlook, today: string): string | null {
  if (!o.last) return null;
  if (!o.after) {
    return `Le previsioni lo danno ancora attivo fra ${o.horizon} ore: oltre questo orizzonte non si può dire quando finirà.`;
  }
  const when = whenLabel(o.after.time, today);
  if (o.after.speed < CALM_BELOW) return `Secondo le previsioni si attenua ${when}, con vento quasi assente.`;
  const next = windFrom(o.after.dir);
  return next.name === 'Maestrale'
    ? `Secondo le previsioni si attenua ${when}, diventando debole.`
    : `Secondo le previsioni si attenua ${when} e lascia il posto a ${next.name}.`;
}

/** "In rinforzo", "in calo" or "stabile" across the three windows, by their peaks. */
export function maestraleTrend(o: MaestraleOutlook): 'rinforzo' | 'calo' | 'stabile' | null {
  const active = o.windows.filter((w) => w.hours > 0);
  if (active.length < 2) return null;
  const [a, b] = [active[0].maxSpeed, active.at(-1)!.maxSpeed];
  const step = Math.max(6, a * 0.25);
  if (b - a >= step) return 'rinforzo';
  if (a - b >= step) return 'calo';
  return 'stabile';
}

export function windowLabel(w: MaestraleWindow): string {
  return w.from === 0 ? 'Prossime 24 ore' : `Tra ${w.from} e ${w.to} ore`;
}

export function windowCopy(w: MaestraleWindow, unit: SpeedUnit): string {
  if (!w.complete && w.hours === 0) return 'Fuori dalle previsioni';
  if (w.hours === 0) return 'Non previsto';
  return `${w.hours} ${w.hours === 1 ? 'ora' : 'ore'}, fino a ${speedLabel(w.maxSpeed, unit)}, raffiche ${speedLabel(w.maxGust, unit)}`;
}
