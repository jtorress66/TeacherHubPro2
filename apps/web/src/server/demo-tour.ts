import type { Locale } from '@thp/i18n';

// The product tour on /demo. Each step is one screen of the app with a short explanation; its
// words live in the `demo` catalog group and its screenshot in public/tour/{locale}/{step}.jpg,
// retaken in every language by `pnpm tour:capture` (apps/web/e2e/tour). To show a new feature,
// add its step here, its words to the catalogs, and its screen to the capture script.

/** How a screenshot is taken: a laptop screen, or a phone for what students and parents see. */
export type TourDevice = 'desktop' | 'phone';

interface ChapterDefinition {
  readonly id: string;
  readonly steps: readonly (string | { readonly id: string; readonly device: TourDevice })[];
  /** The one screen that stands for the chapter in the short overview video. */
  readonly hero: string;
}

const phone = <const I extends string>(id: I) => ({ id, device: 'phone' as const });

const chapters = [
  { id: 'start', steps: ['signup', 'commandCenter', 'sampleClass'], hero: 'commandCenter' },
  {
    id: 'classes',
    steps: ['rosterImport', 'accommodations', 'attendance', 'attendanceReport'],
    hero: 'attendance',
  },
  { id: 'planning', steps: ['planner', 'planPrint', 'curriculum', 'templates'], hero: 'planner' },
  {
    id: 'assistant',
    steps: ['assistantForm', 'assistantResult', 'rubric'],
    hero: 'assistantResult',
  },
  { id: 'presentations', steps: ['presentation', 'presentationExport'], hero: 'presentation' },
  { id: 'prep', steps: ['prepStart', 'prepReview'], hero: 'prepReview' },
  {
    id: 'assignments',
    steps: ['pdfImport', 'studentLinks', phone('studentAnswer'), 'aiGrading'],
    hero: 'aiGrading',
  },
  { id: 'gradebook', steps: ['gradebook', 'reportCards'], hero: 'gradebook' },
  {
    id: 'games',
    steps: ['gameBuilder', phone('gameReview'), 'aiExplanations', 'coverage'],
    hero: 'aiExplanations',
  },
  { id: 'live', steps: ['liveLobby', phone('livePlayer'), 'liveReveal'], hero: 'liveReveal' },
  { id: 'learning', steps: ['learningPath', phone('studentLesson'), 'insights'], hero: 'insights' },
  { id: 'families', steps: [phone('parentPortal')], hero: 'parentPortal' },
  { id: 'substitutes', steps: ['subPacket'], hero: 'subPacket' },
  { id: 'connections', steps: ['integrations', 'schoolSystems'], hero: 'integrations' },
  {
    id: 'schools',
    steps: ['schoolOverview', 'schoolUsers', 'approvals', 'dataExport', 'languages'],
    hero: 'schoolOverview',
  },
] as const satisfies readonly ChapterDefinition[];

export type TourChapterId = (typeof chapters)[number]['id'];

type StepOf<T> = T extends string ? T : T extends { readonly id: infer I } ? I : never;
export type TourStepId = StepOf<(typeof chapters)[number]['steps'][number]>;

export interface TourStep {
  readonly id: TourStepId;
  readonly chapter: TourChapterId;
  /** 1, 2, 3 … across the whole tour. */
  readonly number: number;
  readonly device: TourDevice;
}

export interface TourChapter {
  readonly id: TourChapterId;
  readonly hero: TourStepId;
}

export const tourChapters: readonly TourChapter[] = chapters.map(({ id, hero }) => ({
  id,
  hero,
}));

export const tourSteps: readonly TourStep[] = chapters
  .flatMap((chapter) =>
    chapter.steps.map((step: ChapterDefinition['steps'][number]) =>
      typeof step === 'string'
        ? { id: step, device: 'desktop' as const, chapter: chapter.id }
        : { ...step, chapter: chapter.id },
    ),
  )
  .map((step, index) => ({ ...step, id: step.id as TourStepId, number: index + 1 }));

/** Each device's screen, in CSS pixels; screenshots are taken and shown at this size. */
export const tourScreens: Readonly<Record<TourDevice, { width: number; height: number }>> = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
};

export const tourImage = (locale: Locale, step: TourStepId): string =>
  `/tour/${locale}/${step}.jpg`;
