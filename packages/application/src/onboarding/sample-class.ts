import {
  addDays,
  archiveClass,
  createClass,
  findStarter,
  localDateIn,
  ok,
  recordAiScores,
  sampleAttendance,
  sampleGameChoices,
  sampleLastInitials,
  sampleQuiz,
  sampleReviewStudent,
  sampleSchoolDays,
  sampleScores,
  sampleWeekStart,
  submitAnswers,
  type Assignment,
  type Class,
  type ClassId,
  type GradeCategory,
  type LocalDate,
  type QuestionId,
  type Result,
  type StandardCategoryKey,
  type Student,
  type SubmissionId,
  type User,
} from '@thp/domain';
import type { ClassRepository, Clock, IdGenerator, SubmissionRepository } from '@thp/ports';
import { AddStudent } from '../students/student-use-cases.ts';
import { SubmitAttendance } from '../attendance/attendance-sheet.ts';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { CreateGame } from '../games/games.ts';
import { CreateAssignment } from '../gradebook/assignments.ts';
import { AddStandardCategories } from '../gradebook/categories.ts';
import { SaveGrades } from '../gradebook/grade-entry.ts';
import { SaveQuestions } from '../assignments/questions.ts';
import { CreatePlan } from '../lesson-plans/plans.ts';

/** The sample class's words, in the teacher's language. */
export interface SampleText {
  readonly className: string;
  readonly subject: string;
  /** The made-up students' first names. */
  readonly students: readonly string[];
  readonly categories: Readonly<Record<StandardCategoryKey, string>>;
  readonly homework: string;
  readonly quiz: string;
  readonly onlineQuiz: string;
  readonly choicePrompt: string;
  readonly truePrompt: string;
  readonly explainPrompt: string;
  readonly explainModel: string;
  /** The review student's answer to the explanation question. */
  readonly explainAnswer: string;
  readonly explainFeedback: string;
  readonly feedback: string;
  readonly plan: {
    readonly unit: string;
    readonly objective: string;
    readonly skills: readonly string[];
    /** Theme and notes for Monday to Friday. */
    readonly days: readonly (readonly [theme: string, notes: string])[];
  };
  readonly game: { readonly title: string; readonly prompts: readonly string[] };
}

type Deps = ConstructorParameters<typeof AddStudent>[0] &
  ConstructorParameters<typeof SubmitAttendance>[0] &
  ConstructorParameters<typeof AddStandardCategories>[0] &
  ConstructorParameters<typeof CreateAssignment>[0] &
  ConstructorParameters<typeof SaveGrades>[0] &
  ConstructorParameters<typeof SaveQuestions>[0] &
  ConstructorParameters<typeof CreatePlan>[0] &
  ConstructorParameters<typeof CreateGame>[0] & {
    readonly classes: ClassRepository;
    readonly submissions: SubmissionRepository;
    readonly ids: IdGenerator;
    readonly clock: Clock;
  };

/** The sample's content is fixed, so a refused step is a bug, not something a teacher can fix. */
async function must<T>(step: Result<T, unknown> | Promise<Result<T, unknown>>): Promise<T> {
  const result = await step;
  if (!result.ok) throw new Error(`Sample class step refused: ${JSON.stringify(result.error)}`);
  return result.value;
}

const activeSample = async (classes: ClassRepository, actor: User): Promise<Class | null> =>
  (await classes.listByTeacher(actor.schoolId, actor.id)).find((cls) => cls.sample) ?? null;

/**
 * The made-up class a teacher tries the app on: students, a week of attendance, grades, an
 * answer to review, this week's plan and a live game. A teacher has at most one in use.
 */
export class CreateSampleClass {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    readonly actor: User;
    readonly text: SampleText;
    readonly timeZone: string;
  }): Promise<Class> {
    const existing = await activeSample(this.deps.classes, input.actor);
    return existing ?? this.build(input.actor, input.text, input.timeZone);
  }

  private async build(actor: User, text: SampleText, timeZone: string): Promise<Class> {
    const today = localDateIn(this.deps.clock.now(), timeZone);
    const cls = await this.saveClass(actor, text);
    const base = { actor, classId: cls.id };
    const students: Student[] = [];
    for (const [index, firstName] of text.students.entries()) {
      const lastName = sampleLastInitials[index] ?? 'A.';
      students.push(
        await must(
          new AddStudent(this.deps).execute({ ...base, details: { firstName, lastName } }),
        ),
      );
    }
    await this.takeAttendance(base, students, today);
    const categories = await must(
      new AddStandardCategories(this.deps).execute({ ...base, names: text.categories }),
    );
    await this.gradeWork(base, students, categories, text, today);
    await this.quizToReview(base, students, categories, text, today);
    await this.planWeek(actor, cls, text, today);
    await must(
      new CreateGame(this.deps).execute({
        actor,
        title: text.game.title,
        mode: 'quiz',
        classId: cls.id,
        content: {
          kind: 'questions',
          items: sampleGameChoices.map((choice, index) => ({
            prompt: text.game.prompts[index] ?? '',
            options: choice.options,
            answer: choice.answer,
          })),
        },
      }),
    );
    return cls;
  }

  private async saveClass(actor: User, text: SampleText): Promise<Class> {
    const cls = await must(
      createClass({
        id: this.deps.ids.next() as ClassId,
        schoolId: actor.schoolId,
        teacherId: actor.id,
        name: text.className,
        subject: text.subject,
        grade: '3',
        schedule: { period: 1, startTime: '08:00', endTime: '08:50' },
        sample: true,
      }),
    );
    await this.deps.classes.save(cls);
    return cls;
  }

  private async takeAttendance(
    base: { actor: User; classId: ClassId },
    students: readonly Student[],
    today: LocalDate,
  ): Promise<void> {
    const days = sampleSchoolDays(today);
    for (const [day, date] of days.entries()) {
      const marks = students.map((student, index) => ({
        studentId: student.id,
        status: sampleAttendance[day]?.[index] ?? 'present',
      }));
      await must(new SubmitAttendance(this.deps).execute({ ...base, date, marks }));
    }
  }

  private async gradeWork(
    base: { actor: User; classId: ClassId },
    students: readonly Student[],
    categories: readonly GradeCategory[],
    text: SampleText,
    today: LocalDate,
  ): Promise<void> {
    const days = sampleSchoolDays(today);
    const graded = [
      { title: text.homework, category: 0, due: days[1], scores: sampleScores.homework },
      { title: text.quiz, category: 1, due: days[3], scores: sampleScores.quiz },
    ];
    for (const work of graded) {
      const assignment = await this.assign(base, categories, work.category, work.title, work.due);
      const rows = students.map((student, index) => ({
        studentId: student.id,
        status: 'graded' as const,
        score: work.scores[index] ?? null,
      }));
      await must(new SaveGrades(this.deps).execute({ ...base, assignmentId: assignment.id, rows }));
    }
  }

  private assign(
    base: { actor: User; classId: ClassId },
    categories: readonly GradeCategory[],
    category: number,
    title: string,
    dueDate: LocalDate | undefined,
  ): Promise<Assignment> {
    const categoryId = categories[category]?.id;
    if (categoryId === undefined) throw new Error('Sample class has no grade categories');
    return must(
      new CreateAssignment(this.deps).execute({
        ...base,
        details: { title, categoryId, dueDate: dueDate ?? null },
      }),
    );
  }

  /** A quiz one student has handed in, with the AI's suggestion waiting for the teacher. */
  private async quizToReview(
    base: { actor: User; classId: ClassId },
    students: readonly Student[],
    categories: readonly GradeCategory[],
    text: SampleText,
    today: LocalDate,
  ): Promise<void> {
    const created = await this.assign(base, categories, 1, text.onlineQuiz, addDays(today, 7));
    const [choice, trueFalse, explain] = [0, 1, 2].map(() => this.deps.ids.next() as QuestionId);
    if (choice === undefined || trueFalse === undefined || explain === undefined) return;
    const assignment = await must(
      new SaveQuestions(this.deps).execute({
        ...base,
        assignmentId: created.id,
        questions: [
          {
            id: choice,
            type: 'multiple_choice',
            prompt: text.choicePrompt,
            points: sampleQuiz.choice.points,
            options: sampleQuiz.choice.options,
            correctOption: sampleQuiz.choice.correct,
          },
          {
            id: trueFalse,
            type: 'true_false',
            prompt: text.truePrompt,
            points: sampleQuiz.trueFalse.points,
            answer: sampleQuiz.trueFalse.answer,
          },
          {
            id: explain,
            type: 'short_answer',
            prompt: text.explainPrompt,
            points: sampleQuiz.explain.points,
            modelAnswer: text.explainModel,
          },
        ],
      }),
    );
    const student = students[sampleReviewStudent];
    if (student === undefined) return;
    const submitted = await must(
      submitAnswers({
        id: this.deps.ids.next() as SubmissionId,
        assignment,
        studentId: student.id,
        answers: {
          [choice]: String(sampleQuiz.choice.correct),
          [trueFalse]: String(sampleQuiz.trueFalse.answer),
          [explain]: text.explainAnswer,
        },
        submittedAt: this.deps.clock.now(),
      }),
    );
    const suggested = await must(
      recordAiScores(assignment, submitted, {
        scores: {
          [explain]: { score: sampleQuiz.explain.suggestedScore, feedback: text.explainFeedback },
        },
        feedback: text.feedback,
      }),
    );
    await this.deps.submissions.save(suggested);
  }

  private async planWeek(actor: User, cls: Class, text: SampleText, today: LocalDate) {
    const starter = findStarter('fractions-intro');
    await must(
      new CreatePlan(this.deps).execute({
        actor,
        classId: cls.id,
        body: {
          kind: 'weekly',
          unit: text.plan.unit,
          weeks: [
            {
              weekStart: sampleWeekStart(today),
              objective: text.plan.objective,
              skills: text.plan.skills,
              standards: starter?.standards ?? [],
              days: text.plan.days.map(([theme, notes], index) => ({
                theme,
                notes,
                activities: (starter?.activities[index] ?? []).map((type) => ({ type })),
              })),
            },
          ],
        },
      }),
    );
  }
}

/** Takes the sample class out of every list. Only ever a sample: a real class is not found. */
export class RemoveSampleClass {
  constructor(
    private readonly deps: { readonly classes: ClassRepository; readonly clock: Clock },
  ) {}

  async execute(input: { actor: User; classId: ClassId }): Promise<Result<Class, UseCaseError>> {
    const found = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!found.ok) return found;
    if (!found.value.sample) return fail('not_found');
    const archived = archiveClass(found.value, this.deps.clock.now());
    await this.deps.classes.save(archived);
    return ok(archived);
  }
}
