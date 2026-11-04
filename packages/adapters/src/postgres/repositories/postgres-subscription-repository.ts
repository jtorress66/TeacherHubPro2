import type { Kysely } from 'kysely';
import type { SchoolId, Subscription, SubscriptionId } from '@thp/domain';
import type { SubscriptionRepository, TrialEndingLookup } from '@thp/ports';
import { subscriptionMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresSubscriptionRepository implements SubscriptionRepository, TrialEndingLookup {
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

  /** Unscoped on purpose: the worker looks across schools for trials about to end. */
  async listTrialsEnding(from: Date, until: Date): Promise<readonly Subscription[]> {
    const rows = await this.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('status', '=', 'trialing')
      .where('trial_ends_at', '>', from)
      .where('trial_ends_at', '<=', until)
      .orderBy('trial_ends_at')
      .orderBy('id')
      .execute();
    return rows.map(subscriptionMapper.fromRow);
  }
}
