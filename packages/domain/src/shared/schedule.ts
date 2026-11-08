import { ok, type Result } from './result.ts';
import { invalid, type ValidationError } from './validation.ts';

const minute = 60 * 1000;
export const minScheduleLeadMinutes = 5;
export const maxScheduleDays = 365;

/** A post scheduled for later: at least a few minutes ahead, and no more than a year away. */
export function checkSchedule(field: string, at: Date, now: Date): Result<Date, ValidationError> {
  const ahead = at.getTime() - now.getTime();
  const valid =
    !Number.isNaN(ahead) &&
    ahead >= minScheduleLeadMinutes * minute &&
    ahead <= maxScheduleDays * 24 * 60 * minute;
  return valid ? ok(at) : invalid(field, 'out_of_range');
}
