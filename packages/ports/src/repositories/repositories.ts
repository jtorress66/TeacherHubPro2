import type {
  Attachment,
  ClassroomConnection,
  FormsExport,
  StudentInsight,
  StudentNote,
  StudentNoteId,
  StudentLink,
  AiGeneration,
  GenerationSummary,
  PresentationSummary,
  AssignmentId,
  AttendanceSession,
  Assignment,
  Class,
  ClassId,
  Email,
  Game,
  GameId,
  GamePlay,
  LiveAnswer,
  LearningPath,
  LearningPathId,
  LessonAttempt,
  PortalLink,
  SubscriptionId,
  TrialReminderKind,
  LivePlayer,
  LiveSession,
  LiveSessionId,
  Grade,
  GradeCategory,
  GradeCategoryId,
  LessonPlan,
  PlanFolder,
  PlanFolderId,
  PlanTemplate,
  Presentation,
  SubPacket,
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
import type { Deletable, ScopedRepository } from './scoped-repository.ts';

/** A school is its own scope. */
export interface SchoolRepository {
  findById(id: SchoolId): Promise<School | null>;
  save(school: School): Promise<void>;
}

export interface UserRepository extends ScopedRepository<User> {
  /** Unscoped on purpose: sign-in finds a user by email before the school is known. */
  findByEmail(email: Email): Promise<User | null>;
  listBySchool(schoolId: SchoolId): Promise<readonly User[]>;
}

export interface ClassListOptions {
  /** Archived classes are left out unless asked for. */
  readonly includeArchived?: boolean;
}

export interface ClassRepository extends ScopedRepository<Class>, Deletable<Class> {
  listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
    options?: ClassListOptions,
  ): Promise<readonly Class[]>;
  listBySchool(schoolId: SchoolId, options?: ClassListOptions): Promise<readonly Class[]>;
  countBySemester(schoolId: SchoolId, semesterId: SemesterId): Promise<number>;
}

/** A student number is unique within a class; saving a duplicate is refused (it throws). */
export interface StudentRepository extends ScopedRepository<Student>, Deletable<Student> {
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Student[]>;
  /** Saves all the students or none of them. */
  saveMany(students: readonly Student[]): Promise<void>;
}

export interface SemesterRepository extends ScopedRepository<Semester>, Deletable<Semester> {
  listBySchool(schoolId: SchoolId): Promise<readonly Semester[]>;
}

export interface LessonPlanRepository extends ScopedRepository<LessonPlan>, Deletable<LessonPlan> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LessonPlan[]>;
  /** Moves the folder's plans to Unfiled. */
  unfileFolder(schoolId: SchoolId, folderId: PlanFolderId): Promise<void>;
}

export interface PlanFolderRepository extends ScopedRepository<PlanFolder>, Deletable<PlanFolder> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly PlanFolder[]>;
}

export interface PlanTemplateRepository
  extends ScopedRepository<PlanTemplate>, Deletable<PlanTemplate> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly PlanTemplate[]>;
}

export interface AiGenerationRepository
  extends ScopedRepository<AiGeneration>, Deletable<AiGeneration> {
  /** Newest first. */
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly GenerationSummary[]>;
}

export interface PresentationRepository
  extends ScopedRepository<Presentation>, Deletable<Presentation> {
  /** Most recently updated first. */
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly PresentationSummary[]>;
}

/** One substitute packet per class. */
export interface SubPacketRepository {
  findByClass(schoolId: SchoolId, classId: ClassId): Promise<SubPacket | null>;
  save(packet: SubPacket): Promise<void>;
}

export interface GradeCategoryRepository
  extends ScopedRepository<GradeCategory>, Deletable<GradeCategory> {
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly GradeCategory[]>;
}

export interface AssignmentRepository extends ScopedRepository<Assignment>, Deletable<Assignment> {
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Assignment[]>;
  countByCategory(schoolId: SchoolId, categoryId: GradeCategoryId): Promise<number>;
}

/** One grade per student and assignment: saving another replaces it. */
export interface GradeRepository extends ScopedRepository<Grade> {
  findFor(
    schoolId: SchoolId,
    studentId: StudentId,
    assignmentId: AssignmentId,
  ): Promise<Grade | null>;
  listByStudent(schoolId: SchoolId, studentId: StudentId): Promise<readonly Grade[]>;
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Grade[]>;
  /** Every grade for the given assignments (a class's gradebook in one read). */
  listByAssignments(
    schoolId: SchoolId,
    assignmentIds: readonly AssignmentId[],
  ): Promise<readonly Grade[]>;
  deleteByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<void>;
}

export interface SubmissionRepository extends ScopedRepository<Submission> {
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Submission[]>;
  /** A student's one submission for an assignment, if any. */
  findFor(
    schoolId: SchoolId,
    studentId: StudentId,
    assignmentId: AssignmentId,
  ): Promise<Submission | null>;
}

export interface AttachmentRepository extends ScopedRepository<Attachment>, Deletable<Attachment> {
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Attachment[]>;
}

export interface StudentLinkRepository extends ScopedRepository<StudentLink> {
  /** The link behind a presented token (hashed); the school is not known until it is found. */
  findByTokenHash(tokenHash: string): Promise<StudentLink | null>;
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly StudentLink[]>;
}

export interface ClassroomConnectionRepository {
  find(schoolId: SchoolId, teacherId: UserId): Promise<ClassroomConnection | null>;
  save(connection: ClassroomConnection): Promise<void>;
  delete(schoolId: SchoolId, teacherId: UserId): Promise<void>;
}

/** One Forms quiz per assignment: making another replaces it. */
export interface FormsExportRepository {
  find(schoolId: SchoolId, assignmentId: AssignmentId): Promise<FormsExport | null>;
  save(formsExport: FormsExport): Promise<void>;
}

/** Private notes: each teacher sees and deletes only their own. */
export interface StudentNoteRepository {
  save(note: StudentNote): Promise<void>;
  /** Newest first. */
  listFor(
    schoolId: SchoolId,
    studentId: StudentId,
    authorId: UserId,
  ): Promise<readonly StudentNote[]>;
  /** False when there is no such note by this author in the school. */
  delete(schoolId: SchoolId, id: StudentNoteId, authorId: UserId): Promise<boolean>;
}

/** The latest AI insight per teacher and student; saving another replaces it. */
export interface StudentInsightRepository {
  find(schoolId: SchoolId, studentId: StudentId, teacherId: UserId): Promise<StudentInsight | null>;
  save(insight: StudentInsight): Promise<void>;
}

export interface AttendanceSessionRepository extends ScopedRepository<AttendanceSession> {
  findByClassAndDate(
    schoolId: SchoolId,
    classId: ClassId,
    date: LocalDate,
  ): Promise<AttendanceSession | null>;
  /** Oldest first; only the dates within `range` when given. */
  listByClass(
    schoolId: SchoolId,
    classId: ClassId,
    range?: DateRange,
  ): Promise<readonly AttendanceSession[]>;
}

export interface GameRepository extends ScopedRepository<Game>, Deletable<Game> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Game[]>;
  /** The games shared with a class, as its students' links list them. */
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Game[]>;
}

/** Finished plays by roster students; teacher previews are never saved. */
export interface GamePlayRepository extends ScopedRepository<GamePlay> {
  /** Oldest first. */
  listByGame(schoolId: SchoolId, gameId: GameId): Promise<readonly GamePlay[]>;
  deleteByGame(schoolId: SchoolId, gameId: GameId): Promise<void>;
}

export interface SubscriptionRepository extends ScopedRepository<Subscription> {
  listBySchool(schoolId: SchoolId): Promise<readonly Subscription[]>;
  /** Unscoped on purpose: billing webhooks identify a subscription by the provider's id. */
  findByExternalId(externalId: string): Promise<Subscription | null>;
}

/** One comment per student and class: saving another replaces it. */
export interface ReportCardCommentRepository extends ScopedRepository<ReportCardComment> {
  findFor(
    schoolId: SchoolId,
    classId: ClassId,
    studentId: StudentId,
  ): Promise<ReportCardComment | null>;
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly ReportCardComment[]>;
  deleteFor(schoolId: SchoolId, classId: ClassId, studentId: StudentId): Promise<void>;
}

export interface LiveSessionRepository
  extends ScopedRepository<LiveSession>, Deletable<LiveSession> {
  /** Unscoped on purpose: a student's device knows only the PIN. Open sessions only. */
  findOpenByPin(pin: string): Promise<LiveSession | null>;
  /** Newest first. */
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LiveSession[]>;
  listByGame(schoolId: SchoolId, gameId: GameId): Promise<readonly LiveSession[]>;
}

/** The roster students who joined a session. */
export interface LivePlayerRepository extends ScopedRepository<LivePlayer> {
  /** Joined first, first. */
  listBySessions(
    schoolId: SchoolId,
    sessionIds: readonly LiveSessionId[],
  ): Promise<readonly LivePlayer[]>;
  deleteBySession(schoolId: SchoolId, sessionId: LiveSessionId): Promise<void>;
}

/** One answer per player and question: saving a second one fails. */
export interface LiveAnswerRepository {
  save(answer: LiveAnswer): Promise<void>;
  listBySessions(
    schoolId: SchoolId,
    sessionIds: readonly LiveSessionId[],
  ): Promise<readonly LiveAnswer[]>;
  deleteBySession(schoolId: SchoolId, sessionId: LiveSessionId): Promise<void>;
}

export interface LearningPathRepository
  extends ScopedRepository<LearningPath>, Deletable<LearningPath> {
  /** Oldest first. */
  listByStudent(schoolId: SchoolId, studentId: StudentId): Promise<readonly LearningPath[]>;
  /** Oldest first. */
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly LearningPath[]>;
}

/** Every check a student submitted; retries are kept. */
export interface LessonAttemptRepository {
  save(attempt: LessonAttempt): Promise<void>;
  /** Oldest first. */
  listByPaths(
    schoolId: SchoolId,
    pathIds: readonly LearningPathId[],
  ): Promise<readonly LessonAttempt[]>;
  deleteByPath(schoolId: SchoolId, pathId: LearningPathId): Promise<void>;
}

/** Families' portal links; like student links, only the hash of a token is stored. */
export interface PortalLinkRepository extends ScopedRepository<PortalLink> {
  /** The link behind a presented token (hashed); the school is not known until it is found. */
  findByTokenHash(tokenHash: string): Promise<PortalLink | null>;
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly PortalLink[]>;
}

/** Which trial reminders went out, so none is sent twice. */
export interface TrialReminderRepository {
  sentKinds(subscriptionId: SubscriptionId): Promise<readonly TrialReminderKind[]>;
  /** Records a reminder; recording the same one again changes nothing. */
  record(reminder: {
    readonly subscriptionId: SubscriptionId;
    readonly schoolId: SchoolId;
    readonly kind: TrialReminderKind;
    readonly sentAt: Date;
  }): Promise<void>;
}

/** Unscoped on purpose: the worker looks across schools for trials about to end. */
export interface TrialEndingLookup {
  /** Trialing subscriptions whose trial ends after `from` and by `until`. */
  listTrialsEnding(from: Date, until: Date): Promise<readonly Subscription[]>;
}
