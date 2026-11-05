import { err, ok, type FormsQuiz, type FormsQuizItem, type Result } from '@thp/domain';
import type { CreatedForm, FormsError, GoogleForms } from '@thp/ports';
import { googleFailure } from './google-errors.ts';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const api = 'https://forms.googleapis.com/v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Forms answers a bare 403 when the teacher's grant predates the Forms scope. */
async function formsFailure(response: Response): Promise<FormsError> {
  const failure = await googleFailure(response);
  return failure.code === 'unauthorized' && response.status === 403
    ? { ...failure, code: 'insufficient_scope' }
    : failure;
}

const options = (values: readonly string[]) => values.map((value) => ({ value }));

/** Graded only with an answer key; Forms leaves the rest for the teacher to score. */
const grading = (points: number, correct: readonly string[]) =>
  correct.length === 0
    ? {}
    : { grading: { pointValue: points, correctAnswers: { answers: options(correct) } } };

const bodies: {
  [K in FormsQuizItem['kind']]: (item: Extract<FormsQuizItem, { kind: K }>) => object;
} = {
  choice: (item) => ({
    questionItem: {
      question: {
        required: true,
        ...grading(item.points, item.correct),
        choiceQuestion: { type: 'RADIO', options: options(item.options) },
      },
    },
  }),
  text: (item) => ({
    questionItem: {
      question: {
        required: true,
        ...grading(item.points, item.correct),
        textQuestion: { paragraph: item.paragraph },
      },
    },
  }),
  grid: (item) => ({
    questionGroupItem: {
      questions: item.rows.map((title) => ({ required: true, rowQuestion: { title } })),
      grid: { columns: { type: 'RADIO', options: options(item.columns) } },
    },
  }),
};

const createItem = (item: FormsQuizItem, index: number) => ({
  createItem: {
    item: {
      title: item.title,
      ...(item.description === null ? {} : { description: item.description }),
      ...(bodies[item.kind] as (i: FormsQuizItem) => object)(item),
    },
    location: { index },
  },
});

/**
 * Google Forms through its official REST API with the teacher's access token. A form can only be
 * created with its title, so the quiz settings and questions follow in one batch update.
 */
export class GoogleFormsApi implements GoogleForms {
  constructor(private readonly fetchFn: Fetch = fetch) {}

  private async post(
    accessToken: string,
    path: string,
    body: object,
  ): Promise<Result<Record<string, unknown>, FormsError>> {
    try {
      const response = await this.fetchFn(`${api}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) return err(await formsFailure(response));
      const reply: unknown = await response.json();
      return ok(isRecord(reply) ? reply : {});
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  async createQuiz(accessToken: string, quiz: FormsQuiz): Promise<Result<CreatedForm, FormsError>> {
    const created = await this.post(accessToken, '/forms', {
      info: { title: quiz.title, documentTitle: quiz.title },
    });
    if (!created.ok) return created;
    const id = textOf(created.value.formId);
    const updated = await this.post(accessToken, `/forms/${encodeURIComponent(id)}:batchUpdate`, {
      requests: [
        {
          updateSettings: {
            settings: { quizSettings: { isQuiz: true } },
            updateMask: 'quizSettings.isQuiz',
          },
        },
        { updateFormInfo: { info: { description: quiz.description }, updateMask: 'description' } },
        ...quiz.items.map(createItem),
      ],
    });
    if (!updated.ok) return updated;
    return ok({
      id,
      editUrl: `https://docs.google.com/forms/d/${encodeURIComponent(id)}/edit`,
      responderUrl: textOf(created.value.responderUri),
    });
  }
}
