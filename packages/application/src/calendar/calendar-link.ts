import {
  addDays,
  assignmentEvent,
  eventsBetween,
  localDateIn,
  ok,
  planEvents,
  toICalendar,
  type CalendarEvent,
  type CalendarLabels,
  type Language,
  type Result,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  CalendarFeedRepository,
  ClassRepository,
  Clock,
  LessonPlanRepository,
  RandomTokenGenerator,
  TokenHasher,
  UserRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

/** The calendar shows plans and due dates from this many days ago… */
export const calendarDaysBack = 60;
/** …to this many days ahead. */
export const calendarDaysAhead = 365;

interface LinkDeps {
  readonly calendarFeeds: CalendarFeedRepository;
  readonly tokens: RandomTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly clock: Clock;
  /** The configured site address: every calendar link points here. */
  readonly appUrl: string;
}

/** The calendar's own name and entries, in the teacher's language. */
export interface CalendarFeedLabels extends CalendarLabels {
  readonly calendarName: string;
}

/** A link just made: its full address is shown once and never stored. */
export interface IssuedCalendarLink {
  readonly url: string;
}

/**
 * A new calendar subscription link for the signed-in teacher; any earlier link stops working.
 * Only a hash of the secret is kept.
 */
export class MakeCalendarLink {
  constructor(private readonly deps: LinkDeps) {}

  async execute(input: {
    readonly actor: User;
  }): Promise<Result<IssuedCalendarLink, UseCaseError>> {
    const { actor } = input;
    const token = this.deps.tokens.generate();
    await this.deps.calendarFeeds.save({
      teacherId: actor.id,
      schoolId: actor.schoolId,
      tokenHash: await this.deps.tokenHasher.hash(token),
      createdAt: this.deps.clock.now(),
    });
    return ok({ url: `${this.deps.appUrl}/api/calendar/${token}.ics` });
  }
}

/** Stops the teacher's calendar link working at once. */
export class TurnOffCalendarLink {
  constructor(private readonly deps: { readonly calendarFeeds: CalendarFeedRepository }) {}

  async execute(input: { readonly actor: User }): Promise<Result<true, UseCaseError>> {
    await this.deps.calendarFeeds.delete(input.actor.schoolId, input.actor.id);
    return ok(true);
  }
}

/** Whether the teacher has a working calendar link (its address cannot be shown again). */
export class GetCalendarLinkStatus {
  constructor(private readonly deps: { readonly calendarFeeds: CalendarFeedRepository }) {}

  async execute(input: {
    readonly actor: User;
  }): Promise<Result<{ readonly active: boolean }, UseCaseError>> {
    const feed = await this.deps.calendarFeeds.find(input.actor.schoolId, input.actor.id);
    return ok({ active: feed !== null });
  }
}

export interface CalendarFeedContent {
  /** The teacher's saved language, which the labels were asked for. */
  readonly language: Language;
  readonly events: readonly CalendarEvent[];
  /** The calendar as iCalendar text. */
  readonly text: string;
}

interface ReadDeps {
  readonly calendarFeeds: CalendarFeedRepository;
  readonly tokenHasher: TokenHasher;
  readonly users: UserRepository;
  readonly classes: ClassRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly assignments: AssignmentRepository;
  readonly clock: Clock;
}

/**
 * The calendar behind a link: the teacher's lesson plans and the due dates of the classes they
 * teach, within their school only. Titles and class names only, never student information.
 * An unknown or turned-off link, or a suspended account, has no calendar.
 */
export class ReadCalendarFeed {
  constructor(private readonly deps: ReadDeps) {}

  async execute(input: {
    readonly token: string;
    readonly labelsFor: (language: Language) => CalendarFeedLabels;
  }): Promise<Result<CalendarFeedContent, UseCaseError>> {
    const feed = await this.deps.calendarFeeds.findByTokenHash(
      await this.deps.tokenHasher.hash(input.token),
    );
    if (feed === null) return fail('not_found');
    const { schoolId, teacherId } = feed;
    const teacher = await this.deps.users.findById(schoolId, teacherId);
    // No teacher (or a suspended one): no calendar.
    if (teacher?.suspendedAt !== null) return fail('not_found');
    const labels = input.labelsFor(teacher.language);

    const classes = await this.deps.classes.listByTeacher(schoolId, teacherId);
    const classNames = new Map(classes.map((cls) => [cls.id, cls.name]));
    const plans = await this.deps.lessonPlans.listByTeacher(schoolId, teacherId);
    const planned = plans.flatMap((plan) =>
      planEvents(
        plan,
        plan.classId === null ? null : (classNames.get(plan.classId) ?? null),
        labels,
      ),
    );
    const due = (
      await Promise.all(
        classes.map(async (cls) =>
          (await this.deps.assignments.listByClass(schoolId, cls.id)).map((assignment) =>
            assignmentEvent(assignment, cls.name, labels),
          ),
        ),
      )
    )
      .flat()
      .filter((event): event is CalendarEvent => event !== null);

    const now = this.deps.clock.now();
    const today = localDateIn(now, 'UTC');
    const events = eventsBetween(
      [...planned, ...due],
      addDays(today, -calendarDaysBack),
      addDays(today, calendarDaysAhead),
    ).sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));
    return ok({
      language: teacher.language,
      events,
      text: toICalendar(labels.calendarName, events, now),
    });
  }
}
