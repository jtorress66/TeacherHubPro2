import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { err, ok, type Result } from '@thp/domain';
import type { MailMessage, Mailer, MailerError, SentMail, SentMailbox } from '@thp/ports';
import type { Database } from '../postgres/schema.ts';

/** How many messages the stand-in keeps; older ones are dropped. */
const kept = 200;

/**
 * The stand-in mailer for development and tests: nothing leaves the machine. Messages are kept
 * in Postgres so a development page can show them. Addresses on the reserved `.invalid` domain
 * are rejected, like a real mailer refusing a bad address. Refused in production.
 */
export class LocalMailer implements Mailer, SentMailbox {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async send(message: MailMessage): Promise<Result<{ readonly messageId: string }, MailerError>> {
    if (message.to.endsWith('.invalid')) return err({ code: 'rejected' });
    const id = `local-${randomUUID()}`;
    await this.db
      .insertInto('sent_mail')
      .values({
        id,
        to_address: message.to,
        subject: message.subject,
        html: message.html,
        text_body: message.text,
        sent_at: this.clock.now(),
      })
      .execute();
    await this.db
      .deleteFrom('sent_mail')
      .where(
        'id',
        'not in',
        this.db.selectFrom('sent_mail').select('id').orderBy('sent_at', 'desc').limit(kept),
      )
      .execute();
    return ok({ messageId: id });
  }

  async list(limit: number): Promise<readonly SentMail[]> {
    const rows = await this.db
      .selectFrom('sent_mail')
      .selectAll()
      .orderBy('sent_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      to: row.to_address,
      subject: row.subject,
      text: row.text_body,
      sentAt: row.sent_at,
    }));
  }
}
