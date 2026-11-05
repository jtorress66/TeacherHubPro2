import { describe, expect, it } from 'vitest';
import type { TestLayout } from '@thp/domain';
import { scoreTranscription } from './transcriber-scorecard.ts';

const source =
  'A. Match\n______ 1. risks a. a danger\n______ 2. capable b. able\n1. I felt ___ . (True / False)';
const layout: TestLayout = {
  blocks: [
    { kind: 'part', title: 'A. Match' },
    {
      kind: 'columns',
      rows: [
        ['______ 1. risks', 'a. a danger'],
        ['______ 2. capable', 'b. able'],
      ],
    },
    { kind: 'items', items: [{ label: '1.', text: 'I felt ___ .', choice: 'True / False' }] },
  ],
};
const expected = { labels: ['1.'], contains: ['a. a danger', 'b. able', '______ 2. capable'] };

describe('scoreTranscription', () => {
  it('scores a faithful layout fully', () => {
    expect(scoreTranscription(expected, layout, source)).toEqual({
      structure: 1,
      fidelity: 1,
      order: 1,
      coverage: 1,
    });
  });

  it('scores nothing when there is no layout', () => {
    expect(scoreTranscription(expected, null, source)).toEqual({
      structure: 0,
      fidelity: 0,
      order: 0,
      coverage: 0,
    });
  });

  it('marks down added words, renumbering and missing lines', () => {
    const changed: TestLayout = {
      blocks: [
        { kind: 'part', title: 'A. Match words carefully' },
        { kind: 'items', items: [{ label: '5.', text: 'I felt ___ .' }] },
      ],
    };
    const scores = scoreTranscription(expected, changed, source);
    expect(scores.structure).toBe(1);
    expect(scores.fidelity).toBeLessThan(1);
    expect(scores.order).toBe(0);
    expect(scores.coverage).toBe(0);
  });

  it('scores a case that expects no labels or lines, and a layout of lines only', () => {
    const lines: TestLayout = { blocks: [{ kind: 'lines', count: 2 }] };
    expect(scoreTranscription({ labels: [], contains: [] }, lines, source)).toEqual({
      structure: 1,
      fidelity: 1,
      order: 1,
      coverage: 1,
    });
  });
});
