import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readSheetNames, readSheetRows, readColumnHeaders, writeSheet } from './excelIO';

/** Wrap bytes on disk in a File, the way the UI hands them to the parsers. */
function fileFrom(path: string, name: string): File {
  const bytes = readFileSync(path);
  return new File([new Uint8Array(bytes)], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Round-trip bytes produced by writeSheet back through the reader. */
function fileFromBytes(bytes: Uint8Array, name = 'generated.xlsx'): File {
  return new File([bytes as BlobPart], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const FIXTURE = 'public/data/actors.xlsx';

describe('reading real workbooks', () => {
  it('lists sheet names', async () => {
    const names = await readSheetNames(fileFrom(FIXTURE, 'actors.xlsx'));
    expect(names.length).toBeGreaterThan(0);
  });

  it('reads rows keyed by header', async () => {
    const rows = await readSheetRows(fileFrom(FIXTURE, 'actors.xlsx'));
    expect(rows.length).toBeGreaterThan(0);

    const headers = Object.keys(rows[0]);
    expect(headers.length).toBeGreaterThan(0);
    // Every row exposes the same keys as the header row.
    for (const row of rows) {
      expect(Object.keys(row)).toEqual(headers);
    }
  });

  it('returns primitives, never ExcelJS cell objects', async () => {
    const rows = await readSheetRows(fileFrom(FIXTURE, 'actors.xlsx'));
    for (const row of rows) {
      for (const value of Object.values(row)) {
        expect(['string', 'number', 'boolean', 'object']).toContain(typeof value);
        if (typeof value === 'object') expect(value).toBeNull();
        // The bug this guards: rich text / formula cells stringifying to junk.
        expect(String(value)).not.toBe('[object Object]');
      }
    }
  });

  it('agrees with readColumnHeaders', async () => {
    const file = fileFrom(FIXTURE, 'actors.xlsx');
    const rows = await readSheetRows(file);
    const headers = await readColumnHeaders(fileFrom(FIXTURE, 'actors.xlsx'));
    expect(headers).toEqual(Object.keys(rows[0]));
  });

  it('reports no sheets for a file that is not a workbook', async () => {
    const junk = new File([new Uint8Array([1, 2, 3, 4])], 'junk.xlsx');
    await expect(readSheetNames(junk)).resolves.toEqual([]);
  });
});

describe('writeSheet round-trip', () => {
  it('reads back exactly what was written', async () => {
    const bytes = await writeSheet(
      [
        ['x', 'y', 'label'],
        [0.2, 0.3, 'Cell 1'],
        [0.5, 0.5, 'Cell 2'],
      ],
      { sheetName: 'Network', columnWidths: [12, 12, 20] }
    );

    const rows = await readSheetRows(fileFromBytes(bytes));
    expect(rows).toEqual([
      { x: 0.2, y: 0.3, label: 'Cell 1' },
      { x: 0.5, y: 0.5, label: 'Cell 2' },
    ]);
  });

  it('preserves the sheet name', async () => {
    const bytes = await writeSheet([['a'], [1]], { sheetName: 'Network' });
    await expect(readSheetNames(fileFromBytes(bytes))).resolves.toContain('Network');
  });

  it('round-trips booleans as booleans', async () => {
    const bytes = await writeSheet(
      [
        ['water_visible', 'water_weight'],
        [true, 1.5],
        [false, 0.7],
      ],
      { sheetName: 'Network' }
    );

    const rows = await readSheetRows(fileFromBytes(bytes));
    expect(rows[0].water_visible).toBe(true);
    expect(rows[1].water_visible).toBe(false);
    expect(rows[0].water_weight).toBe(1.5);
  });

  it('disambiguates duplicate headers instead of dropping a column', async () => {
    const bytes = await writeSheet(
      [
        ['name', 'name'],
        ['first', 'second'],
      ],
      { sheetName: 'Dupes' }
    );

    const rows = await readSheetRows(fileFromBytes(bytes));
    expect(rows[0]).toEqual({ name: 'first', name_2: 'second' });
  });
});
