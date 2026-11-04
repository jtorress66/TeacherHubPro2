/**
 * Short-lived signed tickets that let a host or a player connect to a live session. Whoever holds
 * the secret can sign; anyone with the secret can verify. Tickets carry no secrets themselves.
 */
export interface TicketSigner {
  sign(payload: Readonly<Record<string, string>>, expiresAt: Date): string;
  /** The payload of a genuine, unexpired ticket; null for anything else. */
  verify(ticket: string, now: Date): Readonly<Record<string, string>> | null;
}
