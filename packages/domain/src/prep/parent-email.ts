import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

export const maxEmailSubjectLength = 200;
export const maxEmailBodyLength = 5000;
const maxTemplateTextLength = 500;

/**
 * The parent email's fixed wording in the teacher's language, already filled in with the class
 * and teacher names by the app, so the domain holds no text of its own.
 */
export interface EmailTemplate {
  readonly subject: string;
  readonly greeting: string;
  readonly intro: string;
  readonly quizLine: string;
  readonly signOff: string;
  /** Monday to Friday. */
  readonly dayLabels: readonly string[];
}

export interface ParentEmail {
  readonly subject: string;
  readonly body: string;
}

const templateTexts = ['subject', 'greeting', 'intro', 'quizLine', 'signOff'] as const;

export function checkEmailTemplate(
  template: EmailTemplate,
): Result<EmailTemplate, ValidationError> {
  for (const key of templateTexts) {
    const text = requiredText(`emailTemplate.${key}`, template[key], maxTemplateTextLength);
    if (!text.ok) return text;
  }
  if (template.dayLabels.length !== 5) return invalid('emailTemplate.dayLabels', 'out_of_range');
  return ok(template);
}

/** The draft the teacher edits: each day's topic, and the quiz line when there is a quiz. */
export function parentEmailDraft(input: {
  readonly template: EmailTemplate;
  readonly dayThemes: readonly string[];
  readonly hasQuiz: boolean;
}): ParentEmail {
  const { template } = input;
  const days = input.dayThemes
    .map((theme, index) => `• ${template.dayLabels[index] ?? ''}: ${theme}`)
    .join('\n');
  const parts = [template.greeting, template.intro, days];
  if (input.hasQuiz) parts.push(template.quizLine);
  parts.push(template.signOff);
  return { subject: template.subject, body: parts.join('\n\n') };
}

export function checkParentEmail(email: ParentEmail): Result<ParentEmail, ValidationError> {
  const subject = requiredText('subject', email.subject, maxEmailSubjectLength);
  if (!subject.ok) return subject;
  const body = requiredText('body', email.body, maxEmailBodyLength);
  if (!body.ok) return body;
  return ok({ subject: subject.value, body: body.value });
}
