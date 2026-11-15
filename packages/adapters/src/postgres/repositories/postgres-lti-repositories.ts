import { sql, type Kysely, type Selectable } from 'kysely';
import type {
  AssignmentId,
  ClassId,
  GameId,
  LtiCourse,
  LtiPlacedItem,
  LtiPlacement,
  LtiPlatform,
  LtiPlatformId,
  SchoolId,
  StudentId,
  UserId,
} from '@thp/domain';
import type {
  LtiCourseRepository,
  LtiNonceRepository,
  LtiPlacementRepository,
  LtiPlatformRepository,
  LtiStudentLink,
  LtiStudentLinkRepository,
  LtiUserLinkRepository,
} from '@thp/ports';
import type {
  Database,
  LtiCoursesTable,
  LtiPlacementsTable,
  LtiPlatformsTable,
} from '../schema.ts';

const fromRow = (row: Selectable<LtiPlatformsTable>): LtiPlatform => ({
  id: row.id as LtiPlatformId,
  schoolId: row.school_id as SchoolId,
  name: row.name,
  issuer: row.issuer,
  clientId: row.client_id,
  deploymentIds: row.deployment_ids,
  authLoginUrl: row.auth_login_url,
  authTokenUrl: row.auth_token_url,
  jwksUrl: row.jwks_url,
  createdAt: row.created_at,
});

export class PostgresLtiPlatformRepository implements LtiPlatformRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(platform: LtiPlatform): Promise<void> {
    const changes = {
      name: platform.name,
      issuer: platform.issuer,
      client_id: platform.clientId,
      deployment_ids: [...platform.deploymentIds],
      auth_login_url: platform.authLoginUrl,
      auth_token_url: platform.authTokenUrl,
      jwks_url: platform.jwksUrl,
      created_at: platform.createdAt,
    };
    await this.db
      .insertInto('lti_platforms')
      .values({ id: platform.id, school_id: platform.schoolId, ...changes })
      .onConflict((conflict) =>
        conflict
          .column('id')
          .doUpdateSet(changes)
          .where('lti_platforms.school_id', '=', platform.schoolId),
      )
      .execute();
  }

  async findById(schoolId: SchoolId, id: LtiPlatformId): Promise<LtiPlatform | null> {
    const row = await this.db
      .selectFrom('lti_platforms')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : fromRow(row);
  }

  async findByIssuer(issuer: string, clientId: string | null): Promise<readonly LtiPlatform[]> {
    let query = this.db.selectFrom('lti_platforms').selectAll().where('issuer', '=', issuer);
    if (clientId !== null) query = query.where('client_id', '=', clientId);
    return (await query.orderBy('created_at').orderBy('id').execute()).map(fromRow);
  }

  async listForSchool(schoolId: SchoolId): Promise<readonly LtiPlatform[]> {
    const rows = await this.db
      .selectFrom('lti_platforms')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(fromRow);
  }

  async delete(schoolId: SchoolId, id: LtiPlatformId): Promise<void> {
    await this.db
      .deleteFrom('lti_platforms')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }
}

/** Used nonces, kept until they expire; expired ones are cleared as new ones come in. */
export class PostgresLtiNonceRepository implements LtiNonceRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async claim(nonce: string, expiresAt: Date): Promise<boolean> {
    await this.db
      .deleteFrom('lti_nonces')
      .where('expires_at', '<', sql<Date>`now()`)
      .execute();
    const inserted = await this.db
      .insertInto('lti_nonces')
      .values({ nonce, expires_at: expiresAt })
      .onConflict((conflict) => conflict.column('nonce').doNothing())
      .executeTakeFirst();
    return inserted.numInsertedOrUpdatedRows === 1n;
  }
}

export class PostgresLtiUserLinkRepository implements LtiUserLinkRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async link(
    platformId: LtiPlatformId,
    subject: string,
    userId: UserId,
    linkedAt: Date,
  ): Promise<void> {
    await this.db
      .insertInto('lti_user_links')
      .values({ platform_id: platformId, subject, user_id: userId, created_at: linkedAt })
      .onConflict((conflict) =>
        conflict
          .columns(['platform_id', 'subject'])
          .doUpdateSet({ user_id: userId, created_at: linkedAt }),
      )
      .execute();
  }

  async findUserId(platformId: LtiPlatformId, subject: string): Promise<UserId | null> {
    const row = await this.db
      .selectFrom('lti_user_links')
      .select('user_id')
      .where('platform_id', '=', platformId)
      .where('subject', '=', subject)
      .executeTakeFirst();
    return row === undefined ? null : (row.user_id as UserId);
  }
}

const courseFromRow = (row: Selectable<LtiCoursesTable>): LtiCourse => ({
  platformId: row.platform_id as LtiPlatformId,
  schoolId: row.school_id as SchoolId,
  teacherId: row.teacher_id as UserId,
  contextId: row.context_id,
  title: row.title,
  membershipsUrl: row.memberships_url,
  lineItemsUrl: row.lineitems_url,
  gradeScopes: row.grade_scopes,
  lastLaunchedAt: row.last_launched_at,
});

export class PostgresLtiCourseRepository implements LtiCourseRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(course: LtiCourse): Promise<void> {
    const changes = {
      title: course.title,
      memberships_url: course.membershipsUrl,
      lineitems_url: course.lineItemsUrl,
      grade_scopes: [...course.gradeScopes],
      last_launched_at: course.lastLaunchedAt,
    };
    await this.db
      .insertInto('lti_courses')
      .values({
        platform_id: course.platformId,
        context_id: course.contextId,
        teacher_id: course.teacherId,
        school_id: course.schoolId,
        ...changes,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['platform_id', 'context_id', 'teacher_id'])
          .doUpdateSet(changes)
          .where('lti_courses.school_id', '=', course.schoolId),
      )
      .execute();
  }

  async listForTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LtiCourse[]> {
    const rows = await this.db
      .selectFrom('lti_courses')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('last_launched_at', 'desc')
      .orderBy('title')
      .execute();
    return rows.map(courseFromRow);
  }

  async find(
    schoolId: SchoolId,
    teacherId: UserId,
    platformId: LtiPlatformId,
    contextId: string,
  ): Promise<LtiCourse | null> {
    const row = await this.db
      .selectFrom('lti_courses')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .where('platform_id', '=', platformId)
      .where('context_id', '=', contextId)
      .executeTakeFirst();
    return row === undefined ? null : courseFromRow(row);
  }
}

/** Student links, reached only through students of the caller's school. */
export class PostgresLtiStudentLinkRepository implements LtiStudentLinkRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async listForClass(
    schoolId: SchoolId,
    classId: ClassId,
    platformId: LtiPlatformId,
  ): Promise<readonly LtiStudentLink[]> {
    const rows = await this.db
      .selectFrom('lti_student_links')
      .innerJoin('students', 'students.id', 'lti_student_links.student_id')
      .select(['lti_student_links.subject', 'lti_student_links.student_id'])
      .where('students.school_id', '=', schoolId)
      .where('students.class_id', '=', classId)
      .where('lti_student_links.platform_id', '=', platformId)
      .orderBy('lti_student_links.subject')
      .execute();
    return rows.map((row) => ({ subject: row.subject, studentId: row.student_id as StudentId }));
  }

  async link(
    schoolId: SchoolId,
    platformId: LtiPlatformId,
    subject: string,
    studentId: StudentId,
  ): Promise<void> {
    await this.db
      .insertInto('lti_student_links')
      .columns(['platform_id', 'student_id', 'subject'])
      .expression((eb) =>
        eb
          .selectFrom('students')
          .select([
            eb.val(platformId).as('platform_id'),
            'students.id',
            eb.val(subject).as('subject'),
          ])
          .where('students.id', '=', studentId)
          .where('students.school_id', '=', schoolId),
      )
      .onConflict((conflict) =>
        conflict.columns(['platform_id', 'student_id']).doUpdateSet({ subject }),
      )
      .execute();
  }

  async listStudentIds(
    schoolId: SchoolId,
    platformId: LtiPlatformId,
    subject: string,
  ): Promise<readonly StudentId[]> {
    const rows = await this.db
      .selectFrom('lti_student_links')
      .innerJoin('students', 'students.id', 'lti_student_links.student_id')
      .select('lti_student_links.student_id')
      .where('students.school_id', '=', schoolId)
      .where('lti_student_links.platform_id', '=', platformId)
      .where('lti_student_links.subject', '=', subject)
      .orderBy('lti_student_links.student_id')
      .execute();
    return rows.map((row) => row.student_id as StudentId);
  }
}

const placedItemOfRow = (row: Selectable<LtiPlacementsTable>): LtiPlacedItem =>
  row.kind === 'game'
    ? { kind: 'game', id: row.item_id as GameId }
    : { kind: 'assignment', id: row.item_id as AssignmentId };

const placementFromRow = (row: Selectable<LtiPlacementsTable>): LtiPlacement => ({
  platformId: row.platform_id as LtiPlatformId,
  contextId: row.context_id,
  item: placedItemOfRow(row),
  schoolId: row.school_id as SchoolId,
  teacherId: row.teacher_id as UserId,
  placedAt: row.placed_at,
});

/** Placements, each kept once per course; the first teacher and time stay. */
export class PostgresLtiPlacementRepository implements LtiPlacementRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(placement: LtiPlacement): Promise<void> {
    await this.db
      .insertInto('lti_placements')
      .values({
        platform_id: placement.platformId,
        context_id: placement.contextId,
        kind: placement.item.kind,
        item_id: placement.item.id,
        school_id: placement.schoolId,
        teacher_id: placement.teacherId,
        placed_at: placement.placedAt,
      })
      .onConflict((conflict) =>
        conflict.columns(['platform_id', 'context_id', 'kind', 'item_id']).doNothing(),
      )
      .execute();
  }

  async listForItem(schoolId: SchoolId, item: LtiPlacedItem): Promise<readonly LtiPlacement[]> {
    const rows = await this.db
      .selectFrom('lti_placements')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('kind', '=', item.kind)
      .where('item_id', '=', item.id)
      .orderBy('placed_at')
      .orderBy('context_id')
      .execute();
    return rows.map(placementFromRow);
  }

  async find(
    schoolId: SchoolId,
    platformId: LtiPlatformId,
    contextId: string,
    item: LtiPlacedItem,
  ): Promise<LtiPlacement | null> {
    const row = await this.db
      .selectFrom('lti_placements')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('platform_id', '=', platformId)
      .where('context_id', '=', contextId)
      .where('kind', '=', item.kind)
      .where('item_id', '=', item.id)
      .executeTakeFirst();
    return row === undefined ? null : placementFromRow(row);
  }
}
