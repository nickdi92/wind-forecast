import { GUST_DANGER, GUST_WARN } from './alerts';
import type { HourPoint } from './forecast';
import { OUTLOOK_HOURS } from './insight';
import { mLabel, seaState, type SeaPoint } from './marine';
import { speedLabel, windFrom, type SpeedUnit } from './wind';
import type { Zone } from './zone';

export type Level = 'ok' | 'attenzione' | 'pericolo';

export interface Tip {
  id: 'guida' | 'portiere' | 'sosta' | 'alberi' | 'spiaggia' | 'escursioni' | 'freddo' | 'foto';
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

const RANK: Record<Level, number> = { ok: 0, attenzione: 1, pericolo: 2 };
export const worse = (a: Level, b: Level): Level => (RANK[b] > RANK[a] ? b : a);

/**
 * Advice for life on the road, scaled to the wind of the next hours: the peak gust and the peak
 * mean wind, where the strongest gust comes from, and the sea when there is data for it.
 * @param hours Hourly forecast starting with the current hour.
 * @param zone Iceland gets its own advice: doors, sand, sneaker waves, road gust measurements.
 */
export function camperTips(now: HourPoint, hours: HourPoint[], unit: SpeedUnit, sea: SeaPoint | null = null, zone: Zone = 'mediterraneo'): Tip[] {
  const iceland = zone === 'islanda';
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
  tips.push(beach);

  tips.push(
    G >= GUST_DANGER
      ? { id: 'escursioni', title: 'Passeggiate e trekking', level: 'pericolo', short: 'evita crinali e boschi', text: 'Evita crinali, creste, falesie e boschi: raffiche capaci di sbilanciare e di spezzare rami.' }
      : G >= GUST_WARN
        ? { id: 'escursioni', title: 'Passeggiate e trekking', level: 'attenzione', short: 'evita crinali e scogliere', text: 'Su crinali, creste e falesie le raffiche sbilanciano: scegli percorsi bassi o di fondovalle e stai lontano dal bordo delle scogliere.' }
        : { id: 'escursioni', title: 'Passeggiate e trekking', level: 'ok', short: 'via libera', text: M >= 20 ? 'Vento che non ostacola le escursioni; in cresta si farà sentire.' : 'Vento che non ostacola le escursioni.' },
  );

  const felt = Math.min(...span.map((h) => h.feels ?? Infinity));
  if (felt <= 0) {
    tips.push({
      id: 'freddo',
      title: 'Freddo',
      level: felt <= -10 ? 'pericolo' : 'attenzione',
      short: `percepiti ${Math.round(felt)}°`,
      text: `Con il vento la temperatura percepita scende fino a ${Math.round(felt)}°: vestiti a strati con uno strato antivento, proteggi mani, orecchie e viso${felt <= -10 ? ' e limita il tempo all’aperto' : ''}.`,
    });
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
