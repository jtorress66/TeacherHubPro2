import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TicketSigner } from '@thp/ports';

/** The shortest secret accepted: 32 characters (the web app and the realtime server share it). */
export const minTicketSecretLength = 32;

/**
 * Tickets as `payload.expiry.signature`: the payload is base64url JSON, the signature an HMAC
 * SHA-256 of both under a secret shared by the web app and the realtime server.
 */
export class HmacTicketSigner implements TicketSigner {
  constructor(private readonly secret: string) {
    if (secret.length < minTicketSecretLength) {
      throw new Error(
        `The ticket secret must be at least ${String(minTicketSecretLength)} characters`,
      );
    }
  }

  sign(payload: Readonly<Record<string, string>>, expiresAt: Date): string {
    const body = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${String(expiresAt.getTime())}`;
    return `${body}.${this.signatureOf(body)}`;
  }

  verify(ticket: string, now: Date): Readonly<Record<string, string>> | null {
    const parts = ticket.split('.');
    if (parts.length !== 3) return null;
    const [payload = '', expiry = '', signature = ''] = parts;
    const expected = Buffer.from(this.signatureOf(`${payload}.${expiry}`));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    if (!(Number(expiry) > now.getTime())) return null;
    try {
      const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return isStringRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private signatureOf(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'string');
