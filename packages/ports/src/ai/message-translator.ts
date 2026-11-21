import type { Language, ParentEmail, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** A teacher's email to families, to put in another language. It names no student. */
export interface TranslationRequest {
  readonly email: ParentEmail;
  readonly from: Language;
  readonly to: Language;
}

/** Drafts an email in a family's language for the teacher to check; it never sends anything. */
export interface MessageTranslator {
  translate(request: TranslationRequest): Promise<Result<ParentEmail, DraftError>>;
}
