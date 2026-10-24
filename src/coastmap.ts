import { SARDINIA, SARDINIA_ISLANDS, type CoastReading } from './coast';

// Plate carrée squeezed by cos(40°), close enough for an island this size.
const LON0 = 7.95;
const LAT0 = 41.4;
const KX = Math.cos((40 * Math.PI) / 180);
const S = 100; // units per degree of latitude
const W = Math.round((10.05 - LON0) * KX * S);
const H = Math.round((LAT0 - 38.7) * S);

const xy = ([lat, lon]: readonly [number, number]): string => `${((lon - LON0) * KX * S).toFixed(1)} ${((LAT0 - lat) * S).toFixed(1)}`;

const outline = (): string => SARDINIA.flatMap((s, i) => (i ? s.points.slice(1) : s.points)).map(xy).join(' L');

/** Three streaks across the island, heading where the wind blows to. */
function windStreaks(dir: number): string {
  const to = ((dir + 180) * Math.PI) / 180;
  const ux = Math.sin(to);
  const uy = -Math.cos(to);
  const len = 70;
  return [-46, 0, 46]
    .map((off) => {
      const cx = W / 2 - uy * off;
      const cy = H / 2 + ux * off;
      const x1 = cx - (ux * len) / 2;
      const y1 = cy - (uy * len) / 2;
      const x2 = cx + (ux * len) / 2;
      const y2 = cy + (uy * len) / 2;
      const head = `${(x2 - ux * 9 - uy * 5).toFixed(1)} ${(y2 - uy * 9 + ux * 5).toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${(x2 - ux * 9 + uy * 5).toFixed(1)} ${(y2 - uy * 9 - ux * 5).toFixed(1)}`;
      return `<path class="cm-wind" d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} M${head}"/>`;
    })
    .join('');
}

/**
 * Sketch of Sardinia with each stretch of coast coloured by how it sits against the wind.
 * @param readings Null when the wind is too light to expose any coast: the outline stays neutral.
 */
export function coastMap(readings: CoastReading[] | null, windDir: number | null, place: { lat: number; lon: number } | null, here: string | null): string {
  const coasts = SARDINIA.map((s) => {
    const r = readings?.find((x) => x.segment.id === s.id);
    return `<path class="cm-coast ${r ? r.exposure : 'neutral'}${s.id === here ? ' here' : ''}" d="M${s.points.map(xy).join(' L')}"/>`;
  }).join('');
  const islands = SARDINIA_ISLANDS.map((pts) => `<path class="cm-land" d="M${pts.map(xy).join(' L')} Z"/>`).join('');
  const dot = place ? `<g class="cm-place" transform="translate(${xy([place.lat, place.lon])})"><circle r="7"/><circle r="3"/></g>` : '';
  return `<svg class="coast-map" viewBox="-8 -8 ${W + 16} ${H + 16}" role="img" aria-label="Mappa schematica delle coste sarde colorate per esposizione al vento">
    <path class="cm-land" d="M${outline()} Z"/>${islands}
    ${windDir === null ? '' : windStreaks(windDir)}
    ${coasts}${dot}
    <text class="cm-north" x="${W - 4}" y="10">N ↑</text>
  </svg>`;
}
