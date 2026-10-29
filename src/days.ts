import { GUST_DANGER, GUST_WARN } from './alerts';
import type { DaySummary } from './forecast';
import { dayLabel, hourLabel } from './format';
import { mmLabel, precipKind, RAIN_MIN, RAIN_POSSIBLE, rainShort } from './rain';
import { needleIcon, precipIcon } from './ui';
import { convertSpeed, UNIT_LABEL, windFrom, type SpeedUnit } from './wind';

/** One row per day; tapping a row opens its 3-hourly breakdown. */
export class DayList {
  private readonly open = new Set<string>();
  private days: DaySummary[] = [];
  private today = '';
  private unit: SpeedUnit = 'kmh';

  constructor(private readonly root: HTMLElement) {
    root.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-date]');
      if (!btn) return;
      const date = btn.dataset.date!;
      if (this.open.has(date)) this.open.delete(date);
      else this.open.add(date);
      this.draw();
      root.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)?.focus();
    });
  }

  render(days: DaySummary[], today: string, unit: SpeedUnit): void {
    this.days = days;
    this.today = today;
    this.unit = unit;
    this.draw();
  }

  private draw(): void {
    const u = this.unit;
    this.root.innerHTML = this.days
      .map((d) => {
        const w = windFrom(d.dominantDir);
        const isOpen = this.open.has(d.date);
        const level = d.maxGust >= GUST_DANGER ? 'danger' : d.maxGust >= GUST_WARN ? 'warn' : '';
        // Snow in cm when it is most of the day's water; sleet and rain in mm.
        const snowy = precipKind(d) === 'neve';
        const amount = snowy ? `${mmLabel(d.snow)} cm` : `${mmLabel(d.rain)} mm`;
        const rain =
          d.rainChance >= RAIN_POSSIBLE
            ? `${precipIcon(snowy, 11, snowy ? 'neve' : 'pioggia')}<b>${Math.round(d.rainChance)}%</b>${d.rain >= RAIN_MIN ? `<small>${amount}</small>` : ''}`
            : '';
        const slots = d.slots
          .map(
            (s) => `<li>
              <span class="slot-h">${hourLabel(s.time)}</span>
              ${needleIcon(s.dir, windFrom(s.dir).warm, 16)}
              <b>${convertSpeed(s.speed, u)}</b>
              <span class="slot-g">${convertSpeed(s.gust, u)}</span>
              <span class="slot-r${precipKind(s) === 'neve' ? ' snow' : ''}">${rainShort(s) ?? ''}</span>
            </li>`,
          )
          .join('');
        return `<div class="day${isOpen ? ' open' : ''}">
          <button type="button" data-date="${d.date}" aria-expanded="${isOpen}" aria-controls="slots-${d.date}">
            <span class="day-label">${dayLabel(d.date, this.today)}</span>
            <span class="day-wind ${w.warm ? 'warm' : 'cold'}">${needleIcon(d.dominantDir, w.warm, 18)}<em>${w.name}</em></span>
            <span class="day-rain">${rain}</span>
            <span class="day-val">
              <b>${convertSpeed(d.maxSpeed, u)}</b> ${UNIT_LABEL[u]}
              <small class="${level}">${level ? '<i class="dot"></i>' : ''}raffiche ${convertSpeed(d.maxGust, u)}</small>
            </span>
            <svg class="chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
          <ul class="slots" id="slots-${d.date}" ${isOpen ? '' : 'hidden'} aria-label="Ogni 3 ore, media e raffiche in ${UNIT_LABEL[u]}, pioggia o neve nelle tre ore">${slots}</ul>
        </div>`;
      })
      .join('');
  }
}
