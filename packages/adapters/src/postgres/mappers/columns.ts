import type { Insertable, Selectable } from 'kysely';
import {
  parseLocalDate,
  parseTimeOfDay,
  weekdays,
  type LocalDate,
  type TimeOfDay,
  type Weekday,
} from '@thp/domain';

/** A complete row to write: every column set (null where empty), except database defaults. */
export type Row<Table> = Required<Omit<Insertable<Table>, 'created_at'>>;

/** Converts one aggregate to and from its table row. */
export interface RowMapper<Entity, Table> {
  readonly toRow: (entity: Entity) => Row<Table>;
  readonly fromRow: (row: Selectable<Table>) => Entity;
}

/**
 * Helpers for reading stored values back into domain types. A value that does not fit means the
 * database was changed outside this code, so it throws (rejecting the repository call).
 */
const unexpected = (value: unknown, column: string): Error =>
  new Error(`Unexpected value ${JSON.stringify(value)} in ${column}`);

export function oneOf<T extends string>(allowed: readonly T[], value: unknown, column: string): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw unexpected(value, column);
  return match;
}

export function localDate(value: string, column: string): LocalDate {
  const parsed = parseLocalDate(column, value);
  if (!parsed.ok) throw unexpected(value, column);
  return parsed.value;
}

export function timeOfDay(value: string, column: string): TimeOfDay {
  const parsed = parseTimeOfDay(column, value);
  if (!parsed.ok) throw unexpected(value, column);
  return parsed.value;
}

export function weekdayList(value: unknown, column: string): readonly Weekday[] {
  if (!Array.isArray(value)) throw unexpected(value, column);
  return value.map((day: unknown) => oneOf(weekdays, day, column));
}

/** jsonb comes back parsed from Postgres; rows built by `toRow` hold JSON text. Accept both. */
export const readJson = (value: unknown): unknown =>
  typeof value === 'string' ? (JSON.parse(value) as unknown) : value;

export const toJson = (value: unknown): string => JSON.stringify(value);
