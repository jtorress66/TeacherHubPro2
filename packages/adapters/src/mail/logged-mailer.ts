import type { Mailer } from '@thp/ports';

/**
 * Writes one line when an email fails: the code and the provider's reason, never the address,
 * subject or body. Results pass through unchanged.
 */
export function loggedMailer(mailer: Mailer, write: (line: string) => void): Mailer {
  return {
    async send(message) {
      const result = await mailer.send(message);
      if (!result.ok) {
        const { code, reason } = result.error;
        write(`Email send failed: ${code}${reason === undefined ? '' : ` (${reason})`}\n`);
      }
      return result;
    },
  };
}
