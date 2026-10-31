import type { AiScores, GradingRequest, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Suggests scores and feedback for open answers; the teacher confirms before they count. */
export interface SubmissionGrader {
  grade(request: GradingRequest): Promise<Result<AiScores, DraftError>>;
}
