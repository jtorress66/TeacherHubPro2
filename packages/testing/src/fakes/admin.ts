import { roles, type PasswordToken, type Role, type SchoolId, type UserId } from '@thp/domain';
import type {
  PasswordTokenRepository,
  PlatformCounts,
  PlatformStats,
  SchoolDirectory,
  UserDirectory,
  UserSearch,
} from '@thp/ports';
import type {
  InMemoryAiGenerationRepository,
  InMemoryClassRepository,
  InMemoryGradeRepository,
  InMemoryLessonPlanRepository,
  InMemoryPresentationRepository,
  InMemorySchoolRepository,
  InMemoryStudentRepository,
  InMemorySubscriptionRepository,
  InMemoryUserRepository,
} from './repositories.ts';

/** The in-memory repositories the admin fakes read and change. */
export interface InMemoryAdminStores {
  readonly schools: InMemorySchoolRepository;
  readonly users: InMemoryUserRepository;
  readonly classes: InMemoryClassRepository;
  readonly students: InMemoryStudentRepository;
  readonly lessonPlans: InMemoryLessonPlanRepository;
  readonly presentations: InMemoryPresentationRepository;
  readonly generations: InMemoryAiGenerationRepository;
  readonly grades: InMemoryGradeRepository;
  readonly subscriptions: InMemorySubscriptionRepository;
}

/** The teacher's own work, which goes with them when they are deleted or move schools. */
const ownWork = (stores: InMemoryAdminStores) =>
  [stores.lessonPlans, stores.presentations, stores.generations] as const;

/** Every school, over the in-memory school, user, class and subscription stores. */
export class InMemorySchoolDirectory implements SchoolDirectory {
  constructor(private readonly stores: InMemoryAdminStores) {}

  listAll() {
    return Promise.resolve(
      [...this.stores.schools.all()].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  delete(id: SchoolId): Promise<'deleted' | 'in_use' | 'not_found'> {
    const { schools, users, classes, subscriptions } = this.stores;
    if (!schools.all().some((school) => school.id === id)) return Promise.resolve('not_found');
    const used = [users.all(), classes.all(), subscriptions.all()].some((rows) =>
      rows.some((row) => row.schoolId === id),
    );
    if (used) return Promise.resolve('in_use');
    schools.remove(id);
    return Promise.resolve('deleted');
  }
}

/** Users across schools; deleting refuses while school records name the user, as Postgres does. */
export class InMemoryUserDirectory implements UserDirectory {
  constructor(private readonly stores: InMemoryAdminStores) {}

  search(query: UserSearch) {
    const text = query.text?.trim().toLowerCase() ?? '';
    return Promise.resolve(
      this.stores.users
        .all()
        .filter((u) => query.schoolId === undefined || u.schoolId === query.schoolId)
        .filter(
          (u) =>
            text === '' ||
            u.name.toLowerCase().includes(text) ||
            u.email.toLowerCase().includes(text),
        )
        .reverse()
        .slice(0, query.limit),
    );
  }

  countByRole(role: Role) {
    return Promise.resolve(this.stores.users.all().filter((u) => u.role === role).length);
  }

  delete(id: UserId): Promise<'deleted' | 'in_use' | 'not_found'> {
    const { users, classes, subscriptions, grades } = this.stores;
    const user = users.all().find((u) => u.id === id);
    if (user === undefined) return Promise.resolve('not_found');
    const named =
      classes.all().some((c) => c.teacherId === id) ||
      subscriptions.all().some((s) => s.ownerId === id) ||
      grades.all().some((g) => g.gradedBy === id);
    if (named) return Promise.resolve('in_use');
    for (const store of ownWork(this.stores)) {
      for (const row of store.all().filter((r) => r.teacherId === id)) store.remove(row.id);
    }
    users.remove(id);
    return Promise.resolve('deleted');
  }

  async moveToSchool(id: UserId, schoolId: SchoolId): Promise<void> {
    const user = this.stores.users.all().find((u) => u.id === id);
    if (user === undefined) return;
    await this.stores.users.save({ ...user, schoolId });
    for (const store of ownWork(this.stores)) {
      for (const row of store.all().filter((r) => r.teacherId === id)) {
        store.replace({ ...row, schoolId } as never);
      }
    }
  }
}

export class InMemoryPlatformStats implements PlatformStats {
  constructor(private readonly stores: InMemoryAdminStores) {}

  counts(): Promise<PlatformCounts> {
    const { schools, users, classes, students, lessonPlans } = this.stores;
    const count = (rows: readonly { readonly schoolId: SchoolId }[], id: SchoolId) =>
      rows.filter((row) => row.schoolId === id).length;
    return Promise.resolve({
      schools: schools.all().length,
      users: Object.fromEntries(
        roles.map((role) => [role, users.all().filter((u) => u.role === role).length]),
      ) as Record<Role, number>,
      classes: classes.all().length,
      students: students.all().length,
      lessonPlans: lessonPlans.all().length,
      perSchool: schools.all().map((school) => ({
        schoolId: school.id,
        users: count(users.all(), school.id),
        classes: count(classes.all(), school.id),
        students: count(students.all(), school.id),
      })),
    });
  }
}

export class InMemoryPasswordTokenRepository implements PasswordTokenRepository {
  private readonly rows = new Map<string, PasswordToken>();

  save(token: PasswordToken): Promise<void> {
    this.rows.set(token.id, token);
    return Promise.resolve();
  }

  findByHash(tokenHash: string): Promise<PasswordToken | null> {
    return Promise.resolve([...this.rows.values()].find((t) => t.tokenHash === tokenHash) ?? null);
  }

  revokeFor(userId: UserId, now: Date): Promise<void> {
    for (const token of this.rows.values()) {
      if (token.userId === userId && token.usedAt === null) {
        this.rows.set(token.id, { ...token, usedAt: now });
      }
    }
    return Promise.resolve();
  }

  /** Test helper: every stored link. */
  all(): readonly PasswordToken[] {
    return [...this.rows.values()];
  }
}
