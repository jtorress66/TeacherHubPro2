import { ok, type Result } from '../shared/result.ts';
import { minutesOf, parseTimeOfDay, type TimeOfDay } from '../shared/time-of-day.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import { parseWeekdays, type Weekday } from '../shared/weekday.ts';

export const firstPeriod = 1;
export const lastPeriod = 12;

export interface Schedule {
  readonly period: number | null;
  readonly startTime: TimeOfDay | null;
  readonly endTime: TimeOfDay | null;
  readonly days: readonly Weekday[];
}

export interface ScheduleInput {
  readonly period?: number | null;
  readonly startTime?: string | null;
  readonly endTime?: string | null;
  readonly days?: readonly string[];
}

function parsePeriod(period: number | null | undefined): Result<number | null, ValidationError> {
  if (period == null) return ok(null);
  const inRange = Number.isInteger(period) && period >= firstPeriod && period <= lastPeriod;
  return inRange ? ok(period) : invalid('period', 'out_of_range');
}

function parseTimes(
  start: string | null | undefined,
  end: string | null | undefined,
): Result<{ startTime: TimeOfDay | null; endTime: TimeOfDay | null }, ValidationError> {
  if (start == null && end == null) return ok({ startTime: null, endTime: null });
  if (start == null) return invalid('startTime', 'required');
  if (end == null) return invalid('endTime', 'required');
  const startTime = parseTimeOfDay('startTime', start);
  if (!startTime.ok) return startTime;
  const endTime = parseTimeOfDay('endTime', end);
  if (!endTime.ok) return endTime;
  if (minutesOf(endTime.value) <= minutesOf(startTime.value)) {
    return invalid('endTime', 'invalid_order');
  }
  return ok({ startTime: startTime.value, endTime: endTime.value });
}

/** A class's daily slot: period 1–12, start before end, days default to Mon–Fri. */
export function createSchedule(input: ScheduleInput): Result<Schedule, ValidationError> {
  const period = parsePeriod(input.period);
  if (!period.ok) return period;
  const times = parseTimes(input.startTime, input.endTime);
  if (!times.ok) return times;
  const days = parseWeekdays('days', input.days);
  if (!days.ok) return days;

  return ok({ period: period.value, ...times.value, days: days.value });
}
