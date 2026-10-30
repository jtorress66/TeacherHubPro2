import type { Kysely } from 'kysely';
import { err, ok, type Result } from '@thp/domain';
import type { FileStore, FileStoreError, StoredFile } from '@thp/ports';
import type { Database } from '../schema.ts';

/** Small uploaded files (school logos) kept in Postgres until a bucket is needed. */
export class PostgresFileStore implements FileStore {
  constructor(private readonly db: Kysely<Database>) {}

  async put(key: string, file: StoredFile): Promise<Result<true, FileStoreError>> {
    const row = { key, content_type: file.contentType, bytes: file.bytes };
    await this.db
      .insertInto('stored_files')
      .values(row)
      .onConflict((conflict) =>
        conflict.column('key').doUpdateSet({ content_type: row.content_type, bytes: row.bytes }),
      )
      .execute();
    return ok(true);
  }

  async get(key: string): Promise<Result<StoredFile, FileStoreError>> {
    const row = await this.db
      .selectFrom('stored_files')
      .select(['content_type', 'bytes'])
      .where('key', '=', key)
      .executeTakeFirst();
    if (row === undefined) return err({ code: 'not_found' });
    return ok({ bytes: new Uint8Array(row.bytes), contentType: row.content_type });
  }

  async delete(key: string): Promise<Result<true, FileStoreError>> {
    await this.db.deleteFrom('stored_files').where('key', '=', key).execute();
    return ok(true);
  }
}
