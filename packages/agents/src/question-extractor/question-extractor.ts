import {
  createExtractedTest,
  err,
  ok,
  questionTypes,
  type ExtractedQuestionInput,
  type ExtractedTest,
  type Language,
  type QuestionType,
  type Result,
} from '@thp/domain';
import type {
  DraftError,
  LlmClient,
  LlmResponse,
  QuestionExtractor as QuestionExtractorPort,
} from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { objects, parseJsonObject, text, texts, type Json } from '../drafting/json-reply.ts';
import { languageNames } from '../drafting/language.ts';
import { ruleBroken } from '../drafting/rule-broken.ts';

const maxTokens = 16000;
/** PDFs can be long; only this much text is sent, which covers a typical test. */
export const maxTestTextLength = 30_000;

export const extractorSystemPrompt = `You turn the text of a printed test into individual questions for an online test.
The teacher reviews and edits every question before students see it.
Rules:
1. Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
2. A section header such as "A. Vocabulary (5 pts)" is NOT a question: it goes in the "instructions" of the questions in that section.
3. Fill in the blank: EACH sentence with a blank is ONE question. A word bank with six sentences is six questions.
4. Multiple choice: each item with its options is one question. True or false: each statement is one question.
5. Matching: one question with all its pairs.
6. Short answer and essay: each writing prompt is one question.
7. Word banks, reading passages and section instructions go in the "instructions" of each question they belong to.
8. Copy the questions' wording exactly. Give the correct answer when the test shows it; otherwise give the answer you believe is correct, and the teacher will check it.
9. Never invent questions that are not in the text.`;

const shape = `{
  "instructions": string or null (the test's general instructions, at most 2000 characters),
  "questions": [{
    "type": one of ${questionTypes.join(', ')},
    "prompt": string (at most 2000 characters),
    "points": number (optional; from the test when it shows them),
    "instructions": string or null (section header, word bank or passage, at most 2000 characters),
    multiple_choice: "options": [string], "correctOption": index from 0,
    true_false: "answer": true or false,
    fill_blank: "acceptedAnswers": [string],
    short_answer: "modelAnswer": string or null,
    matching: "pairs": [{ "left": string, "right": string }],
    essay: "rubric": string or null
  }]
}`;

/** How each question type is read from the reply. A new type adds an entry here. */
const readers: Readonly<Record<QuestionType, (q: Json) => Record<string, unknown>>> = {
  multiple_choice: (q) => ({ options: texts(q.options), correctOption: q.correctOption }),
  true_false: (q) => ({ answer: q.answer === true }),
  fill_blank: (q) => ({ acceptedAnswers: texts(q.acceptedAnswers) }),
  short_answer: (q) => ({ modelAnswer: text(q.modelAnswer) }),
  matching: (q) => ({
    pairs: objects(q.pairs).map((pair) => ({
      left: text(pair.left) ?? '',
      right: text(pair.right) ?? '',
    })),
  }),
  essay: (q) => ({ rubric: text(q.rubric) }),
};

const isType = (value: unknown): value is QuestionType =>
  typeof value === 'string' && Object.hasOwn(readers, value);

function readQuestion(q: Json): Result<ExtractedQuestionInput, string> {
  if (!isType(q.type)) return err(`The reply has an unknown question type "${String(q.type)}".`);
  const points = typeof q.points === 'number' && q.points > 0 ? { points: q.points } : {};
  return ok({
    type: q.type,
    prompt: text(q.prompt) ?? '',
    instructions: text(q.instructions),
    ...points,
    ...readers[q.type](q),
  } as ExtractedQuestionInput);
}

/** The questions in a reply, or what is wrong with it in plain words. */
export function reviewExtraction(reply: LlmResponse): Result<ExtractedTest, string> {
  if (reply.stopReason === 'max_tokens') {
    return err('The reply was cut off before the end; keep the instructions shorter.');
  }
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const questions: ExtractedQuestionInput[] = [];
  for (const raw of objects(json.questions)) {
    const question = readQuestion(raw);
    if (!question.ok) return question;
    questions.push(question.value);
  }
  const test = createExtractedTest({ instructions: text(json.instructions), questions });
  return test.ok ? test : err(ruleBroken(test.error));
}

/**
 * Turns a test's text (from a PDF) into questions. It only drafts: the teacher reviews and edits
 * them before saving. It sends only the test's text, never student data.
 */
export class QuestionExtractor implements QuestionExtractorPort {
  constructor(private readonly llm: LlmClient) {}

  extract(input: {
    readonly text: string;
    readonly language: Language;
  }): Promise<Result<ExtractedTest, DraftError>> {
    const prompt = [
      'Turn this test into questions.',
      `Write the instructions and any added text in ${languageNames[input.language]}; copy the questions in the test's own language.`,
      `Reply with JSON in this shape:\n${shape}`,
      `The test:\n"""\n${input.text.slice(0, maxTestTextLength)}\n"""`,
    ].join('\n\n');
    return draftWithReview(this.llm, {
      system: extractorSystemPrompt,
      prompt,
      maxTokens,
      review: reviewExtraction,
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
