import {
  createLtiPlatform,
  err,
  ok,
  type LtiPlatform,
  type LtiPlatformId,
  type Result,
  type SchoolId,
  type User,
} from '@thp/domain';
import type { Clock, IdGenerator, LtiPlatformRepository } from '@thp/ports';
import { adminSchool } from '../admin/admin-access.ts';
import { fail, type UseCaseError } from '../errors.ts';

/** What a school admin types to register their course system. */
export interface LtiPlatformDetails {
  readonly name: string;
  readonly issuer: string;
  readonly clientId: string;
  /** The deployment IDs, with commas between them. */
  readonly deploymentIds: string;
  readonly authLoginUrl: string;
  readonly authTokenUrl: string;
  readonly jwksUrl: string;
}

interface RegisterDeps {
  readonly ltiPlatforms: LtiPlatformRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * Registers a course system for the admin's school (any school for a super admin). An issuer and
 * client ID pair belongs to one school only, so a launch always knows its school.
 */
export class RegisterLtiPlatform {
  constructor(private readonly deps: RegisterDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly details: LtiPlatformDetails;
    readonly schoolId?: SchoolId;
  }): Promise<Result<LtiPlatform, UseCaseError>> {
    const school = adminSchool(input.actor, input.schoolId);
    if (!school.ok) return school;
    const platform = createLtiPlatform(
      { ...input.details, schoolId: school.value },
      this.deps.ids.next() as LtiPlatformId,
      this.deps.clock.now(),
    );
    if (!platform.ok) return platform;
    const taken = await this.deps.ltiPlatforms.findByIssuer(
      platform.value.issuer,
      platform.value.clientId,
    );
    if (taken.length > 0) return err({ field: 'clientId', code: 'duplicate' });
    await this.deps.ltiPlatforms.save(platform.value);
    return ok(platform.value);
  }
}

/** The course systems registered for the admin's school (any school for a super admin). */
export class ListLtiPlatforms {
  constructor(private readonly deps: { readonly ltiPlatforms: LtiPlatformRepository }) {}

  async execute(input: {
    readonly actor: User;
    readonly schoolId?: SchoolId;
  }): Promise<Result<readonly LtiPlatform[], UseCaseError>> {
    const school = adminSchool(input.actor, input.schoolId);
    if (!school.ok) return school;
    return ok(await this.deps.ltiPlatforms.listForSchool(school.value));
  }
}

/** Removes a course system: its launches stop working and its account links are forgotten. */
export class RemoveLtiPlatform {
  constructor(private readonly deps: { readonly ltiPlatforms: LtiPlatformRepository }) {}

  async execute(input: {
    readonly actor: User;
    readonly platformId: LtiPlatformId;
    readonly schoolId?: SchoolId;
  }): Promise<Result<true, UseCaseError>> {
    const school = adminSchool(input.actor, input.schoolId);
    if (!school.ok) return school;
    const platform = await this.deps.ltiPlatforms.findById(school.value, input.platformId);
    if (platform === null) return fail('not_found');
    await this.deps.ltiPlatforms.delete(school.value, platform.id);
    return ok(true);
  }
}

/** Whether the person's own school has a course system set up (any role may ask). */
export class LtiSetUpForSchool {
  constructor(private readonly deps: { readonly ltiPlatforms: LtiPlatformRepository }) {}

  async execute(input: { readonly actor: User }): Promise<Result<boolean, UseCaseError>> {
    return ok((await this.deps.ltiPlatforms.listForSchool(input.actor.schoolId)).length > 0);
  }
}
