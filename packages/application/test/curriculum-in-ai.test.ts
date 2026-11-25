import { describe, expect, it } from 'vitest';
import {
  ok,
  pastedCurriculumGuide,
  type CurriculumGuideId,
  type SchoolId,
  type User,
} from '@thp/domain';
import { aWeeklyDraft, FakeContentWriter, FakeLessonPlanDrafter } from '@thp/testing';
import {
  GenerationHandler,
  JobHandlerRegistry,
  LessonPlanDraftHandler,
  RequestGeneration,
  RequestLessonPlanDraft,
  RunNextJob,
  StartPrepBatch,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { aiFakes, runSteps, teacherWithClass } from './prep-setup.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const mathFour = 'Unit 3 (weeks 9-14): Fractions. Compare, add and subtract like fractions.';

/** Saves a ready, pasted guide for a school, subject and grade. */
async function saveGuide(
  world: World,
  schoolId: SchoolId,
  subject: string,
  grade: string,
  text: string,
  title = `${subject} ${grade} guide`,
) {
  const guide = pastedCurriculumGuide({
    id: `guide-${schoolId}-${subject}-${grade}` as CurriculumGuideId,
    schoolId,
    subject,
    grade,
    title,
    text,
    updatedBy: 'u-admin' as User['id'],
    now: new Date('2026-11-24T12:00:00Z'),
  });
  await world.curriculumGuides.save(valueOf(guide));
}

async function runAll(
  world: World,
  handler: ConstructorParameters<typeof JobHandlerRegistry>[0][number],
) {
  const run = new RunNextJob({ jobs: world.jobs, handlers: new JobHandlerRegistry([handler]) });
  while ((await run.execute()) !== 'idle') {
    // until the queue is empty
  }
}

const worksheet = {
  type: 'worksheet',
  subject: 'math',
  grade: '4',
  topic: 'Fractions',
  language: 'en',
};

describe("The assistant and the school's curriculum guide", () => {
  async function generate(world: World, actor: User, followCurriculum: boolean) {
    const writer = new FakeContentWriter(ok('# Worksheet\n\n1. ___'));
    valueOf(await new RequestGeneration(world).execute({ actor, ...worksheet, followCurriculum }));
    await runAll(world, new GenerationHandler({ ...world, writer }));
    return writer.requests[0];
  }

  it("writes with the school's guide for the subject and grade when the teacher asks", async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    await saveGuide(world, actor.schoolId, 'math', '4', mathFour, 'Math 4 pacing');

    const sent = await generate(world, actor, true);

    expect(sent?.curriculum).toEqual({ title: 'Math 4 pacing', text: mathFour });
  });

  it('writes without a guide when the teacher turns it off, or the grade has none', async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    await saveGuide(world, actor.schoolId, 'math', '5', mathFour);

    expect((await generate(world, actor, true))?.curriculum).toBeNull();
    await saveGuide(world, actor.schoolId, 'math', '4', mathFour);
    expect((await generate(world, actor, false))?.curriculum).toBeNull();
  });

  it("never uses another school's guide", async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    await saveGuide(world, 'school-9' as SchoolId, 'math', '4', mathFour);

    expect((await generate(world, actor, true))?.curriculum).toBeNull();
  });
});

describe("AI plan drafts and the school's curriculum guide", () => {
  const draft = {
    kind: 'weekly',
    subject: 'math',
    grade: '4',
    topic: 'Fractions',
    language: 'en',
    start: '2026-09-07',
  };

  async function drafted(world: World, actor: User, followCurriculum: boolean) {
    const drafter = new FakeLessonPlanDrafter(ok(aWeeklyDraft()));
    valueOf(await new RequestLessonPlanDraft(world).execute({ actor, ...draft, followCurriculum }));
    await runAll(world, new LessonPlanDraftHandler({ ...world, drafter }));
    return drafter.requests[0];
  }

  it("drafts with the school's guide only when the teacher asks, and never another school's", async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    await saveGuide(world, 'school-9' as SchoolId, 'math', '4', mathFour);

    expect((await drafted(world, actor, true))?.curriculum).toBeNull();
    await saveGuide(world, actor.schoolId, 'math', '4', mathFour, 'Math 4 pacing');
    expect((await drafted(world, actor, true))?.curriculum).toEqual({
      title: 'Math 4 pacing',
      text: mathFour,
    });
    expect((await drafted(world, actor, false))?.curriculum).toBeNull();
  });
});

describe("The prep agent and the school's curriculum guide", () => {
  const civilWar = 'Unit 3: The Civil War. Causes, key battles and Reconstruction, weeks 10-14.';

  it("plans the week and writes the worksheets with the school's guide when asked", async () => {
    const world = makeWorld();
    const setup = await teacherWithClass(world);
    await saveGuide(world, setup.actor.schoolId, 'social_studies', '7', civilWar, 'History 7');
    const fakes = aiFakes();
    valueOf(
      await new StartPrepBatch(world).execute({
        actor: setup.actor,
        request: { ...setup.input, followCurriculum: true },
      }),
    );

    await runSteps(world, fakes);

    const guide = { title: 'History 7', text: civilWar };
    expect(fakes.drafter.requests[0]?.curriculum).toEqual(guide);
    expect(fakes.contentWriter.requests.map((request) => request.curriculum)).toEqual([
      guide,
      guide,
    ]);
  });

  it('prepares the week without a guide when the teacher turns it off', async () => {
    const world = makeWorld();
    const setup = await teacherWithClass(world);
    await saveGuide(world, setup.actor.schoolId, 'social_studies', '7', civilWar);
    const fakes = aiFakes();
    valueOf(await new StartPrepBatch(world).execute({ actor: setup.actor, request: setup.input }));

    await runSteps(world, fakes);

    expect(fakes.drafter.requests[0]?.curriculum).toBeNull();
    expect(fakes.contentWriter.requests.every((request) => request.curriculum === null)).toBe(true);
  });
});
