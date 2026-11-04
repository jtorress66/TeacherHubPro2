import type { StudentId } from '../shared/ids.ts';
import type { LiveAnswer, LivePlayer } from './live-player.ts';

export interface LiveInsights {
  readonly sessions: number;
  readonly participants: number;
  readonly averageAccuracy: number | null;
  /** Hardest first, matched by the question's text across sessions. */
  readonly questions: readonly {
    readonly prompt: string;
    readonly answered: number;
    readonly percentCorrect: number;
  }[];
  readonly students: readonly {
    readonly studentId: StudentId;
    readonly firstName: string;
    readonly sessions: number;
    readonly answered: number;
    readonly accuracy: number;
  }[];
}

const percent = (part: number, whole: number): number => Math.round((part / whole) * 100);

/** What a game's live sessions show about the class: practice only, never grades. */
export function liveInsights(
  sessionCount: number,
  players: readonly LivePlayer[],
  answers: readonly LiveAnswer[],
): LiveInsights {
  const byPrompt = new Map<string, { answered: number; correct: number }>();
  for (const a of answers) {
    const entry = byPrompt.get(a.prompt) ?? { answered: 0, correct: 0 };
    byPrompt.set(a.prompt, {
      answered: entry.answered + 1,
      correct: entry.correct + (a.correct ? 1 : 0),
    });
  }
  const studentOf = new Map(players.map((p) => [p.id, p]));
  const byStudent = new Map<
    StudentId,
    { firstName: string; sessions: Set<string>; answered: number; correct: number }
  >();
  for (const p of players) {
    const entry = byStudent.get(p.studentId) ?? {
      firstName: p.firstName,
      sessions: new Set<string>(),
      answered: 0,
      correct: 0,
    };
    entry.sessions.add(p.sessionId);
    byStudent.set(p.studentId, entry);
  }
  for (const a of answers) {
    const player = studentOf.get(a.playerId);
    const entry = player === undefined ? undefined : byStudent.get(player.studentId);
    if (entry === undefined) continue;
    entry.answered += 1;
    entry.correct += a.correct ? 1 : 0;
  }
  const correct = answers.filter((a) => a.correct).length;
  return {
    sessions: sessionCount,
    participants: byStudent.size,
    averageAccuracy: answers.length === 0 ? null : percent(correct, answers.length),
    questions: [...byPrompt]
      .map(([prompt, q]) => ({
        prompt,
        answered: q.answered,
        percentCorrect: percent(q.correct, q.answered),
      }))
      .sort((a, b) => a.percentCorrect - b.percentCorrect || a.prompt.localeCompare(b.prompt)),
    students: [...byStudent]
      .filter(([, s]) => s.answered > 0)
      .map(([studentId, s]) => ({
        studentId,
        firstName: s.firstName,
        sessions: s.sessions.size,
        answered: s.answered,
        accuracy: percent(s.correct, s.answered),
      }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName)),
  };
}
