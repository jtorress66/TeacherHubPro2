import { expect, it } from 'vitest';
import { idGeneratorContract } from './contracts/id-generator.contract.ts';
import { SequentialIdGenerator } from './sequential-id-generator.ts';

idGeneratorContract('SequentialIdGenerator', () => new SequentialIdGenerator());

it('returns predictable ids with the given prefix', () => {
  const ids = new SequentialIdGenerator('student');

  expect([ids.next(), ids.next()]).toEqual(['student-1', 'student-2']);
});
