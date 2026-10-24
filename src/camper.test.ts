import { describe, expect, it } from 'vitest';
import { camperTips, type Tip } from './camper';
import type { HourPoint } from './forecast';
import type { SeaPoint } from './marine';

const hours = (speed: number, gust: number, dir = 315): HourPoint[] =>
  Array.from({ length: 13 }, (_, i) => ({ time: `2026-10-24T${String(11 + i).padStart(2, '0')}:00`, speed, gust, dir, rain: 0, rainChance: 0 }));

const tips = (speed: number, gust: number, sea: SeaPoint | null = null, dir = 315) => {
  const h = hours(speed, gust, dir);
  return Object.fromEntries(camperTips(h[0], h, 'kmh', sea).map((t) => [t.id, t])) as Record<Tip['id'], Tip>;
};

const sea = (height: number): SeaPoint => ({
  time: '2026-10-24T11:00',
  height,
  dir: 315,
  period: 5,
  windWave: height,
  windWaveDir: 315,
  swell: 0,
  swellDir: null,
  swellPeriod: null,
});

describe('camperTips', () => {
  it('keeps quiet days quiet', () => {
    const t = tips(8, 14);
    expect(Object.values(t).every((x) => x.level === 'ok')).toBe(true);
    expect(t.foto.text).toContain('buone anche per il drone');
  });

  it('scales driving advice with the gusts', () => {
    expect(tips(20, 35).guida.level).toBe('ok');
    expect(tips(25, 45).guida).toMatchObject({ level: 'attenzione', short: 'attenzione alle raffiche laterali' });
    expect(tips(40, 65).guida.level).toBe('pericolo');
    expect(tips(55, 85).guida.short).toBe('meglio non viaggiare');
  });

  it('points the nose into the wind and keeps away from trees in strong gusts', () => {
    const t = tips(40, 65);
    expect(t.sosta.text).toContain('muso verso nord-ovest');
    expect(t.alberi.level).toBe('pericolo');
  });

  it('warns about the beach before it is dangerous elsewhere', () => {
    expect(tips(22, 30).spiaggia.level).toBe('attenzione');
    expect(tips(22, 30).guida.level).toBe('ok');
  });

  it('adds offshore-wind advice for inflatables', () => {
    expect(tips(18, 25).spiaggia.text).toContain('SUP');
    expect(tips(8, 12).spiaggia.text).not.toContain('SUP');
  });

  it('uses the sea data when there is some', () => {
    expect(tips(10, 15, sea(1.8)).spiaggia).toMatchObject({ level: 'pericolo', short: 'mare molto mosso' });
    expect(tips(10, 15, sea(0.8)).spiaggia.level).toBe('attenzione');
    expect(tips(10, 15, sea(0.3)).spiaggia.level).toBe('ok');
  });

  it('grounds the drone in strong gusts and notes clear air with the maestrale', () => {
    const t = tips(25, 42);
    expect(t.foto).toMatchObject({ level: 'attenzione', short: 'drone sconsigliato' });
    expect(t.foto.text).toContain('aria è spesso tersa');
    expect(tips(25, 42, null, 135).foto.text).not.toContain('tersa');
  });

  it('speaks the chosen unit', () => {
    const h = hours(25, 45);
    const guida = camperTips(h[0], h, 'kn').find((t) => t.id === 'guida')!;
    expect(guida.text).toContain('24 nodi');
  });
});

describe('in Iceland', () => {
  const iceland = (speed: number, gust: number, feels?: number) => {
    const h = hours(speed, gust).map((p) => ({ ...p, ...(feels != null && { temp: feels + 5, feels }) }));
    return Object.fromEntries(camperTips(h[0], h, 'kmh', null, 'islanda').map((t) => [t.id, t])) as Partial<Record<Tip['id'], Tip>>;
  };

  it('warns about doors torn by the wind', () => {
    expect(iceland(25, 40).portiere).toMatchObject({ level: 'attenzione' });
    expect(iceland(40, 60).portiere?.level).toBe('pericolo');
    expect(iceland(10, 20).portiere).toBeUndefined();
    expect(tips(25, 40).portiere).toBeUndefined(); // not a thing in Sardinia
  });

  it('points to the measured road gusts', () => {
    expect(iceland(10, 20).guida!.text).toContain('umferdin.is');
    expect(iceland(40, 60).guida!.text).toContain('sabbia e ghiaia');
  });

  it('talks about sneaker waves, not umbrellas', () => {
    const beach = iceland(10, 15).spiaggia!;
    expect(beach.text).toContain('Reynisfjara');
    expect(beach.text).not.toContain('ombrellone');
    expect(beach.level).toBe('attenzione');
  });

  it('adds wind chill when it bites, anywhere', () => {
    expect(iceland(30, 45, -4).freddo).toMatchObject({ level: 'attenzione', short: 'percepiti -4°' });
    expect(iceland(30, 45, -12).freddo?.level).toBe('pericolo');
    expect(iceland(30, 45, 6).freddo).toBeUndefined();
  });
});
