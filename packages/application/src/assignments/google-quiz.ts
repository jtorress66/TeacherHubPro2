import {
  ok,
  parseLocalDate,
  requiredText,
  toFormsQuiz,
  type GoogleQuiz,
  type GoogleQuizId,
  type LocalDate,
  type QuestionInput,
  type Result,
  type TrueFalseLabels,
  type User,
} from '@thp/domain';
import type {
  ClassroomCoursework,
  Clock,
  GoogleForms,
  GoogleQuizRepository,
  IdGenerator,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { accessToken, googleFailed, type ConnectionDeps } from './classroom.ts';
import { buildQuestions } from './questions.ts';

interface QuizDeps {
  readonly googleQuizzes: GoogleQuizRepository;
}

interface QuizRef {
  readonly actor: User;
  readonly quizId: GoogleQuizId;
}

async function ownQuiz(deps: QuizDeps, input: QuizRef): Promise<Result<GoogleQuiz, UseCaseError>> {
  const quiz = await deps.googleQuizzes.findForOwner(
    input.actor.schoolId,
    input.actor.id,
    input.quizId,
  );
  return quiz === null ? fail('not_found') : ok(quiz);
}

/**
 * Makes a Google Forms quiz from questions the teacher reviewed after reading a PDF, with no
 * class. Only the quiz's links are kept; the teacher changes the questions in Forms afterwards.
 */
export class MakeGoogleQuiz {
  constructor(
    private readonly deps: ConnectionDeps &
      QuizDeps & {
        readonly googleForms: GoogleForms;
        readonly ids: IdGenerator;
        readonly clock: Clock;
      },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly title: string;
    readonly instructions: string | null;
    readonly questions: readonly QuestionInput[];
    readonly labels: TrueFalseLabels;
  }): Promise<Result<GoogleQuiz, UseCaseError>> {
    const title = requiredText('title', input.title);
    if (!title.ok) return title;
    if (input.questions.length === 0) return fail('not_shareable');
    const questions = buildQuestions(input.questions);
    if (!questions.ok) return questions;
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const made = await this.deps.googleForms.createQuiz(
      token.value,
      toFormsQuiz(
        { title: title.value, instructions: input.instructions, questions: questions.value },
        input.labels,
      ),
    );
    if (!made.ok) {
      return googleFailed(made.error);
    }
    const quiz: GoogleQuiz = {
      id: this.deps.ids.next() as GoogleQuizId,
      schoolId: input.actor.schoolId,
      ownerId: input.actor.id,
      title: title.value,
      formId: made.value.id,
      editUrl: made.value.editUrl,
      responderUrl: made.value.responderUrl,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.googleQuizzes.save(quiz);
    return ok(quiz);
  }
}

/** One of the teacher's own quizzes. */
export class FindGoogleQuiz {
  constructor(private readonly deps: QuizDeps) {}

  execute(input: QuizRef): Promise<Result<GoogleQuiz, UseCaseError>> {
    return ownQuiz(this.deps, input);
  }
}

/** The teacher's quizzes, newest first. */
export class ListGoogleQuizzes {
  constructor(private readonly deps: QuizDeps) {}

  async execute(input: {
    readonly actor: User;
  }): Promise<Result<readonly GoogleQuiz[], UseCaseError>> {
    return ok(await this.deps.googleQuizzes.listByOwner(input.actor.schoolId, input.actor.id));
  }
}

/** Posts one of the teacher's quizzes to a Classroom course, linking to its student page. */
export class PostQuizToClassroom {
  constructor(
    private readonly deps: ConnectionDeps &
      QuizDeps & { readonly classroomCoursework: ClassroomCoursework },
  ) {}

  async execute(
    input: QuizRef & { readonly courseId: string; readonly dueDate: string | null },
  ): Promise<Result<{ readonly url: string }, UseCaseError>> {
    const quiz = await ownQuiz(this.deps, input);
    if (!quiz.ok) return quiz;
    let dueDate: LocalDate | null = null;
    if (input.dueDate !== null) {
      const parsed = parseLocalDate('dueDate', input.dueDate);
      if (!parsed.ok) return parsed;
      dueDate = parsed.value;
    }
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const posted = await this.deps.classroomCoursework.createCoursework(
      token.value,
      input.courseId,
      {
        title: quiz.value.title,
        description: '',
        material: { kind: 'link', url: quiz.value.responderUrl },
        dueDate,
      },
    );
    return posted.ok ? ok({ url: posted.value.url }) : googleFailed(posted.error);
  }
}
