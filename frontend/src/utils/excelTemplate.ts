import { writeSheet } from './excelIO';
import { FUNCTION_TYPES } from '../types';

type Row = (string | number | boolean | null)[];

/**
 * Starter workbook with just the required columns.
 */
export async function generateSimpleTemplate(): Promise<Uint8Array> {
  const rows: Row[] = [
    ['x', 'y', 'label'],
    [0.2, 0.3, 'Cell 1'],
    [0.5, 0.5, 'Cell 2'],
    [0.8, 0.7, 'Cell 3'],
  ];

  return writeSheet(rows, {
    sheetName: 'Network',
    columnWidths: [12, 12, 20],
  });
}

/**
 * Full workbook exposing per-function visibility, weight and label columns.
 */
export async function generateDetailedTemplate(): Promise<Uint8Array> {
  const headers: Row = ['x', 'y', 'label'];
  for (const fn of FUNCTION_TYPES) {
    headers.push(`${fn}_visible`, `${fn}_weight`, `${fn}_label`);
  }

  // Three example cells: defaults, a varied one, and defaults again -- enough to
  // show the column pattern without implying the values matter.
  const buildRow = (
    x: number,
    y: number,
    label: string,
    vary = false
  ): Row => {
    const row: Row = [x, y, label];
    for (const fn of FUNCTION_TYPES) {
      const weight = vary ? (fn === 'water' ? 1.5 : fn === 'education' ? 0.7 : 1.0) : 1.0;
      // Booleans rather than the strings 'TRUE'/'FALSE' so the cells arrive as
      // real booleans; the importer accepts either.
      row.push(vary ? fn !== 'pollution' : true, weight, fn);
    }
    return row;
  };

  const rows: Row[] = [
    headers,
    buildRow(0.2, 0.3, 'Cell 1'),
    buildRow(0.5, 0.5, 'Cell 2', true),
    buildRow(0.8, 0.7, 'Cell 3'),
  ];

  const columnWidths = [12, 12, 20];
  for (let i = 0; i < FUNCTION_TYPES.length; i++) {
    columnWidths.push(14, 12, 12);
  }

  return writeSheet(rows, { sheetName: 'Network', columnWidths });
}

/**
 * Build a template and hand it to the browser as a download.
 */
export async function downloadTemplate(type: 'simple' | 'detailed'): Promise<void> {
  const bytes = type === 'simple' ? await generateSimpleTemplate() : await generateDetailedTemplate();

  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `circle-network-template-${type}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
