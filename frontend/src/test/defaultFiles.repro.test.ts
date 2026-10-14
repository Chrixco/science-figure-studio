import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBaubleExcelFile } from '../utils/baubleExcelParser';
import { useBaubleStore } from '../hooks/useBaubleStore';

const FILES = [
  'actors.xlsx',
  'city.xlsx',
  'nature.xlsx',
  'actors_members.xlsx',
  'city_districts.xlsx',
  'nature_animals.xlsx',
];

function fixture(name: string): File {
  return new File([new Uint8Array(readFileSync(`public/data/${name}`))], name);
}

describe('default bauble file bootstrap', () => {
  it('parses all six default files', async () => {
    const t0 = performance.now();
    const parsed = [];
    for (const name of FILES) {
      const r = await parseBaubleExcelFile(fixture(name));
      expect(r).not.toBeNull();
      parsed.push(r!.result);
    }
    const elapsed = performance.now() - t0;
    expect(parsed).toHaveLength(6);
    expect(elapsed).toBeLessThan(5000);
  }, 20000);

  it('feeds them into the store without hanging', async () => {
    const parsed = [];
    for (const name of FILES) {
      parsed.push((await parseBaubleExcelFile(fixture(name)))!.result);
    }

    const t0 = performance.now();
    for (const file of parsed) {
      useBaubleStore.getState().addFile(file);
    }
    const elapsed = performance.now() - t0;

    expect(useBaubleStore.getState().files).toHaveLength(6);
    expect(elapsed).toBeLessThan(5000);
  }, 20000);
});
