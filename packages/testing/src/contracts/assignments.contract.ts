import { describe, expect, it } from 'vitest';
import type {
  AssignmentId,
  AttachmentId,
  ClassId,
  GoogleQuiz,
  GoogleQuizId,
  QuestionId,
  SchoolId,
  StudentId,
  StudentLinkId,
  SubmissionId,
  UserId,
} from '@thp/domain';
import type {
  AttachmentRepository,
  ClassroomConnectionRepository,
  FormsExportRepository,
  GoogleQuizRepository,
  StudentLinkRepository,
  SubmissionRepository,
} from '@thp/ports';
import { aClassroomConnection, anAttachment, aStudentLink, aSubmission } from '../fixtures.ts';
import { deletableContract, scopedRepositoryContract } from './scoped-repository.contract.ts';

export interface AssignmentRepositories {
  readonly submissions: SubmissionRepository;
  readonly attachments: AttachmentRepository;
  readonly studentLinks: StudentLinkRepository;
  readonly classroomConnections: ClassroomConnectionRepository;
  readonly formsExports: FormsExportRepository;
  readonly googleQuizzes: GoogleQuizRepository;
}

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

/**
 * Shared suites for the repositories behind assignments answered from student links. Fixtures
 * use assignment-1, student-1 and class-1 in school-a, so Postgres tests seed those parents.
 */
export function assignmentRepositoryContract(
  name: string,
  make: () => AssignmentRepositories,
): void {
  describe(`${name} (SubmissionRepository.findFor)`, () => {
    it('finds a student’s one submission for an assignment, with its scores', async () => {
      const repo = make().submissions;
      const submission = aSubmission({
        schoolId: schoolA,
        late: true,
        questionScores: { ['q1' as QuestionId]: { score: 2, feedback: null, source: 'auto' } },
      });
      await repo.save(submission);

      expect(await repo.findFor(schoolA, submission.studentId, submission.assignmentId)).toEqual(
        submission,
      );
      expect(await repo.findFor(schoolB, submission.studentId, submission.assignmentId)).toBeNull();
      expect(
        await repo.findFor(schoolA, 'student-9' as StudentId, submission.assignmentId),
      ).toBeNull();
      expect(
        await repo.findFor(schoolA, submission.studentId, 'assignment-9' as AssignmentId),
      ).toBeNull();
    });

    it('keeps one submission per student and assignment', async () => {
      const repo = make().submissions;
      await repo.save(aSubmission({ schoolId: schoolA }));
      await expect(
        repo.save(aSubmission({ schoolId: schoolA, id: 'submission-2' as SubmissionId })),
      ).rejects.toThrow();
    });
  });

  const attachments = {
    make: () => make().attachments,
    sample: (schoolId: SchoolId, id: string) => anAttachment({ schoolId, id: id as AttachmentId }),
  };
  scopedRepositoryContract(`${name} attachments`, {
    ...attachments,
    change: (attachment) => ({ ...attachment, name: 'renamed.pdf' }),
    lists: [
      {
        name: 'listByAssignment',
        call: (repo, schoolId, attachment) =>
          repo.listByAssignment(schoolId, attachment.assignmentId),
      },
    ],
  });
  deletableContract(`${name} attachments`, attachments);

  scopedRepositoryContract(`${name} student links`, {
    make: () => make().studentLinks,
    sample: (schoolId, id) =>
      aStudentLink({ schoolId, id: id as StudentLinkId, tokenHash: `hash-${schoolId}-${id}` }),
    change: (link) => ({ ...link, revokedAt: new Date('2026-09-02T00:00:00Z') }),
    lists: [
      {
        name: 'listByClass',
        call: (repo, schoolId, link) => repo.listByClass(schoolId, link.classId),
      },
    ],
  });

  describe(`${name} (StudentLinkRepository.findByTokenHash)`, () => {
    it('finds a link by the hash of its token only', async () => {
      const repo = make().studentLinks;
      const link = aStudentLink({ schoolId: schoolA, tokenHash: 'hash-abc' });
      await repo.save(link);

      expect(await repo.findByTokenHash('hash-abc')).toEqual(link);
      expect(await repo.findByTokenHash('hash-xyz')).toBeNull();
    });

    it('lists only the class’s links', async () => {
      const repo = make().studentLinks;
      await repo.save(aStudentLink({ schoolId: schoolA }));
      expect(await repo.listByClass(schoolA, 'class-9' as ClassId)).toEqual([]);
    });
  });

  describe(`${name} (ClassroomConnectionRepository)`, () => {
    it('keeps one connection per teacher, within the school', async () => {
      const repo = make().classroomConnections;
      const connection = aClassroomConnection({ schoolId: schoolA });
      await repo.save(connection);
      await repo.save({ ...connection, encryptedRefreshToken: 'sealed-2' });

      expect(await repo.find(schoolA, connection.teacherId)).toEqual({
        ...connection,
        encryptedRefreshToken: 'sealed-2',
      });
      expect(await repo.find(schoolB, connection.teacherId)).toBeNull();
      expect(await repo.find(schoolA, 'teacher-9' as UserId)).toBeNull();

      await repo.delete(schoolB, connection.teacherId);
      expect(await repo.find(schoolA, connection.teacherId)).not.toBeNull();
      await repo.delete(schoolA, connection.teacherId);
      expect(await repo.find(schoolA, connection.teacherId)).toBeNull();
    });
  });

  describe(`${name} (FormsExportRepository)`, () => {
    it('keeps the latest quiz per assignment, within the school', async () => {
      const repo = make().formsExports;
      const first = {
        schoolId: schoolA,
        assignmentId: 'assignment-1' as AssignmentId,
        formId: 'form-1',
        editUrl: 'https://docs.google.com/forms/d/form-1/edit',
        responderUrl: 'https://docs.google.com/forms/d/e/x1/viewform',
        createdAt: new Date('2026-11-04T12:00:00Z'),
      };
      await repo.save(first);
      const second = { ...first, formId: 'form-2', createdAt: new Date('2026-11-05T12:00:00Z') };
      await repo.save(second);

      expect(await repo.find(schoolA, first.assignmentId)).toEqual(second);
      expect(await repo.find(schoolB, first.assignmentId)).toBeNull();
      expect(await repo.find(schoolA, 'assignment-9' as AssignmentId)).toBeNull();
    });
  });

  describe(`${name} (GoogleQuizRepository)`, () => {
    const quiz = (id: string, ownerId: string, madeOn: string): GoogleQuiz => ({
      id: id as GoogleQuizId,
      schoolId: schoolA,
      ownerId: ownerId as UserId,
      title: `Quiz ${id}`,
      formId: `form-${id}`,
      editUrl: `https://docs.google.com/forms/d/form-${id}/edit`,
      responderUrl: `https://docs.google.com/forms/d/e/${id}/viewform`,
      createdAt: new Date(`${madeOn}T12:00:00Z`),
    });

    it('lists only the owner’s quizzes, newest first, within the school', async () => {
      const repo = make().googleQuizzes;
      const older = quiz('gq-1', 'teacher-1', '2026-11-01');
      const newer = quiz('gq-2', 'teacher-1', '2026-11-03');
      await repo.save(older);
      await repo.save(newer);
      await repo.save(quiz('gq-3', 'teacher-2', '2026-11-02'));

      expect(await repo.listByOwner(schoolA, 'teacher-1' as UserId)).toEqual([newer, older]);
      expect(await repo.listByOwner(schoolB, 'teacher-1' as UserId)).toEqual([]);
      expect(await repo.findForOwner(schoolA, 'teacher-1' as UserId, older.id)).toEqual(older);
      expect(await repo.findForOwner(schoolA, 'teacher-2' as UserId, older.id)).toBeNull();
      expect(await repo.findForOwner(schoolB, 'teacher-1' as UserId, older.id)).toBeNull();
    });
  });
}
