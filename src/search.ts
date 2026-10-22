import { searchPlaces, type Place } from './api';
import { load, save } from './storage';
import { escapeHtml } from './ui';

const RECENT_KEY = 'vento.recent';

/** Place search in a modal dialog, with recent places and a shortcut back to GPS. */
export class Search {
  private readonly dialog: HTMLDialogElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private readonly status: HTMLElement;
  private results: Place[] = [];
  private timer = 0;
  private ctrl: AbortController | null = null;
  /** Query the current results belong to. */
  private resultsFor = '';

  constructor(
    dialog: HTMLDialogElement,
    private readonly onPick: (place: Place | 'gps') => void,
  ) {
    this.dialog = dialog;
    this.input = dialog.querySelector('input')!;
    this.list = dialog.querySelector('.results')!;
    this.status = dialog.querySelector('.search-status')!;

    this.input.addEventListener('input', () => {
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.run(this.input.value.trim()), 280);
    });
    dialog.querySelector('form')!.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearTimeout(this.timer);
      const q = this.input.value.trim();
      if (q.length >= 2 && q !== this.resultsFor) await this.run(q);
      if (this.results[0] && q === this.input.value.trim()) this.pick(this.results[0]);
    });
    dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-gps]')!.addEventListener('click', () => {
      dialog.close();
      onPick('gps');
    });
    this.list.addEventListener('click', (e) => {
      const li = (e.target as Element).closest<HTMLElement>('[data-i]');
      if (li) this.pick(this.results[Number(li.dataset.i)]);
    });
    // Close when tapping the backdrop, but not when a text selection drag ends there.
    let downOnBackdrop = false;
    dialog.addEventListener('pointerdown', (e) => (downOnBackdrop = e.target === dialog));
    dialog.addEventListener('click', (e) => downOnBackdrop && e.target === dialog && dialog.close());
  }

  open(): void {
    clearTimeout(this.timer);
    this.ctrl?.abort();
    this.input.value = '';
    this.showRecent();
    this.dialog.showModal();
    this.input.focus();
  }

  private showRecent(): void {
    this.results = load<Place[]>(RECENT_KEY) ?? [];
    this.resultsFor = '';
    this.status.textContent = this.results.length ? 'Cercati di recente' : '';
    this.drawList();
  }

  private async run(q: string): Promise<void> {
    this.ctrl?.abort();
    if (q.length < 2) return this.showRecent();
    this.ctrl = new AbortController();
    this.status.textContent = 'Cerco…';
    try {
      const found = await searchPlaces(q, this.ctrl.signal);
      if (q !== this.input.value.trim()) return; // input changed meanwhile
      this.results = found;
      this.resultsFor = q;
      this.status.textContent = this.results.length ? '' : `Nessun posto trovato per "${q}". Prova con il nome del comune più vicino.`;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      this.results = [];
      this.status.textContent = 'Ricerca non disponibile senza connessione.';
    }
    this.drawList();
  }

  private drawList(): void {
    this.list.innerHTML = this.results
      .map(
        (p, i) => `<li><button type="button" data-i="${i}">
          <span class="r-name">${escapeHtml(p.name)}</span>
          ${p.detail ? `<span class="r-detail">${escapeHtml(p.detail)}</span>` : ''}
        </button></li>`,
      )
      .join('');
  }

  private pick(place: Place): void {
    const recent = (load<Place[]>(RECENT_KEY) ?? []).filter((p) => p.name !== place.name || p.detail !== place.detail);
    save(RECENT_KEY, [place, ...recent].slice(0, 6));
    this.dialog.close();
    this.onPick(place);
  }
}
