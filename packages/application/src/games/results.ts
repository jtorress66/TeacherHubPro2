import {
  createGrade,
  gameSummary,
  gradeFromPlays,
  leaderboard,
  ok,
  studentStats,
  type Game,
  type GameId,
  type GameModeRegistry,
  type GamePlay,
  type GameSummary,
  type Grade,
  type GradeId,
  type LeaderboardEntry,
  type Result,
  type Student,
  type StudentGameStats,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GamePlayRepository,
  GameRepository,
  GradeRepository,
  IdGenerator,
  StudentRepository,
} from '@thp/ports';
import type { LinkDeps } from '../assignments/student-portal.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';
import { findOwnGame, type GameRef } from './game-access.ts';
import { linkGame } from './play.ts';

const fullName = (student: Student): string => `${student.firstName} ${student.lastName}`;

/** The game's plays by students still on its class's roster. */
async function rosterPlays(
  deps: { readonly gamePlays: GamePlayRepository; readonly students: StudentRepository },
  game: Game,
): Promise<{ plays: readonly GamePlay[]; roster: readonly Student[] }> {
  if (game.classId === null) return { plays: [], roster: [] };
  const roster = await deps.students.listByClass(game.schoolId, game.classId);
  const ids = new Set(roster.map((student) => student.id));
  const plays = await deps.gamePlays.listByGame(game.schoolId, game.id);
  return { plays: plays.filter((play) => ids.has(play.studentId)), roster };
}

export interface StudentLeaderboardRow {
  readonly rank: number;
  readonly name: string;
  readonly percent: number;
  readonly durationMs: number;
  /** The row of the student viewing. */
  readonly you: boolean;
}

/** The class's best plays by first name only; no other student's id leaves the server. */
export class GetGameLeaderboard {
  constructor(
    private readonly deps: LinkDeps & {
      readonly games: GameRepository;
      readonly gameModes: GameModeRegistry;
      readonly gamePlays: GamePlayRepository;
    },
  ) {}

  async execute(input: {
    readonly token: string;
    readonly gameId: GameId;
  }): Promise<Result<readonly StudentLeaderboardRow[], UseCaseError>> {
    const found = await linkGame(this.deps, input.token, input.gameId);
    if (!found.ok) return found;
    const { holder, game } = found.value;
    const { plays, roster } = await rosterPlays(this.deps, game);
    const names = new Map(roster.map((student) => [student.id, student.firstName]));
    return ok(
      leaderboard(plays, names).map((entry) => ({
        rank: entry.rank,
        name: entry.name,
        percent: entry.percent,
        durationMs: entry.durationMs,
        you: entry.studentId === holder.student.id,
      })),
    );
  }
}

export interface StudentGameResult extends StudentGameStats {
  readonly name: string;
  /** What the grade would be by the game's method; a draft until the teacher confirms. */
  readonly draftScore: number | null;
  readonly confirmedScore: number | null;
}

export interface GameResults {
  readonly game: Game;
  readonly summary: GameSummary;
  readonly leaderboard: readonly LeaderboardEntry[];
  readonly students: readonly StudentGameResult[];
}

interface ResultsDeps {
  readonly games: GameRepository;
  readonly gamePlays: GamePlayRepository;
  readonly students: StudentRepository;
  readonly grades: GradeRepository;
}

/** The teacher's view: full names, each student's attempts and draft grade, and the summary. */
export class GetGameResults {
  constructor(private readonly deps: ResultsDeps) {}

  async execute(input: GameRef): Promise<Result<GameResults, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    const { plays, roster } = await rosterPlays(this.deps, game.value);
    const names = new Map(roster.map((student) => [student.id, fullName(student)]));
    const { assignmentId, countAsGrade, method, points } = game.value.grading;
    const students: StudentGameResult[] = [];
    for (const stats of studentStats(plays)) {
      const own = plays.filter((play) => play.studentId === stats.studentId);
      const grade =
        assignmentId === null
          ? null
          : await this.deps.grades.findFor(game.value.schoolId, stats.studentId, assignmentId);
      students.push({
        ...stats,
        name: names.get(stats.studentId) ?? '',
        draftScore: countAsGrade ? gradeFromPlays(own, method, points) : null,
        confirmedScore: grade?.score ?? null,
      });
    }
    students.sort((a, b) => a.name.localeCompare(b.name));
    return ok({
      game: game.value,
      summary: gameSummary(plays),
      leaderboard: leaderboard(plays, names),
      students,
    });
  }
}

/**
 * Turns the game's draft grades into gradebook grades in one step, with any scores the teacher
 * adjusted. Only students on the roster who played get a grade; confirming again updates them.
 */
export class ConfirmGameGrades {
  constructor(
    private readonly deps: ResultsDeps & {
      readonly classes: ClassRepository;
      readonly assignments: AssignmentRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(
    input: GameRef & { readonly scores?: Readonly<Record<string, number>> },
  ): Promise<Result<readonly Grade[], UseCaseError>> {
    const found = await findOwnGame(this.deps.games, input);
    if (!found.ok) return found;
    const game = found.value;
    const { countAsGrade, assignmentId, method, points } = game.grading;
    if (!countAsGrade || assignmentId === null || game.classId === null) {
      return fail('grading_off');
    }
    const cls = await findEditableClass(this.deps.classes, input.actor, game.classId);
    if (!cls.ok) return cls;
    const assignment = await this.deps.assignments.findById(game.schoolId, assignmentId);
    if (assignment?.classId !== cls.value.id) return fail('grading_off');
    const { plays } = await rosterPlays(this.deps, game);
    const grades: Grade[] = [];
    for (const { studentId } of studentStats(plays)) {
      const own = plays.filter((play) => play.studentId === studentId);
      const existing = await this.deps.grades.findFor(game.schoolId, studentId, assignmentId);
      const grade = createGrade({
        id: existing?.id ?? (this.deps.ids.next() as GradeId),
        schoolId: game.schoolId,
        studentId,
        assignmentId,
        status: 'graded',
        score: input.scores?.[studentId] ?? gradeFromPlays(own, method, points),
        maxPoints: assignment.points,
        source: 'game',
        gradedBy: input.actor.id,
      });
      if (!grade.ok) return grade;
      grades.push(grade.value);
    }
    for (const grade of grades) await this.deps.grades.save(grade);
    return ok(grades);
  }
}
