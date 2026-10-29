import { GUST_WARN } from './alerts';
import type { HourPoint } from './forecast';
import { hourLabel } from './format';
import { precipKind, PRECIP_WORD, RAIN_MIN, RAIN_POSSIBLE, rainShort } from './rain';
import { needleIcon } from './ui';
import { convertSpeed, UNIT_LABEL, windFrom, type SpeedUnit } from './wind';

const H = 168;
const TOP = 30; // room for direction needles
const LABELS = 22; // room for hour labels
const RAIN_H = 12; // rain band between bars and labels
const BOTTOM = LABELS + RAIN_H + 4;
/** Rain at or above this fills the band; square-root scale so drizzle still shows. */
const RAIN_FULL = 6; // mm

/** Height from the amount when rain is expected, a faint stub when it is only possible. */
function rainBar(h: HourPoint, x: number, w: number): string {
  const wet = h.rain >= RAIN_MIN;
  if (!wet && h.rainChance < RAIN_POSSIBLE) return '';
  const rh = wet ? Math.max(2, RAIN_H * Math.sqrt(Math.min(h.rain, RAIN_FULL) / RAIN_FULL)) : 2;
  return `<rect class="rain${precipKind(h) === 'neve' ? ' snow' : ''}${wet ? '' : ' maybe'}" x="${x.toFixed(1)}" y="${(H - LABELS - rh).toFixed(1)}" width="${w.toFixed(1)}" height="${rh.toFixed(1)}" rx="1"/>`;
}

/**
 * 24-hour bar chart: solid bar = mean wind, ghost bar = gusts, small bar underneath = rain.
 * Drag or use arrow keys to scrub; the selected hour drives the rose.
 */
export class HourChart {
  private hours: HourPoint[] = [];
  private unit: SpeedUnit = 'kmh';
  private selected: number | null = null;
  private dragging = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly onSelect: (index: number | null) => void,
  ) {
    root.tabIndex = 0;
    root.setAttribute('role', 'slider');
    root.setAttribute('aria-label', 'Vento ora per ora. Usa le frecce per scorrere le ore.');
    root.setAttribute('aria-valuemin', '0');
    root.setAttribute('aria-valuemax', '23');
    new ResizeObserver(() => this.draw()).observe(root);

    root.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      root.setPointerCapture(e.pointerId);
      this.pick(e.clientX);
    });
    root.addEventListener('pointermove', (e) => this.dragging && this.pick(e.clientX));
    const end = () => (this.dragging = false);
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);

    root.addEventListener('keydown', (e) => {
      const cur = this.selected ?? -1;
      const map: Record<string, number | null> = {
        ArrowRight: Math.min(23, cur + 1),
        ArrowLeft: Math.max(0, cur - 1),
        Home: 0,
        End: this.hours.length - 1,
        Escape: null,
      };
      if (!(e.key in map)) return;
      e.preventDefault();
      this.onSelect(map[e.key]);
    });
  }

  render(hours: HourPoint[], unit: SpeedUnit, selected: number | null): void {
    this.hours = hours;
    this.unit = unit;
    this.selected = selected;
    const sel = selected === null ? null : hours[selected];
    this.root.setAttribute('aria-valuenow', String(selected ?? 0));
    const rain = sel && rainShort(sel);
    this.root.setAttribute(
      'aria-valuetext',
      sel ? `Ore ${hourLabel(sel.time)}, ${convertSpeed(sel.speed, unit)} ${UNIT_LABEL[unit]}${rain ? `, ${PRECIP_WORD[precipKind(sel)]} ${rain}` : ''}` : 'Adesso',
    );
    this.draw();
  }

  private pick(clientX: number): void {
    const rect = this.root.getBoundingClientRect();
    const i = Math.floor(((clientX - rect.left) / rect.width) * this.hours.length);
    const idx = Math.max(0, Math.min(this.hours.length - 1, i));
    if (idx !== this.selected) this.onSelect(idx);
  }

  private draw(): void {
    const W = this.root.clientWidth;
    if (!W || this.hours.length === 0) return;
    const n = this.hours.length;
    const slot = W / n;
    const barW = Math.max(3, slot - Math.max(2, slot * 0.22));
    const maxGust = Math.max(...this.hours.map((h) => h.gust));
    const scaleMax = Math.max(30, Math.ceil(maxGust / 10) * 10);
    const y = (v: number) => H - BOTTOM - (v / scaleMax) * (H - TOP - BOTTOM);
    const anySel = this.selected !== null;

    let bars = '';
    let labels = '';
    let needles = '';
    this.hours.forEach((h, i) => {
      const x = i * slot + (slot - barW) / 2;
      const warm = windFrom(h.dir).warm;
      const cls = `${warm ? 'warm' : 'cold'}${anySel && i !== this.selected ? ' dim' : ''}${i === this.selected ? ' sel' : ''}`;
      bars += `<g class="bar ${cls}">
        <rect class="gust" x="${x.toFixed(1)}" y="${y(h.gust).toFixed(1)}" width="${barW.toFixed(1)}" height="${(H - BOTTOM - y(h.gust)).toFixed(1)}" rx="2"/>
        <rect class="mean" x="${x.toFixed(1)}" y="${y(h.speed).toFixed(1)}" width="${barW.toFixed(1)}" height="${(H - BOTTOM - y(h.speed)).toFixed(1)}" rx="2"/>
        ${rainBar(h, x, barW)}
      </g>`;
      const cx = i * slot + slot / 2;
      if (i % 3 === 0) {
        labels += `<text x="${cx.toFixed(1)}" y="${H - 6}" class="hour">${i === 0 ? 'ora' : hourLabel(h.time)}</text>`;
        needles += `<g transform="translate(${(cx - 10).toFixed(1)} 2)">${needleIcon(h.dir, warm, 20)}</g>`;
      }
    });

    let threshold = '';
    if (scaleMax >= GUST_WARN) {
      const ty = y(GUST_WARN).toFixed(1);
      threshold = `<line x1="0" x2="${W}" y1="${ty}" y2="${ty}" class="threshold"/>
        <text x="${W - 2}" y="${(+ty - 4).toFixed(1)}" class="threshold-label">raffiche forti ${convertSpeed(GUST_WARN, this.unit)}</text>`;
    }

    this.root.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      ${threshold}${bars}${needles}${labels}
    </svg>`;
  }
}
