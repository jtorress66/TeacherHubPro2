import { sql, type Kysely } from 'kysely';

/**
 * Invite-a-colleague: each teacher's invite code, and the colleagues who made an account through
 * it, decided (free month or not) at their first payment.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('referral_codes')
    .addColumn('code', 'text', (c) => c.primaryKey())
    .addColumn('user_id', 'text', (c) =>
      c.notNull().unique().references('users.id').onDelete('cascade'),
    )
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id').onDelete('cascade'))
    .execute();

  await db.schema
    .createTable('referrals')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('referrer_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('referrer_school_id', 'text', (c) =>
      c.notNull().references('schools.id').onDelete('cascade'),
    )
    .addColumn('invited_school_id', 'text', (c) =>
      c.notNull().unique().references('schools.id').onDelete('cascade'),
    )
    .addColumn('joined_at', 'timestamptz', (c) => c.notNull())
    .addColumn('status', 'text', (c) =>
      c.notNull().check(sql`status IN ('joined', 'rewarded', 'not_rewarded')`),
    )
    .addColumn('decided_at', 'timestamptz')
    .execute();
  await db.schema
    .createIndex('referrals_referrer')
    .on('referrals')
    .columns(['referrer_school_id', 'referrer_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('referrals').execute();
  await db.schema.dropTable('referral_codes').execute();
}
