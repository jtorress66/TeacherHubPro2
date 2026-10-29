import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, map, ok } from './result.ts';

describe('Result', () => {
  it('wraps a success value in ok', () => {
    const result = ok(42);

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('wraps a failure in err', () => {
    const result = err('not_found');

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });

  it('maps over ok and leaves err untouched', () => {
    const double = (n: number): number => n * 2;

    expect(map(ok(21), double)).toEqual(ok(42));
    expect(map(err<string>('boom'), double)).toEqual(err('boom'));
  });
});
