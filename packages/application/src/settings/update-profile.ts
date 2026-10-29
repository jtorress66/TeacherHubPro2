import { ok, updateProfile, type Result, type User } from '@thp/domain';
import type { UserRepository } from '@thp/ports';
import type { UseCaseError } from '../errors.ts';

/** A teacher changes their own name and language; nobody else's. */
export class UpdateProfile {
  constructor(private readonly deps: { readonly users: UserRepository }) {}

  async execute(input: {
    actor: User;
    name: string;
    language: string;
  }): Promise<Result<User, UseCaseError>> {
    const updated = updateProfile(input.actor, { name: input.name, language: input.language });
    if (!updated.ok) return updated;
    await this.deps.users.save(updated.value);
    return ok(updated.value);
  }
}
