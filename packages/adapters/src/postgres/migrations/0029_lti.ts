import { sql, type Kysely } from 'kysely';

/**
 * LTI 1.3: the course systems schools register, launch nonces already used, which account each
 * course system user linked, and TeacherHubPro's own signing keys (private halves encrypted).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('lti_platforms')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('issuer', 'text', (c) => c.notNull())
    .addColumn('client_id', 'text', (c) => c.notNull())
    .addColumn('deployment_ids', sql`text[]`, (c) => c.notNull())
    .addColumn('auth_login_url', 'text', (c) => c.notNull())
    .addColumn('auth_token_url', 'text', (c) => c.notNull())
    .addColumn('jwks_url', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addUniqueConstraint('lti_platforms_issuer_client_id_key', ['issuer', 'client_id'])
    .execute();
  await db.schema
    .createIndex('lti_platforms_school_id_idx')
    .on('lti_platforms')
    .column('school_id')
    .execute();

  await db.schema
    .createTable('lti_nonces')
    .addColumn('nonce', 'text', (c) => c.primaryKey())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .execute();

  await db.schema
    .createTable('lti_user_links')
    .addColumn('platform_id', 'text', (c) =>
      c.notNull().references('lti_platforms.id').onDelete('cascade'),
    )
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addPrimaryKeyConstraint('lti_user_links_pkey', ['platform_id', 'subject'])
    .execute();

  await db.schema
    .createTable('tool_keys')
    .addColumn('kid', 'text', (c) => c.primaryKey())
    .addColumn('private_key_encrypted', 'text', (c) => c.notNull())
    .addColumn('public_jwk', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('tool_keys').execute();
  await db.schema.dropTable('lti_user_links').execute();
  await db.schema.dropTable('lti_nonces').execute();
  await db.schema.dropTable('lti_platforms').execute();
}
