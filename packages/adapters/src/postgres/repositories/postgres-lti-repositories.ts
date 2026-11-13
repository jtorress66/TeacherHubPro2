import { sql, type Kysely, type Selectable } from 'kysely';
import type { LtiPlatform, LtiPlatformId, SchoolId, UserId } from '@thp/domain';
import type { LtiNonceRepository, LtiPlatformRepository, LtiUserLinkRepository } from '@thp/ports';
import type { Database, LtiPlatformsTable } from '../schema.ts';

const fromRow = (row: Selectable<LtiPlatformsTable>): LtiPlatform => ({
  id: row.id as LtiPlatformId,
  schoolId: row.school_id as SchoolId,
  name: row.name,
  issuer: row.issuer,
  clientId: row.client_id,
  deploymentIds: row.deployment_ids,
  authLoginUrl: row.auth_login_url,
  authTokenUrl: row.auth_token_url,
  jwksUrl: row.jwks_url,
  createdAt: row.created_at,
});

export class PostgresLtiPlatformRepository implements LtiPlatformRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(platform: LtiPlatform): Promise<void> {
    const changes = {
      name: platform.name,
      issuer: platform.issuer,
      client_id: platform.clientId,
      deployment_ids: [...platform.deploymentIds],
      auth_login_url: platform.authLoginUrl,
      auth_token_url: platform.authTokenUrl,
      jwks_url: platform.jwksUrl,
      created_at: platform.createdAt,
    };
    await this.db
      .insertInto('lti_platforms')
      .values({ id: platform.id, school_id: platform.schoolId, ...changes })
      .onConflict((conflict) =>
        conflict
          .column('id')
          .doUpdateSet(changes)
          .where('lti_platforms.school_id', '=', platform.schoolId),
      )
      .execute();
  }

  async findById(schoolId: SchoolId, id: LtiPlatformId): Promise<LtiPlatform | null> {
    const row = await this.db
      .selectFrom('lti_platforms')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : fromRow(row);
  }

  async findByIssuer(issuer: string, clientId: string | null): Promise<readonly LtiPlatform[]> {
    let query = this.db.selectFrom('lti_platforms').selectAll().where('issuer', '=', issuer);
    if (clientId !== null) query = query.where('client_id', '=', clientId);
    return (await query.orderBy('created_at').orderBy('id').execute()).map(fromRow);
  }

  async listForSchool(schoolId: SchoolId): Promise<readonly LtiPlatform[]> {
    const rows = await this.db
      .selectFrom('lti_platforms')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(fromRow);
  }

  async delete(schoolId: SchoolId, id: LtiPlatformId): Promise<void> {
    await this.db
      .deleteFrom('lti_platforms')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }
}

/** Used nonces, kept until they expire; expired ones are cleared as new ones come in. */
export class PostgresLtiNonceRepository implements LtiNonceRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async claim(nonce: string, expiresAt: Date): Promise<boolean> {
    await this.db
      .deleteFrom('lti_nonces')
      .where('expires_at', '<', sql<Date>`now()`)
      .execute();
    const inserted = await this.db
      .insertInto('lti_nonces')
      .values({ nonce, expires_at: expiresAt })
      .onConflict((conflict) => conflict.column('nonce').doNothing())
      .executeTakeFirst();
    return inserted.numInsertedOrUpdatedRows === 1n;
  }
}

export class PostgresLtiUserLinkRepository implements LtiUserLinkRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async link(
    platformId: LtiPlatformId,
    subject: string,
    userId: UserId,
    linkedAt: Date,
  ): Promise<void> {
    await this.db
      .insertInto('lti_user_links')
      .values({ platform_id: platformId, subject, user_id: userId, created_at: linkedAt })
      .onConflict((conflict) =>
        conflict
          .columns(['platform_id', 'subject'])
          .doUpdateSet({ user_id: userId, created_at: linkedAt }),
      )
      .execute();
  }

  async findUserId(platformId: LtiPlatformId, subject: string): Promise<UserId | null> {
    const row = await this.db
      .selectFrom('lti_user_links')
      .select('user_id')
      .where('platform_id', '=', platformId)
      .where('subject', '=', subject)
      .executeTakeFirst();
    return row === undefined ? null : (row.user_id as UserId);
  }
}
