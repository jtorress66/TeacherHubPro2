import { describe, expect, it } from 'vitest';
import type {
  AssignmentId,
  AttachmentId,
  ClassId,
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
}
