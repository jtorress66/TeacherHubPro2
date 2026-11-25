import { describe, expect, it } from 'vitest';
import { describeStandard } from './standard-info.ts';

describe('describeStandard', () => {
  it('names a Common Core code with its official description', () => {
    const info = describeStandard('CCSS.Math.Content.4.OA.A.1');

    expect(info.source).toBe('common_core');
    expect(info.description).toMatch(/multiplication equation/iu);
  });

  it('names a Puerto Rico code with its official description', () => {
    const info = describeStandard('K.LS.1');

    expect(info.source).toBe('puerto_rico');
    expect(info.description).toMatch(/^Comprehend and analyze information/u);
  });

  it('keeps any other code as the teacher typed it, with no description', () => {
    expect(describeStandard('MY.SCHOOL.7')).toEqual({
      code: 'MY.SCHOOL.7',
      source: 'typed',
      description: null,
    });
  });
});
