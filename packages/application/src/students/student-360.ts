import {
  buildStudent360,
  createStudentInsight,
  createStudentNote,
  err,
  localDateIn,
  ok,
  type Class,
  type ClassId,
  type Job,
  type JobFailure,
  type Language,
  type Result,
  type Student,
  type Student360,
  type StudentId,
  type StudentInsight,
  type StudentNote,
  type StudentNoteId,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  Clock,
  GradeCategoryRepository,
  GradeRepository,
  IdGenerator,
  InsightRequest,
  InsightWriter,
  JobQueue,
  SemesterRepository,
  StudentInsightRepository,
  StudentNoteRepository,
  StudentRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';

export const studentInsightJobKind = 'student.insight';
/** The insight sees this many of the latest grades and attendance events. */
const recentEvents = 15;

interface StudentRef {
  readonly actor: User;
  readonly classId: ClassId;
  readonly studentId: StudentId;
}

interface RecordDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly semesters: SemesterRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
}

/** A student in a class the actor manages. */
async function classStudent(
  deps: Pick<RecordDeps, 'classes' | 'students'>,
  input: StudentRef,
): Promise<Result<{ cls: Class; student: Student }, UseCaseError>> {
  const cls = await findManagedClass(deps.classes, input.actor, input.classId);
  if (!cls.ok) return cls;
  const student = await deps.students.findById(cls.value.schoolId, input.studentId);
  if (student?.classId !== cls.value.id) return fail('not_found');
  return ok({ cls: cls.value, student });
}

/** The student's grades and the class's attendance this semester (all of it without one). */
async function summaryOf(
  deps: RecordDeps,
  cls: Class,
  student: Student,
  notes: readonly StudentNote[],
  now: Date,
  timeZone: string,
): Promise<Student360> {
  const { schoolId } = cls;
  const semester =
    cls.semesterId === null ? null : await deps.semesters.findById(schoolId, cls.semesterId);
  return buildStudent360({
    studentId: student.id,
    categories: await deps.gradeCategories.listByClass(schoolId, cls.id),
    assignments: await deps.assignments.listByClass(schoolId, cls.id),
    grades: await deps.grades.listByStudent(schoolId, student.id),
    sessions: await deps.attendanceSessions.listByClass(
      schoolId,
      cls.id,
      semester === null ? undefined : { from: semester.startDate, to: semester.endDate },
    ),
    notes,
    today: localDateIn(now, timeZone),
    timeZone,
  });
}

export interface StudentView {
  readonly student: Student;
  readonly cls: Class;
  readonly summary: Student360;
  /** The viewer's own notes, newest first. */
  readonly notes: readonly StudentNote[];
  /** The viewer's latest AI insight, if they asked for one. */
  readonly insight: StudentInsight | null;
}

/** One student at a glance, for a teacher of their class: stats, timeline, notes and insight. */
export class GetStudent360 {
  constructor(
    private readonly deps: RecordDeps & {
      readonly studentNotes: StudentNoteRepository;
      readonly studentInsights: StudentInsightRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(
    input: StudentRef & { readonly timeZone: string },
  ): Promise<Result<StudentView, UseCaseError>> {
    const found = await classStudent(this.deps, input);
    if (!found.ok) return found;
    const { cls, student } = found.value;
    const { schoolId, id: viewer } = input.actor;
    const notes = await this.deps.studentNotes.listFor(schoolId, student.id, viewer);
    return ok({
      student,
      cls,
      summary: await summaryOf(
        this.deps,
        cls,
        student,
        notes,
        this.deps.clock.now(),
        input.timeZone,
      ),
      notes,
      insight: await this.deps.studentInsights.find(schoolId, student.id, viewer),
    });
  }
}

/** A private note about a student; only its author ever sees it. */
export class AddStudentNote {
  constructor(
    private readonly deps: Pick<RecordDeps, 'classes' | 'students'> & {
      readonly studentNotes: StudentNoteRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(
    input: StudentRef & { readonly text: string },
  ): Promise<Result<StudentNote, UseCaseError>> {
    const found = await classStudent(this.deps, input);
    if (!found.ok) return found;
    const note = createStudentNote({
      id: this.deps.ids.next() as StudentNoteId,
      schoolId: input.actor.schoolId,
      studentId: found.value.student.id,
      authorId: input.actor.id,
      text: input.text,
      createdAt: this.deps.clock.now(),
    });
    if (!note.ok) return note;
    await this.deps.studentNotes.save(note.value);
    return note;
  }
}

/** Deletes one of the actor's own notes. */
export class DeleteStudentNote {
  constructor(
    private readonly deps: Pick<RecordDeps, 'classes' | 'students'> & {
      readonly studentNotes: StudentNoteRepository;
    },
  ) {}

  async execute(
    input: StudentRef & { readonly noteId: StudentNoteId },
  ): Promise<Result<true, UseCaseError>> {
    const found = await classStudent(this.deps, input);
    if (!found.ok) return found;
    const deleted = await this.deps.studentNotes.delete(
      input.actor.schoolId,
      input.noteId,
      input.actor.id,
    );
    return deleted ? ok(true) : fail('not_found');
  }
}

interface InsightPayload {
  readonly classId: ClassId;
  readonly studentId: StudentId;
  readonly language: Language;
  readonly timeZone: string;
}

/** Starts an AI insight on a student for the actor. Needs AI access. */
export class RequestStudentInsight {
  constructor(
    private readonly deps: Pick<RecordDeps, 'classes' | 'students'> & {
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(
    input: StudentRef & { readonly timeZone: string },
  ): Promise<Result<Job, UseCaseError>> {
    const found = await classStudent(this.deps, input);
    if (!found.ok) return found;
    const access = await checkAiAccess(this.deps, input.actor);
    if (!access.ok) return access;
    const payload: InsightPayload = {
      classId: found.value.cls.id,
      studentId: found.value.student.id,
      language: input.actor.language,
      timeZone: input.timeZone,
    };
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: input.actor.schoolId,
        ownerId: input.actor.id,
        kind: studentInsightJobKind,
        payload,
      }),
    );
  }
}

/** What the AI may see: numbers and assignment titles, never a name, accommodations or notes. */
function insightRequest(summary: Student360, language: Language): InsightRequest {
  const { stats, timeline } = summary;
  return {
    language,
    stats: {
      average: stats.average,
      attendanceRate: stats.attendanceRate,
      absences: stats.attendance.absent,
      tardies: stats.attendance.tardy,
      excused: stats.attendance.excused,
      sessions: stats.attendance.total,
      missing: stats.missing,
    },
    recentGrades: timeline
      .flatMap((event) =>
        event.kind === 'grade'
          ? [
              {
                title: event.title,
                date: event.date,
                status: event.status,
                percentage: event.percentage,
              },
            ]
          : [],
      )
      .slice(0, recentEvents),
    recentAttendance: timeline
      .flatMap((event) =>
        event.kind === 'attendance' ? [{ date: event.date, status: event.status }] : [],
      )
      .slice(0, recentEvents),
  };
}

/** Builds the student's numbers, has the AI draft the insight, and keeps it for the teacher. */
export class StudentInsightHandler implements JobHandler {
  readonly kind = studentInsightJobKind;

  constructor(
    private readonly deps: RecordDeps & {
      readonly studentInsights: StudentInsightRepository;
      readonly insightWriter: InsightWriter;
      readonly clock: Clock;
    },
  ) {}

  async handle(job: Job): Promise<Result<true, { readonly code: JobFailure }>> {
    const payload = job.payload as InsightPayload;
    const cls = await this.deps.classes.findById(job.schoolId, payload.classId);
    const student = await this.deps.students.findById(job.schoolId, payload.studentId);
    if (cls === null || student?.classId !== cls.id) return err({ code: 'failed' });
    const now = this.deps.clock.now();
    // Notes stay out of what the AI sees, so the summary is built without them.
    const summary = await summaryOf(this.deps, cls, student, [], now, payload.timeZone);
    const bullets = await this.deps.insightWriter.write(insightRequest(summary, payload.language));
    if (!bullets.ok) return bullets;
    const insight = createStudentInsight({
      schoolId: job.schoolId,
      studentId: student.id,
      teacherId: job.ownerId,
      bullets: bullets.value,
      generatedAt: now,
    });
    if (!insight.ok) return err({ code: 'invalid_output' });
    await this.deps.studentInsights.save(insight.value);
    return ok(true);
  }
}
