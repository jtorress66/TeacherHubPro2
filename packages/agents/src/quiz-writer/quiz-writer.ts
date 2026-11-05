import { createExtractedTest, err, type ExtractedTest, type Result } from '@thp/domain';
import type {
  DraftError,
  LlmClient,
  LlmResponse,
  QuizRequest,
  QuizWriter as QuizWriterPort,
} from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { objects, parseJsonObject, text } from '../drafting/json-reply.ts';
import { languageNames } from '../drafting/language.ts';
import { ruleBroken } from '../drafting/rule-broken.ts';
import { subjectNames } from '../drafting/subject-names.ts';
import { readQuestion } from '../question-extractor/question-extractor.ts';

const maxTokens = 6000;
/** Types the gradebook scores on its own, plus short answers for the teacher or AI grader. */
export const quizQuestionTypes = [
  'multiple_choice',
  'true_false',
  'fill_blank',
  'short_answer',
] as const;
const quizPoints = 1;

export const quizSystemPrompt = `You write a short end-of-week quiz for a teacher's class.
The teacher reviews and edits every question before students see it.
Rules:
1. Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
2. Write exactly the number of questions asked for, spread across all of the week's topics.
3. Use only these question types: ${quizQuestionTypes.join(', ')}. Mostly multiple choice, a few true or false, at most two short answers.
4. Every question has its correct answer: the correct option's index, true or false, the accepted words for a blank, or a model answer.
5. Each question is worth one point unless it needs a longer written answer.
6. Match the grade level. Ask about the topics only; never invent facts, names or dates you are unsure of.`;

/** The same for every request, so it goes first and may be cached. */
const stablePrefix = `Reply with JSON in this shape:
{
  "instructions": string or null (one short line for students),
  "questions": [{
    "type": one of ${quizQuestionTypes.join(', ')},
    "prompt": string,
    "points": number (optional; ${String(quizPoints)} when left out),
    multiple_choice: "options": [string, 3 or 4 of them], "correctOption": index from 0,
    true_false: "answer": true or false,
    fill_blank: "acceptedAnswers": [string],
    short_answer: "modelAnswer": string
  }]
}

`;

/** The quiz in a reply, or what is wrong with it in plain words. */
export function reviewQuiz(
  reply: LlmResponse,
  request: QuizRequest,
): Result<ExtractedTest, string> {
  if (reply.stopReason === 'max_tokens') {
    return err('The reply was cut off before the end; write shorter questions.');
  }
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const raw = objects(json.questions);
  if (raw.length !== request.questionCount) {
    return err(
      `Write exactly ${String(request.questionCount)} questions, not ${String(raw.length)}.`,
    );
  }
  const questions = [];
  for (const item of raw) {
    if (!(quizQuestionTypes as readonly unknown[]).includes(item.type)) {
      return err(`Do not use the question type "${String(item.type)}".`);
    }
    const question = readQuestion({ points: quizPoints, ...item });
    if (!question.ok) return question;
    questions.push(question.value);
  }
  const quiz = createExtractedTest({ instructions: text(json.instructions), questions });
  return quiz.ok ? quiz : err(ruleBroken(quiz.error));
}

/**
 * Writes the Friday quiz for a week of lessons. It is sent the subject, grade and topics only,
 * never class or student data, and it only drafts: the teacher reviews before publishing.
 */
export class QuizWriter implements QuizWriterPort {
  constructor(private readonly llm: LlmClient) {}

  write(request: QuizRequest): Promise<Result<ExtractedTest, DraftError>> {
    const [first = '', ...others] = request.topics;
    const prompt = [
      `${stablePrefix}Write in ${languageNames[request.language]}.`,
      `Subject: ${subjectNames[request.subject]}\nGrade: ${request.grade}`,
      `Write exactly ${String(request.questionCount)} questions on this week's topics:\nTopic: ${first}\n${others.map((topic) => `- ${topic}`).join('\n')}`,
    ].join('\n\n');
    return draftWithReview(this.llm, {
      system: quizSystemPrompt,
      prompt,
      stablePrefix,
      maxTokens,
      review: (reply) => reviewQuiz(reply, request),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
