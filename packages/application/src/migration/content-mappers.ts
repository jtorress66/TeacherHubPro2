import {
  createContentRequest,
  createGame,
  createGeneration,
  createLearningPath,
  createPresentation,
  gradeMethods,
  isGradeLevel,
  isSingleEmoji,
  learningLevels,
  maxGamePoints,
  maxSlides,
  normalizeName,
  presentationThemes,
  slideLayouts,
  type AssistantSubject,
  type GameContent,
  type GameId,
  type GenerationId,
  type GradeMethod,
  type LearningLesson,
  type LearningPathId,
  type LessonCheck,
  type PresentationId,
  type SlideInput,
} from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { flag, instant, number, records, strings, text } from './legacy-fields.ts';
import { invalidReason, type LegacyMapper, type MigrationSet } from './migration-set.ts';

/** A multiple-choice question: the right option is named by its text. */
const choice = (doc: LegacyDocument, prompt: string): LessonCheck => {
  const options = strings(doc, 'options');
  return {
    prompt: text(doc, prompt) ?? '',
    options,
    answer: options.indexOf(text(doc, 'correct_answer') ?? ''),
  };
};

const truthy = ['true', 'verdadero', 'cierto'];

const pairsOf = (questions: readonly LegacyDocument[], term: string, definition: string) => ({
  kind: 'pairs' as const,
  items: questions.map((q) => ({
    term: text(q, term) ?? '',
    definition: text(q, definition) ?? '',
  })),
});

/** Each old game type as new content and the mode that plays it like the old game did. */
const gameTypes: Readonly<
  Record<string, { mode: string; content: (questions: readonly LegacyDocument[]) => GameContent }>
> = {
  quiz: {
    mode: 'quiz',
    content: (qs) => ({ kind: 'questions', items: qs.map((q) => choice(q, 'question')) }),
  },
  true_false: {
    mode: 'true_false',
    content: (qs) => ({
      kind: 'statements',
      items: qs.map((q) => ({
        statement: text(q, 'question') ?? '',
        isTrue: truthy.includes(text(q, 'correct_answer')?.toLowerCase() ?? ''),
      })),
    }),
  },
  fill_blanks: {
    mode: 'fill_blanks',
    content: (qs) => ({
      kind: 'sentences',
      items: qs.map((q) => ({
        text: text(q, 'question') ?? '',
        answer: text(q, 'correct_answer') ?? '',
      })),
    }),
  },
  matching: { mode: 'matching', content: (qs) => pairsOf(qs, 'question', 'correct_answer') },
  flashcards: { mode: 'flashcards', content: (qs) => pairsOf(qs, 'question', 'correct_answer') },
  word_search: { mode: 'word_search', content: (qs) => pairsOf(qs, 'word', 'hint') },
  crossword: { mode: 'crossword', content: (qs) => pairsOf(qs, 'correct_answer', 'clue') },
  // The old drag-and-drop put items in order: the sequence game now.
  drag_drop: {
    mode: 'sequence',
    content: (qs) => ({
      kind: 'steps',
      items: qs[0] === undefined ? [] : strings(qs[0], 'correct_order'),
    }),
  },
};

const teacherLanguage = (set: MigrationSet, teacherId: string) =>
  [...set.users.values(), ...set.adopted.values()].find((u) => u.id === teacherId)?.language ??
  'es';

/** Games keep their content, class and grading (pointing at the gradebook column they made). */
export const gamesMapper: LegacyMapper = {
  collection: 'educational_games',
  map(docs, { set, tally, now, gameModes }) {
    for (const doc of docs) {
      const id = text(doc, 'game_id');
      const teacher = set.user(text(doc, 'teacher_id'));
      const type = gameTypes[text(doc, 'game_type') ?? ''];
      if (id === null || teacher === null || type === undefined) {
        tally.skipped(
          'educational_games',
          id === null ? 'missing_id' : teacher === null ? 'teacher_not_found' : 'unknown_game_type',
        );
        continue;
      }
      const questions = records(doc, 'questions');
      if (type.mode === 'sequence' && questions.length > 1) {
        tally.noted('educational_games', 'extra_challenges_dropped');
      }
      const cls = set.classes.get(text(doc, 'class_id') ?? '');
      const game = createGame(
        {
          id: id as GameId,
          schoolId: teacher.schoolId,
          teacherId: teacher.id,
          title: text(doc, 'title') ?? '',
          mode: type.mode,
          content: type.content(questions),
          language: text(doc, 'language') ?? teacher.language,
          classId: cls?.id ?? null,
          createdAt: instant(doc, 'created_at') ?? now,
        },
        gameModes,
      );
      if (!game.ok) {
        tally.skipped('educational_games', invalidReason(game.error));
        continue;
      }
      const assignment = set.assignments.get(`game_assign_${id}`);
      const method = text(doc, 'grade_method');
      const points = number(doc, 'grade_points') ?? 100;
      const grades = flag(doc, 'count_as_grade') && cls !== undefined && assignment !== undefined;
      set.games.push(
        grades
          ? {
              ...game.value,
              grading: {
                countAsGrade: true,
                method: (gradeMethods as readonly (string | null)[]).includes(method)
                  ? (method as GradeMethod)
                  : 'best',
                points: Math.min(Math.max(points, 1), maxGamePoints),
                categoryId: assignment.categoryId,
                assignmentId: assignment.id,
              },
            }
          : game.value,
      );
      tally.imported('educational_games');
    }
  },
};

/** Subject names as the old app stored them, as the new app's subjects. */
const subjects: Readonly<Record<string, AssistantSubject>> = {
  math: 'math',
  mathematics: 'math',
  matematicas: 'math',
  ela: 'ela',
  english: 'ela',
  'english language arts': 'ela',
  'language arts': 'ela',
  reading: 'ela',
  science: 'science',
  ciencias: 'science',
  'social studies': 'social_studies',
  social_studies: 'social_studies',
  'estudios sociales': 'social_studies',
  spanish: 'spanish',
  espanol: 'spanish',
  art: 'art',
  arte: 'art',
  music: 'music',
  musica: 'music',
  'physical education': 'physical_education',
  'educacion fisica': 'physical_education',
  technology: 'technology',
  tecnologia: 'technology',
};

const subjectOf = (value: string | null): AssistantSubject =>
  subjects[normalizeName(value ?? '')] ?? subjects[value ?? ''] ?? 'other';

/** "5", "5th", "Grade 5" or "Kindergarten" as a grade level. */
function gradeOf(value: string | null): string {
  const name = normalizeName(value ?? '');
  if (name === 'k' || name.startsWith('kinder')) return 'K';
  return /\d+/u.exec(name)?.[0] ?? name;
}

export const presentationsMapper: LegacyMapper = {
  collection: 'presentations',
  map(docs, { set, tally, now }) {
    const note = (reason: string) => {
      tally.noted('presentations', reason);
    };
    for (const doc of docs) {
      const id = text(doc, 'presentation_id');
      const teacher = set.user(text(doc, 'user_id'));
      if (id === null || teacher === null) {
        tally.skipped('presentations', id === null ? 'missing_id' : 'teacher_not_found');
        continue;
      }
      const slides = records(doc, 'slides').flatMap((slide): SlideInput[] => {
        const layout = text(slide, 'layout') ?? 'content';
        if (!(slideLayouts as readonly string[]).includes(layout)) {
          note('slide_dropped');
          return [];
        }
        const emoji = text(slide, 'emoji');
        if (emoji !== null && !isSingleEmoji(emoji)) note('emoji_dropped');
        return [
          {
            layout,
            title: text(slide, 'title'),
            subtitle: text(slide, 'subtitle'),
            content: text(slide, 'content'),
            emoji: emoji !== null && isSingleEmoji(emoji) ? emoji : '',
            bullets: strings(slide, 'bullets'),
          },
        ];
      });
      if (slides.length > maxSlides) note('slides_over_limit');
      const theme = text(doc, 'theme_id') ?? '';
      const grade = gradeOf(text(doc, 'grade_level'));
      const createdAt = instant(doc, 'created_at') ?? now;
      const presentation = createPresentation({
        id: id as PresentationId,
        schoolId: teacher.schoolId,
        teacherId: teacher.id,
        name: text(doc, 'name') ?? text(doc, 'topic') ?? '',
        topic: text(doc, 'topic'),
        subject: subjectOf(text(doc, 'subject')),
        grade: isGradeLevel(grade) ? grade : null,
        theme: (presentationThemes as readonly string[]).includes(theme)
          ? theme
          : presentationThemes[0],
        slides: slides.slice(0, maxSlides),
        now: createdAt,
      });
      if (!presentation.ok) {
        tally.skipped('presentations', invalidReason(presentation.error));
        continue;
      }
      set.presentations.push({
        ...presentation.value,
        updatedAt: instant(doc, 'updated_at') ?? createdAt,
      });
      tally.imported('presentations');
    }
  },
};

/** The assistant's history; the old app wrote it in the teacher's language. */
export const generationsMapper: LegacyMapper = {
  collection: 'ai_generations',
  map(docs, { set, tally, now }) {
    for (const doc of docs) {
      const id = text(doc, 'generation_id');
      const teacher = set.user(text(doc, 'user_id'));
      if (id === null || teacher === null) {
        tally.skipped('ai_generations', id === null ? 'missing_id' : 'teacher_not_found');
        continue;
      }
      const request = createContentRequest({
        type: text(doc, 'tool_type') ?? '',
        subject: subjectOf(text(doc, 'subject')),
        grade: gradeOf(text(doc, 'grade_level')),
        topic: text(doc, 'topic') ?? '',
        language: teacher.language,
      });
      const generation = request.ok
        ? createGeneration({
            id: id as GenerationId,
            schoolId: teacher.schoolId,
            teacherId: teacher.id,
            request: request.value,
            content: text(doc, 'content') ?? '',
            createdAt: instant(doc, 'created_at') ?? now,
          })
        : request;
      if (!generation.ok) {
        tally.skipped('ai_generations', invalidReason(generation.error));
        continue;
      }
      set.generations.push(generation.value);
      tally.imported('ai_generations');
    }
  },
};

const lessonOf = (doc: LegacyDocument): LearningLesson => ({
  title: text(doc, 'title') ?? '',
  objective: text(doc, 'objective') ?? '',
  minutes: Number(/\d+/u.exec(text(doc, 'duration') ?? '')?.[0] ?? 15),
  content: text(doc, 'content') ?? '',
  checks: records(doc, 'questions').map((q) => choice(q, 'question')),
});

/**
 * Old learning paths, which the AI wrote and students saw at once, come back as drafts: here a
 * teacher reviews a path and assigns it before it reaches the student's link.
 */
export const learningPathsMapper: LegacyMapper = {
  collection: 'adaptive_learning_paths',
  map(docs, { set, tally, now }) {
    for (const doc of docs) {
      const id = text(doc, 'path_id');
      const student = set.student(text(doc, 'student_id'));
      const cls = student === null ? undefined : set.classes.get(student.classId);
      if (id === null || student === null || cls === undefined) {
        tally.skipped('adaptive_learning_paths', id === null ? 'missing_id' : 'student_not_found');
        continue;
      }
      const level = number(doc, 'level') ?? learningLevels.onGrade;
      const path = createLearningPath({
        id: id as LearningPathId,
        schoolId: student.schoolId,
        teacherId: cls.teacherId,
        studentId: student.id,
        classId: cls.id,
        subject: subjectOf(text(doc, 'subject')),
        grade: gradeOf(text(doc, 'grade_level')),
        language: teacherLanguage(set, cls.teacherId),
        level: Math.min(Math.max(Math.round(level), learningLevels.min), learningLevels.max),
        title: text(doc, 'title') ?? '',
        description: text(doc, 'description') ?? '',
        lessons: records(doc, 'lessons').map(lessonOf),
        createdAt: instant(doc, 'created_at') ?? now,
      });
      if (!path.ok) {
        tally.skipped('adaptive_learning_paths', invalidReason(path.error));
        continue;
      }
      set.learningPaths.push(path.value);
      tally.imported('adaptive_learning_paths');
    }
  },
};
