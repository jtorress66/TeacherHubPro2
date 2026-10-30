import {
  createLessonPlan,
  draftedPlan,
  err,
  ok,
  type DraftRequest,
  type LessonPlanDraft,
  type LessonPlanId,
  type Result,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { DraftError, LessonPlanDrafter, LlmClient, LlmMessage } from '@thp/ports';
import { parseJsonObject } from './json-reply.ts';
import { planFormats, type PlanFormat } from './plan-formats.ts';
import { systemPrompt } from './prompts.ts';

// Room for the model's thinking as well as the plan itself.
const maxTokens = 16000;
const retryMessage =
  'That reply was not valid JSON in the shape asked for. Reply again with only the JSON object.';

/** The draft must also make a valid plan (lengths, codes, days), or it is not usable. */
function isUsable(draft: LessonPlanDraft, request: DraftRequest): boolean {
  return createLessonPlan({
    id: 'draft' as LessonPlanId,
    schoolId: 'draft' as SchoolId,
    teacherId: 'draft' as UserId,
    ...draftedPlan(draft, request.start),
  }).ok;
}

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
      const json = parseJsonObject(reply.value.text);
      const draft = json === null ? null : format.parse(json, request);
      if (draft !== null && isUsable(draft, request)) return ok(draft);
      messages.push(
        { role: 'assistant', content: reply.value.text },
        { role: 'user', content: retryMessage },
      );
    }
    return err({ code: 'invalid_output' });
  }
}
