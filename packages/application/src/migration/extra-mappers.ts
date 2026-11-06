import {
  createLead,
  createStudentInsight,
  createStudentNote,
  createSubPacket,
  leadStatuses,
  type LeadId,
  type LeadStatus,
  type StudentNoteId,
} from '@thp/domain';
import { instant, number, text } from './legacy-fields.ts';
import { invalidReason, type LegacyMapper } from './migration-set.ts';

export const studentNotesMapper: LegacyMapper = {
  collection: 'student_notes',
  map(docs, { set, tally, now }) {
    for (const doc of docs) {
      const id = text(doc, 'note_id');
      const student = set.student(text(doc, 'student_id'));
      const author = set.user(text(doc, 'teacher_id'));
      if (id === null || student === null || author === null) {
        tally.skipped(
          'student_notes',
          id === null ? 'missing_id' : student === null ? 'student_not_found' : 'teacher_not_found',
        );
        continue;
      }
      const note = createStudentNote({
        id: id as StudentNoteId,
        schoolId: student.schoolId,
        studentId: student.id,
        authorId: author.id,
        text: text(doc, 'content') ?? '',
        createdAt: instant(doc, 'created_at') ?? now,
      });
      if (!note.ok) {
        tally.skipped('student_notes', invalidReason(note.error));
        continue;
      }
      set.notes.push(note.value);
      tally.imported('student_notes');
    }
  },
};

/** "- a", "• b", "1. c": the old free-text insight as bullet points. */
const bulletsOf = (insight: string): string[] =>
  insight
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, '').trim())
    .filter((line) => line !== '');

/** Old insights in bullet form keep; a paragraph is left out (the teacher can draft a new one). */
export const studentInsightsMapper: LegacyMapper = {
  collection: 'student_insights',
  map(docs, { set, tally, now }) {
    for (const doc of docs) {
      const student = set.student(text(doc, 'student_id'));
      const teacher = set.user(text(doc, 'teacher_id'));
      if (student === null || teacher === null) {
        tally.skipped(
          'student_insights',
          student === null ? 'student_not_found' : 'teacher_not_found',
        );
        continue;
      }
      const insight = createStudentInsight({
        schoolId: student.schoolId,
        studentId: student.id,
        teacherId: teacher.id,
        bullets: bulletsOf(text(doc, 'insight') ?? ''),
        generatedAt: instant(doc, 'generated_at') ?? now,
      });
      if (!insight.ok) {
        tally.skipped('student_insights', 'not_in_bullets');
        continue;
      }
      set.insights.push(insight.value);
      tally.imported('student_insights');
    }
  },
};

export const subPacketsMapper: LegacyMapper = {
  collection: 'sub_packets',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const cls = set.classes.get(text(doc, 'class_id') ?? '');
      if (cls === undefined) {
        tally.skipped('sub_packets', 'class_not_found');
        continue;
      }
      const packet = createSubPacket({
        classId: cls.id,
        schoolId: cls.schoolId,
        mainOfficeExt: text(doc, 'main_office_ext'),
        nurseExt: text(doc, 'nurse_ext'),
        dailyRoutines: text(doc, 'daily_routines'),
        emergencyProcedures: text(doc, 'emergency_procedures'),
        additionalNotes: text(doc, 'additional_notes'),
      });
      if (!packet.ok) {
        tally.skipped('sub_packets', invalidReason(packet.error));
        continue;
      }
      set.subPackets.push(packet.value);
      tally.imported('sub_packets');
    }
  },
};

/** Reminders already sent, so the owner is not sent the same one again. */
export const trialRemindersMapper: LegacyMapper = {
  collection: 'trial_reminders',
  map(docs, { set, tally, now }) {
    for (const doc of docs) {
      const owner = set.user(text(doc, 'user_id'));
      const subscription = [...set.subscriptions.values()].find((s) => s.ownerId === owner?.id);
      if (subscription === undefined) {
        tally.skipped('trial_reminders', 'subscription_not_found');
        continue;
      }
      set.reminders.push({
        subscriptionId: subscription.id,
        schoolId: subscription.schoolId,
        kind: (number(doc, 'days_left') ?? 0) <= 1 ? 'last_day' : 'three_days',
        sentAt: instant(doc, 'sent_at') ?? now,
      });
      tally.imported('trial_reminders');
    }
  },
};

/** Leads from the old chatbot, scored again by today's rules. */
export const leadsMapper: LegacyMapper = {
  collection: 'leads',
  map(docs, { set, tally, now }) {
    for (const doc of docs) {
      const id = text(doc, 'lead_id');
      if (id === null) {
        tally.skipped('leads', 'missing_id');
        continue;
      }
      const name = [text(doc, 'first_name'), text(doc, 'last_name')].filter(Boolean).join(' ');
      const lead = createLead({
        id: id as LeadId,
        name: name || (text(doc, 'name') ?? ''),
        email: text(doc, 'email') ?? '',
        organization: text(doc, 'school_org'),
        role: text(doc, 'visitor_category') ?? text(doc, 'role_title') ?? 'other',
        phone: text(doc, 'phone'),
        interest: text(doc, 'interest_category') ?? text(doc, 'interest') ?? 'other',
        source: 'chat',
        message: text(doc, 'chat_summary'),
        locale: 'en',
        page: text(doc, 'page_url'),
        now: instant(doc, 'created_at') ?? now,
      });
      if (!lead.ok) {
        tally.skipped('leads', invalidReason(lead.error));
        continue;
      }
      const status = text(doc, 'status');
      set.leads.push({
        ...lead.value,
        status: (leadStatuses as readonly (string | null)[]).includes(status)
          ? (status as LeadStatus)
          : 'new',
      });
      tally.imported('leads');
    }
  },
};
