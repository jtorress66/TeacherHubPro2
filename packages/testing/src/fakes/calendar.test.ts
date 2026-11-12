import { calendarFeedRepositoryContract } from '../contracts/calendar.contract.ts';
import { InMemoryCalendarFeedRepository } from './repositories.ts';

calendarFeedRepositoryContract(
  'InMemoryCalendarFeedRepository',
  () => new InMemoryCalendarFeedRepository(),
);
