import type { Sun } from './forecast';

const DAY_S = 86_400;
/** Days shorter or longer than this are worth a line under the wind. */
const SHORT_DAY = 9 * 3600;
const LONG_DAY = 17 * 3600;

export const polarNight = (s: Sun): boolean => s.daylight <= 0;
export const midnightSun = (s: Sun): boolean => s.daylight >= DAY_S - 60;

/** "6 h 55 min", "45 min". */
export function durationLabel(seconds: number): string {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const clock = (iso: string): string => iso.slice(11, 16);

/** The sun only matters when days get short or long, or it stays up or down all day. */
export const notableDay = (s: Sun): boolean => s.daylight < SHORT_DAY || s.daylight > LONG_DAY;

/**
 * Daylight left, as the reading shows it under the wind.
 * @param now Local time at the place.
 * @param tomorrow Tomorrow's sun, for after sunset.
 */
export function sunCopy(today: Sun, now: string, tomorrow?: Sun): string {
  if (polarNight(today)) return 'Notte polare: il sole non sorge, solo qualche ora di crepuscolo a metà giornata';
  if (midnightSun(today)) return 'Sole di mezzanotte: il sole non tramonta';
  const span = durationLabel(today.daylight);
  if (now < today.rise) return `Il sole sorge alle ${clock(today.rise)} e tramonta alle ${clock(today.set)}, ${span} di luce`;
  if (now < today.set) return `Luce fino alle ${clock(today.set)}, sole dalle ${clock(today.rise)}: ${span} di luce`;
  if (!tomorrow || polarNight(tomorrow) || midnightSun(tomorrow)) return `Il sole è tramontato alle ${clock(today.set)}`;
  return `Il sole è tramontato alle ${clock(today.set)}, domani sorge alle ${clock(tomorrow.rise)}`;
}
