import type { Email, Result } from '@thp/domain';

export interface MailMessage {
  readonly to: Email;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface MailerError {
  readonly code: 'rejected' | 'unavailable';
}

export interface Mailer {
  send(message: MailMessage): Promise<Result<{ readonly messageId: string }, MailerError>>;
}
