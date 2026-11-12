import type { Assignment } from '../gradebook/assignment.ts';
import { planSpan, type LessonPlan, type LessonPlanKind } from '../lesson-plans/lesson-plan.ts';
import type { ConversationalBody } from '../lesson-plans/conversational-plan.ts';
import type { PlanDay, WeeklyBody } from '../lesson-plans/weekly-plan.ts';
import { addDays, type LocalDate } from '../shared/local-date.ts';

/** An all-day entry in a subscribed calendar. */
export interface CalendarEvent {
  /** Stable across refreshes, so calendars update the entry instead of adding another. */
  readonly uid: string;
  readonly date: LocalDate;
  /** The day after the last day (exclusive), as iCalendar expects. */
  readonly endDate: LocalDate;
  readonly summary: string;
  readonly description: string | null;
}

/** The words the calendar shows, in the teacher's language (the domain has no translations). */
export interface CalendarLabels {
  /** Shown for a plan with neither a title nor a unit. */
  readonly untitledPlan: string;
  /** The entry for an assignment due that day. */
  readonly due: (title: string, className: string) => string;
}

const uidDomain = 'teacherhubpro.com';

const allDay = (
  uid: string,
  start: LocalDate,
  last: LocalDate,
  summary: string,
  description: string | null,
): CalendarEvent => ({ uid, date: start, endDate: addDays(last, 1), summary, description });

const titled = (name: string, detail: string | null): string =>
  detail === null ? name : `${name}: ${detail}`;

const isBlank = (day: PlanDay): boolean =>
  day.theme === null &&
  day.notes === null &&
  day.activities.length === 0 &&
  day.materials.length === 0 &&
  day.dok.length === 0 &&
  day.eca.length === 0;

type KindEvents<B> = (
  plan: LessonPlan & { readonly body: B },
  untitled: string,
  description: string | null,
) => CalendarEvent[];

const wholePlan = (plan: LessonPlan, summary: string, description: string | null) => {
  const span = planSpan(plan.body);
  return allDay(`plan-${plan.id}@${uidDomain}`, span.start, span.end, summary, description);
};

/** One entry per filled-in day; a plan with no filled-in day shows once across its weeks. */
const weeklyEvents: KindEvents<WeeklyBody> = (plan, untitled, description) => {
  const name = plan.title ?? plan.body.unit ?? untitled;
  const days = plan.body.weeks.flatMap((week) =>
    week.days.map((day, index) => ({ day, date: addDays(week.weekStart, index) })),
  );
  const filled = days.filter(({ day }) => !isBlank(day));
  if (filled.length === 0) return [wholePlan(plan, name, description)];
  return filled.map(({ day, date }) =>
    allDay(
      `plan-${plan.id}-${date}@${uidDomain}`,
      date,
      date,
      titled(name, day.theme),
      description,
    ),
  );
};

const conversationalEvents: KindEvents<ConversationalBody> = (plan, untitled, description) => [
  wholePlan(plan, titled(plan.title ?? untitled, plan.body.topic), description),
];

/** Each plan kind's entries, so a new kind is a new entry here rather than a new branch. */
const eventsByKind: Readonly<Record<LessonPlanKind, KindEvents<LessonPlan['body']>>> = {
  weekly: weeklyEvents as KindEvents<LessonPlan['body']>,
  conversational_english: conversationalEvents as KindEvents<LessonPlan['body']>,
};

/**
 * A plan's calendar entries, named by its title, else its unit, else the translated label; the
 * class name (if any) goes in the description.
 */
export function planEvents(
  plan: LessonPlan,
  className: string | null,
  labels: CalendarLabels,
): CalendarEvent[] {
  return eventsByKind[plan.body.kind](plan, labels.untitledPlan, className);
}

/** The entry on an assignment's due date; none when it has no due date. */
export function assignmentEvent(
  assignment: Assignment,
  className: string,
  labels: CalendarLabels,
): CalendarEvent | null {
  const { dueDate } = assignment;
  if (dueDate === null) return null;
  return allDay(
    `assignment-${assignment.id}@${uidDomain}`,
    dueDate,
    dueDate,
    labels.due(assignment.title, className),
    null,
  );
}

/** Entries that touch any day from `from` to `to` (both included). */
export const eventsBetween = (
  events: readonly CalendarEvent[],
  from: LocalDate,
  to: LocalDate,
): CalendarEvent[] => events.filter((event) => event.endDate > from && event.date <= to);

/** iCalendar TEXT: backslash, semicolon, comma and line breaks are escaped (RFC 5545 3.3.11). */
const escapeText = (value: string): string =>
  value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r\n|\r|\n/gu, '\\n');

const maxOctets = 75;
const encoder = new TextEncoder();

/**
 * Splits a content line into lines of at most 75 octets, each continuation starting with a
 * space (RFC 5545 3.1). It cuts only between whole characters, never inside a UTF-8 sequence.
 */
function fold(line: string): string[] {
  const lines: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > maxOctets) {
      lines.push(current);
      current = ' ';
      octets = 1;
    }
    current += char;
    octets += size;
  }
  lines.push(current);
  return lines;
}

const dateValue = (date: LocalDate): string => date.replaceAll('-', '');

const stamp = (now: Date): string =>
  `${now.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '')}Z`;

const eventLines = (event: CalendarEvent, dtstamp: string): string[] => [
  'BEGIN:VEVENT',
  `UID:${event.uid}`,
  `DTSTAMP:${dtstamp}`,
  `DTSTART;VALUE=DATE:${dateValue(event.date)}`,
  `DTEND;VALUE=DATE:${dateValue(event.endDate)}`,
  `SUMMARY:${escapeText(event.summary)}`,
  ...(event.description === null ? [] : [`DESCRIPTION:${escapeText(event.description)}`]),
  // All-day entries never make the teacher look busy.
  'TRANSP:TRANSPARENT',
  'END:VEVENT',
];

/** The calendar as iCalendar text (RFC 5545) with CRLF line endings, folded at 75 octets. */
export function toICalendar(
  calendarName: string,
  events: readonly CalendarEvent[],
  now: Date,
): string {
  const dtstamp = stamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeacherHubPro//Calendar link//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...events.flatMap((event) => eventLines(event, dtstamp)),
    'END:VCALENDAR',
  ];
  return `${lines.flatMap(fold).join('\r\n')}\r\n`;
}
