import { z } from 'zod';

// What `pnpm tour:capture` with TOUR_FRAMES writes beside a language's frames
// (apps/web/e2e/tour/tour-kit.ts): the chapters in order and each step's device and highlight.

const focusSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .nullable();

export const manifestSchema = z.object({
  locale: z.string(),
  chapters: z.array(z.object({ id: z.string().min(1), hero: z.string().min(1) })).min(1),
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        chapter: z.string().min(1),
        device: z.enum(['desktop', 'phone']),
        focus: focusSchema,
      }),
    )
    .min(1),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type Focus = NonNullable<Manifest['steps'][number]['focus']>;
