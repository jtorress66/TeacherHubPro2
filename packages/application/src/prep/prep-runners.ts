import {
  createContentRequest,
  createDraftRequest,
  createPresentationRequest,
  dayTopic,
  err,
  ok,
  planSpan,
  prepQuizQuestions,
  type LessonPlan,
  type PrepBatch,
  type PrepContent,
  type PrepItem,
  type PrepItemKind,
  type Result,
} from '@thp/domain';
import type {
  ContentWriter,
  CurriculumGuideRepository,
  DraftError,
  LessonPlanDrafter,
  LessonPlanRepository,
  PresentationDrafter,
  QuizWriter,
} from '@thp/ports';
import { curriculumFor } from '../curriculum/curriculum-for.ts';

/** Drafts one kind of prep item. A new kind of item is a new runner, registered once. */
export interface PrepItemRunner<K extends PrepItemKind> {
  run(batch: PrepBatch, item: PrepItem): Promise<Result<PrepContent[K], DraftError>>;
}

export type PrepRunners = { readonly [K in PrepItemKind]: PrepItemRunner<K> };

/** Topics are short texts; a long prompt is cut to fit. */
const maxTopicLength = 200;
const topicOf = (batch: PrepBatch, day: number): string =>
  dayTopic(batch, day).slice(0, maxTopicLength);

const invalidRequest = () => err<DraftError>({ code: 'invalid_output' });

/** The school's guide for the batch's subject and grade, when the teacher asked to follow it. */
const batchCurriculum = (guides: CurriculumGuideRepository, batch: PrepBatch) =>
  curriculumFor(guides, { ...batch.request, schoolId: batch.schoolId });

/** The class's latest weekly plan that starts before this week, as one line for the planner. */
function lastWeekLine(plans: readonly LessonPlan[], batch: PrepBatch): string | null {
  const before = plans
    .filter((plan) => plan.classId === batch.classId && plan.body.kind === 'weekly')
    .filter((plan) => planSpan(plan.body).start < batch.request.weekStart)
    .sort((a, b) => planSpan(b.body).start.localeCompare(planSpan(a.body).start));
  const latest = before[0];
  if (latest?.body.kind !== 'weekly') return null;
  const week = latest.body.weeks.at(-1);
  const parts = [latest.body.unit ?? latest.title, week?.objective].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  return parts.length === 0 ? null : `Last week: ${parts.join(' — ')}`;
}

/**
 * The runners for every kind of prep item. They send the AI no student or class data. The plan and
 * worksheets follow the school's guide when asked; the slides and quiz follow the plan's topics.
 */
export function makePrepRunners(deps: {
  readonly drafter: LessonPlanDrafter;
  readonly presentationDrafter: PresentationDrafter;
  readonly contentWriter: ContentWriter;
  readonly quizWriter: QuizWriter;
  readonly lessonPlans: LessonPlanRepository;
  readonly curriculumGuides: CurriculumGuideRepository;
}): PrepRunners {
  return {
    plan: {
      async run(batch) {
        const { request } = batch;
        const plans = await deps.lessonPlans.listByTeacher(batch.schoolId, batch.teacherId);
        const instructions = [
          `Plan ${String(request.days)} school days, starting on Monday.`,
          lastWeekLine(plans, batch),
        ]
          .filter((line) => line !== null)
          .join('\n');
        const draft = createDraftRequest({
          kind: 'weekly',
          subject: request.subject,
          grade: request.grade,
          topic: request.prompt.slice(0, maxTopicLength),
          language: request.language,
          instructions,
          start: request.weekStart,
          classId: null,
        });
        if (!draft.ok) return invalidRequest();
        const curriculum = await batchCurriculum(deps.curriculumGuides, batch);
        const plan = await deps.drafter.draft({ ...draft.value, curriculum });
        if (!plan.ok) return plan;
        return plan.value.kind === 'weekly' ? ok(plan.value) : invalidRequest();
      },
    },
    presentation: {
      async run(batch, item) {
        const request = createPresentationRequest({
          topic: topicOf(batch, item.day ?? 1),
          subject: batch.request.subject,
          grade: batch.request.grade,
          language: batch.request.language,
        });
        return request.ok ? deps.presentationDrafter.draft(request.value) : invalidRequest();
      },
    },
    worksheet: {
      async run(batch, item) {
        const request = createContentRequest({
          type: 'worksheet',
          subject: batch.request.subject,
          grade: batch.request.grade,
          topic: topicOf(batch, item.day ?? 1),
          language: batch.request.language,
        });
        if (!request.ok) return invalidRequest();
        const curriculum = await batchCurriculum(deps.curriculumGuides, batch);
        return deps.contentWriter.write({ ...request.value, curriculum });
      },
    },
    quiz: {
      run(batch) {
        const topics = Array.from({ length: batch.request.days }, (_, index) =>
          topicOf(batch, index + 1),
        );
        return deps.quizWriter.write({
          subject: batch.request.subject,
          grade: batch.request.grade,
          topics: [...new Set(topics)],
          questionCount: prepQuizQuestions,
          language: batch.request.language,
        });
      },
    },
  };
}
