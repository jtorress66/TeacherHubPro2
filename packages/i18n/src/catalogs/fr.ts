import type { Messages } from '../messages.ts';
import { frAppA } from './fr-app-a.ts';
import { frAppB } from './fr-app-b.ts';
import { marketingFr } from './marketing-fr.ts';

export const fr: Messages = {
  ...marketingFr,
  ...frAppA,
  ...frAppB,
};
