import type { Place } from './api';
import { camperTips, worse, type Level, type Tip } from './camper';
import {
  EXPOSURE_COPY,
  EXPOSURE_MIN,
  genericExposure,
  nearestSegment,
  regionAt,
  regionExposure,
  sardiniaExposure,
  segmentNames,
} from './coast';
import { coastMap, exposureDial } from './coastmap';
import type { Forecast, HourPoint } from './forecast';
import { cap, dayLabel, hourLabel, whenLabel } from './format';
import { windSummary } from './insight';
import { isMaestrale, maestraleOutlook, maestralePersistence, maestraleStatus, maestraleTrend, windowCopy, windowLabel } from './maestrale';
import {
  mLabel,
  seaDaysCopy,
  seaHeadline,
  seaOriginCopy,
  seaState,
  seaTrend,
  seaTrendCopy,
  type Sea,
} from './marine';
import { escapeHtml, needleIcon, reducedMotion } from './ui';
import {
  beaufort,
  beaufortEffects,
  beaufortLabel,
  beaufortRange,
  CALM_BELOW,
  mediterraneanNames,
  speedLabel,
  WINDS,
  windFrom,
  windRose,
  windTowards,
  type SpeedUnit,
  type Wind,
} from './wind';
import { icelandAbout, isMediterranean, nordicAbout, nordicCoastNotes, officialSources, type Zone } from './zone';

/** Where the sea data stands: loaded, none for this place, still loading, or the request failed. */
export type SeaStatus = 'ok' | 'none' | 'loading' | 'failed';

export interface PanelsInput {
  forecast: Forecast;
  sea: Sea | null;
  seaStatus: SeaStatus;
  place: Place;
  zone: Zone;
  unit: SpeedUnit;
}

type PanelId = 'coste' | 'mare' | 'maestrale' | 'camper' | 'beaufort' | 'rosa';

const LEVEL_CLASS: Record<Level, string> = { ok: '', attenzione: 'warn', pericolo: 'danger' };
const MAESTRALE = WINDS.findIndex((w) => w.name === 'Maestrale');

/** The wind of an hour in a line: "<strong>Maestrale</strong> da nord-ovest" or "vento da <strong>nord-ovest</strong>". */
const windLine = (w: Wind): string => (mediterraneanNames() ? `<strong>${w.name}</strong> da ${w.direction}` : `vento da <strong>${w.direction}</strong>`);

const todaySun = (f: Forecast) => f.days.find((d) => d.date === f.current.time.slice(0, 10))?.sun ?? null;

/** Hour as the reading says it: "Adesso" or "Alle 15". */
const whenShown = (p: HourPoint, isNow: boolean): string => (isNow ? 'Adesso' : `Alle ${hourLabel(p.time)}`);

/**
 * "In breve" summary and the deep-dive panels under the forecast. The panels stay in the page and
 * only their content changes, so an open panel stays open across refreshes.
 */
export class Panels {
  private input: PanelsInput | null = null;
  private point: HourPoint | null = null;
  private isNow = true;
  /** Wind chosen in the guide; null follows the wind shown. */
  private picked: number | null = null;

  constructor(
    private readonly summary: HTMLElement,
    private readonly facts: HTMLElement,
    private readonly more: HTMLElement,
    private readonly onPickWind: (index: number | null) => void,
  ) {
    facts.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLElement>('[data-open]');
      if (btn) this.openPanel(btn.dataset.open!);
    });
    more.addEventListener('click', (e) => {
      const target = e.target as Element;
      const wind = target.closest<HTMLElement>('[data-wind]');
      if (wind) {
        this.pickWind(Number(wind.dataset.wind));
        return;
      }
      const link = target.closest<HTMLElement>('[data-open]');
      if (link) this.openPanel(link.dataset.open!);
    });
  }

  private openPanel(id: string): void {
    const d = this.more.querySelector<HTMLDetailsElement>(`#more-${id}`);
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /** Everything, for new data or a new unit. */
  render(input: PanelsInput, point: HourPoint, isNow: boolean): void {
    this.input = input;
    this.point = point;
    this.isNow = isNow;
    this.renderSummary();
    this.renderMare();
    this.renderMaestrale();
    this.renderCamper();
    this.renderSelection();
  }

  /** The hour shown on the rose changed: panels about the wind of that hour follow it. */
  select(point: HourPoint, isNow: boolean): void {
    this.point = point;
    this.isNow = isNow;
    if (this.input) this.renderSelection();
  }

  /** From the rose: open the guide on that wind (0 = north, clockwise). */
  showWind(index: number): void {
    this.pickWind(index);
    this.openPanel('rosa');
  }

  private pickWind(i: number): void {
    this.picked = i;
    this.onPickWind(i);
    this.renderRosa();
    this.more.querySelector<HTMLButtonElement>(`[data-wind="${i}"]`)?.focus({ preventScroll: true });
  }

  private renderSelection(): void {
    this.renderCoste();
    this.renderBeaufort();
    this.renderRosa();
  }

  private panel(id: PanelId, status: string, body: string, level: Level = 'ok'): void {
    const d = this.more.querySelector<HTMLDetailsElement>(`#more-${id}`)!;
    const s = d.querySelector<HTMLElement>('.more-status')!;
    s.innerHTML = status;
    s.className = `more-status ${LEVEL_CLASS[level]}`;
    d.querySelector('.more-body')!.innerHTML = body;
  }

  /* ---------- in breve ---------- */

  private renderSummary(): void {
    const { forecast: f, sea, seaStatus, place, zone, unit } = this.input!;
    // Only a place the sea model knows nothing about is inland for sure; while loading, assume the coast.
    const coastal = seaStatus !== 'none' || zone === 'sardegna';
    this.summary.textContent = windSummary(f, unit, coastal).join(' ');
    const today = f.current.time.slice(0, 10);
    const rows: { k: string; v: string; open: PanelId; level?: Level }[] = [];

    rows.push({ k: 'Mare', v: this.seaShort(sea, seaStatus, today), open: 'mare', level: sea && seaState(sea.now.height).degree >= 4 ? 'attenzione' : 'ok' });

    const region = regionAt(place.lat, place.lon);
    if (region) {
      const now = f.current;
      const readings = regionExposure(region, now.dir);
      rows.push({
        k: 'Coste',
        v:
          now.speed < EXPOSURE_MIN
            ? 'Vento debole: nessuna costa davvero esposta'
            : `Più esposte ${segmentNames(readings, 'esposta')}; più riparate ${segmentNames(readings, 'ridossata')}`,
        open: 'coste',
      });
    }

    const tips = camperTips(f.current, f.ahead, unit, sea?.now ?? null, zone, todaySun(f));
    const flagged = tips.filter((t) => t.level !== 'ok').sort((a, b) => (a.level === b.level ? 0 : a.level === 'pericolo' ? -1 : 1));
    rows.push({
      k: 'Giornata',
      v: flagged.length
        ? flagged.slice(0, 2).map((t) => `${t.title}: ${t.short}`).join(' · ')
        : `Nessun problema per guida, sosta${tips.some((t) => t.id === 'spiaggia') ? ' e spiaggia' : ' e passeggiate'}`,
      open: 'camper',
      level: flagged.reduce<Level>((l, t) => worse(l, t.level), 'ok'),
    });

    const m = maestraleOutlook(f.current, f.ahead);
    if (m.first && coastal && isMediterranean(zone)) rows.push({ k: 'Maestrale', v: maestraleStatus(m, f.current, today), open: 'maestrale' });

    this.facts.innerHTML = rows
      .map(
        (r) => `<li><button type="button" data-open="${r.open}" class="${LEVEL_CLASS[r.level ?? 'ok']}">
          <span class="fact-k">${r.k}</span><span class="fact-v">${r.v}</span>
          <svg class="fact-go" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button></li>`,
      )
      .join('');
  }

  private seaShort(sea: Sea | null, status: SeaStatus, today: string): string {
    if (status === 'loading') return 'Carico i dati del mare…';
    if (status === 'failed') return 'Dati del mare non disponibili al momento';
    if (!sea) return 'Nessun dato: il punto è lontano dal mare';
    return `${seaHeadline(sea.now)}, ${seaTrendCopy(seaTrend(sea), today)}`;
  }

  /* ---------- coste ---------- */

  private renderCoste(): void {
    const { place, zone } = this.input!;
    const p = this.point!;
    const when = whenShown(p, this.isNow);
    const light = p.speed < EXPOSURE_MIN;
    const w = windFrom(p.dir);
    const region = regionAt(place.lat, place.lon);
    const head = light
      ? `<p>${when}: vento debole (${speedLabel(p.speed, this.input!.unit)}). Nessuna costa è davvero esposta al vento: il mare dipende soprattutto dall’onda residua, vedi <button type="button" class="link" data-open="mare">Mare e onde</button>.</p>`
      : `<p>${when}: ${windLine(w)}, ${speedLabel(p.speed, this.input!.unit)}, raffiche ${speedLabel(p.gust, this.input!.unit)}.</p>`;
    const caveat = `<p class="note">Indicazioni orientative, basate solo sulla direzione del vento e sull’orientamento generale della costa: non sono una mappa di sicurezza. Dentro ogni tratto baie, promontori e isole possono essere più riparati o più esposti, e l’app non conosce il riparo reale delle singole spiagge.</p>`;

    const legend = light
      ? ''
      : `<ul class="exp-legend">${(['esposta', 'laterale', 'ridossata'] as const)
          .map((k) => `<li><span class="exp ${k}">${EXPOSURE_COPY[k].label}</span> ${EXPOSURE_COPY[k].hint}.</li>`)
          .join('')}</ul>`;

    if (!region) {
      this.panel(
        'coste',
        light ? 'Vento debole' : 'Indicazioni generali',
        `${head}
        <div class="dial-wrap">
          ${exposureDial(light ? null : p.dir)}
          <p class="note">Non è una mappa: ogni spicchio è una costa che guarda in quella direzione, colorata per come la prende il vento. La freccia va da dove arriva il vento a dove va.</p>
        </div>
        ${light ? '' : `<p>${genericExposure(p.dir)}</p>${legend}`}
        ${zone === 'nordici' ? nordicCoastNotes().map((n) => `<p>${n}</p>`).join('') : ''}
        <p class="note">Le mappe delle coste per tratto ci sono per la Sardegna e l’Islanda. Qui l’app non conosce la linea di costa, quindi non indica zone riparate.</p>${caveat}`,
      );
      return;
    }

    const readings = light ? null : regionExposure(region, p.dir);
    const here = nearestSegment(region, place.lat, place.lon);
    const list = (readings ?? regionExposure(region, p.dir)).map(({ segment, exposure }) => {
      const tag = light ? '' : `<span class="exp ${exposure}">${EXPOSURE_COPY[exposure].label}</span>`;
      return `<li class="${segment.id === here?.id ? 'here' : ''}">
        <span class="seg-name">${segment.name}${segment.id === here?.id ? ' <small>sei qui</small>' : ''}</span>${tag}
        <span class="seg-places">${segment.places}</span>
      </li>`;
    });
    const notes = light ? [] : region.notes(p.dir);
    this.panel(
      'coste',
      light ? 'Vento debole' : `Esposte: ${segmentNames(readings!, 'esposta')}`,
      `${head}
      <div class="coast-grid ${region.id}">
        ${coastMap(region, readings, light ? null : p.dir, place, here?.id ?? null)}
        <ul class="seg-list">${list.join('')}</ul>
      </div>
      ${legend}
      ${notes.map((n) => `<p>${n}</p>`).join('')}
      <p class="note">Il vento usato è quello previsto per ${escapeHtml(place.name)}: in altre zone dell’isola può avere direzione e forza diverse. Cerca un posto in un’altra zona per leggere il suo vento.</p>
      ${caveat}`,
    );
  }

  /* ---------- mare ---------- */

  private renderMare(): void {
    const { forecast: f, sea, seaStatus, zone } = this.input!;
    const today = f.current.time.slice(0, 10);
    const sneaker =
      zone === 'islanda'
        ? '<p>Sulle spiagge della costa sud, come Reynisfjara, arrivano onde improvvise molto più lunghe delle altre anche con mare in apparenza calmo: resta lontano dalla battigia e non dare mai le spalle al mare.</p>'
        : '';
    if (!sea) {
      const body =
        seaStatus === 'loading'
          ? '<p>Carico i dati del mare…</p>'
          : seaStatus === 'failed'
            ? '<p>Dati del mare non disponibili al momento: riprova più tardi.</p>'
            : '<p>Per questo punto il modello del mare non ha dati: è lontano dalla costa. Cerca una località sul mare per vedere onde e mare residuo.</p>';
      this.panel(
        'mare',
        seaStatus === 'loading' ? 'Carico…' : seaStatus === 'failed' ? 'Non disponibile' : 'Nessun dato',
        `${body}${sneaker}<p class="note">Senza dati del mare l’app non stima l’altezza delle onde dal vento: la stessa velocità alza onde molto diverse a seconda di quanto mare ha davanti e da quanto soffia.</p>`,
      );
      return;
    }
    const now = sea.now;
    const trend = seaTrend(sea);
    const state = seaState(now.height);
    const strip = this.seaStrip(sea);
    const period = now.period ? `<p>Periodo medio ${Math.round(now.period)} s: ${now.period >= 8 ? 'onda lunga, arriva a riva con più forza di quanto dica l’altezza.' : 'onda corta, tipica del mare alzato dal vento.'}</p>` : '';
    const far =
      sea.distance > 5
        ? `<p class="note">Dati del punto di mare più vicino coperto dal modello, a circa ${Math.round(sea.distance)} km da qui: sotto costa l’onda può essere diversa.</p>`
        : '';
    this.panel(
      'mare',
      `${cap(state.label)}, ${mLabel(now.height)}`,
      `<p><strong>${seaHeadline(now)}</strong>, ${seaTrendCopy(trend, today)}.</p>
      <p>${seaOriginCopy(now, f.current)}</p>
      ${period}
      ${sneaker}
      ${strip}
      <p>${seaDaysCopy(sea, today)}</p>
      ${far}
      <p class="note">Altezza significativa: la media del terzo più alto delle onde, le singole onde possono essere più alte. I modelli d’onda hanno maglie di alcuni km: in baie e porti il mare è spesso più calmo, su promontori e scogliere più agitato. Non adatti alla navigazione costiera.</p>
      <details class="scale"><summary>Scala Douglas</summary>${this.douglasTable(state.degree)}</details>`,
      state.degree >= 4 ? 'attenzione' : 'ok',
    );
  }

  /** Wave height every 3 hours for the next three days. */
  private seaStrip(sea: Sea): string {
    const pts = sea.ahead.filter((_, i) => i % 3 === 0).slice(0, 24);
    if (pts.length < 2) return '';
    const max = Math.max(1, ...pts.map((p) => p.height));
    const today = sea.now.time.slice(0, 10);
    const bars = pts
      .map((p) => {
        const h = Math.max(2, (p.height / max) * 56);
        const label = p === pts[0] ? 'ora' : p.time.slice(11, 13) === '00' ? dayLabel(p.time.slice(0, 10), today) : '';
        const day = label ? `<span class="ss-day">${label}</span>` : '';
        return `<span class="ss-col" title="${hourLabel(p.time)}: ${mLabel(p.height)}"><span class="ss-bar d${Math.min(6, seaState(p.height).degree)}" style="height:${h.toFixed(0)}px"></span>${day}</span>`;
      })
      .join('');
    return `<div class="sea-strip" role="img" aria-label="Altezza delle onde ogni 3 ore nei prossimi tre giorni, massimo ${mLabel(max)}">${bars}</div>`;
  }

  private douglasTable(current: number): string {
    const rows: [string, string][] = [
      ['calmo', '0 m'],
      ['quasi calmo', 'fino a 0,1 m'],
      ['poco mosso', '0,1–0,5 m'],
      ['mosso', '0,5–1,25 m'],
      ['molto mosso', '1,25–2,5 m'],
      ['agitato', '2,5–4 m'],
      ['molto agitato', '4–6 m'],
      ['grosso', '6–9 m'],
      ['molto grosso', '9–14 m'],
      ['tempestoso', 'oltre 14 m'],
    ];
    return `<ol class="douglas" start="0">${rows.map(([l, r], i) => `<li class="${i === current ? 'on' : ''}"><b>${i}</b> ${cap(l)} <span>${r}</span></li>`).join('')}</ol>`;
  }

  /* ---------- maestrale ---------- */

  private renderMaestrale(): void {
    const { forecast: f, sea, place, zone, unit } = this.input!;
    // A Mediterranean wind: elsewhere a north-westerly is just a north-westerly.
    const details = this.more.querySelector<HTMLDetailsElement>('#more-maestrale')!;
    details.hidden = !isMediterranean(zone);
    if (details.hidden) return;
    const today = f.current.time.slice(0, 10);
    const o = maestraleOutlook(f.current, f.ahead);
    const coasts = sardiniaExposure(WINDS[MAESTRALE].deg);
    const about = `<p>${WINDS[MAESTRALE].about} Spesso arriva dopo il passaggio di una perturbazione e porta aria più fresca e secca. A volte dura più giorni: quanto, lo dicono solo le previsioni.</p>`;
    const coastCopy =
      zone === 'sardegna'
        ? `<p>In Sardegna con il maestrale le coste più esposte sono quelle a ${segmentNames(coasts, 'esposta')}; più riparate dal moto ondoso quelle a ${segmentNames(coasts, 'ridossata')}, dove però il vento arriva da terra e può soffiare a raffiche. <button type="button" class="link" data-open="coste">Coste esposte e ripari</button></p>`
        : `<p>${genericExposure(WINDS[MAESTRALE].deg)} <button type="button" class="link" data-open="coste">Coste esposte e ripari</button></p>`;

    if (!o.first) {
      this.panel(
        'maestrale',
        maestraleStatus(o, f.current, today),
        `<p>Nelle prossime ${o.horizon} ore le previsioni per ${escapeHtml(place.name)} non danno maestrale.</p>${about}${coastCopy}`,
      );
      return;
    }

    const rows = o.windows
      .map((w) => `<li class="${w.hours ? 'on' : ''}"><span>${windowLabel(w)}</span><b>${windowCopy(w, unit)}</b></li>`)
      .join('');
    const trend = maestraleTrend(o);
    const trendCopy = trend
      ? `<p>Tendenza nei prossimi giorni: ${trend === 'rinforzo' ? 'in rinforzo' : trend === 'calo' ? 'in attenuazione' : 'intensità simile'}.</p>`
      : '';
    const persistence = maestralePersistence(o, today);
    const peakGust = Math.max(...o.windows.map((w) => w.maxGust));
    const peakMean = Math.max(...o.windows.map((w) => w.maxSpeed));
    const strength = `<p>Media massima ${speedLabel(peakMean, unit)} (forza ${beaufort(peakMean).force}, ${beaufort(peakMean).label.toLowerCase()}), raffiche fino a ${speedLabel(peakGust, unit)}.</p>`;

    let waves: string;
    if (sea) {
      const during = new Set(f.ahead.slice(0, 72).filter(isMaestrale).map((h) => h.time));
      const wave = sea.ahead.filter((p) => during.has(p.time)).reduce<(typeof sea.ahead)[number] | null>((a, b) => (!a || b.height > a.height ? b : a), null);
      waves = wave
        ? `<p>Qui il mare con il maestrale arriva a ${mLabel(wave.height)} (${seaState(wave.height).label}) ${whenLabel(wave.time, today)}.</p>`
        : '';
    } else {
      waves = `<p class="note">Senza dati del mare per questo punto. In genere con maestrale teso o forte il mare si alza soprattutto sulle coste rivolte a nord-ovest${zone === 'sardegna' ? ', in Sardegna quelle occidentali e settentrionali' : ''}.</p>`;
    }

    this.panel(
      'maestrale',
      maestraleStatus(o, f.current, today),
      `${o.now ? `<p><strong>Maestrale ${speedLabel(f.current.speed, unit)}</strong>, raffiche ${speedLabel(f.current.gust, unit)}.</p>` : ''}
      <ul class="windows">${rows}</ul>
      ${strength}${trendCopy}
      ${persistence ? `<p>${persistence}</p>` : ''}
      ${waves}
      ${coastCopy}
      ${about}`,
      peakGust >= 60 ? 'pericolo' : peakGust >= 40 ? 'attenzione' : 'ok',
    );
  }

  /* ---------- camper ---------- */

  private renderCamper(): void {
    const { forecast: f, sea, place, zone, unit } = this.input!;
    const tips = camperTips(f.current, f.ahead, unit, sea?.now ?? null, zone, todaySun(f));
    const level = tips.reduce<Level>((l, t) => worse(l, t.level), 'ok');
    const flagged = tips.filter((t) => t.level !== 'ok');
    const top = flagged.filter((t) => t.level === level).map((t) => t.title.split(' ')[0].toLowerCase());
    const others = top.length > 2 ? ` e altri ${top.length - 2}` : '';
    const status = flagged.length ? `${cap(level)}: ${top.slice(0, 2).join(', ')}${others}` : 'Tutto tranquillo';
    const item = (t: Tip) => `<li class="${LEVEL_CLASS[t.level]}"><i class="dot"></i><b>${t.title}</b> ${t.text}</li>`;
    this.panel(
      'camper',
      status,
      `<ul class="tips">${tips.map(item).join('')}</ul>
      <p class="note">Suggerimenti in base alle previsioni per ${escapeHtml(place.name)} nelle prossime 12 ore. Non sostituiscono gli avvisi ufficiali: segui ${officialSources(zone)}.</p>`,
      level,
    );
  }

  /* ---------- beaufort ---------- */

  private renderBeaufort(): void {
    const { unit } = this.input!;
    const p = this.point!;
    const mean = beaufort(p.speed);
    const gust = beaufort(p.gust);
    const rows = Array.from({ length: 13 }, (_, i) => {
      const e = beaufortEffects(i);
      const tag = i === mean.force ? '<em>media</em>' : i === gust.force ? '<em class="g">raffiche</em>' : '';
      return `<li class="${i === mean.force ? 'on' : i === gust.force ? 'gust' : ''}">
        <b class="bf-n">${i}</b>
        <span class="bf-name">${beaufortLabel(i)} ${tag}</span>
        <span class="bf-range">${beaufortRange(i, unit)}</span>
        <span class="bf-fx">${e.land} ${e.sea}</span>
      </li>`;
    }).join('');
    const fx = beaufortEffects(mean.force);
    this.panel(
      'beaufort',
      `Forza ${mean.force}, ${mean.label.toLowerCase()}`,
      `<p>${whenShown(p, this.isNow)}: <strong>forza ${mean.force}, ${mean.label.toLowerCase()}</strong>, con una media di ${speedLabel(p.speed, unit)} (fascia ${beaufortRange(mean.force, unit)}).</p>
      <p>${fx.land} In mare: ${fx.sea.charAt(0).toLowerCase()}${fx.sea.slice(1)}</p>
      <p>Le raffiche arrivano a ${speedLabel(p.gust, unit)}${gust.force > mean.force ? `, come la forza ${gust.force}` : ''}. La scala si legge sulla velocità media: le raffiche sono picchi di pochi secondi e non cambiano la forza del vento.</p>
      <ol class="beaufort" start="0">${rows}</ol>`,
    );
  }

  /* ---------- rosa dei venti ---------- */

  private renderRosa(): void {
    const { place, zone } = this.input!;
    const p = this.point!;
    const med = mediterraneanNames();
    const rose = windRose();
    const calm = p.speed < CALM_BELOW;
    const shown = windFrom(p.dir);
    const i = this.picked ?? (calm ? (med ? MAESTRALE : 0) : rose.indexOf(shown));
    const w = rose[i];
    const region = regionAt(place.lat, place.lon);
    const exposed = region
      ? `In ${region.name} espone soprattutto le coste a ${segmentNames(regionExposure(region, w.deg), 'esposta')}.`
      : `Espone soprattutto le coste rivolte a ${w.direction}.`;
    const about = med
      ? w.about
      : zone === 'islanda'
        ? icelandAbout(w.cardinal)
        : zone === 'nordici'
          ? nordicAbout(w.cardinal)
          : 'Che aria porta un vento dipende dalla zona: l’app lo descrive solo per il Mediterraneo, l’Islanda, la Norvegia, la Svezia e la Finlandia.';
    const intro = med
      ? '<p>Il nome del vento dice <strong>da dove arriva</strong>, non dove va: il maestrale arriva da nord-ovest e spinge l’aria verso sud-est.'
      : '<p>Il vento si indica con la direzione <strong>da cui arriva</strong>, non con quella verso cui va: un vento da nord-ovest spinge l’aria verso sud-est. Qui l’app non usa i nomi del Mediterraneo (Maestrale, Scirocco…), che fuori da quel mare non hanno senso.';
    const example = calm
      ? `<p>${whenShown(p, this.isNow)} c’è calma di vento.</p>`
      : med
        ? `<p>${whenShown(p, this.isNow)}: <strong>${shown.name}</strong>, arriva da ${shown.direction} (${Math.round(p.dir)}°) e soffia verso ${windTowards(p.dir)}.</p>`
        : `<p>${whenShown(p, this.isNow)}: il vento arriva da <strong>${shown.direction}</strong> (${Math.round(p.dir)}°) e soffia verso ${windTowards(p.dir)}.</p>`;
    const buttons = rose.map(
      (x, j) => `<button type="button" data-wind="${j}" aria-pressed="${j === i}" class="${!calm && x.name === shown.name ? 'now' : ''}">
        ${needleIcon(x.deg, x.warm, 16)}<span>${x.name}</span><small>${x.cardinal}</small>
      </button>`,
    ).join('');
    this.panel(
      'rosa',
      calm ? 'Calma' : `${med ? `${shown.name}, d` : 'D'}a ${shown.direction} verso ${windTowards(p.dir)}`,
      `${intro} Sulla rosa la punta colorata della lancetta indica la provenienza; la coda e le scie animate il verso in cui si muove l’aria.</p>
      ${example}
      <div class="wind-picker" role="group" aria-label="${med ? 'Gli otto venti' : 'Le otto direzioni'}">${buttons}</div>
      <div class="wind-card">
        <p class="wc-name">${med ? w.name : `Da ${w.direction}`} <small>${w.cardinal}, ${w.deg}°: da ${w.direction} verso ${windTowards(w.deg)}</small></p>
        <p>${about}</p>
        <p class="note">${exposed}</p>
      </div>
      <p class="note">Tocca un nome sulla rosa o qui sopra per leggere ${med ? 'il suo vento' : 'quella direzione'}.</p>`,
    );
  }
}
