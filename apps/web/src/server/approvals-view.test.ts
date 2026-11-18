import { describe, expect, it } from 'vitest';
import type { ApprovalRow } from '@thp/application';
import type { AuditEvent, AuditEventId, ClassId, LocalDate, SchoolId, UserId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  approvalCells,
  approvalsCsv,
  approvalsQueryFrom,
  approvalsSearch,
} from './approvals-view.ts';

const event = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'e1' as AuditEventId,
  schoolId: 'school-a' as SchoolId,
  actorId: 'teacher-1' as UserId,
  action: 'ai_grade_approved',
  targetId: 'submission-1',
  at: new Date('2026-11-10T14:05:00.000Z'),
  review: 'kept',
  count: null,
  classId: 'class-1' as ClassId,
  ...overrides,
});

const row = (
  overrides: Partial<AuditEvent> = {},
  names: Partial<ApprovalRow> = {},
): ApprovalRow => ({
  event: event(overrides),
  teacherName: 'Ana López',
  className: 'Science 5',
  item: { kind: 'title', text: 'Fractions quiz' },
  ...names,
});

const when = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const stamp = when.format(new Date('2026-11-10T14:05:00.000Z'));

describe('approvalsQueryFrom', () => {
  it('reads the type, the teacher and whole days in the teacher’s time zone', () => {
    expect(
      approvalsQueryFrom(
        { type: 'prep_approved', from: '2026-11-01', to: '2026-11-02', teacher: 'teacher-2' },
        'America/Puerto_Rico',
      ),
    ).toEqual({
      action: 'prep_approved',
      teacherId: 'teacher-2',
      from: new Date('2026-11-01T04:00:00.000Z'),
      to: new Date('2026-11-03T04:00:00.000Z'),
    });
  });

  it('ignores anything it does not recognise', () => {
    expect(
      approvalsQueryFrom(
        { type: 'student_added', from: 'yesterday', to: ['2026-11-01'], teacher: '' },
        'UTC',
      ),
    ).toEqual({});
  });
});

describe('approvalsSearch', () => {
  it('keeps the filters for the CSV link, leaving out empty ones', () => {
    expect(approvalsSearch({ type: 'prep_approved', from: '', teacher: 't-1' }, 'es')).toBe(
      'locale=es&type=prep_approved&teacher=t-1',
    );
  });
});

describe('approvalCells', () => {
  const t = createTranslator('en');

  it('says whether an AI grade was kept or changed, with the class, never a student', () => {
    expect(approvalCells(row(), t, when, 'en')).toEqual([
      stamp,
      'Ana López',
      'Approved an AI-suggested grade (kept as suggested)',
      'Fractions quiz',
      'Science 5',
    ]);
    expect(approvalCells(row({ review: 'changed' }), t, when, 'en')[2]).toBe(
      'Approved an AI-suggested grade (changed by the teacher)',
    );
  });

  it('gives the counts for game grades and weekly prep', () => {
    expect(
      approvalCells(
        row({ action: 'game_grades_approved', review: null, count: 3 }),
        t,
        when,
        'en',
      )[2],
    ).toBe('Approved a game’s grades (grades saved: 3)');
    expect(
      approvalCells(row({ action: 'prep_approved', review: null, count: 0 }), t, when, 'en')[2],
    ).toBe('Approved a weekly prep (family emails sent: 0)');
    expect(
      approvalCells(row({ action: 'learning_path_assigned', review: null }), t, when, 'en')[2],
    ).toBe('Assigned a learning path');
    expect(
      approvalCells(
        row({ action: 'grades_sent_to_course', review: null, count: 2 }),
        t,
        when,
        'en',
      )[2],
    ).toBe('Sent grades to a course system (grades sent: 2)');
  });

  it('shows a dash for a missing class and a former user for a missing name', () => {
    expect(
      approvalCells(row({ classId: null }, { className: null, teacherName: null }), t, when, 'en'),
    ).toEqual([stamp, 'A former user', expect.any(String), expect.any(String), '—']);
  });

  it('names the item: a title, the week of a prep batch, a subject, or that it was deleted', () => {
    const item = (value: ApprovalRow['item'], locale: 'en' | 'es' = 'en') =>
      approvalCells(row({}, { item: value }), createTranslator(locale), when, locale)[3];

    expect(item({ kind: 'title', text: 'Planet race' })).toBe('Planet race');
    expect(item({ kind: 'week', start: '2026-11-09' as LocalDate })).toBe('Week of Nov 9, 2026');
    expect(item({ kind: 'week', start: '2026-11-09' as LocalDate }, 'es')).toBe(
      'Semana del 9 nov 2026',
    );
    expect(item({ kind: 'subject', subject: 'science' })).toBe('Science');
    expect(item({ kind: 'subject', subject: 'science' }, 'es')).toBe('Ciencias');
    expect(item({ kind: 'deleted' })).toBe('(deleted)');
    expect(item({ kind: 'deleted' }, 'es')).toBe('(eliminado)');
  });

  it('is translated', () => {
    const es = createTranslator('es');
    expect(approvalCells(row(), es, when, 'es')[2]).toBe(
      'Aprobó una nota sugerida por la IA (se mantuvo la sugerencia)',
    );
  });
});

describe('approvalsCsv', () => {
  it('writes a translated header row, then one line per approval', () => {
    const csv = approvalsCsv([row()], createTranslator('es'), when, 'es');

    expect(csv.slice(1).split('\r\n')).toEqual([
      'Cuándo,Maestro,Qué,Elemento,Clase',
      `"${stamp}",Ana López,Aprobó una nota sugerida por la IA (se mantuvo la sugerencia),Fractions quiz,Science 5`,
      '',
    ]);
  });

  it('never lets a teacher-typed title run as a formula', () => {
    const csv = approvalsCsv(
      [row({}, { item: { kind: 'title', text: '=HYPERLINK("x")' } })],
      createTranslator('en'),
      when,
      'en',
    );

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('starts with a byte order mark so spreadsheets read accents', () => {
    expect(approvalsCsv([], createTranslator('en'), when, 'en').charCodeAt(0)).toBe(0xfeff);
  });
});
