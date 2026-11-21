import { checkParentEmail, err, ok, type ParentEmail, type Result } from '@thp/domain';
import type {
  DraftError,
  LlmClient,
  LlmResponse,
  MessageTranslator as MessageTranslatorPort,
  TranslationRequest,
} from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { parseJsonObject, text } from '../drafting/json-reply.ts';
import { languageEvidence, languageNames } from '../drafting/language.ts';

const maxTokens = 3000;

export const translatorSystemPrompt = `You translate a teacher's email to the families of their class.
The teacher reads your translation as a draft and may change it before it is sent.
Rules:
1. Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
2. Translate everything: the subject, greeting, each line and the sign-off, in a warm, plain tone a family would read easily.
3. Keep the layout: the same paragraphs and line breaks, and one bullet (•) for each bullet in the email.
4. Keep names of people, the class and the school as they are. Keep dates and numbers.
5. Never add, leave out or change any information. Never add notes about the translation.`;

/** The same for every request, so it goes first and may be cached. */
const stablePrefix = `Reply with JSON in this shape:
{ "subject": string, "body": string }

`;

const bullets = (body: string): number =>
  body.split('\n').filter((line) => line.trim().startsWith('•')).length;

/** The translated email in a reply, or what is wrong with it in plain words. */
export function reviewTranslation(
  reply: LlmResponse,
  request: TranslationRequest,
): Result<ParentEmail, string> {
  if (reply.stopReason === 'max_tokens') return err('The reply was cut off.');
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const email = checkParentEmail({
    subject: text(json.subject) ?? '',
    body: text(json.body) ?? '',
  });
  if (!email.ok) return err(`The ${email.error.field} is missing or too long.`);
  const expected = bullets(request.email.body);
  if (bullets(email.value.body) !== expected) {
    return err(`Keep the ${String(expected)} bullet lines (•) of the email, one for each.`);
  }
  const evidence = languageEvidence(`${email.value.subject}\n${email.value.body}`);
  if (evidence.hits > 0 && evidence.language !== request.to) {
    return err(`Write the subject and body in ${languageNames[request.to]}.`);
  }
  return ok(email.value);
}

/**
 * Puts a teacher's email to families into another language, keeping its layout, names, dates and
 * facts. The email names no student; the teacher checks the draft before anything is sent.
 */
export class MessageTranslator implements MessageTranslatorPort {
  constructor(private readonly llm: LlmClient) {}

  translate(request: TranslationRequest): Promise<Result<ParentEmail, DraftError>> {
    const { from, to, email } = request;
    return draftWithReview(this.llm, {
      system: translatorSystemPrompt,
      prompt: `${stablePrefix}Translate this email from ${languageNames[from]} into ${languageNames[to]}.\n\nThe email:\n${JSON.stringify(email)}`,
      stablePrefix,
      maxTokens,
      review: (reply) => reviewTranslation(reply, request),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
