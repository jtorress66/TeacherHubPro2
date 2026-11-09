import type { Messages } from '../messages.ts';
import { itAppA } from './it-app-a.ts';
import { itAppB } from './it-app-b.ts';
import { marketingIt } from './marketing-it.ts';

export const it: Messages = {
  ...marketingIt,
  ...itAppA,
  ...itAppB,
};
