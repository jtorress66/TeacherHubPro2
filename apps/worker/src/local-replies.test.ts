import { describe, expect, it } from 'vitest';
import { ContentWriter, PresentationWriter } from '@thp/agents';
import { LocalLlmClient } from '@thp/adapters';
import { createPresentationRequest } from '@thp/domain';
import { aContentRequest, unwrap } from '@thp/testing';
import { localReply } from './local-replies.ts';

const local = () => new LocalLlmClient(localReply);

describe('the local stand-in replies', () => {
  it('writes a usable worksheet with a table and blanks', async () => {
    const content = unwrap(await new ContentWriter(local()).write(aContentRequest()));
    expect(content).toMatch(/^# /);
    expect(content).toContain('|---|');
    expect(content).toContain('___');
  });

  it('writes a quiz with the number of questions asked for', async () => {
    const content = unwrap(
      await new ContentWriter(local()).write(aContentRequest({ type: 'quiz', questionCount: 4 })),
    );
    const questions = content.split('## Answer key')[0]?.match(/^\d+\. /gm) ?? [];
    expect(questions).toHaveLength(4);
  });

  it('drafts the number of slides asked for, starting with a title slide', async () => {
    const request = unwrap(
      createPresentationRequest({
        topic: 'Volcanoes',
        subject: 'science',
        grade: '5',
        slideCount: 4,
        language: 'en',
      }),
    );
    const draft = unwrap(await new PresentationWriter(local()).draft(request));
    expect(draft.slides).toHaveLength(4);
    expect(draft.slides[0]?.layout).toBe('title');
  });

  it('still drafts lesson plans', () => {
    expect(JSON.parse(localReply({ system: 'planner', messages: [], maxTokens: 1 }))).toMatchObject(
      { standards: [] },
    );
  });
});
