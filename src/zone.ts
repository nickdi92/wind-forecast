/**
 * Where the place is, as far as the app's knowledge goes: Sardinia and Iceland have their own coast
 * maps, the Mediterranean keeps the traditional wind names, Norway, Sweden and Finland get their
 * own services and notes, everywhere else gets plain directions.
 */
export type Zone = 'sardegna' | 'mediterraneo' | 'islanda' | 'nordici' | 'altrove';

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

/** Eastern edge of Finland and Norway against Russia, south to north: [lat, lon]. */
const RUSSIAN_BORDER: readonly (readonly [number, number])[] = [
  [59.7, 27.0],
  [60.6, 27.9],
  [61.2, 29.0],
  [62.0, 30.3],
  [62.9, 31.6],
  [64.0, 30.2],
  [66.0, 29.6],
  [67.0, 29.6],
  [68.0, 29.0],
  [68.5, 28.6],
  [69.05, 29.0],
  [69.4, 30.1],
  [69.8, 30.9],
  [70.0, 31.6],
];

function russianBorderLon(lat: number): number {
  const b = RUSSIAN_BORDER;
  if (lat <= b[0][0]) return b[0][1];
  for (let i = 1; i < b.length; i++) {
    const [la, lo] = b[i];
    if (lat <= la) {
      const [pla, plo] = b[i - 1];
      return plo + ((lat - pla) / (la - pla)) * (lo - plo);
    }
  }
  return b.at(-1)![1];
}

/**
 * Norway, Sweden and Finland, without Denmark, the Baltic states and Russia. Coarse borders: a few
 * km either way only change which services the app points to.
 */
export function inNordics(lat: number, lon: number): boolean {
  if (lat < 55.3 || lat > 71.3 || lon < 4.5 || lon > 31.6) return false;
  if (lat < 56.2 && lon < 12.65) return false; // Denmark, across the Øresund
  if (lat < 57.8 && lon < 11.7) return false; // Jutland and the Kattegat
  if (lat < 59.7 && lon > 20) return false; // Estonia, Latvia, Lithuania
  return lon <= russianBorderLon(lat);
}

export function zoneOf(lat: number, lon: number): Zone {
  if (inSardinia(lat, lon)) return 'sardegna';
  if (inIceland(lat, lon)) return 'islanda';
  if (inMediterranean(lat, lon)) return 'mediterraneo';
  if (inNordics(lat, lon)) return 'nordici';
  return 'altrove';
}

export const isMediterranean = (z: Zone): boolean => z === 'sardegna' || z === 'mediterraneo';

const link = (href: string, text: string): string => `<a href="${href}" rel="noopener" target="_blank">${text}</a>`;

/** Who to listen to for warnings, as HTML. */
export function officialSources(z: Zone): string {
  if (z === 'islanda') {
    return 'gli avvisi di <a href="https://www.vedur.is/" rel="noopener" target="_blank">vedur.is</a>, le raffiche misurate lungo le strade e le chiusure su <a href="https://umferdin.is/" rel="noopener" target="_blank">umferdin.is</a> e <a href="https://safetravel.is/" rel="noopener" target="_blank">safetravel.is</a>';
  }
  if (z === 'nordici') {
    return `gli avvisi e lo stato delle strade del paese in cui ti trovi: in Svezia ${link('https://www.smhi.se/', 'smhi.se')} e ${link('https://www.trafikverket.se/trafikinformation/', 'trafikverket.se')}, in Norvegia ${link('https://www.yr.no/en', 'yr.no')} e ${link('https://www.vegvesen.no/trafikk/', 'vegvesen.no/trafikk')}, in Finlandia ${link('https://en.ilmatieteenlaitos.fi/warnings', 'ilmatieteenlaitos.fi')} e ${link('https://liikennetilanne.fintraffic.fi/', 'fintraffic.fi')}`;
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

/**
 * What each direction usually brings to Norway, Sweden and Finland: the Scandinavian mountains
 * split the wet Atlantic side from the drier, colder lee. Climate, not forecast.
 */
export function nordicAbout(cardinal: string): string {
  switch (cardinal) {
    case 'N':
    case 'NE':
      return 'Aria fredda dall’Artico: rovesci di neve sulle coste esposte a nord, in Finnmark e verso Capo Nord, tempo più asciutto e limpido nell’interno. D’inverno porta il freddo più intenso.';
    case 'E':
      return 'Aria continentale da est: d’inverno secca e molto fredda in Finlandia e Svezia, spesso con cielo sereno; d’estate calda e asciutta. Sulla costa norvegese arriva da terra.';
    case 'SE':
    case 'S':
      return 'Aria più mite da sud: scendendo dalle montagne verso la costa norvegese diventa secca e più calda, con raffiche forti allo sbocco di valli e fiordi. D’inverno può portare disgelo, poi ghiaccio sulle strade quando torna il freddo.';
    case 'NO':
      return 'Aria fredda e instabile dal mare: rovesci, d’inverno di neve, sulla costa norvegese e sulle montagne; più asciutto oltre lo spartiacque, in Svezia e Finlandia.';
    default:
      return 'Aria atlantica umida e mite: le perturbazioni portano pioggia abbondante e vento forte sulla costa norvegese, neve in montagna; oltre le montagne, in Svezia e Finlandia, più asciutto. D’inverno il disgelo che portano lascia spesso ghiaccio sulle strade.';
  }
}

/** Local effects on Nordic coasts and roads worth a line in the coast panel. */
export function nordicCoastNotes(): string[] {
  return [
    'Nei fiordi norvegesi il vento si incanala lungo il fiordo: può arrivare da una direzione diversa e soffiare più forte di quanto previsto per la zona, con raffiche improvvise dove scende dalle montagne.',
    'Sulle coste aperte e sugli altipiani del Finnmark, verso Capo Nord, il vento non trova ostacoli: con la neve la solleva e toglie la visibilità, e alcune strade, come la E69 per Capo Nord, si percorrono in convoglio (kolonnekjøring) o vengono chiuse. Lo stato aggiornato è su vegvesen.no/trafikk.',
    'Con vento forte i traghetti possono essere sospesi e alcuni ponti alti chiusi a camper e rimorchi: controlla prima di partire.',
  ];
}
