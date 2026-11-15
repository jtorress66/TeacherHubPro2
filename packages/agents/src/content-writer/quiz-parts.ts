import { err, ok, questionPartSize, type Result } from '@thp/domain';

// A long quiz is written in parts so each reply stays well inside the model's output limit and
// the model keeps count. Every part is read the same way: questions under one heading, numbered
// as asked, then their answers under the next heading with the same numbers. Headings may be in
// any language, so only the structure is read.

/** The question numbers of one part. */
export interface PartRange {
  readonly from: number;
  readonly to: number;
}

/** One part, read: its lines, where its questions and answers end, and its question stems. */
export interface QuizPart {
  readonly lines: readonly string[];
  /** Index just after the last line of the questions section. */
  readonly questionsEnd: number;
  /** Index of the first numbered question line. */
  readonly questionsStart: number;
  /** Index of the first numbered answer line. */
  readonly answersStart: number;
  /** Index just after the last answer. */
  readonly answersEnd: number;
  /** Each question's first line, without its number. */
  readonly stems: readonly string[];
}

/** The parts of a quiz of `total` questions: 1–25, then 26–50, … */
export function partsOf(total: number): { first: PartRange; rest: readonly PartRange[] } {
  const rest: PartRange[] = [];
  for (let from = questionPartSize + 1; from <= total; from += questionPartSize) {
    rest.push({ from, to: Math.min(from + questionPartSize - 1, total) });
  }
  return { first: { from: 1, to: Math.min(questionPartSize, total) }, rest };
}

const heading = /^#{1,6}\s/;
const numbered = /^\s{0,3}(\d+)[.)]\s+(\S.*)$/;

/** A numbered line: where it is, its number and its text. */
interface Item {
  readonly index: number;
  readonly number: number;
  readonly stem: string;
}

/** A stretch of the document from one heading to the next, with its numbered lines. */
interface Section {
  readonly start: number;
  readonly end: number;
  readonly items: readonly Item[];
}

const itemOf = (line: string, index: number): Item[] => {
  const match = numbered.exec(line);
  return match === null ? [] : [{ index, number: Number(match[1]), stem: String(match[2]).trim() }];
};

/** A stem compared without case, punctuation or spacing. */
export const normalisedStem = (stem: string): string =>
  stem
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The document cut at its headings, with the numbered lines of each section. */
function sectionsOf(lines: readonly string[]): readonly Section[] {
  const starts = [0, ...lines.flatMap((line, i) => (i > 0 && heading.test(line) ? [i] : []))];
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? lines.length;
    const items = lines.slice(start, end).flatMap((line, offset) => itemOf(line, start + offset));
    return { start, end, items };
  });
}

/** The sections that have numbered lines, in order: each line's number and text. */
export function numberedSections(
  markdown: string,
): readonly { readonly numbers: readonly number[]; readonly stems: readonly string[] }[] {
  return sectionsOf(markdown.split('\n'))
    .filter((section) => section.items.length > 0)
    .map(({ items }) => ({ numbers: items.map((i) => i.number), stems: items.map((i) => i.stem) }));
}

const isNumbered = (items: readonly Item[], range: PartRange): boolean =>
  items.length === range.to - range.from + 1 &&
  items.every((item, i) => item.number === range.from + i);

const isBlank = (line: string | undefined): boolean => line === undefined || line.trim() === '';

/** Index just after the last non-blank line before `end`. */
function lastFilled(lines: readonly string[], from: number, end: number): number {
  let last = end;
  while (last > from && isBlank(lines[last - 1])) last--;
  return last;
}

/** Index just after the item at `start`: its line and the lines right below that continue it. */
function itemEnd(lines: readonly string[], start: number, end: number): number {
  let next = start + 1;
  while (next < end && !isBlank(lines[next]) && itemOf(String(lines[next]), next).length === 0) {
    next++;
  }
  return next;
}

/**
 * Reads one part, or says in plain words what is wrong with it: the questions must be numbered
 * exactly `from` to `to`, an answer key with the same numbers must follow, and no question may
 * repeat an earlier one.
 */
export function readQuizPart(
  markdown: string,
  range: PartRange,
  earlierStems: readonly string[],
): Result<QuizPart, string> {
  const span = `${String(range.from)}. to ${String(range.to)}.`;
  const lines = markdown.split('\n');
  const [questions, answers] = sectionsOf(lines).filter((section) => section.items.length > 0);
  const [firstQuestion] = questions?.items ?? [];
  if (
    questions === undefined ||
    firstQuestion === undefined ||
    !isNumbered(questions.items, range)
  ) {
    return err(`Number the questions ${span}, one question per number, under one heading.`);
  }
  const [firstAnswer] = answers?.items ?? [];
  const lastAnswer = answers?.items.at(-1);
  if (answers === undefined || firstAnswer === undefined || lastAnswer === undefined) {
    return err('Add the answer key under its own heading after the questions.');
  }
  if (!isNumbered(answers.items, range)) {
    return err(`Number the answer key ${span}, one answer per question.`);
  }
  const stems = questions.items.map((item) => item.stem);
  const seen = new Set(earlierStems.map(normalisedStem));
  const repeated = stems.findIndex((stem) => {
    const key = normalisedStem(stem);
    const known = seen.has(key);
    seen.add(key);
    return known;
  });
  if (repeated !== -1) {
    return err(
      `Question ${String(range.from + repeated)} repeats an earlier question; write a new one.`,
    );
  }
  return ok({
    lines,
    questionsStart: firstQuestion.index,
    questionsEnd: lastFilled(lines, questions.start, questions.end),
    answersStart: firstAnswer.index,
    answersEnd: itemEnd(lines, lastAnswer.index, answers.end),
    stems,
  });
}

/**
 * One quiz from its parts: the first part as written (title, headings, notes), with the later
 * parts' questions after its questions and their answers after its answers.
 */
export function mergeQuizParts(first: QuizPart, later: readonly QuizPart[]): string {
  const lines = (part: QuizPart, start: number, end: number) =>
    part.lines.slice(start, lastFilled(part.lines, start, end));
  return [
    ...first.lines.slice(0, first.questionsEnd),
    ...later.flatMap((part) => ['', ...lines(part, part.questionsStart, part.questionsEnd)]),
    ...first.lines.slice(first.questionsEnd, first.answersEnd),
    // No blank line between answers, so the key stays one numbered list.
    ...later.flatMap((part) => lines(part, part.answersStart, part.answersEnd)),
    ...first.lines.slice(first.answersEnd),
  ].join('\n');
}

/** Earlier questions as a short list for the next part's prompt: number and stem only. */
export const stemList = (stems: readonly string[]): string =>
  stems.map((stem, i) => `${String(i + 1)}. ${stem.slice(0, 160)}`).join('\n');
