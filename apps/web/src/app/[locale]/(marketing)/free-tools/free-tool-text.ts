import type { MessageKey } from '@thp/i18n';
import type { FreeToolSlug } from '../../../../server/marketing-pages.ts';

/** Each free tool's words: its name, summary, introduction, closing invitation and search text. */
export const freeToolText: Readonly<
  Record<
    FreeToolSlug,
    {
      readonly name: MessageKey;
      readonly summary: MessageKey;
      readonly intro: MessageKey;
      readonly cta: MessageKey;
      readonly metaTitle: MessageKey;
      readonly metaDescription: MessageKey;
    }
  >
> = {
  'grade-calculator': {
    name: 'marketing.freeTools.gradeName',
    summary: 'marketing.freeTools.gradeSummary',
    intro: 'marketing.freeTools.gradeIntro',
    cta: 'marketing.freeTools.gradeCta',
    metaTitle: 'marketing.freeTools.gradeMetaTitle',
    metaDescription: 'marketing.freeTools.gradeMetaDescription',
  },
  'group-maker': {
    name: 'marketing.freeTools.groupName',
    summary: 'marketing.freeTools.groupSummary',
    intro: 'marketing.freeTools.groupIntro',
    cta: 'marketing.freeTools.groupCta',
    metaTitle: 'marketing.freeTools.groupMetaTitle',
    metaDescription: 'marketing.freeTools.groupMetaDescription',
  },
  'rubric-maker': {
    name: 'marketing.freeTools.rubricName',
    summary: 'marketing.freeTools.rubricSummary',
    intro: 'marketing.freeTools.rubricIntro',
    cta: 'marketing.freeTools.rubricCta',
    metaTitle: 'marketing.freeTools.rubricMetaTitle',
    metaDescription: 'marketing.freeTools.rubricMetaDescription',
  },
};
