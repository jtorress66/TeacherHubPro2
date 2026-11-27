import type { Messages } from '../messages.ts';
import { frAppA } from './fr-app-a.ts';
import { frAppB } from './fr-app-b.ts';
import { demoFr } from './demo-fr.ts';
import { marketingFr } from './marketing-fr.ts';

export const fr: Messages = {
  ...marketingFr,
  ...demoFr,
  ...frAppA,
  ...frAppB,
};
