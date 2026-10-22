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

export function gustAlert(hours: HourPoint[]): GustAlert | null {
  const strong = hours.map((h, i) => (h.gust >= GUST_WARN ? i : -1)).filter((i) => i >= 0);
  if (strong.length === 0) return null;
  const peak = hours.reduce((best, h) => (h.gust > best.gust ? h : best));
  return {
    level: peak.gust >= GUST_DANGER ? 'pericolo' : 'attenzione',
    maxGust: peak.gust,
    start: hours[strong[0]].time,
    end: hours[strong[strong.length - 1]].time,
    ongoing: strong[0] === 0,
    dir: peak.dir,
  };
}
