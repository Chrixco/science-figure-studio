import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getExcelSheetNames,
  getExcelColumnHeaders,
  parseBaubleExcelFile,
} from './baubleExcelParser';

function fixture(name: string): File {
  const bytes = readFileSync(`public/data/${name}`);
  return new File([new Uint8Array(bytes)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// These are the workbooks the app loads on startup, so a parser regression here
// breaks the default view.
const DEFAULTS = [
  'actors.xlsx',
  'city.xlsx',
  'nature.xlsx',
  'actors_members.xlsx',
  'city_districts.xlsx',
  'nature_animals.xlsx',
];

describe.each(DEFAULTS)('%s', (name) => {
  it('exposes at least one sheet', async () => {
    expect((await getExcelSheetNames(fixture(name))).length).toBeGreaterThan(0);
  });

  it('exposes column headers', async () => {
    expect((await getExcelColumnHeaders(fixture(name))).length).toBeGreaterThan(0);
  });

  it('parses into a mother label and child names', async () => {
    const parsed = await parseBaubleExcelFile(fixture(name));
    expect(parsed).not.toBeNull();

    const { result, errors } = parsed!;
    expect(errors).toEqual([]);
    expect(result.motherLabel).toBe(name.replace(/\.xlsx$/, ''));
    expect(result.childNames.length).toBeGreaterThan(0);
    // Every child is a non-empty trimmed string.
    for (const child of result.childNames) {
      expect(typeof child).toBe('string');
      expect(child).toBe(child.trim());
      expect(child.length).toBeGreaterThan(0);
    }
  });

  it('issues a distinct file id each time', async () => {
    const a = await parseBaubleExcelFile(fixture(name));
    const b = await parseBaubleExcelFile(fixture(name));
    expect(a!.result.fileId).not.toBe(b!.result.fileId);
  });
});

describe('parseBaubleExcelFile options', () => {
  it('honours a mother label override', async () => {
    const parsed = await parseBaubleExcelFile(fixture('actors.xlsx'), undefined, undefined, 'Actors');
    expect(parsed!.result.motherLabel).toBe('Actors');
  });

  it('reports a column that does not exist', async () => {
    const parsed = await parseBaubleExcelFile(fixture('actors.xlsx'), undefined, 'NoSuchColumn');
    expect(parsed!.errors.join(' ')).toContain('NoSuchColumn');
    expect(parsed!.result.childNames).toEqual([]);
  });

  it('returns null for a file that is not a workbook', async () => {
    const junk = new File([new Uint8Array([9, 9, 9])], 'junk.xlsx');
    await expect(parseBaubleExcelFile(junk)).resolves.toBeNull();
  });
});
