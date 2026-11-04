import { describe, expect, it } from 'vitest';
import type { StudentId } from '@thp/domain';
import {
  EmailPortalLink,
  IssuePortalLink,
  ListPortalLinks,
  OpenFamilyPortal,
  RevokePortalLink,
  SendTrialReminders,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const notFound = { ok: false, error: { code: 'not_found' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };
const dayMs = 24 * 60 * 60 * 1000;

const tokenOf = (url: string): string => url.split('/p/')[1] ?? '';

async function setUp(world: World) {
  const setup = await gradedClass(world);
  const quiz = await setup.assign('Fractions quiz', 'Pruebas cortas', 20, '2026-09-01');
  const project = await setup.assign('Volcano project', 'Proyectos', 50, '2026-09-03');
  await setup.grade(quiz.id, [
    { studentId: setup.ana.id, status: 'graded', score: 18 },
    { studentId: setup.ben.id, status: 'graded', score: 10 },
  ]);
  await setup.grade(project.id, [{ studentId: setup.ana.id, status: 'pending' }]);
  const issue = (studentId: StudentId = setup.ana.id) =>
    new IssuePortalLink(world).execute({ actor: setup.actor, classId: setup.cls.id, studentId });
  const open = (token: string) => new OpenFamilyPortal(world).execute({ token, timeZone: 'UTC' });
  return { ...setup, quiz, project, issue, open };
}

describe('portal links', () => {
  it('a new link opens the family portal: confirmed grades only, by roster ID', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const { url } = valueOf(await s.issue());
    expect(url).toMatch(/^https:\/\/app\.teacherhub\.test\/es\/p\/\S+$/u);
    const portal = valueOf(await s.open(tokenOf(url)));
    expect(portal).toMatchObject({ firstName: 'Ana', lastName: 'Zayas', className: 'Ciencias 5' });
    expect(portal.report.assignments).toEqual([
      expect.objectContaining({ title: 'Fractions quiz', status: 'graded', score: 18 }),
      expect.objectContaining({ title: 'Volcano project', status: 'not_graded', score: null }),
    ]);
    expect(portal.report.overall).toBe(90);
  });

  it('stores only a hash, and a new link stops the old one', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const first = tokenOf(valueOf(await s.issue()).url);
    const [stored] = await world.portalLinks.listByClass(s.actor.schoolId, s.cls.id);
    expect(JSON.stringify(stored)).not.toContain(first);
    const second = tokenOf(valueOf(await s.issue()).url);
    expect(await s.open(first)).toEqual(notFound);
    expect((await s.open(second)).ok).toBe(true);
  });

  it('emails the link to the parent in their language, from the configured site', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    valueOf(
      await new EmailPortalLink(world).execute({
        actor: s.actor,
        classId: s.cls.id,
        studentId: s.ana.id,
        to: 'parent@example.com',
        language: 'en',
      }),
    );
    const [mail] = world.mailer.outbox;
    expect(mail).toMatchObject({ to: 'parent@example.com', subject: '[en] Ana at Mi escuela' });
    expect(mail?.text).toMatch(/https:\/\/app\.teacherhub\.test\/en\/p\/\S+/u);
    const listed = valueOf(
      await new ListPortalLinks(world).execute({ actor: s.actor, classId: s.cls.id }),
    );
    expect(listed.find((row) => row.student.id === s.ana.id)).toMatchObject({
      usable: true,
      link: { sentTo: 'parent@example.com' },
    });
    expect(
      await new EmailPortalLink(world).execute({
        actor: s.actor,
        classId: s.cls.id,
        studentId: s.ana.id,
        to: 'not an email',
      }),
    ).toMatchObject({ ok: false, error: { field: 'to' } });
  });

  it('a revoked link reaches nothing; another student’s link shows only that student', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const ana = valueOf(await s.issue());
    const ben = valueOf(await s.issue(s.ben.id));
    expect(valueOf(await s.open(tokenOf(ben.url))).report.assignments[0]).toMatchObject({
      score: 10,
    });
    valueOf(
      await new RevokePortalLink(world).execute({
        actor: s.actor,
        classId: s.cls.id,
        linkId: ana.link.id,
      }),
    );
    expect(await s.open(tokenOf(ana.url))).toEqual(notFound);
    expect(await s.open('nonsense')).toEqual(notFound);
  });

  it('only the class’s teacher issues, emails, lists or revokes links', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const colleague = colleagueOf(s.actor);
    expect(
      await new IssuePortalLink(world).execute({
        actor: colleague,
        classId: s.cls.id,
        studentId: s.ana.id,
      }),
    ).toEqual(forbidden);
    expect(
      await new ListPortalLinks(world).execute({ actor: colleague, classId: s.cls.id }),
    ).toEqual(forbidden);
    const other = await signedUp(world, 'other@school.edu');
    expect(
      await new IssuePortalLink(world).execute({
        actor: other.user,
        classId: s.cls.id,
        studentId: s.ana.id,
      }),
    ).toEqual(notFound);
    expect(
      await new IssuePortalLink(world).execute({
        actor: s.actor,
        classId: s.cls.id,
        studentId: 'student-9' as StudentId,
      }),
    ).toEqual(notFound);
  });
});

describe('SendTrialReminders', () => {
  it('emails the owner 3 days before the trial ends and on its last day, once each', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const [subscription] = await world.subscriptions.listBySchool(user.schoolId);
    if (subscription === undefined) throw new Error('no trial');
    const at = (days: number) => {
      const target = subscription.trialEndsAt.getTime() - days * dayMs;
      world.clock.advanceBy(target - world.clock.now().getTime());
    };

    at(4);
    expect(await new SendTrialReminders(world).execute()).toBe(0);
    at(3);
    expect(await new SendTrialReminders(world).execute()).toBe(1);
    expect(await new SendTrialReminders(world).execute()).toBe(0);
    at(0.5);
    expect(await new SendTrialReminders(world).execute()).toBe(1);
    expect(await new SendTrialReminders(world).execute()).toBe(0);

    expect(world.mailer.outbox.map((m) => [m.to, m.subject])).toEqual([
      [user.email, `[${user.language}] 3 days left`],
      [user.email, `[${user.language}] 1 days left`],
    ]);
    expect(world.mailer.outbox[0]?.text).toContain(
      `https://app.teacherhub.test/${user.language}/app/billing`,
    );
  });

  it('does not record a reminder the mailer refused, so it is tried again', async () => {
    const world = { ...makeWorld() };
    const { user } = await signedUp(world);
    const [subscription] = await world.subscriptions.listBySchool(user.schoolId);
    if (subscription === undefined) throw new Error('no trial');
    world.clock.advanceBy(
      subscription.trialEndsAt.getTime() - 2 * dayMs - world.clock.now().getTime(),
    );
    const refusing = {
      ...world,
      mailer: {
        send: () =>
          Promise.resolve({ ok: false as const, error: { code: 'unavailable' as const } }),
      },
    };
    expect(await new SendTrialReminders(refusing).execute()).toBe(0);
    expect(await new SendTrialReminders(world).execute()).toBe(1);
  });
});
