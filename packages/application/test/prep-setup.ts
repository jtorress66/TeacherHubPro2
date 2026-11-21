import { ok, type Email, type PrepRequestInput } from '@thp/domain';
import {
  aPresentationDraft,
  aWeeklyDraft,
  FakeContentWriter,
  FakeLessonPlanDrafter,
  FakePresentationDrafter,
  FakeQuizWriter,
} from '@thp/testing';
import {
  JobHandlerRegistry,
  makePrepRunners,
  PrepStepHandler,
  RunNextJob,
  StartPrepBatch,
} from '../src/index.ts';
import { gradedClass, valueOf } from './classroom.ts';
import type { World } from './world.ts';

/** Shared set-up for the prep agent's tests: a class with two families and a ready batch. */
export interface AiFakes {
  readonly drafter: FakeLessonPlanDrafter;
  readonly presentationDrafter: FakePresentationDrafter;
  readonly contentWriter: FakeContentWriter;
  readonly quizWriter: FakeQuizWriter;
}

export function aiFakes(overrides: Partial<AiFakes> = {}): AiFakes {
  return {
    drafter: new FakeLessonPlanDrafter(
      ok(aWeeklyDraft({ days: [{ theme: 'Causes' }, { theme: 'Battles' }, {}, {}, {}] })),
    ),
    presentationDrafter: new FakePresentationDrafter(ok(aPresentationDraft())),
    contentWriter: new FakeContentWriter(ok('# Worksheet\n\n1. Name a cause.')),
    quizWriter: new FakeQuizWriter(),
    ...overrides,
  };
}

export async function teacherWithClass(world: World) {
  const setup = await gradedClass(world);
  await world.students.save({ ...setup.ana, parentEmail: 'ana.mom@x.edu' as Email });
  await world.students.save({ ...setup.ben, parentEmail: 'ben.dad@x.edu' as Email });
  const input: PrepRequestInput = {
    classId: setup.cls.id,
    prompt: 'Prep next week for Unit 3 History (Civil War)',
    weekStart: '2026-09-07',
    subject: 'social_studies',
    grade: '7',
    days: 2,
    options: { presentations: true, worksheets: true, quiz: true, parentEmail: true },
    quizCategoryId: setup.category('Pruebas cortas'),
    language: 'es',
    emailTemplate: {
      subject: 'Esta semana en Ciencias 5',
      greeting: 'Queridas familias:',
      intro: 'Esto aprenderemos esta semana:',
      quizLine: 'El viernes habrá una prueba corta.',
      signOff: 'Saludos,\nAna López',
      dayLabels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    },
  };
  return { ...setup, input };
}

/** Runs queued prep steps until none is left; returns how many ran. */
export async function runSteps(world: World, fakes = aiFakes()) {
  const run = new RunNextJob({
    jobs: world.jobs,
    handlers: new JobHandlerRegistry([
      new PrepStepHandler({ ...world, runners: makePrepRunners({ ...world, ...fakes }) }),
    ]),
  });
  let count = 0;
  while ((await run.execute()) !== 'idle') count += 1;
  return count;
}

export async function readyBatch(world: World, fakes = aiFakes()) {
  const setup = await teacherWithClass(world);
  const batch = valueOf(
    await new StartPrepBatch(world).execute({ actor: setup.actor, request: setup.input }),
  );
  await runSteps(world, fakes);
  const ref = { actor: setup.actor, batchId: batch.id };
  return { ...setup, batch, ref, fakes };
}
