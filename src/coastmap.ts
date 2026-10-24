import { exposure, type CoastReading, type CoastRegion } from './coast';
import { windRose } from './wind';

const S = 100; // units per degree of latitude
const PAD = 8;

/** Plate carrée squeezed by the cosine of the middle latitude: close enough at island size. */
function projection(region: CoastRegion) {
  const pts = region.segments.flatMap((s) => s.points);
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const W = Math.round((maxLon - minLon) * kx * S);
  const H = Math.round((maxLat - minLat) * S);
  const xy = ([lat, lon]: readonly [number, number]): string => `${((lon - minLon) * kx * S).toFixed(1)} ${((maxLat - lat) * S).toFixed(1)}`;
  return { W, H, xy };
}

/** Three streaks across the map, heading where the wind blows to. */
function windStreaks(dir: number, W: number, H: number): string {
  const to = ((dir + 180) * Math.PI) / 180;
  const ux = Math.sin(to);
  const uy = -Math.cos(to);
  const size = Math.min(W, H);
  const len = size * 0.45;
  const gap = size * 0.28;
  const head = size * 0.055;
  return [-gap, 0, gap]
    .map((off) => {
      const cx = W / 2 - uy * off;
      const cy = H / 2 + ux * off;
      const x1 = cx - (ux * len) / 2;
      const y1 = cy - (uy * len) / 2;
      const x2 = cx + (ux * len) / 2;
      const y2 = cy + (uy * len) / 2;
      const tip = `${(x2 - ux * head - uy * head * 0.6).toFixed(1)} ${(y2 - uy * head + ux * head * 0.6).toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${(x2 - ux * head + uy * head * 0.6).toFixed(1)} ${(y2 - uy * head - ux * head * 0.6).toFixed(1)}`;
      return `<path class="cm-wind" d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} M${tip}"/>`;
    })
    .join('');
}

/**
 * Sketch of a region with each stretch of coast coloured by how it sits against the wind.
 * @param readings Null when the wind is too light to expose any coast: the outline stays neutral.
 */
export function coastMap(
  region: CoastRegion,
  readings: CoastReading[] | null,
  windDir: number | null,
  place: { lat: number; lon: number } | null,
  here: string | null,
): string {
  const { W, H, xy } = projection(region);
  const outline = region.segments.flatMap((s, i) => (i ? s.points.slice(1) : s.points)).map(xy).join(' L');
  const coasts = region.segments
    .map((s) => {
      const r = readings?.find((x) => x.segment.id === s.id);
      return `<path class="cm-coast ${r ? r.exposure : 'neutral'}${s.id === here ? ' here' : ''}" d="M${s.points.map(xy).join(' L')}"/>`;
    })
    .join('');
  const islands = region.islands.map((pts) => `<path class="cm-land" d="M${pts.map(xy).join(' L')} Z"/>`).join('');
  const dot = place ? `<g class="cm-place" transform="translate(${xy([place.lat, place.lon])})"><circle r="7"/><circle r="3"/></g>` : '';
  return `<svg class="coast-map" viewBox="${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}" role="img" aria-label="Mappa schematica delle coste di ${region.name} colorate per esposizione al vento">
    <path class="cm-land" d="M${outline} Z"/>${islands}
    ${windDir === null ? '' : windStreaks(windDir, W, H)}
    ${coasts}${dot}
    <text class="cm-north" x="${W + PAD - 2}" y="${-PAD + 12}">N ↑</text>
  </svg>`;
}

const R1 = 46;
const R2 = 74;

const pt = (bearing: number, r: number): string => {
  const a = (bearing * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(1)} ${(-r * Math.cos(a)).toFixed(1)}`;
};

/**
 * Where no coast map exists: a dial of the eight ways a coast can face, each coloured by how such
 * a coast would sit against the wind. Not a map: the app does not know the real coastline here.
 */
export function exposureDial(windDir: number | null): string {
  const sectors = windRose()
    .map((w) => {
      const cls = windDir === null ? 'neutral' : exposure(windDir, w.deg);
      const a = w.deg - 21;
      const b = w.deg + 21;
      const d = `M${pt(a, R2)} A${R2} ${R2} 0 0 1 ${pt(b, R2)} L${pt(b, R1)} A${R1} ${R1} 0 0 0 ${pt(a, R1)} Z`;
      return `<path class="dial-sector ${cls}" d="${d}"/><text class="dial-label" transform="translate(${pt(w.deg, R2 + 13)})" dy="4">${w.cardinal}</text>`;
    })
    .join('');
  let arrow = '';
  if (windDir !== null) {
    // From where the wind comes to where it goes, across the middle.
    const [x1, y1] = pt(windDir, 30).split(' ');
    const [x2, y2] = pt(windDir + 180, 30).split(' ');
    arrow = `<path class="dial-wind" d="M${x1} ${y1} L${x2} ${y2} M${pt(windDir + 180 - 22, 20)} L${x2} ${y2} L${pt(windDir + 180 + 22, 20)}"/>`;
  }
  return `<svg class="coast-dial" viewBox="-100 -100 200 200" role="img" aria-label="Esposizione al vento di una costa secondo la direzione verso cui guarda">${sectors}${arrow}</svg>`;
}
