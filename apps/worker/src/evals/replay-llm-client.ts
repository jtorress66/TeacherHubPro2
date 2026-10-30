import { readFileSync } from 'node:fs';
import { err, ok, type Result } from '@thp/domain';
import type { LlmClient, LlmError, LlmRequest, LlmResponse } from '@thp/ports';

/** Saved replies for one eval suite, by the case's topic. */
export type Replays = Readonly<Record<string, string>>;

/** Reads evals/replays/<suite>.json. */
export const loadReplays = (suite: string): Replays =>
  JSON.parse(
    readFileSync(new URL(`../../../../evals/replays/${suite}.json`, import.meta.url), 'utf8'),
  ) as Replays;

/**
 * A model that answers each prompt with the reply saved for its topic (`Topic: …` in the prompt),
 * so the evals can be scored without calling Claude. A prompt with no saved reply fails.
 */
export class ReplayLlmClient implements LlmClient {
  constructor(private readonly replies: Replays) {}

  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    const prompt = request.messages[0]?.content ?? '';
    const topic = Object.keys(this.replies).find((key) => prompt.includes(`Topic: ${key}\n`));
    const text = topic === undefined ? undefined : this.replies[topic];
    return Promise.resolve(
      text === undefined ? err({ code: 'invalid_request' }) : ok({ text, stopReason: 'end' }),
    );
  }
}
