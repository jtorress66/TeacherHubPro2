import { describe, expect, it } from 'vitest';
import {
  ltiClaim,
  type AssignmentId,
  type ClassId,
  type GameId,
  type LtiPlacedItem,
  type Question,
  type QuestionId,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import { aClass, aGame, anAssignment, anAttachment, aUser } from '@thp/testing';
import {
  LinkLtiAccount,
  ListPlaceableContent,
  PlaceLtiContent,
  RemoveLtiPlatform,
  ltiPlaceTicketLifetimeMs,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import {
  deepLinking,
  deepLinkingReturnUrl as returnUrl,
  launch,
  ltiWorld,
  registered,
  type LtiWorld,
} from './lti-world.ts';

const question: Question = {
  id: 'q1' as QuestionId,
  type: 'true_false',
  prompt: 'The Sun is a star.',
  answer: true,
  points: 2,
  instructions: null,
};

const assignment = (id: string): LtiPlacedItem => ({ kind: 'assignment', id: id as AssignmentId });
const game = (id: string): LtiPlacedItem => ({ kind: 'game', id: id as GameId });

/**
 * A linked teacher with a class (Science 5) holding a quiz with questions, a worksheet with a file
 * and a draft with neither, and a game; a colleague's class and game; and another school's game.
 */
async function teacherWithContent(world: LtiWorld) {
  const { admin, teacher, platform } = await registered(world);
  await world.ltiUserLinks.link(platform.id, 'canvas-user-1', teacher.id, world.clock.now());
  const schoolId = teacher.schoolId;
  const science = aClass({
    id: 'science' as ClassId,
    schoolId,
    teacherId: teacher.id,
    name: 'Science 5',
  });
  const theirs = aClass({ id: 'theirs' as ClassId, schoolId, teacherId: admin.id, name: 'Art 2' });
  await world.classes.save(science);
  await world.classes.save(theirs);
  const save = (id: string, title: string, classId: ClassId, withQuestions: boolean) =>
    world.assignments.save(
      anAssignment({
        id: id as AssignmentId,
        schoolId,
        classId,
        title,
        questions: withQuestions ? [question] : [],
      }),
    );
  await save('quiz', 'Space quiz', science.id, true);
  await save('worksheet', 'Planets worksheet', science.id, false);
  await save('draft', 'Draft', science.id, false);
  await save('art-quiz', 'Colour quiz', theirs.id, true);
  await world.attachments.save(
    anAttachment({ schoolId, assignmentId: 'worksheet' as AssignmentId }),
  );
  await world.games.save(aGame({ id: 'planets' as GameId, schoolId, teacherId: teacher.id }));
  await world.games.save(
    aGame({ id: 'colours' as GameId, schoolId, teacherId: admin.id, title: 'Colours' }),
  );
  await world.games.save(
    aGame({
      id: 'elsewhere' as GameId,
      schoolId: 'other-school' as SchoolId,
      teacherId: 'other-teacher' as UserId,
    }),
  );
  return { admin, teacher, platform };
}

/** The ticket of a linked teacher's "Add content" launch. */
async function placeTicket(world: LtiWorld, settings: Record<string, unknown> = {}) {
  const outcome = valueOf(await launch(world, deepLinking(settings)));
  if (outcome.kind !== 'pickContent') throw new Error(outcome.kind);
  return outcome.ticket;
}

/** The claims of a token the fake tool key store signed. */
const claimsOf = (jwt: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString()) as Record<
    string,
    unknown
  >;

const expired = { ok: false, error: { code: 'link_expired' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };

describe('ListPlaceableContent', () => {
  it('lists the teacher’s assignments students can open, and their games', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);
    const ticket = await placeTicket(world);

    expect(
      valueOf(await new ListPlaceableContent(world).execute({ actor: teacher, ticket })),
    ).toEqual({
      platformName: 'Lincoln Canvas',
      acceptMultiple: true,
      items: [
        { item: assignment('quiz'), title: 'Space quiz', className: 'Science 5' },
        { item: assignment('worksheet'), title: 'Planets worksheet', className: 'Science 5' },
        { item: game('planets'), title: 'Planets', className: null },
      ],
    });
  });

  it('says when the course system takes one item only', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);
    const ticket = await placeTicket(world, { accept_multiple: false });

    const content = valueOf(
      await new ListPlaceableContent(world).execute({ actor: teacher, ticket }),
    );
    expect(content.acceptMultiple).toBe(false);
  });

  it('refuses anyone but the teacher who launched, and an expired or forged ticket', async () => {
    const world = ltiWorld();
    const { admin, teacher } = await teacherWithContent(world);
    const ticket = await placeTicket(world);
    const elsewhere = aUser({ id: teacher.id, schoolId: 'other-school' as SchoolId });
    const list = (actor: User, value: string) =>
      new ListPlaceableContent(world).execute({ actor, ticket: value });

    expect(await list(admin, ticket)).toEqual(forbidden);
    expect(await list(elsewhere, ticket)).toEqual(forbidden);
    expect(await list(teacher, `${ticket}x`)).toEqual(expired);
    expect(await list(teacher, '')).toEqual(expired);
    world.clock.advanceBy(ltiPlaceTicketLifetimeMs);
    expect(await list(teacher, ticket)).toEqual(expired);
    expect(ltiPlaceTicketLifetimeMs).toBe(30 * 60 * 1000);
  });

  it('refuses a ticket for a course system that was removed since', async () => {
    const world = ltiWorld();
    const { admin, teacher, platform } = await teacherWithContent(world);
    const ticket = await placeTicket(world);
    valueOf(await new RemoveLtiPlatform(world).execute({ actor: admin, platformId: platform.id }));

    expect(await new ListPlaceableContent(world).execute({ actor: teacher, ticket })).toEqual({
      ok: false,
      error: { code: 'unknown_platform' },
    });
  });
});

describe('PlaceLtiContent', () => {
  it('answers the course system with the chosen items, signed by the tool', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);
    const ticket = await placeTicket(world);

    const placed = valueOf(
      await new PlaceLtiContent(world).execute({
        actor: teacher,
        ticket,
        items: [assignment('quiz'), game('planets')],
      }),
    );

    expect(placed.returnUrl).toBe(returnUrl);
    const seconds = world.clock.now().getTime() / 1000;
    const claims = claimsOf(placed.jwt);
    expect(claims).toMatchObject({
      iss: 'client-1',
      aud: 'https://lms.lincoln.edu',
      iat: seconds,
      exp: seconds + 300,
      [ltiClaim.messageType]: 'LtiDeepLinkingResponse',
      [ltiClaim.version]: '1.3.0',
      [ltiClaim.deploymentId]: 'dep-2',
      [ltiClaim.deepLinkingData]: 'canvas-data-1',
      [ltiClaim.contentItems]: [
        {
          type: 'ltiResourceLink',
          title: 'Space quiz',
          url: 'https://app.teacherhub.test/api/lti/launch',
          custom: { thp_kind: 'assignment', thp_id: 'quiz' },
          window: { targetName: '_blank' },
        },
        {
          type: 'ltiResourceLink',
          title: 'Planets',
          url: 'https://app.teacherhub.test/api/lti/launch',
          custom: { thp_kind: 'game', thp_id: 'planets' },
          window: { targetName: '_blank' },
        },
      ],
    });
    expect(typeof claims.nonce).toBe('string');
    expect(placed.jwt.endsWith('.fake-signature')).toBe(true);
  });

  it('places an item once, however often it was ticked, and leaves out data never sent', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);
    const ticket = await placeTicket(world, { data: undefined, accept_multiple: false });

    const placed = valueOf(
      await new PlaceLtiContent(world).execute({
        actor: teacher,
        ticket,
        items: [game('planets'), game('planets')],
      }),
    );

    const claims = claimsOf(placed.jwt);
    expect(claims[ltiClaim.contentItems]).toHaveLength(1);
    expect(claims).not.toHaveProperty([ltiClaim.deepLinkingData]);
  });

  it('needs at least one item, and one only when the course system takes one', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);
    const single = await placeTicket(world, { accept_multiple: false });
    const place = (items: readonly LtiPlacedItem[]) =>
      new PlaceLtiContent(world).execute({ actor: teacher, ticket: single, items });

    expect(await place([])).toEqual({ ok: false, error: { code: 'nothing_chosen' } });
    expect(await place([assignment('quiz'), game('planets')])).toEqual({
      ok: false,
      error: { code: 'too_many_items' },
    });
    expect((await place([assignment('quiz')])).ok).toBe(true);
  });

  it('refuses more items than a course page can sensibly take', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);
    const ticket = await placeTicket(world);
    const items = Array.from({ length: 51 }, (_, index) => game(`game-${String(index)}`));

    expect(await new PlaceLtiContent(world).execute({ actor: teacher, ticket, items })).toEqual({
      ok: false,
      error: { code: 'too_many_items' },
    });
  });

  it('refuses drafts, a colleague’s or another school’s content, and anything unknown', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);
    const ticket = await placeTicket(world);
    const notPlaceable = { ok: false, error: { code: 'not_placeable' } };

    for (const item of [
      assignment('draft'),
      assignment('art-quiz'),
      assignment('missing'),
      game('colours'),
      game('elsewhere'),
      game('missing'),
    ]) {
      expect(
        await new PlaceLtiContent(world).execute({
          actor: teacher,
          ticket,
          items: [assignment('quiz'), item],
        }),
      ).toEqual(notPlaceable);
    }
  });

  it('refuses another person, and an expired or forged ticket', async () => {
    const world = ltiWorld();
    const { admin, teacher, platform } = await teacherWithContent(world);
    const ticket = await placeTicket(world);
    const place = (actor: User, value: string) =>
      new PlaceLtiContent(world).execute({ actor, ticket: value, items: [game('planets')] });
    const linkTicket = world.ticketSigner.sign(
      {
        purpose: 'lti-link',
        platformId: platform.id,
        subject: 'canvas-user-1',
        schoolId: teacher.schoolId,
      },
      new Date(world.clock.now().getTime() + 60_000),
    );

    expect(await place(admin, ticket)).toEqual(forbidden);
    expect(await place(teacher, `${ticket}x`)).toEqual(expired);
    expect(await place(teacher, linkTicket)).toEqual(expired);
    world.clock.advanceBy(ltiPlaceTicketLifetimeMs);
    expect(await place(teacher, ticket)).toEqual(expired);
  });
});

const learner = {
  [ltiClaim.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
};
const opening = (item: LtiPlacedItem) => ({
  [ltiClaim.custom]: { thp_kind: item.kind, thp_id: item.id },
});

describe('CompleteLtiLaunch with content placed in a course', () => {
  it('signs a linked teacher in to pick content, with a ticket for that choice', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);

    const outcome = valueOf(await launch(world, deepLinking()));

    expect(outcome).toMatchObject({ kind: 'pickContent', language: teacher.language });
    const token = outcome.kind === 'pickContent' ? outcome.sessionToken : '';
    const session = await world.sessions.findByTokenHash(await world.tokenHasher.hash(token));
    expect(session?.userId).toBe(teacher.id);
  });

  it('lets a teacher who links first go on to pick content', async () => {
    const world = ltiWorld();
    const { platform } = await teacherWithContent(world);
    const newcomer = aUser({
      id: 'newcomer' as UserId,
      schoolId: platform.schoolId,
      email: 'newcomer@x.edu',
    });
    await world.users.save(newcomer);
    const outcome = valueOf(await launch(world, { ...deepLinking(), sub: 'canvas-newcomer' }));
    if (outcome.kind !== 'needsLink') throw new Error(outcome.kind);
    const ticket = outcome.placeTicket ?? '';

    expect(await new ListPlaceableContent(world).execute({ actor: newcomer, ticket })).toEqual(
      forbidden,
    );
    valueOf(await new LinkLtiAccount(world).execute({ actor: newcomer, ticket: outcome.ticket }));
    expect(
      valueOf(await new ListPlaceableContent(world).execute({ actor: newcomer, ticket })).items,
    ).toEqual([]);
  });

  it('carries no choice for a teacher who only opens TeacherHubPro', async () => {
    const world = ltiWorld();
    await registered(world);

    expect(valueOf(await launch(world))).toMatchObject({ kind: 'needsLink', placeTicket: null });
  });

  it('opens a placed assignment or game for a teacher who may see it', async () => {
    const world = ltiWorld();
    const { teacher } = await teacherWithContent(world);

    expect(valueOf(await launch(world, opening(assignment('draft'))))).toMatchObject({
      kind: 'openItem',
      language: teacher.language,
      target: { kind: 'assignment', classId: 'science', assignmentId: 'draft' },
    });
    expect(valueOf(await launch(world, opening(game('planets'))))).toMatchObject({
      kind: 'openItem',
      target: { kind: 'game', gameId: 'planets' },
    });
  });

  it('opens their school’s content for an admin, as the app does', async () => {
    const world = ltiWorld();
    const { admin, platform } = await teacherWithContent(world);
    await world.ltiUserLinks.link(platform.id, 'canvas-admin', admin.id, world.clock.now());
    const asAdmin = { sub: 'canvas-admin' };

    expect(
      valueOf(await launch(world, { ...asAdmin, ...opening(assignment('quiz')) })),
    ).toMatchObject({ kind: 'openItem', target: { kind: 'assignment', assignmentId: 'quiz' } });
  });

  it('only signs a teacher in when the placed item is not theirs to see, or is gone', async () => {
    const world = ltiWorld();
    await teacherWithContent(world);

    for (const item of [
      assignment('art-quiz'),
      assignment('missing'),
      game('colours'),
      game('elsewhere'),
    ]) {
      expect(valueOf(await launch(world, opening(item))).kind).toBe('signedIn');
    }
  });

  it('still shows students the not-yet page for a placed item', async () => {
    const world = ltiWorld();
    await teacherWithContent(world);

    expect(valueOf(await launch(world, { ...learner, ...opening(assignment('quiz')) })).kind).toBe(
      'learnerNotYet',
    );
  });

  it('refuses a student who tries to add content', async () => {
    const world = ltiWorld();
    await teacherWithContent(world);

    expect(await launch(world, { ...deepLinking(), ...learner })).toEqual({
      ok: false,
      error: { code: 'learner_deep_linking' },
    });
  });
});
