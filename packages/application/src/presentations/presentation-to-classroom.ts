import {
  checkSchedule,
  ok,
  optionalText,
  parseLocalDate,
  requiredText,
  toGoogleSlides,
  type LocalDate,
  type PresentationId,
  type Result,
  type User,
} from '@thp/domain';
import type {
  ClassroomCoursework,
  Clock,
  GoogleSlidesFiles,
  PresentationRepository,
} from '@thp/ports';
import { findOwned } from '../assistant/owned.ts';
import { accessToken, googleFailed, type ConnectionDeps } from '../assignments/classroom.ts';
import type { UseCaseError } from '../errors.ts';

/**
 * Sends the teacher's own presentation to a Classroom course as a Google Slides deck that every
 * student views (one shared, read-only deck). Nothing new is kept in TeacherHubPro.
 */
export class SendPresentationToClassroom {
  constructor(
    private readonly deps: ConnectionDeps & {
      readonly presentations: PresentationRepository;
      readonly googleSlides: GoogleSlidesFiles;
      readonly classroomCoursework: ClassroomCoursework;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly presentationId: PresentationId;
    readonly courseId: string;
    readonly title: string;
    readonly instructions: string | null;
    readonly dueDate: string | null;
    /** Post later, at this moment; missing or null posts now. */
    readonly scheduledAt?: Date | null;
  }): Promise<Result<{ readonly url: string; readonly slidesUrl: string }, UseCaseError>> {
    const presentation = await findOwned(
      this.deps.presentations,
      input.actor,
      input.presentationId,
    );
    if (!presentation.ok) return presentation;
    const course = requiredText('courseId', input.courseId);
    if (!course.ok) return course;
    const title = requiredText('title', input.title);
    if (!title.ok) return title;
    const instructions = optionalText('instructions', input.instructions, 5000);
    if (!instructions.ok) return instructions;
    let dueDate: LocalDate | null = null;
    if (input.dueDate !== null) {
      const parsed = parseLocalDate('dueDate', input.dueDate);
      if (!parsed.ok) return parsed;
      dueDate = parsed.value;
    }
    let scheduledAt: Date | null = null;
    if (input.scheduledAt != null) {
      const checked = checkSchedule('scheduledAt', input.scheduledAt, this.deps.clock.now());
      if (!checked.ok) return checked;
      scheduledAt = checked.value;
    }
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const deck = await this.deps.googleSlides.createPresentation(
      token.value,
      toGoogleSlides(presentation.value),
    );
    if (!deck.ok) return googleFailed(deck.error);
    const posted = await this.deps.classroomCoursework.createCoursework(token.value, course.value, {
      title: title.value,
      description: instructions.value ?? '',
      material: { kind: 'driveFile', driveFileId: deck.value.id, shareMode: 'view' },
      dueDate,
      scheduledAt,
    });
    if (!posted.ok) return googleFailed(posted.error);
    return ok({ url: posted.value.url, slidesUrl: deck.value.url });
  }
}
