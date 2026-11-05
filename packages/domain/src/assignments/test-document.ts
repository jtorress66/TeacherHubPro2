import type { Question, QuestionType } from '../gradebook/question.ts';
import type { QuizSource } from './forms-quiz.ts';

/** The fixed words of a printed test, in the teacher's language; `points` has `{points}`. */
export interface TestDocumentLabels {
  readonly name: string;
  readonly date: string;
  readonly answer: string;
  readonly true: string;
  readonly false: string;
  readonly points: string;
}

const escape = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const p = (html: string) => `<p>${html}</p>`;
const answerLine = p('_'.repeat(60));
const box = (text: string) =>
  `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr><td>${escape(text)}</td></tr></table>`;

/** Word banks are boxed, as on a printed test. */
const isWordBank = (line: string) => /^(word bank|banco de palabras)\b/i.test(line.trim());

/** A section's text: its first line as the heading, word banks boxed, the rest as paragraphs. */
function section(text: string): string {
  const [heading = '', ...rest] = text.split('\n').filter((line) => line.trim() !== '');
  return [
    `<h2>${escape(heading)}</h2>`,
    ...rest.map((line) => (isWordBank(line) ? box(line) : p(escape(line)))),
  ].join('');
}

const letter = (index: number) => String.fromCharCode(97 + index);

type Body = {
  [T in QuestionType]: (input: {
    readonly question: Extract<Question, { type: T }>;
    readonly labels: TestDocumentLabels;
  }) => string;
};

/** Room to answer each kind of question. No answer key ever appears. */
const bodies: Body = {
  multiple_choice: ({ question }) =>
    question.options.map((option, index) => p(`☐ ${letter(index)}) ${escape(option)}`)).join(''),
  true_false: ({ labels }) => p(`☐ ${escape(labels.true)} &nbsp;&nbsp; ☐ ${escape(labels.false)}`),
  fill_blank: ({ labels }) => p(`${escape(labels.answer)}: ${'_'.repeat(30)}`),
  short_answer: () => answerLine.repeat(2),
  essay: () => answerLine.repeat(8),
  // The right side is sorted, so its order does not give the pairs away.
  matching: ({ question }) => {
    const rights = question.pairs.map((pair) => pair.right).sort((a, b) => a.localeCompare(b));
    const rows = question.pairs.map(
      (pair, index) =>
        `<tr><td>______ ${String(index + 1)}. ${escape(pair.left)}</td><td>${letter(index)}. ${escape(rights[index] ?? '')}</td></tr>`,
    );
    return `<table cellpadding="6" style="width:100%">${rows.join('')}</table>`;
  },
};

const bodyOf = (question: Question, labels: TestDocumentLabels): string =>
  (bodies[question.type] as (input: { question: Question; labels: TestDocumentLabels }) => string)({
    question,
    labels,
  });

/**
 * A test as a clean document for students to type in (HTML that Google Drive converts to a Google
 * Doc): name and date lines, sections shown once, matching as a table, room to answer.
 */
export function renderTestDocument(source: QuizSource, labels: TestDocumentLabels): string {
  const parts = [
    `<h1>${escape(source.title)}</h1>`,
    p(`${escape(labels.name)}: ${'_'.repeat(20)} &nbsp; ${escape(labels.date)}: ${'_'.repeat(12)}`),
  ];
  if (source.instructions !== null) parts.push(p(escape(source.instructions)));
  let current: string | null = null;
  for (const [index, question] of source.questions.entries()) {
    if (question.instructions !== null && question.instructions !== current) {
      parts.push(section(question.instructions));
    }
    current = question.instructions;
    const points = escape(labels.points.replace('{points}', String(question.points)));
    parts.push(
      p(`<b>${String(index + 1)}.</b> ${escape(question.prompt)} <i>(${points})</i>`),
      bodyOf(question, labels),
    );
  }
  return `<html><body>${parts.join('')}</body></html>`;
}
