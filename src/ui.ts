/** Small version of the rose needle: the bright tip points where the wind comes from, like the big one. */
export function needleIcon(dir: number, warm: boolean, size = 18): string {
  return `<svg class="needle-icon${warm ? ' warm' : ''}" width="${size}" height="${size}" viewBox="-10 -10 20 20" aria-hidden="true">
    <g transform="rotate(${Math.round(dir)})">
      <path class="ni-tail" d="M0 2 L2.6 0 L0 8.5 L-2.6 0 Z"/>
      <path class="ni-head" d="M0 -9 L3.4 0 L0 2.4 L-3.4 0 Z"/>
    </g>
  </svg>`;
}

/** @param label Read by screen readers when no text next to the drop says it is rain. */
export function dropIcon(size = 12, label?: string): string {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="drop-icon" width="${size}" height="${size}" viewBox="0 0 12 12" ${a11y}><path d="M6 1C6 1 2.2 5.2 2.2 7.6a3.8 3.8 0 0 0 7.6 0C9.8 5.2 6 1 6 1Z"/></svg>`;
}

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
