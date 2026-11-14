import { z } from 'zod';
import type { ApprovalItem, ApprovalRow, ApprovalsQuery } from '@thp/application';
import {
  addDays,
  approvalActions,
  instantIn,
  type AuditEvent,
  type LocalDate,
  type UserId,
} from '@thp/domain';
import type { Locale, Translate } from '@thp/i18n';
import { formatDate } from './lesson-plan-display.ts';

/** The filters as they arrive in a link: anything unexpected is simply ignored. */
const filterSchema = z.object({
  type: z.enum(approvalActions).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  teacher: z.string().trim().min(1).max(100).optional().catch(undefined),
});

export type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * The approvals filter from a link's search params. Dates are whole days in the teacher's time
 * zone: "to" includes that day.
 */
export function approvalsQueryFrom(params: SearchParams, timeZone: string): ApprovalsQuery {
  const read = filterSchema.parse(params);
  return {
    ...(read.type === undefined ? {} : { action: read.type }),
    ...(read.teacher === undefined ? {} : { teacherId: read.teacher as UserId }),
    ...(read.from === undefined ? {} : { from: instantIn(read.from as LocalDate, 0, 0, timeZone) }),
    ...(read.to === undefined
      ? {}
      : { to: instantIn(addDays(read.to as LocalDate, 1), 0, 0, timeZone) }),
  };
}

/** The same filters as a query string, for the CSV link. */
export function approvalsSearch(params: SearchParams, locale: Locale): string {
  const search = new URLSearchParams({ locale });
  for (const name of ['type', 'from', 'to', 'teacher'] as const) {
    const value = params[name];
    if (typeof value === 'string' && value !== '') search.set(name, value);
  }
  return search.toString();
}

/** What was approved, in words, with the kept/changed note or the count; never content. */
function describe(event: AuditEvent, t: Translate): string {
  const action = t(`activity.action_${event.action}`);
  const detail =
    event.review !== null
      ? t(`approvals.${event.review}`)
      : event.count === null
        ? null
        : event.action === 'prep_approved'
          ? t('approvals.familyEmails', { count: event.count })
          : t('approvals.grades', { count: event.count });
  return detail === null ? action : t('approvals.detail', { action, detail });
}

type ItemOf<K extends ApprovalItem['kind']> = Extract<ApprovalItem, { kind: K }>;

/** How each kind of item reads. A new kind adds an entry here. */
const itemLabels: {
  readonly [K in ApprovalItem['kind']]: (item: ItemOf<K>, t: Translate, locale: Locale) => string;
} = {
  title: (item) => item.text,
  week: (item, t, locale) => t('approvals.week', { date: formatDate(item.start, locale) }),
  subject: (item, t) => t(`assistant.subject_${item.subject}`),
  deleted: (_item, t) => t('approvals.deleted'),
};

function itemLabel(item: ApprovalItem, t: Translate, locale: Locale): string {
  const label = itemLabels[item.kind] as (item: ApprovalItem, t: Translate, l: Locale) => string;
  return label(item, t, locale);
}

/** One table row (and CSV line): when, teacher, what, item, class. */
export function approvalCells(
  row: ApprovalRow,
  t: Translate,
  when: Intl.DateTimeFormat,
  locale: Locale,
): readonly [string, string, string, string, string] {
  return [
    when.format(row.event.at),
    row.teacherName ?? t('activity.someone'),
    describe(row.event, t),
    itemLabel(row.item, t, locale),
    row.className ?? '—',
  ];
}

/** Characters a spreadsheet may read as the start of a formula. */
const formulaStart = /^[=+\-@\t\r]/u;

/** A CSV cell, quoted when needed, and never run as a formula by a spreadsheet. */
export function csvCell(value: string): string {
  const safe = formulaStart.test(value) ? `'${value}` : value;
  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const byteOrderMark = String.fromCharCode(0xfeff);

/** The approvals as CSV with a translated header row; spreadsheets read it as UTF-8. */
export function approvalsCsv(
  rows: readonly ApprovalRow[],
  t: Translate,
  when: Intl.DateTimeFormat,
  locale: Locale,
): string {
  const header = [
    t('approvals.when'),
    t('approvals.teacher'),
    t('approvals.what'),
    t('approvals.item'),
    t('approvals.className'),
  ];
  const lines = [header, ...rows.map((row) => approvalCells(row, t, when, locale))];
  return byteOrderMark + lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
