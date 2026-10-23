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
