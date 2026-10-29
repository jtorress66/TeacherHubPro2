import { err, ok, type Result } from '@thp/domain';
import type { MailMessage, Mailer, MailerError } from '@thp/ports';

/** Keeps sent mail in an outbox instead of sending it. */
export class FakeMailer implements Mailer {
  readonly outbox: MailMessage[] = [];

  constructor(private readonly options: { readonly reject?: boolean } = {}) {}

  send(message: MailMessage): Promise<Result<{ readonly messageId: string }, MailerError>> {
    if (this.options.reject === true) return Promise.resolve(err({ code: 'rejected' }));
    this.outbox.push(message);
    return Promise.resolve(ok({ messageId: `message-${String(this.outbox.length)}` }));
  }
}
