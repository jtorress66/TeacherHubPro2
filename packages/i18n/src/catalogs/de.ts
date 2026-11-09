import type { Messages } from '../messages.ts';
import { deAppA } from './de-app-a.ts';
import { deAppB } from './de-app-b.ts';
import { marketingDe } from './marketing-de.ts';

export const de: Messages = {
  ...marketingDe,
  ...deAppA,
  ...deAppB,
};
