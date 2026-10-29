import { GUST_DANGER, GUST_WARN } from './alerts';
import type { HourPoint, Sun } from './forecast';
import { hourLabel, nextHourLabel } from './format';
import { OUTLOOK_HOURS } from './insight';
import { mLabel, seaState, type SeaPoint } from './marine';
import { mmLabel, precipKind, RAIN_MIN } from './rain';
import { durationLabel, polarNight } from './sun';
import { speedLabel, windFrom, type SpeedUnit } from './wind';
import type { Zone } from './zone';

export type Level = 'ok' | 'attenzione' | 'pericolo';

export interface Tip {
  id: 'guida' | 'strada' | 'portiere' | 'sosta' | 'alberi' | 'spiaggia' | 'escursioni' | 'freddo' | 'luce' | 'aurora' | 'foto';
  title: string;
  level: Level;
  /** A few words for the summary. */
  short: string;
  text: string;
}

/** Gusts that can push a tall camper out of its lane on open roads. */
const GUST_ROLL = 80; // km/h
/** From here gusts move big branches and throw chairs and sheets around. */
const GUST_BRANCHES = 45; // km/h
/** Wind many light drones are rated for (about 10.7 m/s). */
const DRONE_MAX = 38; // km/h
/** Air at 2 m this cold or colder: the road, colder still on clear nights and bridges, can ice up. */
const ICE_AIR = 2; // °C
/** Fresh snow in 12 hours that makes roads properly wintry. */
const SNOW_HEAVY = 5; // cm
/** Days shorter than this make the hours of light worth planning around. */
const SHORT_LIGHT = 8 * 3600; // s
/** Night sky at most this cloudy counts as clear for the northern lights. */
const CLEAR_SKY = 30; // %

const RANK: Record<Level, number> = { ok: 0, attenzione: 1, pericolo: 2 };
export const worse = (a: Level, b: Level): Level => (RANK[b] > RANK[a] ? b : a);

/**
 * Snow, ice and freezing rain on the road in the next hours, from the air temperature and what
 * falls. Null when it stays clearly above freezing.
 */
export function roadTip(span: HourPoint[], nordic = false): Tip | null {
  const temps = span.flatMap((h) => (h.temp == null ? [] : [h.temp]));
  if (!temps.length) return null;
  const low = Math.min(...temps);
  const snow = span.reduce((sum, h) => sum + (h.snow ?? 0), 0);
  const wet = (h: HourPoint) => h.rain >= RAIN_MIN && precipKind(h) !== 'neve';
  // Rain that hits a road at or below freezing turns to ice on contact.
  const glaze = span.find((h) => wet(h) && h.temp != null && h.temp <= 0);
  const nearGlaze = span.find((h) => wet(h) && h.temp != null && h.temp <= 1.5);
  // Roads wet from rain that later drop below freezing.
  const firstWet = span.findIndex((h) => wet(h) && (h.temp ?? 0) > 0);
  const refreeze = firstWet >= 0 ? span.slice(firstWet + 1).find((h) => h.temp != null && h.temp <= 0) : undefined;
  if (low > ICE_AIR && snow < 0.5 && !nearGlaze) return null;

  const parts: string[] = [];
  let level: Level = 'attenzione';
  let short: string;
  if (glaze) {
    level = 'pericolo';
    short = 'pioggia che gela';
    parts.push(`Pioggia con temperature sotto zero dalle ${hourLabel(glaze.time)}: sull’asfalto gela subito e le strade diventano lastre di ghiaccio. Se puoi non metterti in viaggio.`);
  } else if (snow >= SNOW_HEAVY) {
    level = 'pericolo';
    short = `fino a ${mmLabel(snow)} cm di neve`;
    parts.push(`Fino a ${mmLabel(snow)} cm di neve nelle prossime 12 ore: strade innevate, spazzaneve in ritardo sulle strade secondarie. Gomme invernali o catene, velocità bassa e distanze lunghe.`);
  } else if (snow >= 0.5) {
    short = `neve, ${mmLabel(snow)} cm`;
    parts.push(`Neve in arrivo, circa ${mmLabel(snow)} cm nelle prossime 12 ore: fondo scivoloso, soprattutto all’inizio della nevicata.`);
  } else if (nearGlaze) {
    short = 'pioggia vicino a zero';
    parts.push(`Pioggia con temperature appena sopra lo zero dalle ${hourLabel(nearGlaze.time)}: su ponti e tratti all’ombra può gelare.`);
  } else if (refreeze) {
    short = 'strade bagnate che gelano';
    parts.push(`Dopo la pioggia la temperatura scende sotto zero verso le ${hourLabel(refreeze.time)}: l’asfalto bagnato gela e il ghiaccio non si vede.`);
  } else {
    short = 'possibile ghiaccio';
    parts.push(`Temperatura minima ${Math.round(low)}°: possibile ghiaccio sottile e invisibile su ponti, viadotti, curve all’ombra, di notte e al mattino presto${low > 0 ? ', anche con l’aria sopra lo zero' : ''}.`);
  }
  // Snow and near-freezing rain say nothing yet about ice once it gets colder.
  if (!glaze && (snow >= 0.5 || nearGlaze) && low <= 0) parts.push(`Minima ${Math.round(low)}°: attenzione al ghiaccio su ponti e tratti all’ombra.`);
  parts.push('Frena e sterza con dolcezza, usa il freno motore e triplica le distanze.');
  if (nordic) {
    parts.push('Con fondo invernale le gomme invernali sono obbligatorie in Svezia, Norvegia e Finlandia. Stato delle strade su trafikverket.se, vegvesen.no/trafikk e fintraffic.fi.');
  }
  return { id: 'strada', title: 'Strada, neve e ghiaccio', level, short, text: parts.join(' ') };
}

/**
 * Whether tonight's sky is clear enough to look for the northern lights: the first stretch of dark
 * hours in the next 18, by cloud cover. Null without sky data or without a night (midnight sun).
 */
export function auroraTip(hours: HourPoint[]): Tip | null {
  const ahead = hours.slice(0, 18);
  const start = ahead.findIndex((h) => h.isDay === false && h.cloud != null);
  if (start < 0) return null;
  let end = start;
  while (end + 1 < ahead.length && ahead[end + 1].isDay === false && ahead[end + 1].cloud != null) end++;
  const night = ahead.slice(start, end + 1);
  const clear = night.filter((h) => h.cloud! <= CLEAR_SKY);
  // In the afternoon the dark hours are this evening's as much as tonight's.
  const hour = Number(night[0].time.slice(11, 13));
  const when = hour >= 12 && hour < 18 ? 'Da stasera' : 'Stanotte';
  const check = 'Serve anche attività solare: la previsione dell’aurora è su spaceweather.gov, l’indice Kp dice quanto a sud può arrivare. Allontanati dalle luci; più sei a sud, più va cercata bassa verso nord.';
  if (clear.length >= Math.max(2, night.length / 2)) {
    return {
      id: 'aurora',
      title: 'Aurora boreale',
      level: 'ok',
      short: 'cielo sereno stanotte',
      text: `${when} cielo in gran parte sereno, tra le ${hourLabel(clear[0].time)} e le ${nextHourLabel(clear.at(-1)!.time)}: buone condizioni per vedere l’aurora, se c’è. ${check}`,
    };
  }
  if (clear.length) {
    return {
      id: 'aurora',
      title: 'Aurora boreale',
      level: 'ok',
      short: 'qualche schiarita stanotte',
      text: `${when} nuvoloso con qualche schiarita, la prima verso le ${hourLabel(clear[0].time)}: cerca il cielo libero, magari spostandoti di qualche km. ${check}`,
    };
  }
  return {
    id: 'aurora',
    title: 'Aurora boreale',
    level: 'ok',
    short: 'cielo coperto stanotte',
    text: `${when} cielo coperto: l’aurora sarà difficile da vedere anche se c’è.`,
  };
}

/** Hours of light in the far north, where they drive the day more than the wind. */
function lightTip(sun: Sun): Tip | null {
  if (polarNight(sun)) {
    return {
      id: 'luce',
      title: 'Luce',
      level: 'attenzione',
      short: 'notte polare',
      text: 'Notte polare: il sole non sorge e resta solo qualche ora di crepuscolo a metà giornata. Sfruttala per i tratti più lunghi; al buio renne e alci sulla strada si vedono all’ultimo.',
    };
  }
  if (sun.daylight >= SHORT_LIGHT) return null;
  return {
    id: 'luce',
    title: 'Luce',
    level: 'ok',
    short: `${durationLabel(sun.daylight)} di luce`,
    text: `Solo ${durationLabel(sun.daylight)} di luce, dalle ${sun.rise.slice(11, 16)} alle ${sun.set.slice(11, 16)}: programma la guida di giorno. All’alba, al tramonto e al buio renne e alci attraversano spesso la strada.`,
  };
}

/**
 * Advice for life on the road, scaled to the wind of the next hours: the peak gust and the peak
 * mean wind, where the strongest gust comes from, and the sea when there is data for it.
 * @param hours Hourly forecast starting with the current hour.
 * @param zone Iceland gets its own advice: doors, sand, sneaker waves, road gust measurements.
 * Norway, Sweden and Finland get convoys and closures, winter tyres, hours of light and the aurora.
 * @param sun Today's sunrise and sunset, when the forecast has them.
 */
export function camperTips(
  now: HourPoint,
  hours: HourPoint[],
  unit: SpeedUnit,
  sea: SeaPoint | null = null,
  zone: Zone = 'mediterraneo',
  sun: Sun | null = null,
): Tip[] {
  const iceland = zone === 'islanda';
  const nordic = zone === 'nordici';
  const span = [now, ...hours.slice(1, OUTLOOK_HOURS + 1)];
  const top = span.reduce((a, b) => (b.gust > a.gust ? b : a));
  const G = top.gust;
  const M = Math.max(...span.map((h) => h.speed));
  const g = speedLabel(G, unit);
  const from = windFrom(top.dir).direction;
  const tips: Tip[] = [];

  tips.push(
    G >= GUST_ROLL
      ? { id: 'guida', title: 'Guida', level: 'pericolo', short: 'meglio non viaggiare', text: `Raffiche fino a ${g}: un camper alto può essere spostato di corsia, su viadotti e strade aperte anche ribaltato. Se puoi rimanda gli spostamenti.` }
      : G >= GUST_DANGER
        ? { id: 'guida', title: 'Guida', level: 'pericolo', short: 'raffiche laterali pericolose', text: `Raffiche fino a ${g}: un camper alto può essere spostato di corsia. Evita viadotti, ponti e strade di crinale, riduci molto la velocità e tieni distanza dai mezzi pesanti.` }
        : G >= GUST_WARN
          ? { id: 'guida', title: 'Guida', level: 'attenzione', short: 'attenzione alle raffiche laterali', text: `Raffiche laterali fino a ${g}: rallenta su viadotti, ponti, crinali e all’uscita delle gallerie, tieni il volante con due mani e attenzione quando superi o vieni superato da mezzi pesanti.` }
          : { id: 'guida', title: 'Guida', level: 'ok', short: 'nessun problema', text: `Raffiche fino a ${g}: nessun problema di vento laterale per la guida.` },
  );

  if (iceland) {
    const guida = tips[0];
    tips[0] = {
      ...guida,
      text: `${guida.text} Ai piedi delle montagne e sui passi le raffiche reali possono superare di molto quelle previste: prima di partire controlla le raffiche misurate lungo il percorso e le strade chiuse su umferdin.is.${
        G >= 50 ? ' Con vento così forte sulle pianure di sabbia della costa sud sabbia e ghiaia possono rovinare vernice e vetri.' : ''
      }`,
    };
    if (G >= 30) {
      tips.push({
        id: 'portiere',
        title: 'Portiere',
        level: G >= 50 ? 'pericolo' : 'attenzione',
        short: 'tieni forte le portiere',
        text: 'Apri le portiere tenendole con due mani, meglio dopo aver parcheggiato con il muso controvento: il vento le spalanca e le piega, ed è un danno che le assicurazioni del noleggio spesso non coprono.',
      });
    }
  }

  if (nordic && G >= GUST_WARN) {
    const guida = tips[0];
    tips[0] = {
      ...guida,
      text: `${guida.text} Con vento forte alcuni ponti alti chiudono a camper e rimorchi e i traghetti possono saltare; sugli altipiani del Finnmark e sulla E69 per Capo Nord, con vento e neve, si viaggia in convoglio (kolonnekjøring) o la strada chiude: controlla vegvesen.no/trafikk prima di partire.`,
    };
  }

  const road = roadTip(span, nordic);
  if (road) tips.push(road);

  tips.push(
    G >= GUST_DANGER
      ? { id: 'sosta', title: 'Sosta e piazzola', level: 'pericolo', short: 'al riparo, tendalino chiuso', text: `Tendalino chiuso e bloccato. Niente sosta su promontori, crinali o lungomare aperti: cerca il riparo di un edificio, un muro o un terrapieno sul lato ${from}, lontano dagli alberi, e parcheggia con il muso verso ${from} per ridurre il rollio.` }
      : G >= GUST_WARN
        ? { id: 'sosta', title: 'Sosta e piazzola', level: 'attenzione', short: 'chiudi il tendalino', text: `Chiudi il tendalino. Le piazzole esposte saranno ventose: meglio il riparo di un edificio, un muro o una siepe sul lato ${from}, con il muso verso ${from}.` }
        : G >= 30
          ? { id: 'sosta', title: 'Sosta e piazzola', level: 'attenzione', short: 'tendalino ben fissato', text: 'Tendalino aperto solo se basso e ben picchettato, da ritirare quando ti allontani.' }
          : { id: 'sosta', title: 'Sosta e piazzola', level: 'ok', short: 'sosta tranquilla', text: 'Tendalino e tavolino fuori senza problemi; picchetta comunque il tendalino.' },
  );

  tips.push(
    G >= GUST_DANGER
      ? { id: 'alberi', title: 'Alberi e oggetti', level: 'pericolo', short: 'non sostare sotto gli alberi', text: `Con raffiche fino a ${g} si possono spezzare rami: non sostare e non parcheggiare sotto alberi o pini, ritira sedie, tavolino, teli e tutto quello che può volare.` }
      : G >= GUST_BRANCHES
        ? { id: 'alberi', title: 'Alberi e oggetti', level: 'attenzione', short: 'fissa gli oggetti leggeri', text: 'Le raffiche muovono i rami grossi e fanno volare sedie e teli: evita la sosta sotto alberi secchi o pini isolati, lega o ritira gli oggetti leggeri.' }
        : { id: 'alberi', title: 'Alberi e oggetti', level: 'ok', short: 'nessun rischio particolare', text: 'Nessun rischio particolare: tieni d’occhio solo teli e oggetti leggeri.' },
  );

  let beach: Tip =
    G >= 50 || M >= 39
      ? { id: 'spiaggia', title: 'Spiaggia', level: 'pericolo', short: 'spiagge esposte sconsigliate', text: 'Spiagge esposte sconsigliate: sabbia e ombrelloni in volo. Per il mare cerca una spiaggia ridossata, vedi Coste esposte e ripari.' }
      : G >= 35 || M >= 20
        ? { id: 'spiaggia', title: 'Spiaggia', level: 'attenzione', short: 'meglio spiagge riparate', text: 'Sulle spiagge esposte sabbia sollevata e ombrelloni a rischio: meglio una spiaggia ridossata, con l’ombrellone ben piantato.' }
        : M >= 12
          ? { id: 'spiaggia', title: 'Spiaggia', level: 'ok', short: 'brezza piacevole', text: 'Brezza piacevole: pianta bene l’ombrellone.' }
          : { id: 'spiaggia', title: 'Spiaggia', level: 'ok', short: 'vento debole', text: 'Vento debole: spiaggia tranquilla.' };
  if (sea) {
    const s = seaState(sea.height);
    if (s.degree >= 4) beach = { ...beach, level: 'pericolo', short: `mare ${s.label}`, text: `${beach.text} Mare ${s.label}: bagno sconsigliato sulle spiagge esposte, attenzione alle correnti di ritorno.` };
    else if (s.degree === 3) beach = { ...beach, level: worse(beach.level, 'attenzione'), text: `${beach.text} Mare mosso: bagno con prudenza, dove si tocca e meglio con bagnino.` };
  }
  // Umbrellas make no sense on a cold Nordic beach: say nothing unless it is summer.
  const warmest = Math.max(...span.map((h) => h.temp ?? -Infinity));
  const skipBeach = nordic && warmest < 15;
  if (iceland) {
    // No umbrellas up here: the danger at the beach is the sea itself.
    beach = {
      ...beach,
      level: worse(beach.level, 'attenzione'),
      short: beach.level === 'pericolo' ? beach.short : 'attenzione alle onde',
      text: `Sulle spiagge della costa sud, come Reynisfjara, arrivano onde improvvise molto più lunghe delle altre anche con mare in apparenza calmo: resta lontano dalla battigia e non dare mai le spalle al mare.${
        G >= 35 || M >= 20 ? ' Con questo vento sabbia nera sollevata sulle spiagge aperte.' : ''
      }${sea && seaState(sea.height).degree >= 3 ? ` Mare ${seaState(sea.height).label}, onde di ${mLabel(sea.height)}.` : ''}`,
    };
  } else if (M >= 15) beach = { ...beach, text: `${beach.text} Con vento da terra niente gonfiabili, materassini e SUP: il vento li porta al largo.` };
  if (!skipBeach) tips.push(beach);

  tips.push(
    G >= GUST_DANGER
      ? { id: 'escursioni', title: 'Passeggiate e trekking', level: 'pericolo', short: 'evita crinali e boschi', text: 'Evita crinali, creste, falesie e boschi: raffiche capaci di sbilanciare e di spezzare rami.' }
      : G >= GUST_WARN
        ? { id: 'escursioni', title: 'Passeggiate e trekking', level: 'attenzione', short: 'evita crinali e scogliere', text: 'Su crinali, creste e falesie le raffiche sbilanciano: scegli percorsi bassi o di fondovalle e stai lontano dal bordo delle scogliere.' }
        : { id: 'escursioni', title: 'Passeggiate e trekking', level: 'ok', short: 'via libera', text: M >= 20 ? 'Vento che non ostacola le escursioni; in cresta si farà sentire.' : 'Vento che non ostacola le escursioni.' },
  );

  const felt = Math.min(...span.map((h) => h.feels ?? Infinity));
  const low = Math.min(...span.map((h) => h.temp ?? Infinity));
  if (felt <= 0 || low <= 0) {
    const cold: string[] = [];
    if (felt <= 0) {
      cold.push(`Con il vento la temperatura percepita scende fino a ${Math.round(felt)}°: vestiti a strati con uno strato antivento, proteggi mani, orecchie e viso${felt <= -10 ? ' e limita il tempo all’aperto' : ''}.`);
    }
    if (low <= 0) {
      // Butane stops vaporising just below 0 °C; propane works down to about -40 °C.
      cold.push(`Nel van, con minime di ${Math.round(low)}°: sotto zero il butano non funziona più, per stufa e fornello serve propano. Proteggi dal gelo serbatoi e tubi dell’acqua, o svuotali, e arieggia un po’ per la condensa.`);
    }
    tips.push({
      id: 'freddo',
      title: 'Freddo',
      level: felt <= -10 || low <= -15 ? 'pericolo' : 'attenzione',
      short: felt <= 0 ? `percepiti ${Math.round(felt)}°` : `minime ${Math.round(low)}°`,
      text: cold.join(' '),
    });
  }

  if ((nordic || iceland) && sun) {
    const light = lightTip(sun);
    if (light) tips.push(light);
  }
  if (nordic || iceland) {
    const aurora = auroraTip(hours);
    if (aurora) tips.push(aurora);
  }

  const photo: string[] = [];
  photo.push(
    G >= DRONE_MAX
      ? `Drone sconsigliato: raffiche oltre i ${speedLabel(DRONE_MAX, unit)} circa che reggono molti droni leggeri.`
      : G >= 25
        ? 'Drone solo se il modello regge questo vento: decolla e parti controvento, così il ritorno è a favore.'
        : 'Condizioni buone anche per il drone.',
  );
  if (M >= 20) photo.push('Treppiede basso e zavorrato; per il video un antivento sul microfono.');
  else if (M >= 12) photo.push('Per il video usa un antivento sul microfono.');
  if (sea && M >= 30) photo.push('Vicino al mare la salsedine si deposita sulle lenti: tieni a portata un panno.');
  const clear = windFrom(now.dir).name;
  if ((clear === 'Maestrale' || clear === 'Tramontana') && now.speed >= 12) photo.push(`Con ${clear === 'Maestrale' ? 'il Maestrale' : 'la Tramontana'} l’aria è spesso tersa: buona visibilità per i paesaggi lontani.`);
  tips.push({
    id: 'foto',
    title: 'Foto e video',
    level: G >= DRONE_MAX ? 'attenzione' : 'ok',
    short: G >= DRONE_MAX ? 'drone sconsigliato' : G >= 25 ? 'drone con cautela' : 'buone condizioni',
    text: photo.join(' '),
  });

  return tips;
}
