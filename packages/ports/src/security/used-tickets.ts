/** Tickets already used, so a ticket that signs someone in works only once. */
export interface UsedTicketRepository {
  /** Marks the ticket used until it expires; false when it was already used. */
  claim(ticketId: string, expiresAt: Date): Promise<boolean>;
}
