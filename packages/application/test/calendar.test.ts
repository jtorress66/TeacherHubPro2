import { describe, expect, it } from 'vitest';
import type { Language, LessonPlanId, SchoolId } from '@thp/domain';
import { aLessonPlan, anAssignment, InMemoryCalendarFeedRepository } from '@thp/testing';
import {
  CreateAssignment,
  CreatePlan,
  GetCalendarLinkStatus,
  MakeCalendarLink,
  ReadCalendarFeed,
  TurnOffCalendarLink,
  type CalendarFeedLabels,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const labels = (language: Language): CalendarFeedLabels => ({
  calendarName: `TeacherHubPro (${language})`,
  untitledPlan: 'Lesson plan',
  due: (title, className) => `Due: ${title} (${className})`,
});

const withFeeds = (world: World) => ({
  ...world,
  calendarFeeds: new InMemoryCalendarFeedRepository(),
});

const tokenOf = (url: string): string => {
  const match = /\/api\/calendar\/([^/]+)\.ics$/u.exec(url);
  if (match?.[1] === undefined) throw new Error(`not a calendar link: ${url}`);
  return match[1];
};

/** Today is Tuesday 2026-09-01: the feed covers 2026-07-03 to 2027-09-01. */
async function planned(world: ReturnType<typeof withFeeds>) {
  const setup = await gradedClass(world);
  const { actor, cls } = setup;
  const week = (title: string, weekStart: string, theme: string) =>
    new CreatePlan(world).execute({
      actor,
      title,
      classId: cls.id,
      body: { kind: 'weekly', weeks: [{ weekStart, days: [{ theme }, {}, {}, {}, {}] }] },
    });
  valueOf(await week('Fractions', '2026-09-07', 'Halves'));
  valueOf(await week('Too old', '2026-06-01', 'Long ago'));
  valueOf(await week('Too far', '2027-10-04', 'Next year'));
  await setup.assign('Volcano quiz', 'Pruebas cortas', 10, '2026-09-10');
  await setup.assign('Undated homework', 'Tareas', 10);
  return setup;
}

describe('MakeCalendarLink', () => {
  it('makes a secret link, shown once, and stores only a hash of it', async () => {
    const world = withFeeds(makeWorld());
    const { user: actor } = await signedUp(world);

    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    expect(made.url).toMatch(/^https:\/\/app\.teacherhub\.test\/api\/calendar\/[^/]+\.ics$/u);
    const stored = await world.calendarFeeds.find(actor.schoolId, actor.id);
    expect(stored).toEqual({
      teacherId: actor.id,
      schoolId: actor.schoolId,
      tokenHash: await world.tokenHasher.hash(tokenOf(made.url)),
      createdAt: world.clock.now(),
    });
    expect(JSON.stringify(stored)).not.toContain(tokenOf(made.url));
  });

  it('replaces the old link: the old address stops working', async () => {
    const world = withFeeds(makeWorld());
    const { user: actor } = await signedUp(world);
    const first = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    const second = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    expect(second.url).not.toBe(first.url);
    const read = new ReadCalendarFeed(world);
    expect(await read.execute({ token: tokenOf(first.url), labelsFor: labels })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect((await read.execute({ token: tokenOf(second.url), labelsFor: labels })).ok).toBe(true);
  });
});

describe('GetCalendarLinkStatus and TurnOffCalendarLink', () => {
  it('says whether the teacher has a link, and turning it off stops it working', async () => {
    const world = withFeeds(makeWorld());
    const { user: actor } = await signedUp(world);
    const status = new GetCalendarLinkStatus(world);
    expect(valueOf(await status.execute({ actor }))).toEqual({ active: false });
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));
    expect(valueOf(await status.execute({ actor }))).toEqual({ active: true });

    valueOf(await new TurnOffCalendarLink(world).execute({ actor }));

    expect(valueOf(await status.execute({ actor }))).toEqual({ active: false });
    expect(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('turns off only the teacher’s own link', async () => {
    const world = withFeeds(makeWorld());
    const { user: actor } = await signedUp(world);
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    valueOf(await new TurnOffCalendarLink(world).execute({ actor: colleagueOf(actor) }));

    expect(
      (await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }))
        .ok,
    ).toBe(true);
  });
});

describe('ReadCalendarFeed', () => {
  it('lists the teacher’s plan days and due dates from 60 days ago to a year ahead', async () => {
    const world = withFeeds(makeWorld());
    const { actor } = await planned(world);
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    const feed = valueOf(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    );

    expect(feed.events.map((event) => [event.date, event.summary])).toEqual([
      ['2026-09-07', 'Fractions: Halves'],
      ['2026-09-10', 'Due: Volcano quiz (Ciencias 5)'],
    ]);
    expect(feed.events[0]?.description).toBe('Ciencias 5');
  });

  it('writes the calendar in the teacher’s saved language', async () => {
    const world = withFeeds(makeWorld());
    const { actor } = await planned(world);
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    const feed = valueOf(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    );

    expect(feed.language).toBe('es');
    expect(feed.text).toContain('BEGIN:VCALENDAR');
    expect(feed.text).toContain('X-WR-CALNAME:TeacherHubPro (es)');
    expect(feed.text).toContain('SUMMARY:Fractions: Halves');
    expect(feed.text).toContain('DTSTAMP:20260901T080000Z');
  });

  it('never includes student information', async () => {
    const world = withFeeds(makeWorld());
    const { actor, ana, ben, cara } = await planned(world);
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    const feed = valueOf(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    );

    for (const student of [ana, ben, cara]) {
      expect(feed.text).not.toContain(student.firstName);
      expect(feed.text).not.toContain(student.lastName);
      expect(feed.text).not.toContain(student.id);
    }
  });

  it('leaves out colleagues’ plans and classes', async () => {
    const world = withFeeds(makeWorld());
    const { actor } = await planned(world);
    const colleague = colleagueOf(actor);
    await world.users.save(colleague);
    await world.lessonPlans.save(
      aLessonPlan({
        id: 'colleague-plan' as LessonPlanId,
        schoolId: actor.schoolId,
        teacherId: colleague.id,
        title: 'Colleague week',
        body: {
          kind: 'weekly',
          weeks: [{ weekStart: '2026-09-07', days: [{ theme: 'Theirs' }, {}, {}, {}, {}] }],
        },
      }),
    );
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    const feed = valueOf(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    );

    expect(feed.text).not.toContain('Colleague week');
  });

  it('never shows another school’s plans or assignments, even with the same ids', async () => {
    const world = withFeeds(makeWorld());
    const { actor, cls, category } = await planned(world);
    const otherSchool = 'other-school' as SchoolId;
    await world.lessonPlans.save(
      aLessonPlan({
        id: 'other-plan' as LessonPlanId,
        schoolId: otherSchool,
        teacherId: actor.id,
        title: 'Other school week',
        body: {
          kind: 'weekly',
          weeks: [{ weekStart: '2026-09-07', days: [{ theme: 'Elsewhere' }, {}, {}, {}, {}] }],
        },
      }),
    );
    await world.assignments.save(
      anAssignment({
        schoolId: otherSchool,
        classId: cls.id,
        categoryId: category('Tareas'),
        title: 'Other school homework',
        dueDate: '2026-09-11',
      }),
    );
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    const feed = valueOf(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    );

    expect(feed.text).not.toContain('Other school');
    expect(feed.text).not.toContain('Elsewhere');
  });

  it('has no calendar for an unknown token', async () => {
    const world = withFeeds(makeWorld());

    expect(
      await new ReadCalendarFeed(world).execute({ token: 'not-a-token', labelsFor: labels }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('stops working once the teacher’s account is suspended', async () => {
    const world = withFeeds(makeWorld());
    const { user: actor } = await signedUp(world);
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));
    await world.users.save({ ...actor, suspendedAt: world.clock.now() });

    expect(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('includes due dates of every class the teacher teaches', async () => {
    const world = withFeeds(makeWorld());
    const { actor, cls, category } = await planned(world);
    valueOf(
      await new CreateAssignment(world).execute({
        actor,
        classId: cls.id,
        details: { title: 'Lab report', categoryId: category('Proyectos'), dueDate: '2027-08-31' },
      }),
    );
    const made = valueOf(await new MakeCalendarLink(world).execute({ actor }));

    const feed = valueOf(
      await new ReadCalendarFeed(world).execute({ token: tokenOf(made.url), labelsFor: labels }),
    );

    expect(feed.events.map((event) => event.summary)).toContain('Due: Lab report (Ciencias 5)');
  });
});
