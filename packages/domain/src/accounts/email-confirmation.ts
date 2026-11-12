import type { UserId } from '../shared/ids.ts';

export const emailConfirmationLifetimeDays = 3;
const lifetimeMs = emailConfirmationLifetimeDays * 24 * 60 * 60 * 1000;

/**
 * A one-time "confirm your email" link. The secret lives only in the emailed link; the server
 * keeps its hash.
 */
export interface EmailConfirmation {
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
}

export const issueEmailConfirmation = (input: {
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly now: Date;
}): EmailConfirmation => ({
  tokenHash: input.tokenHash,
  userId: input.userId,
  createdAt: input.now,
  expiresAt: new Date(input.now.getTime() + lifetimeMs),
  usedAt: null,
});

export const usableEmailConfirmation = (confirmation: EmailConfirmation, now: Date): boolean =>
  confirmation.usedAt === null && now.getTime() < confirmation.expiresAt.getTime();

export const useEmailConfirmation = (
  confirmation: EmailConfirmation,
  now: Date,
): EmailConfirmation => ({ ...confirmation, usedAt: now });
