import { describe, expect, it } from 'vitest';
import { rainLabel, rainShort } from './rain';

describe('rainLabel', () => {
  it.each([
    [0, 10, 'Niente pioggia'],
    [0.05, 20, 'Niente pioggia'],
    [0, 30, 'Pioggia possibile, 30%'],
    [0, 64.6, 'Pioggia possibile, 65%'],
    [0.1, 20, 'Pioggia debole, 0,1 mm'],
    [0.44, 60, 'Pioggia debole, 0,4 mm'],
    [2.5, 80, 'Pioggia moderata, 2,5 mm'],
    [3, 90, 'Pioggia moderata, 3 mm'],
    [7.6, 90, 'Pioggia forte, 7,6 mm'],
    [12.34, 95, 'Pioggia forte, 12 mm'],
  ])('%f mm, chance %f → %s', (rain, rainChance, label) => {
    expect(rainLabel({ rain, rainChance })).toBe(label);
  });
});

describe('rainShort', () => {
  it('says nothing when it stays dry', () => {
    expect(rainShort({ rain: 0.05, rainChance: 29 })).toBeNull();
  });

  it('gives the chance when rain is only possible', () => {
    expect(rainShort({ rain: 0, rainChance: 40 })).toBe('40%');
  });

  it('gives the amount when rain is expected', () => {
    expect(rainShort({ rain: 1.62, rainChance: 20 })).toBe('1,6 mm');
  });
});
