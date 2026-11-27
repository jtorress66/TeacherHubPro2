import type { Messages } from '../messages.ts';
import { itAppA } from './it-app-a.ts';
import { itAppB } from './it-app-b.ts';
import { demoIt } from './demo-it.ts';
import { marketingIt } from './marketing-it.ts';

export const it: Messages = {
  ...marketingIt,
  ...demoIt,
  ...itAppA,
  ...itAppB,
};
