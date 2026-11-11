import type {
  Attachment,
  CanvaConnection,
  ClassroomConnection,
  FormsExport,
  StudentInsight,
  PrepBatch,
  PrepBatchId,
  StudentNote,
  StudentNoteId,
  StudentLink,
  AiGeneration,
  GenerationSummary,
  Presentation,
  PresentationSummary,
  Rubric,
  SubPacket,
  AssignmentId,
  Assignment,
  AttendanceSession,
  Class,
  ClassId,
  Email,
  Game,
  GameId,
  GamePlay,
  LiveAnswer,
  LivePlayer,
  LiveSession,
  LiveSessionId,
  LearningPath,
  LearningPathId,
  LessonAttempt,
  PortalLink,
  SubscriptionId,
  TrialReminderKind,
  Grade,
  GradeCategory,
  GradeCategoryId,
  LessonPlan,
  PlanFolder,
  PlanFolderId,
  PlanTemplate,
  DateRange,
  LocalDate,
  ReportCardComment,
  School,
  SchoolId,
  Semester,
  SemesterId,
  Student,
  StudentId,
  Submission,
  Subscription,
  User,
  UserId,
} from '@thp/domain';
import { compareDates, generationSummary, inRange, presentationSummary } from '@thp/domain';
import type {
  AttachmentRepository,
  ClassroomConnectionRepository,
  FormsExportRepository,
  StudentInsightRepository,
  StudentNoteRepository,
  PrepBatchRepository,
  StudentLinkRepository,
  AiGenerationRepository,
  PresentationRepository,
  RubricRepository,
  SubPacketRepository,
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  GameRepository,
  GamePlayRepository,
  LiveAnswerRepository,
  LivePlayerRepository,
  LearningPathRepository,
  LessonAttemptRepository,
  PortalLinkRepository,
  TrialEndingLookup,
  TrialReminderRepository,
  LiveSessionRepository,
  GradeCategoryRepository,
  GradeRepository,
  LessonPlanRepository,
  PlanFolderRepository,
  PlanTemplateRepository,
  ReportCardCommentRepository,
  SchoolOwned,
  SchoolRepository,
  ScopedRepository,
  ClassListOptions,
  SemesterRepository,
  StudentRepository,
  SubmissionRepository,
  SubscriptionRepository,
  UserRepository,
  CanvaConnectionRepository,
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

  /** Test helper: every stored row, in every school. */
  all(): readonly T[] {
    return [...this.rows.values()];
  }

  /** Test helper: removes a row whatever its school. */
  remove(id: string): void {
    this.rows.delete(id);
  }

  /** Test helper: stores a row as given, even under a new school. */
  replace(entity: T): void {
    this.rows.set(entity.id, entity);
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

  /** Test helper: every school. */
  all(): readonly School[] {
    return [...this.rows.values()];
  }

  /** Test helper: removes a school. */
  remove(id: SchoolId): void {
    this.rows.delete(id);
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
  listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
    options: ClassListOptions = {},
  ): Promise<readonly Class[]> {
    return this.listWhere(
      schoolId,
      (cls) =>
        cls.teacherId === teacherId &&
        (options.includeArchived === true || cls.archivedAt === null),
    );
  }

  listBySchool(schoolId: SchoolId, options: ClassListOptions = {}): Promise<readonly Class[]> {
    return this.listWhere(
      schoolId,
      (cls) => options.includeArchived === true || cls.archivedAt === null,
    );
  }

  async countBySemester(schoolId: SchoolId, semesterId: SemesterId): Promise<number> {
    return (await this.listWhere(schoolId, (cls) => cls.semesterId === semesterId)).length;
  }
}

export class InMemoryStudentRepository
  extends InMemoryScopedRepository<Student>
  implements StudentRepository
{
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Student[]> {
    return this.listWhere(schoolId, (student) => student.classId === classId);
  }

  override save(student: Student): Promise<void> {
    return this.saveMany([student]);
  }

  /** All or nothing: a student number repeated within a class refuses the whole batch. */
  saveMany(students: readonly Student[]): Promise<void> {
    const after = new Map(this.rows);
    for (const student of students) after.set(student.id, student);
    const numbers = new Set<string>();
    for (const student of after.values()) {
      if (student.studentNumber === null) continue;
      const key = `${student.classId}/${student.studentNumber}`;
      if (numbers.has(key)) return Promise.reject(new Error(`Duplicate student number ${key}`));
      numbers.add(key);
    }
    for (const student of students) this.rows.set(student.id, student);
    return Promise.resolve();
  }
}

export class InMemorySemesterRepository
  extends InMemoryScopedRepository<Semester>
  implements SemesterRepository
{
  listBySchool(schoolId: SchoolId): Promise<readonly Semester[]> {
    return this.listWhere(schoolId);
  }

  /** At most one active semester per school, like the database's partial unique index. */
  override save(semester: Semester): Promise<void> {
    const clash = [...this.rows.values()].some(
      (other) =>
        other.id !== semester.id &&
        other.schoolId === semester.schoolId &&
        other.isActive &&
        semester.isActive,
    );
    if (clash) return Promise.reject(new Error('A school can have only one active semester'));
    return super.save(semester);
  }
}

export class InMemoryLessonPlanRepository
  extends InMemoryScopedRepository<LessonPlan>
  implements LessonPlanRepository
{
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LessonPlan[]> {
    return this.listWhere(schoolId, (plan) => plan.teacherId === teacherId);
  }

  unfileFolder(schoolId: SchoolId, folderId: PlanFolderId): Promise<void> {
    for (const plan of this.rows.values()) {
      if (plan.schoolId === schoolId && plan.folderId === folderId) {
        this.rows.set(plan.id, { ...plan, folderId: null });
      }
    }
    return Promise.resolve();
  }
}

export class InMemoryPlanFolderRepository
  extends InMemoryScopedRepository<PlanFolder>
  implements PlanFolderRepository
{
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly PlanFolder[]> {
    return this.listWhere(schoolId, (folder) => folder.teacherId === teacherId);
  }
}

export class InMemoryPlanTemplateRepository
  extends InMemoryScopedRepository<PlanTemplate>
  implements PlanTemplateRepository
{
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly PlanTemplate[]> {
    return this.listWhere(schoolId, (template) => template.teacherId === teacherId);
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

  async countByCategory(schoolId: SchoolId, categoryId: GradeCategoryId): Promise<number> {
    return (await this.listWhere(schoolId, (assignment) => assignment.categoryId === categoryId))
      .length;
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

  listByAssignments(
    schoolId: SchoolId,
    assignmentIds: readonly AssignmentId[],
  ): Promise<readonly Grade[]> {
    const wanted = new Set(assignmentIds);
    return this.listWhere(schoolId, (grade) => wanted.has(grade.assignmentId));
  }

  async deleteByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<void> {
    for (const grade of await this.listByAssignment(schoolId, assignmentId)) {
      this.rows.delete(grade.id);
    }
  }
}

export class InMemoryReportCardCommentRepository
  extends InMemoryScopedRepository<ReportCardComment>
  implements ReportCardCommentRepository
{
  /** One comment per student and class: a new comment replaces the old one. */
  override async save(comment: ReportCardComment): Promise<void> {
    await this.deleteFor(comment.schoolId, comment.classId, comment.studentId);
    return super.save(comment);
  }

  findFor(
    schoolId: SchoolId,
    classId: ClassId,
    studentId: StudentId,
  ): Promise<ReportCardComment | null> {
    return this.findWhere(
      (c) => c.schoolId === schoolId && c.classId === classId && c.studentId === studentId,
    );
  }

  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly ReportCardComment[]> {
    return this.listWhere(schoolId, (comment) => comment.classId === classId);
  }

  async deleteFor(schoolId: SchoolId, classId: ClassId, studentId: StudentId): Promise<void> {
    const comment = await this.findFor(schoolId, classId, studentId);
    if (comment) this.rows.delete(comment.id);
  }
}

export class InMemorySubmissionRepository
  extends InMemoryScopedRepository<Submission>
  implements SubmissionRepository
{
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Submission[]> {
    return this.listWhere(schoolId, (submission) => submission.assignmentId === assignmentId);
  }

  findFor(
    schoolId: SchoolId,
    studentId: StudentId,
    assignmentId: AssignmentId,
  ): Promise<Submission | null> {
    return this.findWhere(
      (row) =>
        row.schoolId === schoolId &&
        row.studentId === studentId &&
        row.assignmentId === assignmentId,
    );
  }

  /** One submission per student and assignment, as the database enforces. */
  override save(submission: Submission): Promise<void> {
    const taken = [...this.rows.values()].some(
      (row) =>
        row.id !== submission.id &&
        row.schoolId === submission.schoolId &&
        row.studentId === submission.studentId &&
        row.assignmentId === submission.assignmentId,
    );
    return taken ? Promise.reject(new Error('duplicate submission')) : super.save(submission);
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

  async listByClass(
    schoolId: SchoolId,
    classId: ClassId,
    range?: DateRange,
  ): Promise<readonly AttendanceSession[]> {
    const sessions = await this.listWhere(
      schoolId,
      (session) =>
        session.classId === classId && (range === undefined || inRange(session.date, range)),
    );
    return [...sessions].sort((a, b) => compareDates(a.date, b.date));
  }
}

export class InMemoryGameRepository
  extends InMemoryScopedRepository<Game>
  implements GameRepository
{
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Game[]> {
    return this.listWhere(schoolId, (game) => game.teacherId === teacherId);
  }

  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Game[]> {
    return this.listWhere(schoolId, (game) => game.classId === classId);
  }
}

export class InMemoryGamePlayRepository
  extends InMemoryScopedRepository<GamePlay>
  implements GamePlayRepository
{
  async listByGame(schoolId: SchoolId, gameId: GameId): Promise<readonly GamePlay[]> {
    const plays = await this.listWhere(schoolId, (play) => play.gameId === gameId);
    return [...plays].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  }

  deleteByGame(schoolId: SchoolId, gameId: GameId): Promise<void> {
    for (const play of this.rows.values()) {
      if (play.schoolId === schoolId && play.gameId === gameId) this.rows.delete(play.id);
    }
    return Promise.resolve();
  }
}

export class InMemorySubscriptionRepository
  extends InMemoryScopedRepository<Subscription>
  implements SubscriptionRepository, TrialEndingLookup
{
  listTrialsEnding(from: Date, until: Date): Promise<readonly Subscription[]> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (row) =>
          row.status === 'trialing' &&
          row.trialEndsAt.getTime() > from.getTime() &&
          row.trialEndsAt.getTime() <= until.getTime(),
      ),
    );
  }

  listBySchool(schoolId: SchoolId): Promise<readonly Subscription[]> {
    return this.listWhere(schoolId);
  }

  findByExternalId(externalId: string): Promise<Subscription | null> {
    return this.findWhere((subscription) => subscription.externalId === externalId);
  }
}

export class InMemoryAiGenerationRepository
  extends InMemoryScopedRepository<AiGeneration>
  implements AiGenerationRepository
{
  async listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
  ): Promise<readonly GenerationSummary[]> {
    const rows = await this.listWhere(schoolId, (row) => row.teacherId === teacherId);
    return [...rows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(generationSummary);
  }
}

export class InMemoryPresentationRepository
  extends InMemoryScopedRepository<Presentation>
  implements PresentationRepository
{
  async listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
  ): Promise<readonly PresentationSummary[]> {
    const rows = await this.listWhere(schoolId, (row) => row.teacherId === teacherId);
    return [...rows]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(presentationSummary);
  }
}

export class InMemoryRubricRepository
  extends InMemoryScopedRepository<Rubric>
  implements RubricRepository
{
  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Rubric[]> {
    const rows = await this.listWhere(schoolId, (row) => row.teacherId === teacherId);
    return [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

export class InMemorySubPacketRepository implements SubPacketRepository {
  private readonly rows = new Map<ClassId, SubPacket>();

  findByClass(schoolId: SchoolId, classId: ClassId): Promise<SubPacket | null> {
    const row = this.rows.get(classId);
    return Promise.resolve(row?.schoolId === schoolId ? row : null);
  }

  save(packet: SubPacket): Promise<void> {
    this.rows.set(packet.classId, packet);
    return Promise.resolve();
  }
}

export class InMemoryAttachmentRepository
  extends InMemoryScopedRepository<Attachment>
  implements AttachmentRepository
{
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Attachment[]> {
    return this.listWhere(schoolId, (row) => row.assignmentId === assignmentId);
  }
}

export class InMemoryStudentLinkRepository
  extends InMemoryScopedRepository<StudentLink>
  implements StudentLinkRepository
{
  findByTokenHash(tokenHash: string): Promise<StudentLink | null> {
    return this.findWhere((row) => row.tokenHash === tokenHash);
  }

  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly StudentLink[]> {
    return this.listWhere(schoolId, (row) => row.classId === classId);
  }
}

export class InMemoryClassroomConnectionRepository implements ClassroomConnectionRepository {
  private readonly rows = new Map<UserId, ClassroomConnection>();

  find(schoolId: SchoolId, teacherId: UserId): Promise<ClassroomConnection | null> {
    const row = this.rows.get(teacherId);
    return Promise.resolve(row?.schoolId === schoolId ? row : null);
  }

  save(connection: ClassroomConnection): Promise<void> {
    this.rows.set(connection.teacherId, connection);
    return Promise.resolve();
  }

  delete(schoolId: SchoolId, teacherId: UserId): Promise<void> {
    if (this.rows.get(teacherId)?.schoolId === schoolId) this.rows.delete(teacherId);
    return Promise.resolve();
  }
}

export class InMemoryCanvaConnectionRepository implements CanvaConnectionRepository {
  private readonly rows = new Map<UserId, CanvaConnection>();

  find(schoolId: SchoolId, teacherId: UserId): Promise<CanvaConnection | null> {
    const row = this.rows.get(teacherId);
    return Promise.resolve(row?.schoolId === schoolId ? row : null);
  }

  save(connection: CanvaConnection): Promise<void> {
    this.rows.set(connection.teacherId, connection);
    return Promise.resolve();
  }

  delete(schoolId: SchoolId, teacherId: UserId): Promise<void> {
    if (this.rows.get(teacherId)?.schoolId === schoolId) this.rows.delete(teacherId);
    return Promise.resolve();
  }
}

export class InMemoryFormsExportRepository implements FormsExportRepository {
  private readonly rows = new Map<AssignmentId, FormsExport>();

  find(schoolId: SchoolId, assignmentId: AssignmentId): Promise<FormsExport | null> {
    const row = this.rows.get(assignmentId);
    return Promise.resolve(row?.schoolId === schoolId ? row : null);
  }

  save(formsExport: FormsExport): Promise<void> {
    this.rows.set(formsExport.assignmentId, formsExport);
    return Promise.resolve();
  }
}

export class InMemoryStudentNoteRepository implements StudentNoteRepository {
  private readonly rows = new Map<StudentNoteId, StudentNote>();

  save(note: StudentNote): Promise<void> {
    this.rows.set(note.id, note);
    return Promise.resolve();
  }

  listFor(
    schoolId: SchoolId,
    studentId: StudentId,
    authorId: UserId,
  ): Promise<readonly StudentNote[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(
          (n) => n.schoolId === schoolId && n.studentId === studentId && n.authorId === authorId,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  }

  delete(schoolId: SchoolId, id: StudentNoteId, authorId: UserId): Promise<boolean> {
    const row = this.rows.get(id);
    if (row?.schoolId !== schoolId || row.authorId !== authorId) return Promise.resolve(false);
    this.rows.delete(id);
    return Promise.resolve(true);
  }
}

export class InMemoryStudentInsightRepository implements StudentInsightRepository {
  private readonly rows = new Map<string, StudentInsight>();

  private static key(schoolId: SchoolId, studentId: StudentId, teacherId: UserId) {
    return `${schoolId}|${studentId}|${teacherId}`;
  }

  find(
    schoolId: SchoolId,
    studentId: StudentId,
    teacherId: UserId,
  ): Promise<StudentInsight | null> {
    return Promise.resolve(
      this.rows.get(InMemoryStudentInsightRepository.key(schoolId, studentId, teacherId)) ?? null,
    );
  }

  save(insight: StudentInsight): Promise<void> {
    this.rows.set(
      InMemoryStudentInsightRepository.key(insight.schoolId, insight.studentId, insight.teacherId),
      insight,
    );
    return Promise.resolve();
  }
}

export class InMemoryLiveSessionRepository
  extends InMemoryScopedRepository<LiveSession>
  implements LiveSessionRepository
{
  findOpenByPin(pin: string): Promise<LiveSession | null> {
    return this.findWhere((row) => row.pin === pin && row.status !== 'ended');
  }

  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LiveSession[]> {
    const rows = await this.listWhere(schoolId, (row) => row.teacherId === teacherId);
    return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listByGame(schoolId: SchoolId, gameId: GameId): Promise<readonly LiveSession[]> {
    const rows = await this.listWhere(schoolId, (row) => row.gameId === gameId);
    return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export class InMemoryLivePlayerRepository
  extends InMemoryScopedRepository<LivePlayer>
  implements LivePlayerRepository
{
  /** One active seat per student and session, as the database enforces. */
  override save(player: LivePlayer): Promise<void> {
    const taken = [...this.rows.values()].some(
      (row) =>
        row.id !== player.id &&
        row.sessionId === player.sessionId &&
        row.studentId === player.studentId &&
        row.removedAt === null &&
        player.removedAt === null,
    );
    if (taken) return Promise.reject(new Error('This student is already playing'));
    return super.save(player);
  }

  async listBySessions(
    schoolId: SchoolId,
    sessionIds: readonly LiveSessionId[],
  ): Promise<readonly LivePlayer[]> {
    const rows = await this.listWhere(schoolId, (row) => sessionIds.includes(row.sessionId));
    return [...rows].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  }

  deleteBySession(schoolId: SchoolId, sessionId: LiveSessionId): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.schoolId === schoolId && row.sessionId === sessionId) this.rows.delete(row.id);
    }
    return Promise.resolve();
  }
}

export class InMemoryLiveAnswerRepository implements LiveAnswerRepository {
  private readonly rows: LiveAnswer[] = [];

  save(answer: LiveAnswer): Promise<void> {
    const taken = this.rows.some(
      (row) => row.playerId === answer.playerId && row.question === answer.question,
    );
    if (taken) return Promise.reject(new Error('This question is already answered'));
    this.rows.push(answer);
    return Promise.resolve();
  }

  listBySessions(
    schoolId: SchoolId,
    sessionIds: readonly LiveSessionId[],
  ): Promise<readonly LiveAnswer[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.schoolId === schoolId && sessionIds.includes(row.sessionId))
        .sort((a, b) => a.question - b.question),
    );
  }

  deleteBySession(schoolId: SchoolId, sessionId: LiveSessionId): Promise<void> {
    const kept = this.rows.filter(
      (row) => row.schoolId !== schoolId || row.sessionId !== sessionId,
    );
    this.rows.splice(0, this.rows.length, ...kept);
    return Promise.resolve();
  }
}

export class InMemoryLearningPathRepository
  extends InMemoryScopedRepository<LearningPath>
  implements LearningPathRepository
{
  /** One assigned path per student and subject, as the database enforces. */
  override save(path: LearningPath): Promise<void> {
    const taken =
      path.status === 'assigned' &&
      [...this.rows.values()].some(
        (row) =>
          row.id !== path.id &&
          row.schoolId === path.schoolId &&
          row.studentId === path.studentId &&
          row.subject === path.subject &&
          row.status === 'assigned',
      );
    if (taken) return Promise.reject(new Error('The student already has an assigned path'));
    return super.save(path);
  }

  async listByStudent(schoolId: SchoolId, studentId: StudentId): Promise<readonly LearningPath[]> {
    const rows = await this.listWhere(schoolId, (row) => row.studentId === studentId);
    return [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly LearningPath[]> {
    const rows = await this.listWhere(schoolId, (row) => row.classId === classId);
    return [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export class InMemoryLessonAttemptRepository implements LessonAttemptRepository {
  private rows: LessonAttempt[] = [];

  save(attempt: LessonAttempt): Promise<void> {
    this.rows = [...this.rows.filter((row) => row.id !== attempt.id), attempt];
    return Promise.resolve();
  }

  listByPaths(
    schoolId: SchoolId,
    pathIds: readonly LearningPathId[],
  ): Promise<readonly LessonAttempt[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.schoolId === schoolId && pathIds.includes(row.pathId))
        .sort((a, b) => a.at.getTime() - b.at.getTime()),
    );
  }

  deleteByPath(schoolId: SchoolId, pathId: LearningPathId): Promise<void> {
    this.rows = this.rows.filter((row) => row.schoolId !== schoolId || row.pathId !== pathId);
    return Promise.resolve();
  }
}

export class InMemoryPortalLinkRepository
  extends InMemoryScopedRepository<PortalLink>
  implements PortalLinkRepository
{
  findByTokenHash(tokenHash: string): Promise<PortalLink | null> {
    return this.findWhere((row) => row.tokenHash === tokenHash);
  }

  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly PortalLink[]> {
    return this.listWhere(schoolId, (row) => row.classId === classId);
  }
}

export class InMemoryTrialReminderRepository implements TrialReminderRepository {
  private readonly sent = new Map<SubscriptionId, Set<TrialReminderKind>>();

  sentKinds(subscriptionId: SubscriptionId): Promise<readonly TrialReminderKind[]> {
    return Promise.resolve([...(this.sent.get(subscriptionId) ?? [])]);
  }

  record(reminder: {
    readonly subscriptionId: SubscriptionId;
    readonly kind: TrialReminderKind;
  }): Promise<void> {
    const kinds = this.sent.get(reminder.subscriptionId) ?? new Set<TrialReminderKind>();
    kinds.add(reminder.kind);
    this.sent.set(reminder.subscriptionId, kinds);
    return Promise.resolve();
  }
}

export class InMemoryPrepBatchRepository implements PrepBatchRepository {
  private readonly rows = new Map<PrepBatchId, PrepBatch>();

  save(batch: PrepBatch): Promise<void> {
    this.rows.set(batch.id, batch);
    return Promise.resolve();
  }

  find(schoolId: SchoolId, teacherId: UserId, id: PrepBatchId): Promise<PrepBatch | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row?.schoolId === schoolId && row.teacherId === teacherId ? row : null);
  }

  private mine(schoolId: SchoolId, teacherId: UserId): PrepBatch[] {
    return [...this.rows.values()].filter(
      (b) => b.schoolId === schoolId && b.teacherId === teacherId,
    );
  }

  listForTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
    limit: number,
  ): Promise<readonly PrepBatch[]> {
    return Promise.resolve(
      this.mine(schoolId, teacherId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit),
    );
  }

  countReady(schoolId: SchoolId, teacherId: UserId): Promise<number> {
    return Promise.resolve(
      this.mine(schoolId, teacherId).filter((b) => b.status === 'ready').length,
    );
  }

  async delete(schoolId: SchoolId, teacherId: UserId, id: PrepBatchId): Promise<boolean> {
    if ((await this.find(schoolId, teacherId, id)) === null) return false;
    this.rows.delete(id);
    return true;
  }
}
