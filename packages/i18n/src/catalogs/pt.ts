import type { Messages } from '../messages.ts';
import { demoPt } from './demo-pt.ts';
import { marketingPt } from './marketing-pt.ts';
import { ptAppA } from './pt-app-a.ts';
import { ptAppB } from './pt-app-b.ts';

export const pt: Messages = {
  ...marketingPt,
  ...demoPt,
  ...ptAppA,
  ...ptAppB,
};
