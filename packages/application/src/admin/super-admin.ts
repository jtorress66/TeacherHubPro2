import {
  checkMove,
  checkRemoval,
  checkRoleChange,
  createSchool,
  createUser,
  defaultLanguage,
  isLanguage,
  ok,
  startTrial,
  updateSchoolDetails,
  type Class,
  type Result,
  type Role,
  type School,
  type SchoolDetails,
  type SchoolId,
  type SubscriptionId,
  type User,
  type UserId,
  type ValidationError,
} from '@thp/domain';
import type {
  ClassRepository,
  IdGenerator,
  PlatformCounts,
  PlatformStats,
  SchoolCounts,
  SchoolDirectory,
  SchoolRepository,
  SubscriptionRepository,
  UserDirectory,
  UserRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { requireSuperAdmin } from './admin-access.ts';
import { PasswordLinks, type PasswordLinkDeps } from './passwords.ts';

const recentUserCount = 5;
export const maxListedUsers = 200;

export interface PlatformOverview {
  readonly counts: PlatformCounts;
  readonly recentUsers: readonly User[];
  readonly schools: readonly SchoolRow[];
}

export interface SchoolRow {
  readonly school: School;
  readonly counts: SchoolCounts;
}

const rowsOf = (schools: readonly School[], counts: PlatformCounts): SchoolRow[] =>
  schools.map((school) => ({
    school,
    counts: counts.perSchool.find((c) => c.schoolId === school.id) ?? {
      schoolId: school.id,
      users: 0,
      classes: 0,
      students: 0,
    },
  }));

interface Directory {
  readonly schoolDirectory: SchoolDirectory;
  readonly userDirectory: UserDirectory;
  readonly platformStats: PlatformStats;
}

export class GetPlatformOverview {
  constructor(private readonly deps: Directory) {}

  async execute(input: { actor: User }): Promise<Result<PlatformOverview, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const [counts, recentUsers, schools] = await Promise.all([
      this.deps.platformStats.counts(),
      this.deps.userDirectory.search({ limit: recentUserCount }),
      this.deps.schoolDirectory.listAll(),
    ]);
    return ok({ counts, recentUsers, schools: rowsOf(schools, counts) });
  }
}

export class ListSchools {
  constructor(private readonly deps: Omit<Directory, 'userDirectory'>) {}

  async execute(input: { actor: User }): Promise<Result<readonly SchoolRow[], UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const [schools, counts] = await Promise.all([
      this.deps.schoolDirectory.listAll(),
      this.deps.platformStats.counts(),
    ]);
    return ok(rowsOf(schools, counts));
  }
}

/** A new school; its trial starts with its first account. */
export class CreateSchool {
  constructor(
    private readonly deps: { readonly schools: SchoolRepository; readonly ids: IdGenerator },
  ) {}

  async execute(input: {
    actor: User;
    details: SchoolDetails;
  }): Promise<Result<School, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const school = createSchool({ ...input.details, id: this.deps.ids.next() as SchoolId });
    if (!school.ok) return school;
    await this.deps.schools.save(school.value);
    return school;
  }
}

export class UpdateSchool {
  constructor(private readonly deps: { readonly schools: SchoolRepository }) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    details: SchoolDetails;
  }): Promise<Result<School, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const school = await this.deps.schools.findById(input.schoolId);
    if (school === null) return fail('not_found');
    const updated = updateSchoolDetails(school, input.details);
    if (!updated.ok) return updated;
    await this.deps.schools.save(updated.value);
    return updated;
  }
}

/** Only a school nobody belongs to can be deleted. */
export class DeleteSchool {
  constructor(private readonly deps: { readonly schoolDirectory: SchoolDirectory }) {}

  async execute(input: { actor: User; schoolId: SchoolId }): Promise<Result<true, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const deleted = await this.deps.schoolDirectory.delete(input.schoolId);
    if (deleted === 'deleted') return ok(true);
    return fail(deleted);
  }
}

export class ListSchoolClasses {
  constructor(private readonly deps: { readonly classes: ClassRepository }) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
  }): Promise<Result<readonly Class[], UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    return ok(await this.deps.classes.listBySchool(input.schoolId, { includeArchived: true }));
  }
}

export interface UserRow {
  readonly user: User;
  readonly schoolName: string;
}

export class ListAllUsers {
  constructor(
    private readonly deps: {
      readonly userDirectory: UserDirectory;
      readonly schoolDirectory: SchoolDirectory;
    },
  ) {}

  async execute(input: {
    actor: User;
    schoolId?: SchoolId;
    text?: string;
  }): Promise<Result<readonly UserRow[], UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const [users, schools] = await Promise.all([
      this.deps.userDirectory.search({
        ...(input.schoolId === undefined ? {} : { schoolId: input.schoolId }),
        ...(input.text === undefined ? {} : { text: input.text }),
        limit: maxListedUsers,
      }),
      this.deps.schoolDirectory.listAll(),
    ]);
    const names = new Map(schools.map((school) => [school.id, school.name]));
    return ok(users.map((user) => ({ user, schoolName: names.get(user.schoolId) ?? '' })));
  }
}

export interface NewUserDetails {
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly language: string;
}

export type SchoolStaffDeps = PasswordLinkDeps & {
  readonly users: UserRepository;
  readonly schools: SchoolRepository;
  readonly subscriptions: SubscriptionRepository;
};

/** A new account in a school, not yet saved; its email must be free. */
export async function newSchoolUser(
  deps: SchoolStaffDeps,
  schoolId: SchoolId,
  details: NewUserDetails,
): Promise<Result<User, ValidationError | { readonly code: 'email_taken' }>> {
  const user = createUser({
    id: deps.ids.next() as UserId,
    schoolId,
    email: details.email,
    name: details.name,
    role: details.role,
    language: isLanguage(details.language) ? details.language : defaultLanguage,
  });
  if (!user.ok) return user;
  if ((await deps.users.findByEmail(user.value.email)) !== null) {
    return { ok: false, error: { code: 'email_taken' } };
  }
  return user;
}

/** Saves new accounts, starts the school's trial with its first account, and welcomes each one. */
export async function welcomeSchoolUsers(
  deps: SchoolStaffDeps,
  users: readonly User[],
): Promise<void> {
  const links = new PasswordLinks(deps);
  for (const user of users) {
    await deps.users.save(user);
    const subscriptions = await deps.subscriptions.listBySchool(user.schoolId);
    if (subscriptions.length === 0) {
      const trial = startTrial({
        id: deps.ids.next() as SubscriptionId,
        schoolId: user.schoolId,
        ownerId: user.id,
        planId: 'individual_monthly',
        now: deps.clock.now(),
      });
      if (trial.ok) await deps.subscriptions.save(trial.value);
    }
    await links.send(user, 'welcome');
  }
}

/** A super admin adds an account to a school; it gets an email to choose its password. */
export class CreateUser {
  constructor(private readonly deps: SchoolStaffDeps) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    details: NewUserDetails;
  }): Promise<Result<User, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    if ((await this.deps.schools.findById(input.schoolId)) === null) return fail('not_found');
    const user = await newSchoolUser(this.deps, input.schoolId, input.details);
    if (!user.ok) return user;
    await welcomeSchoolUsers(this.deps, [user.value]);
    return user;
  }
}

/** A super admin edits a user; changing school is allowed only for someone without classes. */
export class UpdateUser {
  constructor(
    private readonly deps: {
      readonly users: UserRepository;
      readonly schools: SchoolRepository;
      readonly classes: ClassRepository;
      readonly userDirectory: UserDirectory;
    },
  ) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    userId: UserId;
    details: { name: string; email: string; role: Role; schoolId: SchoolId };
  }): Promise<Result<User, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const user = await this.deps.users.findById(input.schoolId, input.userId);
    if (user === null) return fail('not_found');
    if (input.details.role !== user.role) {
      const role = checkRoleChange(input.actor, user, input.details.role);
      if (!role.ok) return fail(role.error.code);
    }
    const edited = createUser({
      ...user,
      name: input.details.name,
      email: input.details.email,
      role: input.details.role,
    });
    if (!edited.ok) return edited;
    const holder = await this.deps.users.findByEmail(edited.value.email);
    if (holder !== null && holder.id !== user.id) return fail('email_taken');
    const moving = input.details.schoolId !== user.schoolId;
    if (moving) {
      if ((await this.deps.schools.findById(input.details.schoolId)) === null) {
        return fail('not_found');
      }
      const owned = await this.deps.classes.listByTeacher(user.schoolId, user.id, {
        includeArchived: true,
      });
      const move = checkMove(owned.length);
      if (!move.ok) return fail(move.error.code);
    }
    await this.deps.users.save(edited.value);
    if (!moving) return edited;
    await this.deps.userDirectory.moveToSchool(user.id, input.details.schoolId);
    return ok({ ...edited.value, schoolId: input.details.schoolId });
  }
}

/** Deletes another user without classes, with their own work; school records stay. */
export class DeleteUser {
  constructor(
    private readonly deps: {
      readonly users: UserRepository;
      readonly classes: ClassRepository;
      readonly userDirectory: UserDirectory;
    },
  ) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    userId: UserId;
  }): Promise<Result<true, UseCaseError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const user = await this.deps.users.findById(input.schoolId, input.userId);
    if (user === null) return fail('not_found');
    const owned = await this.deps.classes.listByTeacher(user.schoolId, user.id, {
      includeArchived: true,
    });
    const removal = checkRemoval(input.actor, user, owned.length);
    if (!removal.ok) return fail(removal.error.code);
    const deleted = await this.deps.userDirectory.delete(user.id);
    return deleted === 'deleted' ? ok(true) : fail(deleted);
  }
}
