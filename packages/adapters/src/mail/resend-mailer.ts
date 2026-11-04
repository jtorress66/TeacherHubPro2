import { err, ok, type Result } from '@thp/domain';
import type { MailMessage, Mailer, MailerError } from '@thp/ports';

export interface ResendConfig {
  readonly apiKey: string;
  /** The verified sender, e.g. "TeacherHubPro <hello@example.com>". */
  readonly from: string;
  readonly baseURL?: string;
}

const isId = (value: unknown): value is { readonly id: string } =>
  typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';

/**
 * Sends email through Resend's official HTTP API. A request Resend refuses (a bad address, an
 * unverified sender) is `rejected`; a rate limit, a server error or no connection is
 * `unavailable`. Message bodies are never logged.
 */
export class ResendMailer implements Mailer {
  private readonly endpoint: string;

  constructor(private readonly config: ResendConfig) {
    this.endpoint = `${config.baseURL ?? 'https://api.resend.com'}/emails`;
  }

  async send(message: MailMessage): Promise<Result<{ readonly messageId: string }, MailerError>> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
    } catch {
      return err({ code: 'unavailable' });
    }
    if (response.status === 429 || response.status >= 500) return err({ code: 'unavailable' });
    if (!response.ok) return err({ code: 'rejected' });
    const body: unknown = await response.json().catch(() => null);
    return isId(body) ? ok({ messageId: body.id }) : err({ code: 'unavailable' });
  }
}
