import type { HourPoint } from './forecast';

export const GUST_WARN = 40;
export const GUST_DANGER = 60;

export interface GustAlert {
  level: 'attenzione' | 'pericolo';
  maxGust: number;
  /** First and last hour with gusts at or above GUST_WARN. */
  start: string;
  end: string;
  /** Strong gusts are blowing right now. */
  ongoing: boolean;
  /** Direction of the peak gust (where it comes from). */
  dir: number;
}

/** A lull this many hours long or shorter does not end a spell of strong gusts. */
const LULL_HOURS = 2;

/** The first spell of strong gusts: later spells are reported once this one is over. */
export function gustAlert(hours: HourPoint[]): GustAlert | null {
  const first = hours.findIndex((h) => h.gust >= GUST_WARN);
  if (first < 0) return null;
  let last = first;
  for (let i = first + 1; i < hours.length && i - last <= LULL_HOURS + 1; i++) {
    if (hours[i].gust >= GUST_WARN) last = i;
  }
  const spell = hours.slice(first, last + 1);
  const peak = spell.reduce((best, h) => (h.gust > best.gust ? h : best));
  return {
    level: peak.gust >= GUST_DANGER ? 'pericolo' : 'attenzione',
    maxGust: peak.gust,
    start: hours[first].time,
    end: hours[last].time,
    ongoing: first === 0,
    dir: peak.dir,
  };
}
