/** Unguessable, URL-safe tokens for student and parent links (at least 32 characters). */
export interface RandomTokenGenerator {
  generate(): string;
}
