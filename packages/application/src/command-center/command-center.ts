import {
  addDays,
  atRiskList,
  byUrgency,
  classesToday,
  localDateIn,
  maxToGrade,
  ok,
  planSpan,
  recommendations,
  riskOf,
  studentStatuses,
  toGrade,
  upcomingLessons,
  weekdayOf,
  type Class,
  type ClassId,
  type LessonPlan,
  type LocalDate,
  type PlanSpan,
  type Recommendation,
  type Result,
  type Risk,
  type Student,
  type ToGradeItem,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  Clock,
  GradeCategoryRepository,
  GradeRepository,
  LessonPlanRepository,
  StudentRepository,
  SubmissionRepository,
} from '@thp/ports';
import type { UseCaseError } from '../errors.ts';

/** Attendance for the risk flags looks back this many days. */
const riskWindowDays = 30;
const highRisk = 4;

export type TodayAttendance = 'done' | 'open' | 'not_taken';

export interface CommandCenter {
  readonly today: LocalDate;
  readonly classesToday: readonly {
    readonly cls: Class;
    readonly students: number;
    readonly attendance: TodayAttendance;
  }[];
  readonly toGrade: readonly (ToGradeItem & { readonly className: string })[];
  readonly atRisk: readonly {
    readonly student: Student;
    readonly cls: { readonly id: ClassId; readonly name: string };
    readonly risk: Risk;
  }[];
  readonly recommendations: readonly Recommendation[];
  readonly upcoming: readonly {
    readonly plan: LessonPlan;
    readonly span: PlanSpan;
    readonly className: string | null;
  }[];
  readonly stats: {
    readonly classesToday: number;
    readonly attendanceDone: number;
    readonly toGrade: number;
    readonly atRisk: number;
  };
}

interface Deps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly submissions: SubmissionRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly clock: Clock;
}

/** Everything one class contributes to the day. */
async function classDay(deps: Deps, cls: Class, today: LocalDate) {
  const { schoolId } = cls;
  const roster = await deps.students.listByClass(schoolId, cls.id);
  const sessions = await deps.attendanceSessions.listByClass(schoolId, cls.id, {
    from: addDays(today, -riskWindowDays),
    to: today,
  });
  const categories = await deps.gradeCategories.listByClass(schoolId, cls.id);
  const assignments = await deps.assignments.listByClass(schoolId, cls.id);
  const grades = await deps.grades.listByAssignments(
    schoolId,
    assignments.map((a) => a.id),
  );
  const submissions = (
    await Promise.all(assignments.map((a) => deps.submissions.listByAssignment(schoolId, a.id)))
  ).flat();
  const todaySession = sessions.find((session) => session.date === today);
  const attendance: TodayAttendance =
    todaySession === undefined
      ? 'not_taken'
      : todaySession.status === 'submitted'
        ? 'done'
        : 'open';
  return {
    cls,
    roster,
    attendance,
    toGrade: toGrade({
      assignments,
      roster: roster.map((s) => s.id),
      grades,
      submissions,
      today,
    }).map((item) => ({ ...item, className: cls.name })),
    risks: roster.map((student) => ({
      student,
      cls: { id: cls.id, name: cls.name },
      risk: riskOf({
        categories,
        assignments,
        grades: grades.filter((g) => g.studentId === student.id),
        statuses: studentStatuses(sessions, student.id),
        today,
      }),
    })),
  };
}

/**
 * The teacher's day: today's classes and their attendance, what is left to grade, students who
 * may need help, suggestions, and lessons coming up. Only the teacher's own active classes.
 */
export class GetCommandCenter {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    readonly actor: User;
    readonly timeZone: string;
  }): Promise<Result<CommandCenter, UseCaseError>> {
    const { actor } = input;
    const today = localDateIn(this.deps.clock.now(), input.timeZone);
    const classes = await this.deps.classes.listByTeacher(actor.schoolId, actor.id);
    const days = await Promise.all(classes.map((cls) => classDay(this.deps, cls, today)));
    const meeting = classesToday(classes, weekdayOf(today));
    const dayOf = new Map(days.map((day) => [day.cls.id, day]));
    const scheduled = meeting.map((cls) => ({
      cls,
      students: dayOf.get(cls.id)?.roster.length ?? 0,
      attendance: dayOf.get(cls.id)?.attendance ?? ('not_taken' as const),
    }));
    const pending = days
      .flatMap((day) => day.toGrade)
      .sort(byUrgency)
      .slice(0, maxToGrade);
    const atRisk = atRiskList(days.flatMap((day) => day.risks));
    const plans = (await this.deps.lessonPlans.listByTeacher(actor.schoolId, actor.id)).map(
      (plan) => ({ plan, span: planSpan(plan.body) }),
    );
    const upcoming = upcomingLessons(plans, today).map((item) => ({
      ...item,
      className: classes.find((cls) => cls.id === item.plan.classId)?.name ?? null,
    }));
    const planned = new Set(upcoming.map((item) => item.plan.classId));

    return ok({
      today,
      classesToday: scheduled,
      toGrade: pending,
      atRisk,
      recommendations: recommendations({
        attendanceToTake: scheduled.filter((c) => c.attendance !== 'done').length,
        highRisk: atRisk.filter((row) => row.risk.score >= highRisk).length,
        overdueGrading: pending.filter((item) => item.overdue).length,
        classesWithoutPlans: classes.filter((cls) => !planned.has(cls.id)).length,
      }),
      upcoming,
      stats: {
        classesToday: scheduled.length,
        attendanceDone: scheduled.filter((c) => c.attendance === 'done').length,
        toGrade: pending.reduce((sum, item) => sum + item.waiting + item.ungraded, 0),
        atRisk: atRisk.length,
      },
    });
  }
}
