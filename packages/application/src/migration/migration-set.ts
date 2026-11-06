import type {
  AiGeneration,
  Assignment,
  AttendanceSession,
  Class,
  ClassId,
  Game,
  GameModeRegistry,
  Grade,
  GradeCategory,
  Lead,
  LearningPath,
  LessonPlan,
  MigrationTally,
  PlanFolder,
  PlanTemplate,
  PortalLink,
  Presentation,
  School,
  SchoolId,
  Semester,
  Student,
  StudentId,
  StudentInsight,
  StudentLink,
  StudentNote,
  SubPacket,
  Submission,
  Subscription,
  TrialReminderKind,
  User,
  UserId,
  ValidationError,
} from '@thp/domain';
import type { LegacyDocument, PasswordCredential, TokenHasher, UserRepository } from '@thp/ports';

export interface MigratedReminder {
  readonly subscriptionId: Subscription['id'];
  readonly schoolId: SchoolId;
  readonly kind: TrialReminderKind;
  readonly sentAt: Date;
}

/**
 * Everything the import will write, built and checked in memory first. Old ids are kept, so
 * importing again replaces the same rows and every reference stays correct.
 */
export class MigrationSet {
  readonly schools = new Map<string, School>();
  readonly users = new Map<string, User>();
  readonly credentials: PasswordCredential[] = [];
  readonly subscriptions = new Map<string, Subscription>();
  readonly semesters = new Map<string, Semester>();
  readonly classes = new Map<string, Class>();
  readonly students = new Map<string, Student>();
  readonly folders = new Map<string, PlanFolder>();
  readonly plans: LessonPlan[] = [];
  readonly templates: PlanTemplate[] = [];
  readonly attendance = new Map<string, AttendanceSession>();
  readonly categories = new Map<string, GradeCategory>();
  readonly assignments = new Map<string, Assignment>();
  /** By `assignment|student`: one grade per student and assignment. */
  readonly grades = new Map<string, Grade>();
  /** By `assignment|student`: one submission per student and assignment. */
  readonly submissions = new Map<string, Submission>();
  readonly portalLinks: PortalLink[] = [];
  readonly studentLinks: StudentLink[] = [];
  readonly notes: StudentNote[] = [];
  readonly insights: StudentInsight[] = [];
  readonly subPackets: SubPacket[] = [];
  readonly reminders: MigratedReminder[] = [];
  readonly leads: Lead[] = [];
  readonly games: Game[] = [];
  readonly presentations: Presentation[] = [];
  readonly generations: AiGeneration[] = [];
  readonly learningPaths: LearningPath[] = [];
  /** When each carried-over user signed up in the old app, for their free trial. */
  readonly signedUp = new Map<UserId, Date>();
  /** Existing accounts in the new app that old users were matched to, by new id. */
  readonly adopted = new Map<UserId, User>();

  /** Old users who already have an account in the new app (same email): their new id. */
  private readonly userAliases = new Map<string, UserId>();
  private readonly schoolAliases = new Map<string, SchoolId>();
  /** An old student's id in each class they belong to. */
  private readonly enrolments = new Map<string, Map<string, StudentId>>();

  aliasUser(oldId: string, user: User): void {
    this.userAliases.set(oldId, user.id);
    this.adopted.set(user.id, user);
  }

  aliasSchool(oldId: string, schoolId: SchoolId): void {
    this.schoolAliases.set(oldId, schoolId);
  }

  /** The id an old school has in the new app, if it was carried over or merged. */
  schoolId(oldId: string | null): SchoolId | null {
    if (oldId === null) return null;
    return this.schoolAliases.get(oldId) ?? this.schools.get(oldId)?.id ?? null;
  }

  /** An old user as they are in the new app: carried over, or matched to an existing account. */
  user(oldId: string | null): User | null {
    if (oldId === null) return null;
    const alias = this.userAliases.get(oldId);
    return (
      this.users.get(oldId) ?? (alias === undefined ? null : (this.adopted.get(alias) ?? null))
    );
  }

  enrol(oldId: string, classId: ClassId, student: Student): void {
    const classes = this.enrolments.get(oldId) ?? new Map<string, StudentId>();
    classes.set(classId, student.id);
    this.enrolments.set(oldId, classes);
    this.students.set(student.id, student);
  }

  /** The old student's record in a class; with no class, their first one. */
  student(oldId: string | null, classId?: ClassId): Student | null {
    if (oldId === null) return null;
    const classes = this.enrolments.get(oldId);
    if (classes === undefined) return null;
    const id = classId === undefined ? [...classes.values()][0] : classes.get(classId);
    return id === undefined ? null : (this.students.get(id) ?? null);
  }

  roster(classId: ClassId): readonly Student[] {
    return [...this.students.values()].filter((student) => student.classId === classId);
  }
}

export interface MigrationContext {
  readonly set: MigrationSet;
  readonly tally: MigrationTally;
  readonly now: Date;
  readonly tokens: TokenHasher;
  readonly gameModes: GameModeRegistry;
  /** The new app's users, to match old accounts by email. */
  readonly existingUsers: Pick<UserRepository, 'findByEmail'>;
}

/** Turns one old collection into new records in the set, counting each one. */
export interface LegacyMapper {
  readonly collection: string;
  map(docs: readonly LegacyDocument[], context: MigrationContext): Promise<void> | void;
}

/** The reason for leaving out a record that broke a rule: the field and what was wrong. */
export const invalidReason = (error: ValidationError): string =>
  `invalid_${error.field}_${error.code}`;
