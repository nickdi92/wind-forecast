import { WINDS, normalizeDeg, windFrom } from './wind';
import { reducedMotion } from './ui';

// Geometry in viewBox units (-215..215).
const VIEW = 430;
const R_RING = 168;
const R_NAMES = 186;
const R_FIELD = 150;

export interface RoseView {
  /** Direction the wind comes from, null when calm or unknown. */
  dir: number | null;
  speed: number;
  gust: number;
  spread: { mean: number; half: number } | null;
}

const pt = (bearing: number, r: number): [number, number] => {
  const a = (bearing * Math.PI) / 180;
  return [+(r * Math.sin(a)).toFixed(2), +(-r * Math.cos(a)).toFixed(2)];
};

function ticks(): string {
  let out = '';
  for (let b = 0; b < 360; b += 5) {
    const len = b % 45 === 0 ? 12 : b % 15 === 0 ? 7 : 3.5;
    const [x1, y1] = pt(b, R_RING);
    const [x2, y2] = pt(b, R_RING - len);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${b % 45 === 0 ? 'tick major' : 'tick'}"/>`;
  }
  return out;
}

/** Rhumb lines radiating from the rose across the page, as on portolan charts. */
function rhumbs(): string {
  let out = '';
  for (let b = 0; b < 360; b += 22.5) {
    const [x1, y1] = pt(b, R_RING);
    const [x2, y2] = pt(b, 1400);
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  return out;
}

/** Classic 16-point compass star, two-tone like on old nautical charts. */
function star(): string {
  let out = '';
  for (let i = 0; i < 16; i++) {
    const b = i * 22.5;
    const r = i % 4 === 0 ? 132 : i % 2 === 0 ? 104 : 64;
    const w = i % 2 === 0 ? 11 : 7;
    const [tx, ty] = pt(b, r);
    const [lx, ly] = pt(b - 90, w);
    const [rx, ry] = pt(b + 90, w);
    out += `<path d="M0 0 L${lx} ${ly} L${tx} ${ty} Z" class="star-a"/><path d="M0 0 L${rx} ${ry} L${tx} ${ty} Z" class="star-b"/>`;
  }
  return out;
}

function nameArcs(): string {
  return WINDS.map((w, i) => {
    // Southern names run the other way so they read left to right, sitting on the inside of the arc.
    const bottom = w.deg > 100 && w.deg < 260;
    const r = bottom ? R_NAMES + 9 : R_NAMES;
    const [x1, y1] = pt(w.deg + (bottom ? 32 : -32), r);
    const [x2, y2] = pt(w.deg + (bottom ? -32 : 32), r);
    return `<path id="arc-${i}" d="M${x1} ${y1} A${r} ${r} 0 0 ${bottom ? 0 : 1} ${x2} ${y2}" fill="none"/>`;
  }).join('');
}

function names(): string {
  return WINDS.map(
    (w, i) =>
      `<text class="rose-name" style="--i:${i}" data-wind="${w.name}"><textPath href="#arc-${i}" startOffset="50%" text-anchor="middle">${w.name}</textPath></text>`,
  ).join('');
}

function sectorPath(mean: number, half: number): string {
  const [x1, y1] = pt(mean - half, R_FIELD);
  const [x2, y2] = pt(mean + half, R_FIELD);
  return `M0 0 L${x1} ${y1} A${R_FIELD} ${R_FIELD} 0 ${half * 2 > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

interface Particle {
  x: number;
  y: number;
  life: number;
  ttl: number;
}

export class Rose {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly needle: SVGGElement;
  private readonly sector: SVGPathElement;
  private readonly nameEls: SVGTextElement[];
  private view: RoseView = { dir: null, speed: 0, gust: 0, spread: null };
  private angle = 0;
  private velocity = 0;
  private particles: Particle[] = [];
  private px = 0; // canvas size in CSS px
  private last = 0;
  private raf = 0;
  private rgb = '143,227,200';

  constructor(private readonly root: HTMLElement) {
    root.classList.add('rose', 'intro');
    root.innerHTML = `
      <svg class="rose-bg" viewBox="${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}" aria-hidden="true">
        <defs>${nameArcs()}</defs>
        <g class="rhumb">${rhumbs()}</g>
        <circle r="${R_RING}" class="ring"/>
        <circle r="${R_FIELD}" class="ring inner"/>
        <g class="star">${star()}</g>
        <g class="ticks">${ticks()}</g>
        ${names()}
      </svg>
      <canvas class="rose-field" aria-hidden="true"></canvas>
      <svg class="rose-fg" viewBox="${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}" aria-hidden="true">
        <defs>
          <radialGradient id="sector-fill" cx="0" cy="0" r="${R_FIELD}" gradientUnits="userSpaceOnUse">
            <stop offset="0" style="stop-color: var(--accent); stop-opacity: 0"/>
            <stop offset="1" style="stop-color: var(--accent); stop-opacity: .2"/>
          </radialGradient>
        </defs>
        <path class="sector" fill="url(#sector-fill)" d=""/>
        <g class="needle">
          <path d="M0 6 L7 0 L0 104 L-7 0 Z" class="needle-tail"/>
          <path d="M0 -142 L11 0 L0 16 L-11 0 Z" class="needle-head"/>
          <path d="M0 -142 L0 16 L-11 0 Z" class="needle-shade"/>
          <circle r="8" class="hub"/>
        </g>
      </svg>`;
    this.canvas = root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.needle = root.querySelector('.needle')!;
    this.sector = root.querySelector('.sector')!;
    this.nameEls = [...root.querySelectorAll<SVGTextElement>('.rose-name')];

    new ResizeObserver(() => this.resize()).observe(root);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    root.addEventListener('animationend', (e) => {
      if ((e.target as Element).classList.contains('rose-name') && e.target === this.nameEls.at(-1)) root.classList.remove('intro');
    });
    this.resize();
    this.start();
  }

  update(view: RoseView): void {
    this.view = view;
    this.rgb = getComputedStyle(this.root).getPropertyValue('--accent-rgb').trim() || this.rgb;
    const calm = view.dir === null;
    this.root.classList.toggle('calm', calm);
    const active = calm ? null : windFrom(view.dir!).name;
    for (const el of this.nameEls) el.classList.toggle('on', el.dataset.wind === active);
    this.sector.setAttribute('d', view.spread && !calm ? sectorPath(view.spread.mean, view.spread.half) : '');
    if (reducedMotion() && !calm) {
      this.angle = view.dir!;
      this.drawNeedle();
    }
    if (reducedMotion()) this.drawStaticField();
  }

  private resize(): void {
    const size = this.root.clientWidth;
    if (!size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.px = size;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.particles = [];
    if (reducedMotion()) this.drawStaticField();
  }

  private start(): void {
    if (this.raf || reducedMotion()) return;
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.step(dt, t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private step(dt: number, t: number): void {
    const { dir, speed, gust } = this.view;
    if (dir !== null) {
      // Gusty wind makes the needle tremble; steady wind keeps it still.
      const gustiness = Math.min(1.5, Math.max(0, (gust - speed) / Math.max(speed, 1)));
      const wobble = (2 + gustiness * 5) * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.7 + 1) * 0.4);
      const diff = ((normalizeDeg(dir + wobble - this.angle) + 540) % 360) - 180;
      // Under-damped spring: the needle swings past and settles, like a real compass.
      this.velocity += (40 * diff - 7 * this.velocity) * dt;
      this.angle += this.velocity * dt;
    } else {
      this.angle += 6 * dt; // slow drift while waiting or calm
    }
    this.drawNeedle();
    this.drawField(dt);
  }

  private drawNeedle(): void {
    this.needle.setAttribute('transform', `rotate(${this.angle.toFixed(2)})`);
  }

  private fieldGeometry() {
    const scale = this.px / VIEW;
    return { c: this.px / 2, R: R_FIELD * scale, scale };
  }

  private spawn(R: number, fresh: boolean): Particle {
    const a = Math.random() * Math.PI * 2;
    const r = R * Math.sqrt(Math.random());
    const ttl = 1.5 + Math.random() * 2.5;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, life: fresh ? Math.random() * ttl : 0, ttl };
  }

  private drawField(dt: number): void {
    const { ctx } = this;
    const { c, R, scale } = this.fieldGeometry();
    const { dir, speed } = this.view;
    ctx.clearRect(0, 0, this.px, this.px);
    if (!R) return;

    const calm = dir === null;
    const count = Math.round(28 + Math.min(speed, 80) * 1.3);
    while (this.particles.length < count) this.particles.push(this.spawn(R, true));
    this.particles.length = count;

    // Particles travel where the wind blows TO: opposite of where it comes from.
    const to = ((calm ? 90 : dir!) * Math.PI) / 180;
    const vx = calm ? 1 : -Math.sin(to);
    const vy = calm ? 0 : Math.cos(to);
    const pxPerSec = (calm ? 3 : 10 + speed * 2.2) * scale * 1.6;
    const len = (calm ? 2 : 5 + speed * 0.45) * scale * 1.6;
    const { rgb } = this;

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 1.3 * scale * 1.6);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += vx * pxPerSec * dt;
      p.y += vy * pxPerSec * dt;
      p.life += dt;
      const d = Math.hypot(p.x, p.y);
      if (d > R || p.life > p.ttl) {
        this.particles[i] = this.spawn(R, false);
        continue;
      }
      const edge = 1 - Math.pow(d / R, 4);
      const lifeFade = Math.sin((p.life / p.ttl) * Math.PI);
      ctx.strokeStyle = `rgba(${rgb},${(0.55 * edge * lifeFade).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(c + p.x, c + p.y);
      ctx.lineTo(c + p.x - vx * len, c + p.y - vy * len);
      ctx.stroke();
    }
  }

  /** With reduced motion: a still pattern of streaks shows the direction without movement. */
  private drawStaticField(): void {
    this.particles = [];
    const { ctx } = this;
    const { c, R, scale } = this.fieldGeometry();
    ctx.clearRect(0, 0, this.px, this.px);
    if (!R || this.view.dir === null) return;
    const to = (this.view.dir * Math.PI) / 180;
    const vx = -Math.sin(to);
    const vy = Math.cos(to);
    const { rgb } = this;
    ctx.lineWidth = Math.max(1, 2 * scale);
    for (let gx = -R; gx <= R; gx += 22 * scale * 1.6) {
      for (let gy = -R; gy <= R; gy += 22 * scale * 1.6) {
        const d = Math.hypot(gx, gy);
        if (d > R * 0.92) continue;
        ctx.strokeStyle = `rgba(${rgb},${(0.3 * (1 - d / R)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(c + gx, c + gy);
        ctx.lineTo(c + gx - vx * 10 * scale * 1.6, c + gy - vy * 10 * scale * 1.6);
        ctx.stroke();
      }
    }
  }
}
