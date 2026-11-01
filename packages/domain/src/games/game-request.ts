import { assistantSubjects, type AssistantSubject } from '../assistant/content-request.ts';
import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';
import { isContentKind, maxItemTextLength, minItemsFor, type ContentKind } from './content.ts';

/** What a teacher asks the game writer for. It holds no class or student data. */
export interface GameRequest {
  readonly kind: ContentKind;
  readonly subject: AssistantSubject;
  readonly grade: GradeLevel;
  readonly topic: string;
  /** Items to write (groups: how many groups). */
  readonly count: number;
  readonly language: Language;
  /** Items already in the game, so asking again writes fresh ones. */
  readonly avoid: readonly string[];
}

export interface GameRequestInput {
  readonly kind: string;
  readonly subject: string;
  readonly grade: string;
  readonly topic: string;
  readonly language: string;
  readonly count?: number;
  readonly avoid?: readonly string[];
}

export interface CountRange {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

const groupRange: CountRange = { min: 2, max: 4, default: 3 };
const maxItems = 20;
const defaultItems = 8;
const maxAvoid = 30;

export const gameCountRange = (kind: ContentKind): CountRange =>
  kind === 'groups'
    ? groupRange
    : { min: minItemsFor(kind), max: maxItems, default: Math.max(defaultItems, minItemsFor(kind)) };

const isSubject = (value: string): value is AssistantSubject =>
  (assistantSubjects as readonly string[]).includes(value);

export function createGameRequest(input: GameRequestInput): Result<GameRequest, ValidationError> {
  if (!isContentKind(input.kind)) return invalid('kind', 'invalid_format');
  if (!isSubject(input.subject)) return invalid('subject', 'invalid_format');
  if (!isGradeLevel(input.grade)) return invalid('grade', 'invalid_format');
  if (!isLanguage(input.language)) return invalid('language', 'invalid_format');
  const topic = requiredText('topic', input.topic);
  if (!topic.ok) return topic;
  const range = gameCountRange(input.kind);
  const count = input.count ?? range.default;
  if (!Number.isInteger(count) || count < range.min || count > range.max) {
    return invalid('count', 'out_of_range');
  }
  const avoid = (input.avoid ?? [])
    .map((item) => item.trim().slice(0, maxItemTextLength))
    .filter((item) => item !== '')
    .slice(0, maxAvoid);
  return ok({
    kind: input.kind,
    subject: input.subject,
    grade: input.grade,
    topic: topic.value,
    count,
    language: input.language,
    avoid,
  });
}
