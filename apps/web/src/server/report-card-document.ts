import type { ReportCard, ReportCards } from '@thp/application';
import { letterGrade, type LocalDate } from '@thp/domain';
import { createTranslator, type Locale, type Translate } from '@thp/i18n';
import type { DocumentFact, ReportCardPage, ReportCardSection } from '@thp/ports';
import { formatGpa, formatPercent, formatPoints } from './gradebook-display.ts';

/** Only the facts that have a value. */
const facts = (items: readonly (DocumentFact | null)[]): ReportCardSection => ({
  kind: 'facts',
  items: items.filter((item): item is DocumentFact => item !== null),
});

function gradesTable(card: ReportCard, t: Translate, locale: Locale): ReportCardSection {
  return {
    kind: 'table',
    title: t('reportCards.grades'),
    headers: [
      t('reportCards.category'),
      t('reportCards.points'),
      t('reportCards.percent'),
      t('reportCards.letter'),
    ],
    rows: card.categories.map(({ category, result }) => [
      `${category.name} (${formatPercent(category.weightPercent, locale)})`,
      `${formatPoints(result.earned, locale)} / ${formatPoints(result.possible, locale)}`,
      formatPercent(result.percentage, locale),
      letterGrade(result.percentage),
    ]),
    empty: t('reportCards.noGrades'),
  };
}

function attendanceTable(card: ReportCard, t: Translate, locale: Locale): ReportCardSection {
  const { summary, rate } = card.attendance;
  return {
    kind: 'table',
    title: t('reportCards.attendance'),
    headers: [
      t('reportCards.present'),
      t('reportCards.absent'),
      t('reportCards.tardy'),
      t('reportCards.excused'),
      t('reportCards.days'),
      t('reportCards.rate'),
    ],
    rows:
      summary.total === 0
        ? []
        : [
            [summary.present, summary.absent, summary.tardy, summary.excused, summary.total]
              .map(String)
              .concat(formatPercent(rate, locale)),
          ],
    empty: t('reportCards.noAttendance'),
  };
}

function page(
  data: ReportCards,
  card: ReportCard,
  locale: Locale,
  today: LocalDate,
): ReportCardPage {
  const t = createTranslator(locale);
  const { school, cls, semester, teacher } = data;
  const { student, summary } = card;
  const overall =
    summary.overall === null
      ? formatPercent(null, locale)
      : `${formatPercent(summary.overall, locale)} (${summary.letter ?? ''})`;
  const details = [school.address, school.phone, school.email].filter((v) => v !== null);

  const sections: ReportCardSection[] = [
    facts([
      { label: t('reportCards.student'), value: `${student.firstName} ${student.lastName}` },
      student.studentNumber === null
        ? null
        : { label: t('reportCards.studentNumber'), value: student.studentNumber },
      { label: t('reportCards.class'), value: cls.name },
      semester ? { label: t('reportCards.semester'), value: semester.name } : null,
      teacher ? { label: t('reportCards.teacher'), value: teacher.name } : null,
      { label: t('reportCards.date'), value: today },
    ]),
    gradesTable(card, t, locale),
    facts([
      { label: t('reportCards.overall'), value: overall },
      { label: t('reportCards.gpa'), value: formatGpa(summary.gpa, locale) },
    ]),
    attendanceTable(card, t, locale),
  ];
  if (card.comment !== null) {
    sections.push({ kind: 'text', title: t('reportCards.comments'), text: card.comment });
  }
  sections.push({
    kind: 'signatures',
    labels: [
      t('reportCards.signatureTeacher'),
      t('reportCards.signaturePrincipal'),
      t('reportCards.signatureParent'),
    ],
  });

  return {
    schoolName: school.name,
    schoolDetails: details.length === 0 ? null : details.join(' · '),
    logo: data.logo,
    title: t('reportCards.documentTitle'),
    sections,
  };
}

/** Each student's report card as a page for the renderer, in the page's language. */
export function reportCardPages(
  data: ReportCards,
  locale: Locale,
  today: LocalDate,
): [ReportCardPage, ...ReportCardPage[]] | null {
  const [first, ...rest] = data.cards.map((card) => page(data, card, locale, today));
  return first ? [first, ...rest] : null;
}

const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** `boleta-ana-zayas.pdf` for one student, or the class name for several. */
export function reportCardFileName(data: ReportCards, locale: Locale): string {
  const t = createTranslator(locale);
  const only = data.cards.length === 1 ? data.cards[0] : undefined;
  const name = only ? `${only.student.firstName} ${only.student.lastName}` : data.cls.name;
  return `${slug(`${t('reportCards.fileName')} ${name}`)}.pdf`;
}
