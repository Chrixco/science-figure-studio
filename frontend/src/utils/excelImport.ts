import * as XLSX from 'xlsx';
import { Cell, NetworkConfig, FUNCTION_TYPES, DEFAULT_CONFIG } from '../types';
import { createCell, CANVAS_SCALE } from './geometry';

/**
 * Result of parsing an Excel file
 */
export interface ExcelParseResult {
  cells: Cell[];
  config?: Partial<NetworkConfig>;
  errors: string[];
}

/**
 * Parse an Excel file and extract network data
 */
export async function parseExcelFile(
  file: File,
  baseConfig: NetworkConfig = DEFAULT_CONFIG
): Promise<ExcelParseResult> {
  const errors: string[] = [];
  const cells: Cell[] = [];

  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse workbook
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      errors.push('No sheets found in Excel file');
      return { cells, errors };
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(data) || data.length === 0) {
      errors.push('No data found in sheet');
      return { cells, errors };
    }

    // Check required columns
    const firstRow = data[0] as Record<string, unknown>;
    const hasX = 'x' in firstRow;
    const hasY = 'y' in firstRow;
    const hasLabel = 'label' in firstRow;

    if (!hasX || !hasY) {
      errors.push('Missing required columns: x and y (coordinates in 0-1 range)');
      return { cells, errors };
    }

    // Create scaled config for cell creation
    const scaledConfig: NetworkConfig = {
      ...baseConfig,
      livingRadius: baseConfig.livingRadius * CANVAS_SCALE,
      functionRadius: baseConfig.functionRadius * CANVAS_SCALE
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as Record<string, unknown>;
      const rowNum = i + 2; // +1 for header, +1 for 1-based indexing

      // Skip empty rows
      if (!row.x && !row.y && !row.label) {
        continue;
      }

      // Validate coordinates
      const xVal = parseFloat(String(row.x || ''));
      const yVal = parseFloat(String(row.y || ''));

      if (isNaN(xVal) || isNaN(yVal)) {
        errors.push(`Row ${rowNum}: x and y must be numbers`);
        continue;
      }

      if (xVal < 0 || xVal > 1 || yVal < 0 || yVal > 1) {
        errors.push(
          `Row ${rowNum}: coordinates must be between 0 and 1 (got x=${xVal}, y=${yVal})`
        );
        continue;
      }

      // Scale coordinates to canvas space
      const position = {
        x: xVal * CANVAS_SCALE,
        y: yVal * CANVAS_SCALE
      };

      // Create base cell
      const cell = createCell(position, scaledConfig, cells.length);

      // Apply label if present
      if (hasLabel && row.label) {
        cell.label = String(row.label).trim();
      }

      // Check for function-specific columns and apply them
      const updatedConfig = { ...scaledConfig };
      let configChanged = false;

      for (const fn of FUNCTION_TYPES) {
        // Check visibility column
        const visibleKey = `${fn}_visible`;
        if (visibleKey in row) {
          const visibleVal = row[visibleKey];
          const isVisible = visibleVal === true || visibleVal === 1 || String(visibleVal).toLowerCase() === 'true';
          updatedConfig.functionVisible = {
            ...updatedConfig.functionVisible,
            [fn]: isVisible
          };
          configChanged = true;
        }

        // Check weight column
        const weightKey = `${fn}_weight`;
        if (weightKey in row) {
          const weightVal = parseFloat(String(row[weightKey] || ''));
          if (!isNaN(weightVal)) {
            if (weightVal < 0.3 || weightVal > 2.0) {
              errors.push(
                `Row ${rowNum}: ${fn}_weight must be between 0.3 and 2.0 (got ${weightVal})`
              );
              continue;
            }
            updatedConfig.functionWeights = {
              ...updatedConfig.functionWeights,
              [fn]: weightVal
            };
            configChanged = true;
          }
        }

        // Check label column
        const labelKey = `${fn}_label`;
        if (labelKey in row && row[labelKey]) {
          updatedConfig.functionLabels = {
            ...updatedConfig.functionLabels,
            [fn]: String(row[labelKey]).trim()
          };
          configChanged = true;
        }
      }

      // If config changed, recreate cell with new config
      if (configChanged) {
        const reconfiguredCell = createCell(position, updatedConfig, cells.length);
        reconfiguredCell.label = cell.label;
        cells.push(reconfiguredCell);
      } else {
        cells.push(cell);
      }
    }

    if (cells.length === 0) {
      errors.push('No valid cells found in data');
    }

    return { cells, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Failed to parse file: ${message}`);
    return { cells, errors };
  }
}

/**
 * Parse Excel file from input element
 */
export async function parseExcelFileFromInput(
  file: File,
  baseConfig: NetworkConfig = DEFAULT_CONFIG
): Promise<ExcelParseResult> {
  return parseExcelFile(file, baseConfig);
}
