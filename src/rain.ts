import { LULL_HOURS } from './alerts';
import type { HourPoint } from './forecast';
import { hourLabel, nextHourLabel } from './format';
import { CALM_BELOW, directionSpread, normalizeDeg, WINDS, windFrom } from './wind';

/** Less than this in an hour is a few drops: the app calls it dry. */
export const RAIN_MIN = 0.1; // mm
/** From this chance on, rain is worth a mention even when the model expects none. */
export const RAIN_POSSIBLE = 30; // %

interface Rain {
  rain: number;
  rainChance: number;
}

/** "0,4", "3", "12": one decimal is enough below 10 mm, none above. */
export const mmLabel = (v: number): string => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ','));

function intensity(mmPerHour: number): string {
  if (mmPerHour >= 7.6) return 'forte';
  if (mmPerHour >= 2.5) return 'moderata';
  return 'debole';
}

/** For one hour, as the big reading shows it. */
export function rainLabel(p: Rain): string {
  if (p.rain >= RAIN_MIN) return `Pioggia ${intensity(p.rain)}, ${mmLabel(p.rain)} mm`;
  if (p.rainChance >= RAIN_POSSIBLE) return `Pioggia possibile, ${Math.round(p.rainChance)}%`;
  return 'Niente pioggia';
}

/** Amount when rain is expected, chance when it is only possible, nothing when dry. */
export function rainShort(p: Rain): string | null {
  if (p.rain >= RAIN_MIN) return `${mmLabel(p.rain)} mm`;
  if (p.rainChance >= RAIN_POSSIBLE) return `${Math.round(p.rainChance)}%`;
  return null;
}

export interface RainSpell {
  /** First and last rainy hour. */
  start: string;
  end: string;
  /** Rain is expected, not only possible. */
  wet: boolean;
  ongoing: boolean;
  /** Where the wind comes from while it rains, drawn as an arc on the rose; null when it rains without wind. */
  spread: { mean: number; half: number } | null;
}

/** Hours with at least this share of the spell's heaviest hour decide the arc. */
const MAIN_SHARE = 0.25;

/**
 * The first spell of expected rain or, when none is expected, of possible rain. Rain the model
 * expects at a low chance is a blip the ensemble does not believe: it would hide the real spell.
 */
export function rainSpell(hours: HourPoint[]): RainSpell | null {
  const expected = (h: HourPoint) => h.rain >= RAIN_MIN && h.rainChance >= RAIN_POSSIBLE;
  const wet = hours.some(expected);
  const rainy = (h: HourPoint) => (wet ? expected(h) : h.rainChance >= RAIN_POSSIBLE);
  const first = hours.findIndex(rainy);
  if (first < 0) return null;
  let last = first;
  for (let i = first + 1; i < hours.length && i - last <= LULL_HOURS + 1; i++) {
    if (rainy(hours[i])) last = i;
  }
  const windy = hours.slice(first, last + 1).filter((h) => rainy(h) && h.speed >= CALM_BELOW);
  // The heaviest hours set the arc, so a drizzle with the wind elsewhere does not swing it round.
  const peak = Math.max(...windy.map((h) => h.rain));
  const main = wet ? windy.filter((h) => h.rain >= peak * MAIN_SHARE) : windy;
  return {
    start: hours[first].time,
    end: hours[last].time,
    wet,
    ongoing: first === 0,
    spread: main.length ? directionSpread(main.map((h) => h.dir)) : null,
  };
}

/** Named winds inside the arc, clockwise; past three the wind is just variable. */
function arcWinds({ mean, half }: { mean: number; half: number }): string[] {
  const from = mean - half;
  const inside = WINDS.filter((w) => Math.abs(((normalizeDeg(w.deg - mean) + 180) % 360) - 180) <= half + 0.5)
    .sort((a, b) => normalizeDeg(a.deg - from) - normalizeDeg(b.deg - from))
    .map((w) => w.name);
  return inside.length ? inside : [windFrom(mean).name];
}

const joinIt = (items: string[]): string => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`);

export function rainSpellCopy(s: RainSpell): string {
  const what = s.wet ? 'Pioggia' : 'Possibile pioggia';
  const when = s.ongoing ? `fino alle ${nextHourLabel(s.end)}` : `dalle ${hourLabel(s.start)} alle ${nextHourLabel(s.end)}`;
  if (!s.spread) return `${what} senza vento ${when}`;
  const winds = arcWinds(s.spread);
  if (winds.length > 3) return `${what} con vento variabile ${when}`;
  const advice = s.wet ? `: chiudi gli oblò sul lato ${windFrom(s.spread.mean).direction}` : '';
  return `${what} da ${joinIt(winds)} ${when}${advice}`;
}
