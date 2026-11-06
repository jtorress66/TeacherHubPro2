import {
  checkRoleChange,
  invalid,
  ok,
  type Result,
  type Role,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import type { ClassRepository, UserRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { adminSchool, findManagedUser } from './admin-access.ts';

export interface SchoolUserRow {
  readonly user: User;
  /** Classes they teach, archived ones included. */
  readonly classes: number;
}

interface Deps {
  readonly users: UserRepository;
  readonly classes: ClassRepository;
}

/** The users of a school an admin manages, with how many classes each one teaches. */
export class ListSchoolUsers {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    actor: User;
    schoolId?: SchoolId;
  }): Promise<Result<readonly SchoolUserRow[], UseCaseError>> {
    const school = adminSchool(input.actor, input.schoolId);
    if (!school.ok) return school;
    const [users, classes] = await Promise.all([
      this.deps.users.listBySchool(school.value),
      this.deps.classes.listBySchool(school.value, { includeArchived: true }),
    ]);
    return ok(
      users.map((user) => ({
        user,
        classes: classes.filter((cls) => cls.teacherId === user.id).length,
      })),
    );
  }
}

/** An admin gives a user of their school a role they are allowed to give. */
export class ChangeUserRole {
  constructor(private readonly deps: Pick<Deps, 'users'>) {}

  async execute(input: {
    actor: User;
    userId: UserId;
    role: Role;
    schoolId?: SchoolId;
  }): Promise<Result<User, UseCaseError>> {
    const user = await findManagedUser(this.deps.users, input.actor, input.userId, input.schoolId);
    if (!user.ok) return user;
    const allowed = checkRoleChange(input.actor, user.value, input.role);
    if (!allowed.ok) return fail(allowed.error.code);
    const changed: User = { ...user.value, role: input.role };
    await this.deps.users.save(changed);
    return ok(changed);
  }
}

/**
 * Hands every class of one teacher to another teacher of the same school, with their students,
 * grades and plans, so the first can be removed or moved without losing student data.
 */
export class TransferClasses {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    actor: User;
    fromUserId: UserId;
    toUserId: UserId;
    schoolId?: SchoolId;
  }): Promise<Result<number, UseCaseError>> {
    const from = await findManagedUser(
      this.deps.users,
      input.actor,
      input.fromUserId,
      input.schoolId,
    );
    if (!from.ok) return from;
    const to = await this.deps.users.findById(from.value.schoolId, input.toUserId);
    if (to === null || to.id === from.value.id) return invalid('toUserId', 'not_allowed');
    const classes = await this.deps.classes.listByTeacher(from.value.schoolId, from.value.id, {
      includeArchived: true,
    });
    for (const cls of classes) await this.deps.classes.save({ ...cls, teacherId: to.id });
    return ok(classes.length);
  }
}
