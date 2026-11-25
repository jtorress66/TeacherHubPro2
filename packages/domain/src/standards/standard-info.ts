import { findStandard } from './common-core.ts';
import { findPrStandard } from './puerto-rico.ts';

export const standardSources = ['common_core', 'puerto_rico', 'typed'] as const;
export type StandardSource = (typeof standardSources)[number];

/** A standard's code, which list it comes from, and its official description when known. */
export interface StandardInfo {
  readonly code: string;
  readonly source: StandardSource;
  readonly description: string | null;
}

/** Looks a code up in the official lists; any other code is the teacher's own. */
export function describeStandard(code: string): StandardInfo {
  const commonCore = findStandard(code);
  if (commonCore !== null) {
    return { code, source: 'common_core', description: commonCore.description };
  }
  const puertoRico = findPrStandard(code);
  if (puertoRico !== null) {
    return { code, source: 'puerto_rico', description: puertoRico.description };
  }
  return { code, source: 'typed', description: null };
}
