import { err, type DraftRequest, type LessonPlanDraft, type Result } from '@thp/domain';
import type { DraftError, LessonPlanDrafter, LlmClient, LlmMessage } from '@thp/ports';
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

  async draft(request: DraftRequest): Promise<Result<LessonPlanDraft, DraftError>> {
    const format = this.formats[request.kind];
    const messages: LlmMessage[] = [{ role: 'user', content: format.prompt(request) }];

    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = await this.llm.complete({
        system: systemPrompt,
        messages,
        maxTokens,
      });
      if (!reply.ok) return err({ code: 'ai_unavailable' });
      const draft = reviewReply(format, request, reply.value);
      if (draft.ok) return draft;
      messages.push(
        { role: 'assistant', content: reply.value.text },
        { role: 'user', content: retryMessage(draft.error) },
      );
    }
    return err({ code: 'invalid_output' });
  }
}
