import {
  allModes,
  defaultGameModes,
  isLanguage,
  type ClassId,
  type ContentKind,
  type GameContent,
  type GameId,
  type GameModeChoice,
  type GradeCategoryId,
} from '@thp/domain';
import type { GameDraftInput, UseCaseError } from '@thp/application';
import { createTranslator, defaultLocale, isLocale, type Locale } from '@thp/i18n';
import { formErrors, messageFor } from './error-messages.ts';
import { parseContentText } from './game-text.ts';

// Form shapes for games. Only the shape is read here: the domain checks the values.

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const pageLocale = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : defaultLocale;
};

const languageOf = (data: FormData, locale: Locale): string => {
  const chosen = field(data, 'language');
  return isLanguage(chosen) ? chosen : locale;
};

/** "All modes" first, then every mode. */
export const gameModeChoices: readonly GameModeChoice[] = [
  allModes,
  ...defaultGameModes.all().map((mode) => mode.id),
];

/** The kind of content a mode plays ("all modes" plays pairs). */
export const kindForMode = (mode: string): ContentKind =>
  mode === allModes ? 'pairs' : (defaultGameModes.get(mode)?.kind ?? 'questions');

export interface GameFormInput {
  readonly title: string;
  readonly mode: string;
  readonly content: GameContent;
  readonly classId: ClassId | null;
  readonly language: string;
}

export function parseGameForm(data: FormData): { locale: Locale; input: GameFormInput } {
  const locale = pageLocale(data);
  const mode = field(data, 'mode');
  const classId = field(data, 'classId');
  return {
    locale,
    input: {
      title: field(data, 'title'),
      mode,
      content: parseContentText(kindForMode(mode), field(data, 'content')),
      classId: classId === '' ? null : (classId as ClassId),
      language: languageOf(data, locale),
    },
  };
}

/** Errors for the game form: an item's problem goes under the content, numbered from 1. */
export function gameFormErrors(error: UseCaseError, locale: Locale): Record<string, string> {
  if (!('field' in error) || !error.field.startsWith('items')) return formErrors(error, locale);
  const t = createTranslator(locale);
  const item = /^items\.(\d+)/u.exec(error.field)?.[1];
  if (item === undefined) {
    return {
      content: error.code === 'too_short' ? t('games.tooFewItems') : t('games.tooManyItems'),
    };
  }
  return {
    content: t('games.itemError', { item: Number(item) + 1, message: messageFor(error, locale) }),
  };
}

export function parseGradingForm(data: FormData) {
  const categoryId = field(data, 'categoryId');
  const points = field(data, 'points');
  return {
    countAsGrade: data.get('countAsGrade') === 'on',
    method: field(data, 'method'),
    points: points === '' ? Number.NaN : Number(points),
    categoryId: categoryId === '' ? null : (categoryId as GradeCategoryId),
  };
}

export function parseGameDraftForm(data: FormData): {
  locale: Locale;
  mode: string;
  input: Omit<GameDraftInput, 'actor'>;
} {
  const locale = pageLocale(data);
  const mode = field(data, 'mode');
  const count = field(data, 'count');
  const gameId = field(data, 'gameId');
  return {
    locale,
    mode,
    input: {
      kind: kindForMode(mode),
      subject: field(data, 'subject'),
      grade: field(data, 'grade'),
      topic: field(data, 'topic'),
      ...(count === '' ? {} : { count: Number(count) }),
      language: languageOf(data, locale),
      ...(gameId === '' ? {} : { gameId: gameId as GameId }),
    },
  };
}

const scorePrefix = 'score:';

/** The scores the teacher changed before confirming; blank ones keep the draft. */
export function parseConfirmScores(data: FormData): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [key, value] of data.entries()) {
    if (!key.startsWith(scorePrefix) || typeof value !== 'string' || value.trim() === '') continue;
    scores[key.slice(scorePrefix.length)] = Number(value);
  }
  return scores;
}

/** A play's time as m:ss. */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}
