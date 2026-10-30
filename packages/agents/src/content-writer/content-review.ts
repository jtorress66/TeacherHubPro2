import { err, maxGenerationLength, ok, removeUnknownCodes, type Result } from '@thp/domain';
import type { LlmResponse } from '@thp/ports';

const fence = /^```[a-z]*\s*\n([\s\S]*?)\n```\s*$/i;

/** The Markdown in a reply, cleaned of invented codes, or what is wrong with it in plain words. */
export function reviewContent(reply: LlmResponse): Result<string, string> {
  if (reply.stopReason === 'max_tokens') {
    return err('The reply was cut off before the end; keep it shorter.');
  }
  const trimmed = reply.text.trim();
  const text = (fence.exec(trimmed)?.[1] ?? trimmed).trim();
  if (text === '') return err('The reply was empty.');
  if (!/^#{1,3} \S/m.test(text)) return err('Start with a # heading and use Markdown headings.');
  if (text.length > maxGenerationLength) {
    return err(`The reply is too long; keep it under ${String(maxGenerationLength)} characters.`);
  }
  return ok(removeUnknownCodes(text));
}
