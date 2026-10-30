import type { DraftRequest, LessonPlanDraft, Result } from '@thp/domain';
import type { DraftError, LessonPlanDrafter, LlmClient } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { planFormats, type PlanFormat } from './plan-formats.ts';
import { systemPrompt } from './prompts.ts';
import { reviewReply } from './reply-review.ts';

// Room for the model's thinking as well as the plan itself.
const maxTokens = 16000;
const retryMessage = (problem: string) =>
  `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`;

/**
 * Drafts lesson plans with a language model. It only drafts: the teacher reviews, edits and
 * saves. It sends the model only what the plan needs (no class, school or student data) and
 * keeps only standards codes from the official list.
 */
export class LessonPlanner implements LessonPlanDrafter {
  constructor(
    private readonly llm: LlmClient,
    private readonly formats: Readonly<Record<DraftRequest['kind'], PlanFormat>> = planFormats,
  ) {}

  draft(request: DraftRequest): Promise<Result<LessonPlanDraft, DraftError>> {
    const format = this.formats[request.kind];
    return draftWithReview(this.llm, {
      system: systemPrompt,
      prompt: format.prompt(request),
      maxTokens,
      review: (reply) => reviewReply(format, request, reply),
      retry: retryMessage,
    });
  }
}
