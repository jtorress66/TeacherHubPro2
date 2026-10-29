import { err, ok, type Result } from './result.ts';

export interface InvalidTransition<S extends string, A extends string> {
  readonly code: 'invalid_transition';
  readonly from: S;
  readonly action: A;
}

/** For each action, the states it may start from. */
export type TransitionTable<S extends string, A extends string> = Readonly<Record<A, readonly S[]>>;

/** Succeeds when `action` is allowed from `from` according to `table`. */
export function guardTransition<S extends string, A extends string>(
  table: TransitionTable<S, A>,
  from: S,
  action: A,
): Result<true, InvalidTransition<S, A>> {
  return table[action].includes(from)
    ? ok(true)
    : err({ code: 'invalid_transition', from, action });
}
