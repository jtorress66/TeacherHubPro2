import type { TeacherUsage } from '@thp/domain';
import type { SchoolUsageQuery, SchoolUsageReport } from '@thp/ports';
import type { UsageSeed } from '../contracts/school-usage.contract.ts';

/** Works out the report from seeded people and classes, the way the database query does. */
export class InMemorySchoolUsageReport implements SchoolUsageReport {
  private readonly schools: UsageSeed[] = [];
  /** Every query asked, newest last. */
  readonly queries: SchoolUsageQuery[] = [];

  seed(data: UsageSeed): Promise<void> {
    this.schools.push(data);
    return Promise.resolve();
  }

  forSchool(query: SchoolUsageQuery): Promise<readonly TeacherUsage[]> {
    this.queries.push(query);
    const { schoolId, since, aiJobKinds } = query;
    const countsAi = aiJobKinds.includes('ai.test');
    const day = since.toISOString().slice(0, 10);
    const rows = this.schools
      .filter((school) => school.schoolId === schoolId)
      .flatMap((school) => school.teachers)
      .map((teacher): TeacherUsage => {
        const classes = (teacher.classes ?? []).filter((c) => !c.sample && !c.archived);
        return {
          teacherId: teacher.id,
          name: teacher.name,
          lastActiveAt: teacher.lastActiveAt,
          classes: classes.length,
          students: classes.reduce((n, c) => n + c.students, 0),
          aiDrafts: countsAi ? (teacher.aiDraftsAt ?? []).filter((at) => at >= since).length : 0,
          attendanceDays: classes.reduce(
            (n, c) => n + (c.attendanceOn ?? []).filter((date) => date >= day).length,
            0,
          ),
          assignments: classes.reduce(
            (n, c) => n + (c.assignmentsAt ?? []).filter((at) => at >= since).length,
            0,
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return Promise.resolve(rows);
  }
}
