import { describe, expect, it } from 'vitest';
import {
  ContentWriter,
  PresentationWriter,
  QuestionExtractor,
  SubmissionGrader,
} from '@thp/agents';
import { LocalLlmClient } from '@thp/adapters';
import { createPresentationRequest, leniencyFor, type QuestionId } from '@thp/domain';
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

  it('reads a test into a multiple-choice, a true/false and a short-answer question', async () => {
    const test = unwrap(
      await new QuestionExtractor(local()).extract({ text: 'Any test text', language: 'es' }),
    );
    expect(test.questions.map((q) => q.type)).toEqual([
      'multiple_choice',
      'true_false',
      'short_answer',
    ]);
  });

  it('suggests half the points for every open answer it is asked about', async () => {
    const graded = unwrap(
      await new SubmissionGrader(local()).grade({
        language: 'en',
        leniency: leniencyFor('4'),
        questions: [
          {
            id: 'q3' as QuestionId,
            type: 'short_answer',
            prompt: 'Why?',
            points: 5,
            guide: null,
            answer: 'Because',
          },
          {
            id: 'q4' as QuestionId,
            type: 'essay',
            prompt: 'Write',
            points: 10,
            guide: null,
            answer: 'Text',
          },
        ],
      }),
    );
    expect(graded.scores).toEqual({
      q3: { score: 2.5, feedback: 'A good start.' },
      q4: { score: 5, feedback: 'A good start.' },
    });
  });

  it('still drafts lesson plans', () => {
    expect(JSON.parse(localReply({ system: 'planner', messages: [], maxTokens: 1 }))).toMatchObject(
      { standards: [] },
    );
  });
});
