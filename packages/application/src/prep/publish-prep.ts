import {
  createAssignment,
  createContentRequest,
  createGeneration,
  createLessonPlan,
  createPresentation,
  dayTopic,
  draftedPlan,
  invalid,
  markPublished,
  ok,
  parseEmail,
  publishable,
  quizDay,
  type AssignmentId,
  type Class,
  type GenerationId,
  type LessonPlanId,
  type PrepBatch,
  type PrepBatchId,
  type PrepItem,
  type PrepPublished,
  type PresentationId,
  type Result,
  type User,
} from '@thp/domain';
import type {
  AiGenerationRepository,
  AssignmentRepository,
  ClassRepository,
  Clock,
  GradeCategoryRepository,
  IdGenerator,
  LessonPlanRepository,
  Mailer,
  MailTemplates,
  PrepBatchRepository,
  PresentationRepository,
  SchoolRepository,
  StudentRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';
import { parentEmails } from './prep-batches.ts';

type Item<K extends PrepItem['kind']> = Extract<PrepItem, { kind: K }>;

const ofKind = <K extends PrepItem['kind']>(items: readonly PrepItem[], kind: K): Item<K>[] =>
  items.filter((item): item is Item<K> => item.kind === kind);

const maxTitleLength = 200;

interface PublishDeps {
  readonly prepBatches: PrepBatchRepository;
  readonly classes: ClassRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly presentations: PresentationRepository;
  readonly generations: AiGenerationRepository;
  readonly assignments: AssignmentRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly students: StudentRepository;
  readonly schools: SchoolRepository;
  readonly mailer: Mailer;
  readonly mailTemplates: MailTemplates;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * The teacher's approval: saves the items they kept (the weekly plan, slide decks, worksheets in
 * the AI assistant's history, and the quiz as an assignment due Friday) and emails each family
 * on the roster once. A batch is published only once.
 */
export class PublishPrepBatch {
  constructor(private readonly deps: PublishDeps) {}

  async execute(input: {
    actor: User;
    batchId: PrepBatchId;
  }): Promise<Result<PrepBatch, UseCaseError>> {
    const { actor } = input;
    const batch = await this.deps.prepBatches.find(actor.schoolId, actor.id, input.batchId);
    if (batch === null) return fail('not_found');
    if (batch.status !== 'ready') return invalid('status', 'not_allowed');
    const cls = await findEditableClass(this.deps.classes, actor, batch.classId);
    if (!cls.ok) return cls;
    const items = publishable(batch);
    const quiz = await this.saveQuiz(batch, cls.value, ofKind(items, 'quiz')[0]);
    if (!quiz.ok) return quiz;
    const emails = await this.sendEmails(batch);
    const published: PrepPublished = {
      planId: await this.savePlan(batch, ofKind(items, 'plan')[0]),
      presentationIds: await this.saveDecks(batch, ofKind(items, 'presentation')),
      generationIds: await this.saveWorksheets(batch, ofKind(items, 'worksheet')),
      assignmentId: quiz.value,
      ...emails,
    };
    const done = markPublished(batch, published, this.deps.clock.now());
    if (!done.ok) return done;
    await this.deps.prepBatches.save(done.value);
    return done;
  }

  private async savePlan(batch: PrepBatch, item?: Item<'plan'>): Promise<LessonPlanId | null> {
    if (item?.content == null) return null;
    const plan = createLessonPlan({
      id: this.deps.ids.next() as LessonPlanId,
      schoolId: batch.schoolId,
      teacherId: batch.teacherId,
      classId: batch.classId,
      ...draftedPlan(item.content, batch.request.weekStart),
    });
    if (!plan.ok) return null;
    await this.deps.lessonPlans.save(plan.value);
    return plan.value.id;
  }

  private async saveDecks(
    batch: PrepBatch,
    items: readonly Item<'presentation'>[],
  ): Promise<PresentationId[]> {
    const ids: PresentationId[] = [];
    for (const { content } of items) {
      if (content === null) continue;
      const deck = createPresentation({
        id: this.deps.ids.next() as PresentationId,
        schoolId: batch.schoolId,
        teacherId: batch.teacherId,
        name: content.title.slice(0, maxTitleLength),
        subject: batch.request.subject,
        grade: batch.request.grade,
        slides: content.slides,
        now: this.deps.clock.now(),
      });
      if (!deck.ok) continue;
      await this.deps.presentations.save(deck.value);
      ids.push(deck.value.id);
    }
    return ids;
  }

  private async saveWorksheets(
    batch: PrepBatch,
    items: readonly Item<'worksheet'>[],
  ): Promise<GenerationId[]> {
    const ids: GenerationId[] = [];
    for (const item of items) {
      const request = createContentRequest({
        type: 'worksheet',
        subject: batch.request.subject,
        grade: batch.request.grade,
        topic: dayTopic(batch, item.day ?? 1).slice(0, maxTitleLength),
        language: batch.request.language,
      });
      if (!request.ok || item.content === null) continue;
      const generation = createGeneration({
        id: this.deps.ids.next() as GenerationId,
        schoolId: batch.schoolId,
        teacherId: batch.teacherId,
        request: request.value,
        content: item.content,
        createdAt: this.deps.clock.now(),
      });
      if (!generation.ok) continue;
      await this.deps.generations.save(generation.value);
      ids.push(generation.value.id);
    }
    return ids;
  }

  private async saveQuiz(
    batch: PrepBatch,
    cls: Class,
    item?: Item<'quiz'>,
  ): Promise<Result<AssignmentId | null, UseCaseError>> {
    const categoryId = batch.request.quizCategoryId;
    if (item?.content == null || categoryId === null) return ok(null);
    const category = await this.deps.gradeCategories.findById(batch.schoolId, categoryId);
    if (category?.classId !== cls.id) return invalid('quizCategoryId', 'not_allowed');
    const assignment = createAssignment({
      id: this.deps.ids.next() as AssignmentId,
      schoolId: batch.schoolId,
      classId: cls.id,
      categoryId,
      title: quizTitle(batch),
      dueDate: quizDay(batch.request),
      instructions: item.content.instructions,
      questions: item.content.questions,
    });
    if (!assignment.ok) return assignment;
    await this.deps.assignments.save(assignment.value);
    return ok(assignment.value.id);
  }

  /** One email per family address; refused ones are counted, never retried or logged here. */
  private async sendEmails(
    batch: PrepBatch,
  ): Promise<{ emailsSent: number; emailsFailed: number }> {
    const email = batch.parentEmail;
    if (email === null) return { emailsSent: 0, emailsFailed: 0 };
    const school = await this.deps.schools.findById(batch.schoolId);
    const content = this.deps.mailTemplates.weeklyUpdate({
      language: batch.request.language,
      subject: email.subject,
      body: email.body,
      schoolName: school?.name ?? '',
    });
    let emailsSent = 0;
    let emailsFailed = 0;
    for (const address of await parentEmails(this.deps.students, batch)) {
      const to = parseEmail('to', address);
      const sent = to.ok ? await this.deps.mailer.send({ to: to.value, ...content }) : to;
      if (sent.ok) emailsSent += 1;
      else emailsFailed += 1;
    }
    return { emailsSent, emailsFailed };
  }
}

/** The quiz is named after the plan's unit, or the teacher's prompt. */
function quizTitle(batch: PrepBatch): string {
  const unit = ofKind(batch.items, 'plan')[0]?.content?.unit?.trim() ?? '';
  return (unit === '' ? batch.request.prompt : unit).slice(0, maxTitleLength);
}
