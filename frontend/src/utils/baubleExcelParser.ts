import { readSheetNames, readColumnHeaders, readSheetRows } from './excelIO';
import { LoadedBaubleFile } from '../types/bauble';

/**
 * Get list of sheet names from an Excel file
 */
export async function getExcelSheetNames(file: File): Promise<string[]> {
  return readSheetNames(file);
}

/**
 * Get column headers from a specific sheet in an Excel file
 */
export async function getExcelColumnHeaders(file: File, sheetName?: string): Promise<string[]> {
  return readColumnHeaders(file, sheetName);
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
    const sheetNames = await getExcelSheetNames(file);
    if (sheetNames.length === 0) {
      errors.push('Excel file has no sheets');
      return null;
    }

    // readSheetRows falls back to the first sheet when the name is unknown.
    const rows = await readSheetRows(file, sheetName);

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

    const fileId = crypto.randomUUID();

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
