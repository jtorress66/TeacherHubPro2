import {
  instantIn,
  invalid,
  ok,
  type LocalDate,
  type Result,
  type ValidationError,
} from '@thp/domain';

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * "Post now" (no time), or "Schedule" with the date and time the teacher picked, read in their
 * time zone. The use case checks the moment is in the allowed range.
 */
export function scheduledAtOf(
  data: FormData,
  timeZone: string,
): Result<Date | null, ValidationError> {
  if (field(data, 'when') !== 'later') return ok(null);
  const date = /^\d{4}-\d{2}-\d{2}$/u.exec(field(data, 'scheduleDate'));
  const time = /^(\d{2}):(\d{2})$/u.exec(field(data, 'scheduleTime'));
  if (date === null || time === null) return invalid('scheduledAt', 'required');
  return ok(instantIn(date[0] as LocalDate, Number(time[1]), Number(time[2]), timeZone));
}
