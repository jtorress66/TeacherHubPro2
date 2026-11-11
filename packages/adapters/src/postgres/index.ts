import type { Kysely } from 'kysely';
import type {
  AuditLog,
  RateLimiter,
  AttachmentRepository,
  CanvaConnectionRepository,
  ClassroomConnectionRepository,
  FormsExportRepository,
  StudentInsightRepository,
  PrepBatchRepository,
  PasswordTokenRepository,
  LeadRepository,
  ChatSessionRepository,
  ChatTurnQueue,
  PlatformStats,
  SchoolDirectory,
  UserDirectory,
  StudentNoteRepository,
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
  LiveSessionRepository,
  LearningPathRepository,
  LessonAttemptRepository,
  PortalLinkRepository,
  TrialEndingLookup,
  TrialReminderRepository,
  GradeCategoryRepository,
  GradeRepository,
  LessonPlanRepository,
  PlanFolderRepository,
  PlanTemplateRepository,
  ReportCardCommentRepository,
  PasswordCredentialRepository,
  SchoolRepository,
  SemesterRepository,
  SessionRepository,
  StudentRepository,
  SubmissionRepository,
  SubscriptionRepository,
  UserRepository,
} from '@thp/ports';
import { PostgresAuditLog, PostgresRateLimiter } from './repositories/postgres-hardening.ts';
import { PostgresAssignmentRepository } from './repositories/postgres-assignment-repository.ts';
import { PostgresAttendanceSessionRepository } from './repositories/postgres-attendance-session-repository.ts';
import { PostgresClassRepository } from './repositories/postgres-class-repository.ts';
import { PostgresGameRepository } from './repositories/postgres-game-repository.ts';
import { PostgresGamePlayRepository } from './repositories/postgres-game-play-repository.ts';
import {
  PostgresLiveAnswerRepository,
  PostgresLivePlayerRepository,
  PostgresLiveSessionRepository,
} from './repositories/postgres-live-repositories.ts';
import {
  PostgresLearningPathRepository,
  PostgresLessonAttemptRepository,
} from './repositories/postgres-learning-repositories.ts';
import {
  PostgresPortalLinkRepository,
  PostgresTrialReminderRepository,
} from './repositories/postgres-portal-repositories.ts';
import { PostgresGradeCategoryRepository } from './repositories/postgres-grade-category-repository.ts';
import { PostgresGradeRepository } from './repositories/postgres-grade-repository.ts';
import { PostgresLessonPlanRepository } from './repositories/postgres-lesson-plan-repository.ts';
import { PostgresPlanFolderRepository } from './repositories/postgres-plan-folder-repository.ts';
import { PostgresPlanTemplateRepository } from './repositories/postgres-plan-template-repository.ts';
import {
  PostgresAttachmentRepository,
  PostgresCanvaConnectionRepository,
  PostgresClassroomConnectionRepository,
  PostgresFormsExportRepository,
  PostgresStudentLinkRepository,
} from './repositories/postgres-assignment-repositories.ts';
import {
  PostgresStudentInsightRepository,
  PostgresStudentNoteRepository,
} from './repositories/postgres-student-360-repositories.ts';
import { PostgresPrepBatchRepository } from './repositories/postgres-prep-batch-repository.ts';
import { PostgresRubricRepository } from './repositories/postgres-rubric-repository.ts';
import {
  PostgresPasswordTokenRepository,
  PostgresPlatformStats,
  PostgresSchoolDirectory,
  PostgresUserDirectory,
} from './repositories/postgres-admin-repositories.ts';
import {
  PostgresChat,
  PostgresLeadRepository,
} from './repositories/postgres-marketing-repositories.ts';
import {
  PostgresAiGenerationRepository,
  PostgresPresentationRepository,
  PostgresSubPacketRepository,
} from './repositories/postgres-assistant-repositories.ts';
import { PostgresReportCardCommentRepository } from './repositories/postgres-report-card-comment-repository.ts';
import { PostgresSchoolRepository } from './repositories/postgres-school-repository.ts';
import { PostgresSemesterRepository } from './repositories/postgres-semester-repository.ts';
import { PostgresStudentRepository } from './repositories/postgres-student-repository.ts';
import { PostgresSubmissionRepository } from './repositories/postgres-submission-repository.ts';
import { PostgresSubscriptionRepository } from './repositories/postgres-subscription-repository.ts';
import { PostgresUserRepository } from './repositories/postgres-user-repository.ts';
import { PostgresSessionRepository } from './repositories/postgres-session-repository.ts';
import { PostgresPasswordCredentialRepository } from './repositories/postgres-password-credential-repository.ts';
import type { Database } from './schema.ts';

export { createDatabase } from './database.ts';
export { migrateDown, migrateToLatest, type MigrationOutcome } from './migrate.ts';
export type { Database } from './schema.ts';
export { PostgresFileStore } from './repositories/postgres-file-store.ts';
export { PostgresJobQueue } from './repositories/postgres-job-queue.ts';

export interface PostgresRepositories {
  readonly rateLimiter: RateLimiter;
  readonly auditLog: AuditLog;
  readonly schools: SchoolRepository;
  readonly users: UserRepository;
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly semesters: SemesterRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly planFolders: PlanFolderRepository;
  readonly planTemplates: PlanTemplateRepository;
  readonly generations: AiGenerationRepository;
  readonly presentations: PresentationRepository;
  readonly rubrics: RubricRepository;
  readonly subPackets: SubPacketRepository;
  readonly attachments: AttachmentRepository;
  readonly studentLinks: StudentLinkRepository;
  readonly classroomConnections: ClassroomConnectionRepository;
  readonly canvaConnections: CanvaConnectionRepository;
  readonly formsExports: FormsExportRepository;
  readonly studentNotes: StudentNoteRepository;
  readonly studentInsights: StudentInsightRepository;
  readonly prepBatches: PrepBatchRepository;
  readonly schoolDirectory: SchoolDirectory;
  readonly userDirectory: UserDirectory;
  readonly platformStats: PlatformStats;
  readonly passwordTokens: PasswordTokenRepository;
  readonly leads: LeadRepository;
  readonly chatSessions: ChatSessionRepository;
  readonly chatTurns: ChatTurnQueue;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly reportCardComments: ReportCardCommentRepository;
  readonly submissions: SubmissionRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
  readonly games: GameRepository;
  readonly gamePlays: GamePlayRepository;
  readonly liveSessions: LiveSessionRepository;
  readonly livePlayers: LivePlayerRepository;
  readonly liveAnswers: LiveAnswerRepository;
  readonly learningPaths: LearningPathRepository;
  readonly lessonAttempts: LessonAttemptRepository;
  readonly portalLinks: PortalLinkRepository;
  readonly trialReminders: TrialReminderRepository;
  readonly subscriptions: SubscriptionRepository & TrialEndingLookup;
  readonly sessions: SessionRepository;
  readonly credentials: PasswordCredentialRepository;
}

/** Every repository on one connection pool; wired in each app's composition root. */
export function createPostgresRepositories(db: Kysely<Database>): PostgresRepositories {
  const chat = new PostgresChat(db);
  return {
    rateLimiter: new PostgresRateLimiter(db),
    auditLog: new PostgresAuditLog(db),
    schools: new PostgresSchoolRepository(db),
    users: new PostgresUserRepository(db),
    classes: new PostgresClassRepository(db),
    students: new PostgresStudentRepository(db),
    semesters: new PostgresSemesterRepository(db),
    lessonPlans: new PostgresLessonPlanRepository(db),
    planFolders: new PostgresPlanFolderRepository(db),
    planTemplates: new PostgresPlanTemplateRepository(db),
    generations: new PostgresAiGenerationRepository(db),
    presentations: new PostgresPresentationRepository(db),
    rubrics: new PostgresRubricRepository(db),
    subPackets: new PostgresSubPacketRepository(db),
    attachments: new PostgresAttachmentRepository(db),
    studentLinks: new PostgresStudentLinkRepository(db),
    classroomConnections: new PostgresClassroomConnectionRepository(db),
    canvaConnections: new PostgresCanvaConnectionRepository(db),
    formsExports: new PostgresFormsExportRepository(db),
    studentNotes: new PostgresStudentNoteRepository(db),
    studentInsights: new PostgresStudentInsightRepository(db),
    prepBatches: new PostgresPrepBatchRepository(db),
    schoolDirectory: new PostgresSchoolDirectory(db),
    userDirectory: new PostgresUserDirectory(db),
    platformStats: new PostgresPlatformStats(db),
    passwordTokens: new PostgresPasswordTokenRepository(db),
    leads: new PostgresLeadRepository(db),
    chatSessions: chat,
    chatTurns: chat,
    gradeCategories: new PostgresGradeCategoryRepository(db),
    assignments: new PostgresAssignmentRepository(db),
    grades: new PostgresGradeRepository(db),
    reportCardComments: new PostgresReportCardCommentRepository(db),
    submissions: new PostgresSubmissionRepository(db),
    attendanceSessions: new PostgresAttendanceSessionRepository(db),
    games: new PostgresGameRepository(db),
    gamePlays: new PostgresGamePlayRepository(db),
    liveSessions: new PostgresLiveSessionRepository(db),
    livePlayers: new PostgresLivePlayerRepository(db),
    liveAnswers: new PostgresLiveAnswerRepository(db),
    learningPaths: new PostgresLearningPathRepository(db),
    lessonAttempts: new PostgresLessonAttemptRepository(db),
    portalLinks: new PostgresPortalLinkRepository(db),
    trialReminders: new PostgresTrialReminderRepository(db),
    subscriptions: new PostgresSubscriptionRepository(db),
    sessions: new PostgresSessionRepository(db),
    credentials: new PostgresPasswordCredentialRepository(db),
  };
}
