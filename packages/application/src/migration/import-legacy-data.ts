import { MigrationTally, type GameModeRegistry, type MigrationReport } from '@thp/domain';
import type {
  AiGenerationRepository,
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  Clock,
  GameRepository,
  GradeCategoryRepository,
  GradeRepository,
  LeadRepository,
  LearningPathRepository,
  LegacySource,
  LessonPlanRepository,
  PasswordCredentialRepository,
  PlanFolderRepository,
  PlanTemplateRepository,
  PortalLinkRepository,
  PresentationRepository,
  SchoolRepository,
  SemesterRepository,
  StudentInsightRepository,
  StudentLinkRepository,
  StudentNoteRepository,
  StudentRepository,
  SubmissionRepository,
  SubPacketRepository,
  SubscriptionRepository,
  TokenHasher,
  TrialReminderRepository,
  UserRepository,
} from '@thp/ports';
import {
  schoolsMapper,
  semestersMapper,
  subscriptionsMapper,
  usersMapper,
} from './account-mappers.ts';
import { attendanceMapper } from './attendance-mapper.ts';
import { classesMapper, studentsMapper } from './class-mappers.ts';
import {
  gamesMapper,
  generationsMapper,
  learningPathsMapper,
  presentationsMapper,
} from './content-mappers.ts';
import {
  leadsMapper,
  studentInsightsMapper,
  studentNotesMapper,
  subPacketsMapper,
  trialRemindersMapper,
} from './extra-mappers.ts';
import {
  aiSubmissionsMapper,
  assignmentsMapper,
  gradeCategoriesMapper,
  gradesMapper,
} from './gradebook-mappers.ts';
import { learningTokensMapper, portalTokensMapper } from './link-mappers.ts';
import { MigrationSet, type LegacyMapper } from './migration-set.ts';
import { lessonPlansMapper, planFoldersMapper } from './plan-mappers.ts';

/** Old collections that are not carried over, and why. */
export const leftOutCollections: Readonly<Record<string, string>> = {
  user_sessions: 'transient',
  generation_jobs: 'transient',
  grading_jobs: 'transient',
  chatbot_sessions: 'transient',
  ai_chat_messages: 'transient',
  game_regenerations: 'transient',
  game_progress: 'transient',
  game_scores: 'kept_as_grades',
  adaptive_learning_progress: 'no_scores_to_carry',
  ai_templates: 'no_counterpart',
  attendance_records: 'not_used_by_old_app',
  practice_assignments: 'no_counterpart',
  practice_sessions: 'no_counterpart',
  practice_results: 'no_counterpart',
};

export interface ImportLegacyDataDeps {
  readonly legacy: LegacySource;
  readonly clock: Clock;
  readonly tokenHasher: TokenHasher;
  readonly gameModes: GameModeRegistry;
  readonly schools: SchoolRepository;
  readonly users: UserRepository;
  readonly credentials: PasswordCredentialRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly semesters: SemesterRepository;
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly planFolders: PlanFolderRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly planTemplates: PlanTemplateRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly submissions: SubmissionRepository;
  readonly portalLinks: PortalLinkRepository;
  readonly studentLinks: StudentLinkRepository;
  readonly studentNotes: StudentNoteRepository;
  readonly studentInsights: StudentInsightRepository;
  readonly subPackets: SubPacketRepository;
  readonly trialReminders: TrialReminderRepository;
  readonly leads: LeadRepository;
  readonly games: GameRepository;
  readonly presentations: PresentationRepository;
  readonly generations: AiGenerationRepository;
  readonly learningPaths: LearningPathRepository;
}

/** The order matters: each collection's references are imported before it. */
const mappers = (schools: Parameters<typeof usersMapper>[0]): readonly LegacyMapper[] => [
  usersMapper(schools),
  subscriptionsMapper,
  semestersMapper,
  classesMapper,
  studentsMapper,
  planFoldersMapper,
  lessonPlansMapper,
  attendanceMapper,
  gradeCategoriesMapper,
  assignmentsMapper('assignments'),
  assignmentsMapper('ai_assignments'),
  gradesMapper,
  aiSubmissionsMapper,
  portalTokensMapper('portal_tokens'),
  portalTokensMapper('homeschool_portal_tokens'),
  learningTokensMapper,
  studentNotesMapper,
  studentInsightsMapper,
  subPacketsMapper,
  trialRemindersMapper,
  leadsMapper,
  gamesMapper,
  presentationsMapper,
  generationsMapper,
  learningPathsMapper,
];

/**
 * Imports the old app's export: every record is read and checked in memory, and the report
 * accounts for each one (imported, or skipped with a reason). Only `apply` writes, in
 * dependency order. Old ids are kept, so importing again replaces the same rows; a password
 * already set in the new app is never replaced.
 */
export class ImportLegacyData {
  constructor(private readonly deps: ImportLegacyDataDeps) {}

  async execute({ apply }: { readonly apply: boolean }): Promise<MigrationReport> {
    const tally = new MigrationTally();
    const set = new MigrationSet();
    const context = {
      set,
      tally,
      now: this.deps.clock.now(),
      tokens: this.deps.tokenHasher,
      gameModes: this.deps.gameModes,
      existingUsers: this.deps.users,
    };
    const schools = await this.read(tally, 'schools');
    await schoolsMapper.map(schools, context);
    for (const mapper of mappers(schools)) {
      await mapper.map(await this.read(tally, mapper.collection), context);
    }
    for (const [collection, reason] of Object.entries(leftOutCollections)) {
      const docs = await this.deps.legacy.read(collection);
      if (docs.length > 0) tally.leftOut(collection, docs.length, reason);
    }
    if (apply) await this.write(set);
    return tally.report();
  }

  private async read(tally: MigrationTally, collection: string) {
    const docs = await this.deps.legacy.read(collection);
    tally.read(collection, docs.length);
    return docs;
  }

  private async write(set: MigrationSet): Promise<void> {
    const d = this.deps;
    const each = async <T>(rows: Iterable<T>, save: (row: T) => Promise<void>) => {
      for (const row of rows) await save(row);
    };
    await each(set.schools.values(), (s) => d.schools.save(s));
    await each(set.users.values(), (u) => d.users.save(u));
    await each(set.credentials, async (credential) => {
      const existing = await d.credentials.findByUserId(credential.userId);
      if (existing === null) await d.credentials.save(credential);
    });
    await each(set.subscriptions.values(), (s) => d.subscriptions.save(s));
    await each(set.semesters.values(), (s) => d.semesters.save(s));
    await each(set.classes.values(), (c) => d.classes.save(c));
    await d.students.saveMany([...set.students.values()]);
    await each(set.folders.values(), (f) => d.planFolders.save(f));
    await each(set.plans, (p) => d.lessonPlans.save(p));
    await each(set.templates, (t) => d.planTemplates.save(t));
    await each(set.attendance.values(), (a) => d.attendanceSessions.save(a));
    await each(set.categories.values(), (c) => d.gradeCategories.save(c));
    await each(set.assignments.values(), (a) => d.assignments.save(a));
    await each(set.grades.values(), (g) => d.grades.save(g));
    await each(set.submissions.values(), (s) => d.submissions.save(s));
    await each(set.portalLinks, (l) => d.portalLinks.save(l));
    await each(set.studentLinks, (l) => d.studentLinks.save(l));
    await each(set.notes, (n) => d.studentNotes.save(n));
    await each(set.insights, (i) => d.studentInsights.save(i));
    await each(set.subPackets, (p) => d.subPackets.save(p));
    await each(set.reminders, (r) => d.trialReminders.record(r));
    await each(set.leads, (l) => d.leads.save(l));
    await each(set.games, (g) => d.games.save(g));
    await each(set.presentations, (p) => d.presentations.save(p));
    await each(set.generations, (g) => d.generations.save(g));
    await each(set.learningPaths, (p) => d.learningPaths.save(p));
  }
}
