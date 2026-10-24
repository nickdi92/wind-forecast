import { GUST_DANGER, GUST_WARN } from './alerts';
import type { Forecast, HourPoint } from './forecast';
import { cap, dayWord, whenLabel } from './format';
import {
  angleBetween,
  beaufort,
  CALM_BELOW,
  intensityWord,
  mediterraneanNames,
  speedLabel,
  windFrom,
  type SpeedUnit,
  type Wind,
} from './wind';

/** How far "the next hours" reach in the summary. */
export const OUTLOOK_HOURS = 12;
/** Below this the wind is too light for a change of direction to matter. */
const SHIFT_MIN = 6; // km/h
/** Below this a day is called calm-ish rather than named after its wind. */
const LIGHT = 12; // km/h

/** Smallest change in mean wind worth a word: 6 km/h, or 30% of a stronger wind. */
const meaningful = (kmh: number): number => Math.max(6, kmh * 0.3);

// The same sentence with Mediterranean names or with plain directions.
/** Subject: "Maestrale" or "vento da nord-ovest". */
const ref = (w: Wind): string => (mediterraneanNames() ? w.name : `vento da ${w.direction}`);
/** Subject with strength: "Maestrale teso" or "vento teso da nord-ovest". */
const withStrength = (w: Wind, kmh: number): string =>
  mediterraneanNames() ? `${w.name} ${intensityWord(kmh, w.feminine)}` : `vento ${intensityWord(kmh)} da ${w.direction}`;
/** After a colon: "Maestrale forte" or "forte da nord-ovest". */
const strengthTag = (w: Wind, kmh: number): string =>
  mediterraneanNames() ? `${w.name} ${intensityWord(kmh, w.feminine)}` : `${intensityWord(kmh)} da ${w.direction}`;
/** Just where from: "Maestrale" or "da nord-ovest". */
const fromTag = (w: Wind): string => (mediterraneanNames() ? w.name : `da ${w.direction}`);
const turnsTo = (w: Wind): string => (mediterraneanNames() ? `gira a ${w.name}` : `gira da ${w.direction}`);
const cap1 = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const hoursApart = (a: string, b: string): number => (Date.parse(`${b.slice(0, 16)}:00Z`) - Date.parse(`${a.slice(0, 16)}:00Z`)) / 3_600_000;

/** Like whenLabel, but the next couple of hours are just "nelle prossime ore". */
function whenAhead(time: string, now: string, today: string): string {
  return hoursApart(now, time) <= 2 ? 'nelle prossime ore' : whenLabel(time, today);
}

export interface Trend {
  kind: 'rinforzo' | 'calo' | 'stabile';
  /** Hour of the peak when rising, of the first clear drop when easing. */
  at: string | null;
  /** Peak mean wind when rising or steady, the lowest when easing. */
  speed: number;
  /** After rising: when it clearly eases again, within 24 hours. */
  easesAt: string | null;
}

/**
 * Where the mean wind goes in the next hours. A change counts only when it is large and moves the
 * wind to another Beaufort force, so a model wobble of a few km/h stays "stabile".
 * @param hours Hourly forecast starting with the current hour.
 */
export function windTrend(now: HourPoint, hours: HourPoint[]): Trend {
  const next = hours.slice(1, OUTLOOK_HOURS + 1);
  if (!next.length) return { kind: 'stabile', at: null, speed: now.speed, easesAt: null };
  const step = meaningful(now.speed);
  const force = beaufort(now.speed).force;
  const peak = next.reduce((a, b) => (b.speed > a.speed ? b : a));
  const low = next.reduce((a, b) => (b.speed < a.speed ? b : a));
  const up = peak.speed - now.speed >= step && beaufort(peak.speed).force > force;
  const down = now.speed - low.speed >= step && beaufort(low.speed).force < force;
  // Rising and then easing: the first change leads.
  if (up && (!down || peak.time <= low.time)) {
    const after = hours.slice(hours.indexOf(peak) + 1, 25);
    const eases = after.find(
      (h) => peak.speed - h.speed >= meaningful(peak.speed) && beaufort(h.speed).force < beaufort(peak.speed).force,
    );
    return { kind: 'rinforzo', at: peak.time, speed: peak.speed, easesAt: eases?.time ?? null };
  }
  if (down) {
    const first = next.find((h) => now.speed - h.speed >= step)!;
    return { kind: 'calo', at: first.time, speed: low.speed, easesAt: null };
  }
  return { kind: 'stabile', at: null, speed: peak.speed, easesAt: null };
}

/** A lasting change of named wind in the next hours: three hours in a row from a clearly different direction. */
export function windShift(now: HourPoint, hours: HourPoint[]): { wind: Wind; at: string } | null {
  if (now.speed < CALM_BELOW) return null; // the headline already names the wind that picks up
  const current = windFrom(now.dir).name;
  const next = hours.slice(1, OUTLOOK_HOURS + 1);
  for (let i = 0; i + 3 <= next.length; i++) {
    const run = next.slice(i, i + 3);
    const w = windFrom(run[0].dir);
    const lasting = run.every((h) => h.speed >= SHIFT_MIN && windFrom(h.dir).name === w.name && angleBetween(h.dir, now.dir) >= 40);
    if (w.name !== current && lasting) return { wind: w, at: run[0].time };
  }
  return null;
}

/**
 * "Maestrale teso, in rinforzo nel pomeriggio fino a 45 km/h."
 * @param turning A change of direction follows in its own sentence: steady wind is then only steady in strength.
 */
export function headline(now: HourPoint, hours: HourPoint[], today: string, unit: SpeedUnit, turning = false): string {
  const trend = windTrend(now, hours);
  const when = (t: string) => whenAhead(t, now.time, today);
  if (now.speed < CALM_BELOW) {
    const peak = trend.kind === 'rinforzo' ? hours.find((h) => h.time === trend.at) : undefined;
    return peak
      ? `Vento quasi assente, in aumento ${when(peak.time)}: ${ref(windFrom(peak.dir))} fino a ${speedLabel(peak.speed, unit)}.`
      : 'Vento quasi assente nelle prossime ore.';
  }
  const name = cap1(withStrength(windFrom(now.dir), now.speed));
  if (trend.kind === 'rinforzo') {
    const eases = trend.easesAt ? `, poi in calo ${when(trend.easesAt)}` : '';
    return `${name}, in rinforzo ${when(trend.at!)} fino a ${speedLabel(trend.speed, unit)}${eases}.`;
  }
  if (trend.kind === 'calo') return `${name}, in calo ${when(trend.at!)}.`;
  return turning ? `${name}, di intensità stabile.` : `${name}, senza grandi variazioni nelle prossime ore.`;
}

/**
 * What the gusts of the next hours mean for being outdoors.
 * @param coastal False when the place is known to be far from the sea: no beach talk then.
 */
export function gustSentence(now: HourPoint, hours: HourPoint[], today: string, unit: SpeedUnit, coastal = true): string {
  const span = [now, ...hours.slice(1, OUTLOOK_HOURS + 1)];
  const peak = span.reduce((a, b) => (b.gust > a.gust ? b : a));
  const maxMean = Math.max(...span.map((h) => h.speed));
  const when = peak === now ? 'adesso' : whenAhead(peak.time, now.time, today);
  const g = speedLabel(peak.gust, unit);
  if (peak.gust >= GUST_DANGER) {
    return `Raffiche fino a ${g} ${when}: pericolose per camper alti, tendalini e strutture leggere, meglio evitare ${coastal ? 'spiagge e sentieri esposti' : 'crinali, boschi e sentieri esposti'}.`;
  }
  if (peak.gust >= GUST_WARN) {
    return `Raffiche forti fino a ${g} ${when}: potrebbero rendere meno piacevole ${coastal ? 'la permanenza sulle spiagge esposte' : 'stare all’aperto'} e impegnativa la guida su strade aperte.`;
  }
  if (peak.gust >= 25 && peak.gust - peak.speed >= 12) {
    return `Vento a raffiche, fino a ${g} ${when}: ${coastal ? 'sulle spiagge esposte sabbia sollevata e ombrelloni da fissare bene' : 'fissa bene tendalino, ombrelloni e oggetti leggeri'}.`;
  }
  if (maxMean >= 20) return `Raffiche fino a ${g}: ${coastal ? 'sulle spiagge esposte' : 'nei posti aperti'} il vento si farà sentire.`;
  if (peak.gust < 20) return 'Raffiche deboli: nessun fastidio per stare all’aperto.';
  return `Raffiche fino a ${g}: niente di impegnativo per stare all’aperto.`;
}

/** Tomorrow against the rest of today, then the first day after that brings a real change. */
export function daysSentence(f: Forecast, unit: SpeedUnit): string | null {
  const today = f.current.time.slice(0, 10);
  const later = f.days.filter((d) => d.date > today);
  const tomorrow = later[0];
  if (!tomorrow) return null;
  const rest = f.ahead.filter((h) => h.time.startsWith(today));
  const todayMax = Math.max(f.current.speed, ...rest.map((h) => h.speed));
  const tw = windFrom(tomorrow.dominantDir);
  const top = speedLabel(tomorrow.maxSpeed, unit);
  const step = meaningful(Math.max(todayMax, tomorrow.maxSpeed));
  const sameName = f.current.speed >= LIGHT && windFrom(f.current.dir).name === tw.name;

  let s: string;
  if (tomorrow.maxSpeed < LIGHT) s = todayMax >= LIGHT ? `Domani vento in calo, debole tutto il giorno (massimo ${top})` : `Domani vento ancora debole, massimo ${top}`;
  else if (todayMax - tomorrow.maxSpeed >= step) s = `Domani è previsto un calo del vento: ${fromTag(tw)} fino a ${top}`;
  else if (tomorrow.maxSpeed - todayMax >= step) s = `Domani vento in rinforzo: ${strengthTag(tw, tomorrow.maxSpeed)} fino a ${top}`;
  else s = `Domani vento simile${sameName ? `, ${fromTag(tw)}` : `, ma ${mediterraneanNames() ? 'da ' : ''}${fromTag(tw)},`} fino a ${top}`;

  const change = later.slice(1).find((d) => {
    const named = d.maxSpeed >= LIGHT && tomorrow.maxSpeed >= LIGHT;
    if (d.maxSpeed < LIGHT && tomorrow.maxSpeed < LIGHT) return false; // light and lighter is no news
    return (
      Math.abs(d.maxSpeed - tomorrow.maxSpeed) >= meaningful(Math.max(d.maxSpeed, tomorrow.maxSpeed)) ||
      (named && windFrom(d.dominantDir).name !== tw.name)
    );
  });
  if (change) {
    const day = cap(dayWord(change.date, today));
    const cw = windFrom(change.dominantDir);
    const delta = change.maxSpeed - tomorrow.maxSpeed;
    const verb = Math.abs(delta) >= meaningful(Math.max(change.maxSpeed, tomorrow.maxSpeed)) ? (delta > 0 ? ' in rinforzo' : ' in calo') : '';
    s +=
      change.maxSpeed < LIGHT
        ? `. ${day} vento debole, fino a ${speedLabel(change.maxSpeed, unit)}`
        : `. ${day} ${ref(cw)}${verb}, fino a ${speedLabel(change.maxSpeed, unit)}`;
  }
  return `${s}.`;
}

/**
 * The short story of the wind, built from the forecast: what blows now and how it changes, what the
 * gusts mean, how the next days compare.
 * @param coastal False when the place is known to be far from the sea.
 */
export function windSummary(f: Forecast, unit: SpeedUnit, coastal = true): string[] {
  const today = f.current.time.slice(0, 10);
  const shift = windShift(f.current, f.ahead);
  const shiftWhen = shift && (hoursApart(f.current.time, shift.at) <= 2 ? 'A breve' : cap(whenLabel(shift.at, today)));
  return [
    headline(f.current, f.ahead, today, unit, !!shift),
    shift && `${shiftWhen} ${turnsTo(shift.wind)}.`,
    gustSentence(f.current, f.ahead, today, unit, coastal),
    daysSentence(f, unit),
  ].filter((s): s is string => !!s);
}
