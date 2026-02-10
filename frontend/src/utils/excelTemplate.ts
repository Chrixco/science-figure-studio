import * as XLSX from 'xlsx';
import { FUNCTION_TYPES } from '../types';

/**
 * Generate a simple Excel template for network import
 * Columns: x, y, label
 */
export function generateSimpleTemplate(): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['x', 'y', 'label'],
    [0.2, 0.3, 'Cell 1'],
    [0.5, 0.5, 'Cell 2'],
    [0.8, 0.7, 'Cell 3']
  ]);

  // Format header row
  const headerStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: 'FFCCCCCC' } }
  };

  // Apply header styling
  worksheet['A1'].s = headerStyle;
  worksheet['B1'].s = headerStyle;
  worksheet['C1'].s = headerStyle;

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 20 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Network');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

/**
 * Generate a detailed Excel template with function visibility, weights, and labels
 * Columns: x, y, label, + (for each function: visible, weight, label)
 */
export function generateDetailedTemplate(): ArrayBuffer {
  // Build header row
  const headers = ['x', 'y', 'label'];

  for (const fn of FUNCTION_TYPES) {
    headers.push(`${fn}_visible`);
    headers.push(`${fn}_weight`);
    headers.push(`${fn}_label`);
  }

  // Build example data row
  const exampleRow = [0.2, 0.3, 'Cell 1'];

  for (const fn of FUNCTION_TYPES) {
    exampleRow.push('TRUE');
    exampleRow.push(1.0);
    exampleRow.push(fn);
  }

  // Build second example row with variations
  const exampleRow2 = [0.5, 0.5, 'Cell 2'];

  for (const fn of FUNCTION_TYPES) {
    const weight = fn === 'water' ? 1.5 : fn === 'education' ? 0.7 : 1.0;
    exampleRow2.push(fn !== 'pollution' ? 'TRUE' : 'FALSE');
    exampleRow2.push(weight);
    exampleRow2.push(fn);
  }

  // Build third example row
  const exampleRow3 = [0.8, 0.7, 'Cell 3'];

  for (const fn of FUNCTION_TYPES) {
    exampleRow3.push('TRUE');
    exampleRow3.push(1.0);
    exampleRow3.push(fn);
  }

  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    exampleRow,
    exampleRow2,
    exampleRow3
  ]);

  // Format header row
  const headerStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: 'FFCCCCCC' } }
  };

  // Apply header styling to all header columns
  for (let i = 0; i < headers.length; i++) {
    const cellRef = XLSX.utils.encode_col(i) + '1';
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = headerStyle;
    }
  }

  // Set column widths
  const colWidths = [];
  colWidths.push({ wch: 12 }, { wch: 12 }, { wch: 20 }); // x, y, label
  for (let i = 0; i < FUNCTION_TYPES.length; i++) {
    colWidths.push({ wch: 14 }, { wch: 12 }, { wch: 12 }); // visible, weight, label
  }
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Network');

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

/**
 * Download a template file
 */
export function downloadTemplate(type: 'simple' | 'detailed'): void {
  const buffer = type === 'simple' ? generateSimpleTemplate() : generateDetailedTemplate();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `circle-network-template-${type}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
