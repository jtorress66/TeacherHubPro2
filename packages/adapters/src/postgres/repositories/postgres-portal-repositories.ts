import type { Kysely } from 'kysely';
import {
  trialReminderKinds,
  type ClassId,
  type PortalLink,
  type PortalLinkId,
  type SchoolId,
  type SubscriptionId,
  type TrialReminderKind,
} from '@thp/domain';
import type { PortalLinkRepository, TrialReminderRepository } from '@thp/ports';
import { oneOf } from '../mappers/columns.ts';
import { portalLinkMapper } from '../mappers/portal-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresPortalLinkRepository implements PortalLinkRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: PortalLinkId): Promise<PortalLink | null> {
    const row = await this.db
      .selectFrom('portal_links')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : portalLinkMapper.fromRow(row);
  }

  save(link: PortalLink): Promise<void> {
    return upsert(this.db, 'portal_links', portalLinkMapper.toRow(link));
  }

  async findByTokenHash(tokenHash: string): Promise<PortalLink | null> {
    const row = await this.db
      .selectFrom('portal_links')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row === undefined ? null : portalLinkMapper.fromRow(row);
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly PortalLink[]> {
    const rows = await this.db
      .selectFrom('portal_links')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(portalLinkMapper.fromRow);
  }
}

export class PostgresTrialReminderRepository implements TrialReminderRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async sentKinds(subscriptionId: SubscriptionId): Promise<readonly TrialReminderKind[]> {
    const rows = await this.db
      .selectFrom('trial_reminders')
      .select('kind')
      .where('subscription_id', '=', subscriptionId)
      .orderBy('sent_at')
      .execute();
    return rows.map((row) => oneOf(trialReminderKinds, row.kind, 'trial_reminders.kind'));
  }

  async record(reminder: {
    readonly subscriptionId: SubscriptionId;
    readonly schoolId: SchoolId;
    readonly kind: TrialReminderKind;
    readonly sentAt: Date;
  }): Promise<void> {
    await this.db
      .insertInto('trial_reminders')
      .values({
        subscription_id: reminder.subscriptionId,
        school_id: reminder.schoolId,
        kind: reminder.kind,
        sent_at: reminder.sentAt,
      })
      .onConflict((conflict) => conflict.columns(['subscription_id', 'kind']).doNothing())
      .execute();
  }
}
