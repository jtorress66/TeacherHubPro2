import {
  canManageSchool,
  ok,
  setSchoolFeatures,
  summarizeUsage,
  usageSince,
  type AuditAction,
  type AuditEventId,
  type Result,
  type SchoolFeatures,
  type TeacherUsage,
  type UsageTotals,
  type User,
} from '@thp/domain';
import type {
  AuditLog,
  Clock,
  IdGenerator,
  SchoolRepository,
  SchoolUsageReport,
  SubscriptionRepository,
} from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { gradingJobKind } from '../assignments/grading.ts';
import { pdfImportJobKind } from '../assignments/pdf-import.ts';
import { generationJobKind } from '../assistant/assistant.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { gameDraftJobKind } from '../games/game-drafts.ts';
import { learningPathJobKind } from '../learning/learning-paths.ts';
import { draftJobKind } from '../lesson-plans/drafts.ts';
import { prepStepJobKind } from '../prep/prep-batches.ts';
import { presentationDraftJobKind } from '../presentations/presentations.ts';
import { rubricDraftJobKind } from '../rubrics/rubrics.ts';
import { studentInsightJobKind } from '../students/student-360.ts';

/**
 * The background jobs that are AI drafts, counted in the overview. Read-aloud audio and sending
 * grades to a school system are not.
 */
export const aiDraftJobKinds: readonly string[] = [
  draftJobKind,
  generationJobKind,
  presentationDraftJobKind,
  rubricDraftJobKind,
  gameDraftJobKind,
  learningPathJobKind,
  prepStepJobKind,
  gradingJobKind,
  pdfImportJobKind,
  studentInsightJobKind,
];

export interface SchoolOverview {
  readonly teachers: readonly TeacherUsage[];
  readonly totals: UsageTotals;
  readonly features: SchoolFeatures;
}

interface AccessDeps {
  readonly subscriptions: SubscriptionRepository;
}

async function mayManage(deps: AccessDeps, actor: User): Promise<boolean> {
  const subscription = await findSchoolSubscription(deps.subscriptions, actor.schoolId);
  return canManageSchool(actor, subscription);
}

/** For the school's admins and owner: how the school uses the app, and its switches. */
export class GetSchoolOverview {
  constructor(
    private readonly deps: AccessDeps & {
      readonly schools: SchoolRepository;
      readonly schoolUsage: SchoolUsageReport;
      readonly clock: Clock;
    },
  ) {}

  isOpenTo(actor: User): Promise<boolean> {
    return mayManage(this.deps, actor);
  }

  async execute(input: { readonly actor: User }): Promise<Result<SchoolOverview, UseCaseError>> {
    const { actor } = input;
    if (!(await this.isOpenTo(actor))) return fail('forbidden');
    const school = await this.deps.schools.findById(actor.schoolId);
    if (school === null) return fail('not_found');
    const now = this.deps.clock.now();
    const teachers = await this.deps.schoolUsage.forSchool({
      schoolId: actor.schoolId,
      since: usageSince(now),
      aiJobKinds: aiDraftJobKinds,
    });
    return ok({ teachers, totals: summarizeUsage(teachers, now), features: school.features });
  }
}

/** Turns AI drafting, or student flags and insights, on or off for everyone in the school. */
export class SetSchoolFeatures {
  constructor(
    private readonly deps: AccessDeps & {
      readonly schools: SchoolRepository;
      readonly auditLog: AuditLog;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly features: SchoolFeatures;
  }): Promise<Result<SchoolFeatures, UseCaseError>> {
    const { actor, features } = input;
    if (!(await mayManage(this.deps, actor))) return fail('forbidden');
    const school = await this.deps.schools.findById(actor.schoolId);
    if (school === null) return fail('not_found');

    const changes: AuditAction[] = [];
    if (features.ai !== school.features.ai) {
      changes.push(features.ai ? 'school_ai_turned_on' : 'school_ai_turned_off');
    }
    if (features.studentFlags !== school.features.studentFlags) {
      changes.push(
        features.studentFlags
          ? 'school_student_flags_turned_on'
          : 'school_student_flags_turned_off',
      );
    }
    await this.deps.schools.save(setSchoolFeatures(school, features));
    for (const action of changes) {
      await this.deps.auditLog.record({
        id: this.deps.ids.next() as AuditEventId,
        schoolId: actor.schoolId,
        actorId: actor.id,
        action,
        targetId: null,
        at: this.deps.clock.now(),
        review: null,
        count: null,
        classId: null,
      });
    }
    return ok(features);
  }
}
