import * as XLSX from 'xlsx';
import { LoadedBaubleFile } from '../types/bauble';

/**
 * Get list of sheet names from an Excel file
 */
export async function getExcelSheetNames(file: File): Promise<string[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    return workbook.SheetNames || [];
  } catch (error) {
    return [];
  }
}

/**
 * Get column headers from a specific sheet in an Excel file
 */
export async function getExcelColumnHeaders(file: File, sheetName?: string): Promise<string[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return [];
    }

    const targetSheetName = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];

    const sheet = workbook.Sheets[targetSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    if (rows.length === 0) {
      return [];
    }

    return Object.keys(rows[0]);
  } catch (error) {
    return [];
  }
}

/**
 * Parse an Excel file and extract a Mother label (from filename or override)
 * plus child names from the specified column.
 * Returns null on unrecoverable error.
 */
export async function parseBaubleExcelFile(
  file: File,
  sheetName?: string,
  columnName?: string,
  motherLabelOverride?: string
): Promise<{ result: LoadedBaubleFile; errors: string[] } | null> {
  const errors: string[] = [];

  try {
    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      errors.push('Excel file has no sheets');
      return null;
    }

    // Use specified sheet or default to first sheet
    const targetSheetName = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];
    const sheet = workbook.Sheets[targetSheetName];

    // Convert to JSON rows
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    if (!rows || rows.length === 0) {
      errors.push('Excel sheet is empty');
    }

    // Find the specified column or search for "Name" column (case-insensitive)
    let nameColumnKey: string | null = null;
    if (rows.length > 0) {
      const firstRow = rows[0];

      if (columnName) {
        // Use the specified column name
        if (Object.keys(firstRow).includes(columnName)) {
          nameColumnKey = columnName;
        } else {
          errors.push(`Column "${columnName}" not found in Excel file`);
        }
      } else {
        // Search for "Name" column (case-insensitive)
        for (const key of Object.keys(firstRow)) {
          if (key.trim().toLowerCase() === 'name') {
            nameColumnKey = key;
            break;
          }
        }

        if (!nameColumnKey) {
          errors.push('No "Name" column found in Excel file');
        }
      }
    }

    // Extract child names
    const childNames: string[] = [];
    if (nameColumnKey) {
      for (const row of rows) {
        const value = row[nameColumnKey];
        if (value !== null && value !== undefined && value !== '') {
          const str = String(value).trim();
          if (str) {
            childNames.push(str);
          }
        }
      }
    }

    // Use override label if provided, otherwise derive from filename (strip extension)
    const motherLabel = motherLabelOverride || file.name.replace(/\.[^.]+$/, '');

    // Generate fileId
    const fileId = Math.random().toString(36).substring(2, 11);

    const result: LoadedBaubleFile = {
      fileId,
      fileName: file.name,
      motherLabel,
      childNames,
    };

    return { result, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to parse file: ${errorMsg}`);
    return null;
  }
}
