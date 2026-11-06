import { err, ok, type Result } from '@thp/domain';

export type CsvTableError<C extends string> =
  | { readonly code: 'csv_empty' }
  | { readonly code: 'csv_too_many_rows' }
  | { readonly code: 'csv_missing_columns'; readonly columns: readonly C[] };

/** One data row: where it starts in the file (the header is line 1) and its values by column. */
export interface CsvTableRow<C extends string> {
  readonly line: number;
  readonly values: Readonly<Record<C, string>>;
}

/** Some spreadsheet programs start UTF-8 files with this invisible mark. */
const byteOrderMark = String.fromCharCode(0xfeff);

/** Header names compared without case, accents, underscores or extra spaces. */
export const normalizeHeader = (header: string): string =>
  header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[_\s-]+/g, ' ')
    .trim();

interface Record_ {
  readonly line: number;
  readonly fields: string[];
}

/** Splits CSV text into records, honouring quotes ("" is a quote) and newlines inside quotes. */
function records(text: string, delimiter: string): Record_[] {
  const result: Record_[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else {
        if (char === '\n') line += 1;
        field += char;
      }
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      fields.push(field);
      field = '';
    } else if (char === '\n') {
      fields.push(field);
      result.push({ line: start, fields });
      fields = [];
      field = '';
      line += 1;
      start = line;
    } else if (char !== '\r') field += char;
  }
  if (field !== '' || fields.length > 0) result.push({ line: start, fields: [...fields, field] });
  return result.filter((record) => record.fields.some((value) => value.trim() !== ''));
}

const detectDelimiter = (headerLine: string): string =>
  (headerLine.match(/;/g) ?? []).length > (headerLine.match(/,/g) ?? []).length ? ';' : ',';

/**
 * Reads CSV text with a header row: comma or semicolon separated (Spanish Excel uses
 * semicolons), each column known by any of its header names. Only parsing happens here.
 */
export function readCsvTable<C extends string>(
  input: string,
  options: {
    readonly aliases: Readonly<Record<C, readonly string[]>>;
    readonly required: readonly C[];
    readonly maxRows: number;
  },
): Result<CsvTableRow<C>[], CsvTableError<C>> {
  const text = input.startsWith(byteOrderMark) ? input.slice(1) : input;
  const [header, ...rows] = records(text, detectDelimiter(text.split('\n', 1)[0] ?? ''));
  if (header === undefined || rows.length === 0) return err({ code: 'csv_empty' });
  if (rows.length > options.maxRows) return err({ code: 'csv_too_many_rows' });

  const names = header.fields.map(normalizeHeader);
  const indexOf = (column: C) => names.findIndex((name) => options.aliases[column].includes(name));
  const missing = options.required.filter((column) => indexOf(column) === -1);
  if (missing.length > 0) return err({ code: 'csv_missing_columns', columns: missing });

  const columns = Object.keys(options.aliases) as C[];
  const positions = columns.map((column) => [column, indexOf(column)] as const);
  return ok(
    rows.map(({ line, fields }) => ({
      line,
      values: Object.fromEntries(
        positions.map(([column, index]) => [
          column,
          index === -1 ? '' : (fields[index] ?? '').trim(),
        ]),
      ) as Record<C, string>,
    })),
  );
}
