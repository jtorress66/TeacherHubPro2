import type {
  AssignmentId,
  ClassId,
  GameId,
  GradeCategoryId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import { defaultLanguage, isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { validateContent, type GameContent } from './content.ts';
import type { GameMode } from './game-mode.ts';
import type { GameModeId, GameModeRegistry, RoundView } from './mode-registry.ts';

/** A pairs game the student may play in any mode that suits it. */
export const allModes = 'all';

export type GameModeChoice = GameModeId | typeof allModes;

export const gradeMethods = ['best', 'first', 'average'] as const;

export type GradeMethod = (typeof gradeMethods)[number];

const isGradeMethod = (value: string): value is GradeMethod =>
  (gradeMethods as readonly string[]).includes(value);

export const maxGamePoints = 1000;

/** Whether, and how, a game's plays become a (teacher-confirmed) gradebook grade. */
export interface GameGrading {
  readonly countAsGrade: boolean;
  readonly method: GradeMethod;
  readonly points: number;
  readonly categoryId: GradeCategoryId | null;
  /** The gradebook assignment created the first time grading is turned on. */
  readonly assignmentId: AssignmentId | null;
}

/** A saved educational game: one kind of content, played in one mode or all that suit it. */
export interface Game {
  readonly id: GameId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly title: string;
  readonly mode: GameModeChoice;
  readonly content: GameContent;
  readonly language: Language;
  /** The class whose students see it on their links; null until the teacher shares it. */
  readonly classId: ClassId | null;
  readonly grading: GameGrading;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GameInput {
  readonly id: GameId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly title: string;
  readonly mode: string;
  readonly content: GameContent;
  readonly language?: string;
  readonly classId?: ClassId | null;
  readonly createdAt: Date;
}

/** Titles that say nothing about the game (from the original app's quality rules). */
const genericTitles = new Set([
  'quiz',
  'game',
  'test',
  'untitled',
  'new game',
  'my game',
  'juego',
  'prueba',
  'cuestionario',
]);

const noGrading: GameGrading = {
  countAsGrade: false,
  method: 'best',
  points: 100,
  categoryId: null,
  assignmentId: null,
};

function checkMode(
  mode: string,
  content: GameContent,
  modes: GameModeRegistry,
): Result<GameModeChoice, ValidationError> {
  if (mode === allModes) {
    return content.kind === 'pairs' ? ok(allModes) : invalid('mode', 'not_allowed');
  }
  const found = modes.get(mode);
  if (found === null) return invalid('mode', 'invalid_format');
  if (!found.plays(content.kind)) return invalid('mode', 'not_allowed');
  const unsuitable = found.unsuitable(content);
  return unsuitable === null ? ok(found.id) : { ok: false, error: unsuitable };
}

interface Checked {
  readonly title: string;
  readonly mode: GameModeChoice;
  readonly content: GameContent;
  readonly language: Language;
}

function check(
  input: { title: string; mode: string; content: GameContent; language: string },
  modes: GameModeRegistry,
): Result<Checked, ValidationError> {
  const title = requiredText('title', input.title);
  if (!title.ok) return title;
  if (genericTitles.has(title.value.toLocaleLowerCase())) return invalid('title', 'not_allowed');
  const content = validateContent(input.content);
  if (!content.ok) return content;
  const mode = checkMode(input.mode, content.value, modes);
  if (!mode.ok) return mode;
  if (!isLanguage(input.language)) return invalid('language', 'invalid_format');
  return ok({
    title: title.value,
    mode: mode.value,
    content: content.value,
    language: input.language,
  });
}

export function createGame(
  input: GameInput,
  modes: GameModeRegistry,
): Result<Game, ValidationError> {
  const checked = check({ ...input, language: input.language ?? defaultLanguage }, modes);
  if (!checked.ok) return checked;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    ...checked.value,
    classId: input.classId ?? null,
    grading: noGrading,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export interface GameChanges {
  readonly title?: string;
  readonly mode?: string;
  readonly content?: GameContent;
  readonly language?: string;
  readonly classId?: ClassId | null;
}

/** Edits a game; a new class turns grading off, as the old grade belonged to the old class. */
export function updateGame(
  game: Game,
  changes: GameChanges,
  now: Date,
  modes: GameModeRegistry,
): Result<Game, ValidationError> {
  const checked = check(
    {
      title: changes.title ?? game.title,
      mode: changes.mode ?? game.mode,
      content: changes.content ?? game.content,
      language: changes.language ?? game.language,
    },
    modes,
  );
  if (!checked.ok) return checked;
  const classId = changes.classId === undefined ? game.classId : changes.classId;
  const grading = classId === game.classId ? game.grading : noGrading;
  return ok({ ...game, ...checked.value, classId, grading, updatedAt: now });
}

/** The modes a student can choose from. */
export function playableModes(game: Game, modes: GameModeRegistry): readonly GameMode<RoundView>[] {
  if (game.mode !== allModes) {
    const mode = modes.get(game.mode);
    return mode === null ? [] : [mode];
  }
  return modes.modesFor(game.content.kind).filter((mode) => mode.unsuitable(game.content) === null);
}

export interface GradingInput {
  readonly countAsGrade: boolean;
  readonly method: string;
  readonly points: number;
  readonly categoryId: GradeCategoryId | null;
}

export function setGrading(game: Game, input: GradingInput): Result<Game, ValidationError> {
  if (!isGradeMethod(input.method)) return invalid('method', 'invalid_format');
  if (!Number.isInteger(input.points) || input.points < 1 || input.points > maxGamePoints) {
    return invalid('points', 'out_of_range');
  }
  if (input.countAsGrade && game.classId === null) return invalid('classId', 'required');
  if (input.countAsGrade && input.categoryId === null) return invalid('categoryId', 'required');
  return ok({
    ...game,
    grading: {
      countAsGrade: input.countAsGrade,
      method: input.method,
      points: input.points,
      categoryId: input.categoryId,
      assignmentId: game.grading.assignmentId,
    },
  });
}

export const attachGradeAssignment = (game: Game, assignmentId: AssignmentId): Game => ({
  ...game,
  grading: { ...game.grading, assignmentId },
});
