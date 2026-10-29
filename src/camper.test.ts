import { describe, expect, it } from 'vitest';
import { auroraTip, camperTips, roadTip, type Tip } from './camper';
import type { HourPoint, Sun } from './forecast';
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

/** Hourly points from 11:00 with temperature, rain mm, snow cm and sky per hour. */
const weather = (spec: { temp: number; rain?: number; snow?: number; cloud?: number; isDay?: boolean }[]): HourPoint[] =>
  spec.map((w, i) => ({
    time: `2026-10-24T${String((11 + i) % 24).padStart(2, '0')}:00`,
    speed: 15,
    gust: 25,
    dir: 270,
    rain: w.rain ?? 0,
    rainChance: w.rain ? 80 : 0,
    temp: w.temp,
    feels: w.temp,
    ...(w.snow != null && { snow: w.snow }),
    ...(w.cloud != null && { cloud: w.cloud }),
    ...(w.isDay != null && { isDay: w.isDay }),
  }));

describe('roadTip', () => {
  const flat = (temp: number, extra: Partial<{ rain: number; snow: number }> = {}) => weather(Array.from({ length: 13 }, () => ({ temp, ...extra })));

  it('stays quiet well above freezing', () => {
    expect(roadTip(flat(6))).toBeNull();
  });

  it('warns about black ice near freezing even without rain', () => {
    expect(roadTip(flat(1.5))).toMatchObject({ level: 'attenzione', short: 'possibile ghiaccio' });
    expect(roadTip(flat(1.5))!.text).toContain('anche con l’aria sopra lo zero');
    expect(roadTip(flat(-3))!.text).not.toContain('sopra lo zero');
  });

  it('calls rain below freezing a danger', () => {
    const t = roadTip(weather([{ temp: 0.5 }, { temp: -0.5, rain: 1, snow: 0 }, { temp: -0.5 }]))!;
    expect(t).toMatchObject({ level: 'pericolo', short: 'pioggia che gela' });
    expect(t.text).toContain('dalle 12');
  });

  it('counts the snow of the next hours', () => {
    expect(roadTip(flat(-2, { rain: 0.2, snow: 0.14 }))).toMatchObject({ level: 'attenzione', short: 'neve, 1,8 cm' });
    expect(roadTip(flat(-2, { rain: 1, snow: 0.7 }))).toMatchObject({ level: 'pericolo', short: 'fino a 9,1 cm di neve' });
  });

  it('sees wet roads freezing after the rain', () => {
    const t = roadTip(weather([{ temp: 3, rain: 1, snow: 0 }, { temp: 2 }, { temp: 1 }, { temp: -1 }]))!;
    expect(t.short).toBe('strade bagnate che gelano');
    expect(t.text).toContain('verso le 14');
  });

  it('adds winter tyres and road services in the Nordics', () => {
    expect(roadTip(flat(-2), true)!.text).toContain('gomme invernali');
    expect(roadTip(flat(-2), true)!.text).toContain('vegvesen.no/trafikk');
    expect(roadTip(flat(-2))!.text).not.toContain('vegvesen');
  });

  it('needs temperatures to say anything', () => {
    expect(roadTip(hours(10, 15))).toBeNull();
  });
});

describe('auroraTip', () => {
  const night = (clouds: number[]) => weather([{ temp: -5, cloud: 40, isDay: true }, ...clouds.map((cloud) => ({ temp: -5, cloud, isDay: false }))]);

  it('reads the sky of the first dark hours', () => {
    const t = auroraTip(night([10, 5, 20, 0, 80]))!;
    expect(t.short).toBe('cielo sereno stanotte');
    expect(t.text).toContain('tra le 12 e le 16');
    expect(t.text).toMatch(/^Da stasera/);
    expect(t.text).toContain('spaceweather.gov');
  });

  it('points to the clear spells under a broken sky', () => {
    expect(auroraTip(night([90, 90, 20, 90, 90]))).toMatchObject({ short: 'qualche schiarita stanotte' });
  });

  it('says when the sky stays closed', () => {
    expect(auroraTip(night([90, 100, 95]))).toMatchObject({ short: 'cielo coperto stanotte' });
  });

  it('calls dark hours from the evening on tonight', () => {
    const late = weather(Array.from({ length: 6 }, () => ({ temp: -5, cloud: 0, isDay: false }))).map((h, i) => ({ ...h, time: `2026-10-24T${20 + i < 24 ? 20 + i : `0${i - 4}`}:00` }));
    expect(auroraTip(late)!.text).toMatch(/^Stanotte/);
  });

  it('has nothing to say under the midnight sun or without sky data', () => {
    expect(auroraTip(weather([{ temp: 10, cloud: 0, isDay: true }, { temp: 10, cloud: 0, isDay: true }]))).toBeNull();
    expect(auroraTip(hours(10, 15))).toBeNull();
  });
});

describe('in Norway, Sweden and Finland', () => {
  const nordic = (speed: number, gust: number, temp: number, sun: Sun | null = null) => {
    const h = hours(speed, gust).map((p) => ({ ...p, temp, feels: temp - 4 }));
    return Object.fromEntries(camperTips(h[0], h, 'kmh', null, 'nordici', sun).map((t) => [t.id, t])) as Partial<Record<Tip['id'], Tip>>;
  };
  const short: Sun = { rise: '2026-11-10T09:30', set: '2026-11-10T13:50', daylight: 4 * 3600 + 20 * 60 };

  it('points to convoys, closures and bridges in strong gusts', () => {
    expect(nordic(30, 50, 0).guida!.text).toContain('kolonnekjøring');
    expect(nordic(15, 25, 0).guida!.text).not.toContain('kolonnekjøring');
  });

  it('leaves the beach out in the cold', () => {
    expect(nordic(15, 25, 2).spiaggia).toBeUndefined();
    expect(nordic(15, 25, 20).spiaggia).toBeDefined();
  });

  it('warns about butane and frozen water below zero', () => {
    const t = nordic(10, 15, -3).freddo!;
    expect(t.text).toContain('propano');
    expect(t.text).toContain('tubi dell’acqua');
    expect(nordic(10, 15, 8).freddo).toBeUndefined();
  });

  it('plans the day around the hours of light', () => {
    expect(nordic(10, 15, -3, short).luce).toMatchObject({ short: '4 h 20 min di luce' });
    expect(nordic(10, 15, -3, short).luce!.text).toContain('alci');
    expect(nordic(10, 15, -3, { rise: '2026-12-10T00:00', set: '2026-12-10T00:00', daylight: 0 }).luce).toMatchObject({ short: 'notte polare' });
    expect(nordic(10, 15, -3, { ...short, daylight: 10 * 3600 }).luce).toBeUndefined();
  });

  it('keeps Sardinia free of Arctic advice', () => {
    const h = hours(10, 15).map((p) => ({ ...p, temp: 15, feels: 15, cloud: 0, isDay: false }));
    const ids = camperTips(h[0], h, 'kmh', null, 'sardegna', short).map((t) => t.id);
    expect(ids).not.toContain('luce');
    expect(ids).not.toContain('aurora');
    expect(ids).not.toContain('strada');
  });
});
