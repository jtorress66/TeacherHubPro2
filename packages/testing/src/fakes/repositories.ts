import type {
  AssignmentId,
  Assignment,
  AttendanceSession,
  Class,
  ClassId,
  Email,
  Game,
  Grade,
  GradeCategory,
  LessonPlan,
  LocalDate,
  School,
  SchoolId,
  Semester,
  Student,
  StudentId,
  Submission,
  Subscription,
  User,
  UserId,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  GameRepository,
  GradeCategoryRepository,
  GradeRepository,
  LessonPlanRepository,
  SchoolOwned,
  SchoolRepository,
  ScopedRepository,
  SemesterRepository,
  StudentRepository,
  SubmissionRepository,
  SubscriptionRepository,
  UserRepository,
} from '@thp/ports';

/** In-memory storage shared by the fake repositories. Every read is scoped to a school. */
export class InMemoryScopedRepository<T extends SchoolOwned> implements ScopedRepository<T> {
  protected readonly rows = new Map<string, T>();

  findById(schoolId: SchoolId, id: T['id']): Promise<T | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row?.schoolId === schoolId ? row : null);
  }

  save(entity: T): Promise<void> {
    this.rows.set(entity.id, entity);
    return Promise.resolve();
  }

  delete(schoolId: SchoolId, id: T['id']): Promise<void> {
    if (this.rows.get(id)?.schoolId === schoolId) this.rows.delete(id);
    return Promise.resolve();
  }

  protected listWhere(
    schoolId: SchoolId,
    matches: (row: T) => boolean = () => true,
  ): Promise<readonly T[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((row) => row.schoolId === schoolId && matches(row)),
    );
  }

  protected findWhere(matches: (row: T) => boolean): Promise<T | null> {
    return Promise.resolve([...this.rows.values()].find(matches) ?? null);
  }
}

export class InMemorySchoolRepository implements SchoolRepository {
  private readonly rows = new Map<SchoolId, School>();

  findById(id: SchoolId): Promise<School | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  save(school: School): Promise<void> {
    this.rows.set(school.id, school);
    return Promise.resolve();
  }
}

export class InMemoryUserRepository
  extends InMemoryScopedRepository<User>
  implements UserRepository
{
  findByEmail(email: Email): Promise<User | null> {
    return this.findWhere((user) => user.email === email);
  }

  listBySchool(schoolId: SchoolId): Promise<readonly User[]> {
    return this.listWhere(schoolId);
  }
}

export class InMemoryClassRepository
  extends InMemoryScopedRepository<Class>
  implements ClassRepository
{
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Class[]> {
    return this.listWhere(schoolId, (cls) => cls.teacherId === teacherId);
  }
}

export class InMemoryStudentRepository
  extends InMemoryScopedRepository<Student>
  implements StudentRepository
{
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Student[]> {
    return this.listWhere(schoolId, (student) => student.classId === classId);
  }
}

export class InMemorySemesterRepository
  extends InMemoryScopedRepository<Semester>
  implements SemesterRepository
{
  listBySchool(schoolId: SchoolId): Promise<readonly Semester[]> {
    return this.listWhere(schoolId);
  }
}

export class InMemoryLessonPlanRepository
  extends InMemoryScopedRepository<LessonPlan>
  implements LessonPlanRepository
{
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LessonPlan[]> {
    return this.listWhere(schoolId, (plan) => plan.teacherId === teacherId);
  }
}

export class InMemoryGradeCategoryRepository
  extends InMemoryScopedRepository<GradeCategory>
  implements GradeCategoryRepository
{
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly GradeCategory[]> {
    return this.listWhere(schoolId, (category) => category.classId === classId);
  }
}

export class InMemoryAssignmentRepository
  extends InMemoryScopedRepository<Assignment>
  implements AssignmentRepository
{
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Assignment[]> {
    return this.listWhere(schoolId, (assignment) => assignment.classId === classId);
  }
}

export class InMemoryGradeRepository
  extends InMemoryScopedRepository<Grade>
  implements GradeRepository
{
  /** One grade per student and assignment: a new grade replaces the old one. */
  override save(grade: Grade): Promise<void> {
    for (const [id, row] of this.rows) {
      if (row.studentId === grade.studentId && row.assignmentId === grade.assignmentId)
        this.rows.delete(id);
    }
    return super.save(grade);
  }

  findFor(
    schoolId: SchoolId,
    studentId: StudentId,
    assignmentId: AssignmentId,
  ): Promise<Grade | null> {
    return this.findWhere(
      (grade) =>
        grade.schoolId === schoolId &&
        grade.studentId === studentId &&
        grade.assignmentId === assignmentId,
    );
  }

  listByStudent(schoolId: SchoolId, studentId: StudentId): Promise<readonly Grade[]> {
    return this.listWhere(schoolId, (grade) => grade.studentId === studentId);
  }

  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Grade[]> {
    return this.listWhere(schoolId, (grade) => grade.assignmentId === assignmentId);
  }
}

export class InMemorySubmissionRepository
  extends InMemoryScopedRepository<Submission>
  implements SubmissionRepository
{
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Submission[]> {
    return this.listWhere(schoolId, (submission) => submission.assignmentId === assignmentId);
  }
}

export class InMemoryAttendanceSessionRepository
  extends InMemoryScopedRepository<AttendanceSession>
  implements AttendanceSessionRepository
{
  findByClassAndDate(
    schoolId: SchoolId,
    classId: ClassId,
    date: LocalDate,
  ): Promise<AttendanceSession | null> {
    return this.findWhere(
      (session) =>
        session.schoolId === schoolId && session.classId === classId && session.date === date,
    );
  }

  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly AttendanceSession[]> {
    return this.listWhere(schoolId, (session) => session.classId === classId);
  }
}

export class InMemoryGameRepository
  extends InMemoryScopedRepository<Game>
  implements GameRepository
{
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Game[]> {
    return this.listWhere(schoolId, (game) => game.teacherId === teacherId);
  }
}

export class InMemorySubscriptionRepository
  extends InMemoryScopedRepository<Subscription>
  implements SubscriptionRepository
{
  listBySchool(schoolId: SchoolId): Promise<readonly Subscription[]> {
    return this.listWhere(schoolId);
  }

  findByExternalId(externalId: string): Promise<Subscription | null> {
    return this.findWhere((subscription) => subscription.externalId === externalId);
  }
}
