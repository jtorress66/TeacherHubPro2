import {
  buildFamilyReport,
  isUsable,
  localDateIn,
  ok,
  type FamilyReport,
  type Result,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  Clock,
  GamePlayRepository,
  GameRepository,
  GradeCategoryRepository,
  GradeRepository,
  LearningPathRepository,
  LessonAttemptRepository,
  PortalLinkRepository,
  SchoolRepository,
  SemesterRepository,
  StudentRepository,
  TokenHasher,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

export interface FamilyPortal {
  readonly firstName: string;
  readonly lastName: string;
  readonly className: string;
  readonly schoolName: string;
  readonly report: FamilyReport;
}

/**
 * What a family sees through their link: one student's confirmed grades, attendance, learning
 * and games. Read-only; an unknown, revoked or expired link is simply not found.
 */
export class OpenFamilyPortal {
  constructor(
    private readonly deps: {
      readonly portalLinks: PortalLinkRepository;
      readonly tokenHasher: TokenHasher;
      readonly clock: Clock;
      readonly schools: SchoolRepository;
      readonly classes: ClassRepository;
      readonly students: StudentRepository;
      readonly semesters: SemesterRepository;
      readonly gradeCategories: GradeCategoryRepository;
      readonly assignments: AssignmentRepository;
      readonly grades: GradeRepository;
      readonly attendanceSessions: AttendanceSessionRepository;
      readonly learningPaths: LearningPathRepository;
      readonly lessonAttempts: LessonAttemptRepository;
      readonly games: GameRepository;
      readonly gamePlays: GamePlayRepository;
    },
  ) {}

  async execute(input: {
    readonly token: string;
    /** The family's time zone, for "upcoming" work. */
    readonly timeZone: string;
  }): Promise<Result<FamilyPortal, UseCaseError>> {
    const { deps } = this;
    const now = deps.clock.now();
    const link = await deps.portalLinks.findByTokenHash(await deps.tokenHasher.hash(input.token));
    if (link === null || !isUsable(link, now)) return fail('not_found');
    const { schoolId, studentId } = link;
    const student = await deps.students.findById(schoolId, studentId);
    const cls = await deps.classes.findById(schoolId, link.classId);
    if (student?.classId !== link.classId || cls === null) return fail('not_found');
    const school = await deps.schools.findById(schoolId);
    const semester =
      cls.semesterId === null ? null : await deps.semesters.findById(schoolId, cls.semesterId);
    const range = semester ? { from: semester.startDate, to: semester.endDate } : undefined;
    const paths = (await deps.learningPaths.listByStudent(schoolId, studentId)).filter(
      (path) => path.status !== 'draft',
    );
    const games = await deps.games.listByClass(schoolId, cls.id);
    const plays = (
      await Promise.all(games.map((game) => deps.gamePlays.listByGame(schoolId, game.id)))
    ).flat();
    const report = buildFamilyReport({
      studentId,
      today: localDateIn(now, input.timeZone),
      categories: await deps.gradeCategories.listByClass(schoolId, cls.id),
      assignments: await deps.assignments.listByClass(schoolId, cls.id),
      grades: await deps.grades.listByStudent(schoolId, studentId),
      sessions: await deps.attendanceSessions.listByClass(schoolId, cls.id, range),
      paths,
      attempts: await deps.lessonAttempts.listByPaths(
        schoolId,
        paths.map((path) => path.id),
      ),
      plays: plays.filter((play) => play.studentId === studentId),
    });
    return ok({
      firstName: student.firstName,
      lastName: student.lastName,
      className: cls.name,
      schoolName: school?.name ?? '',
      report,
    });
  }
}
