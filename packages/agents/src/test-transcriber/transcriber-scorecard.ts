import type { TestLayout } from '@thp/domain';
import { inventedWords, layoutTexts } from './test-transcriber.ts';

export const transcriberMetrics = ['structure', 'fidelity', 'order', 'coverage'] as const;
export type TranscriberMetric = (typeof transcriberMetrics)[number];
export type TranscriberScores = Readonly<Record<TranscriberMetric, number>>;

/** What an eval case expects from a test's text. */
export interface ExpectedTranscription {
  /** The question labels as printed, in order, across every items block. */
  readonly labels: readonly string[];
  /** Printed text that must appear in the layout as is (definitions with their letters, …). */
  readonly contains: readonly string[];
}

const words = (value: string): string[] => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Scores one eval case: valid blocks, no added words, labels kept in order, lines kept. */
export function scoreTranscription(
  expected: ExpectedTranscription,
  layout: TestLayout | null,
  source: string,
): TranscriberScores {
  if (layout === null) return { structure: 0, fidelity: 0, order: 0, coverage: 0 };
  const shown = layoutTexts(layout);
  const unique = new Set(shown.flatMap(words)).size;
  const labels = layout.blocks.flatMap((block) =>
    block.kind === 'items' ? block.items.map((item) => item.label) : [],
  );
  const inOrder = expected.labels.filter((label, i) => labels[i] === label).length;
  const found = expected.contains.filter((needle) => shown.some((text) => text.includes(needle)));
  return {
    structure: 1,
    fidelity: unique === 0 ? 1 : 1 - inventedWords(layout, source).length / unique,
    order:
      expected.labels.length === 0
        ? 1
        : labels.length === expected.labels.length
          ? inOrder / expected.labels.length
          : 0,
    coverage: expected.contains.length === 0 ? 1 : found.length / expected.contains.length,
  };
}
