import type { Kysely } from 'kysely';
import type { SchoolId, Subscription, SubscriptionId } from '@thp/domain';
import type { SubscriptionRepository } from '@thp/ports';
import { subscriptionMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: SubscriptionId): Promise<Subscription | null> {
    const row = await this.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : subscriptionMapper.fromRow(row);
  }

  save(subscription: Subscription): Promise<void> {
    return upsert(this.db, 'subscriptions', subscriptionMapper.toRow(subscription));
  }

  async listBySchool(schoolId: SchoolId): Promise<readonly Subscription[]> {
    const rows = await this.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(subscriptionMapper.fromRow);
  }

  /** Unscoped on purpose: billing webhooks identify a subscription by the provider's id. */
  async findByExternalId(externalId: string): Promise<Subscription | null> {
    const row = await this.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('external_id', '=', externalId)
      .executeTakeFirst();
    return row === undefined ? null : subscriptionMapper.fromRow(row);
  }
}
