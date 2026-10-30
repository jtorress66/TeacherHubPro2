import { describe, expect, it } from 'vitest';
import type { ContentRequestInput } from '@thp/domain';
import { FakeLlmClient, aContentRequest } from '@thp/testing';
import { ContentWriter } from './content-writer.ts';
import { reviewContent } from './content-review.ts';

const request = (overrides: Partial<ContentRequestInput> = {}) => aContentRequest(overrides);

const worksheet = [
  '# Equivalent fractions',
  '',
  'Standard: CCSS.Math.Content.4.NF.A.1 and CCSS.Math.Content.4.NF.Z.9',
  '',
  '1. Shade 2/4 of the bar: ___',
].join('\n');

describe('ContentWriter', () => {
  it('asks only for what the content needs, in the teacher’s language, with the official codes', async () => {
    const llm = new FakeLlmClient().replyWith(worksheet);
    await new ContentWriter(llm).write(
      request({ language: 'fr', instructions: 'Use pizza', difficulty: 'easy' }),
    );

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toMatch(/Never invent standards codes/);
    expect(prompt).toContain('Write a printable worksheet');
    expect(prompt).toContain('Write in French (français).');
    expect(prompt).toContain('Subject: Mathematics');
    expect(prompt).toContain('Grade: 4');
    expect(prompt).toContain('Topic: Equivalent fractions');
    expect(prompt).toContain('Difficulty: easy');
    expect(prompt).toContain("Teacher's instructions: Use pizza");
    expect(prompt).toContain('CCSS.Math.Content.4.NF.A.1:');
    expect(prompt).not.toContain('CCSS.Math.Content.7.');
  });

  it('removes invented codes from the content and keeps official ones', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`markdown\n${worksheet}\n\`\`\``);
    const result = await new ContentWriter(llm).write(request());

    expect(result.ok && result.value).toContain('CCSS.Math.Content.4.NF.A.1');
    expect(result.ok && result.value).not.toContain('NF.Z.9');
    expect(result.ok && result.value.startsWith('# Equivalent fractions')).toBe(true);
  });

  it('asks a quiz for an exact number of numbered questions and an answer key', async () => {
    const llm = new FakeLlmClient().replyWith('# Quiz\n\n## Questions\n\n1. One?\n');
    await new ContentWriter(llm).write(request({ type: 'quiz', questionCount: 8 }));
    const prompt = llm.requests[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain('exactly 8 questions');
    expect(prompt).toContain('## Answer key');
  });

  it.each([
    ['lesson_plan', 'Class period: 45 minutes'],
    ['activities', 'Class period: 45 minutes'],
    ['summary', 'summary of the topic'],
  ] as const)('writes a %s prompt', async (type, expected) => {
    const llm = new FakeLlmClient().replyWith(worksheet);
    await new ContentWriter(llm).write(request({ type }));
    expect(llm.requests[0]?.messages[0]?.content).toContain(expected);
  });

  it('tells the model not to cite codes for subjects without Common Core', async () => {
    const llm = new FakeLlmClient().replyWith(worksheet);
    await new ContentWriter(llm).write(request({ subject: 'art' }));
    const prompt = llm.requests[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain('Subject: Art');
    expect(prompt).toContain('Do not cite any standards codes.');
  });

  it('retries with the reason when the reply has no heading, then gives up', async () => {
    const llm = new FakeLlmClient().replyWith('Just text').replyWith('Still no heading');
    expect(await new ContentWriter(llm).write(request())).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toContain('Start with a # heading');
  });
});

describe('reviewContent', () => {
  it.each([
    [{ text: 'x', stopReason: 'max_tokens' as const }, /cut off/],
    [{ text: '   ', stopReason: 'end' as const }, /empty/],
    [{ text: 'No heading here', stopReason: 'end' as const }, /# heading/],
    [{ text: `# T\n\n${'x'.repeat(40_001)}`, stopReason: 'end' as const }, /too long/],
  ])('rejects %o', (reply, problem) => {
    const result = reviewContent(reply);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(problem);
  });
});
