import type { GustAlert } from './alerts';
import { convertSpeed, UNIT_LABEL, windFrom, type SpeedUnit } from './wind';

/** Open-Meteo local times look like "2026-10-22T17:00"; read the hour without Date to stay in the place's timezone. */
export const hourLabel = (iso: string): string => iso.slice(11, 13);

/** Wall-clock time in a timezone, in the same shape as Open-Meteo local times. */
export function localIso(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export const nextHourLabel = (iso: string): string => String((Number(iso.slice(11, 13)) + 1) % 24).padStart(2, '0');

const utcDate = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const weekday = new Intl.DateTimeFormat('it-IT', { weekday: 'short', timeZone: 'UTC' });
const weekdayLong = new Intl.DateTimeFormat('it-IT', { weekday: 'long', timeZone: 'UTC' });

/** Calendar days from `today` to `date`, both "2026-10-22". */
export const daysBetween = (date: string, today: string): number =>
  Math.round((utcDate(date.slice(0, 10)).getTime() - utcDate(today.slice(0, 10)).getTime()) / 86_400_000);

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function dayLabel(date: string, today: string): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  const wd = weekday.format(utcDate(date)).replace('.', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${Number(date.slice(8, 10))}`;
}

/** Day as said in a sentence: "oggi", "domani", "lunedì". */
export function dayWord(date: string, today: string): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return 'oggi';
  if (diff === 1) return 'domani';
  return weekdayLong.format(utcDate(date.slice(0, 10)));
}

/** When something happens, as a forecast says it: "nel pomeriggio", "domattina", "lunedì sera". */
export function whenLabel(time: string, today: string): string {
  const h = Number(time.slice(11, 13));
  const diff = daysBetween(time, today);
  if (diff <= 0) return h < 6 ? 'prima dell’alba' : h < 12 ? 'in mattinata' : h < 18 ? 'nel pomeriggio' : h < 22 ? 'in serata' : 'in nottata';
  if (diff === 1) return h < 6 ? 'nella notte' : h < 12 ? 'domattina' : h < 18 ? 'domani pomeriggio' : 'domani sera';
  return `${dayWord(time, today)} ${h < 6 ? 'notte' : h < 12 ? 'mattina' : h < 18 ? 'pomeriggio' : 'sera'}`;
}

export function agoLabel(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'aggiornato adesso';
  if (min < 60) return `aggiornato ${min} min fa`;
  const h = Math.floor(min / 60);
  if (h === 1) return "aggiornato un'ora fa";
  if (h < 24) return `aggiornato ${h} ore fa`;
  return 'aggiornato più di un giorno fa';
}

export function alertCopy(a: GustAlert, unit: SpeedUnit): { title: string; advice: string } {
  const peak = `fino a ${convertSpeed(a.maxGust, unit)} ${UNIT_LABEL[unit]}`;
  const until = nextHourLabel(a.end);
  const when = a.ongoing ? `adesso e fino alle ${until}` : `dalle ${hourLabel(a.start)} alle ${until}`;
  const advice =
    a.level === 'pericolo'
      ? `Ritira tendalino e accessori, evita viadotti e strade esposte. Parcheggia con il muso verso ${windFrom(a.dir).direction}.`
      : 'Chiudi il tendalino e fai attenzione alla guida su strade esposte.';
  return { title: `Raffiche forti ${when}, ${peak}`, advice };
}
