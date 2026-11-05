import { describe, expect, it } from 'vitest';
import {
  ContentWriter,
  GameWriter,
  PathWriter,
  PresentationWriter,
  QuestionExtractor,
  TestTranscriber,
  SubmissionGrader,
} from '@thp/agents';
import { LocalLlmClient } from '@thp/adapters';
import {
  contentKinds,
  createGameRequest,
  createPathRequest,
  createPresentationRequest,
  defaultGameModes,
  gameCountRange,
  leniencyFor,
  type QuestionId,
} from '@thp/domain';
import { aContentRequest, unwrap } from '@thp/testing';
import { localReply } from './local-replies.ts';

const local = () => new LocalLlmClient(localReply);

describe('the local stand-in replies', () => {
  it('writes game content of every kind, with the count asked for, that every mode can play', async () => {
    for (const kind of contentKinds) {
      const count = gameCountRange(kind).max;
      const request = unwrap(
        createGameRequest({
          kind,
          subject: 'science',
          grade: '4',
          topic: 'Space',
          language: 'en',
          count,
        }),
      );
      const content = unwrap(await new GameWriter(local()).write(request));
      expect(content.kind).toBe(kind);
      expect(content.items).toHaveLength(count);
      for (const mode of defaultGameModes.modesFor(kind)) {
        expect(mode.unsuitable(content), `${mode.id} with ${kind}`).toBeNull();
      }
    }
  });

  it('writes a learning path with the lessons asked for; each check asks for the larger number', async () => {
    const request = unwrap(
      createPathRequest({ subject: 'math', grade: '4', language: 'en', level: 3, lessonCount: 4 }),
    );
    const draft = unwrap(await new PathWriter(local()).write(request));
    expect(draft.lessons).toHaveLength(4);
    for (const check of draft.lessons.flatMap((lesson) => lesson.checks)) {
      const larger = String(Math.max(...check.options.map(Number)));
      expect(check.options[check.answer]).toBe(larger);
    }
  });

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

  it('copies a test line by line, numbered lines as items, adding no words', async () => {
    const layout = unwrap(
      await new TestTranscriber(local()).transcribe({
        text: [
          'Space Quiz',
          '1. Which planet is closest to the Sun?',
          '2. True or false: the Sun is a star.',
        ].join('\n'),
      }),
    );
    expect(layout.blocks).toEqual([
      { kind: 'text', text: 'Space Quiz', bold: false },
      {
        kind: 'items',
        items: [{ label: '1.', text: 'Which planet is closest to the Sun?', choice: null }],
      },
      {
        kind: 'items',
        items: [{ label: '2.', text: 'True or false: the Sun is a star.', choice: null }],
      },
    ]);
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
