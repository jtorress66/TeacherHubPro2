import type { Insertable, Kysely, Transaction } from 'kysely';
import type { Database } from './schema.ts';

type TableWithId = {
  [T in keyof Database]: Database[T] extends { id: string } ? T : never;
}[keyof Database];

/** Inserts the row, or replaces every column of the row with the same id. */
export async function upsert<T extends TableWithId>(
  db: Kysely<Database> | Transaction<Database>,
  table: T,
  row: Insertable<Database[T]>,
): Promise<void> {
  await db
    .insertInto(table)
    .values(row)
    .onConflict((conflict) => conflict.column('id').doUpdateSet(row))
    .execute();
}
