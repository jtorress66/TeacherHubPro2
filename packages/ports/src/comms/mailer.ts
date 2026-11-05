import type { Email, Result } from '@thp/domain';

export interface MailMessage {
  readonly to: Email;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface MailerError {
  readonly code: 'rejected' | 'unavailable';
  /** The provider's reason (status, error name, message without addresses), for logs only. */
  readonly reason?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<Result<{ readonly messageId: string }, MailerError>>;
}
