import { ok, type Result } from '@thp/domain';
import { readCsvTable, type CsvTableError } from '../shared/csv-table.ts';

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

export type RosterCsvError = CsvTableError<Column>;

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

/**
 * Reads a roster from CSV text, with a header row naming the columns in English or Spanish.
 * Only parsing happens here; the student rules are checked by the import.
 */
export function parseRosterCsv(input: string): Result<RosterRow[], RosterCsvError> {
  const table = readCsvTable(input, { aliases: headerAliases, required, maxRows: maxRosterRows });
  if (!table.ok) return table;
  return ok(table.value.map(({ line, values }) => ({ line, ...values })));
}
