import type { Result, TestLayout } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Copies a printed test's layout from its text, as printed, for a document students type in. */
export interface TestTranscriber {
  transcribe(input: { readonly text: string }): Promise<Result<TestLayout, DraftError>>;
}
