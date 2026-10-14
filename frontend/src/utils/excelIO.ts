/**
 * Excel read/write.
 *
 * Three things this module exists to enforce:
 *
 * 1. The spreadsheet libraries load through dynamic imports, so their weight
 *    stays out of the main bundle and is fetched only when a user actually
 *    imports or exports a workbook.
 * 2. Row shape is normalised in one place: readers here return objects keyed by
 *    the header row, which is what every consumer wants.
 * 3. Cell values are flattened to primitives, so a date or a formula result
 *    never reaches the UI as an object.
 *
 * Library history, so this is not re-litigated:
 * - SheetJS (`xlsx`) carries unpatched prototype-pollution and ReDoS advisories
 *   and no longer publishes fixes to npm.
 * - ExcelJS replaced it briefly but is unusable in a browser: its Node stream
 *   shims wait on an 'end' event that never fires, so every `xlsx.load()` call
 *   stalls for a fixed ~10s before completing. Measured at 9997ms and 10002ms
 *   on consecutive loads of a 5KB file that Node parses in ~12ms.
 * - `read-excel-file` / `write-excel-file` are browser-first, dependency-light
 *   and advisory-free.
 */

/** A worksheet row keyed by its header-row column names. */
export type SheetRow = Record<string, string | number | boolean | null>;

/** Raw cell values as the reader hands them over, before normalisation. */
type RawCell = string | number | boolean | Date | null | undefined;

let readerPromise: Promise<typeof import('read-excel-file/universal')> | null = null;
let writerPromise: Promise<typeof import('write-excel-file/universal')> | null = null;

function loadReader() {
  readerPromise ??= import('read-excel-file/universal');
  return readerPromise;
}

function loadWriter() {
  writerPromise ??= import('write-excel-file/universal');
  return writerPromise;
}

/** Flatten a cell to a primitive the rest of the app can use directly. */
function toPrimitive(value: RawCell): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

/**
 * Read every worksheet in one pass.
 *
 * readXlsxFile returns all sheets as `{ sheet, data }`, so a single parse backs
 * both the sheet listing and the row reader.
 */
async function readAllSheets(file: File) {
  const { default: readXlsxFile } = await loadReader();
  return readXlsxFile(file);
}

/** Names of every worksheet, in workbook order. Empty if the file is unreadable. */
export async function readSheetNames(file: File): Promise<string[]> {
  try {
    const sheets = await readAllSheets(file);
    return sheets.map((sheet) => sheet.sheet);
  } catch {
    return [];
  }
}

/**
 * Read a worksheet as objects keyed by the header row.
 *
 * Falls back to the first sheet when `sheetName` is missing or absent from the
 * workbook. Blank rows are skipped; duplicate headers are suffixed so no column
 * is silently dropped.
 */
export async function readSheetRows(file: File, sheetName?: string): Promise<SheetRow[]> {
  const sheets = await readAllSheets(file);
  if (sheets.length === 0) return [];

  // An unknown sheet name falls back to the first sheet rather than throwing.
  const target = (sheetName && sheets.find((s) => s.sheet === sheetName)) || sheets[0];
  const matrix = target.data as RawCell[][];

  if (matrix.length === 0) return [];

  const [headerRow, ...bodyRows] = matrix;

  const headers: string[] = [];
  const seen = new Map<string, number>();
  for (const raw of headerRow) {
    const name = String(toPrimitive(raw) ?? '').trim();
    if (!name) {
      headers.push('');
      continue;
    }
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    headers.push(count === 0 ? name : `${name}_${count + 1}`);
  }

  const rows: SheetRow[] = [];
  for (const rawRow of bodyRows) {
    const entry: SheetRow = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = toPrimitive(rawRow[index]);
      entry[header] = value;
      if (value !== null && value !== '') hasValue = true;
    });

    if (hasValue) rows.push(entry);
  }

  return rows;
}

/** Column headers of a sheet, i.e. the keys `readSheetRows` will produce. */
export async function readColumnHeaders(file: File, sheetName?: string): Promise<string[]> {
  try {
    const rows = await readSheetRows(file, sheetName);
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  } catch {
    return [];
  }
}

export interface WriteSheetOptions {
  sheetName?: string;
  /** Character widths, per column, applied left to right. */
  columnWidths?: number[];
  /** Render the first row bold. */
  boldHeader?: boolean;
}

type CellValue = string | number | boolean | null;

/**
 * Build an .xlsx file from an array of rows and return its bytes.
 */
export async function writeSheet(
  rows: CellValue[][],
  { sheetName = 'Sheet1', columnWidths, boldHeader = true }: WriteSheetOptions = {}
): Promise<Uint8Array> {
  const { default: writeXlsxFile } = await loadWriter();

  // write-excel-file wants each cell described by {value, type}; an undefined
  // type means an empty cell, which is how nulls should render.
  const data = rows.map((row, rowIndex) =>
    row.map((value) => {
      if (value === null || value === undefined) return null;

      const cell: Record<string, unknown> = { value };
      if (typeof value === 'number') cell.type = Number;
      else if (typeof value === 'boolean') cell.type = Boolean;
      else cell.type = String;

      if (boldHeader && rowIndex === 0) cell.fontWeight = 'bold';
      return cell;
    })
  );

  // The universal build resolves to a handle, not the file itself; toBlob()
  // produces the bytes in both the browser and Node.
  const output = await writeXlsxFile(data as never, {
    sheet: sheetName,
    columns: columnWidths?.map((width) => ({ width })),
  });

  const blob = await output.toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
