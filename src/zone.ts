/**
 * Where the place is, as far as the app's knowledge goes: Sardinia and Iceland have their own coast
 * maps, the Mediterranean keeps the traditional wind names, everywhere else gets plain directions.
 */
export type Zone = 'sardegna' | 'mediterraneo' | 'islanda' | 'altrove';

/** Sardinia and its sea, up to the middle of the Bocche di Bonifacio. */
export function inSardinia(lat: number, lon: number): boolean {
  return lat >= 38.7 && lat <= 41.33 && lon >= 7.95 && lon <= 10.0;
}

/** Iceland and its coastal waters. */
export function inIceland(lat: number, lon: number): boolean {
  return lat >= 63.0 && lat <= 67.0 && lon >= -25.0 && lon <= -13.0;
}

/**
 * Lands and seas where the Mediterranean wind rose is the usual way to name winds: from Gibraltar
 * to the Levant and up to the Alps, without the Black Sea and the Atlantic coasts.
 */
export function inMediterranean(lat: number, lon: number): boolean {
  if (lat < 30 || lat > 47.3 || lon < -6 || lon > 36.5) return false;
  if (lat > 40.9 && lon > 27.5) return false; // Black Sea
  return true;
}

export function zoneOf(lat: number, lon: number): Zone {
  if (inSardinia(lat, lon)) return 'sardegna';
  if (inIceland(lat, lon)) return 'islanda';
  if (inMediterranean(lat, lon)) return 'mediterraneo';
  return 'altrove';
}

export const isMediterranean = (z: Zone): boolean => z === 'sardegna' || z === 'mediterraneo';

/** Who to listen to for warnings, as HTML. */
export function officialSources(z: Zone): string {
  if (z === 'islanda') {
    return 'gli avvisi di <a href="https://www.vedur.is/" rel="noopener" target="_blank">vedur.is</a>, le raffiche misurate lungo le strade e le chiusure su <a href="https://umferdin.is/" rel="noopener" target="_blank">umferdin.is</a> e <a href="https://safetravel.is/" rel="noopener" target="_blank">safetravel.is</a>';
  }
  if (isMediterranean(z)) return 'i bollettini ufficiali del paese in cui ti trovi (in Italia Protezione Civile e Aeronautica Militare)';
  return 'i bollettini del servizio meteo nazionale';
}

/**
 * What each direction usually brings to Iceland: windward coasts get the weather, the lee of the
 * mountains is drier. Climate, not forecast.
 */
export function icelandAbout(cardinal: string): string {
  switch (cardinal) {
    case 'NO':
    case 'N':
    case 'NE':
      return 'Aria fredda dall’Artico: di solito neve o pioggia gelata sulla costa nord e nei fiordi esposti, tempo più asciutto e limpido a sud, sottovento alle montagne.';
    case 'E':
      return 'Spesso legato alle depressioni atlantiche che passano a sud dell’isola: può essere forte sulla costa sud e sui fiordi orientali.';
    case 'SE':
    case 'S':
    case 'SO':
      return 'Aria più mite e umida dall’Atlantico: di solito nuvole e pioggia sulla costa sud e ovest, tempo più asciutto e a volte più caldo a nord e a est, sottovento alle montagne.';
    default:
      return 'Aria atlantica umida: di solito pioggia sulla costa ovest e sui fiordi occidentali, più asciutto a est.';
  }
}
