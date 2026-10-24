import '@fontsource/ibm-plex-sans-condensed/latin-400.css';
import '@fontsource/ibm-plex-sans-condensed/latin-500.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600-italic.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';

import { GUST_WARN } from './alerts';
import { currentPosition, fetchForecast, fetchMarine, placeName, type Place, type PlaceSource } from './api';
import { HourChart } from './chart';
import { DayList } from './days';
import { buildForecast, type Forecast, type HourPoint, type OpenMeteoResponse } from './forecast';
import { agoLabel, alertCopy, hourLabel, localIso } from './format';
import { buildSea, type MarineResponse } from './marine';
import { isNative, syncPayload, vento, type AlertsStatus } from './native';
import { Panels, type SeaStatus } from './panels';
import { rainLabel, rainShort, rainSpellCopy } from './rain';
import { Rose } from './rose';
import { Search } from './search';
import { load, save } from './storage';
import { dropIcon } from './ui';
import {
  beaufort,
  CALM_BELOW,
  convertSpeed,
  mediterraneanNames,
  UNIT_LABEL,
  useWindNaming,
  windFrom,
  windTowards,
  type SpeedUnit,
} from './wind';
import { isMediterranean, zoneOf } from './zone';

registerSW({ immediate: true });

const CACHE_KEY = 'vento.last.v1';
const UNIT_KEY = 'vento.unit';
const STALE_AFTER = 15 * 60_000;
const CACHE_MAX_AGE = 4 * 86_400_000;

interface Shown {
  place: Place;
  source: PlaceSource;
  data: OpenMeteoResponse;
  fetchedAt: number;
  /** Waves, fetched next to the forecast: null when that request failed, missing in older caches. */
  marine?: MarineResponse | null;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const els = {
  placeBtn: $('#place-btn'),
  placeName: $('#place-name'),
  placeMeta: $('#place-meta'),
  unitBtn: $<HTMLButtonElement>('#unit-btn'),
  searchBtn: $<HTMLButtonElement>('#search-btn'),
  reading: $('#reading'),
  alert: $('#alert'),
  readout: $('#readout'),
  details: $('#details'),
  toast: $('#toast'),
  install: $<HTMLButtonElement>('#install-btn'),
  iosHint: $('#ios-hint'),
  alertsPanel: $('#alerts-panel'),
  alertsText: $('#alerts-text'),
  alertsBtn: $<HTMLButtonElement>('#alerts-btn'),
};

let shown: Shown | null = null;
let forecast: Forecast | null = null;
/** Selected hour as a time string, so it survives re-anchoring of the 24h window. */
let selectedTime: string | null = null;
let renderedHour = '';
let unit: SpeedUnit = load<SpeedUnit>(UNIT_KEY) ?? 'kmh';
let requestId = 0;
/** The sea request of this place is still running. */
let seaPending = false;

const rose = new Rose($('#rose'), (i) => panels.showWind(i));
const panels = new Panels($('#summary'), $('#facts'), $('#more'), (i) => rose.pick(i));
const chart = new HourChart($('#chart'), (i) => selectHour(i));

function selectedIndex(): number | null {
  if (!forecast || selectedTime === null) return null;
  const i = forecast.next24.findIndex((p) => p.time === selectedTime);
  return i >= 0 ? i : null;
}

function selectHour(i: number | null): void {
  selectedTime = i === null ? null : (forecast?.next24[i]?.time ?? null);
  renderReading();
  chart.render(forecast!.next24, unit, selectedIndex());
}
const dayList = new DayList($('#days'));
const search = new Search($<HTMLDialogElement>('#search'), (pick) => {
  selectedTime = null;
  if (pick === 'gps') locate();
  else loadPlace(pick, 'search');
});

/* ---------- rendering ---------- */

function renderHeader(status?: string): void {
  els.placeName.textContent = shown?.place.name ?? 'Vento';
  els.placeBtn.classList.toggle('gps', shown?.source === 'gps');
  els.unitBtn.textContent = UNIT_LABEL[unit];
  if (status) {
    els.placeMeta.textContent = status;
    return;
  }
  if (!shown) return;
  const age = agoLabel(Date.now() - shown.fetchedAt);
  els.placeMeta.textContent = navigator.onLine ? age : `offline, ${age}`;
}

function displayedPoint(): HourPoint | null {
  if (!forecast) return null;
  const i = selectedIndex();
  return i === null ? forecast.current : forecast.next24[i];
}

function renderReading(): void {
  const p = displayedPoint();
  if (!p || !forecast) return;
  const calm = p.speed < CALM_BELOW;
  const w = windFrom(p.dir);
  const bf = beaufort(p.speed);
  const now = selectedIndex() === null;
  const rain = rainShort(p);
  const spell = now ? forecast.rainSpell : null;

  document.documentElement.dataset.warm = !calm && w.warm ? '1' : '0';
  document.documentElement.style.setProperty('--force', String(bf.force));

  const when =
    now
      ? `<p class="when">Adesso</p>`
      : `<p class="when">Alle ${hourLabel(p.time)}:00 <button type="button" class="link" id="back-now">Torna ad adesso</button></p>`;

  // Outside the Mediterranean the wind is named by where it comes from, and the line below says where it goes.
  const med = mediterraneanNames();
  const temp =
    p.temp == null
      ? ''
      : `<p class="desc soft">${Math.round(p.temp)}°${p.feels != null && Math.abs(p.feels - p.temp) >= 2 ? `, percepiti ${Math.round(p.feels)}°` : ''}</p>`;
  els.reading.innerHTML = `${when}
    <h1 class="wind-name">${calm ? 'Calma' : med ? w.name : `Da ${w.direction}`}</h1>
    <p class="speed"><span class="num">${convertSpeed(p.speed, unit)}</span><span class="u">${UNIT_LABEL[unit]}</span></p>
    <p class="desc">${calm ? 'Aria ferma' : med ? `Da ${w.direction}` : `Verso ${windTowards(p.dir)}`}, raffiche fino a ${convertSpeed(p.gust, unit)} ${UNIT_LABEL[unit]}</p>
    <p class="desc soft">Forza ${bf.force}, ${bf.label.toLowerCase()}</p>${temp}
    <p class="desc soft rain-line${rain ? ' wet' : ''}">${dropIcon(13)}${rainLabel(p)}</p>${
      spell ? `<p class="desc soft">${rainSpellCopy(spell)}</p>` : ''
    }${
      // The ring reads like a clock face: say what the arc means.
      spell?.spread ? '<p class="desc hint"><span class="arc-key"></span>L’arco azzurro sulla rosa indica da dove arriva la pioggia, come la lancetta per il vento.</p>' : ''
    }`;

  els.reading.querySelector('#back-now')?.addEventListener('click', () => selectHour(null));

  // On phones the chart sits below the rose: repeat the reading right above it.
  const label = now ? 'Adesso' : `Alle ${hourLabel(p.time)}`;
  els.readout.innerHTML = `${label}: <strong>${calm ? 'calma' : med ? w.name : `da ${w.direction}`}</strong>, ${convertSpeed(p.speed, unit)} ${UNIT_LABEL[unit]}, raffiche ${convertSpeed(p.gust, unit)}${rain ? `, pioggia ${rain}` : ''}${
    now ? '' : ' <button type="button" class="link" data-now>adesso</button>'
  }`;
  els.readout.querySelector('[data-now]')?.addEventListener('click', () => selectHour(null));

  rose.update({
    dir: calm ? null : p.dir,
    speed: p.speed,
    gust: p.gust,
    spread: now ? forecast.spread : null,
    rain: spell?.spread ? { ...spell.spread, wet: spell.wet } : null,
  });
  panels.select(p, now);
}

function renderAlert(): void {
  const a = forecast?.alert;
  if (!a) {
    els.alert.hidden = true;
    return;
  }
  const copy = alertCopy(a, unit);
  els.alert.hidden = false;
  els.alert.className = `alert ${a.level}`;
  els.alert.innerHTML = `<p class="alert-title">${copy.title}</p><p>${copy.advice}</p>`;
}

function renderAll(): void {
  if (!shown) return;
  const localNow = localIso(new Date(), shown.data.timezone);
  renderedHour = localNow.slice(0, 13);
  // Name winds the way the place does, before anything is drawn. A southerly reads as warm only in
  // the northern mid-latitudes.
  const zone = zoneOf(shown.place.lat, shown.place.lon);
  useWindNaming(isMediterranean(zone) ? 'mediterraneo' : 'direzioni', shown.place.lat > 23.5);
  forecast = buildForecast(shown.data, localNow);
  if (selectedIndex() === null) selectedTime = null;
  document.body.classList.remove('empty', 'loading');
  els.details.hidden = false;
  renderHeader();
  renderReading();
  renderAlert();
  chart.render(forecast.next24, unit, selectedIndex());
  dayList.render(forecast.days, forecast.current.time.slice(0, 10), unit);
  renderPanels(localNow);
  renderAlertsPanel();
}

/** Summary and deep dives: interpretations built from the stored responses, never stored themselves. */
function renderPanels(localNow?: string): void {
  if (!shown || !forecast) return;
  const sea = buildSea(shown.marine, shown.place, localNow ?? localIso(new Date(), shown.data.timezone));
  const seaStatus: SeaStatus = sea ? 'ok' : shown.marine ? 'none' : seaPending ? 'loading' : 'failed';
  const zone = zoneOf(shown.place.lat, shown.place.lon);
  panels.render({ forecast, sea, seaStatus, place: shown.place, zone, unit }, displayedPoint()!, selectedIndex() === null);
}

function renderMessage(title: string, body: string, actions: { label: string; run: () => void }[]): void {
  document.body.classList.add('empty');
  els.details.hidden = true;
  els.alert.hidden = true;
  rose.update({ dir: null, speed: 0, gust: 0, spread: null, rain: null });
  els.reading.innerHTML = `<h1 class="wind-name small">${title}</h1><p class="desc">${body}</p>
    <div class="actions">${actions.map((a, i) => `<button type="button" class="btn${i ? ' ghost' : ''}" data-a="${i}">${a.label}</button>`).join('')}</div>`;
  els.reading.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.addEventListener('click', () => actions[Number(b.dataset.a)].run()));
}

let toastTimer = 0;
function toast(msg: string): void {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 4200);
}

/* ---------- data flow ---------- */

/** Keeps the last forecast for offline use and, in the app, hands it to the widget and gust notifications. */
function persist(): void {
  if (!shown) return;
  save(CACHE_KEY, shown);
  if (isNative) vento.sync(syncPayload(shown, unit)).catch(() => {});
}

/**
 * @param resolveName Look up the place name from coordinates. Only for GPS positions: BigDataCloud's
 * free client API may be called with the device's own location, never with stored or shared coordinates.
 */
async function loadPlace(place: Place, source: PlaceSource, resolveName = false): Promise<void> {
  const id = ++requestId;
  if (!shown) {
    document.body.classList.add('loading');
    renderHeader('Scarico le previsioni…');
  }
  try {
    const name = resolveName ? placeName(place.lat, place.lon) : Promise.resolve(place.name);
    // Waves never hold up the wind: they arrive when they arrive, or the panel says they are missing.
    const marine = fetchMarine(place.lat, place.lon).catch(() => null);
    const data = await fetchForecast(place.lat, place.lon);
    if (id !== requestId) return; // a newer request won
    // Keep the last known name while reverse geocoding runs, so the forecast never waits for it.
    const sameSpot = shown && Math.abs(shown.place.lat - place.lat) < 0.05 && Math.abs(shown.place.lon - place.lon) < 0.05;
    const provisional = resolveName && sameSpot ? shown!.place.name : place.name;
    shown = { place: { ...place, name: provisional }, source, data, fetchedAt: Date.now(), marine: sameSpot ? shown!.marine : undefined };
    seaPending = true;
    persist();
    renderAll();
    marine.then((sea) => {
      if (id !== requestId || !shown) return;
      seaPending = false;
      // A failed request keeps the waves already shown for this spot: realigned by hour like the wind.
      shown.marine = sea ?? shown.marine ?? null;
      persist();
      renderPanels();
    });
    const resolved = await name;
    if (id === requestId && resolved && shown) {
      shown.place.name = resolved;
      persist();
      renderHeader();
      renderPanels();
    }
  } catch {
    if (id !== requestId) return;
    seaPending = false;
    if (shown) {
      renderHeader();
      renderPanels();
      toast(navigator.onLine ? `Previsioni per ${place.name} non raggiungibili. Riprova tra poco.` : 'Sei offline: mostro gli ultimi dati scaricati.');
    } else {
      document.body.classList.remove('loading');
      renderHeader(' ');
      renderMessage('Previsioni non raggiungibili', 'Controlla la connessione e riprova.', [
        { label: 'Riprova', run: () => loadPlace(place, source, resolveName) },
        { label: 'Cerca un posto', run: () => search.open() },
      ]);
    }
  }
}

async function locate(): Promise<void> {
  const id = ++requestId;
  if (!shown) {
    document.body.classList.add('loading');
    renderHeader('Cerco la tua posizione…');
  }
  try {
    const pos = await currentPosition();
    if (id !== requestId) return;
    await loadPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'La tua posizione' }, 'gps', true);
  } catch (err) {
    if (id !== requestId) return;
    const denied = (err as GeolocationPositionError).code === 1;
    if (shown) {
      toast(denied ? 'Posizione non autorizzata: mostro l’ultimo posto.' : 'Posizione non disponibile: mostro l’ultimo posto.');
      renderHeader();
      return;
    }
    document.body.classList.remove('loading');
    renderHeader(' ');
    renderMessage(
      denied ? 'Posizione non autorizzata' : 'Posizione non trovata',
      denied
        ? isNative
          ? 'Consenti la posizione per Vento in Impostazioni, oppure cerca un posto per nome.'
          : 'Consenti la localizzazione nelle impostazioni del browser, oppure cerca un posto per nome.'
        : 'Il GPS non ha risposto in tempo. Riprova all’aperto, oppure cerca un posto per nome.',
      [
        { label: 'Cerca un posto', run: () => search.open() },
        { label: 'Riprova', run: () => locate() },
      ],
    );
  }
}

function refresh(): void {
  if (!shown || shown.source === 'gps') locate();
  else loadPlace(shown.place, shown.source);
}

/* ---------- controls ---------- */

els.searchBtn.addEventListener('click', () => search.open());
els.placeBtn.addEventListener('click', () => search.open());
els.unitBtn.addEventListener('click', () => {
  const order: SpeedUnit[] = ['kmh', 'kn', 'ms'];
  unit = order[(order.indexOf(unit) + 1) % order.length];
  save(UNIT_KEY, unit);
  if (shown) {
    renderAll();
    persist();
  } else renderHeader();
});

/** Keeps the screen honest while it stays open: refetch when stale, re-anchor when the hour turns. */
function tick(): void {
  if (!shown) return;
  if (navigator.onLine && Date.now() - shown.fetchedAt > STALE_AFTER) refresh();
  else if (localIso(new Date(), shown.data.timezone).slice(0, 13) !== renderedHour) renderAll();
  else renderHeader();
}

document.addEventListener('visibilitychange', () => document.hidden || tick());
window.addEventListener('online', tick);
window.addEventListener('offline', () => renderHeader());
setInterval(tick, 60_000);

/* ---------- install ---------- */

let deferredInstall: (Event & { prompt: () => Promise<void> }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e as typeof deferredInstall;
  els.install.hidden = false;
});
els.install.addEventListener('click', async () => {
  await deferredInstall?.prompt();
  deferredInstall = null;
  els.install.hidden = true;
});
window.addEventListener('appinstalled', () => (els.install.hidden = true));

const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (ios && !standalone && !isNative && !load<boolean>('vento.iosHintDone')) {
  els.iosHint.hidden = false;
  els.iosHint.querySelector('button')!.addEventListener('click', () => {
    els.iosHint.hidden = true;
    save('vento.iosHintDone', true);
  });
}

/* ---------- app only: gust notifications ---------- */

let alerts: AlertsStatus | null = null;

function renderAlertsPanel(): void {
  if (!alerts) return;
  const from = `${convertSpeed(GUST_WARN, unit)} ${UNIT_LABEL[unit]}`;
  els.alertsPanel.hidden = false;
  els.alertsBtn.hidden = alerts.permission === 'denied';
  els.alertsBtn.classList.toggle('ghost', alerts.enabled);
  if (alerts.permission === 'denied') {
    els.alertsText.textContent = 'Le notifiche di Vento sono bloccate. Per riceverle vai in Impostazioni, Notifiche, Vento.';
  } else if (alerts.enabled) {
    els.alertsText.textContent = `Attivi per ${shown?.place.name ?? 'il posto scelto'}: ti avviso quando arrivano raffiche da ${from} e un'ora prima che inizino.`;
    els.alertsBtn.textContent = 'Disattiva avvisi';
  } else {
    els.alertsText.textContent = `Ti avviso quando arrivano raffiche da ${from}, anche ad app chiusa, e un'ora prima che inizino.`;
    els.alertsBtn.textContent = 'Attiva avvisi';
  }
}

async function updateAlerts(change?: () => Promise<AlertsStatus>): Promise<void> {
  try {
    alerts = await (change ?? vento.alertsStatus)();
    renderAlertsPanel();
  } catch {
    // Plugin missing (old app build): leave the panel hidden.
  }
}

if (isNative) {
  document.documentElement.classList.add('native');
  els.alertsBtn.addEventListener('click', () => updateAlerts(alerts?.enabled ? vento.disableAlerts : vento.enableAlerts));
  // Coming back from Settings may have changed the permission.
  document.addEventListener('visibilitychange', () => document.hidden || updateAlerts());
  updateAlerts();
}

/* ---------- start ---------- */

const cached = load<Shown>(CACHE_KEY);
if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE) {
  try {
    shown = cached;
    renderAll();
  } catch {
    // Corrupt or outdated cache: forget it and start clean.
    shown = null;
    forecast = null;
    save(CACHE_KEY, null);
  }
}

const params = new URLSearchParams(location.search);
const latParam = params.get('lat')?.trim();
const lonParam = params.get('lon')?.trim();
const lat = Number(latParam);
const lon = Number(lonParam);
if (latParam && lonParam && Number.isFinite(lat) && Number.isFinite(lon)) {
  const name = params.get('name')?.trim();
  loadPlace({ lat, lon, name: name || `${lat.toFixed(2)}, ${lon.toFixed(2)}` }, 'link');
} else {
  locate();
}
