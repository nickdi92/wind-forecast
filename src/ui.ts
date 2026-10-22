/** Small version of the rose needle: the bright tip points where the wind comes from, like the big one. */
export function needleIcon(dir: number, warm: boolean, size = 18): string {
  return `<svg class="needle-icon${warm ? ' warm' : ''}" width="${size}" height="${size}" viewBox="-10 -10 20 20" aria-hidden="true">
    <g transform="rotate(${Math.round(dir)})">
      <path class="ni-tail" d="M0 2 L2.6 0 L0 8.5 L-2.6 0 Z"/>
      <path class="ni-head" d="M0 -9 L3.4 0 L0 2.4 L-3.4 0 Z"/>
    </g>
  </svg>`;
}

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
