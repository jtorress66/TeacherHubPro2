import { readFileSync } from 'node:fs';
import { err, ok, type Result } from '@thp/domain';
import type { LlmClient, LlmError, LlmRequest, LlmResponse } from '@thp/ports';

/**
 * Saved replies for one eval suite, by text unique to each case's prompt (often its topic). A case
 * the agent asks several times (a long quiz written in parts) saves its replies in order.
 */
export type Replays = Readonly<Record<string, string | readonly string[]>>;

/** Reads evals/replays/<suite>.json. */
export const loadReplays = (suite: string): Replays =>
  JSON.parse(
    readFileSync(new URL(`../../../../evals/replays/${suite}.json`, import.meta.url), 'utf8'),
  ) as Replays;

/**
 * A model that answers each prompt with the reply saved for it: the reply whose key is the case's
 * `Topic: …` line, or otherwise text found in the prompt. So the evals are scored without calling
 * Claude. A prompt with no saved reply fails.
 */
export class ReplayLlmClient implements LlmClient {
  private readonly asked = new Map<string, number>();

  constructor(private readonly replies: Replays) {}

  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmError>> {
    const prompt = request.messages[0]?.content ?? '';
    const keys = Object.keys(this.replies);
    const topic =
      keys.find((key) => prompt.includes(`Topic: ${key}\n`)) ??
      keys.find((key) => prompt.includes(key));
    const text = topic === undefined ? undefined : this.next(topic);
    return Promise.resolve(
      text === undefined ? err({ code: 'invalid_request' }) : ok({ text, stopReason: 'end' }),
    );
  }

  /** The topic's next saved reply; its last one once all have been used. */
  private next(topic: string): string | undefined {
    const saved = this.replies[topic];
    if (saved === undefined || typeof saved === 'string') return saved;
    const turn = this.asked.get(topic) ?? 0;
    this.asked.set(topic, turn + 1);
    return saved[Math.min(turn, saved.length - 1)];
  }
}
