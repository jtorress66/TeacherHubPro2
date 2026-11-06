import type { PasswordTokenId, SchoolId, UserId } from '../shared/ids.ts';

export const passwordTokenLifetimeDays = 3;
const lifetimeMs = passwordTokenLifetimeDays * 24 * 60 * 60 * 1000;

/** A new account's first password, or a reset. */
export type PasswordTokenPurpose = 'welcome' | 'reset';

/**
 * A one-time link to choose a password. The secret lives only in the emailed link; the server
 * keeps its hash, so the database alone cannot be used to take over an account.
 */
export interface PasswordToken {
  readonly id: PasswordTokenId;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
  readonly tokenHash: string;
  readonly purpose: PasswordTokenPurpose;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
}

export const issuePasswordToken = (input: {
  readonly id: PasswordTokenId;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
  readonly tokenHash: string;
  readonly purpose: PasswordTokenPurpose;
  readonly now: Date;
}): PasswordToken => ({
  id: input.id,
  userId: input.userId,
  schoolId: input.schoolId,
  tokenHash: input.tokenHash,
  purpose: input.purpose,
  createdAt: input.now,
  expiresAt: new Date(input.now.getTime() + lifetimeMs),
  usedAt: null,
});

export const usablePasswordToken = (token: PasswordToken, now: Date): boolean =>
  token.usedAt === null && now.getTime() < token.expiresAt.getTime();

export const usePasswordToken = (token: PasswordToken, now: Date): PasswordToken => ({
  ...token,
  usedAt: now,
});
