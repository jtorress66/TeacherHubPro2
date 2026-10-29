import { err, ok, type Result } from '@thp/domain';

export interface RosterRow {
  /** The line of the file where the row starts (the header is line 1). */
  readonly line: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly studentNumber: string;
  readonly parentEmail: string;
  readonly accommodations: string;
}

type Column = Exclude<keyof RosterRow, 'line'>;

export type RosterCsvError =
  | { readonly code: 'csv_empty' }
  | { readonly code: 'csv_too_many_rows' }
  | { readonly code: 'csv_missing_columns'; readonly columns: readonly Column[] };

export const maxRosterRows = 500;

/** Header names teachers use, in English and Spanish (compared without case or accents). */
const headerAliases: Readonly<Record<Column, readonly string[]>> = {
  firstName: [
    'first name',
    'firstname',
    'first',
    'given name',
    'nombre',
    'nombres',
    'primer nombre',
  ],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name', 'apellido', 'apellidos'],
  studentNumber: [
    'student number',
    'student id',
    'number',
    'id',
    'numero de estudiante',
    'numero',
    'id de estudiante',
    'matricula',
  ],
  parentEmail: [
    'parent email',
    'parent e-mail',
    'guardian email',
    'correo del padre',
    'correo de la madre',
    'correo del padre/madre',
    'correo del tutor',
    'correo padre',
  ],
  accommodations: ['accommodations', 'adaptaciones', 'acomodaciones', 'acomodos'],
};

const required: readonly Column[] = ['firstName', 'lastName'];

/** Some spreadsheet programs start UTF-8 files with this invisible mark. */
const byteOrderMark = String.fromCharCode(0xfeff);

const normalize = (header: string): string =>
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
 * Reads a roster from CSV text: comma or semicolon separated (Spanish Excel uses semicolons),
 * with a header row naming the columns in English or Spanish. Only parsing happens here; the
 * student rules are checked by the import.
 */
export function parseRosterCsv(input: string): Result<RosterRow[], RosterCsvError> {
  const text = input.startsWith(byteOrderMark) ? input.slice(1) : input;
  const [header, ...rows] = records(text, detectDelimiter(text.split('\n', 1)[0] ?? ''));
  if (header === undefined || rows.length === 0) return err({ code: 'csv_empty' });
  if (rows.length > maxRosterRows) return err({ code: 'csv_too_many_rows' });

  const names = header.fields.map(normalize);
  const indexOf = (column: Column) =>
    names.findIndex((name) => headerAliases[column].includes(name));
  const missing = required.filter((column) => indexOf(column) === -1);
  if (missing.length > 0) return err({ code: 'csv_missing_columns', columns: missing });

  const columns = Object.keys(headerAliases) as Column[];
  const positions = new Map(columns.map((column) => [column, indexOf(column)]));
  const value = (fields: readonly string[], column: Column) => {
    const index = positions.get(column) ?? -1;
    return index === -1 ? '' : (fields[index] ?? '').trim();
  };
  return ok(
    rows.map(({ line, fields }) => ({
      line,
      firstName: value(fields, 'firstName'),
      lastName: value(fields, 'lastName'),
      studentNumber: value(fields, 'studentNumber'),
      parentEmail: value(fields, 'parentEmail'),
      accommodations: value(fields, 'accommodations'),
    })),
  );
}
