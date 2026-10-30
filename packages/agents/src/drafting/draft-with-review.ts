import { err, type Result } from '@thp/domain';
import type { DraftError, LlmClient, LlmMessage, LlmResponse } from '@thp/ports';

export interface ReviewedDraft<T> {
  readonly system: string;
  readonly prompt: string;
  readonly maxTokens: number;
  /** The usable value in a reply, or what is wrong with it in plain words. */
  readonly review: (reply: LlmResponse) => Result<T, string>;
  /** The follow-up that asks the model to fix the problem. */
  readonly retry: (problem: string) => string;
}

/**
 * Asks the model once, and once more with the reason when the reply is unusable. Every drafting
 * agent shares this loop; each brings its own prompt and review.
 */
export async function draftWithReview<T>(
  llm: LlmClient,
  { system, prompt, maxTokens, review, retry }: ReviewedDraft<T>,
): Promise<Result<T, DraftError>> {
  const messages: LlmMessage[] = [{ role: 'user', content: prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await llm.complete({ system, messages, maxTokens });
    if (!reply.ok) return err({ code: 'ai_unavailable' });
    const reviewed = review(reply.value);
    if (reviewed.ok) return reviewed;
    messages.push(
      { role: 'assistant', content: reply.value.text },
      { role: 'user', content: retry(reviewed.error) },
    );
  }
  return err({ code: 'invalid_output' });
}
