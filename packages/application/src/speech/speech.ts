import {
  createSpeechRequest,
  err,
  ok,
  type Job,
  type JobFailure,
  type Language,
  type Result,
  type SchoolId,
  type User,
} from '@thp/domain';
import type {
  Clock,
  FileStore,
  JobQueue,
  StoredFile,
  SubscriptionRepository,
  TextToSpeech,
  TokenHasher,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';

export const speechJobKind = 'speech.synthesize';

/** What a speech job holds: the parts to read and the voice, with each part's clip id. */
interface SpeechJob {
  readonly language: Language;
  readonly voice: string;
  readonly parts: readonly { readonly text: string; readonly clipId: string }[];
}

/** Audio is ready to play, or a job is making the parts that are not cached yet. */
export type SpeechOutcome =
  | { readonly status: 'ready'; readonly clips: readonly string[] }
  | { readonly status: 'queued'; readonly clips: readonly string[]; readonly job: Job };

const clipPattern = /^[0-9a-f]{64}$/;
const clipKey = (schoolId: SchoolId, clipId: string) => `speech/${schoolId}/${clipId}.mp3`;

/** A clip's id: a hash of the voice, language and text, so the same words are made once. */
const clipIdOf = (hasher: TokenHasher, voice: string, language: Language, text: string) =>
  hasher.hash(`${voice}|${language}|${text}`);

const isCached = async (files: FileStore, schoolId: SchoolId, clipId: string) =>
  (await files.get(clipKey(schoolId, clipId))).ok;

/**
 * Reads text aloud. Needs AI access. Audio is cached per school, so the same text is never paid
 * for twice; only the missing parts are queued.
 */
export class RequestSpeech {
  constructor(
    private readonly deps: {
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
      readonly files: FileStore;
      readonly tokenHasher: TokenHasher;
      readonly voice: string;
    },
  ) {}

  async execute(input: {
    actor: User;
    text: string;
    language: string;
  }): Promise<Result<SpeechOutcome, UseCaseError>> {
    const { actor } = input;
    const access = await checkAiAccess(this.deps, actor.schoolId);
    if (!access.ok) return access;
    const request = createSpeechRequest(input);
    if (!request.ok) return request;
    const { language, parts } = request.value;
    const { voice, tokenHasher, files } = this.deps;
    const clips = await Promise.all(
      parts.map(async (text) => ({
        text,
        clipId: await clipIdOf(tokenHasher, voice, language, text),
      })),
    );
    const clipIds = clips.map((clip) => clip.clipId);
    const cached = await Promise.all(clipIds.map((id) => isCached(files, actor.schoolId, id)));
    if (cached.every(Boolean)) return ok({ status: 'ready', clips: clipIds });
    const payload: SpeechJob = { language, voice, parts: clips.filter((_, i) => !cached[i]) };
    const job = await this.deps.jobs.enqueue({
      schoolId: actor.schoolId,
      ownerId: actor.id,
      kind: speechJobKind,
      payload,
    });
    return ok({ status: 'queued', clips: clipIds, job });
  }
}

/** Makes the audio for a speech job's parts and caches it for the school. */
export class SpeechHandler implements JobHandler {
  readonly kind = speechJobKind;

  constructor(private readonly deps: { readonly tts: TextToSpeech; readonly files: FileStore }) {}

  async handle(
    job: Job,
  ): Promise<Result<{ clips: readonly string[] }, { readonly code: JobFailure }>> {
    const { language, voice, parts } = job.payload as SpeechJob;
    for (const { text, clipId } of parts) {
      if (!clipPattern.test(clipId)) return err({ code: 'failed' });
      if (await isCached(this.deps.files, job.schoolId, clipId)) continue;
      const speech = await this.deps.tts.synthesize({ text, voice, language });
      if (!speech.ok) return err({ code: 'ai_unavailable' });
      const stored = await this.deps.files.put(clipKey(job.schoolId, clipId), {
        bytes: speech.value.audio,
        contentType: speech.value.mimeType,
      });
      if (!stored.ok) return err({ code: 'failed' });
    }
    return ok({ clips: parts.map((part) => part.clipId) });
  }
}

/** One cached clip, only within the actor's school. */
export class GetSpeechClip {
  constructor(private readonly deps: { readonly files: FileStore }) {}

  async execute(input: { actor: User; clipId: string }): Promise<Result<StoredFile, UseCaseError>> {
    if (!clipPattern.test(input.clipId)) return fail('not_found');
    const file = await this.deps.files.get(clipKey(input.actor.schoolId, input.clipId));
    return file.ok ? ok(file.value) : fail('not_found');
  }
}
