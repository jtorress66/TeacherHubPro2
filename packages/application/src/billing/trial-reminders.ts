import { reminderDue, trialDaysLeft } from '@thp/domain';
import type {
  Clock,
  Mailer,
  MailTemplates,
  TrialEndingLookup,
  TrialReminderRepository,
  UserRepository,
} from '@thp/ports';

const dayMs = 24 * 60 * 60 * 1000;
/** The earliest reminder goes out 3 days before a trial ends. */
const lookAheadMs = 3 * dayMs;

/**
 * Emails each trialing account's owner 3 days before the trial ends and on its last day, in
 * their language. Safe to run as often as wanted: each reminder is recorded once sent, and one
 * the mailer refused is tried again next time. Returns how many were sent.
 */
export class SendTrialReminders {
  constructor(
    private readonly deps: {
      readonly subscriptions: TrialEndingLookup;
      readonly trialReminders: TrialReminderRepository;
      readonly users: UserRepository;
      readonly mailer: Mailer;
      readonly mailTemplates: MailTemplates;
      readonly clock: Clock;
      readonly appUrl: string;
    },
  ) {}

  async execute(): Promise<number> {
    const { deps } = this;
    const now = deps.clock.now();
    const ending = await deps.subscriptions.listTrialsEnding(
      now,
      new Date(now.getTime() + lookAheadMs),
    );
    let sent = 0;
    for (const subscription of ending) {
      const kind = reminderDue(
        subscription,
        now,
        await deps.trialReminders.sentKinds(subscription.id),
      );
      const owner = await deps.users.findById(subscription.schoolId, subscription.ownerId);
      if (kind === null || owner === null) continue;
      const mail = await deps.mailer.send({
        to: owner.email,
        ...deps.mailTemplates.trialReminder({
          language: owner.language,
          name: owner.name,
          // Only trialing subscriptions reach here; a started day counts as one.
          daysLeft: Math.max(1, trialDaysLeft(subscription, now) ?? 1),
          billingUrl: `${deps.appUrl}/${owner.language}/app/billing`,
        }),
      });
      if (!mail.ok) continue;
      await deps.trialReminders.record({
        subscriptionId: subscription.id,
        schoolId: subscription.schoolId,
        kind,
        sentAt: now,
      });
      sent += 1;
    }
    return sent;
  }
}
