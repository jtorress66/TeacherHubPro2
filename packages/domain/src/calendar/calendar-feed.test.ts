import { describe, expect, it } from 'vitest';
import type { Assignment } from '../gradebook/assignment.ts';
import {
  createLessonPlan,
  type LessonPlan,
  type LessonPlanInput,
} from '../lesson-plans/lesson-plan.ts';
import type { PlanDayInput } from '../lesson-plans/weekly-plan.ts';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  LessonPlanId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { valueOf } from '../test-support.ts';
import {
  assignmentEvent,
  eventsBetween,
  planEvents,
  toICalendar,
  type CalendarEvent,
  type CalendarLabels,
} from './calendar-feed.ts';

const labels: CalendarLabels = {
  untitledPlan: 'Lesson plan',
  due: (title, className) => `Due: ${title} (${className})`,
};

const ids = {
  id: 'plan-1' as LessonPlanId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'user-1' as UserId,
};

const plan = (input: Partial<LessonPlanInput> & Pick<LessonPlanInput, 'body'>): LessonPlan =>
  valueOf(createLessonPlan({ ...ids, ...input }));

/** A week starting Monday 2026-09-07; missing days are blank. */
const weekOf = (days: PlanDayInput[], title: string | null = 'Fractions') =>
  plan({
    title,
    body: {
      kind: 'weekly',
      weeks: [{ weekStart: '2026-09-07', days: [0, 1, 2, 3, 4].map((i) => days[i] ?? {}) }],
    },
  });

const anAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: 'a-1' as AssignmentId,
  schoolId: 'school-1' as SchoolId,
  classId: 'class-1' as ClassId,
  categoryId: 'cat-1' as GradeCategoryId,
  title: 'Volcano quiz',
  points: 10,
  dueDate: '2026-09-10' as LocalDate,
  instructions: null,
  questions: [],
  ...overrides,
});

describe('lesson plan events', () => {
  it('gives each weekly plan day with a theme its own all-day event', () => {
    const events = planEvents(
      weekOf([{ theme: 'Halves' }, {}, { theme: 'Quarters' }, {}, {}]),
      null,
      labels,
    );

    expect(events).toEqual([
      {
        uid: 'plan-plan-1-2026-09-07@teacherhubpro.com',
        date: '2026-09-07',
        endDate: '2026-09-08',
        summary: 'Fractions: Halves',
        description: null,
      },
      {
        uid: 'plan-plan-1-2026-09-09@teacherhubpro.com',
        date: '2026-09-09',
        endDate: '2026-09-10',
        summary: 'Fractions: Quarters',
        description: null,
      },
    ]);
  });

  it('uses the title alone for a day with content but no theme, and skips empty days', () => {
    const events = planEvents(
      weekOf([{}, { notes: 'Review' }, {}, { activities: [{ type: 'vocabulary' }] }, {}]),
      null,
      labels,
    );

    expect(events.map((e) => [e.date, e.summary])).toEqual([
      ['2026-09-08', 'Fractions'],
      ['2026-09-10', 'Fractions'],
    ]);
  });

  it('falls back to the unit, then to the translated label, when the plan has no title', () => {
    const byUnit = plan({
      body: {
        kind: 'weekly',
        unit: 'Unit 3',
        weeks: [{ weekStart: '2026-09-07', days: [{ theme: 'Halves' }, {}, {}, {}, {}] }],
      },
    });
    const untitled = weekOf([{ theme: 'Halves' }], null);

    expect(planEvents(byUnit, null, labels)[0]?.summary).toBe('Unit 3: Halves');
    expect(planEvents(untitled, null, labels)[0]?.summary).toBe('Lesson plan: Halves');
  });

  it('shows a weekly plan with no filled-in days as one event across its weeks', () => {
    const blank = plan({
      title: 'Planning',
      body: { kind: 'weekly', weeks: [{ weekStart: '2026-09-07' }, { weekStart: '2026-09-14' }] },
    });

    expect(planEvents(blank, null, labels)).toEqual([
      {
        uid: 'plan-plan-1@teacherhubpro.com',
        date: '2026-09-07',
        endDate: '2026-09-19',
        summary: 'Planning',
        description: null,
      },
    ]);
  });

  it('dates days of a second week from that week’s Monday', () => {
    const twoWeeks = plan({
      title: 'Fractions',
      body: {
        kind: 'weekly',
        weeks: [
          { weekStart: '2026-09-07' },
          { weekStart: '2026-09-14', days: [{}, {}, {}, {}, { theme: 'Test' }] },
        ],
      },
    });

    expect(planEvents(twoWeeks, null, labels).map((e) => e.date)).toEqual(['2026-09-18']);
  });

  it('puts the class name in the description', () => {
    expect(planEvents(weekOf([{ theme: 'Halves' }]), 'Math 5', labels)[0]?.description).toBe(
      'Math 5',
    );
  });

  it('shows a conversational lesson as one event over its days', () => {
    const lesson = plan({
      title: 'Ordering food',
      body: {
        kind: 'conversational_english',
        lessonDate: '2026-09-08',
        lessonDateEnd: '2026-09-10',
        topic: 'At the café',
      },
    });

    expect(planEvents(lesson, null, labels)).toEqual([
      {
        uid: 'plan-plan-1@teacherhubpro.com',
        date: '2026-09-08',
        endDate: '2026-09-11',
        summary: 'Ordering food: At the café',
        description: null,
      },
    ]);
  });

  it('uses the lesson title alone when there is no topic', () => {
    const lesson = plan({
      title: 'Ordering food',
      body: { kind: 'conversational_english', lessonDate: '2026-09-08' },
    });

    expect(planEvents(lesson, null, labels)[0]).toMatchObject({
      summary: 'Ordering food',
      date: '2026-09-08',
      endDate: '2026-09-09',
    });
  });
});

describe('assignment events', () => {
  it('shows the due date with the translated label and the class name', () => {
    expect(assignmentEvent(anAssignment(), 'Science 5', labels)).toEqual({
      uid: 'assignment-a-1@teacherhubpro.com',
      date: '2026-09-10',
      endDate: '2026-09-11',
      summary: 'Due: Volcano quiz (Science 5)',
      description: null,
    });
  });

  it('has no event without a due date', () => {
    expect(assignmentEvent(anAssignment({ dueDate: null }), 'Science 5', labels)).toBeNull();
  });
});

describe('events between two dates', () => {
  const event = (date: string, endDate: string): CalendarEvent => ({
    uid: `${date}@x`,
    date: date as LocalDate,
    endDate: endDate as LocalDate,
    summary: 's',
    description: null,
  });

  it('keeps events that touch the window and drops the rest', () => {
    const events = [
      event('2026-08-01', '2026-08-02'),
      event('2026-08-30', '2026-09-02'),
      event('2026-09-05', '2026-09-06'),
      event('2026-09-10', '2026-09-11'),
      event('2026-09-11', '2026-09-12'),
    ];

    expect(
      eventsBetween(events, '2026-09-01' as LocalDate, '2026-09-10' as LocalDate).map(
        (e) => e.date,
      ),
    ).toEqual(['2026-08-30', '2026-09-05', '2026-09-10']);
  });
});

describe('iCalendar text', () => {
  const now = new Date('2026-09-01T08:05:09.123Z');
  const event: CalendarEvent = {
    uid: 'plan-p1-2026-09-07@teacherhubpro.com',
    date: '2026-09-07' as LocalDate,
    endDate: '2026-09-08' as LocalDate,
    summary: 'Fractions: Halves',
    description: 'Math 5',
  };
  const lines = (text: string) => text.split('\r\n');

  it('writes a calendar with CRLF line endings', () => {
    const text = toICalendar('TeacherHubPro', [event], now);

    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/u);
    expect(lines(text).slice(0, 4)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TeacherHubPro//Calendar link//EN',
      'CALSCALE:GREGORIAN',
    ]);
    expect(lines(text).at(-2)).toBe('END:VCALENDAR');
  });

  it('names the calendar and suggests how often to refresh it', () => {
    const text = lines(toICalendar('My plans', [], now));

    expect(text).toContain('X-WR-CALNAME:My plans');
    expect(text).toContain('METHOD:PUBLISH');
    expect(text).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT6H');
    expect(text).toContain('X-PUBLISHED-TTL:PT6H');
    expect(text).not.toContain('BEGIN:VEVENT');
  });

  it('writes each event as an all-day event with a stable id and a time stamp', () => {
    const text = lines(toICalendar('TeacherHubPro', [event], now));
    const start = text.indexOf('BEGIN:VEVENT');

    expect(text.slice(start, text.indexOf('END:VEVENT') + 1)).toEqual([
      'BEGIN:VEVENT',
      'UID:plan-p1-2026-09-07@teacherhubpro.com',
      'DTSTAMP:20260901T080509Z',
      'DTSTART;VALUE=DATE:20260907',
      'DTEND;VALUE=DATE:20260908',
      'SUMMARY:Fractions: Halves',
      'DESCRIPTION:Math 5',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    ]);
  });

  it('leaves out the description when there is none', () => {
    const text = toICalendar('TeacherHubPro', [{ ...event, description: null }], now);

    expect(text).not.toContain('DESCRIPTION');
  });

  it('escapes backslashes, semicolons, commas and new lines in text', () => {
    const text = lines(
      toICalendar(
        'A, B; C',
        [{ ...event, summary: 'Read\\write; add, subtract', description: 'one\ntwo\r\nthree' }],
        now,
      ),
    );

    expect(text).toContain('X-WR-CALNAME:A\\, B\\; C');
    expect(text).toContain('SUMMARY:Read\\\\write\\; add\\, subtract');
    expect(text).toContain('DESCRIPTION:one\\ntwo\\nthree');
  });

  it('folds lines longer than 75 octets, continuing with a space', () => {
    const summary = 'x'.repeat(200);
    const text = lines(toICalendar('TeacherHubPro', [{ ...event, summary }], now));
    const first = text.findIndex((line) => line.startsWith('SUMMARY:'));
    const folded = [text[first] ?? ''];
    for (let i = first + 1; text[i]?.startsWith(' ') === true; i += 1) folded.push(text[i] ?? '');

    expect(folded.length).toBeGreaterThan(1);
    for (const line of folded)
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.map((line, i) => (i === 0 ? line : line.slice(1))).join('')).toBe(
      `SUMMARY:${summary}`,
    );
  });

  it('never splits a multi-byte character when folding', () => {
    const summary = '数学'.repeat(60) + '😀'.repeat(20);
    const text = lines(toICalendar('TeacherHubPro', [{ ...event, summary }], now));
    const first = text.findIndex((line) => line.startsWith('SUMMARY:'));
    const folded = [text[first] ?? ''];
    for (let i = first + 1; text[i]?.startsWith(' ') === true; i += 1) folded.push(text[i] ?? '');

    for (const line of folded) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
      expect(line).not.toMatch(/�/u);
      expect(line).toBe(new TextDecoder().decode(new TextEncoder().encode(line)));
    }
    expect(folded.map((line, i) => (i === 0 ? line : line.slice(1))).join('')).toBe(
      `SUMMARY:${summary}`,
    );
  });
});
