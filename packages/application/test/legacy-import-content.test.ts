import { describe, expect, it } from 'vitest';
import type { MigrationReport, SchoolId, StudentId, UserId } from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { InMemoryLeadRepository } from '@thp/testing';
import { ImportLegacyData } from '../src/index.ts';
import { makeWorld } from './world.ts';

type Export = Record<string, readonly LegacyDocument[]>;

const quizQuestions = [
  {
    question: 'Capital of France?',
    options: ['Paris', 'Rome', 'Lima', 'Oslo'],
    correct_answer: 'Paris',
  },
  {
    question: 'Capital of Peru?',
    options: ['Paris', 'Rome', 'Lima', 'Oslo'],
    correct_answer: 'Lima',
  },
  {
    question: 'Capital of Italy?',
    options: ['Paris', 'Rome', 'Lima', 'Oslo'],
    correct_answer: 'Rome',
  },
];

const lesson = (n: number) => ({
  id: `lesson_${String(n)}`,
  title: `Fractions ${String(n)}`,
  objective: 'Compare fractions',
  duration: '15 min',
  content: 'A fraction names part of a whole.',
  questions: [1, 2, 3].map((q) => ({
    question: `Which is bigger, part ${String(q)}?`,
    options: ['1/2', '1/3', '1/4'],
    correct_answer: '1/2',
  })),
});

/** An export with one teacher, class and student, plus the content collections. */
const oldData = (): Export => ({
  schools: [{ school_id: 'school_ana', name: 'Lincoln' }],
  users: [
    {
      user_id: 'user_ana',
      email: 'ana@school.edu',
      name: 'Ana',
      school_id: 'school_ana',
      language: 'en',
    },
  ],
  classes: [
    { class_id: 'class_math', school_id: 'school_ana', teacher_id: 'user_ana', name: 'Math' },
  ],
  students: [
    {
      student_id: 'student_jose',
      class_id: 'class_math',
      first_name: 'José',
      last_name: 'Álvarez',
    },
  ],
  assignments: [
    { assignment_id: 'game_assign_game_quiz', class_id: 'class_math', title: 'Game: Capitals' },
  ],
  educational_games: [
    {
      game_id: 'game_quiz',
      teacher_id: 'user_ana',
      title: 'World capitals',
      game_type: 'quiz',
      language: 'en',
      questions: quizQuestions,
      count_as_grade: true,
      grade_points: 50,
      grade_method: 'average',
      class_id: 'class_math',
      created_at: '2026-08-01T10:00:00+00:00',
    },
    {
      game_id: 'game_cards',
      teacher_id: 'user_ana',
      title: 'Fraction words',
      game_type: 'flashcards',
      language: 'es',
      questions: [
        { question: 'Numerator', correct_answer: 'Top number' },
        { question: 'Denominator', correct_answer: 'Bottom number' },
        { question: 'Fraction', correct_answer: 'Part of a whole' },
        { question: 'Whole', correct_answer: 'All the parts' },
      ],
    },
    {
      game_id: 'game_order',
      teacher_id: 'user_ana',
      title: 'Planet order',
      game_type: 'drag_drop',
      questions: [
        {
          instruction: 'Order from the Sun',
          items: ['Earth', 'Mercury', 'Venus', 'Mars'],
          correct_order: ['Mercury', 'Venus', 'Earth', 'Mars'],
        },
        { instruction: 'Second challenge', items: ['a', 'b', 'c'], correct_order: ['a', 'b', 'c'] },
      ],
    },
    {
      game_id: 'game_bad',
      teacher_id: 'user_ana',
      title: 'Broken',
      game_type: 'quiz',
      questions: [],
    },
  ],
  game_scores: [{ score_id: 'score_1', game_id: 'game_quiz', player_name: 'José', score: 2 }],
  game_progress: [{ game_id: 'game_quiz', user_id: 'user_ana' }],
  presentations: [
    {
      presentation_id: 'pres_1',
      user_id: 'user_ana',
      name: 'The water cycle',
      topic: 'Water',
      subject: 'science',
      grade_level: '4',
      theme_id: 'ocean',
      slides: [
        { layout: 'title', title: 'The water cycle', subtitle: 'Grade 4', emoji: '💧' },
        {
          layout: 'content',
          title: 'Steps',
          bullets: ['Evaporation', 'Condensation'],
          emoji: 'rain',
        },
        { layout: 'mystery', title: 'Odd one' },
      ],
      created_at: '2026-08-02T10:00:00+00:00',
    },
  ],
  ai_generations: [
    {
      generation_id: 'gen_1',
      user_id: 'user_ana',
      tool_type: 'quiz',
      subject: 'math',
      grade_level: '5',
      topic: 'Fractions',
      content: '# Quiz\n1. What is 1/2 + 1/2?',
      created_at: '2026-08-03T10:00:00+00:00',
    },
    {
      generation_id: 'gen_2',
      user_id: 'user_ana',
      tool_type: 'rap_song',
      subject: 'math',
      grade_level: '5',
      topic: 'X',
      content: 'Yo',
    },
  ],
  adaptive_learning_paths: [
    {
      path_id: 'path_1',
      student_id: 'student_jose',
      subject: 'math',
      grade_level: '5',
      level: 2,
      title: 'Fractions path',
      description: 'Compare and add fractions',
      lessons: [lesson(1), lesson(2), lesson(3)],
      created_at: '2026-08-04T10:00:00+00:00',
    },
    {
      path_id: 'path_2',
      student_id: 'student_jose',
      subject: 'math',
      grade_level: '5',
      title: 'Too short',
      lessons: [{ ...lesson(1), questions: [] }],
    },
  ],
  adaptive_learning_progress: [
    { student_id: 'student_jose', subject: 'math', completed_lessons: ['lesson_1'] },
  ],
  ai_templates: [{ template_id: 'tmpl_1', user_id: 'user_ana', name: 'Unit', days: {} }],
});

async function imported(data: Export = oldData()) {
  const world = { ...makeWorld(), leads: new InMemoryLeadRepository() };
  const legacy = { read: (c: string) => Promise.resolve(data[c] ?? []) };
  const report = await new ImportLegacyData({ ...world, legacy }).execute({ apply: true });
  return { world, report };
}

const line = (report: MigrationReport, collection: string) =>
  report.collections.find((c) => c.collection === collection);

const school = 'school_ana' as SchoolId;
const ana = 'user_ana' as UserId;

describe('importing the old app’s games, presentations, history and learning paths', () => {
  it('turns each old game type into new content and a mode, keeping its grading', async () => {
    const { world, report } = await imported();

    const games = await world.games.listByTeacher(school, ana);
    expect(games.map((g) => [g.id, g.mode, g.content.kind, g.language, g.classId])).toEqual([
      ['game_quiz', 'quiz', 'questions', 'en', 'class_math'],
      ['game_cards', 'flashcards', 'pairs', 'es', null],
      ['game_order', 'sequence', 'steps', 'en', null],
    ]);
    expect(games[0]?.content.items[1]).toEqual({
      prompt: 'Capital of Peru?',
      options: ['Paris', 'Rome', 'Lima', 'Oslo'],
      answer: 2,
    });
    expect(games[0]?.grading).toEqual({
      countAsGrade: true,
      method: 'average',
      points: 50,
      categoryId: 'class_math:other',
      assignmentId: 'game_assign_game_quiz',
    });
    expect(games[2]?.content.items).toEqual(['Mercury', 'Venus', 'Earth', 'Mars']);
    expect(line(report, 'educational_games')).toMatchObject({
      read: 4,
      imported: 3,
      skipped: { invalid_items_too_short: 1 },
      notes: { extra_challenges_dropped: 1 },
    });
  });

  it('leaves out old game scores, which already reached the gradebook as grades, and play progress', async () => {
    const { report } = await imported();

    expect(line(report, 'game_scores')?.skipped).toEqual({ kept_as_grades: 1 });
    expect(line(report, 'game_progress')?.skipped).toEqual({ transient: 1 });
  });

  it('imports presentations, dropping slides and emoji the new rules refuse', async () => {
    const { world, report } = await imported();

    const presentation = world.presentations.all()[0];
    expect(presentation).toMatchObject({
      id: 'pres_1',
      teacherId: 'user_ana',
      name: 'The water cycle',
      subject: 'science',
      grade: '4',
      theme: 'ocean',
      createdAt: new Date('2026-08-02T10:00:00Z'),
    });
    expect(presentation?.slides.map((s) => [s.layout, s.title, s.emoji, s.bullets])).toEqual([
      ['title', 'The water cycle', '💧', []],
      ['content', 'Steps', '', ['Evaporation', 'Condensation']],
    ]);
    expect(line(report, 'presentations')?.notes).toEqual({ slide_dropped: 1, emoji_dropped: 1 });
  });

  it('keeps the assistant history in the teacher’s language; unknown tools are left out', async () => {
    const { world, report } = await imported();

    expect(world.generations.all()).toMatchObject([
      {
        id: 'gen_1',
        type: 'quiz',
        subject: 'math',
        grade: '5',
        topic: 'Fractions',
        language: 'en',
        createdAt: new Date('2026-08-03T10:00:00Z'),
      },
    ]);
    expect(line(report, 'ai_generations')?.skipped).toEqual({ invalid_type_not_allowed: 1 });
  });

  it('brings learning paths back as drafts for the teacher to review and assign', async () => {
    const { world, report } = await imported();

    const [path] = await world.learningPaths.listByStudent(school, 'student_jose' as StudentId);
    expect(path).toMatchObject({
      id: 'path_1',
      teacherId: 'user_ana',
      classId: 'class_math',
      status: 'draft',
      level: 2,
      language: 'en',
    });
    expect(path?.lessons[0]).toMatchObject({
      title: 'Fractions 1',
      minutes: 15,
      checks: [
        { prompt: 'Which is bigger, part 1?', options: ['1/2', '1/3', '1/4'], answer: 0 },
        expect.anything(),
        expect.anything(),
      ],
    });
    expect(line(report, 'adaptive_learning_paths')?.skipped).toEqual({
      invalid_lessons_too_short: 1,
    });
    expect(line(report, 'adaptive_learning_progress')?.skipped).toEqual({ no_scores_to_carry: 1 });
    expect(line(report, 'ai_templates')?.skipped).toEqual({ no_counterpart: 1 });
    expect(report.unaccounted).toEqual([]);
  });
});
