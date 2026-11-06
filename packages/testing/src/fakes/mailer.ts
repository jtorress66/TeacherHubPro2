import { err, ok, type Result } from '@thp/domain';
import type { MailContent, MailMessage, Mailer, MailerError, MailTemplates } from '@thp/ports';

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

/** Plain, predictable wording, so tests can read what was sent. */
export const fakeMailTemplates: MailTemplates = {
  portalLink: (input): MailContent => ({
    subject: `[${input.language}] ${input.firstName} at ${input.schoolName}`,
    html: `<a href="${input.url}">${input.className}</a>`,
    text: `${input.className}: ${input.url}`,
  }),
  trialReminder: (input): MailContent => ({
    subject: `[${input.language}] ${String(input.daysLeft)} days left`,
    html: `<a href="${input.billingUrl}">${input.name}</a>`,
    text: `${input.name}: ${input.billingUrl}`,
  }),
  setPassword: (input): MailContent => ({
    subject: `[${input.language}] ${input.purpose} ${input.name}`,
    html: `<a href="${input.url}">${input.name}</a>`,
    text: `${input.purpose}: ${input.url}`,
  }),
  weeklyUpdate: (input): MailContent => ({
    subject: `[${input.language}] ${input.subject}`,
    html: `<p>${input.body}</p>`,
    text: `${input.body}
${input.schoolName}`,
  }),
};
