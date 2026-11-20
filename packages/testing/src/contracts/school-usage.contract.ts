import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import type { SchoolUsageReport } from '@thp/ports';

/** A class as the report sees it: how many students, and what happened in it when. */
export interface UsageClassSeed {
  readonly students: number;
  readonly archived?: boolean;
  readonly sample?: boolean;
  /** Days attendance was taken, as YYYY-MM-DD. */
  readonly attendanceOn?: readonly string[];
  readonly assignmentsAt?: readonly Date[];
}

export interface UsageTeacherSeed {
  readonly id: UserId;
  readonly name: string;
  readonly lastActiveAt: Date | null;
  /** AI drafts (job kind `ai.test`) started at these moments. */
  readonly aiDraftsAt?: readonly Date[];
  /** Other background jobs (kind `other.test`), which are not AI drafts. */
  readonly otherJobsAt?: readonly Date[];
  readonly classes?: readonly UsageClassSeed[];
}

export interface UsageSeed {
  readonly schoolId: SchoolId;
  readonly teachers: readonly UsageTeacherSeed[];
}

export interface UsageWorld {
  readonly report: SchoolUsageReport;
  /** Stores the people, classes and activity the report reads. */
  seed(data: UsageSeed): Promise<void>;
}

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const since = new Date('2026-10-21T00:00:00Z');
const inside = new Date('2026-11-10T09:00:00Z');
const before = new Date('2026-10-01T09:00:00Z');
const query = (schoolId: SchoolId) => ({ schoolId, since, aiJobKinds: ['ai.test'] });

export function schoolUsageReportContract(name: string, make: () => Promise<UsageWorld>): void {
  describe(`${name} (SchoolUsageReport contract)`, () => {
    it("counts each teacher's classes and students, and only the activity since the date", async () => {
      const world = await make();
      await world.seed({
        schoolId: schoolA,
        teachers: [
          {
            id: 'teacher-1' as UserId,
            name: 'Ana López',
            lastActiveAt: inside,
            aiDraftsAt: [inside, inside, before],
            otherJobsAt: [inside],
            classes: [
              {
                students: 3,
                attendanceOn: ['2026-11-09', '2026-11-10', '2026-10-01'],
                assignmentsAt: [inside, before],
              },
              { students: 2 },
            ],
          },
        ],
      });

      expect(await world.report.forSchool(query(schoolA))).toEqual([
        {
          teacherId: 'teacher-1',
          name: 'Ana López',
          lastActiveAt: inside,
          classes: 2,
          students: 5,
          aiDrafts: 2,
          attendanceDays: 2,
          assignments: 1,
        },
      ]);
    });

    it('leaves out sample and archived classes', async () => {
      const world = await make();
      await world.seed({
        schoolId: schoolA,
        teachers: [
          {
            id: 'teacher-1' as UserId,
            name: 'Ana López',
            lastActiveAt: null,
            classes: [
              { students: 4, sample: true, attendanceOn: ['2026-11-09'], assignmentsAt: [inside] },
              { students: 6, archived: true, attendanceOn: ['2026-11-09'] },
              { students: 1 },
            ],
          },
        ],
      });

      const [row] = await world.report.forSchool(query(schoolA));
      expect(row).toMatchObject({ classes: 1, students: 1, attendanceDays: 0, assignments: 0 });
    });

    it('lists people with nothing yet, with zeros, sorted by name', async () => {
      const world = await make();
      await world.seed({
        schoolId: schoolA,
        teachers: [
          { id: 'teacher-2' as UserId, name: 'Zoe Ruiz', lastActiveAt: null },
          { id: 'teacher-1' as UserId, name: 'Ana López', lastActiveAt: null },
        ],
      });

      const rows = await world.report.forSchool(query(schoolA));
      expect(rows.map((row) => row.name)).toEqual(['Ana López', 'Zoe Ruiz']);
      expect(rows[1]).toEqual({
        teacherId: 'teacher-2',
        name: 'Zoe Ruiz',
        lastActiveAt: null,
        classes: 0,
        students: 0,
        aiDrafts: 0,
        attendanceDays: 0,
        assignments: 0,
      });
    });

    it("never shows another school's people", async () => {
      const world = await make();
      await world.seed({
        schoolId: schoolB,
        teachers: [
          {
            id: 'teacher-b' as UserId,
            name: 'Other',
            lastActiveAt: inside,
            aiDraftsAt: [inside],
            classes: [{ students: 9 }],
          },
        ],
      });

      expect(await world.report.forSchool(query(schoolA))).toEqual([]);
    });
  });
}
