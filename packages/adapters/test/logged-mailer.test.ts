import { describe, expect, it } from 'vitest';
import { err, ok, type Email } from '@thp/domain';
import type { Mailer } from '@thp/ports';
import { loggedMailer } from '../src/mail/logged-mailer.ts';

const message = {
  to: 'parent@example.com' as Email,
  subject: 'Ana’s progress',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('loggedMailer', () => {
  it('writes why a send failed, never the address, subject or body, and passes the result on', async () => {
    const lines: string[] = [];
    const failing: Mailer = {
      send: () =>
        Promise.resolve(
          err({ code: 'rejected', reason: '403 validation_error: domain not verified' }),
        ),
    };

    const result = await loggedMailer(failing, (line) => lines.push(line)).send(message);

    expect(result).toEqual({
      ok: false,
      error: { code: 'rejected', reason: '403 validation_error: domain not verified' },
    });
    expect(lines).toEqual([
      'Email send failed: rejected (403 validation_error: domain not verified)\n',
    ]);
    expect(lines.join('')).not.toMatch(/parent@example\.com|progress|Hi/);
  });

  it('logs nothing when the email is sent, and a failure without a reason', async () => {
    const lines: string[] = [];
    const sent: Mailer = { send: () => Promise.resolve(ok({ messageId: 'm1' })) };
    expect(await loggedMailer(sent, (line) => lines.push(line)).send(message)).toEqual({
      ok: true,
      value: { messageId: 'm1' },
    });
    const down: Mailer = { send: () => Promise.resolve(err({ code: 'unavailable' })) };
    await loggedMailer(down, (line) => lines.push(line)).send(message);
    expect(lines).toEqual(['Email send failed: unavailable\n']);
  });
});
