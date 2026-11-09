import type { Messages } from '../messages.ts';
import { marketingZh } from './marketing-zh.ts';
import { zhAppA } from './zh-app-a.ts';
import { zhAppB } from './zh-app-b.ts';

export const zh: Messages = {
  ...marketingZh,
  ...zhAppA,
  ...zhAppB,
};
